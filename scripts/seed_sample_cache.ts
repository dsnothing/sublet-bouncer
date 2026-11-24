// Run explicitly with the provider settings in the environment.
import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as sleepFor } from 'node:timers/promises';
import { analyze, type AnalyzeOptions } from '../core/engine.js';
import { decisionSignature } from '../core/signature.js';
import type { LLMAdapter } from '../core/extract.js';
import { createGeminiAdapter } from '../api/gemini.js';
import { cacheKey, isTransientFailure, type CacheEntry } from '../api/_lib/capacity.js';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE } from '../api/_lib/samples.js';
import { geocode } from '../api/_lib/geocode.js';

interface SeedOptions {
  env?: NodeJS.ProcessEnv;
  adapter?: () => LLMAdapter;
  geocode?: AnalyzeOptions['geocode'];
  sleep?: (ms: number) => Promise<void>;
  output?: URL;
}

export async function seedSamples(options: SeedOptions = {}): Promise<CacheEntry[]> {
  const { GEMINI_API_KEY: key, GEMINI_MODEL: model, GEMINI_FALLBACK_MODEL: fallbackModel } =
    options.env ?? process.env;
  if (!key?.trim() || !model?.trim()) {
    throw new Error('Seeding requires GEMINI_API_KEY and explicit GEMINI_MODEL');
  }

  const sleep = options.sleep ?? sleepFor;
  const createAdapter = options.adapter ?? (() => createGeminiAdapter(key, model, fallbackModel));
  const entries: CacheEntry[] = [];
  for (const [index, listing] of SAMPLE_LISTINGS.entries()) {
    if (index > 0) await sleep(9000);
    const req = { listing, profile: SAMPLE_PROFILE, mode: 'live' as const, noCache: true };
    for (let attempt = 1; attempt <= 3; attempt++) {
      const adapter = createAdapter();
      let rawExtraction: unknown;
      const llm: LLMAdapter = {
        get model() { return adapter.model; },
        get fallbackReason() { return adapter.fallbackReason; },
        async extract(text) {
          rawExtraction = await adapter.extract(text);
          return rawExtraction;
        },
      };
      const result = await analyze(req, { llm, geocode: options.geocode ?? geocode });
      if (result.mode === 'live' && result.model) {
        entries.push({
          key: cacheKey(req),
          cachedAt: new Date().toISOString(),
          runId: result.runId,
          model: result.model,
          rawExtraction,
          signature: decisionSignature(result),
          result,
        });
        break;
      }

      // A fallback chain can report a transient primary error and a permanent terminal error.
      const terminalReason = result.fallbackReason?.split('; ').at(-1) ?? '';
      if (attempt === 3 || !isTransientFailure(terminalReason)) {
        throw new Error(`Sample ${index + 1} did not complete live; existing seed file preserved`);
      }
      await sleep(30000);
    }
  }

  const output = options.output ?? new URL('../api/_lib/sample-cache.json', import.meta.url);
  const temporary = new URL(`${output.href}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(entries, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  return entries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const entries = await seedSamples();
  console.log(`Saved ${entries.length} live sample results with original model and timestamps.`);
}
