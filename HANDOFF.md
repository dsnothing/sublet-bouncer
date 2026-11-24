## C4 — Web UI (Antigravity / Gemini 4 Neon, Lanes L4+L5)
- **Changed**: Built `/web` (Vite + React + TS) velvet-rope + perforated boarding-pass UI against `core/types.ts` and `core/fixtures/sample-result.{admit,hold,refuse}.json`. Implemented `ListingEditor` (Clean/Tricky/Scammy samples + UW/WLU profile), `HighlightedListing` (keyboard-focusable spans + origin-aware RTA lesson popover with e-Laws links + Plain/Simple English toggle), `BoardingPass` (ADMIT/HOLD/REFUSE ink stamp, CommuteStrip, ScamMeter with 0.30/0.70 ticks, safe action gate for Copy/ICS/Evidence Card, Not legal advice + Could-not-check stub), and collapsible dark `AccountabilityDrawer` (EscalationQueue, D1–D7 decisions with "Bouncer was wrong" + rewind + RegressionFixture JSON download, PermissionMatrix, append-only ActionLog with Undo). Adapter supports `fixtures` | `api` (`/api/analyze` proxy to `:8787`) | `offline` (dynamic `@core/index` import). State persisted in `localStorage` inside `try/catch`.
- **Verified**: `npm run build -w web` passed (`tsc --noEmit` + Vite build). Visual QA in browser at 1280×900 and 375×812 (0 horizontal overflow, 0 console errors, sticky mobile verdict strip, ARIA live verdict region, skip link, Escape closes popover, one-tap escalation resolution unlocks `.ics` and updates verdict to ADMIT, Undo appends to log without deleting history). Screenshots saved in `evidence/ui/` (`1280-{admit,hold,hold-popover,refuse,escalation-resolved,undo-log}.png`, `375-{admit,hold,refuse}.png`).
- **Open risks**: Live `/api/analyze` and in-browser `core/index.ts` offline execution were not tested end-to-end yet because C2 is committing `api/` + `core/` concurrently; `adapter.ts` dynamically imports `core/index.ts` and falls back cleanly until C2 lands. Also verify `core/index.ts` browser-bundle compatibility once C2 commits.

## C4b — Live Core + API Integration & Lead Review Fixes (Antigravity / Gemini 4 Neon, Lanes L4+L5)
- **Changed**: Wired `/web` directly to `core/index.ts` (`analyze`, `resolveEscalation`, `perform`, `undo`, `markWrong`) and live `POST /api/analyze` (default mode: Live; `Fixtures` hidden behind `?demo=fixtures`). Offline mode and unreachable-API fallback both execute `core.analyze` in-browser and display the `fallbackReason` banner. Updated `BoardingPass` to show extracted `fields.address → campus` (or `Unlisted address` + escalation hint), a dedicated `"What I couldn't check"` panel, and a polite refusal card for `result.refused`. Upgraded `AccountabilityDrawer` decision cards with confidence-vs-threshold meters, real reasons, clickable evidence spans (scroll + highlight in `HighlightedListing`), and typed `markWrong` editors matching `core/log.ts`. Replaced the 3 samples with realistic `evals/gold/{01,31,25}.json` listings.
- **Verified**: `npm.cmd run build` (`tsc --noEmit && vite build`) passed. Verified end-to-end in headless Chrome (1280×900 & 375×812, 0 horizontal overflow, 0 JS errors) against `dev:api` (:8787, `gemini-3-flash-preview`) + Vite (:5173): (a) live Clean (`ADMIT`), Tricky (`HOLD`), Scammy (`REFUSE`, `Unlisted address`); (b) Offline toggle; (c) API killed → `offline-fallback` banner; (d) French listing → polite `non_english` refusal card; (e) `markWrong` on D5 → rewind (`Draft undone`), D2 clauses recomputed, `Regression fixture ready` JSON download toast; evidence-span click highlight verified. Saved 9 screenshots to `evidence/ui/int-*.png`.
- **Open risks**: None blocking; minor `/favicon.ico` 404 in dev console (cosmetic). LocalStorage key bumped to `sublet-bouncer:v2` to avoid stale C4 fixture payloads.

