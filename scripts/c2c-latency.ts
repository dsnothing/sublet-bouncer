import { loadEnvFile } from 'node:process';
import { writeFileSync } from 'node:fs';
import { analyze } from '../core/engine.js';
import { createGeminiAdapter } from '../api/gemini.js';
loadEnvFile('.env');
const listings = [
'Room at 200 University Avenue West. Rent $850 per month. January 1 to April 30 2027. Utilities included. Viewing available. Landlord does not live here. Email to arrange a viewing.',
'Sublet at 75 Columbia Street West for $900 per month, May to August 2027. Hydro included. No pets allowed. A $400 damage deposit is required. Viewing welcome. Owner does not live here.',
'Room at 330 Phillip Street, $1000 per month. September to December 2027. Internet included. Landlord is abroad. Send an e-transfer deposit before any viewing. Contact WhatsApp only.',
'Furnished room at 300 King Street North, $800 monthly. January to April 2027. Share the kitchen with the owner. Refundable key deposit $30. Viewing available. Email us.',
'Summer sublet at 110 University Avenue West. Rent $950 per month. May to August 2027. Water included. A $300 sum is held against breakages. Cats are not welcome. Arrange a viewing by email.'
];
const results=[];
for(let i=0;i<10;i++){
 const start=performance.now();
 const result=await analyze({listing:listings[i%5],profile:{campus:'UW',classStart:'08:30',termStart:'2027-01-01',termEnd:'2027-04-30'},mode:'live'},{llm:createGeminiAdapter(undefined,'gemini-3.1-flash-lite','gemini-3-flash-preview')});
 const row={i,ms:Math.round(performance.now()-start),mode:result.mode,model:result.model,reason:result.fallbackReason,fields:Object.keys(result.fields).length,clauses:result.clauses.length};
 results.push(row); console.log(JSON.stringify(row));
 if(i<9)await new Promise(r=>setTimeout(r,5000));
}
const times=results.map(x=>x.ms).sort((a,b)=>a-b);
const report={results,p50:(times[4]+times[5])/2,p95:times[9]};
writeFileSync(`evidence/c2c-${process.argv[2]}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({p50:report.p50,p95:report.p95}));
