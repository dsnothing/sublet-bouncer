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
  // Reject whole-clause statements that expressly permit or deny the suspected
  // restriction. Anchoring keeps a lawful term from masking a second restriction.
  const statement=clause.trim().replace(/[.!?;]+$/, '');
  if(ruleId==='maintenance_waiver' && /^(?:(?:the\s+)?tenant|you)\s+(?:(?:do|does|will)\s+not|never|cannot|can't|won't)\s+(?:do|pay\s+for|fix)\s+(?:all\s+)?repairs$|^(?:the\s+)?landlord\s+is\s+responsible\s+for\s+repairs$/i.test(statement))return true;
  if(ruleId==='entry_notice' && /^(?:entry\s+without\s+(?:prior\s+)?notice\s+is\s+allowed\s+(?:only\s+)?in\s+an?\s+emergency|(?:the\s+)?(?:landlord|owner)\s+(?:can|may|will)\s+enter\s+with\s+(?:at\s+least\s+)?24\s+hours?['’]?\s+written\s+notice\s+for\s+repairs)$/i.test(statement))return true;
  if(ruleId==='lockout' && /^(?:we|(?:the\s+)?landlord)\s+(?:(?:will|do|does|must)\s+not|cannot|can't|won't|never|will\s+never)\s+(?:change\s+the\s+locks(?:\s+if\s+rent\s+is\s+late)?|remove\s+your\s+(?:things|belongings)|impose\s+immediate\s+eviction)$/i.test(statement))return true;
  if(ruleId==='lockout' && /^(?:we|(?:the\s+)?landlord)\s+(?:can|may|will)\s+change\s+the\s+locks\s+and\s+(?:give|provide)\s+(?:you\s+)?(?:replacement|new)\s+keys$/i.test(statement))return true;
  if(ruleId==='key_deposit' && /^(?:a\s+)?refundable\s+key\s+deposit\s+equal\s+to\s+(?:the\s+)?replacement\s+cost$|^(?:the\s+)?key\s+deposit\s+(?:is|will\s+be)\s+returned\s+when\s+(?:the\s+)?keys\s+are\s+returned$/i.test(statement))return true;
  if(/\b(?:no|not|never|without|cannot|can't|won't|don't|doesn't)\s+(?:(?:a|any|the|require|requires|request|enforce|allow)\s+){0,4}["'“”‘’]*\s*$/i.test(before))return true;
  if(/^\s*["'“”‘’]*(?:\s+(?:clause|policy|rule|is|are|will|be|does))*\s+(?:not\s+(?:required|enforced|applicable|apply)|never\s+(?:required|enforced)|optional|voluntary|waived|unnecessary)/i.test(after))return true;
  if(ruleId==='entry_notice' && /\b(?:owner|landlord)\b[^.!?;\n]{0,25}\b(?:cannot|can't|won't|never|may\s+not|must\s+not|does\s+not|do\s+not)\b[^.!?;\n]{0,20}\b(?:enter|pop|drop|come)\b/i.test(clause))return true;
  if(ruleId==='damage_deposit' && /\bno\s+(?:money|sum|amount|cash)\b/i.test(clause))return true;
  if(ruleId==='no_pets')return /\b(?:pets?|animals?|dogs?|cats?)\s+(?:are\s+)?(?:welcome|allowed|permitted)\b/i.test(clause.replace(/\bno[ -](?:pets?|animals?|dogs?|cats?)\b/gi,'')) || /\b(?:do\s+not|don't|never|not)\s+(?:use|have|enforce|apply|include|a\s+rule|a\s+clause)\b/i.test(clause);
  if(['damage_deposit','excess_rent_deposit','key_deposit'].includes(ruleId) && /\b(?:no|never|not)\s+(?:(?:damage|security|rent|key|pet|cleaning)\s+)?(?:deposit|bond|hold|fund)\b|\b(?:deposit|bond|hold|fund)\s+(?:is\s+)?(?:not\s+required|optional|waived)\b/i.test(clause))return true;
  if(ruleId==='postdated_cheques' && /\b(?:optional|voluntary|not\s+required|never\s+required)\b/i.test(clause))return true;
  if(ruleId==='owner_shared')return booleanEvidence('owner_lives_in',clause)===false;
  return false;
}

// Positive evidence of excess is required, independently of the model's label.
export function excessDepositEvidence(evidence:string,listing:string):boolean {
  const text=evidence.replace(/[\u2018\u2019]/g,"'");
  const context=evidenceClauses(listing).find(s=>s.includes(evidence))??text;
  if(/\b(?:damage|security|key|pet|cleaning)\s+deposit\b/i.test(context) && !/\brent\s+deposit\b/i.test(text))return false;
  if(/\b(?:(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[2-9]|\d{2,})\s*months?['?]?\s*(?:rent\s*)?(?:deposit|up\s*front|advance)|(?:rent\s*)?deposit\s*(?:of\s*)?(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[2-9]|\d{2,})\s*months?)\b/i.test(text) || /\bfirst\s*(?:and|\+)\s*last\s*(?:and|\+)\s*extra\b/i.test(text))return true;
  const rent=/\brent\s*(?:is|:)?\s*\$\s*([\d,]+(?:\.\d+)?)/i.exec(listing) ?? /\$\s*([\d,]+(?:\.\d+)?)\s*(?:\/|per\s*)mo(?:nth)?\b/i.exec(listing);
  const deposit=/\b(?:rent\s+)?deposit\s*(?:of|is|:)?\s*\$\s*([\d,]+(?:\.\d+)?)/i.exec(text);
  return !!rent && !!deposit && Number(deposit[1].replace(/,/g,''))>Number(rent[1].replace(/,/g,''));
}
