import type { AnalysisResult, AnalyzeRequest, ClauseFinding, Commute, Decision, Escalation } from './types.js';
import { data, type Data } from './data.js';
import { findSpan, offlineExtract, verifyExtraction, type Extraction, type LLMAdapter } from './extract.js';
import { extractFeatures, paymentBeforeViewing } from './features.js';
import { hasInjection, refusalReason } from './injection.js';
import { refreshActions, appendLog } from './log.js';
export const LLM_TIMEOUT_MS = 20000;
export interface AnalyzeOptions { llm?: LLMAdapter; data?: Data; timeoutMs?: number }
export const newId = () => globalThis.crypto.randomUUID();
export function validateRequest(raw: unknown): asserts raw is AnalyzeRequest {
  const r = raw as AnalyzeRequest;
  if (!r || typeof r.listing !== 'string' || r.listing.length > 50000 || !r.profile || !['UW','WLU'].includes(r.profile.campus) || !/^\d{2}:\d{2}$/.test(r.profile.classStart) || Number(r.profile.classStart.slice(0,2))>23 || Number(r.profile.classStart.slice(3))>59 || ![r.profile.termStart,r.profile.termEnd].every(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))) || r.profile.termEnd < r.profile.termStart || (r.mode !== undefined && !['live','offline'].includes(r.mode))) throw new Error('Invalid listing, profile, or mode');
}
export function clauseFindings(listing: string, db: Data, applicability: AnalysisResult['rtaApplies'], proposals: Extraction['clauses'] = []): ClauseFinding[] {
  const findings: ClauseFinding[] = [];
  for (const rule of db.rules.rules) {
    let found = false;
    for (const [patterns,confidence] of [[rule.patterns,1],[rule.fuzzy_patterns,.6]] as const) {
      if (found) break;
      for (const pattern of patterns) {
        const matches = [...listing.matchAll(new RegExp(pattern,'gi'))].filter(m => m[0].length);
        for (const m of matches) {
          const status = rule.status === 'info' ? 'ok' : rule.status as ClauseFinding['status'];
          findings.push({span:{text:m[0],start:m.index!,end:m.index!+m[0].length},ruleId:rule.id,status:status==='void' && applicability!=='applies'?'questionable':status,section:rule.section,lesson:rule.lesson_plain+(status==='void'&&applicability!=='applies'?' RTA applicability needs confirmation.':''),lessonSimple:rule.lesson_simple_english,sourceUrl:rule.source_url,confidence});
          found = true;
        }
        if (found) break;
      }
    }
  }
  for (const proposal of proposals) {
    const rule = db.rules.rules.find(rule=>rule.id===proposal.proposed_rule_id);
    const span = findSpan(listing,proposal.span.text);
    if (!rule || !span || findings.some(f=>f.ruleId===rule.id)) continue;
    findings.push({span,ruleId:rule.id,status:'questionable',section:rule.section,lesson:rule.lesson_plain,lessonSimple:rule.lesson_simple_english,sourceUrl:rule.source_url,confidence:.7});
  }
  return findings;
}
const minutes = (s:string) => Number(s.slice(0,2))*60+Number(s.slice(3,5));
export function lookupCommute(fields: AnalysisResult['fields'], profile: AnalyzeRequest['profile'], db: Data): Commute {
  if (typeof fields.address?.value !== 'string') return {status:'unknown',summary:'Full address needed'};
  const address = fields.address.value.toLowerCase();
  const geo = db.geocodes.entries.find(g => [g.key,...g.aliases].some(a=>address.includes(a.toLowerCase())));
  if (!geo || geo.confidence < .8) return {status:'unknown',summary:'Address is outside the verified geocode cache'};
  const distance=(lat:number,lon:number)=>Math.hypot((lat-geo.lat)*111320,(lon-geo.lon)*111320*Math.cos(geo.lat*Math.PI/180));
  const origin = [...db.commutes.origins].sort((a,b)=>distance(a.lat,a.lon)-distance(b.lat,b.lon))[0];
  if (!origin || distance(origin.lat,origin.lon)>600) return {status:'unknown',summary:'No verified route within 600 metres'};
  const trip = origin.to[profile.campus];
  if (!trip || !trip.arrive_by_0830 || !/^\d{2}:\d{2}$/.test(trip.arrive_by_0830)) return {status:'unknown',summary:'No verified arrival time for this origin'};
  const walking = Math.ceil(distance(origin.lat,origin.lon)/db.commutes.walk_m_per_min);
  const margin = minutes(profile.classStart)-minutes(trip.arrive_by_0830);
  return {status:margin>=10?'feasible':margin>=0?'tight':'infeasible',minutes:trip.minutes+walking,arriveBy:trip.arrive_by_0830,summary:trip.summary+(walking?`; allow ${walking} min walk to origin`:'')};
}
export function scoreScam(listing:string, fields:AnalysisResult['fields'], db:Data): AnalysisResult['scam'] {
  const features = extractFeatures(listing,fields,db.benchmarks.median_monthly.room ?? db.benchmarks.median_monthly.bachelor);
  const contributions = db.model.features.map((f,i)=>({name:f.name,weight:((features[f.name as keyof typeof features]??0)-f.mean)/(f.std||1)*db.model.weights[i]}));
  const z = db.model.intercept+contributions.reduce((s,f)=>s+f.weight,0); const p=1/(1+Math.exp(-z));
  return {p,band:p>.7?'block':p>=.3?'escalate':'proceed',topFeatures:contributions.sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight)).slice(0,3)};
}
export function recomputeVerdict(r: AnalysisResult) {
  r.reasons=[];
  if (r.refused) r.reasons.push(`Cannot analyze: ${r.refused.reason}`);
  if (r.scam.p>.7) r.reasons.push('Scam risk exceeds the block threshold');
  if (paymentBeforeViewing(r.listing) || r.fields.payment_before_viewing?.value===true) r.reasons.push('Payment requested before viewing');
  if (r.refused || r.scam.p>.7 || paymentBeforeViewing(r.listing) || r.fields.payment_before_viewing?.value===true) r.verdict='REFUSE';
  else {
    if (r.escalations.length) r.reasons.push('Open questions require confirmation');
    if (r.clauses.some(c=>c.status!=='ok')) r.reasons.push('Flagged lease clauses need attention');
    if (r.commute.status==='infeasible') r.reasons.push('Commute arrives after class');
    r.verdict=r.reasons.length?'HOLD':'ADMIT';
    if (!r.reasons.length) r.reasons.push('No flagged clauses or open questions');
  }
  const d=r.decisions.find(d=>d.id==='D6'); if(d){d.output={verdict:r.verdict,reasons:r.reasons};d.reason=r.reasons.join('; ');}
}
export async function analyze(req: AnalyzeRequest, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
  validateRequest(req); const db=options.data??data; const refused=refusalReason(req.listing);
  let extraction: Extraction=offlineExtract(req.listing); let issues:string[]=[];
  let mode:AnalysisResult['mode']='offline'; let fallbackReason:string|undefined;
  if (req.mode!=='offline' && !refused) {
    if (!options.llm) {mode='offline-fallback';fallbackReason='Live extraction unavailable';}
    else { let timer: ReturnType<typeof setTimeout>|undefined;
      try {
        const raw=await Promise.race([options.llm.extract(req.listing),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('LLM timeout')),options.timeoutMs??LLM_TIMEOUT_MS);})]);
        ({extraction,issues}=verifyExtraction(raw,req.listing)); mode='live'; fallbackReason=options.llm.fallbackReason;
      } catch(error) { mode='offline-fallback';fallbackReason=error instanceof Error?error.message:'LLM request failed'; }
      finally {clearTimeout(timer);}
    }
  }
  const r:AnalysisResult={runId:newId(),mode,...(fallbackReason?{fallbackReason}:{}),...(mode==='live'?{model:options.llm?.model??'gemini-3-flash-preview'}:{}),listing:req.listing,fields:refused?{}:extraction.fields,clauses:[],scam:{p:0,band:'proceed',topFeatures:[]},commute:{status:'unknown'},rtaApplies:'unknown',verdict:'HOLD',reasons:[],decisions:[],escalations:[],actions:[],log:[],couldNotCheck:['Ownership, identity, and listing authenticity','Transit service changes; weekday 08:30 schedule only','Legal advice and exceptions beyond the verified rules'],...(refused?{refused:{reason:refused}}:{})};
  const esc=(id:Decision['id'],question:string,evidence:Escalation['evidence']=[],opts=['Confirm','Unable to confirm'])=>r.escalations.push({id:newId(),decisionId:id,question,options:opts,evidence});
  const decision=(id:Decision['id'],label:string,output:unknown,confidence=1,threshold?:number)=>{const d:Decision={id,kind:id==='D1'&&mode==='live'?'llm':id==='D2'&&mode==='live'?'llm+rules':id==='D3'?'model':'rules',label,output,confidence,...(threshold!==undefined?{threshold}:{}),escalated:r.escalations.some(e=>e.decisionId===id),reason:r.escalations.filter(e=>e.decisionId===id).map(e=>e.question).join('; ')||'Policy check complete',evidence:id==='D1'?Object.values(r.fields).flatMap(f=>f.span?[f.span]:[]):id==='D2'?r.clauses.map(c=>c.span):[]};r.decisions.push(d);appendLog(r,'decision',id,label,'agent',confidence,threshold);};
  if(fallbackReason)appendLog(r,'decision','D1',fallbackReason+(r.model?' (answered by '+r.model+')':''));
  issues.forEach(issue=>{r.couldNotCheck.push(issue);esc('D1',issue);appendLog(r,'decision','D1',issue);});
  for(const [name,f] of Object.entries(r.fields)) if(f.confidence<.8) esc('D1',`Please confirm ${name}`,f.span?[f.span]:[]);
  if (hasInjection(req.listing)) esc('D1','Listing contains instruction-like content; review it as untrusted data');
  if(!r.fields.rent && !refused) esc('D1','Please confirm the monthly rent');
  decision('D1','Field extraction',r.fields,mode==='live'?.9:.85,.8);
  const owner=r.fields.owner_lives_in;
  r.rtaApplies=owner?.value===true?'may_not_apply':owner?.value===false?'applies':'unknown';
  if(r.rtaApplies==='unknown') esc('D5','Does the owner share a kitchen or bathroom?',[],['Owner shares kitchen/bath','Owner does not share','Unsure']);
  if(r.rtaApplies==='may_not_apply') r.couldNotCheck.push('Shared kitchen/bath with owner: RTA may not apply under s.5(i)');
  if(!refused) r.clauses=clauseFindings(req.listing,db,r.rtaApplies,extraction.clauses);
  for(const c of r.clauses) if(c.confidence<.75) esc('D2',c.confidence===.7?`The bouncer thinks this may concern ${db.rules.rules.find(rule=>rule.id===c.ruleId)?.title} (${c.section}). Confirm?`:`Confirm clause: ${c.span.text}`,[c.span]);
  decision('D2','Clause legality',r.clauses,r.clauses.length?Math.min(...r.clauses.map(c=>c.confidence)):1,.75);
  if(!refused) r.scam=scoreScam(req.listing,r.fields,db);
  if(r.scam.band==='escalate') esc('D3','Verify listing identity and arrange a viewing before proceeding');
  decision('D3','Scam risk',r.scam,1,.7);
  if(!refused) r.commute=lookupCommute(r.fields,req.profile,db);
  if(r.commute.status==='unknown') esc('D4','Confirm a geocodable address and commute',[],['Unable to confirm']);
  decision('D4','Commute feasibility',r.commute,r.commute.status==='unknown'?0:1,.8);
  decision('D5','RTA applicability',r.rtaApplies,owner?.confidence??0,.8);
  recomputeVerdict(r);decision('D6','Aggregate verdict',{verdict:r.verdict,reasons:r.reasons});
  refreshActions(r,req.profile);decision('D7','Action gate',r.actions.map(a=>({type:a.type,tier:a.tier,status:a.status})));
  return r;
}
