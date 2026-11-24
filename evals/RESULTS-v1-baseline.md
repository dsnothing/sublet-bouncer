# v1 baseline eval results

Frozen before redesign. rt-01..24 will become development data; a future blind v2 split is required for final claims.

Generated 2026-11-24T09:48:13.851Z. Synthetic held-out gold; no real-world accuracy claim.

## offline

### Independent redteam (headline)

Cases: 24; live successes: 0; fallbacks: 0; timeout rate: 0.

Clause precision/recall: 0.706 / 0.545; field accuracy: 0.382 (26/68); scam AUC: 0.730; verdict accuracy: 0.500.

Latency p50/p95 ms (uncached): 1.0902999999999565 / 6.299500000000023.

Recorded network p50/p95 ms: n/a / n/a.

Confusion: `[{"threshold":0.3,"tp":2,"fp":0,"tn":21,"fn":1},{"threshold":0.7,"tp":1,"fp":0,"tn":21,"fn":2}]`.

### Gold (rule-author overlap)

Cases: 40; live successes: 0; fallbacks: 0; timeout rate: 0.

Clause precision/recall: 1.000 / 1.000; field accuracy: 1.000 (138/138); scam AUC: 1.000; verdict accuracy: 0.950.

Latency p50/p95 ms (uncached): 0.6494999999999891 / 1.081199999999967.

Recorded network p50/p95 ms: n/a / n/a.

Confusion: `[{"threshold":0.3,"tp":8,"fp":0,"tn":32,"fn":0},{"threshold":0.7,"tp":8,"fp":0,"tn":32,"fn":0}]`.

Live-only pooled metrics: `{"n":0,"timeout_rate":null,"fallback_rate":null,"live_successes":0,"fallbacks":0,"clause":{"tp":0,"fp":0,"fn":0,"precision":null,"recall":null},"field_accuracy":null,"field_correct":0,"field_total":0,"scam_auc":null,"confusion":[{"threshold":0.3,"tp":0,"fp":0,"tn":0,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":0,"fn":0}],"verdict_accuracy":null,"latency_ms":{"p50":null,"p95":null,"uncached_n":0,"recorded_network_p50":null,"recorded_network_p95":null,"recorded_network_n":0},"errors":[]}`.

## flash-lite

### Independent redteam (headline)

Cases: 24; live successes: 18; fallbacks: 5; timeout rate: 0.20833333333333334.

Clause precision/recall: 0.706 / 0.545; field accuracy: 0.853 (58/68); scam AUC: 0.730; verdict accuracy: 0.500.

Latency p50/p95 ms (uncached): 5036.485400000005 / 12010.1495.

Recorded network p50/p95 ms: 5036.485400000005 / 12010.1495.

Confusion: `[{"threshold":0.3,"tp":2,"fp":0,"tn":21,"fn":1},{"threshold":0.7,"tp":1,"fp":0,"tn":21,"fn":2}]`.

### Gold (rule-author overlap)

Cases: 40; live successes: 26; fallbacks: 13; timeout rate: 0.225.

Clause precision/recall: 1.000 / 1.000; field accuracy: 0.877 (121/138); scam AUC: 1.000; verdict accuracy: 0.750.

Latency p50/p95 ms (uncached): 5765.88619999995 / 12014.963600000017.

Recorded network p50/p95 ms: 4968.964100000041 / 12014.01509999996.

Confusion: `[{"threshold":0.3,"tp":8,"fp":0,"tn":32,"fn":0},{"threshold":0.7,"tp":8,"fp":0,"tn":32,"fn":0}]`.

