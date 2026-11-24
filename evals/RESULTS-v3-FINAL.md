# Final v3 held-out evaluation

One-shot evaluation of 30 synthetic Gemini-authored listings. Source frozen at `9be1f86f3ccad188f3512f82ef23fd28573272bf`; fixture-author commit `00819495c64523d516db29ba211941e535f991a4` (README status: done). No product code, rules, fixtures or labels changed after opening v3. This evidence does not establish real-world accuracy.

## Headline

All 30 cases count, including provider failures and deterministic refusals. Clause metrics are micro precision/recall over unique violation rule IDs per listing (void/questionable only). All-topics additionally includes `info_topics` and is secondary. Raw/verified share identical model responses; verdict/scam/clauses always use production verification.

| Mode | n | Live / fallback | Violation P / R | All-topic P / R | Field P / R | Fields exact | Scam AUC | Verdict accuracy | p50 / p95 ms |
|---|---:|---|---|---|---|---|---|---|---|
| offline | 30 | 0 / 0 | 1.000 / 0.385 | 0.594 / 0.594 | 0.708 / 0.652 | 75/115 | 0.933 | 0.767 | 3.255 / 26.684 |
| flash-lite | 30 | 23 / 6 | 0.778 / 0.538 | 0.595 / 0.688 | 0.935 / 0.878 | 101/115 | 1.000 | 0.800 | 3392.565 / 14018.460 |
| flash-lite+span-verify | 30 | 23 / 6 | 0.778 / 0.538 | 0.595 / 0.688 | 0.929 / 0.800 | 92/115 | 1.000 | 0.800 | 3392.565 / 14018.460 |

Lite counts comprise 23 live successes, six provider fallbacks (three timeouts, three HTTP 503), and one deterministic non-English refusal (mode=offline). Zero HTTP 429 responses occurred.

Latency excludes cache reads and pacing/backoff sleeps; primary latency is summed adapter request durations, not full user wall-clock latency. No prior cache was copied. Field precision uses correct / (correct + incorrect emitted annotated slots); recall uses correct / all annotated slots. Unannotated emissions are counted separately, never presumed fabricated.

## offline details

Scam confusion (positive at p >= threshold):

| Threshold | TP | FP | TN | FN |
|---|---:|---:|---:|---:|
| 0.3 | 3 | 2 | 24 | 1 |
| 0.7 | 2 | 1 | 25 | 2 |

Verdict confusion (rows expected, columns actual):

| Expected / actual | ADMIT | HOLD | REFUSE |
|---|---:|---:|---:|
| ADMIT | 12 | 2 | 0 |
| HOLD | 3 | 7 | 1 |
| REFUSE | 1 | 0 | 4 |

Violation confidence buckets (unique rule IDs per listing per bucket):

| Bucket | TP | FP | Precision |
|---|---:|---:|---:|
| asserted_ge_075 | 2 | 0 | 1.000 |
| review_lt_075 | 3 | 0 | 1.000 |

Errors: `{"timeouts": 0, "http429": 0, "http503": 0}`; retries 0; timeout rate 0.000.

Live-only subset (selection-biased; secondary): `{"n": 0, "clause": {"tp": 0, "fp": 0, "fn": 0, "precision": null, "recall": null}, "field_accuracy": null, "scam_auc": null, "verdict_accuracy": null}`.

Uncertain labels remain unchanged:

| ID | Uncertainty | Expected verdict / violations / info | Actual verdict / topics | Scam p |
|---|---|---|---|---|
| v3-15 | medium | REFUSE / - / - | REFUSE / sublet_consent | 0.309 |
| v3-26 | medium | HOLD / - / - | HOLD / sublet_consent | 0.128 |
| v3-30 | medium | HOLD / deposit_interest / sublet_consent, standard_lease | REFUSE / standard_lease, sublet_consent | 0.720 |

## flash-lite+span-verify details

Scam confusion (positive at p >= threshold):

| Threshold | TP | FP | TN | FN |
|---|---:|---:|---:|---:|
| 0.3 | 4 | 2 | 24 | 0 |
| 0.7 | 4 | 1 | 25 | 0 |

Verdict confusion (rows expected, columns actual):

| Expected / actual | ADMIT | HOLD | REFUSE |
|---|---:|---:|---:|
| ADMIT | 11 | 3 | 0 |
| HOLD | 2 | 8 | 1 |
| REFUSE | 0 | 0 | 5 |

Violation confidence buckets (unique rule IDs per listing per bucket):

| Bucket | TP | FP | Precision |
|---|---:|---:|---:|
| asserted_ge_075 | 2 | 0 | 1.000 |
| review_lt_075 | 5 | 2 | 0.714 |

Errors: `{"timeouts": 3, "http429": 0, "http503": 3}`; retries 0; timeout rate 0.100.

Live-only subset (selection-biased; secondary): `{"n": 23, "clause": {"tp": 7, "fp": 2, "fn": 5, "precision": 0.7777777777777778, "recall": 0.5833333333333334}, "field_accuracy": 0.8390804597701149, "scam_auc": 1, "verdict_accuracy": 0.8260869565217391}`.

Uncertain labels remain unchanged:

| ID | Uncertainty | Expected verdict / violations / info | Actual verdict / topics | Scam p |
|---|---|---|---|---|
| v3-15 | medium | REFUSE / - / - | REFUSE / sublet_consent, damage_deposit | 0.893 |
| v3-26 | medium | HOLD / - / - | HOLD / sublet_consent | 0.128 |
| v3-30 | medium | HOLD / deposit_interest / sublet_consent, standard_lease | REFUSE / standard_lease, sublet_consent | 0.720 |

## Verification safety