## C2 - Core decision engine + API (Codex L3)
- Role/skills: backend implementation; karpathy-guidelines (scope), systematic-debugging (verification); rg absent, native searches used.
- First commit 5900afc: exact SPEC types, three verdict fixtures, npm workspace scaffold; shared features in e1fa044.
- Implemented offline extraction, verified spans, RTA rules/applicability, trained scam inference, cached commute, D1-D7 and guards.
- Implemented permission gate, safe drafts, proposed ICS, append-only decision/action/undo/correction log and regression fixtures.
- API: Gemini JSON schema, 12s timeout/fallback, gemini-3-flash-preview + GEMINI_MODEL, local server on 8787, health and Vercel config.
- Verification: npm test 46 passed / 1 optional skipped; tsc clean; explicit key-loaded API suite 9 passed; browser core bundle passed.
- HTTP: offline 200 ADMIT; live 200 mode=live ADMIT, rent=850, 2.007s after minimal thinking configuration; no keys printed/tracked.
- Clean git archive cd3a9ff: npm ci, 45 tests, typecheck and web build passed; npm audit zero vulnerabilities.
- Risks: transit uses C3 street-centroid/cache estimates; preview-model availability can change; README is lead-owned and pending.
- UI integration/review remains C4/lead-owned; no web/data/evals/scripts files changed by C2. Dev API left running for integration.
- Spec ambiguity: shared local main has no remote, so checked local HEAD before commits; no pull/rebase target exists.

## C2b - Span-verified LLM rule proposals (Codex L3)
- Role/skills: backend implementation; karpathy-guidelines (scope), systematic-debugging (verification); rg/npm absent from PATH, native search/installed Node used.
- Extended Gemini clause schema with rule-id enum and <=20-word rationale; added three evidence-backed scam booleans.
- D2 regex wins; unmatched verified proposals remain questionable at 0.7, escalate below 0.75, and log llm+rules.
- Dropped unverified evidence is logged; verified live risk booleans OR into regex features and payment-before-viewing verdict.
- Retained tentative proposals through D1/D5 corrections; added generic fuzzy security/animal synonyms with RTA change log.
- Verified: npm test 63 passed, 1 optional live test skipped; npm run typecheck clean; 17 new classification cases.
- Separate key-loaded Gemini smoke: live, damage_deposit 0.7/questionable, D2 llm+rules, HOLD.
- Blind evals/redteam never opened; no /evals, /web, or scam_model edits; .env remains ignored.
- Git: pull --rebase blocked by concurrent unstaged work; fetch confirmed HEAD=origin/main before explicit-path commit.
- Risk: paraphrase precision/recall awaits independent C3 evaluation; verbatim evidence verifies text presence, not semantic truth.

## C5 web cross-review (Codex L6)
- Fixed ICS gate ordering, malformed storage render crash, stale response race, false clipboard success.
- Build passed; npm test: 64 passed, 1 skipped. Source review only; browser QA remains L5.
- Findings: evidence/review/C5-web-review.md. Fixed profile/result mismatch; fixture offsets remain.
- Cache reload recomputes analysis; correction/undo history resets until validated persistence is added.

## C2 deployment fix - Native Node ESM imports (Codex L3)
- Role/skills: backend runtime fix; systematic-debugging, vercel-functions, deployments-cicd; CLI used (no Vercel connector).
- Added explicit .js relative imports throughout core/api and JSON import attributes; no generated bundles.
- Moved json() into api/_lib/http.ts so health no longer loads analyze/Gemini/core.
- Added native Node regression: per-file TS emission, JSON loading, health 200 and offline analysis 200.
- Verified: npm test 64 passed / 1 optional live skipped; npm run typecheck and npm run build passed.
- Production READY: https://sublet-bouncer-4yhxo35yw-david-s10.vercel.app (Vite; build/deploy ~60s).
- Signed-out production: GET /api/health 200; POST /api/analyze offline 200 mode=offline ADMIT; live 200 mode=live ADMIT.
- Post-deploy error logs (5m): zero records; monitoring/drains configuration not inspected.
- Shared-checkout risk: CLI included concurrent web edits; concurrent C5 commit 5947756 captured the staged ESM fix together with C5 work.