Live-only pooled metrics: `{"n":44,"timeout_rate":0,"fallback_rate":0,"live_successes":44,"fallbacks":0,"clause":{"tp":22,"fp":3,"fn":6,"precision":0.88,"recall":0.7857142857142857},"field_accuracy":0.8819444444444444,"field_correct":127,"field_total":144,"scam_auc":0.9385964912280702,"confusion":[{"threshold":0.3,"tp":5,"fp":0,"tn":38,"fn":1},{"threshold":0.7,"tp":4,"fp":0,"tn":38,"fn":2}],"verdict_accuracy":0.5454545454545454,"latency_ms":{"p50":4594.274399999998,"p95":9662.115699999995,"uncached_n":35,"recorded_network_p50":4417.536900000006,"recorded_network_p95":9624.636999999995,"recorded_network_n":44},"errors":[]}`.

## flash

**Unavailable model comparison:** Gemini HTTP 429. Only fallback evidence exists; remaining cases were not attempted.

### Independent redteam (headline)

Cases: 1; live successes: 0; fallbacks: 1; timeout rate: 0.

Clause precision/recall: 1.000 / 1.000; field accuracy: 0.333 (1/3); scam AUC: n/a; verdict accuracy: 0.000.

Latency p50/p95 ms (uncached): 171.6478000000352 / 171.6478000000352.

Recorded network p50/p95 ms: 171.6478000000352 / 171.6478000000352.

Confusion: `[{"threshold":0.3,"tp":0,"fp":0,"tn":1,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":1,"fn":0}]`.

### Gold (rule-author overlap)

Cases: 0; live successes: 0; fallbacks: 0; timeout rate: n/a.

Clause precision/recall: n/a / n/a; field accuracy: n/a (0/0); scam AUC: n/a; verdict accuracy: n/a.

Latency p50/p95 ms (uncached): n/a / n/a.

Recorded network p50/p95 ms: n/a / n/a.

Confusion: `[{"threshold":0.3,"tp":0,"fp":0,"tn":0,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":0,"fn":0}]`.

Live-only pooled metrics: `{"n":0,"timeout_rate":null,"fallback_rate":null,"live_successes":0,"fallbacks":0,"clause":{"tp":0,"fp":0,"fn":0,"precision":null,"recall":null},"field_accuracy":null,"field_correct":0,"field_total":0,"scam_auc":null,"confusion":[{"threshold":0.3,"tp":0,"fp":0,"tn":0,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":0,"fn":0}],"verdict_accuracy":null,"latency_ms":{"p50":null,"p95":null,"uncached_n":0,"recorded_network_p50":null,"recorded_network_p95":null,"recorded_network_n":0},"errors":[]}`.

## flash+span-verify

**Unavailable model comparison:** Gemini HTTP 429. Only fallback evidence exists; remaining cases were not attempted.

### Independent redteam (headline)

Cases: 1; live successes: 0; fallbacks: 1; timeout rate: 0.

Clause precision/recall: 1.000 / 1.000; field accuracy: 0.333 (1/3); scam AUC: n/a; verdict accuracy: 0.000.

Latency p50/p95 ms (uncached): 171.6478000000352 / 171.6478000000352.

Recorded network p50/p95 ms: 171.6478000000352 / 171.6478000000352.

Confusion: `[{"threshold":0.3,"tp":0,"fp":0,"tn":1,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":1,"fn":0}]`.

### Gold (rule-author overlap)

Cases: 0; live successes: 0; fallbacks: 0; timeout rate: n/a.

Clause precision/recall: n/a / n/a; field accuracy: n/a (0/0); scam AUC: n/a; verdict accuracy: n/a.

Latency p50/p95 ms (uncached): n/a / n/a.

Recorded network p50/p95 ms: n/a / n/a.

Confusion: `[{"threshold":0.3,"tp":0,"fp":0,"tn":0,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":0,"fn":0}]`.

Live-only pooled metrics: `{"n":0,"timeout_rate":null,"fallback_rate":null,"live_successes":0,"fallbacks":0,"clause":{"tp":0,"fp":0,"fn":0,"precision":null,"recall":null},"field_accuracy":null,"field_correct":0,"field_total":0,"scam_auc":null,"confusion":[{"threshold":0.3,"tp":0,"fp":0,"tn":0,"fn":0},{"threshold":0.7,"tp":0,"fp":0,"tn":0,"fn":0}],"verdict_accuracy":null,"latency_ms":{"p50":null,"p95":null,"uncached_n":0,"recorded_network_p50":null,"recorded_network_p95":null,"recorded_network_n":0},"errors":[]}`.

