import { existsSync } from 'node:fs';
import { createGeminiAdapter } from '../api/gemini.js';
import { setup, read, save, files, hash, pace, beginCall, cacheDir, tokenSummary, type Attempt } from './baseline_runtime.js';

setup();
const path = cacheDir + '/bouncer-tokens.json';
const live = process.argv.includes('--live');
if (existsSync(path)) {
  if (live) throw new Error('Token cache exists; refusing another live measurement');
  console.log(JSON.stringify(read(path).summary));
} else {
  if (!live) throw new Error('No token cache; --live required');
  if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  const model = 'gemini-3.1-flash-lite';
  const rows: { id: string; fixture_sha256: string; events: Attempt[]; success?: boolean; error?: string }[] = [];
  const output = {
    generated_at: new Date().toISOString(), model, adapter_sha256: hash('api/gemini.ts'),
    script_sha256: hash('evals/measure_bouncer_tokens.ts'), dataset: 'dev gold 01-10', rows,
    complete: false, summary: null as ReturnType<typeof tokenSummary> | null,
  };
  save(path, output);
  const fetchOriginal = globalThis.fetch;
  try {
    for (const file of files('evals/gold').slice(0, 10)) {
      const fixture = 'evals/gold/' + file;
      const g = read(fixture);
      const row: (typeof rows)[number] = { id: g.id, fixture_sha256: hash(fixture), events: [] };
      rows.push(row);
      await pace();
      globalThis.fetch = async (input, init) => {
        if (row.events.length) await pace();
        init?.signal?.throwIfAborted();
        const event: Attempt = { at: beginCall('bouncer-dev-tokens', row.id, 47 - (10 - rows.length)) };
        row.events.push(event);
        save(path, output);
        try {
          const response = await fetchOriginal(input, init);
          event.status = response.status;
          event.raw = await response.clone().text();
          try { event.usageMetadata = JSON.parse(event.raw).usageMetadata ?? null; } catch { event.usageMetadata = null; }
          return response;
        } catch (error) {
          event.error = error instanceof Error ? error.message : 'Request failed';
          throw error;
        } finally { save(path, output); }
      };
      try {
        await createGeminiAdapter(process.env.GEMINI_API_KEY, model, model).extract(g.listing);
        row.success = true;
      } catch (error) {
        row.success = false;
        row.error = error instanceof Error ? error.message : 'Extraction failed';
      }
      save(path, output);
      console.log(row.id, row.success ? "live" : "failed", row.events.map(event => event.status ?? event.error));
    }
  } finally { globalThis.fetch = fetchOriginal; }
  output.summary = tokenSummary(rows.map(row => row.events));
  output.complete = true;
  save(path, output);
}
