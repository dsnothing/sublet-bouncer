// Paired development-only replay; never requests a provider or loads a blind split.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { analyze } from '../core/engine.js';
import { data } from '../core/data.js';
const profile={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW' as const,classStart:'08:30'};
const phase=process.argv[2];
if(!['before','after'].includes(phase))throw new Error('Expected before or after');
const norm=(v:unknown)=>typeof v==='string'?v.toLowerCase().replace(/\s+/g,' ').trim():JSON.stringify(v);
const violations=new Set(data.rules.rules.filter(r=>['void','questionable'].includes(r.status)).map(r=>r.id));
const output:any={phase,method:'Offline and paired saved raw extraction replay, no new provider calls; development data only',splits:{}};
for(const [split,dir,saved] of [['gold','gold','results-v1-baseline.json'],['v1','redteam','results-v1-baseline.json'],['v2','redteam-v2','results-v2-final.json']]){
  const fixtures=readdirSync(`evals/${dir}`).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(readFileSync(`evals/${dir}/${f}`,'utf8')));
  const prior=JSON.parse(readFileSync(`evals/${saved}`,'utf8'));
  output.splits[split]={};
  for(const mode of ['offline','replay'] as const){
    let correct=0,total=0,verdict=0,tp=0,fp=0,fn=0,rawN=0;
    for(const g of fixtures){
      const row=prior.rows['flash-lite']?.find((r:any)=>r.id===g.id);
      const raw=row?.result.mode==='live'?row.extraction:undefined;
      if(raw)rawN++;
      const result=await analyze({listing:g.listing,profile:g.profile??profile,mode:mode==='offline'?'offline':'live'},mode==='replay'?{llm:{extract:async()=>{if(!raw)throw new Error('Saved live response unavailable');return raw;}}}:{});
      for(const [name,value] of Object.entries(g.fields)){total++;if(norm(result.fields[name]?.value)===norm(value))correct++;}
      verdict+=Number(result.verdict===g.verdict);
      const expected=new Set<string>(g.clauses.filter((id:string)=>violations.has(id)));
      const actual=new Set(result.clauses.map(c=>c.ruleId).filter((id):id is string=>!!id&&violations.has(id)));
      for(const id of actual)if(expected.has(id))tp++;else fp++;
      for(const id of expected)if(!actual.has(id))fn++;
    }
    output.splits[split][mode]={n:fixtures.length,rawN,field_correct:correct,field_total:total,verdict_correct:verdict,tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null};
  }
}
writeFileSync(`evals/escalation-dev-${phase}.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));