## Repeat consistency

```json
{
  "status": "partial",
  "cases": [
    {
      "id": "gold-01",
      "runs": [
        {
          "signature": "{\"fields\":{\"address\":\"250 Lester Street\",\"dates\":\"January 1 to April 30 2027\",\"owner_lives_in\":false,\"rent\":950,\"utilities\":\"included\",\"viewing_offered\":true},\"clauses\":[],\"verdict\":\"ADMIT\"}",
          "mode": "live",
          "cached": false
        },
        {
          "signature": "{\"fields\":{\"address\":\"250 Lester Street\",\"dates\":\"January 1 to April 30 2027\",\"owner_lives_in\":false,\"rent\":950,\"utilities\":\"included\",\"viewing_offered\":true},\"clauses\":[],\"verdict\":\"ADMIT\"}",
          "mode": "live",
          "cached": false
        },
        {
          "error": "Gemini HTTP 429"
        }
      ],
      "consistent": false
    }
  ],
  "consistent_cases": 0,
  "requested_cases": 5,
  "runs_per_case": 3
}
```

## Rubric cases

```json
[
  {
    "id": "gold-01",
    "kind": "ordinary",
    "expected": "ADMIT",
    "actual": "ADMIT",
    "pass": true
  },
  {
    "id": "gold-02",
    "kind": "ordinary",
    "expected": "ADMIT",
    "actual": "ADMIT",
    "pass": true
  },
  {
    "id": "gold-40",
    "kind": "demanding",
    "expected": "REFUSE",
    "actual": "REFUSE",
    "pass": true
  },
  {
    "kind": "repeat",
    "status": "partial",
    "cases": [
      {
        "id": "gold-01",
        "runs": [
          {
            "signature": "{\"fields\":{\"address\":\"250 Lester Street\",\"dates\":\"January 1 to April 30 2027\",\"owner_lives_in\":false,\"rent\":950,\"utilities\":\"included\",\"viewing_offered\":true},\"clauses\":[],\"verdict\":\"ADMIT\"}",
            "mode": "live",
            "cached": false
          },
          {
            "signature": "{\"fields\":{\"address\":\"250 Lester Street\",\"dates\":\"January 1 to April 30 2027\",\"owner_lives_in\":false,\"rent\":950,\"utilities\":\"included\",\"viewing_offered\":true},\"clauses\":[],\"verdict\":\"ADMIT\"}",
            "mode": "live",
            "cached": false
          },
          {
            "error": "Gemini HTTP 429"
          }
        ],
        "consistent": false
      }
    ],
    "consistent_cases": 0,
    "requested_cases": 5,
    "runs_per_case": 3
  }
]
```

## Method and limitations

- Gold is synthetic, separate from training templates, but authored by the rule author (author-overlap bias). Redteam is independently authored and the headline split. Neither establishes real-world performance.
- Clause scoring is rule-id set micro precision/recall including informational lessons. Field accuracy is exact normalized match on annotated field slots only; missing fields are wrong.
- flash and flash+span-verify use paired identical raw responses: raw versus verifyExtraction field accuracy. Production analyze always enforces span verification for verdict/scam/clause metrics.
- Cached latency is excluded. Live HTTP failures are reported separately; fallback results are never counted as model success.
- Current GRT schedule is a proxy for Winter 2027; CMHC means and room proxy are documented in DATA-SOURCES.md.
- Flash comparison and repeat consistency are unavailable: HTTP 429 on the first attempted Flash/repeat request. Flash Lite completed all 64 cases: 44 live analyses, 18 fallbacks (14 timeouts, 4 HTTP 503), and 2 deterministic language refusals.