Computed only on paired successful live extractions. Synthetic corruption replaces one value and evidence span with fabricated content; it measures rejection of that construction, not real-world hallucination prevalence. Natural fabricated-span counts identify missing/absent quotes, not every possible semantic error.

```json
{
  "paired_items": 23,
  "fabricated_spans": 2,
  "fabricated_spans_rejected": 2,
  "correct_values_dropped": 7,
  "trials": 23,
  "raw_detected": 0,
  "verified_detected": 23,
  "raw_detection_rate": 0,
  "verified_detection_rate": 1
}
```

## Repeat consistency

First five sorted v3 cases, three additional independent calls each; identical normalized fields, clause IDs and verdict required. No cherry-picking or retries of completed outputs.

```json
{
  "status": "complete",
  "runs_recorded": 15,
  "failed_runs": 3,
  "consistent_cases": 2,
  "requested_cases": 5,
  "runs_per_case": 3
}
```

| Case | Recorded | Failed | Consistent |
|---|---:|---:|---|
| v3-01 | 3 | 1 | False |
| v3-02 | 3 | 1 | False |
| v3-03 | 3 | 0 | True |
| v3-04 | 3 | 0 | True |
| v3-05 | 3 | 1 | False |

All HTTP response statuses across main and repeat calls (including recovered errors): `{"200": 36, "503": 4}`. Main and repeat per-attempt errors/timing remain in JSON.

## Evaluation history

Different datasets, clause scopes and source versions make these descriptive history, not a paired improvement experiment. DEV replays reuse saved model responses; they are not new live runs.

| Stage | Split / mode | Violation P / R (unless stated) | Verified fields | Verdict correct | Disclosure |
|---|---|---|---|---|---|
| v1 baseline | v1 24; Lite / offline | .706/.545 all-topics, original report | See original report | 12/24 both | Lead examples contaminated v1 after C2b; development evidence only |
| v2 final @30126e1 | v2 30; Lite / offline | .348/.889 / .500/.111 | 43/117 / 28/117 | 13/30 both | Held-out at run time, subsequently used for development |
| C2d general precision | v2 DEV saved replay / offline | .636/.778 / 1.000/.111 | 73/117 / 61/117 | 17/30 / 15/30 | Root HANDOFF; saved replay 26 responses, remaining offline |
| C2e policy | v2 DEV saved replay / offline | .636/.778 / 1.000/.111 | 73/117 / 61/117 | 25/30 / 18/30 | Root HANDOFF; reused development labels |
| C2f deposit gate / coverage | v2 DEV saved replay / offline | .750/.667 / 1.000/.111 | 73/117 / 61/117 | 25/30 / 18/30 | core/HANDOFF; v2 TP fell 7 to 6; development only |
| v3 held-out @9be1f86 | v3 30; offline | 1.000 / 0.385 | 75/115 | 23/30 | One-shot final; Gemini cross-family author |
| v3 held-out @9be1f86 | v3 30; flash-lite+span-verify | 0.778 / 0.538 | 92/115 | 24/30 | One-shot final; Gemini cross-family author |

Gold was synthetic and authored by the rule author (author-overlap bias). V1 was contaminated by lead examples, including “no furry friends” and “held against breakages”; it is not evidence of generalization after those examples entered development. V2 was used for development after its original run. V3 author reports no reads of product/rules/training/earlier evals; v3 was opened only after the source freeze. Labels are author judgments, including the itemized uncertain cases, not independently adjudicated legal ground truth.

## Reproduction and harness delta

Create a detached clean worktree at `9be1f86`, copy only `evals/run_eval_v3.ts` from this results commit, supply an ignored `.env` with GEMINI_API_KEY, run `npm ci`, then `npx tsx evals/run_eval_v3.ts`. Do not copy a prior cache for a new live run. This reproduces the procedure, not deterministic provider responses. JSON contains all raw extractions, paired verified fields, decisions, errors, HTTP statuses, repeat signatures, source and fixture SHA-256 hashes. Markdown is the curated readout of that JSON.

The adapted harness retains `run_eval.ts` request/retry logic, metric helpers, production analyze path and first-five x three repeat design. Changes: v3-only routing; v3 `clauses` violations plus `info_topics` secondary; uncertainty from non-low fixture labels; verdict matrix; confidence-bucket precision; 7s minimum pacing; HTTP status instrumentation; repeat attempts/latency retained; v3 JSON destination and complete provenance hashes. Flash comparison disabled; primary and fallback pinned to `gemini-3.1-flash-lite`. HTTP 429 retryDelay is honored, with deferral above 120 seconds; at most three retries. No engine, prompt, rule, model-weight or label changes. The original runner stays unchanged. The adapted harness was completed and hashed before any evaluation metrics/per-item results were examined.

Harness SHA-256: `64773be1939bb0fee4dbac7e14c93085281ea316d70161c2abe0babc96aeca83`. Adapter SHA-256: `ce1bb9cfab080f1bdb74b26ef43ac21b8cf7e2342b53e9f7cfec5a21828dfe7f`. Full source/fixture hashes: `results-v3-final.json` → `source_hashes` / `fixture_hashes`.

## Verification and handoff

- L3 eval owner; skills validate-data (provenance/calculation checks) and karpathy-guidelines (harness-only scope).
- Clean frozen worktree: npm ci, 160 tests passed / 1 optional skipped, root strict typecheck and production build passed; adapted eval strict Bundler typecheck passed.
- Independent Python set arithmetic checked every variant violation TP/FP/FN and verdict accuracy; all 3x3 matrices reconcile to row counts; source, fixture and harness hashes verified.
- One-shot source/rules/data/labels remain frozen; only runner/report/JSON delivered.
- Synthetic small sample; provider failures and uncertain judgments limit interpretation; no post-v3 tuning authorized.
