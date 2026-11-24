import { findSpan, verifyExtraction, type Extraction } from './extract.js';
const normalize=(v:unknown)=>typeof v==='string'?v.toLowerCase().replace(/\s+/g,' ').trim():JSON.stringify(v);
// Partial annotations cannot establish whether an extra field is hallucinated.
export function fieldMetrics(fields:Extraction['fields'],expected:Record<string,unknown>) {
  let correct=0,incorrect=0,missing=0,unannotated=0;
  for(const [key,value] of Object.entries(expected)) {
    if(!Object.hasOwn(fields,key))missing++;
    else if(normalize(fields[key]?.value)===normalize(value))correct++;
    else incorrect++;
  }
  for(const key of Object.keys(fields))if(!Object.hasOwn(expected,key))unannotated++;
  return {correct,incorrect,missing,unannotated};
}
export function verificationSafety(raw:Extraction,listing:string,expected:Record<string,unknown>) {
  const checked=verifyExtraction(raw,listing).extraction;
  const fabricated=Object.entries(raw.fields).filter(([,f])=>!f.span || !findSpan(listing,f.span.text));
  const droppedCorrect=Object.entries(raw.fields).filter(([key,f])=>Object.hasOwn(expected,key)&&normalize(f.value)===normalize(expected[key])&&!checked.fields[key]);
  return {fabricated_spans: fabricated.length,fabricated_spans_rejected:fabricated.filter(([key])=>!checked.fields[key]).length,correct_values_dropped:droppedCorrect.length};
}
export function injectedHallucination(raw:Extraction,listing:string) {
  // One impossible value AND absent span per item, including empty extractions.
  let text='C2F fabricated address 999999';while(listing.includes(text))text+='X';
  const key=Object.keys(raw.fields)[0]??'address';
  const original=raw.fields[key];
  const value=typeof original?.value==='boolean'?!original.value:typeof original?.value==='number'?999999999:text;
  const corrupted:Extraction={...raw,fields:{...raw.fields,[key]:{value,confidence:1,span:{text,start:0,end:text.length}}}};
  const verified=verifyExtraction(corrupted,listing).extraction;
  return {trials:1,raw_detected:0,verified_detected:Number(!verified.fields[key])};
}
