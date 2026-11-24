// Run explicitly after deploying the current commit.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { BREAKER_REASON, RATE_LIMIT_REASON, SIMULATED_REASON } from '../api/_lib/capacity.js';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE } from '../api/_lib/samples.js';
import type { AnalyzeRequest, AnalysisResult } from '../core/types.js';

interface SmokeCall {
  id: string;
  status?: number;
  latencyMs: number;
  mode?: AnalysisResult['mode'];
  cached?: boolean;
  simulated?: boolean;
  fallbackReason?: string;
  cause?: string;
  expectationMet: boolean;
}

// Keep known reasons verbatim. Parser or transport errors can contain raw provider output.
function recordedReason(reason: unknown): string | undefined {
  if (typeof reason !== 'string') return undefined;
  const fixedReasons = [
    BREAKER_REASON, RATE_LIMIT_REASON, SIMULATED_REASON,
    'Gemini attempt timeout', 'LLM timeout', 'LLM total timeout',
    'Gemini output token limit', 'Gemini returned no structured extraction',
    'GEMINI_API_KEY is not configured', 'Unsupported model', 'Live extraction unavailable',
    'LLM request failed', 'fallback request failed', 'fetch failed',
    'Invalid extraction schema', 'Invalid field schema', 'Invalid risk boolean',
    'Invalid clause schema', 'Invalid proposed rule id', 'Invalid clause rationale',
  ];
  if (fixedReasons.includes(reason)) return reason;
  const safe = reason.split('; ').every(part =>
    fixedReasons.includes(part)
    || /^Gemini HTTP \d{3}$/.test(part)
    || /^Primary [\w.-]+: (?:Gemini HTTP (?:429|503)|Gemini attempt timeout)$/.test(part)
    || /^trying [\w.-]+$/.test(part)
  );
  return safe ? reason : 'Unrecognized provider or extraction error';
}

const base = new URL(process.argv[2] ?? 'https://sublet-bouncer.vercel.app');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: new URL('../', import.meta.url),
  encoding: 'utf8',
}).trim();
const date = new Date().toISOString();

async function call(id: string, body?: AnalyzeRequest): Promise<SmokeCall> {
  const start = performance.now();
  const result: SmokeCall = { id, latencyMs: 0, expectationMet: false };
  try {
    const response = await fetch(new URL(body ? '/api/analyze' : '/api/health', base), {
      ...(body ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      } : {}),
      signal: AbortSignal.timeout(body ? 45_000 : 15_000),
    });
    result.status = response.status;
    if (!response.ok) {
      result.cause = `HTTP ${response.status}`;
      return result;
    }
    const reply = await response.json() as Partial<AnalysisResult> & { ok?: boolean };
    if (!body) {
      result.expectationMet = reply.ok === true;
      if (!result.expectationMet) result.cause = 'Health check did not report ok';
    } else {
      if (reply.mode !== 'live' && reply.mode !== 'offline' && reply.mode !== 'offline-fallback') {
        result.cause = 'Invalid analysis response';
        return result;
      }
      result.mode = reply.mode;
      result.cached = reply.cached === true;
      result.simulated = reply.simulated === true;
      result.fallbackReason = recordedReason(reply.fallbackReason);
      if (body.simulateOutage) {
        result.expectationMet = result.simulated && result.mode === 'offline-fallback';
      } else if (body.noCache) {
        result.expectationMet = result.mode === 'live' && !result.cached;
      } else {
        result.expectationMet = result.cached && result.mode === 'live' && performance.now() - start < 1500;
      }
    }
  } catch {
    result.cause = 'Transport or invalid response';
  } finally {
    result.latencyMs = Math.round(performance.now() - start);
  }
  return result;
}

const calls = [await call('health')];
const sampleRequest = (listing: string): AnalyzeRequest => ({ listing, profile: SAMPLE_PROFILE, mode: 'live' });
for (const [index, listing] of SAMPLE_LISTINGS.entries()) {
  calls.push(await call(`sample-${index + 1}`, sampleRequest(listing)));
}
calls.push(await call('simulation', { ...sampleRequest(SAMPLE_LISTINGS[0]), simulateOutage: true }));

// Use the authored development set, separate from the frozen v3 split.
for (const [index, file] of ['04.json', '08.json', '13.json'].entries()) {
  if (index > 0) await sleep(9000);
  const fixture = JSON.parse(await readFile(new URL(`../evals/gold/${file}`, import.meta.url), 'utf8')) as {
    id: string;
    listing: string;
    profile: AnalyzeRequest['profile'];
  };
  calls.push(await call(fixture.id, {
    listing: fixture.listing,
    profile: fixture.profile,
    mode: 'live',
    noCache: true,
  }));
}

const causes: Record<string, number> = {};
for (const { cause, fallbackReason } of calls) {
  const reason = fallbackReason ?? cause;
  if (reason) causes[reason] = (causes[reason] ?? 0) + 1;
}
const record = {
  commit, date,
  counts: {
    total: calls.length,
    live: calls.filter(call => call.mode === 'live').length,
    fallback: calls.filter(call => call.mode === 'offline-fallback').length,
    cached: calls.filter(call => call.cached).length,
    simulated: calls.filter(call => call.simulated).length,
    expectationsMet: calls.filter(call => call.expectationMet).length,
  },
  causes, calls,
};
const directory = new URL('../evidence/', import.meta.url);
await mkdir(directory, { recursive: true });
const output = new URL(`prod-smoke-${date.replace(/[:.]/g, '-')}.json`, directory);
await writeFile(output, JSON.stringify(record, null, 2) + '\n');
console.log(`Recorded ${calls.length} smoke calls in ${output.pathname}`);
