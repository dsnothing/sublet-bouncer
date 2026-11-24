import type { AnalysisResult, AnalyzeRequest, ActionRecord, Decision, LogEntry } from './types.js';
import { recomputeVerdict, clauseFindings, lookupCommute, scoreScam, newId } from './engine.js';
import { data } from './data.js';
export interface RegressionFixture { listing:string; decision_id:Decision['id']; expected:unknown }
type StoredEntry=LogEntry & { inputs_hash?:string; output?:unknown; inverse?:ActionRecord; profile?:AnalyzeRequest['profile']; decision_kind?:Decision['kind'] };
function hash(s:string) { let n=2166136261; for(const c of s) n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16); }
export function appendLog(r:AnalysisResult,kind:LogEntry['kind'],ref:string,summary:string,actor:LogEntry['actor']='agent',confidence?:number,threshold?:number): StoredEntry {
  const decision=r.decisions.find(d=>d.id===ref);
  const e:StoredEntry={id:newId(),ts:new Date().toISOString(),kind,ref,actor,summary,inputs_hash:hash(r.listing),...(confidence!==undefined?{confidence}:{}),...(threshold!==undefined?{threshold}:{}),...(decision?{output:structuredClone(decision.output),decision_kind:decision.kind}:{})};r.log.push(e);return e;
}
export class ForbiddenActionError extends Error { constructor(action:string){super(`Forbidden action: ${action}`);this.name='ForbiddenActionError';} }
export function refreshActions(r:AnalysisResult,profile?:AnalyzeRequest['profile']) {
  const previous=r.actions; const safe=r.scam.p>.7||r.verdict==='REFUSE';
  const canICS=!r.refused&&['feasible','tight'].includes(r.commute.status)&&r.scam.p<.3&&!r.escalations.length;
  const reply=safe?'I will not send payment or identity documents before verifying the listing and viewing the property. Please offer a viewing.':'Hello, could we arrange a viewing and confirm the lease terms, permitted deposits, and landlord consent for this sublet?';
  const p=profile??(r.log as StoredEntry[]).find(e=>e.profile)?.profile;
  const date=(p?.termStart??'2027-01-01').replace(/-/g,'');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sublet Bouncer//Viewing draft//EN','BEGIN:VEVENT',`UID:${r.runId}@sublet-bouncer`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${date}`,`DTEND;VALUE=DATE:${new Date(Date.parse(p?.termStart??'2027-01-01')+86400000).toISOString().slice(0,10).replace(/-/g,'')}`,'SUMMARY:Proposed sublet viewing - confirm date with landlord','DESCRIPTION:Draft only. No landlord has been contacted.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
  const specs:[ActionRecord['type'],ActionRecord['tier'],unknown,boolean][]=[['draft_reply','auto',reply,!r.refused],['save_evidence_card','auto',{verdict:r.verdict,clauses:r.clauses,runId:r.runId},true],['export_viewing_ics','confirm',ics,canICS],['copy_reply_to_clipboard','confirm',reply,!r.refused]];
  r.actions=specs.map(([type,tier,payload,allowed])=>{
    const old=previous.find(a=>a.type===type); const same=old&&JSON.stringify(old.payload)===JSON.stringify(payload);
    const a:ActionRecord={id:old?.id??newId(),type,tier,payload,status:allowed?(same?old.status:tier==='auto'?'done':'proposed'):'blocked',...(!allowed?{blockedReason:r.refused?'Input cannot be analyzed':'Requires feasible commute, scam risk below 0.30, and no open questions'}:{})};
    if(tier==='auto'&&a.status==='done'&&(!same||old?.status!=='done')) {const e=appendLog(r,'action',a.id,`Created ${type}`);e.output=structuredClone(a.payload);e.inverse={...structuredClone(a),status:'undone'};if(profile)e.profile=profile;}
    return a;
  });
  const d=r.decisions.find(d=>d.id==='D7');if(d)d.output=r.actions.map(a=>({type:a.type,tier:a.tier,status:a.status}));
}
export function perform(result:AnalysisResult,actionId:string):AnalysisResult {
  if(['send_message','pay','sign','contact_landlord'].includes(actionId)) throw new ForbiddenActionError(actionId);
  const r=structuredClone(result);const action=r.actions.find(a=>a.id===actionId||a.type===actionId);
  if(!action)throw new Error('Unknown action');
  if(action.type==='export_viewing_ics'&&(!['feasible','tight'].includes(r.commute.status)||r.scam.p>=.3||r.escalations.length)) throw new Error('Viewing export is blocked');
  if(action.status==='blocked')throw new Error(action.blockedReason??'Action blocked');
  if(action.status==='done') return r;
  const inverse=structuredClone(action);action.status='done';const e=appendLog(r,'action',action.id,`Human confirmed ${action.type}`,'human');e.inverse=inverse;e.output=structuredClone(action.payload);return r;
}
export function undo(result:AnalysisResult,logEntryId:string):AnalysisResult {
  const r=structuredClone(result);const entry=(r.log as StoredEntry[]).find(e=>e.id===logEntryId);
  if(!entry||entry.kind!=='action'||!entry.inverse)throw new Error('Entry has no reversible action');
  if(r.log.some(e=>e.kind==='undo'&&e.ref===entry.id))return r;
  const a=r.actions.find(a=>a.id===entry.ref);if(a){Object.assign(a,entry.inverse);a.status='undone';}
  appendLog(r,'undo',entry.id,`Undid ${entry.summary}`,'human');return r;
}
export function resolveEscalation(result:AnalysisResult,escId:string,answer:string):AnalysisResult {
  const esc=result.escalations.find(e=>e.id===escId);if(!esc)throw new Error('Unknown escalation');
  if(!answer.trim())throw new Error('Answer required');
  let r=structuredClone(result);
  if(/unable|unsure/i.test(answer)){appendLog(r,'correction',esc.id,`Still unresolved: ${answer}`,'human');return r;}
  if(esc.decisionId==='D5')return markWrong(r,'D5',/does not|not share/i.test(answer)?'applies':/shares?/i.test(answer)?'may_not_apply':'unknown').result;
  // An address needs a verified route, and uncertain fields require typed corrections.
  if(esc.decisionId==='D4'||esc.decisionId==='D1'&&/confirm (?:the monthly rent|address|rent)/i.test(esc.question))throw new Error('Use a typed correction on this decision to supply missing values');
  r.escalations=r.escalations.filter(e=>e.id!==escId);appendLog(r,'correction',esc.id,answer,'human');recomputeVerdict(r);refreshActions(r);return r;
}
export function markWrong(result:AnalysisResult,decisionId:Decision['id'],correction:unknown):{result:AnalysisResult;fixture:RegressionFixture} {
  if(!result.decisions.some(d=>d.id===decisionId))throw new Error('Unknown decision');
  let r=structuredClone(result);
  // Every generated action depends on the aggregate verdict and gate; rollback in reverse order.
  for(const e of [...r.log].reverse())if(e.kind==='action'&&!r.log.some(u=>u.kind==='undo'&&u.ref===e.id))r=undo(r,e.id);
  const d=r.decisions.find(d=>d.id===decisionId)!;d.output=correction;d.escalated=false;d.reason='Human correction pinned';d.confidence=1;
  const profile=(r.log as StoredEntry[]).find(e=>e.profile)?.profile;
  const proposals=r.clauses.filter(c=>c.confidence===.7&&c.ruleId).map(c=>({span:c.span,confidence:.7,proposed_rule_id:c.ruleId!}));
  if(decisionId==='D1'){
    if(!correction||typeof correction!=='object'||Array.isArray(correction))throw new Error('D1 correction must be a fields object');
    r.fields=structuredClone(correction) as AnalysisResult['fields'];
    if(Object.values(r.fields).some(f=>!f||typeof f!=='object'||!('value'in f)||typeof f.confidence!=='number'))throw new Error('Invalid corrected fields');
    r.rtaApplies=r.fields.owner_lives_in?.value===true?'may_not_apply':r.fields.owner_lives_in?.value===false?'applies':'unknown';
    r.scam=scoreScam(r.listing,r.fields,data);if(profile)r.commute=lookupCommute(r.fields,profile,data);
    r.clauses=clauseFindings(r.listing,data,r.rtaApplies,proposals);
  } else if(decisionId==='D2') {if(!Array.isArray(correction))throw new Error('D2 correction must be clause findings');r.clauses=structuredClone(correction);}
  else if(decisionId==='D3') {const p=typeof correction==='number'?correction:(correction as {p:number})?.p;if(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)throw new Error('Invalid scam probability');r.scam={...r.scam,p,band:p>.7?'block':p>=.3?'escalate':'proceed'};}
  else if(decisionId==='D4'){if(!correction||typeof correction!=='object'||!['feasible','tight','infeasible','unknown'].includes((correction as {status:string}).status))throw new Error('Invalid commute correction');r.commute=structuredClone(correction) as AnalysisResult['commute'];}
  else if(decisionId==='D5'){if(!['applies','may_not_apply','unknown'].includes(String(correction)))throw new Error('Invalid applicability correction');r.rtaApplies=correction as AnalysisResult['rtaApplies'];r.clauses=clauseFindings(r.listing,data,r.rtaApplies,proposals);}
  else if(decisionId==='D6'&&!['ADMIT','HOLD','REFUSE'].includes(String(correction)))throw new Error('Invalid verdict correction');
  else if(decisionId==='D7')throw new Error('Permission policy cannot be overridden');
  r.escalations=r.escalations.filter(e=>e.decisionId!==decisionId);
  if(decisionId==='D1')r.escalations=r.escalations.filter(e=>!['D3','D4','D5'].includes(e.decisionId));
  const pending=(id:Decision['id'],question:string)=>{if(!r.escalations.some(e=>e.decisionId===id))r.escalations.push({id:newId(),decisionId:id,question,options:['Confirm','Unable to confirm'],evidence:[]});};
  if(r.scam.band==='escalate')pending('D3','Verify listing identity before proceeding');
  if(r.commute.status==='unknown')pending('D4','Confirm a geocodable address and commute');
  if(r.rtaApplies==='unknown')pending('D5','Does the owner share a kitchen or bathroom?');
  appendLog(r,'correction',decisionId,`Pinned correction to ${decisionId}`,'human').output=structuredClone(correction);
  recomputeVerdict(r);
  if(decisionId==='D6'&&r.verdict!=='REFUSE'){
    r.verdict=correction as AnalysisResult['verdict'];r.reasons=['Human verdict correction pinned'];
    const verdictDecision=r.decisions.find(d=>d.id==='D6')!;verdictDecision.output={verdict:r.verdict,reasons:r.reasons};
  }
  const outputs:Record<string,unknown>={D1:r.fields,D2:r.clauses,D3:r.scam,D4:r.commute,D5:r.rtaApplies};
  for(const decision of r.decisions){if(outputs[decision.id]!==undefined)decision.output=outputs[decision.id];decision.escalated=r.escalations.some(e=>e.decisionId===decision.id);if(Number(decision.id.slice(1))>Number(decisionId.slice(1))&&decision.id!=='D7')appendLog(r,'decision',decision.id,`Recomputed after ${decisionId} correction`);}
  refreshActions(r,profile);appendLog(r,'decision','D7','Recomputed permission gate');
  return {result:r,fixture:{listing:r.listing,decision_id:decisionId,expected:correction}};
}
