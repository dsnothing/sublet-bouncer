# Post-v3 baseline comparison

Run date: 2026-11-24. n = 30 synthetic listings.
Harness SHA-256 (LF-normalized): 2c671a451e596a2de21ca3735764644be5b8519712fafb5ad6ff5518237b2818. Preregistration commit: 1c22017cdd1be2ab63b414a6193ca0d2e7951278. Preregistration SHA-256 (LF-normalized): 767da8bf259b7f8cb53905ed6282293d306689af65666d4101c949448c1746df.
Bouncer rows are the frozen v3 run at 9be1f86, not re-run.

| System | Verdict acc (Wilson 95%) | Violation P/R | Unsafe ADMIT | Quotes not in listing | Section mismatches | no_answer | Tokens per check (mean) | List-price cost per check |
|---|---|---|---|---|---|---|---|---|
| B2 checklist | 18/30 (0.600, 0.423 to 0.754) | n/a | 9 | 0 | 0 | 0 | 0 LLM | $0.000000 |
| B1 plain chatbot | 20/30 (0.667, 0.488 to 0.808) | 0.813/1.000 | 4 | 1 | 19 | 0 | 505.0 | $0.000196 |
| Bouncer offline (v3) | 23/30 (0.767, 0.591 to 0.882) | 1.000/0.385 | 4 | 0 | 0 | 0 | 0 LLM | $0.000000 |
| Bouncer live incl. fallbacks (v3) | 24/30 (0.800, 0.627 to 0.905) | 0.778/0.538 | 2 | 0 | 0 | 0 | 444.7 (dev proxy) | $0.000361 (dev proxy) |

A section mismatch means the section does not match the verified rule section. The comparison uses exact section strings after whitespace and case normalization. Alternate valid formats and additional citations can also produce mismatches.

Run ledger: 45/50 attempts. B1 recorded 0 HTTP 429s, 2 HTTP 503s, 0 timeouts and 2 retries. A missing B1 answer counts as a wrong verdict.

Frozen live-mode rows: 23 live successes, 6 provider fallbacks, and 1 deterministic offline refusal.

B1 token coverage: 28/30 fully metered checks, 30/32 attempts with usable metadata, p95 630 tokens. Bouncer dev token coverage: 10/10 fully metered checks, 10/10 attempts with usable metadata, p95 474 tokens. Token and cost averages use only fully metered checks. Output includes thinking tokens.

List-price estimate; the demo runs on the free tier ($0). [Google Gemini pricing](https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite), accessed 2026-11-24.

The interrupted first worker left a pre-request checkpoint at v3-07. The resumed worker preserved completed replies and the same request configuration. The JSON and raw cache record both live harness revisions.

## What this does not show

The small synthetic sample cannot establish real-world accuracy. B1 received the same 12 rule titles and an extra other category. It received no verified sections or Bouncer logic. B2 uses the card-defined interpretation of [RCMP guidance](https://www.rcmp.ca/en/bc/safety-tips/frauds-and-scams/rental-scams); it emits no clauses, quotes or sections.

Frozen v3 token usage is unavailable. The Bouncer cost proxy uses ten separate dev listings and the unmodified current Flash-Lite adapter. It cannot establish historical v3 cost, production costs under provider failure, or the overhead of the rest of the app.

The three demo-sample checks are outside the 30-case comparison.

## Replay from the committed cache

Run `node --import tsx evals/run_baselines_v3.ts` from the repo root after installing dependencies. It regenerates this report, the metrics JSON and the sample export from the committed raw cache without network calls.
