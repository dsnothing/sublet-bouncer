import { afterEach, expect, it, vi } from 'vitest';
import type { ServerResponse } from 'node:http';
import { analyze, validateRequest } from '../core/engine';
import {
  AnalysisCache, BREAKER_REASON, createCapacityAnalyzer, cacheKey, RATE_LIMIT_REASON, SIMULATED_REASON,
} from '../api/_lib/capacity';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE as profile } from '../api/_lib/samples';
import handler, { type ApiRequest } from '../api/analyze';
import { validateAndSanitizeResult } from '../web/src/storage';

const req = { listing: SAMPLE_LISTINGS[0], profile, mode: 'live' as const, noCache: true };
const raw = { fields: {}, clauses: [] };
afterEach(() => vi.unstubAllGlobals());

function setup() {
  let now = 1000;
  const extract = vi.fn<(_listing: string) => Promise<unknown>>(async () => {
    throw new Error('Gemini HTTP 429');
  });
  const service = createCapacityAnalyzer({
    now: () => now,
    cache: new AnalysisCache([]),
    geocode: async () => undefined,
    llm: () => ({ model: 'mock', extract }),
  });
  let visitor = 0;
  const call = (extra = {}) => service({ ...req, ...extra }, `visitor-${visitor++}`);
  const open = async () => {
    await call();
    await call();
    await call();
  };
  return { extract, service, call, open, advance: (ms: number) => { now += ms; } };
}

async function simulate(listing: string, mode = 'live') {
  let status = 0;
  const end = vi.fn();
  const response = { setHeader: vi.fn(), end, set statusCode(value: number) { status = value; } };
  const request = { method: 'POST', headers: {}, body: { ...req, listing, mode, simulateOutage: true } };
  await handler(request as unknown as ApiRequest, response as unknown as ServerResponse);
  return { status, body: JSON.parse(end.mock.calls[0][0]) };
}

it('opens after three failures and open requests make zero fetches', async () => {
  const s = setup();
  await s.open();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(await s.call()).toMatchObject({
    mode: 'offline-fallback',
    breaker: 'open',
    fallbackReason: BREAKER_REASON,
  });
  expect(s.extract).toHaveBeenCalledTimes(3);
  expect(fetch).not.toHaveBeenCalled();
});

it('two failures then success resets consecutive failures', async () => {
  const s = setup();
  await s.call();
  await s.call();
  s.extract.mockResolvedValueOnce(raw);
  expect((await s.call()).mode).toBe('live');
  await s.call();
  await s.call();
  expect((await s.call()).breaker).toBeUndefined();
  expect((await s.call()).breaker).toBe('open');
});

it('half-open success closes the breaker', async () => {
  const s = setup();
  await s.open();
  s.advance(60_000);
  s.extract.mockResolvedValue(raw);
  expect((await s.call()).mode).toBe('live');
  expect((await s.call()).mode).toBe('live');
});

it('half-open failure reopens the breaker', async () => {
  const s = setup();
  await s.open();
  s.advance(60_000);
  await s.call();
  expect((await s.call()).breaker).toBe('open');
  expect(s.extract).toHaveBeenCalledTimes(4);
});

it('only one half-open trial enters while other requests use offline fallback', async () => {
  const s = setup();
  await s.open();
  s.advance(60_000);
  let finish!: (raw: unknown) => void;
  s.extract.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const trial = s.call();
  expect((await s.call()).breaker).toBe('open');
  finish(raw);
  expect((await trial).mode).toBe('live');
});

it('visitor-limit results do not count toward or reset the failure streak', async () => {
  const s = setup();
  s.extract.mockResolvedValueOnce(raw);
  await s.service(req, 'same');
  await s.service(req, 'same');
  await s.service(req, 'same');
  for (let i = 0; i < 4; i++) {
    expect((await s.service(req, 'same')).fallbackReason).toBe(RATE_LIMIT_REASON);
  }
  expect((await s.call()).breaker).toBeUndefined();
  expect((await s.call()).breaker).toBe('open');
});

it('serves a seeded sample while open', async () => {
  const live = await analyze(req, { llm: { model: 'mock', extract: async () => raw } });
  const cache = new AnalysisCache([{ key: cacheKey(req), cachedAt: new Date().toISOString(), result: live }]);
  const extract = vi.fn(async () => { throw new Error('503'); });
  const service = createCapacityAnalyzer({ cache, llm: () => ({ extract }), geocode: async () => undefined });
  for (let i = 0; i < 3; i++) await service(req, `v${i}`);
  expect(await service({ ...req, noCache: false }, 'cached')).toMatchObject({ cached: true, mode: 'live' });
  expect(extract).toHaveBeenCalledTimes(3);
});