## C3 - Verified data and v1 eval baseline (Codex L3)
- Skills: karpathy-guidelines (scope/reproducibility), systematic-debugging (integration); rg absent, native search used.
- Added 12 exact-quote verified RTA rules, CMHC mean/proxy benchmarks, 150 GTFS origins and 16 OSM geocodes.
- Added reproducible builders, 200 seeded synthetic training rows and shared-feature logistic weights; 40 authored gold cases.
- Independent Claude rt-01..24 kept unchanged; frozen results in evals/RESULTS-v1-baseline.md and results-v1-baseline.json.
- Independent offline: clause P/R .706/.545, fields26/68=.382, scam AUC .730, verdict12/24=.500.
- Independent Flash Lite: raw fields58/68=.853, same clause P/R/AUC/verdict; timeout5/24; p50/p95 5.036s/12.010s.
- Author-overlap gold: offline verdict38/40=.950; no generalization claim. Flash Lite completed64 (44 live,18 fallback,2 language refusals).
- V1 Flash/repeat unavailable after HTTP429; lead confirmed per-minute limit, paced Flash resume is authorized next.
- Verified: exact e-Laws excerpts, data bounds, training/gold separation, 45 tests passed/1 optional skipped, root+C3 strict typechecks.
- Risks: synthetic-only uncalibrated model; street centroids/straight-line walks; Nov2026 schedule proxies Winter2027; means are not medians.
- No rule/model tuning against blind cases. Future rt-v2 split will be the final headline; current24 become development data.

## C2 deployment add-on - Gemini model failover (Codex L3)
- Role/skills: backend retry/observability; systematic-debugging, vercel-functions, deployments-cicd; CLI available.
- Primary 429/503 retries once via GEMINI_FALLBACK_MODEL (default gemini-3.1-flash-lite), then existing offline fallback.
- Both attempts share one 12s AbortSignal budget; per-request adapter reports actual answering model.
- Analysis includes fallbackReason and D1 log reason/model; provider response bodies remain undisclosed.
- Verification: npm test 65 passed / 1 optional live skipped; typecheck and Vite production build passed.
- Tests cover primary 429/503 -> lite success, both fail -> offline, shared signal, model/reason/log.
- Production READY: https://sublet-bouncer-gcj095g1d-david-s10.vercel.app (Vite; deployment ~60s).
- Signed-out curl health: 200, ok=true, liveConfigured=true; offline analyze: 200, mode=offline, ADMIT.
- Signed-out curl live: 200, mode=live, model=gemini-3.1-flash-lite, HOLD; primary HTTP429 recorded as reason.
- Error logs since deploy: zero records; drains/monitoring not inspected. README remains absent/lead-owned.
- Git pull --rebase blocked by concurrent eval edits; fetch confirmed origin/main is an ancestor before push.
- Risks: both provider quotas can fail; lite may extract different facts/verdict; HTTP200 alone does not prove live mode.

## C2c - bounded compact Gemini extraction (Codex L3)
- Skills: systematic-debugging (timeout trace), karpathy-guidelines (focused implementation); CLI tools available via Node PATH.
- Retained documented minimal thinking; short rule codes, verbatim text-only spans, no generated rationale/confidence for clauses.
- Kept engine-consumed fields and all C2b risk booleans; verifier reconstructs offsets and proposals still escalate at 0.7.
- Output capped at 2048 tokens / 12 clauses; unused dates/deposits/utilities/contact/payment display fields omitted from live schema.
- Budget: 20s total, primary 14s, fallback 6s; retry 429/503/timeouts; body reads bounded; Vercel analyze maxDuration 30s.
- Paired 10-call local samples, five typical listings repeated twice, >=5s between calls; no held-out evals used.
- Before p50/p95 10.065s/12.029s (6 live, 4 timeout); after 9.158s/16.306s (6 live, 4 offline provider failures).
- After: 5 Lite successes, 1 recovered Flash success; two Lite503/Flash429, two Lite timeout/Flash429 failures.
- Verification: 71 tests passed/1 optional skipped; strict typecheck and production build passed; secrets remain ignored.
- Latency target NOT met; longer recovery budget can increase p95. Quota/load effects prevent attributing timing to schema alone.
- Reproduce: Node PATH available, npm ci, npm test, npm run typecheck/build; npx tsx scripts/c2c-latency.ts <label>.
- Deploy from clean detached worktree of this commit; post-deploy signed-out checks and actual SHA reported in final response.
- Open risk: README remains absent/lead-owned; C3 must independently verify accuracy after schema/prompt reduction.

