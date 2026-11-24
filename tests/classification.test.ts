import { describe, expect, it } from 'vitest';
import { analyze, clauseFindings } from '../core/engine';
import { verifyExtraction, offlineExtract, RULE_IDS } from '../core/extract';
import { computeFeatures } from '../core/features';
import { responseSchema } from '../api/gemini';
import { markWrong } from '../core/log';
import { data } from '../core/data';
const profile={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW' as const,classStart:'08:30'};
const base='Room at 203 Lester Street. Rent $850/month. Viewing available. Owner does not live here. ';
const proposal=(text:string,id='damage_deposit')=>({span:{text,start:0,end:0},confidence:1,proposed_rule_id:id,rationale:'Possible security for tenant damage.'});
const live=(listing:string,clauses:unknown[],fields={})=>analyze({listing,profile,mode:'live'},{llm:{extract:async()=>({fields:{...offlineExtract(listing).fields,...fields},clauses})}});
describe('C2b conservative rule proposals',()=>{
  it('escalates a verified unmatched proposal at 0.7 and never marks it void',async()=>{
    const text='A reserve is retained until the room is returned intact.';
    const r=await live(base+text,[proposal(text)]);
    expect(r.mode).toBe('live');
    expect(r.clauses.find(c=>c.ruleId==='damage_deposit')).toMatchObject({confidence:.7,status:'questionable'});
    expect(r.escalations.some(e=>e.decisionId==='D2'&&e.question.includes('s.105'))).toBe(true);
    expect(r.decisions.find(d=>d.id==='D2')).toMatchObject({kind:'llm+rules',confidence:.7,escalated:true});
    expect(r.log.find(l=>l.ref==='D2')).toMatchObject({decision_kind:'llm+rules'});
    expect(r.verdict).toBe('HOLD');
  });
  it('drops and logs a proposal whose evidence is absent',async()=>{
    const r=await live(base,[proposal('An invented reserve requirement.')]);
    expect(r.clauses).toEqual([]);
    expect(r.couldNotCheck).toContain('Dropped clause: evidence is absent from the listing');
    expect(r.log.some(l=>l.summary.includes('Dropped clause'))).toBe(true);
    expect(r.escalations.some(e=>e.question.includes('Dropped clause'))).toBe(true);
  });
  it('validates the same rule enum in the schema and runtime',async()=>{
    expect(responseSchema.properties.clauses.items.properties.proposed_rule_id.enum).toEqual([...RULE_IDS,'none']);
    expect(()=>verifyExtraction({fields:{},clauses:[proposal('Room','invented_law')]},base)).toThrow('Invalid proposed rule id');
    expect((await live(base,[proposal('Room','invented_law')])).mode).toBe('offline-fallback');
  });
  it('preserves tentative proposals when applicability is corrected',async()=>{
    const text='A reserve is retained until the room is returned intact.';
    const r=await live(base+text,[proposal(text)]);
    const corrected=markWrong(r,'D5','applies').result;
    expect(corrected.clauses.find(c=>c.ruleId==='damage_deposit')).toMatchObject({confidence:.7,status:'questionable'});
    expect(corrected.escalations.some(e=>e.decisionId==='D2')).toBe(true);
  });
  it('allows none without inventing a finding',async()=>{expect((await live(base,[proposal('Room','none')])).clauses).toEqual([]);});
  it('rejects a rationale above 20 words',()=>{expect(()=>verifyExtraction({fields:{},clauses:[{...proposal('Room'),rationale:Array(21).fill('word').join(' ')}]},base)).toThrow('rationale');});
  it.each(['Money held for repairs.','A breakage bond applies.','A security holdback is required.'])('uses generic security synonyms only as fuzzy hints: %s',text=>{
    expect(clauseFindings(text,data,'applies').find(c=>c.ruleId==='damage_deposit')).toMatchObject({confidence:.6});
  });
  it.each(['No animals.','Dogs are not welcome.','Pets are forbidden.'])('uses generic animal prohibitions only as fuzzy hints: %s',text=>{
    expect(clauseFindings(text,data,'applies').find(c=>c.ruleId==='no_pets')).toMatchObject({confidence:.6});
  });
  it.each([['Damage deposit required.',1],['A breakage bond applies.',.6]] as const)('keeps regex precedence: %s',async(text,confidence)=>{
    const r=await live(base+text,[proposal(text)]);
    expect(r.clauses.filter(c=>c.ruleId==='damage_deposit')).toHaveLength(1);
    expect(r.clauses.find(c=>c.ruleId==='damage_deposit')?.confidence).toBe(confidence);
  });
  it('OR merges verified booleans without erasing regex positives',()=>{
    const listing='Pay before viewing. Wire transfer required. Landlord abroad.';
    const fields=Object.fromEntries(['payment_before_viewing','risky_payment_method','landlord_abroad'].map(name=>[name,{value:false,confidence:1,span:{text:listing,start:0,end:listing.length}}]));
    expect(computeFeatures(listing,fields)).toMatchObject({payment_before_viewing:1,risky_payment_method:1,landlord_abroad:1});
  });
  it('uses verified live paraphrases for all three scam features and payment verdict',async()=>{
    const text='The funds must arrive ahead of your inspection; I reside overseas; settlement is in digital coins.';
    const listing=base+text;
    const fields=Object.fromEntries(['payment_before_viewing','risky_payment_method','landlord_abroad'].map(name=>[name,{value:true,confidence:.9,span:{text,start:0,end:0}}]));
    const r=await live(listing,[],fields);
    expect(computeFeatures(listing,r.fields)).toMatchObject({payment_before_viewing:1,risky_payment_method:1,landlord_abroad:1});
    expect(r.verdict).toBe('REFUSE');
  });
  it('drops absent risk evidence and rejects non-boolean risk values',()=>{
    const field={value:true,confidence:1,span:{text:'fabricated',start:0,end:10}};
    expect(verifyExtraction({fields:{landlord_abroad:field},clauses:[]},base).extraction.fields.landlord_abroad).toBeUndefined();
    expect(()=>verifyExtraction({fields:{landlord_abroad:{...field,value:'true'}},clauses:[]},base)).toThrow('risk boolean');
    expect(computeFeatures(base,{landlord_abroad:field}).landlord_abroad).toBe(0);
  });
});

