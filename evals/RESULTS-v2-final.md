# Eval results

Generated 2026-11-24T10:17:27.494Z. Synthetic held-out gold; no real-world accuracy claim.

Frozen source: `30126e18169f248b16715e6b11f4b56c701c856f`. Primary: gemini-3.1-flash-lite. All 30 headline cases retain failed requests as offline fallbacks.

## offline

### Independent redteam (headline)

Cases: 30; live successes: 0; fallbacks: 0; retries: 0; timeout rate: 0.

Violation clause precision/recall: 0.500 / 0.111; all-topics P/R: 0.926 / 0.610; field accuracy: 0.239 (28/117); scam AUC: 0.914; verdict accuracy: 0.433.

Latency p50/p95 ms (uncached): 1.470700000000079 / 7.518899999999917.

Recorded network p50/p95 ms: n/a / n/a.

Confusion: `[{"threshold":0.3,"tp":0,"fp":1,"tn":26,"fn":3},{"threshold":0.7,"tp":0,"fp":1,"tn":26,"fn":3}]`.

Live-only pooled metrics: `{"n":0,"clause":{"tp":0,"fp":0,"fn":0,"precision":null,"recall":null},"all_topics":{"tp":0,"fp":0,"fn":0,"precision":null,"recall":null},"field_accuracy":null,"scam_auc":null,"verdict_accuracy":null}`.

## flash-lite

### Independent redteam (headline)

Cases: 30; live successes: 26; fallbacks: 4; retries: 0; timeout rate: 0.06666666666666667.

Violation clause precision/recall: 0.348 / 0.889; all-topics P/R: 0.685 / 0.902; field accuracy: 0.607 (71/117); scam AUC: 0.951; verdict accuracy: 0.433.

Latency p50/p95 ms (uncached): 3401.395999999979 / 14004.49470000001.

Recorded network p50/p95 ms: 3401.395999999979 / 14004.49470000001.

Confusion: `[{"threshold":0.3,"tp":2,"fp":3,"tn":24,"fn":1},{"threshold":0.7,"tp":2,"fp":2,"tn":25,"fn":1}]`.

Live-only pooled metrics: `{"n":26,"clause":{"tp":8,"fp":15,"fn":0,"precision":0.34782608695652173,"recall":1},"all_topics":{"tp":34,"fp":17,"fn":2,"precision":0.6666666666666666,"recall":0.9444444444444444},"field_accuracy":0.6633663366336634,"scam_auc":0.9420289855072463,"verdict_accuracy":0.4230769230769231}`.

## flash-lite+span-verify

### Independent redteam (headline)

Cases: 30; live successes: 26; fallbacks: 4; retries: 0; timeout rate: 0.06666666666666667.

Violation clause precision/recall: 0.348 / 0.889; all-topics P/R: 0.685 / 0.902; field accuracy: 0.368 (43/117); scam AUC: 0.951; verdict accuracy: 0.433.

Latency p50/p95 ms (uncached): 3401.395999999979 / 14004.49470000001.

Recorded network p50/p95 ms: 3401.395999999979 / 14004.49470000001.

Confusion: `[{"threshold":0.3,"tp":2,"fp":3,"tn":24,"fn":1},{"threshold":0.7,"tp":2,"fp":2,"tn":25,"fn":1}]`.

Live-only pooled metrics: `{"n":26,"clause":{"tp":8,"fp":15,"fn":0,"precision":0.34782608695652173,"recall":1},"all_topics":{"tp":34,"fp":17,"fn":2,"precision":0.6666666666666666,"recall":0.9444444444444444},"field_accuracy":0.38613861386138615,"scam_auc":0.9420289855072463,"verdict_accuracy":0.4230769230769231}`.

## flash

Status: deferred. daily free-tier quota; advertised retryDelay 78912s on v1 resume; no Flash calls made

## flash+span-verify

Status: deferred. no completed Flash ablation

## Lead-example phrase sensitivity