## C7 - judge-facing documentation (Codex L3)
- Role/skills: L3 docs; write-page writing guidance reviewed (Page workflow inapplicable); gap: rg absent, PowerShell used.
- Added README, D1-D7 decision map, accountability/recovery, limitations, architecture, AI disclosure and David S MIT licence.
- Verified claims against engine/verifier/log/API/web code and source provenance; documented configured Lite-first versus Flash-first code defaults.
- Kept <!-- RESULTS:FINAL --> and linked reports without quoting eval numbers; human review remains explicitly pending.
- Verification: 71 tests passed, 1 optional skipped; typecheck/build passed; relative links and placeholder checked.
- Docs commit ac654d6 pushed to main; concurrent DATA-SOURCES/evals/web edits excluded.
- Risks: no fresh-clone install or browser check in this docs task; final evals and production evidence remain other owners' work.


## C4c — Production polish + local visual QA (Antigravity / Gemini 4 Neon, Lanes L4+L5)
- **Role/skills**: L4+L5 frontend polish & browser QA; skills: `emil-design-eng`, `karpathy-guidelines`, `unslop-ui`; gap: Node/npm required explicit `C:\Program Files\nodejs` PATH, browser QA used headless Chrome via CDP.
- **Changed**: Added honest staged Live wait state (`"Reading clauses with Gemini…"` → `"Verifying every quote…"` → `"Checking Ontario RTA rules…"`) with `tabular-nums` elapsed timer, 20 s client timeout cap, and `"Use offline now"` (`AbortController` cancels in-flight fetch + runs `coreAnalyze` offline). Added categorized fallback banner copy (rate-limit/quota vs timeout vs network vs backup model) with `"Why offline still works"` disclosure. Fixed all 3 open C5 findings: kept fixture original listing text in `?demo=fixtures` so offsets stay valid (`adapter.ts`), added versioned `sublet-bouncer:v3` deep validator + permission-gate recomputation preserving correction/undo history across reloads (`storage.ts`), and bound clipboard completion to `runId` (`BoardingPass.tsx`, `App.tsx`). Fixed `llm+rules` chip class styling.
- **Verified**: `npm.cmd run typecheck`, `npm.cmd run build` (`web/dist`), and `npm.cmd test` (71 passed, 1 skipped) green. Local headless Chrome CDP QA verified wait state + AbortController cancel (1 aborted request), 429/timeout/network fallback banners + disclosure, D5 correction reload persistence (3→3 log entries), keyboard Escape popover + focus return, `prefers-reduced-motion: reduce` (`1e-05s`), 1280×900 & 375×812 (0 overflow, 0 console errors). Screenshots: `evidence/ui/c4c-local-{wait-state,1280-tricky,fallback-429,1280-pasted,375-tricky}.png`.
- **Next**: Ready for lead deploy to https://sublet-bouncer.vercel.app; production visual QA pass (`evidence/ui/prod-*.png`) pending deploy.


## C4c-prod — Production visual QA on https://sublet-bouncer.vercel.app (Antigravity L5)
- **Role/skills**: L5 Browser QA on `origin/main 962a69c`; skills: `emil-design-eng`, `karpathy-guidelines`; T3 `preview_snapshot` failed twice (`The browser is not producing screenshot frames`), switched to headless Chrome CDP.
- **Verified (1280×900 & 375×812)**: 3 live samples on `gemini-3.1-flash-lite` (Tricky `HOLD`, Clean `ADMIT`, Scammy `REFUSE` + `Unlisted address`), live wait state (`Reading clauses with Gemini… 0.1s` + `Use offline now`), custom pasted listing (triggered live 429 → friendly rate-limit `OFFLINE-FALLBACK` banner + `Why offline still works` link + 3 flagged clauses), Offline Clean (`ADMIT`), D5 correction reload persistence (`3→3` log entries), Escape popover close + focus return, `prefers-reduced-motion: reduce` (`1e-05s`), WCAG AA contrast (`5.67:1`–`18.16:1` across 10 elements), `0` horizontal overflow, `0` console errors, `0` failed requests.
- **Minor cosmetic notes (non-blocking)**: `web/src/styles.css:1446` `.mobile-verdict-strip` `top: 57px` can tuck under the wrapped sticky `.topbar` while scrolling on 375px; `web/src/components/ListingEditor.tsx:79` `"University of Waterloo (UW)"` clips slightly to `"University of Waterlo"` inside the 1280px select.
- **Screenshots**: `evidence/ui/prod-{1280-tricky-live,1280-clean-live,1280-scammy-live,1280-pasted-live,1280-clean-offline,375-tricky,375-scammy}.png`.

