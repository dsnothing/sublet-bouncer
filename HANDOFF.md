## C4 — Web UI (Antigravity / Gemini 4 Neon, Lanes L4+L5)
- **Changed**: Built `/web` (Vite + React + TS) velvet-rope + perforated boarding-pass UI against `core/types.ts` and `core/fixtures/sample-result.{admit,hold,refuse}.json`. Implemented `ListingEditor` (Clean/Tricky/Scammy samples + UW/WLU profile), `HighlightedListing` (keyboard-focusable spans + origin-aware RTA lesson popover with e-Laws links + Plain/Simple English toggle), `BoardingPass` (ADMIT/HOLD/REFUSE ink stamp, CommuteStrip, ScamMeter with 0.30/0.70 ticks, safe action gate for Copy/ICS/Evidence Card, Not legal advice + Could-not-check stub), and collapsible dark `AccountabilityDrawer` (EscalationQueue, D1–D7 decisions with "Bouncer was wrong" + rewind + RegressionFixture JSON download, PermissionMatrix, append-only ActionLog with Undo). Adapter supports `fixtures` | `api` (`/api/analyze` proxy to `:8787`) | `offline` (dynamic `@core/index` import). State persisted in `localStorage` inside `try/catch`.
- **Verified**: `npm run build -w web` passed (`tsc --noEmit` + Vite build). Visual QA in browser at 1280×900 and 375×812 (0 horizontal overflow, 0 console errors, sticky mobile verdict strip, ARIA live verdict region, skip link, Escape closes popover, one-tap escalation resolution unlocks `.ics` and updates verdict to ADMIT, Undo appends to log without deleting history). Screenshots saved in `evidence/ui/` (`1280-{admit,hold,hold-popover,refuse,escalation-resolved,undo-log}.png`, `375-{admit,hold,refuse}.png`).
- **Open risks**: Live `/api/analyze` and in-browser `core/index.ts` offline execution were not tested end-to-end yet because C2 is committing `api/` + `core/` concurrently; `adapter.ts` dynamically imports `core/index.ts` and falls back cleanly until C2 lands. Also verify `core/index.ts` browser-bundle compatibility once C2 commits.

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
