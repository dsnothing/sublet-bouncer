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
- Scope risk: CLI uploaded shared checkout including concurrent web edits; web/evals changes excluded from this commit.

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
