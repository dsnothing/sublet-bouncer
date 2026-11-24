import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { pathFor, rawAnswer, type B1Record } from '../evals/baseline_b1.js';
import { score, verifyClause, type Label } from '../evals/baseline_score.js';
import { SAMPLE_LISTINGS } from '../web/src/adapter.js';
import exportData from '../web/src/data/baseline-samples.json';
import { checklist } from '../evals/baselines/b2_checklist.js';
const frozen = JSON.parse(readFileSync('evals/results-v3-final.json', 'utf8'));
const labels: Label[] = readdirSync('evals/redteam-v3').filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(`evals/redteam-v3/${f}`, 'utf8')));
describe('C12 frozen score parity', () => {
  it.each([['offline', '0.767', '1.000', '0.385'], ['flash-lite', '0.800', '0.778', '0.538']])('%s reproduces published headline', (name, acc, p, r) => {
    const result = score(frozen.rows[name], labels);
    expect(result.verdict_accuracy.toFixed(3)).toBe(acc);
    expect(result.precision?.toFixed(3)).toBe(p);
    expect(result.recall?.toFixed(3)).toBe(r);
  });
  it('counts unsafe admits, absent quotes, mismatched and unknown citations', () => {
    const result = score([{ id: 'a', result: { verdict: 'ADMIT', clauses: [
      { ruleId: 'no_pets', quote: ' NO   PETS ', section: 's.14' },
      { ruleId: 'damage_deposit', quote: 'made up', section: 's.14' },
      { ruleId: 'other', quote: 'no pets', section: 's.999' },
    ] } }], [{ id: 'a', listing: 'No pets', verdict: 'HOLD', clauses: ['no_pets'], info_topics: ['key_deposit'] }]);
    expect(result).toMatchObject({ unsafe_admit: 1, quotes_not_in_listing: 1, section_mismatches_strict: 2, section_mismatches_normalized: 2, tp: 1, fp: 1, fn: 0 });
  });
  it('reproduces both B1 citation counts and full violation recall from the cached raw responses', () => {
    const rows = labels.map(({ id }) => {
      const record: B1Record = JSON.parse(readFileSync(pathFor(id), 'utf8'));
      const raw = rawAnswer(record.attempts.at(-1)!);
      if (!raw) throw new Error(`Missing cached answer for ${id}`);
      const answer = JSON.parse(raw);
      expect(record.result.verdict).toBe(answer.verdict);
      expect(record.result.clauses.map(({ ruleId, quote, section }) => ({ category: ruleId, quote, section }))).toEqual(answer.clauses);
      return record;
    });
    expect(score(rows, labels)).toMatchObject({ section_mismatches_strict: 19, section_mismatches_normalized: 6, tp: 13, fn: 0, recall: 1 });
  });
  it('B2 applies zero/one/two flag thresholds', () => {
    expect(checklist('At 123 Lester St. Viewing available.').verdict).toBe('ADMIT');
    expect(checklist('Room available.').verdict).toBe('HOLD');
    expect(checklist('Room available. WhatsApp only.').verdict).toBe('REFUSE');
  });
});

describe('C12 section matching', () => {
  it.each([
    ['damage_deposit', 's.105(1)', true, true],
    ['damage_deposit', 'Section 105', false, true],
    ['damage_deposit', 'Section 105(1) of the Residential Tenancies Act, 2006', false, true],
    ['damage_deposit', 'RTA s. 105(2)', false, false],
    ['damage_deposit', 'Section 1050', false, false],
    ['damage_deposit', 'Commercial Tenancies Act, s. 105', false, false],
    ['damage_deposit', 'Section 105 of the Commercial Tenancies Act', false, false],
    ['entry_notice', 'Section 26', false, true],
    ['entry_notice', 's.27; s.26', false, true],
    ['entry_notice', 's.27; s.76', false, false],
    ['entry_notice', 'Section 27(2)', false, false],
    ['no_pets', 'Section 14(1)', false, true],
    ['owner_shared', 'RTA Section 5(I)', false, true],
    ['owner_shared', 'Section 5(ii)', false, false],
    ['standard_lease', 'Section 12.1', false, true],
    ['standard_lease', 'Section 12', false, false],
    ['sublet_consent', 'Section 97(2)', false, true],
    ['sublet_consent', 'Section 97(3)', false, false],
    ['key_deposit', 'O. Reg. 516/06 Section 17', false, true],
    ['key_deposit', 'O. Reg. 999/06 Section 17', false, false],
    ['key_deposit', 'RTA Section 17(3)', false, false],
    ['key_deposit', 'Section 17', false, false],
    ['other', 'RTA Section 105', false, false],
  ] as const)('%s with %s has strict match %s and normalized match %s', (ruleId, section, strictMatchesRule, matchesRule) => {
    expect(verifyClause('Clause text', { ruleId, section })).toMatchObject({ strictMatchesRule, matchesRule });
  });
});

describe("C12 cached demo samples", () => {
  it.each(["clean", "tricky", "scammy"] as const)("matches the current %s UI listing", (key) => {
    expect(exportData.samples[key].listing).toBe(SAMPLE_LISTINGS[key].listing);
  });
  it("preserves raw answers and mechanically verifies each quote and section", () => {
    for (const [key, sample] of Object.entries(exportData.samples)) {
      const { verdict, listing, clauses } = sample;
      const record: B1Record = JSON.parse(readFileSync(pathFor(`sample-${key}`), 'utf8'));
      expect(sample.rawAnswer).toBe(rawAnswer(record.attempts.at(-1)!));
      const raw = JSON.parse(sample.rawAnswer);
      expect(raw.verdict).toBe(verdict);
      expect(clauses.map(({ category, quote, section }) => ({ category, quote, section }))).toEqual(raw.clauses);
      for (const clause of clauses) {
        expect(clause).toMatchObject(verifyClause(listing, { ...clause, ruleId: clause.category }));
      }
    }
  });
});