```json
{
  "phrases": [
    "no furry friends",
    "held against breakages"
  ],
  "v2_listings_with_phrase": [],
  "variants": {
    "offline": {
      "matched_clause_listing_ids": []
    },
    "flash-lite": {
      "matched_clause_listing_ids": []
    },
    "flash-lite+span-verify": {
      "matched_clause_listing_ids": []
    }
  },
  "exclusive_dependency_count": 0,
  "method": "Normalized literal phrase presence and verified matched-clause spans; no v2 listing contains either phrase, so exclusive dependency count is zero."
}
```

## Disputed-label cases (labels unchanged)

| Case | Expected | Offline | Lite | Expected topics | Lite topics | Scam p |
|---|---|---|---|---|---|---|
| v2-06 | ADMIT | HOLD | HOLD | sublet_consent | sublet_consent | 0.089 |
| v2-20 | HOLD | HOLD | HOLD | key_deposit, sublet_consent | sublet_consent, key_deposit | 0.083 |
| v2-21 | HOLD | HOLD | HOLD | deposit_interest, sublet_consent | sublet_consent, damage_deposit, deposit_interest | 0.078 |
| v2-22 | HOLD | HOLD | HOLD | sublet_consent | sublet_consent, postdated_cheques | 0.088 |
| v2-26 | HOLD | REFUSE | REFUSE | sublet_consent | sublet_consent | 0.809 |
| v2-27 | HOLD | HOLD | HOLD | sublet_consent | sublet_consent | 0.202 |
| v2-14 | REFUSE | HOLD | HOLD | sublet_consent | sublet_consent | 0.062 |

Full per-item fields and spans are retained in results.json.

## Repeat consistency

```json
{
  "status": "complete",
  "runs_recorded": 15,
  "failed_runs": 3,
  "cases": [
    {
      "id": "v2-01",
      "runs": [
        {
          "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false,
          "preserved": true
        },
        {
          "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false,
          "preserved": true
        },
        {
          "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false,
          "preserved": true
        }
      ],
      "consistent": true
    },
    {
      "id": "v2-02",
      "runs": [
        {
          "signature": "{\"fields\":{\"address\":\"205 University Ave W\",\"rent\":1650},\"clauses\":[\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false,
          "preserved": true
        },
        {
          "error": "Gemini attempt timeout",
          "preserved": true
        },
        {
          "signature": "{\"fields\":{\"address\":\"205 University Ave W\",\"rent\":1650},\"clauses\":[\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        }
      ],
      "consistent": false
    },
    {
      "id": "v2-03",
      "runs": [
        {
          "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        },
        {
          "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        },
        {
          "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        }
      ],
      "consistent": true
    },
    {
      "id": "v2-04",
      "runs": [
        {
          "signature": "{\"fields\":{\"address\":\"77 Weber St N\",\"rent\":760},\"clauses\":[\"standard_lease\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        },
        {
          "error": "Gemini HTTP 503"
        },
        {
          "signature": "{\"fields\":{\"address\":\"77 Weber St N\",\"rent\":760},\"clauses\":[\"standard_lease\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        }
      ],
      "consistent": false
    },
    {
      "id": "v2-05",
      "runs": [
        {
          "error": "Gemini HTTP 503"
        },
        {
          "signature": "{\"fields\":{\"address\":\"318 Victoria St N, Kitchener\",\"rent\":1200},\"clauses\":[\"standard_lease\",\"sublet_consent\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        },
        {
          "signature": "{\"fields\":{\"address\":\"318 Victoria St N, Kitchener\",\"rent\":1200},\"clauses\":[\"standard_lease\",\"sublet_consent\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
          "mode": "live",
          "cached": false
        }
      ],
      "consistent": false
    }
  ],
  "consistent_cases": 2,
  "requested_cases": 5,
  "runs_per_case": 3
}
```

## Rubric cases

