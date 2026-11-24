import { readFileSync, writeFileSync } from 'node:fs';
import { computeFeatures, FEATURE_NAMES } from '../core/features';
const benchmarks = JSON.parse(readFileSync('data/cmhc_benchmarks.json','utf8'));
const rows = readFileSync('data/training/synthetic.jsonl','utf8').trim().split('\n').map(x=>JSON.parse(x));
const x = rows.map(r=>{const f=computeFeatures(r.listing,undefined,benchmarks);return FEATURE_NAMES.map(n=>f[n]);});
const mean=FEATURE_NAMES.map((_,j)=>x.reduce((s,r)=>s+r[j],0)/x.length);
const std=mean.map((m,j)=>Math.sqrt(x.reduce((s,r)=>s+(r[j]-m)**2,0)/x.length)||1);
const z=x.map(r=>r.map((v,j)=>(v-mean[j])/std[j]));
let intercept=0; const weights=mean.map(()=>0);const sigmoid=(v:number)=>1/(1+Math.exp(-v));
for(let epoch=0;epoch<2500;epoch++){
  const grad=mean.map(()=>0);let bi=0;
  z.forEach((r,i)=>{const error=sigmoid(intercept+r.reduce((s,v,j)=>s+v*weights[j],0))-rows[i].scam;bi+=error;r.forEach((v,j)=>grad[j]+=error*v);});
  intercept-=.05*bi/z.length;weights.forEach((w,j)=>weights[j]-=.05*(grad[j]/z.length+.02*w));
}
writeFileSync('data/scam_model.json',JSON.stringify({version:'1.0.0',trained_on:'2026-11-24',synthetic:true,source:'scripts/gen_training.ts; seed 33817; feature design informed by https://antifraudcentre-centreantifraude.ca/scams-fraudes/rental-location-eng.htm',features:FEATURE_NAMES.map((name,j)=>({name,description:name.replaceAll('_',' '),mean:mean[j],std:std[j]})),weights,intercept,thresholds:{proceed:.30,block:.70},metrics:{training_rows:rows.length,calibration_note:'Uncalibrated logistic regression on 200 synthetic examples, L2=0.02. Scores are heuristic, not real-world scam probabilities. AUC must be measured on the held-out synthetic gold set; no training AUC claimed.'}},null,2)+'\n');
console.log('Trained 12-feature logistic model using shared core.computeFeatures; no gold examples used.');
