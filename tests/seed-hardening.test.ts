import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cacheKey } from '../api/_lib/capacity';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE } from '../api/_lib/samples';
import { analyze, decisionSignature } from '../core/index';
import { seedSamples } from '../scripts/seed_sample_cache';

const env = { GEMINI_API_KEY: 'mock-key', GEMINI_MODEL: 'mock-model' };
const geocode = async () => undefined;
const raw = { fields: {}, clauses: [] };
let directory: string;
let output: URL;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'sb-seed-'));
  output = pathToFileURL(join(directory, 'seed.json'));
  await writeFile(output, 'original');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it.each([{ GEMINI_MODEL: 'mock' }, { GEMINI_API_KEY: 'mock' }])('requires both environment settings %#', async missing => {
  const adapter = vi.fn();
  await expect(seedSamples({ env: missing, adapter, output })).rejects.toThrow('requires');
  expect(adapter).not.toHaveBeenCalled();
  expect(await readFile(output, 'utf8')).toBe('original');
});

it('captures replayable extraction and the answering model, pacing sample starts', async () => {
  const sleep = vi.fn(async () => {});
  const entries = await seedSamples({
    env, output, geocode, sleep,
    adapter: () => {
      const adapter = {
        model: 'primary',
        fallbackReason: undefined as string | undefined,
        async extract() {
          adapter.model = 'secondary';
          adapter.fallbackReason = 'Primary 429; trying secondary';
          return raw;
        },
      };
      return adapter;
    },
  });
  expect(sleep.mock.calls).toEqual([[9000], [9000]]);
  expect(entries).toHaveLength(SAMPLE_LISTINGS.length);
  for (const [index, entry] of entries.entries()) {
    const request = { listing: SAMPLE_LISTINGS[index], profile: SAMPLE_PROFILE, mode: 'live' as const };
    expect(entry).toMatchObject({
      key: cacheKey(request),
      model: 'secondary',
      rawExtraction: raw,
      result: { listing: request.listing, model: 'secondary', fallbackReason: 'Primary 429; trying secondary' },
    });
    const replay = await analyze(request, { llm: { extract: async () => entry.rawExtraction } });
    expect(replay.mode).toBe('live');
    expect(decisionSignature(replay)).toBe(entry.signature);
    expect(entry.runId).toBe(entry.result.runId);
  }
  expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(entries);
});

it.each(['429', '503', 'Gemini attempt timeout'])('retries transient %s twice and preserves the seed on exhaustion', async reason => {
  const sleep = vi.fn(async () => {});
  const extract = vi.fn(async () => { throw new Error(reason); });
  await expect(seedSamples({ env, output, geocode, sleep, adapter: () => ({ extract }) }))
    .rejects.toThrow('existing seed file preserved');
  expect(extract).toHaveBeenCalledTimes(3);
  expect(sleep.mock.calls).toEqual([[30000], [30000]]);
  expect(await readFile(output, 'utf8')).toBe('original');
});

it('does not retry schema errors or replace the seed', async () => {
  const extract = vi.fn(async () => ({ invalid: true }));
  const sleep = vi.fn(async () => {});
  await expect(seedSamples({ env, output, geocode, sleep, adapter: () => ({ extract }) }))
    .rejects.toThrow('existing seed file preserved');
  expect(extract).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
  expect(await readFile(output, 'utf8')).toBe('original');
});

it('retries successfully but preserves the seed if a later sample fails', async () => {
  const extract = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce(raw)
    .mockRejectedValue(new Error('HTTP 401'));
  const sleep = vi.fn(async () => {});
  await expect(seedSamples({ env, output, geocode, sleep, adapter: () => ({ model: 'mock', extract }) }))
    .rejects.toThrow('existing seed file preserved');
  expect(sleep.mock.calls).toEqual([[30000], [9000]]);
  expect(extract).toHaveBeenCalledTimes(3);
  expect(await readFile(output, 'utf8')).toBe('original');
});

it('does not retry a permanent terminal error after a transient primary error', async () => {
  const extract = vi.fn(async () => {
    throw new Error('Primary mock-model: Gemini HTTP 429; trying fallback-model; Gemini HTTP 401');
  });
  const sleep = vi.fn(async () => {});
  await expect(seedSamples({ env, output, geocode, sleep, adapter: () => ({ extract }) }))
    .rejects.toThrow('existing seed file preserved');
  expect(extract).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
  expect(await readFile(output, 'utf8')).toBe('original');
});
