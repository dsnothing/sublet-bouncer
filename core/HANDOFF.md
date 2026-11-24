## C2f - Offline coverage, honest confidence, deposit gate, safety metrics (Codex L3)
- Skills: karpathy-guidelines (scope), systematic-debugging (evidence trace); Node PATH workaround; no capability gaps.
- Added four generic fuzzy families + negation tests; offline/fallback verdictConfidence=reduced + verdictConfidenceReason + couldNotCheck warning (including ADMIT). UI owner must render this contract.
- Excess-rent-deposit proposals/hints now require positive multi-period/extra/above-known-rent evidence; legal one-month deposits rejected with audit log. Production evidence JSON reviewed: no secrets.
- Eval now pairs raw/verified annotated field precision+recall, fabricated spans rejected, correct values dropped, synthetic one-field corruption detection; no provider calls/deploy/v3 access.
- Verified:fresh committed-source npm ci/test/typecheck/build pass (160 tests, 1 optional skip); eval-runner strict typecheck + offline64 smoke pass. DEV evidence/runner: tests/c2f-dev-{before,after}.json + c2f-dev.ts.
| DEV / mode | Fields correct unchanged | Violation P/R before -> after | Verdict correct before -> after |
|---|---|---|---|
| gold / offline | 138/138 | 1/1 -> 1/1 | 39/40 -> 39/40 |
| gold / replay | 134/138 | 1/1 -> 1/1 | 39/40 -> 39/40 |
| v1 / offline | 39/68 | 1/.333 -> 1/.444 | 19/24 -> 20/24 |
| v1 / replay | 43/68 | 1/.333 -> 1/.444 | 19/24 -> 20/24 |
| v2 / offline | 61/117 | 1/.111 -> 1/.111 | 18/30 -> 18/30 |
| v2 / replay | 73/117 | .636/.778 -> .750/.667 | 25/30 -> 25/30 |
- Risks:DEV only; v2 TP7->6/FN2->3. Valid-paired gold/v1/v2 safety n=7/5/26 (19/13 legacy-schema rejects); synthetic detection raw0/38 vs verified38/38, natural fabricated0, correct dropped2. V2 raw field P/R=.870/.663 vs verified=.867/.644. Shared root HANDOFF concurrently owned; this scoped HANDOFF avoids mixing work.