## C3 - Final v2 evidence and error audit (Codex L3)
- Skills: karpathy-guidelines (scope), systematic-debugging (reproduction/causality); Flash quota deferred, no audit API calls.
- Frozen source 30126e1; RESULTS-v2-final.md + results-v2-final.json committed 2c61d1f; labels/rules/model unchanged.
- Independent30: Lite26 live/4 fallback (2 timeout,2 HTTP503), zero retries; violation P/R .348/.889 (TP8 FP15 FN1).
- All-topic P/R .685/.902; raw fields71/117, verified43/117; AUC .951; verdict13/30=.433; p50/p95 3.401s/14.004s.
- Offline: violation P/R .500/.111; fields28/117; AUC .914; verdict13/30=.433. Repeat15 trials:3 failed,2/5 cases consistent.
- V1-after-C2b disclosed as contaminated dev data; v2 lead-example phrase dependency0; seven disputed labels shown unchanged.
- ERROR-ANALYSIS-v2.md: all30 verdicts/decision drivers, all28 raw-right field drops, all17 all-topic FP pairs.
- Live wrong buckets:13 benign HOLDs,2 false scam blocks,1 scam under-detection,1 French language miss via email token.
- All28 quotes found:26 semantic regex misses,1 negation error,1 insufficient quote; offsets/whitespace were not the cause.
- Restoring viewing alone lowers false-block p .809->.577 and .754->.496; this is analysis-only, saved scores unchanged.
- ViolationFP15 =14 review proposals(.7)+1 regex; >=.75 precision1/2; zero actual void assertions, precision undefined.
- Verification:71 tests passed/1 optional skipped; root/eval strict typechecks; frozen hash+verifier reproduction matched; no secrets tracked.
- Risks: synthetic-only model, material RTA/commute unknowns, low proposal precision and quota limits; no post-holdout tuning.

## C2d - General precision fixes (Codex L3)
- Skills: systematic-debugging (trace/reproduce), karpathy-guidelines (scope); explicit Node PATH needed, no provider calls.
- Added scoped field concepts/negation and currency normalization, rule concept/permission gates with rejected llm+rules logs, contact-stripped language checks; D6 and proposal 0.7 unchanged.
- Verified: 101 tests passed, 1 optional skipped; root + dev-eval strict typechecks/build green; clean-clone npm install/test/typecheck/build passed, API health/web HTTP200; no frontend edits or deploy.
- DEV-only paired replay from saved Lite raw responses (gold 26/40, v1 18/24, v2 26/30); missing live responses use offline fallback. Labels unchanged; v3 never opened.
| Dev / mode | Fields correct before -> after | Violation P/R before -> after | Verdict correct before -> after |
|---|---|---|---|
| gold / offline | 138/138 -> 138/138 | 1.000/1.000 -> 1.000/1.000 | 38/40 -> 38/40 |
| gold / saved replay | 134/138 -> 134/138 | 1.000/1.000 -> 1.000/1.000 | 36/40 -> 36/40 |
| v1 / offline | 25/68 -> 39/68 | 1.000/.333 -> 1.000/.333 | 12/24 -> 12/24 |
| v1 / saved replay | 29/68 -> 43/68 | 1.000/.333 -> 1.000/.333 | 12/24 -> 12/24 |
| v2 / offline | 28/117 -> 61/117 | .500/.111 -> 1.000/.111 | 13/30 -> 15/30 |
| v2 / saved replay | 43/117 -> 73/117 | .348/.889 -> .636/.778 | 13/30 -> 17/30 |
- Evidence: evals/precision-dev-{before,after}.json; runner evals/precision_dev.ts. Risks: generic lexicons incomplete, synthetic DEV only, v2 recall loss TP8->7/FN1->2; D4/D5 unknowns still hold. No generalization claim.

