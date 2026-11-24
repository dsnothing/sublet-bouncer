import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
    expect(result).toMatchObject({ unsafe_admit: 1, quotes_not_in_listing: 1, section_mismatches: 2, tp: 1, fp: 1, fn: 0 });
  });
  it('B2 applies zero/one/two flag thresholds', () => {
    expect(checklist('At 123 Lester St. Viewing available.').verdict).toBe('ADMIT');
    expect(checklist('Room available.').verdict).toBe('HOLD');
    expect(checklist('Room available. WhatsApp only.').verdict).toBe('REFUSE');
  });
});

describe("C12 cached demo samples", () => {
  it.each(["clean", "tricky", "scammy"] as const)("matches the current %s UI listing", (key) => {
    expect(exportData.samples[key].listing).toBe(SAMPLE_LISTINGS[key].listing);
  });
  it("preserves raw answers and mechanically verifies each quote and section", () => {
    for (const { rawAnswer, verdict, listing, clauses } of Object.values(exportData.samples)) {
      const raw = JSON.parse(rawAnswer);
      expect(raw.verdict).toBe(verdict);
      expect(clauses.map(({ category, quote, section }) => ({ category, quote, section }))).toEqual(raw.clauses);
      for (const clause of clauses) {
        expect(clause).toMatchObject(verifyClause(listing, { ...clause, ruleId: clause.category }));
      }
    }
  });
});
