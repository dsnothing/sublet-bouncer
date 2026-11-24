import { existsSync, readFileSync } from 'node:fs';
import rules from '../data/rta_rules.json' with { type: 'json' };
import { type Answer } from './baseline_score.js';
import { beginCall, cacheDir, calls, hash, hashText, pace, read, save, sleep, type Attempt } from './baseline_runtime.js';

const model = 'gemini-3.1-flash-lite';
export const preregPaths = ['evals/baselines/b1_prompt.txt', 'evals/baselines/b2_checklist.ts'] as const;
// Match the exact LF prompt bytes used for the preregistered requests.
export const windowsText = (path: string) => readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n');
const prompt = readFileSync(preregPaths[0], 'utf8').replace(/\r\n/g, '\n');
const promptHash = hashText(prompt);
const schema = { type: 'OBJECT', properties: { verdict: { type: 'STRING', enum: ['ADMIT', 'HOLD', 'REFUSE'] }, clauses: { type: 'ARRAY', items: { type: 'OBJECT', properties: { quote: { type: 'STRING' }, category: { type: 'STRING', enum: [...rules.rules.map(r => r.id), 'other'] }, section: { type: 'STRING' } }, required: ['quote', 'category', 'section'] } } }, required: ['verdict', 'clauses'] };
function parse(body: any): Answer {
  const text = body.candidates?.[0]?.content?.parts?.filter((p: any) => !p.thought).map((p: any) => p.text ?? '').join('');
  const answer = JSON.parse(text);
  if (body.candidates?.[0]?.finishReason === 'MAX_TOKENS' || !['ADMIT', 'HOLD', 'REFUSE'].includes(answer.verdict) || !Array.isArray(answer.clauses) || answer.clauses.some((c: any) => typeof c.quote !== 'string' || typeof c.category !== 'string' || typeof c.section !== 'string')) throw new Error('Invalid structured answer');
  return { verdict: answer.verdict, clauses: answer.clauses.map((c: any) => ({ ruleId: c.category, quote: c.quote, section: c.section })) };
}

export interface B1Record {
  id: string; model: string; prompt_sha256: string; listing_sha256: string; prereg_commit: string;
  harness_sha256: string; complete: boolean; attempts: Attempt[]; result: Answer;
  listing?: string; resumed_before_first_call?: boolean; interrupted?: boolean; checkpoint_harness_sha256?: string;
}
interface Input { id: string; listing: string; listingHash: string }
export const pathFor = (id: string) => cacheDir + '/b1-' + id + '.json';

export function recordsComplete(ids: string[]) {
  return ids.every(id => existsSync(pathFor(id)) && read(pathFor(id)).complete);
}
export async function collect(inputs: Input[], preregCommit: string, live: boolean, kind: "b1" | "sample") {
  if (live && recordsComplete(inputs.map(input => input.id))) throw new Error('Cache complete; replay without --live');
  if (live && !process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  const records: B1Record[] = [];
  for (const [index, input] of inputs.entries()) {
    const { id, listing, listingHash } = input;
    const path = pathFor(id);
    const cached: B1Record | null = existsSync(path) ? read(path) : null;
    if (cached && (cached.listing_sha256 !== listingHash || cached.prompt_sha256 !== promptHash || cached.prereg_commit !== preregCommit)) {
      throw new Error('Cache inputs differ for ' + id);
    }
    if (cached?.complete) {
      records.push(cached);
      continue;
    }
    if (!live) throw new Error('Missing completed cache for ' + id);
    if (cached && (cached.attempts.length || calls().some(call => call.id === id))) {
      // A request with an unknown outcome still consumes the one-shot attempt.
      cached.complete = true;
      cached.interrupted = true;
      save(path, cached);
      records.push(cached);
      continue;
    }
    const record: B1Record = {
      id, model, prompt_sha256: promptHash, listing_sha256: listingHash, prereg_commit: preregCommit,
      harness_sha256: hash('evals/baseline_b1.ts'), complete: false, attempts: [],
      result: { verdict: 'no_answer', clauses: [] },
      ...(kind === 'sample' ? { listing } : {}),
      ...(cached ? { resumed_before_first_call: true, checkpoint_harness_sha256: cached.harness_sha256 } : {}),
    };
    save(path, record);
    const reserved = inputs.slice(index + 1).filter(item => !existsSync(pathFor(item.id))).length;
    const limit = (kind === 'b1' ? 37 : 50) - reserved;
    for (let attempt = 0; attempt < 3 && calls().length < limit; attempt++) {
      await pace();
      const event: Attempt = { at: beginCall(kind, id, limit) };
      record.attempts.push(event);
      save(path, record);
      let retry = false;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt + '\n\nListing:\n' + listing }] }], generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel: 'minimal' }, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: schema } }) });
        event.status = response.status;
        retry = [429, 503].includes(response.status);
        event.raw = await response.text();
        const body = JSON.parse(event.raw);
        event.usageMetadata = body.usageMetadata ?? null;
        if (response.ok) record.result = parse(body);
        else event.error = "HTTP " + response.status;
      } catch (error) {
        event.error = error instanceof Error ? error.message : 'Request failed';
        retry ||= /timeout|aborted/i.test(event.error);
      }
      save(path, record);
      if (!retry || attempt === 2 || calls().length >= limit) break;
      await sleep(30000);
    }
    record.complete = true;
    save(path, record);
    records.push(record);
    console.log(id, record.result.verdict, record.attempts.map(event => event.status ?? event.error));
  }
  return records;
}

export function rawAnswer(event: Attempt) {
  if (!event.raw || event.status !== 200) return null;
  const body = JSON.parse(event.raw);
  return body.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? '').join('') ?? null;
}