```json
[
  {
    "id": "v2-01",
    "kind": "ordinary",
    "expected": "ADMIT",
    "actual": "ADMIT",
    "pass": true
  },
  {
    "id": "v2-02",
    "kind": "ordinary",
    "expected": "ADMIT",
    "actual": "HOLD",
    "pass": false
  },
  {
    "id": "v2-30",
    "kind": "demanding",
    "expected": "HOLD",
    "actual": "HOLD",
    "pass": true
  },
  {
    "kind": "repeat",
    "status": "complete",
    "runs_recorded": 15,
    "failed_runs": 3,
    "cases": [
      {
        "id": "v2-01",
        "runs": [
          {
            "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false,
            "preserved": true
          },
          {
            "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false,
            "preserved": true
          },
          {
            "signature": "{\"fields\":{\"address\":\"412 Lester St, Waterloo\",\"rent\":725,\"risky_payment_method\":true},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false,
            "preserved": true
          }
        ],
        "consistent": true
      },
      {
        "id": "v2-02",
        "runs": [
          {
            "signature": "{\"fields\":{\"address\":\"205 University Ave W\",\"rent\":1650},\"clauses\":[\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false,
            "preserved": true
          },
          {
            "error": "Gemini attempt timeout",
            "preserved": true
          },
          {
            "signature": "{\"fields\":{\"address\":\"205 University Ave W\",\"rent\":1650},\"clauses\":[\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          }
        ],
        "consistent": false
      },
      {
        "id": "v2-03",
        "runs": [
          {
            "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          },
          {
            "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          },
          {
            "signature": "{\"fields\":{\"address\":\"188 Phillip St Waterloo\",\"rent\":850},\"clauses\":[\"postdated_cheques\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          }
        ],
        "consistent": true
      },
      {
        "id": "v2-04",
        "runs": [
          {
            "signature": "{\"fields\":{\"address\":\"77 Weber St N\",\"rent\":760},\"clauses\":[\"standard_lease\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          },
          {
            "error": "Gemini HTTP 503"
          },
          {
            "signature": "{\"fields\":{\"address\":\"77 Weber St N\",\"rent\":760},\"clauses\":[\"standard_lease\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          }
        ],
        "consistent": false
      },
      {
        "id": "v2-05",
        "runs": [
          {
            "error": "Gemini HTTP 503"
          },
          {
            "signature": "{\"fields\":{\"address\":\"318 Victoria St N, Kitchener\",\"rent\":1200},\"clauses\":[\"standard_lease\",\"sublet_consent\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          },
          {
            "signature": "{\"fields\":{\"address\":\"318 Victoria St N, Kitchener\",\"rent\":1200},\"clauses\":[\"standard_lease\",\"sublet_consent\",\"sublet_consent\",\"sublet_consent\"],\"verdict\":\"HOLD\"}",
            "mode": "live",
            "cached": false
          }
        ],
        "consistent": false
      }
    ],
    "consistent_cases": 2,
    "requested_cases": 5,
    "runs_per_case": 3
  }
]
```

## Method and limitations

- Gold is synthetic, separate from training templates, but authored by the rule author (author-overlap bias). Redteam is independently authored and the headline split. Neither establishes real-world performance.
- Headline clause scoring is rule-id set micro precision/recall restricted to rule-table void/questionable ids. All-topics P/R is secondary. Uncertain v2 labels are reported per item, unchanged. Field accuracy is exact normalized match on annotated field slots only; missing fields are wrong.
- flash and flash+span-verify use paired identical raw responses: raw versus verifyExtraction field accuracy. Production analyze always enforces span verification for verdict/scam/clause metrics.
- Cached latency is excluded. Live HTTP failures are reported separately; fallback results are never counted as model success.
- Current GRT schedule is a proxy for Winter 2027; CMHC means and room proxy are documented in DATA-SOURCES.md.
- Redteam-v1 is a dev set (contaminated by lead examples): the C2b card quoted "pls no furry friends" and "$400 held against breakages", and fuzzy patterns incorporated those phrases. No v1-after-C2b result is evidence of generalization. Redteam-v2 is the clean headline.
