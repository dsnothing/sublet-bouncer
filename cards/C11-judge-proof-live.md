# C11 — Judge-proof live mode (Lanes L3 Codex Part A, L8 lead seed run, L4/L5 Antigravity Part B)
Why: `api/_lib/sample-cache.json` is `[]`. C2h built `scripts/seed_sample_cache.ts` and the honest `cached`/`cachedAt` flags, and C4f shows "Saved live result · <model> · <date>" with "Run fresh check" (`noCache: true`). But the seed was never run live, so every sample click and the first-load auto-run spend a free-tier call (Gate 2: 3 of 8 live calls fell back). Judges also need a failure they can trigger deterministically and that is clearly labelled. This is post-v3 work: do not run or tune on v3, and v3 numbers do not describe this behaviour.

Read first: hub/WORKFLOW.md §2-4, SPEC.md, this card. Excerpts: `api/_lib/capacity.ts` (AnalysisCache, VisitorBuckets, createCapacityAnalyzer), `api/analyze.ts`, `api/gemini.ts` (fallback chain, `fallbackReason`), `scripts/seed_sample_cache.ts`, `api/_lib/samples.ts`, `core/types.ts:13-17`, `evals/run_eval_v3.ts:144` (decision signature), `tests/capacity.test.ts`.

## Part A — Codex (L3)
1. **Decision signature.** Move the v3 repeat signature (fields → values sorted by key, clause ruleIds sorted, verdict; `run_eval_v3.ts:144`) into `core/signature.ts` as `decisionSignature(result)`, exported from `core/index.ts`. Do **not** edit `evals/run_eval_v3.ts`, which is frozen. Add a test that checks the function produces the same string as that inline expression on the 3 core fixtures.
2. **Seed hardening** (`scripts/seed_sample_cache.ts`):
   - Require `GEMINI_API_KEY` and an explicit `GEMINI_MODEL`, and exit with an error otherwise (the adapter default is `gemini-3-flash-preview`, which is not production).
   - Pace samples ≥ 9 s apart. Retry a sample at most 2 times, 30 s apart, only on 429, 503 or timeout.
   - Keep only `mode === 'live'` results. On any failure, exit non-zero and leave the existing file unchanged (current behaviour).
   - Capture the raw verified-LLM extraction by wrapping the adapter. Pass `model` and `fallbackReason` through with getters, because `adapter.model` changes during the chain.
   - Store each entry as `{key, cachedAt, runId, model, rawExtraction, signature, result}`. Extend `CacheEntry` with optional fields so `AnalysisCache` still loads old entries.
   - Never print the key.
3. **Seed parity test** (`tests/sample-seed.test.ts`):
   - For every seed entry: `key === cacheKey({listing, profile: SAMPLE_PROFILE, mode: 'live'})` for a current `SAMPLE_LISTINGS` item, and `result.listing` is that sample.
   - Re-running `analyze` with a stub LLM that returns `rawExtraction` gives the same `decisionSignature` and verdict as stored.
   - The cache file contains either 0 entries or exactly one per sample. When it is empty, the test passes but logs `seed missing`.
   - Result: any engine or sample change (e.g. C10) that changes a seeded verdict fails CI until the seed is regenerated.
4. **Circuit breaker** (per function instance, inside `createCapacityAnalyzer`):
   - Count a failure when a live result has `mode === 'offline-fallback'` and its `fallbackReason` matches 429, 503 or a timeout. Exclude the visitor-limit reason (`RATE_LIMIT_REASON`), refusals and simulated outages.
   - 3 consecutive failures within 60 s open the breaker for 60 s. While it is open, live requests skip the LLM (no fetch) and return offline-fallback with `fallbackReason: "Gemini is overloaded right now (3 failed calls in the last minute); offline engine used. Try again in about a minute."` and `breaker: 'open'`.
   - After the cooldown, one half-open trial request goes through. Success closes the breaker; failure re-opens it.
   - Seeded and cached sample results are still served while it is open (no LLM call is needed).
   - Use an injectable clock. Tests ≥ 6: opens after 3, stays closed after 2+success, half-open success and failure, visitor-limit not counted, cached sample served while open, no fetch while open.
5. **Guarded simulated outage (from candidate C4):**
   - Add `simulateOutage?: boolean` to `AnalyzeRequest` and validate it in `validateRequest`. It is honoured only when `listing` is exactly one of `SAMPLE_LISTINGS`; otherwise it is rejected with HTTP 400.
   - When honoured, skip cache, limiter tokens and fetch. Use an adapter that throws `"SIMULATED OUTAGE (demo): Gemini was not called"` so the request goes through the **real** fallback chain.
   - Set `simulated: true` on the result (add an optional field to `AnalysisResult` and validate it in `web/src/storage.ts`). Simulated results are never cached and never counted by the breaker, and the action-log row text includes "simulated".
   - Tests ≥ 5: non-sample text gives 400; sample gives offline-fallback with reduced confidence and `simulated: true`; mocked fetch is called 0 times; not cached; not counted by the breaker.