## C2e - Escalation policy v2 (Codex L3)
- Skills: karpathy-guidelines (scope), systematic-debugging (regression trace); Node PATH workaround, no capability gaps.
- Added blocking contract/fixtures; D6 ignores notes, D1 missing address blocks, D5 evidence-gated/default applies, D2 info stays ok; injection/non-English and D7 gates retained.
- Added pre-viewing sensitive-ID/banking REFUSE, address normalization, server-only Nominatim fallback (generic UA, 1/s queue, 5s timeout, memory cache); browser/offline cache-only.
- Verified:126 tests passed/1 optional skipped; root+dev-runner strict typechecks/build; fresh-source npm install/test/typecheck/build passed, native ESM API health/analyze HTTP200.
- UI handoff: render Escalation.blocking=false as "Notes to confirm"; no web edits needed. No deployment. No v3 files opened or new provider calls; labels unchanged.
| DEV / mode | Fields correct (unchanged) | Violation P/R (unchanged) | Verdict correct before -> after |
|---|---|---|---|
| gold / offline | 138/138 | 1.000/1.000 | 38/40 -> 39/40 |
| gold / saved replay | 134/138 | 1.000/1.000 | 36/40 -> 39/40 |
| v1 / offline | 39/68 | 1.000/.333 | 12/24 -> 19/24 |
| v1 / saved replay | 43/68 | 1.000/.333 | 12/24 -> 19/24 |
| v2 / offline | 61/117 | 1.000/.111 | 15/30 -> 18/30 |
| v2 / saved replay | 73/117 | .636/.778 | 17/30 -> 25/30 |
- Evidence:evals/escalation-dev-{before,after}.json + escalation_dev.ts; saved raw coverage26/40,18/24,26/30 (missing live uses offline fallback). Risks:synthetic DEV only, lexicons incomplete, rate/cache per server process (no cross-instance coordination), live geocoder mocked only; README policy text needs lead refresh.

## C4d — Escalation blocking vs notes UI & C4c nits (Antigravity L4+L5)
- **Role/skills**: L4+L5 frontend & browser QA; skills: `emil-design-eng`, `karpathy-guidelines`, `unslop-ui`; gap: Node PATH required explicit `C:\Program Files\nodejs`, browser QA via headless Chrome CDP.
- **Changed**: Split Escalation Queue in `AccountabilityDrawer.tsx` into **"Needs your answer before a verdict"** (`blocking: true`) and a calmer, collapsed-by-default **"Notes to confirm"** disclosure (`blocking: false` + D5 RTA note) with one-tap answers for both; added ADMIT-with-notes callout + `aria-live` nuance in `BoardingPass.tsx` and calmer topbar note pill in `App.tsx`; validated `Escalation.blocking` in `storage.ts`. Fixed C4c nits: `ResizeObserver`-driven `--topbar-height` + `overflow-x: clip` keeps `.mobile-verdict-strip` cleanly below the wrapped sticky topbar at 375px (`overlapPx: -1`), and full-width Campus select (`351px`) prevents clipping `"University of Waterloo (UW)"` at 1280px.
- **Verified**: `tsc --noEmit`, `npm run build` (`web/dist`), and `npm test` (126 passed, 1 skipped) green; headless Chrome CDP QA at 1280×900 & 375×812 verified Clean/Tricky/Scammy + custom ADMIT-with-unknown-commute, collapsed-by-default Notes toggle + one-tap answers, `prefers-reduced-motion: reduce` (`1e-05s`), 0 overflow, 0 console errors.
- **Screenshots**: `evidence/ui/c4d-{1280-clean,1280-tricky,1280-scammy,1280-admit-notes-open,375-tricky-scrolled}.png`.
- **Open risks**: None blocking; no deploy performed (per brief).

