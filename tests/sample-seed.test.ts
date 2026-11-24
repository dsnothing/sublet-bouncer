import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyze, decisionSignature } from '../core/index';
import type { AnalysisResult } from '../core/types';
import { cacheKey, type CacheEntry } from '../api/_lib/capacity';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE } from '../api/_lib/samples';

it.each(['admit', 'hold', 'refuse'])('signature matches the frozen v3 expression for %s', name => {
  const file = new URL(`../core/fixtures/sample-result.${name}.json`, import.meta.url);
  const result = JSON.parse(readFileSync(file, 'utf8')) as AnalysisResult;
  const inline = JSON.stringify({
    fields: Object.fromEntries(Object.entries(result.fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.value])),
    clauses: result.clauses.map(c => c.ruleId).sort(),
    verdict: result.verdict,
  });
  expect(decisionSignature(result)).toBe(inline);
});

it('seed has zero entries or exactly one verified replay per current sample', async () => {
  const file = new URL('../api/_lib/sample-cache.json', import.meta.url);
  const seeds = JSON.parse(readFileSync(file, 'utf8')) as CacheEntry[];
  expect(Array.isArray(seeds)).toBe(true);
  if (seeds.length === 0) {
    console.log('seed missing');
    return;
  }

  expect(seeds).toHaveLength(SAMPLE_LISTINGS.length);
  expect(seeds.map(entry => entry.result.listing).sort()).toEqual([...SAMPLE_LISTINGS].sort());
  for (const entry of seeds) {
    const request = { listing: entry.result.listing, profile: SAMPLE_PROFILE, mode: 'live' as const };
    expect(entry.key).toBe(cacheKey(request));
    expect(entry.result.mode).toBe('live');
    expect(entry.rawExtraction).toBeDefined();
    expect(entry.model).toBeTruthy();
    expect(entry.model).toBe(entry.result.model);
    expect(entry.runId).toBe(entry.result.runId);
    const replay = await analyze(request, {
      llm: { model: entry.model, extract: async () => entry.rawExtraction },
    });
    expect(replay.mode).toBe('live');
    expect(decisionSignature(replay)).toBe(entry.signature);
    expect(decisionSignature(entry.result)).toBe(entry.signature);
    expect(replay.verdict).toBe(entry.result.verdict);
  }
});
