import { describe,it,expect } from 'vitest';
import { verifyExtraction,offlineExtract } from '../core/extract';
import { analyze,clauseFindings } from '../core/engine';
import { refusalReason } from '../core/injection';
import { data } from '../core/data';
const field=(value:unknown,text:string)=>({value,span:{text,start:999,end:1000},confidence:.9});
const proposal=(text:string,id:string)=>({span:{text,start:0,end:0},confidence:1,proposed_rule_id:id,rationale:'Potential restriction.'});
describe('C2d generic evidence checks',()=>{
  it.each([
    ['viewing_offered',true,'You may tour the unit on Thursday.'],
    ['viewing_offered',true,'Visit after lunch; no payment is necessary.'],
    ['viewing_offered',false,'Tours are unavailable until renovations finish.'],
    ['viewing_offered',false,"We cannot arrange a visit."],
    ['viewing_offered',true,'A tour is no problem.'],
    ['owner_lives_in',false,'There is no homeowner living on site.'],
    ['owner_lives_in',true,'The live-in homeowner occupies the lower floor.'],
    ['owner_lives_in',false,'The landlord resides elsewhere.'],
    ['rent',1250,'Monthly rent is 1,250 dollars.'],
    ['rent',1250,'1.25k/mo'],
    ['rent',1250,'1250 $'],
  ])('accepts %s=%s supported by %s',(name,value,text)=>{
    const checked=verifyExtraction({fields:{[name]:field(value,text as string)},clauses:[]},text as string);
    expect(checked.extraction.fields[name as string]?.value).toBe(value);
    expect(checked.extraction.fields[name as string]?.span?.start).toBe(0);
  });
  it.each([
    ['viewing_offered',true,'Visits are never available.'],
    ['viewing_offered',false,'Tour the apartment tomorrow.'],
    ['owner_lives_in',true,'No landlord lives in this house.'],
    ['viewing_offered',false,'The street number is private.'],
    ['rent',1200,'Rent is $1300/mo.'],
  ])('rejects unsupported or contradictory %s',(name,value,text)=>{
    expect(verifyExtraction({fields:{[name]:field(value,text as string)},clauses:[]},text as string).extraction.fields[name as string]).toBeUndefined();
  });
  it('rejects absent paraphrases and fixes offline owner negation',()=>{
    expect(verifyExtraction({fields:{viewing_offered:field(true,'Tour on Sunday')},clauses:[]},'Only a room description.').issues).toHaveLength(1);
    expect(offlineExtract('No homeowner lives here.').fields.owner_lives_in.value).toBe(false);
  });
  it.each([
    ['no_pets','Pets are welcome.'],
    ['no_pets','We never enforce a "no pets" clause.'],
    ['damage_deposit','No damage deposit required.'],
    ['damage_deposit','A security deposit is not required.'],
    ['postdated_cheques','Postdated cheques are optional.'],
    ['entry_notice','We never enter without notice.'],
  ])('guards regex and proposal for %s: %s',(id,text)=>{
    expect(clauseFindings(text,data,'applies',[proposal(text,id)])).toEqual([]);
  });
  it('scopes negation and retains real restrictions',()=>{
    const text='No damage deposit. But pets are prohibited. A security deposit is required.';
    const found=clauseFindings(text,data,'applies');
    expect(found.find(c=>c.ruleId==='no_pets')).toMatchObject({confidence:1,status:'void'});
    expect(found.find(c=>c.ruleId==='damage_deposit')?.span.text).toBe('security deposit');
  });
  it('rejects unrelated proposals and logs the gate outcome',async()=>{
    const text='A sunny apartment near a grocery store. Rent is $1100/month.';
    const result=await analyze({listing:text,mode:'live',profile:{termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW',classStart:'08:30'}},{llm:{extract:async()=>({fields:{},clauses:[proposal(text,'no_pets')]})}});
    expect(result.clauses).toEqual([]);
    expect(result.log.find(e=>e.summary.includes('Rejected proposal'))).toMatchObject({decision_kind:'llm+rules',output:{outcome:'rejected',ruleId:'no_pets'}});
  });
  it('retains supported unmatched proposals at 0.7',()=>{
    const text='A bond stays with us until departure.';
    expect(clauseFindings(text,data,'applies',[proposal(text,'damage_deposit')])).toMatchObject([{confidence:.7,status:'questionable'}]);
  });
  it.each(['room@example.org','https://example.org/rent','@sublet','+1 (519) 555-0100'])('ignores contact token %s for language detection',contact=>{
    expect(refusalReason(`Chambre disponible, loyer mensuel, appartement calme et lumineux. ${contact}`)).toBe('non_english');
  });
});
