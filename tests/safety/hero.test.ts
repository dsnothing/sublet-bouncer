import { it, expect } from 'vitest';
import { SAMPLE_LISTINGS as UI_SAMPLES, runAnalysis } from '../../web/src/adapter';
import { analyze } from '../../core/engine';
import { SAMPLE_LISTINGS } from '../../api/_lib/samples';
import { profile, stub } from './helpers';

it.each(['offline','live'] as const)('hero is HOLD with two terms and no owner-sharing question (%s)',async mode=>{
  const listing=SAMPLE_LISTINGS[1];
  const r=await analyze({listing,profile,mode},{llm:stub(listing)});
  expect(r.mode).toBe(mode);
  expect(r.verdict).toBe('HOLD');
  expect(r.rtaApplies).toBe('applies');
  expect(r.clauses.map(c=>c.ruleId)).toEqual(expect.arrayContaining(['damage_deposit','entry_notice']));
  expect(r.escalations.some(e=>e.decisionId==='D5')).toBe(false);
});
it('hero UI metadata and server text stay in parity',()=>{
  expect(UI_SAMPLES.tricky).toMatchObject({
    label:'Hidden terms', goldId:'demo-hero', listing:SAMPLE_LISTINGS[1],
  });
});

it('fixture demo mode shows the actual hero with an offline result', async () => {
  const listing = UI_SAMPLES.tricky.listing;
  const {result} = await runAnalysis({listing, profile}, 'fixtures');
  expect(result).toMatchObject({listing, mode:'offline', verdict:'HOLD', rtaApplies:'applies'});
  expect(result.clauses.map(c => c.ruleId)).toEqual(['damage_deposit', 'entry_notice']);
});