it('failures outside a minute do not combine', async () => {
  const s = setup();
  await s.call();
  await s.call();
  s.advance(60_001);
  await s.call();
  expect((await s.call()).breaker).toBeUndefined();
});

it('non-transient errors do not open the breaker', async () => {
  const s = setup();
  s.extract.mockRejectedValue(new Error('Invalid extraction schema'));
  for (let i = 0; i < 5; i++) expect((await s.call()).breaker).toBeUndefined();
});

it.each(['503', 'LLM timeout'])('counts transient %s failures', async reason => {
  const s = setup();
  s.extract.mockRejectedValue(new Error(reason));
  await s.open();
  expect((await s.call()).breaker).toBe('open');
});

it('rejects non-sample simulation with HTTP 400', async () => {
  expect((await simulate(req.listing + ' extra')).status).toBe(400);
});

it('sample simulation uses real fallback, reduced confidence, and zero fetches', async () => {
  const s = setup();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const result = await s.call({ simulateOutage: true });
  expect(result).toMatchObject({
    mode: 'offline-fallback',
    verdictConfidence: 'reduced',
    simulated: true,
    fallbackReason: SIMULATED_REASON,
  });
  expect(result.log.some(entry => /simulated/i.test(entry.summary))).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  expect(s.extract).not.toHaveBeenCalled();
});

it('simulation bypasses cache and never writes to it', async () => {
  const live = await analyze(req, { llm: { model: 'mock', extract: async () => raw } });
  const cache = new AnalysisCache([]);
  cache.put(req, live);
  const put = vi.spyOn(cache, 'put');
  const service = createCapacityAnalyzer({ cache });
  expect((await service({ ...req, noCache: false, simulateOutage: true }, 'a')).simulated).toBe(true);
  expect(put).not.toHaveBeenCalled();
  expect(cache.get(req)?.mode).toBe('live');
});

it('simulation does not spend tokens or count toward the breaker', async () => {
  const s = setup();
  for (let i = 0; i < 5; i++) await s.service({ ...req, simulateOutage: true }, 'same');
  s.extract.mockResolvedValue(raw);
  for (let i = 0; i < 3; i++) expect((await s.service(req, 'same')).mode).toBe('live');
});

it('simulation leaves an existing two-failure sequence unchanged', async () => {
  const s = setup();
  await s.call();
  await s.call();
  for (let i = 0; i < 4; i++) await s.call({ simulateOutage: true });
  expect((await s.call()).breaker).toBeUndefined();
  expect((await s.call()).breaker).toBe('open');
});

it('validates the simulation request type and persisted flags', async () => {
  expect(() => validateRequest({ ...req, simulateOutage: 'yes' })).toThrow();
  const result = await setup().call({ simulateOutage: true });
  expect(validateAndSanitizeResult(result)?.simulated).toBe(true);
  expect(validateAndSanitizeResult({ ...result, simulated: 'yes' })).toBeNull();
  expect(validateAndSanitizeResult({ ...result, breaker: 'closed' })).toBeNull();
});

it('refused inputs do not count toward breaker failures', async () => {
  const s = setup();
  await s.call();
  await s.call();
  expect((await s.call({ listing: 'tiny' })).refused).toBeDefined();
  expect(s.extract).toHaveBeenCalledTimes(2);
  expect((await s.call()).breaker).toBeUndefined();
  expect((await s.call()).breaker).toBe('open');
});

it('late failures admitted before the breaker opened do not extend cooldown', async () => {
  const s = setup();
  let failLate!: (reason: Error) => void;
  s.extract.mockImplementationOnce(() => new Promise((_, reject) => { failLate = reject; }));
  const late = s.call();
  await s.open();
  s.advance(59_000);
  failLate(new Error('Gemini HTTP 503'));
  await late;
  s.advance(1000);
  s.extract.mockResolvedValueOnce(raw);
  expect((await s.call()).mode).toBe('live');
  expect(s.extract).toHaveBeenCalledTimes(5);
});

it('a refusal cannot use the half-open trial or reopen the breaker', async () => {
  const s = setup();
  await s.open();
  expect(await s.call({ listing: 'tiny' })).toMatchObject({ refused: { reason: 'too_short' }, mode: 'offline' });
  s.advance(60_000);
  expect((await s.call({ listing: 'tiny' })).refused).toBeDefined();
  s.extract.mockResolvedValueOnce(raw);
  expect((await s.call()).mode).toBe('live');
  expect(s.extract).toHaveBeenCalledTimes(4);
});

it('accepts sample simulation with HTTP 200 even when offline mode was requested', async () => {
  const response = await simulate(req.listing, 'offline');
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    mode: 'offline-fallback',
    simulated: true,
    fallbackReason: SIMULATED_REASON,
  });
});
