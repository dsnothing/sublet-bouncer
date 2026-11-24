import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { analyze } from '../core/engine';
import { offlineExtract, verifyExtraction, type Extraction, type LLMAdapter } from '../core/extract';
import { createGeminiAdapter } from '../api/gemini';
import type { AnalyzeRequest, AnalysisResult } from '../core/types';

interface Gold { id:string; group:string; listing:string; profile:AnalyzeRequest['profile']; fields:Record<string,unknown>; clauses:string[]; scam:number; verdict:string }
interface Row { id:string; result:AnalysisResult; extraction:Extraction; latency_ms:number; cached:boolean; recorded_network_ms?:number; attempts?:{error?:string;latency_ms:number;retry_delay_ms?:number}[]; error?:string }
const defaultProfile:AnalyzeRequest['profile']={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW',classStart:'08:30'};
const loadSplit=(dir:string):Gold[]=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>({profile:defaultProfile,...JSON.parse(readFileSync(`${dir}/${f}`,'utf8'))})):[];
const finalV2=process.argv.includes('--redteam-v2');
if(finalV2)execFileSync('git',['merge-base','--is-ancestor','71db451','HEAD']); // Lead confirmed author commit is the done marker.
const authored=finalV2?[]:loadSplit('evals/gold'),redteam=loadSplit(finalV2?'evals/redteam-v2':'evals/redteam');
const gold=[...redteam,...authored];
if(new Set(gold.map(g=>g.id)).size!==gold.length)throw new Error('Fixture ids must be unique across splits');
for(const g of gold)if(!g.id||!g.listing||!g.fields||!Array.isArray(g.clauses)||![0,1].includes(g.scam)||!['ADMIT','HOLD','REFUSE'].includes(g.verdict))throw new Error('Invalid fixture: '+g.id);
const adapterHash=createHash('sha256').update(readFileSync('api/gemini.ts')).digest('hex');
// Native env-file parsing without printing any value, accepting the repo .env and parent .env.
if(!process.env.GEMINI_API_KEY)for(const p of ['.env','../.env'])if(existsSync(p)){
  const m=readFileSync(p,'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^\s"'#]+)/m);if(m){process.env.GEMINI_API_KEY=m[1];break;}
}
mkdirSync('evals/cache',{recursive:true});
const offlineOnly=process.argv.includes('--offline');
const delayMs=Math.max(5000,Number(process.env.EVAL_THROTTLE_MS??7000));
const resumeFlash=process.argv.includes('--resume-flash');
const repeatOnly=process.argv.includes('--repeat-only');
const originalFetch=globalThis.fetch;
let retryDelayMs:number|undefined;
globalThis.fetch=async(...args:Parameters<typeof fetch>)=>{
 const res=await originalFetch(...args);
 if(res.status===429){
  const header=Number(res.headers.get('retry-after'));if(header>0)retryDelayMs=header*1000;
  try{const body=await res.clone().json() as any;for(const detail of body.error?.details??[]){const value=parseFloat(detail.retryDelay);if(Number.isFinite(value))retryDelayMs=value*1000;}}catch{}
 }
 return res;
};
async function request(adapter:LLMAdapter,listing:string){
 const attempts:{error?:string;latency_ms:number;retry_delay_ms?:number}[]=[];let raw:unknown,error:string|undefined;
 for(let attempt=0;attempt<=3;attempt++){
  retryDelayMs=undefined;error=undefined;const started=performance.now();
  try{raw=await adapter.extract(listing);}catch(e){error=e instanceof Error?e.message:'Live extraction failure';}
  const entry={error,latency_ms:performance.now()-started,retry_delay_ms:retryDelayMs};attempts.push(entry);
  if(!error||!/HTTP 429/.test(error)||attempt===3)break;
  const backoff=Math.max(13000,retryDelayMs??[30000,60000,120000][attempt]);
  if(backoff>120000){console.log(`Quota deferred for ${Math.ceil(backoff/1000)}s`);break;}
  console.log(`429 retry ${attempt+1}/3 after ${Math.ceil(backoff/1000)}s`);
  await new Promise(r=>setTimeout(r,backoff));
 }
 await new Promise(r=>setTimeout(r,Math.max(adapter.model?.includes('3-flash')?13000:delayMs,delayMs)));
 return{raw,error,attempts,elapsed:attempts.reduce((s,a)=>s+a.latency_ms,0)};
}
const violationIds=new Set<string>(JSON.parse(readFileSync('data/rta_rules.json','utf8')).rules.filter((r:any)=>['void','questionable'].includes(r.status)).map((r:any)=>r.id));
const uncertainIds=['v2-06','v2-20','v2-21','v2-22','v2-26','v2-27','v2-14'];
const normalize=(x:unknown)=>typeof x==='string'?x.toLowerCase().replace(/\s+/g,' ').trim():JSON.stringify(x);
const percentile=(a:number[],p:number)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(p*a.length)-1)]:null;
function auc(labels:number[],scores:number[]){let total=0,correct=0;labels.forEach((y,i)=>{if(y)labels.forEach((v,j)=>{if(!v){total++;correct+=scores[i]>scores[j]?1:scores[i]===scores[j]?.5:0;}});});return total?correct/total:null;}
function summarize(rows:Row[]){
 let tp=0,fp=0,fn=0,topicTp=0,topicFp=0,topicFn=0,fieldCorrect=0,fieldTotal=0,verdictCorrect=0;
 const confusion=(threshold:number)=>{let tp=0,fp=0,tn=0,fn=0;for(const row of rows){const g=gold.find(g=>g.id===row.id)!;const positive=row.result.scam.p>=threshold;if(g.scam)positive?tp++:fn++;else positive?fp++:tn++;}return{threshold,tp,fp,tn,fn};};
 for(const row of rows){const g=gold.find(g=>g.id===row.id)!;const allActual=new Set(row.result.clauses.map(c=>c.ruleId).filter(Boolean));const allExpected=new Set(g.clauses);
 for(const c of allActual)allExpected.has(c!)?topicTp++:topicFp++;for(const c of allExpected)if(!allActual.has(c))topicFn++;
 const actual=new Set([...allActual].filter(c=>violationIds.has(c!)));const expected=new Set([...allExpected].filter(c=>violationIds.has(c)));
 for(const c of actual)expected.has(c!)?tp++:fp++;for(const c of expected)if(!actual.has(c))fn++;
 for(const [key,value] of Object.entries(g.fields)){fieldTotal++;if(normalize(row.extraction.fields?.[key]?.value)===normalize(value))fieldCorrect++;}if(row.result.verdict===g.verdict)verdictCorrect++;
 }
 const timings=rows.filter(r=>!r.cached).map(r=>r.latency_ms);const recorded=rows.flatMap(r=>r.recorded_network_ms===undefined?[]:[r.recorded_network_ms]);
 return{n:rows.length,timeout_rate:rows.length?rows.filter(r=>r.error&&/timeout|aborted/i.test(r.error)).length/rows.length:null,retries:rows.reduce((s,r)=>s+Math.max(0,(r.attempts?.length??1)-1),0),retry_429s:rows.reduce((s,r)=>s+(r.attempts??[]).filter(a=>a.error?.includes('HTTP 429')).length,0),fallback_rate:rows.length?rows.filter(r=>r.result.mode==='offline-fallback').length/rows.length:null,live_successes:rows.filter(r=>r.result.mode==='live').length,fallbacks:rows.filter(r=>r.result.mode==='offline-fallback').length,all_topics:{tp:topicTp,fp:topicFp,fn:topicFn,precision:topicTp+topicFp?topicTp/(topicTp+topicFp):null,recall:topicTp+topicFn?topicTp/(topicTp+topicFn):null},uncertain_items:rows.filter(r=>uncertainIds.includes(r.id)).map(r=>({id:r.id,expected:{verdict:gold.find(g=>g.id===r.id)!.verdict,clauses:gold.find(g=>g.id===r.id)!.clauses,scam:gold.find(g=>g.id===r.id)!.scam},actual:{verdict:r.result.verdict,clauses:[...new Set(r.result.clauses.map(c=>c.ruleId))],scam_p:r.result.scam.p,fields:r.extraction.fields,mode:r.result.mode},error:r.error})),clause:{tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null},field_accuracy:fieldTotal?fieldCorrect/fieldTotal:null,field_correct:fieldCorrect,field_total:fieldTotal,scam_auc:auc(rows.map(r=>gold.find(g=>g.id===r.id)!.scam),rows.map(r=>r.result.scam.p)),confusion:[confusion(.3),confusion(.7)],verdict_accuracy:rows.length?verdictCorrect/rows.length:null,latency_ms:{p50:percentile(timings,.5),p95:percentile(timings,.95),uncached_n:timings.length,recorded_network_p50:percentile(recorded,.5),recorded_network_p95:percentile(recorded,.95),recorded_network_n:recorded.length},errors:rows.filter(r=>r.error).map(r=>({id:r.id,error:r.error}))};
}
function withSplits(rows:Row[]){return {...summarize(rows),splits:{gold:summarize(rows.filter(r=>authored.some(g=>g.id===r.id))),redteam:summarize(rows.filter(r=>redteam.some(g=>g.id===r.id)))},live_only:summarize(rows.filter(r=>r.result.mode==='live'))};}
const output:any={generated_at:new Date().toISOString(),synthetic:true,gold_size:authored.length,redteam_size:redteam.length,training_size:200,split:finalV2?'redteam-v2':'redteam-v1+gold',models:{'flash-lite':'gemini-3.1-flash-lite',flash:'gemini-3-flash-preview'},adapter_sha256:adapterHash,frozen_source:finalV2?execFileSync('git',['log','-1','--format=%H','--grep=^C2c:'],{encoding:'utf8'}).trim():null,source_head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_hashes:Object.fromEntries(['core/engine.ts','core/extract.ts','core/features.ts','data/rta_rules.json','data/scam_model.json'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),notes:['Gold is synthetic, separate from training templates, but authored by the rule author (author-overlap bias). Redteam is independently authored and the headline split. Neither establishes real-world performance.','Headline clause scoring is rule-id set micro precision/recall restricted to rule-table void/questionable ids. All-topics P/R is secondary. Uncertain v2 labels are reported per item, unchanged. Field accuracy is exact normalized match on annotated field slots only; missing fields are wrong.','flash and flash+span-verify use paired identical raw responses: raw versus verifyExtraction field accuracy. Production analyze always enforces span verification for verdict/scam/clause metrics.','Cached latency is excluded. Live HTTP failures are reported separately; fallback results are never counted as model success.','Current GRT schedule is a proxy for Winter 2027; CMHC means and room proxy are documented in DATA-SOURCES.md.'],variants:{},repeat:{status:'not_run'},rubric_cases:[],rows:{}};
const baseline=process.argv.includes('--baseline-v1');
const reportPath=baseline?'evals/RESULTS-v1-baseline.md':'evals/RESULTS.md';
function save(){
 if(finalV2){
  const disclosure='Redteam-v1 is a dev set (contaminated by lead examples): the C2b card quoted "pls no furry friends" and "$400 held against breakages", and fuzzy patterns incorporated those phrases. No v1-after-C2b result is evidence of generalization. Redteam-v2 is the clean headline.';
  if(!output.notes.includes(disclosure))output.notes.push(disclosure);
  const phrase=/no\s+furry\s+friends|held\s+against\s+breakages?/i;
  output.phrase_sensitivity={phrases:['no furry friends','held against breakages'],v2_listings_with_phrase:redteam.filter(g=>phrase.test(g.listing)).map(g=>g.id),variants:Object.fromEntries(Object.entries(output.rows).map(([name,rows]:any)=>[name,{matched_clause_listing_ids:rows.filter((r:Row)=>r.result.clauses.some(c=>phrase.test(c.span.text))).map((r:Row)=>r.id)}])),exclusive_dependency_count:redteam.some(g=>phrase.test(g.listing))?null:0,method:'Normalized literal phrase presence and verified matched-clause spans; no v2 listing contains either phrase, so exclusive dependency count is zero.'};
 }
 output.headline={split:finalV2?'redteam-v2':'redteam-v1',offline:output.variants.offline?.splits?.redteam??null,primary:output.variants['flash-lite+span-verify']?.splits?.redteam??output.variants['flash-lite']?.splits?.redteam??null};
 writeFileSync(baseline?'evals/results-v1-baseline.json':'evals/results.json',JSON.stringify(output,null,2)+'\n');
 let md=(baseline?'# v1 baseline eval results\n\nFrozen before redesign. rt-01..24 will become development data; a future blind v2 split is required for final claims.\n\n':'# Eval results\n\n')+'Generated '+output.generated_at+'. Synthetic held-out gold; no real-world accuracy claim.\n\n';
 if(finalV2)md+=`Frozen source: \`${output.frozen_source}\`. Primary: gemini-3.1-flash-lite. All 30 headline cases retain failed requests as offline fallbacks.\n\n`;
 for(const [name,v] of Object.entries(output.variants) as [string,any][]){
 md+=`## ${name}\n\n`;
 if(v.stopped_reason||(name==='flash+span-verify'&&output.variants.flash?.stopped_reason))md+=`**Unavailable model comparison:** ${v.stopped_reason??output.variants.flash.stopped_reason}. Only fallback evidence exists; remaining cases were not attempted.\n\n`;
 if(v.status){md+=`Status: ${v.status}. ${v.reason??''}\n\n`;continue;}
 for(const split of (finalV2?['redteam']:['redteam','gold'])){const s=v.splits[split];md+=`### ${split==='redteam'?'Independent redteam (headline)':'Gold (rule-author overlap)'}\n\nCases: ${s.n}; live successes: ${s.live_successes}; fallbacks: ${s.fallbacks}; retries: ${s.retries??0}; timeout rate: ${s.timeout_rate??'n/a'}.\n\nViolation clause precision/recall: ${s.clause.precision?.toFixed(3)??'n/a'} / ${s.clause.recall?.toFixed(3)??'n/a'}; all-topics P/R: ${s.all_topics?.precision?.toFixed(3)??'n/a'} / ${s.all_topics?.recall?.toFixed(3)??'n/a'}; field accuracy: ${s.field_accuracy?.toFixed(3)??'n/a'} (${s.field_correct}/${s.field_total}); scam AUC: ${s.scam_auc?.toFixed(3)??'n/a'}; verdict accuracy: ${s.verdict_accuracy?.toFixed(3)??'n/a'}.\n\nLatency p50/p95 ms (uncached): ${s.latency_ms.p50??'n/a'} / ${s.latency_ms.p95??'n/a'}.\n\nRecorded network p50/p95 ms: ${s.latency_ms.recorded_network_p50??'n/a'} / ${s.latency_ms.recorded_network_p95??'n/a'}.\n\nConfusion: \`${JSON.stringify(s.confusion)}\`.\n\n`;}
 md+=`Live-only pooled metrics: \`${JSON.stringify({n:v.live_only.n,clause:v.live_only.clause,all_topics:v.live_only.all_topics,field_accuracy:v.live_only.field_accuracy,scam_auc:v.live_only.scam_auc,verdict_accuracy:v.live_only.verdict_accuracy})}\`.\n\n`;
 }
 if(finalV2)md+='## Lead-example phrase sensitivity\n\n```json\n'+JSON.stringify(output.phrase_sensitivity,null,2)+'\n```\n\n';
 if(finalV2){md+='## Disputed-label cases (labels unchanged)\n\n| Case | Expected | Offline | Lite | Expected topics | Lite topics | Scam p |\n|---|---|---|---|---|---|---|\n';for(const id of uncertainIds){const g=gold.find(g=>g.id===id)!;const off=output.rows.offline?.find((r:Row)=>r.id===id);const live=output.rows['flash-lite+span-verify']?.find((r:Row)=>r.id===id);md+=`| ${id} | ${g.verdict} | ${off?.result.verdict??'n/a'} | ${live?.result.verdict??'n/a'} | ${g.clauses.join(', ')} | ${[...new Set(live?.result.clauses.map((c:any)=>c.ruleId)??[])].join(', ')} | ${live?.result.scam.p.toFixed(3)??'n/a'} |\n`;}md+='\nFull per-item fields and spans are retained in results.json.\n\n';}
 md+='## Repeat consistency\n\n```json\n'+JSON.stringify(output.repeat,null,2)+'\n```\n\n## Rubric cases\n\n```json\n'+JSON.stringify(output.rubric_cases,null,2)+'\n```\n\n## Method and limitations\n\n'+output.notes.map((s:string)=>'- '+s).join('\n')+'\n';writeFileSync(reportPath,md);
}
if(process.argv.includes('--render-only')){Object.assign(output,JSON.parse(readFileSync('evals/results.json','utf8')));if(!finalV2)output.notes.push('Flash comparison and repeat consistency are unavailable in the frozen v1 run: HTTP 429. Flash Lite completed all 64 cases: 44 live analyses, 18 fallbacks (14 timeouts, 4 HTTP 503), and 2 deterministic language refusals.');save();process.exit(0);}
if(resumeFlash||repeatOnly){const previous=JSON.parse(readFileSync('evals/results.json','utf8'));if(repeatOnly&&(previous.adapter_sha256!==adapterHash||Object.entries(previous.source_hashes).some(([p,h])=>createHash('sha256').update(readFileSync(p)).digest('hex')!==h)))throw new Error('Frozen source changed; cannot mix repeat trials');Object.assign(output,previous);}
const offline:Row[]=[];
if(!resumeFlash&&!repeatOnly){
for(const g of gold){const started=performance.now();const result=await analyze({...g,mode:'offline'});offline.push({id:g.id,result,extraction:offlineExtract(g.listing),latency_ms:performance.now()-started,cached:false});}
output.variants.offline=withSplits(offline);output.rows.offline=offline;output.rubric_cases=[...(finalV2?gold.filter((_,i)=>[0,1,29].includes(i)).map(g=>g.id):['gold-01','gold-02','gold-40']).map(id=>{const row=offline.find(r=>r.id===id)!;return{id,kind:(id==='gold-40'||id==='v2-30')?'demanding':'ordinary',expected:gold.find(g=>g.id===id)!.verdict,actual:row.result.verdict,pass:row.result.verdict===gold.find(g=>g.id===id)!.verdict};})];save();
}
for(const [name,model] of [['flash-lite','gemini-3.1-flash-lite'],['flash','gemini-3-flash-preview']]){
 if(repeatOnly)continue;
 if(resumeFlash&&name==='flash-lite')continue;
 if(finalV2&&name==='flash'){output.variants.flash={status:'deferred',reason:'daily free-tier quota; advertised retryDelay 78912s on v1 resume; no Flash calls made'};output.variants['flash+span-verify']={status:'deferred',reason:'no completed Flash ablation'};continue;}
 if(offlineOnly||!process.env.GEMINI_API_KEY){output.variants[name]={status:'not_run',reason:offlineOnly?'--offline requested':'GEMINI_API_KEY unavailable'};continue;}
 const adapter=createGeminiAdapter(process.env.GEMINI_API_KEY,model,model);const rows:Row[]=[],verified:Row[]=[];
 for(const g of gold){
  const key=createHash('sha256').update(JSON.stringify({model,listing:g.listing,adapterHash,schema_version:3})).digest('hex');const path=`evals/cache/${key}.json`;let raw:unknown,cached=existsSync(path),error:string|undefined,elapsed=0,attempts:Row['attempts']=[];
  if(cached){const stored=JSON.parse(readFileSync(path,'utf8'));raw=stored.raw;elapsed=stored.latency_ms;attempts=stored.attempts??[];}else{
   const response=await request(adapter,g.listing);raw=response.raw;error=response.error;elapsed=response.elapsed;attempts=response.attempts;
   if(!error)writeFileSync(path,JSON.stringify({raw,latency_ms:elapsed,attempts,captured_at:new Date().toISOString()}));
  }
  const fixed:LLMAdapter={model,extract:async()=>{if(error)throw new Error(error);return raw;}};
  const result=await analyze({...g,mode:'live'},{llm:fixed});
  const extraction=raw&&typeof raw==='object'&&(raw as Extraction).fields?raw as Extraction:offlineExtract(g.listing);
  const row={id:g.id,result,extraction,latency_ms:elapsed,cached,recorded_network_ms:elapsed,attempts,error};rows.push(row);
  let checked=offlineExtract(g.listing);try{checked=verifyExtraction(raw,g.listing).extraction;}catch{}
  verified.push({...row,extraction:checked});
  console.log(`${name} ${g.id}: ${result.mode}${error?' ('+error+')':''}`);
  output.variants[name]=withSplits(rows);output.rows[name]=rows;
  if(name==='flash'||finalV2){const verifiedName=name+'+span-verify';output.variants[verifiedName]=withSplits(verified);output.rows[verifiedName]=verified;}
  save();
  // Exhausted quota/authorization: do not hammer the remaining cases or claim live scores.
  if(error&&/HTTP (?:429|400|401|403|404)/.test(error)){output.variants[name].stopped_reason=error;break;}
 }
}
if(!offlineOnly&&process.env.GEMINI_API_KEY&&!output.variants['flash-lite']?.stopped_reason){
 const model=finalV2?'gemini-3.1-flash-lite':'gemini-3-flash-preview';const adapter=createGeminiAdapter(process.env.GEMINI_API_KEY,model,model);const repeats:any[]=[];let stopped=false;
 for(const g of (finalV2?gold:authored).slice(0,5)){
  const runs:any[]=[];
  for(let i=0;i<3;i++){
   const prior=output.repeat?.cases?.find((c:any)=>c.id===g.id)?.runs?.[i];if(prior){runs.push({...prior,preserved:true});continue;}
   const path=`evals/cache/repeat-${adapterHash.slice(0,12)}-${model}-${g.id}-${i}.json`;let raw:unknown,error:string|undefined;const cached=existsSync(path);
   if(cached)raw=JSON.parse(readFileSync(path,'utf8'));else{const response=await request(adapter,g.listing);raw=response.raw;error=response.error;if(!error)writeFileSync(path,JSON.stringify(raw));}
   if(error){runs.push({error});if(/HTTP (429|400|401|403|404)/.test(error)){stopped=true;break;}continue;}
   const result=await analyze({...g,mode:'live'},{llm:{model,extract:async()=>raw}});
   const signature=JSON.stringify({fields:Object.fromEntries(Object.entries(result.fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.value])),clauses:result.clauses.map(c=>c.ruleId).sort(),verdict:result.verdict});
   runs.push({signature,mode:result.mode,cached});
  }
  repeats.push({id:g.id,runs,consistent:runs.length===3&&runs.every(r=>r.mode==='live'&&r.signature===runs[0].signature)});if(stopped)break;
 }
 output.repeat={status:stopped?'partial':'complete',runs_recorded:repeats.reduce((s,r)=>s+r.runs.length,0),failed_runs:repeats.reduce((s,r)=>s+r.runs.filter((x:any)=>x.error).length,0),cases:repeats,consistent_cases:repeats.filter(r=>r.consistent).length,requested_cases:5,runs_per_case:3};
 output.rubric_cases=output.rubric_cases.filter((c:any)=>c.kind!=='repeat');output.rubric_cases.push({kind:'repeat',...output.repeat});
}
save();console.log(JSON.stringify({split:output.split,coverage:Object.fromEntries(Object.entries(output.variants).map(([k,v]:any)=>[k,{n:v.n,live:v.live_successes,fallbacks:v.fallbacks,status:v.status,stopped_reason:v.stopped_reason}])),repeat_status:output.repeat.status},null,2));
