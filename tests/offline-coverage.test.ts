import { describe,it,expect } from 'vitest';
import { analyze,clauseFindings,OFFLINE_WARNING } from '../core/engine';
import { data } from '../core/data';
import { offlineExtract } from '../core/extract';
import { fieldMetrics,verificationSafety,injectedHallucination } from '../core/extractionMetrics';
const profile={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW' as const,classStart:'08:30'};
const clean='Room at 203 Lester Street. Rent $850/month. Viewing available.';
const findings=(text:string)=>clauseFindings(text,data,'applies');
describe('C2f offline coverage and honesty',()=>{
  it.each([
    ['damage_deposit','We keep $300 for repairs.'],
    ['damage_deposit','Money is withheld in case something is broken.'],
    ['damage_deposit','A sum is held against cleaning costs.'],
    ['entry_notice','The owner may drop by anytime.'],
    ['entry_notice','The landlord can come in whenever it suits him.'],
    ['entry_notice','The owner may pop in without notice.'],
    ['maintenance_waiver','You fix all repairs.'],
    ['maintenance_waiver','You must pay for all the repairs.'],
    ['lockout','We may change the locks.'],
    ['lockout','We will remove your things.'],
  ])('fuzzy %s blocks review for %s',async(id,text)=>{
    const r=await analyze({listing:clean+' '+text,profile,mode:'offline'});
    expect(r.clauses).toContainEqual(expect.objectContaining({ruleId:id,confidence:.6}));
    expect(r.escalations).toContainEqual(expect.objectContaining({decisionId:'D2',blocking:true}));
    expect(r.verdict).not.toBe('ADMIT');
  });
  it.each([
    ['damage_deposit','We never keep money for damage.'],
    ['damage_deposit','No money is held for repairs.'],
    ['entry_notice','The owner cannot drop by anytime.'],
    ['entry_notice','The landlord may not pop in whenever desired.'],
    ['maintenance_waiver','You do not pay for all repairs.'],
    ['maintenance_waiver','You never fix all repairs.'],
    ['lockout','We will not change the locks.'],
    ['lockout','We cannot remove your things.'],
  ])('does not flag negated %s: %s',(id,text)=>expect(findings(text).some(c=>c.ruleId===id)).toBe(false));
  it.each(['offline','fallback'] as const)('labels clean %s ADMIT as reduced confidence',async mode=>{
    const r=await analyze({listing:clean,profile,mode:mode==='offline'?'offline':'live'});
    expect(r.verdict).toBe('ADMIT');expect(r.verdictConfidence).toBe('reduced');
    expect(r.verdictConfidenceReason).toBe(OFFLINE_WARNING);expect(r.couldNotCheck).toContain(OFFLINE_WARNING);
  });
  it('does not warn on verified live mode',async()=>{
    const r=await analyze({listing:clean,profile,mode:'live'},{llm:{extract:async()=>offlineExtract(clean)}});
    expect(r.verdictConfidence).toBe('standard');expect(r.couldNotCheck).not.toContain(OFFLINE_WARNING);
  });
});
describe('C2f excess deposit evidence gate',()=>{
  const proposed=(text:string)=>clauseFindings(text,data,'applies',[{span:{text,start:0,end:text.length},confidence:1,proposed_rule_id:'excess_rent_deposit',rationale:'Deposit'}]);
  it.each(["One month's rent deposit only.","Last month's rent deposit.",'Rent $850/month. Rent deposit $850.','No deposit of 2 months is required.','One month rent deposit only. Lease term is two months.','Rent $550/month. Security deposit $800.'])('rejects lawful/negated proposal: %s',text=>expect(proposed(text).some(c=>c.ruleId==='excess_rent_deposit')).toBe(false));
  it.each(['Deposit of 2 months.','Two months rent deposit.','First + last + extra.','Rent $850/month. Rent deposit $1200.'])('accepts positive excess evidence: %s',text=>expect(proposed(text).some(c=>c.ruleId==='excess_rent_deposit')).toBe(true));
  it('rejects lawful model proposal with an audit record',async()=>{
    const listing=clean+' One month rent deposit only.';
    const r=await analyze({listing,profile,mode:'live'},{llm:{extract:async()=>({...offlineExtract(listing),clauses:[{span:{text:'One month rent deposit only.'},confidence:1,proposed_rule_id:'excess_rent_deposit',rationale:'Deposit'}]})}});
    expect(r.verdict).toBe('ADMIT');expect(r.log.some(l=>l.summary.includes('Rejected proposal excess_rent_deposit'))).toBe(true);
  });
});
describe('C2f verification safety metrics',()=>{
  it('distinguishes missing values, wrong emitted values, and unannotated emissions',()=>{
    const raw=offlineExtract(clean);expect(fieldMetrics(raw.fields,{rent:999,address:'203 Lester Street',dates:'missing'})).toEqual({correct:1,incorrect:1,missing:1,unannotated:1});
  });
  it('counts fabricated spans and synthetic corruption independently of accuracy',()=>{
    const raw=offlineExtract(clean);raw.fields.address.span!.text='invented place';
    expect(verificationSafety(raw,clean,{address:'203 Lester Street'})).toMatchObject({fabricated_spans:1,fabricated_spans_rejected:1,correct_values_dropped:1});
    expect(injectedHallucination(offlineExtract(clean),clean)).toEqual({trials:1,raw_detected:0,verified_detected:1});
    expect(injectedHallucination({fields:{},clauses:[]},clean).verified_detected).toBe(1);
  });
});
