# Post-v3 baseline comparison

Run date: 2026-11-24. n = 30 synthetic listings.
Harness SHA-256 (LF-normalized): 2c671a451e596a2de21ca3735764644be5b8519712fafb5ad6ff5518237b2818. Preregistration commit: 1c22017cdd1be2ab63b414a6193ca0d2e7951278. Preregistration SHA-256 (LF-normalized): 767da8bf259b7f8cb53905ed6282293d306689af65666d4101c949448c1746df.
Bouncer rows are the frozen v3 run at 9be1f86, not re-run.

| System | Verdict acc (Wilson 95%) | Violation P/R | Unsafe ADMIT | Quotes not in listing | Section mismatches (strict) | Section mismatches (normalized) | no_answer | Tokens per check (mean) | List-price cost per check |
|---|---|---|---|---|---|---|---|---|---|
| B2 checklist | 18/30 (0.600, 0.423 to 0.754) | n/a | 9 | 0 | 0 | 0 | 0 | 0 LLM | $0.000000 |
| B1 plain chatbot | 20/30 (0.667, 0.488 to 0.808) | 0.813/1.000 | 4 | 1 | 19 | 6 | 0 | 505.0 | $0.000196 |
| Bouncer offline (v3) | 23/30 (0.767, 0.591 to 0.882) | 1.000/0.385 | 4 | 0 | 0 | 0 | 0 | 0 LLM | $0.000000 |
| Bouncer live incl. fallbacks (v3) | 24/30 (0.800, 0.627 to 0.905) | 0.778/0.538 | 2 | 0 | 0 | 0 | 0 | 444.7 (dev proxy) | $0.000361 (dev proxy) |

B1 found all 13 labelled violations (recall 1.00) and had 1 quote absent from the listing. It had 19 strict and 6 normalized section mismatches. These counts measure agreement with the verified rule table.

The normalized matcher was added post-run after review found that strict matching over-counted citation mismatches. The B1 prompt and raw responses are unchanged.

The preregistered strict matcher compares the whole section string after case and whitespace normalization.

The normalized matcher checks each cited section against the selected rule's section list. A bare section number can match a listed subsection. When both specify a subsection, the cited detail must agree. Unqualified citations are read as RTA citations. Unknown rule categories count as mismatches under both methods.

### Remaining B1 citation mismatches

| Listing | Selected rule | Chatbot citation | Verified section |
|---|---|---|---|
| v3-18 | no_pets | Section 76 | s.14 |
| v3-28 | no_pets | Section 76 | s.14 |
| v3-30 | excess_rent_deposit | RTA s. 105 | s.106(2) |

The normalized total also includes 3 clauses for which B1 selected `other`, which has no corresponding section in the rule table.

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
