import { readFileSync, existsSync, renameSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const cacheDir = 'evals/cache/baselines-v3';
export const hashText = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const stableHash = (path: string) => hashText(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
export const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
export function save(path: string, data: unknown) {
  const temporary = path + '.tmp';
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n');
  renameSync(temporary, path);
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const files = (dir: string) => readdirSync(dir).filter(f => f.endsWith('.json')).sort();
export function setup() {
  mkdirSync(cacheDir, { recursive: true });
}
export interface Call { kind: string; id: string; at: string }
export const callsPath = cacheDir + '/calls.json';
export const calls = (): Call[] => existsSync(callsPath) ? read(callsPath) : [];
export async function pace() {
  const last = calls().at(-1);
  if (last) await sleep(Math.max(0, 9000 - (Date.now() - Date.parse(last.at))));
}
export function beginCall(kind: string, id: string, limit = 50) {
  if (Date.now() >= Date.parse('2026-11-28T23:00:00Z')) throw new Error('Judging freeze: live calls disabled');
  const ledger = calls();
  if (ledger.length >= limit) throw new Error('Live call budget exhausted');
  const call = { kind, id, at: new Date().toISOString() };
  ledger.push(call);
  save(callsPath, ledger); // Write before network so an interrupted attempt consumes budget.
  return call.at;
}
interface Usage { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number }
export interface Attempt { at: string; status?: number; raw?: string; usageMetadata?: Usage | null; error?: string }
function tokens(event: Attempt) {
  const usage = event.usageMetadata;
  if (!usage || usage.promptTokenCount === undefined) return null;
  const prompt = usage.promptTokenCount;
  const output = usage.totalTokenCount !== undefined ? usage.totalTokenCount - prompt
    : usage.candidatesTokenCount === undefined ? undefined : usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0);
  return output === undefined ? null : { prompt, output, total: prompt + output };
}
export function tokenSummary(checks: Attempt[][]) {
  const attempts = checks.flat();
  const measured = checks.filter(check => check.length && check.every(event => tokens(event) !== null));
  const totals = measured.map(check => check.map(event => tokens(event)!).reduce(
    (a, b) => ({ prompt: a.prompt + b.prompt, output: a.output + b.output, total: a.total + b.total }),
    { prompt: 0, output: 0, total: 0 },
  ));
  const average = (key: keyof (typeof totals)[number]) => totals.length ? totals.reduce((n, row) => n + row[key], 0) / totals.length : null;
  const sorted = totals.map(row => row.total).sort((a, b) => a - b);
  return {
    checks: checks.length, measured_checks: totals.length, http_attempts: attempts.length,
    metadata_responses: attempts.filter(event => tokens(event) !== null).length,
    missing_usage: attempts.filter(event => tokens(event) === null).length,
    mean_prompt: average("prompt"), mean_output: average("output"), mean_total: average("total"),
    p95: sorted[Math.ceil(.95 * sorted.length) - 1] ?? null,
  };
}
