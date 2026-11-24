# Data sources and reproduction

Retrieved 2026-11-24. C3 role: Codex L3 data/evals; skills: karpathy-guidelines (scope and reproducibility), systematic-debugging (trace integration failures). Capability gaps: `rg` absent; PowerShell search used. Python standard library and Node/npm are available. No UI work.

## Ontario legislation

`data/rta_rules.json` contains 12 rules. Every legal section used has an exact whitespace-normalized excerpt in [RTA-VERIFICATION.md](../data/RTA-VERIFICATION.md), checked by `python scripts/build_rules.py` against official e-Laws document text:

- [Residential Tenancies Act, 2006](https://www.ontario.ca/laws/statute/06r17), [document API](https://www.ontario.ca/laws/api/v2/legislation/en/doc-search/statute/06r17).
- [O. Reg. 516/06](https://www.ontario.ca/laws/regulation/060516), [document API](https://www.ontario.ca/laws/api/v2/legislation/en/doc-search/regulation/060516).

The HTML shell requires JavaScript; the official document API provides the underlying legislative HTML. No secondary source is used to validate a section. Cached downloads live in ignored `scripts/.cache/`. The verifier fails closed on changed text. Review a changed consolidation before updating excerpts. Rule matching is a screening heuristic: negation, voluntary payments, statutory exceptions, condominium rules, animal conduct, and applicability need contextual review. Shared owner kitchen/bath is an informational rule; D5 determines the policy consequence. Informational sublet/standard-lease/key-deposit lessons are included in clause eval labels.

## CMHC rents

Source: [Statistics Canada table 34-10-0133-01, CMHC average rents](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301), [full CSV](https://www150.statcan.gc.ca/n1/tbl/csv/34100133-eng.zip). Geography exactly `Kitchener-Cambridge-Waterloo, Ontario`; reference 2025; structure `Row and apartment structures of three units and over`:

| Type | Monthly CAD mean | Vector |
|---|---:|---|
| Bachelor | 1,255 | v3822819 |
| One bedroom | 1,546 | v3822953 |
| Two bedrooms | 1,816 | v3823087 |
| Room proxy | 908 | Derived: two-bedroom mean divided by two |

These are **means**, not medians. The contract key `median_monthly` is retained for compatibility and `statistic: mean` records its meaning. Room rents are not published in this table; 908 is an explicit proxy, not a measured room rent or current asking price. The selected structure differs from apartment-only and six-plus-unit series; do not mix them. Rebuild with `python scripts/build_benchmarks.py`. Public CMHC RMS data distributed by Statistics Canada, under the Statistics Canada Open Licence. No 2026 forecast replaces observed rents.

## GRT scheduled commute

[Official GRT open data page](https://www.grt.ca/about-grt/open-data/) links to the [Region feed publisher](https://webapps.regionofwaterloo.ca/api/grt-routes/). Static feeds: [bus](https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1), [LRT](https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/2). Region of Waterloo Open Data Licence applies. Input ZIP SHA-256 hashes and campus coordinates are in `data/transit_provenance.json`; input ZIPs are ignored local cache files.

Run `npx tsx scripts/build_commute_table.ts` (calls Python 3 standard library). Service date 2026-11-24 (Tuesday), America/Toronto, departure **07:00**. The feed enumerates active services using `calendar_dates.txt`; both current feeds have no `calendar.txt`. Trips are grouped and ordered by stop sequence; pickup/drop-off restrictions are honored. Two vehicle rounds permit **at most one transfer**; access/egress walking is capped at 600m, transfer walking at 250m. Earliest arrival by 08:30 is compared against direct walking. Null means no qualifying arrival, not a guessed route. The output uses 150 spatially spread real stop coordinates near Waterloo/Kitchener housing. UW destination is the Davis Centre coordinate; WLU is the campus coordinate. Distances are haversine and walking is 80m/min.

Limitations: walking is **straight-line**, without street connectivity, crossings, signals, snow, accessibility or barriers; same-stop transfers have zero minimum buffer. This is a scheduled estimate, not live service or a guaranteed itinerary. 07:00 is the fixed earliest departure, not a latest-departure optimization. The Nov 2026 feed is a **current-term proxy for Winter 2027**, not verified January service. Rebuild when the winter feed is published. The core adds geocode-to-origin walk time; address matching remains approximate.

## OSM geocodes

Run `npx tsx scripts/build_geocode_cache.ts`. Source: [Nominatim Search API](https://nominatim.openstreetmap.org/search), [usage policy](https://operations.osmfoundation.org/policies/nominatim/). User-Agent `sublet-bouncer-dev`, at least 1.1 seconds between uncached requests; persisted responses avoid repeated requests. OSM contributors, ODbL attribution applies. Sixteen successful local results cover Columbia, King N, Lester, Sunview, Hickory, Phillip, Albert, Regina, Ezra, Bricker, Erb, Westmount, University, Icon, Sage and WLU. The Davis Centre Nominatim search returned no match and was dropped; the transit destination coordinate is documented separately. Street-named results (including Icon/Sage address queries) use confidence 0.8; other named places use 0.9. These are **not verified civic addresses**. Out-of-region results are rejected. Unknown addresses must escalate; do not infer coordinates from unrecognized names.

## Synthetic scam model and gold set

`npx tsx scripts/gen_training.ts` creates 200 seeded synthetic examples (100 scam, 100 non-scam), seed 33817. `npx tsx scripts/train_scam_model.ts` imports **core.computeFeatures**, standardizes all 12 features, and fits logistic regression (2,500 full-batch iterations, step .05, L2 .02). Weights, normalization, thresholds and calibration limitations are serialized in `data/scam_model.json`. Feature design is informed by the [RCMP rental scam advisory](https://www.rcmp.ca/en/bc/safety-tips/frauds-and-scams/rental-scams) (deposit-before-viewing, low rent, identity requests, duplicates, absent landlord) and [CAFC service fraud guidance](https://centreantifraude.ca/scams-fraudes/service-eng.htm) (urgency and identity requests; not a rental-specific dataset). No CAFC records train the model. The model is **uncalibrated**, synthetic-only, and does not estimate validated real-world probabilities.

`python scripts/build_gold.py` emits 40 independently authored synthetic fixtures: 15 clean, 15 scam/illegal and 10 tricky. They share no full listing text with training templates. Illegal does not automatically mean scam: several illegal-clause fixtures have scam=0. No training metric is presented as held-out performance. The gold set is small and intentionally constructed around known features; perfect scores do not imply generalization. Labels cover selected field slots; field accuracy is not a complete extraction audit.

## Evals

Run `npm run eval` after `npm install`. `-- --offline` skips live calls. The harness reads `GEMINI_API_KEY` from environment, repository `.env`, then parent `.env`; never prints it. Models: `gemini-3.1-flash-lite` versus `gemini-3-flash-preview` (lead-approved replacement of unavailable 2.5 models). Temperature zero, structured response schema, 12s timeout; delay defaults to 7s between uncached calls (`EVAL_THROTTLE_MS`). The production adapter uses Gemini 3 minimal thinking. Successful responses only are cached in ignored `evals/cache/`; repeat trials use separate cache keys for three independent calls per case. Remove those cache files to conduct a new repeat experiment.

`evals/results.json` stores row-level evidence and metrics. `evals/RESULTS.md` is generated from it. Raw Flash versus span-verified Flash compares the **same response**, isolating the extraction check. Production `analyze` verifies spans in all live variants; end-to-end policy metrics are therefore not an unsafe-no-verifier ablation. HTTP failures and quota stops remain explicit; offline fallbacks are counted as fallback, not live successes. Cache read time is excluded; original network timings are persisted separately with each cached response. Repeat consistency compares canonical field values, clause ids and verdict, ignoring generated run/log identifiers. Missing/failed trials cannot count as consistent. No messages, payments or identities are used.

Independent blind fixtures in `evals/redteam/` are authored by a separate Claude reviewer, never used to train or tune the rules/model, and reported separately as the headline split. The original gold has rule-author overlap bias.

Frozen v1 baseline: `npx tsx evals/run_eval.ts --render-only --baseline-v1` renders the completed `results.json` without new network calls into `results-v1-baseline.json` and `RESULTS-v1-baseline.md`. The baseline preserves Flash Lite failures and records Flash/repeat HTTP 429 as unavailable. No tuning on rt-01..24 occurred before freezing; these cases become development data for the next design.