6. **Production smoke record.** Add `scripts/prod_smoke.ts` (BASE_URL argument, default production). It sends:
   - GET /api/health;
   - the 3 samples once each without noCache (expect `cached: true`, `mode: 'live'`, wall time recorded);
   - 1 simulateOutage sample;
   - 3 fresh pastes of dev-set listings from `evals/gold/` with `noCache: true`, paced ≥ 9 s.
   It writes `evidence/prod-smoke-<ISO date>.json` with counts and causes only (no listing text beyond gold ids), recording commit SHA, date and per-call mode, latency and fallbackReason. It never fails on a fallback; it records it.
7. Docs: add to `docs/LIMITATIONS.md` and README one paragraph on recorded runs, breaker and simulation: "Sample buttons replay a recorded live Gemini run (labelled, with date; 'Run fresh check' calls Gemini). Breaker and caches are per server instance."

## Seed run — lead (L8), after C10 and every engine change have merged, before the final deploy
`GEMINI_MODEL=gemini-3.1-flash-lite npx tsx scripts/seed_sample_cache.ts` with the key in the environment only. Commit only `api/_lib/sample-cache.json` (`git commit --only`, prefix "C11-seed:"), confirm the parity test is green, deploy from a clean HEAD, then run `scripts/prod_smoke.ts` and commit its evidence file. Do not run the seed or the smoke inside the judging window or more than twice a day.

## Part B — Antigravity (L4/L5), after Part A is pushed
1. Add a quiet secondary control under the sample buttons: "Simulate a Gemini outage". It runs the current sample with `simulateOutage: true` and is disabled for pasted text, with a tooltip explaining why. The banner reads "Simulated outage: Gemini was not called. This is the offline engine's answer, shown the way a real outage would be." It appears in `aria-live`, and the BoardingPass top band shows `SIMULATED` so it can never look like a real outage or a live run.
2. Breaker copy: when `fallbackReason` starts with "Gemini is overloaded right now", show it calmly with the existing Re-check button disabled for 60 s (countdown text, no animation under reduced motion).
3. Verify the C4f saved-live tag with a **real** seeded entry on a local `npm run dev:api` build: model, date and "Run fresh check" are all visible on the first-load auto-run.
4. Visual gate: `evidence/ui/c11-{1280,375}-{saved-live-autorun,simulated-outage,breaker-open}.png`, keyboard reachability of the new control, focus visible, 0 console errors.

## Done-checks
- `npm test`, `npm run typecheck` and `npm run build` are green, with ≥ 15 new tests, and the HANDOFF states the exact count.
- Mocked tests prove simulateOutage and an open breaker make 0 fetches.
- After the lead's seed run: `sample-cache.json` has 3 live entries with `model: gemini-3.1-flash-lite`, and the parity test passes.
- `evidence/prod-smoke-*.json` exists for the deployed SHA, with all 3 samples returning `cached: true` in under 1.5 s.
- `git grep -n GEMINI_API_KEY= -- .` finds nothing (no secrets).

## Honesty rules
A replay is always labelled as recorded, with its date and model, and a fresh run is always one click away. A simulated outage is labelled in the banner, the band and the log, and is allowed only on bundled samples. Never describe the breaker, cache or smoke as a measured reliability rate. Report smoke counts as raw counts for one date and SHA. If the smoke shows fallbacks, they go in the file unchanged.

## Process
Follow hub/WORKFLOW.md and the workforce-skills protocol (WORKFORCE-SKILLS.md + SKILLS-CATALOG.md); report role, selected skills and capability gaps first. Shared checkout: stage nothing in advance. Codex commits with `git commit --only -m "C11: ..." -- <paths>` (files: core/signature.ts, core/index.ts, core/types.ts, core/engine.ts validateRequest only, api/_lib/capacity.ts, api/analyze.ts, scripts/seed_sample_cache.ts, scripts/prod_smoke.ts, tests/*, docs/LIMITATIONS.md, README.md). Antigravity commits through `GIT_INDEX_FILE=.git/index-antigravity` with prefix "C11b:" (web/ and evidence/ui/ only). Push. **No deploy** by workers. Each part ends with a HANDOFF.md entry of at most 10 lines.