import { it, expect } from 'vitest';
import { analyze } from '../../core/engine';
import { hasInjection } from '../../core/injection';
import type { AnalysisResult } from '../../core/types';
import fixtures from './minimal_pairs.json';
import { shell, stub, profile } from './helpers';

const pairs: {id:string; ruleId:string; unlawful:string; lawful:string; knownFail?:string; knownChecks?:boolean[]}[] = fixtures;

it.each(pairs)('$id offline hazard, lawful twin, and hostile lawful proposal', async pair => {
  const unlawful = shell(pair.unlawful);
  const lawful = shell(pair.lawful);
  const injection = pair.ruleId === 'injection';
  const [bad, good, live] = await Promise.all([
    analyze({listing:unlawful, profile, mode:'offline'}),
    analyze({listing:lawful, profile, mode:'offline'}),
    analyze({listing:lawful, profile, mode:'live'}, {llm:stub(lawful, pair.lawful, injection ? undefined : pair.ruleId)}),
  ]);
  expect(live.mode).toBe('live');

  const flagsRule = (result: AnalysisResult, sentence: string) => {
    const start = result.listing.lastIndexOf(sentence);
    return result.clauses.some(c => c.ruleId === pair.ruleId)
      || result.escalations.some(e => e.blocking && e.decisionId === 'D2'
        && e.evidence.some(span => span.end > start && span.start < start + sentence.length));
  };
  const flagsInjection = (result: AnalysisResult) =>
    result.escalations.some(e => e.decisionId === 'D1' && e.blocking && e.question.includes('instruction-like content'));
  const checks = injection
    ? [
        hasInjection(unlawful) && flagsInjection(bad) && bad.verdict !== 'ADMIT',
        !hasInjection(lawful) && good.verdict === 'ADMIT',
        !flagsInjection(live) && live.verdict === 'ADMIT',
      ]
    : [
        flagsRule(bad, pair.unlawful) && bad.verdict !== 'ADMIT',
        !flagsRule(good, pair.lawful),
        !flagsRule(live, pair.lawful) && live.log.some(l =>
          l.ref === 'D2' && l.summary.startsWith('Rejected proposal ' + pair.ruleId + ':')),
      ];

  if (pair.knownFail) expect(checks, pair.knownFail).toEqual(pair.knownChecks);
  else expect(checks).toEqual([true,true,true]);
});

it.each([
  ['maintenance_waiver', 'Landlord is responsible for repairs and tenant does all repairs.'],
  ['entry_notice', 'Entry without notice is allowed in an emergency and for visits.'],
  ['lockout', 'We will not remove your belongings and we will change the locks if rent is late.'],
])('a lawful statement does not hide a second %s restriction', async (ruleId, sentence) => {
  const result = await analyze({listing:shell(sentence), profile, mode:'offline'});
  expect(result.verdict).toBe('HOLD');
  expect(result.clauses.some(c => c.ruleId === ruleId)).toBe(true);
});
