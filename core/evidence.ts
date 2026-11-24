// Small concept checks, scoped to a clause so unrelated negations do not leak.
export function evidenceClauses(text: string): string[] {
  return text.replace(/[’]/g,"'").split(/[!?;\n]|\.(?=\s|$)|\bbut\b/i).filter(s=>s.trim());
}
const negative = (text:string) => /\b(?:no|not|never|nobody|unavailable|cannot|can't|don't|doesn't|won't)\b/i.test(text.replace(/\bno\s+(?:problem|worries|issue)\b/gi,''));
export function booleanEvidence(name:string,text:string): boolean|undefined {
  const concept=name==='viewing_offered'
    ? /\b(?:view(?:ing|ings)?|visits?|tours?|showings?|walk[ -]?through|come\s+by|swing\s+by|check\s+(?:it|the\s+(?:room|place))\s+out|show\s+you\s+around|see\s+(?:it|the\s+(?:room|place|unit)))\b/i
    : /\b(?:owner|landlord|homeowner|live[ -]in)\b/i;
  const values=evidenceClauses(text).filter(s=>concept.test(s)).map(s=>{
    if(name==='owner_lives_in' && /\b(?:off[ -]site|elsewhere|lives?\s+(?:away|out)|non[ -]resident)\b/i.test(s))return false;
    return !negative(s);
  });
  return values.length && values.every(v=>v===values[0]) ? values[0] : undefined;
}
export function rentEvidence(text:string): number[] {
  return [...text.matchAll(/(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k\b)?(\s*(?:\$|dollars?\b|(?:\/|per\s*)(?:mo(?:nth)?s?)\b))?/gi)]
    .filter(m=>m[1]||m[3]||m[4]||/\brent\b/i.test(text))
    .map(m=>Number(m[2].replace(/,/g,''))*(m[3]?1000:1));
}
// Checks only permission/negation of the suspected restriction, not negations
// which constitute the restriction itself ("no pets", "no interest").
export function negatedRestriction(text:string,start:number,end:number,ruleId:string): boolean {
  const before=text.slice(0,start).split(/[.!?;\n]|\bbut\b/i).pop()??'';
  const after=text.slice(end).split(/[.!?;\n]|\bbut\b/i)[0];
  const clause=before+text.slice(start,end)+after;
  if(/\b(?:no|not|never|without|cannot|can't|won't|don't|doesn't)\s+(?:(?:a|any|the|require|requires|request|enforce|allow)\s+){0,4}["'“”‘’]*\s*$/i.test(before))return true;
  if(/^\s*["'“”‘’]*(?:\s+(?:clause|policy|rule|is|are|will|be|does))*\s+(?:not\s+(?:required|enforced|applicable|apply)|never\s+(?:required|enforced)|optional|voluntary|waived|unnecessary)/i.test(after))return true;
  if(ruleId==='no_pets')return /\b(?:pets?|animals?|dogs?|cats?)\s+(?:are\s+)?(?:welcome|allowed|permitted)\b/i.test(clause.replace(/\bno[ -](?:pets?|animals?|dogs?|cats?)\b/gi,'')) || /\b(?:do\s+not|don't|never|not)\s+(?:use|have|enforce|apply|include|a\s+rule|a\s+clause)\b/i.test(clause);
  if(['damage_deposit','excess_rent_deposit','key_deposit'].includes(ruleId) && /\b(?:no|never|not)\s+(?:(?:damage|security|rent|key|pet|cleaning)\s+)?(?:deposit|bond|hold|fund)\b|\b(?:deposit|bond|hold|fund)\s+(?:is\s+)?(?:not\s+required|optional|waived)\b/i.test(clause))return true;
  if(ruleId==='postdated_cheques' && /\b(?:optional|voluntary|not\s+required|never\s+required)\b/i.test(clause))return true;
  if(ruleId==='owner_shared')return booleanEvidence('owner_lives_in',clause)===false;
  return false;
}