## C4e — Reduced-confidence offline verdict UI (Antigravity L4+L5)
- **Role/skills**: L4+L5 frontend & browser QA; skills: `frontend-design`, `unslop-ui`, `karpathy-guidelines`; gap: explicit `C:\Program Files\nodejs` PATH, headless Chrome CDP.
- **Changed**: Rendered `AnalysisResult.verdictConfidence === 'reduced'` (`'standard'|'reduced'`) on `BoardingPass` with dashed provisional stamp (calm sage for offline ADMIT vs solid green live ADMIT), `"Checked offline — exact wording only"` tag inside `aria-live="polite"`, deduplicated `verdictConfidenceReason` leading `"What I couldn't check"`, mobile `ADMIT · OFFLINE` pill, `storage.ts` validation, and `/api/health`-gated one-click `"Re-check with Gemini"` (`adapter.ts`, `App.tsx`, `styles.css`).
- **Verified**: `tsc --noEmit`, `npm run build`, and `npm test` (160 passed, 1 skipped) green; headless Chrome CDP at 1280×900 & 375×812 verified offline ADMIT, one-click Gemini re-check → live ADMIT (`gemini-3.1-flash-lite`), `aria-live`, `prefers-reduced-motion: reduce` (`1e-05s`), 0 overflow.
- **Screenshots**: `evidence/ui/c4e-{1280-offline-admit,1280-offline-could-not-check,375-offline-admit,1280-live-admit,375-live-admit}.png`.
- **Open risks**: None blocking; no deploy performed (per brief).

## C2g - General prompt-injection coverage (Codex L3)
- Role/skills: L3 implementation; karpathy-guidelines (scope), systematic-debugging (detector trace); gap: rg unavailable, PowerShell search used.
- Added general AI addressing, verdict commands, instruction overrides, output directives and fake delimiter detection; NFKC normalization strips invisible format characters.
- Added 43 regressions: 33 family/obfuscation positives with blocking D1 escalation, 8 ordinary-listing negatives, 2 injection-only refusals; reproduced 32 misses before fix.
- Verified: npm test 203 passed / 1 optional skipped (8 files); npm run typecheck and npm run build passed.
- Post-v3-freeze change: no frozen v3 fixtures opened, no v3 evaluation rerun or tuning; existing v3 metrics describe the frozen source, not this change.
- Risks: heuristic coverage is incomplete; normal-listing negatives pass. No frontend change or deployment; unrelated evidence/demo/ left untouched.

## C2h - Free-tier capacity (Codex L3)
- Role/skills: L3; karpathy-guidelines (scope), vercel-functions (instance state), env-vars (setup), systematic-debugging (typed mock signatures); gaps: rg absent, live providers not exercised.
- Added SHA-256 request keys, live-only 200-entry/1h LRU, honest cached/cachedAt provenance, public-sample seed script (>=8s pacing), and exact text checks preserving evidence offsets.
- Added first-hop IP token buckets (burst 3, refill 6/10min), HTTP-200 explicit offline fallback, identical in-flight coalescing, and noCache bypass for cache/coalescing.
- Gemini retries primary 429/503 once for advertised delays <=3s within existing 14/6s budgets. Existing model chain preserved; Azure dropped per lead quota finding, no Azure code/env/tests shipped.
- Verified: npm test 221 passed / 1 optional live skipped (9 files), typecheck and web build passed; native emitted ESM API test covers JSON seed packaging.
- Env: GEMINI_API_KEY; GEMINI_MODEL=gemini-3.1-flash-lite; GEMINI_FALLBACK_MODEL=gemini-3-flash-preview. No new env vars.
- Seed intentionally empty under mock-only verification; lead must run documented seed command with genuine live credentials, commit output, then deploy. UI cache labeling belongs to Antigravity.
- Limits: cache/limiter/coalescing are per instance (reset on cold start, no global coordination); noCache still rate limited. Post-v3 only: frozen v3 not opened/run/tuned. No deployment.

