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
