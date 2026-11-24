# C4b — Integrate UI with real core + API, lead review fixes (Lane L4/L5, Antigravity)
Owns: /web only. Core/API are committed (see git log). Fixes from lead review of evidence/ui/1280-hold.png:
1. Default mode: Live (POST /api/analyze); if the API is unreachable or returns mode offline-fallback, show the banner with fallbackReason. Offline mode runs core in-browser. Keep "Fixtures" only behind ?demo=fixtures (not in the main toggle).
2. Verdict heading: use the extracted address (fields.address) → campus, not "LISTING → UW"; fall back to "Unlisted address" + an escalation hint.
3. Decision cards: show real confidence vs threshold (meter with threshold tick), decision.reason, evidence spans (click → scroll/highlight in listing). No hard-coded 100%.
4. Wire real resolveEscalation / perform / undo / markWrong from core (offline) so the action log, rewind and regression-fixture download reflect true engine state in both modes (for live mode, run follow-up operations locally on the returned AnalysisResult via core).
5. "What I couldn't check" panel from result.couldNotCheck; refused listings (result.refused) show a polite refusal card.
6. Samples: replace the 3 sample listings with 3 realistic ones from evals/gold/ (one clean, one scam, one tricky) — read-only use.
Verify end-to-end in the browser with `npm run dev:api` (port 8787) + web dev: (a) live run on each sample, (b) offline toggle, (c) API killed → fallback banner, (d) non-English listing → refusal, (e) markWrong → rewind + fixture download. Save screenshots evidence/ui/int-*.png (1280 + 375). Build must pass. ≤15-line HANDOFF.md entry. Commit on main and `git push` (origin exists).
