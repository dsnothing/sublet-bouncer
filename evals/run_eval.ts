import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { analyze } from '../core/engine';
import { offlineExtract, verifyExtraction, type Extraction, type LLMAdapter } from '../core/extract';
import { createGeminiAdapter } from '../api/gemini';
import type { AnalyzeRequest, AnalysisResult } from '../core/types';

interface Gold { id:string; group:string; listing:string; profile:AnalyzeRequest['profile']; fields:Record<string,unknown>; clauses:string[]; scam:number; verdict:string }
interface Row { id:string; result:AnalysisResult; extraction:Extraction; latency_ms:number; cached:boolean; recorded_network_ms?:number; error?:string }
const defaultProfile:AnalyzeRequest['profile']={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW',classStart:'08:30'};
const loadSplit=(dir:string):Gold[]=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>({profile:defaultProfile,...JSON.parse(readFileSync(`${dir}/${f}`,'utf8'))})):[];
const authored=loadSplit('evals/gold'),redteam=loadSplit('evals/redteam');
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
const delayMs=Number(process.env.EVAL_THROTTLE_MS??7000);
const normalize=(x:unknown)=>typeof x==='string'?x.toLowerCase().replace(/\s+/g,' ').trim():JSON.stringify(x);
const percentile=(a:number[],p:number)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(p*a.length)-1)]:null;
function auc(labels:number[],scores:number[]){let total=0,correct=0;labels.forEach((y,i)=>{if(y)labels.forEach((v,j)=>{if(!v){total++;correct+=scores[i]>scores[j]?1:scores[i]===scores[j]?.5:0;}});});return total?correct/total:null;}
function summarize(rows:Row[]){
 let tp=0,fp=0,fn=0,fieldCorrect=0,fieldTotal=0,verdictCorrect=0;
 const confusion=(threshold:number)=>{let tp=0,fp=0,tn=0,fn=0;for(const row of rows){const g=gold.find(g=>g.id===row.id)!;const positive=row.result.scam.p>=threshold;if(g.scam)positive?tp++:fn++;else positive?fp++:tn++;}return{threshold,tp,fp,tn,fn};};
 for(const row of rows){const g=gold.find(g=>g.id===row.id)!;const actual=new Set(row.result.clauses.map(c=>c.ruleId).filter(Boolean));const expected=new Set(g.clauses);for(const c of actual)expected.has(c!)?tp++:fp++;for(const c of expected)if(!actual.has(c))fn++;
 for(const [key,value] of Object.entries(g.fields)){fieldTotal++;if(normalize(row.extraction.fields?.[key]?.value)===normalize(value))fieldCorrect++;}if(row.result.verdict===g.verdict)verdictCorrect++;
 }
 const timings=rows.filter(r=>!r.cached).map(r=>r.latency_ms);const recorded=rows.flatMap(r=>r.recorded_network_ms===undefined?[]:[r.recorded_network_ms]);
 return{n:rows.length,timeout_rate:rows.length?rows.filter(r=>r.error&&/timeout|aborted/i.test(r.error)).length/rows.length:null,fallback_rate:rows.length?rows.filter(r=>r.result.mode==='offline-fallback').length/rows.length:null,live_successes:rows.filter(r=>r.result.mode==='live').length,fallbacks:rows.filter(r=>r.result.mode==='offline-fallback').length,clause:{tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null},field_accuracy:fieldTotal?fieldCorrect/fieldTotal:null,field_correct:fieldCorrect,field_total:fieldTotal,scam_auc:auc(rows.map(r=>gold.find(g=>g.id===r.id)!.scam),rows.map(r=>r.result.scam.p)),confusion:[confusion(.3),confusion(.7)],verdict_accuracy:rows.length?verdictCorrect/rows.length:null,latency_ms:{p50:percentile(timings,.5),p95:percentile(timings,.95),uncached_n:timings.length,recorded_network_p50:percentile(recorded,.5),recorded_network_p95:percentile(recorded,.95),recorded_network_n:recorded.length},errors:rows.filter(r=>r.error).map(r=>({id:r.id,error:r.error}))};
}
function withSplits(rows:Row[]){return {...summarize(rows),splits:{gold:summarize(rows.filter(r=>authored.some(g=>g.id===r.id))),redteam:summarize(rows.filter(r=>redteam.some(g=>g.id===r.id)))},live_only:summarize(rows.filter(r=>r.result.mode==='live'))};}
const output:any={generated_at:new Date().toISOString(),synthetic:true,gold_size:authored.length,redteam_size:redteam.length,training_size:200,models:{'flash-lite':'gemini-3.1-flash-lite',flash:'gemini-3-flash-preview'},adapter_sha256:adapterHash,notes:['Gold is synthetic, separate from training templates, but authored by the rule author (author-overlap bias). Redteam is independently authored and the headline split. Neither establishes real-world performance.','Clause scoring is rule-id set micro precision/recall including informational lessons. Field accuracy is exact normalized match on annotated field slots only; missing fields are wrong.','flash and flash+span-verify use paired identical raw responses: raw versus verifyExtraction field accuracy. Production analyze always enforces span verification for verdict/scam/clause metrics.','Cached latency is excluded. Live HTTP failures are reported separately; fallback results are never counted as model success.','Current GRT schedule is a proxy for Winter 2027; CMHC means and room proxy are documented in DATA-SOURCES.md.'],variants:{},repeat:{status:'not_run'},rubric_cases:[],rows:{}};
function save(){
 output.headline={split:'redteam',offline:output.variants.offline?.splits?.redteam??null};
 writeFileSync('evals/results.json',JSON.stringify(output,null,2)+'\n');
 let md='# Eval results\n\nGenerated '+output.generated_at+'. Synthetic held-out gold; no real-world accuracy claim.\n\n';
 for(const [name,v] of Object.entries(output.variants) as [string,any][]){
 md+=`## ${name}\n\n`;
 if(v.status){md+=`Status: ${v.status}. ${v.reason??''}\n\n`;continue;}
 for(const split of ['redteam','gold']){const s=v.splits[split];md+=`### ${split==='redteam'?'Independent redteam (headline)':'Gold (rule-author overlap)'}\n\nCases: ${s.n}; live successes: ${s.live_successes}; fallbacks: ${s.fallbacks}; timeout rate: ${s.timeout_rate??'n/a'}.\n\nClause precision/recall: ${s.clause.precision?.toFixed(3)??'n/a'} / ${s.clause.recall?.toFixed(3)??'n/a'}; field accuracy: ${s.field_accuracy?.toFixed(3)??'n/a'} (${s.field_correct}/${s.field_total}); scam AUC: ${s.scam_auc?.toFixed(3)??'n/a'}; verdict accuracy: ${s.verdict_accuracy?.toFixed(3)??'n/a'}.\n\nLatency p50/p95 ms (uncached): ${s.latency_ms.p50??'n/a'} / ${s.latency_ms.p95??'n/a'}.\n\nRecorded network p50/p95 ms: ${s.latency_ms.recorded_network_p50??'n/a'} / ${s.latency_ms.recorded_network_p95??'n/a'}.\n\nConfusion: \`${JSON.stringify(s.confusion)}\`.\n\n`;}
 md+=`Live-only pooled metrics: \`${JSON.stringify(v.live_only)}\`.\n\n`;
 }
 md+='## Repeat consistency\n\n```json\n'+JSON.stringify(output.repeat,null,2)+'\n```\n\n## Rubric cases\n\n```json\n'+JSON.stringify(output.rubric_cases,null,2)+'\n```\n\n## Method and limitations\n\n'+output.notes.map((s:string)=>'- '+s).join('\n')+'\n';writeFileSync('evals/RESULTS.md',md);
}
const offline:Row[]=[];
for(const g of gold){const started=performance.now();const result=await analyze({...g,mode:'offline'});offline.push({id:g.id,result,extraction:offlineExtract(g.listing),latency_ms:performance.now()-started,cached:false});}
output.variants.offline=withSplits(offline);output.rows.offline=offline;output.rubric_cases=[...['gold-01','gold-02','gold-40'].map(id=>{const row=offline.find(r=>r.id===id)!;return{id,kind:id==='gold-40'?'demanding':'ordinary',expected:gold.find(g=>g.id===id)!.verdict,actual:row.result.verdict,pass:row.result.verdict===gold.find(g=>g.id===id)!.verdict};})];save();
for(const [name,model] of [['flash-lite','gemini-3.1-flash-lite'],['flash','gemini-3-flash-preview']]){
 if(offlineOnly||!process.env.GEMINI_API_KEY){output.variants[name]={status:'not_run',reason:offlineOnly?'--offline requested':'GEMINI_API_KEY unavailable'};continue;}
 const adapter=createGeminiAdapter(process.env.GEMINI_API_KEY,model);const rows:Row[]=[],verified:Row[]=[];
 for(const g of gold){
  const key=createHash('sha256').update(JSON.stringify({model,listing:g.listing,adapterHash,schema_version:3})).digest('hex');const path=`evals/cache/${key}.json`;let raw:unknown,cached=existsSync(path),error:string|undefined,elapsed=0;
  if(cached){const stored=JSON.parse(readFileSync(path,'utf8'));raw=stored.raw;elapsed=stored.latency_ms;}else{
   const started=performance.now();try{raw=await adapter.extract(g.listing);}catch(e){error=e instanceof Error?e.message:'Live extraction failure';}elapsed=performance.now()-started;
   if(!error)writeFileSync(path,JSON.stringify({raw,latency_ms:elapsed,captured_at:new Date().toISOString()}));
   await new Promise(resolve=>setTimeout(resolve,delayMs));
  }
  const fixed:LLMAdapter={model,extract:async()=>{if(error)throw new Error(error);return raw;}};
  const result=await analyze({...g,mode:'live'},{llm:fixed});
  const extraction=raw&&typeof raw==='object'&&(raw as Extraction).fields?raw as Extraction:offlineExtract(g.listing);
  const row={id:g.id,result,extraction,latency_ms:elapsed,cached,recorded_network_ms:elapsed,error};rows.push(row);
  let checked=offlineExtract(g.listing);try{checked=verifyExtraction(raw,g.listing).extraction;}catch{}
  verified.push({...row,extraction:checked});
  console.log(`${name} ${g.id}: ${result.mode}${error?' ('+error+')':''}`);
  output.variants[name]=withSplits(rows);output.rows[name]=rows;
  if(name==='flash'){output.variants['flash+span-verify']=withSplits(verified);output.rows['flash+span-verify']=verified;}
  save();
  // Exhausted quota/authorization: do not hammer the remaining cases or claim live scores.
  if(error&&/HTTP (?:429|400|401|403|404)/.test(error)){output.variants[name].stopped_reason=error;break;}
 }
}
if(!offlineOnly&&process.env.GEMINI_API_KEY){
 const model='gemini-3-flash-preview';const adapter=createGeminiAdapter(process.env.GEMINI_API_KEY,model);const repeats:any[]=[];let stopped=false;
 for(const g of authored.slice(0,5)){
  const runs:any[]=[];
  for(let i=0;i<3;i++){
   const path=`evals/cache/repeat-v2-${g.id}-${i}.json`;let raw:unknown,error:string|undefined;const cached=existsSync(path);
   if(cached)raw=JSON.parse(readFileSync(path,'utf8'));else{try{raw=await adapter.extract(g.listing);writeFileSync(path,JSON.stringify(raw));}catch(e){error=e instanceof Error?e.message:'Live extraction failure';}await new Promise(r=>setTimeout(r,delayMs));}
   if(error){runs.push({error});stopped=true;break;}
   const result=await analyze({...g,mode:'live'},{llm:{model,extract:async()=>raw}});
   const signature=JSON.stringify({fields:Object.fromEntries(Object.entries(result.fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.value])),clauses:result.clauses.map(c=>c.ruleId).sort(),verdict:result.verdict});
   runs.push({signature,mode:result.mode,cached});
  }
  repeats.push({id:g.id,runs,consistent:runs.length===3&&runs.every(r=>r.mode==='live'&&r.signature===runs[0].signature)});if(stopped)break;
 }
 output.repeat={status:stopped?'partial':'complete',cases:repeats,consistent_cases:repeats.filter(r=>r.consistent).length,requested_cases:5,runs_per_case:3};
 output.rubric_cases.push({kind:'repeat',...output.repeat});
}
save();console.log(JSON.stringify({offline:output.variants.offline,live:Object.fromEntries(Object.entries(output.variants).filter(([k])=>k!=='offline')),repeat_status:output.repeat.status},null,2));