## C4f — Honest "saved result" labelling + visitor-limit copy (Antigravity L4+L5)
- **Role/skills**: L4+L5 frontend & browser QA; skills: `karpathy-guidelines`, `unslop-ui`, `emil-design-eng`; gap: explicit `C:\Program Files\nodejs` PATH, headless Chrome CDP.
- **Changed**: Added calm `"Saved live result · <model> · <date>"` tag inside `aria-live="polite"`, `SAVED LIVE` top-band / `· SAVED` mobile pill, `"Run fresh check"` button sending `noCache: true` (honoured by `api/analyze.ts` + `capacity.ts`), visitor-limit fallback copy (`"You've used this visitor's live checks for now. The offline engine answered; try again in a few minutes."`), and `cached`/`cachedAt` storage validation (`BoardingPass.tsx`, `App.tsx`, `storage.ts`, `styles.css`).
- **Verified**: `npm run typecheck`, `npm run build`, `npm test` (221 passed, 1 skipped) green; headless Chrome CDP at 1280×900 & 375×812 verified cached tag in `aria-live`, `noCache: true` dispatch, visitor-limit banner, `prefers-reduced-motion: reduce` (`1e-05s`), 0 overflow, 0 console errors.
- **Screenshots**: `evidence/ui/c4f-{1280-cached,375-cached,1280-visitor-limit,375-visitor-limit}.png`. No deploy.

## C10 Part A — Legible hero and safety regressions (Codex L3)
- Skills: karpathy-guidelines and systematic-debugging. Git/Node/npm available; PowerShell and git grep substitute for rg.
- The default `tricky` sample is Hidden terms (`demo-hero`), HOLD offline and live with a stub. It finds damage_deposit and entry_notice with no owner-sharing question.
- Added verified-span verdict headlines and a pattern-based jurisdiction block that persists through corrections. Fixture demo runs the actual hero offline.
- Verified: 304 passed, 1 optional live test skipped (14 files). Typecheck, build, and README API/web startup smoke passed after npm ci.
- Safety: 83 regressions across 5 files, including 35 authored pairs and 3 asserted key-deposit gaps. Live paths used stubs.
- Post-v3: no frozen fixtures, labels, harness or results changed, opened, or run. C10 is development work.
- C5 sample cache seeds are stale and need regeneration in C11. Part B owns UI rendering and visual QA. No deploy.

## C11 Part A — Judge-proof live mode (Codex L3)
- Role and skills: L3 backend and tests with karpathy-guidelines for scope and acceptance checks. PowerShell search substituted for rg.
- Added atomic live-only seed recording with raw extraction, model, run ID and decision signature; parity follows current bundled samples.
- Added an instance-local circuit breaker and exact bundled-sample simulation. Both forced fallback paths skip network requests.
- API: send `simulateOutage: true`; response has `simulated: true`, `mode: 'offline-fallback'`, reduced confidence and the simulation reason. Breaker bypass returns `breaker: 'open'` and the overload reason.
- Verified 34 new tests (338 passed, one optional live skipped after C10), typecheck, build, local API and web startup, and the eight-request smoke recorder against a local mock.
- Lead runs the live seed after engine freeze, then deploys and records production smoke evidence. No live seed, production smoke or deploy performed. Frozen v3 untouched.

## C12 Part A - Baseline duel (Codex L3, 2026-11-24)
- Skills: karpathy-guidelines for scope, validate-data for scoring and cost, systematic-debugging for verification. PowerShell used in place of unavailable rg.
- Prereg 1c22017; run d020109. Kept six completed replies after interruption and resumed at v3-07 before its first request. B1 prompt and B2 checklist hashes match prereg.
- Verdict: B2 18/30, B1 20/30, Bouncer offline 23/30, frozen live 24/30. B1 violation P/R .813/1.000, 1 absent quote, 19 exact section mismatches, 0 no answers.
- B1 505.0 mean / 630 p95 tokens ($0.000196, 28/30 fully metered); Bouncer dev proxy 444.7 / 474 ($0.000361, 10/10). List-price estimates. Free-tier demo $0.
- Cached 45/50 HTTP attempts. Both B1 HTTP 503 retries succeeded. Frozen Bouncer had 6 provider fallbacks. Offline replay reproduces results and export.
- Part B data: web/src/data/baseline-samples.json. Use samples.clean/tricky/scammy only when the listing matches exactly. All three match merged C10; recorded verdicts ADMIT/REFUSE/REFUSE.
- npm test: 312 passed, 1 skipped. Typecheck, build, cache parity and credential scan passed. Synthetic n=30; section mismatches measure exact text agreement. No deploy.
