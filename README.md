# Sublet Bouncer

Sublet Bouncer screens English rental listings for Waterloo students: paste a listing to inspect lease clauses, scam signals and a campus commute estimate, then review the evidence behind an ADMIT, HOLD or REFUSE verdict. Seven typed decisions separate extraction from policy and expose uncertain facts for human review. It drafts replies and viewing files; it does not contact landlords, pay or sign anything. **Not legal advice.**

[Live demo](https://sublet-bouncer.vercel.app)

## Try it in 30 seconds

Open the demo, click a clean, tricky or scammy sample (or paste your own listing), choose UW/WLU and your term/class time, then analyze. Inspect highlighted evidence, open questions and the decision log. Check the mode indicator: offline results are not live Gemini results. Choose offline mode to run the bundled core without an API key.

![Live tricky listing](evidence/ui/int-1280-live-tricky.png)

[Clean listing](evidence/ui/int-1280-live-clean.png) | [Refusal](evidence/ui/int-1280-refusal.png) | [Correction](evidence/ui/int-1280-markwrong.png) | [Fallback](evidence/ui/int-1280-fallback.png)

## How it works

| Decision | Method | Threshold and escalation |
| --- | --- | --- |
| D1 Extract fields | LLM plus span/value verifier; offline rules | Missing address and injection indicators block. Low-confidence fields, missing rent and dropped evidence are non-blocking review notes. |
| D2 Check clauses | Rules; live LLM proposes known rule IDs | Exact patterns 1.0, fuzzy 0.6, verified proposals 0.7; below 0.75 asks for review. Suspected violations block; informational topics remain ok with non-blocking notes. Proposals cannot mark a clause void. |
| D3 Score scam signals | Synthetic-trained logistic model | Below 0.3 proceed; 0.3 through 0.7 creates a blocking question; above 0.7 refuses. Uncalibrated score. |
| D4 Check commute | Cached geocodes, server-side Nominatim fallback, scheduled transit rules | Geocode at least 0.8; origin within 600m. Arrival margin at least 10 minutes feasible, 0–9 tight, negative infeasible. Unknown is a non-blocking note, but blocks ICS. |
| D5 Check RTA applicability | Owner-residence/sharing evidence and rules | Defaults to applies when sharing evidence is absent. Owner residence/sharing without explicit separate kitchen and bathroom means may_not_apply and a blocking question. This is a screening assumption, not a legal determination. |
| D6 Aggregate verdict | Rules | Refused input, payment or sensitive identity/banking details requested before viewing, or scam above 0.7 yields REFUSE. Blocking questions, non-ok clauses or infeasible commute yield HOLD; otherwise ADMIT. |
| D7 Gate actions | Rules | Viewing export needs feasible/tight commute, scam below 0.3, no input refusal and no unresolved escalations (including notes), then human confirmation. |

[Decision map and covering tests](docs/DECISION-MAP.md) | [Accountability and recovery](docs/ACCOUNTABILITY.md) | [Architecture](docs/ARCHITECTURE.md)

[Code-linked policy and test references](docs/DECISION-MAP.md) distinguish verdict-blocking questions from review notes. Notes alone do not force HOLD; they still prevent viewing export until resolved.

## Permissions

| Action | Permission |
| --- | --- |
| Draft reply; prepare evidence card | Automatic local result artifacts; reply blocked for refused input |
| Copy reply | Human confirmation; blocked for refused input |
| Export viewing ICS | Human confirmation plus D7 gate; proposed date is a draft |
| Send message, contact landlord, pay, sign | Forbidden; no integration performs these actions |

Undo changes app state and preserves log history; it cannot retract copied text or an already downloaded file. Corrections emit a regression fixture for review, not automatic model retraining.

## Run locally

Use Node.js 22.12+ (Node 26 used during development) and npm. From a clean clone:

```sh
npm install
```

Create an ignored `.env` in the repository root for live mode:

```dotenv
GEMINI_API_KEY=your_key_here
# Optional: Lite first, Flash fallback (deployed configuration)
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3-flash-preview
```

The configured production chain is `gemini-3.1-flash-lite` → `gemini-3-flash-preview` → offline rules. The adapter's code defaults are Flash first and Lite fallback if model overrides are omitted ([adapter:18](api/gemini.ts#L18)). The primary gets 14 seconds, fallback up to 6 seconds within a 20-second LLM budget; geocoding can add time ([adapter:4](api/gemini.ts#L4), [geocoder:16](api/_lib/geocode.ts#L16)). The response records the model that actually answered. No key is needed for offline mode; never put the key in a frontend variable.

In separate terminals:

```sh
npm run dev:api
npm run dev --workspace=web
```

Open http://localhost:5173; Vite proxies `/api` to port 8787. Verify:

```sh
npm test
npm run typecheck
npm run build
npm run eval
# No provider calls:
npm run eval -- --offline
```

Live evals consume provider quota and can fall back or stop on errors. See [data and reproduction](docs/DATA-SOURCES.md) for harness details; evaluate the current harness rather than assuming older timeout descriptions match production.

## Evaluation

[Current generated results](evals/RESULTS.md) | [Frozen v1 baseline](evals/RESULTS-v1-baseline.md) | [Row-level evidence](evals/results.json)

The frozen independent blind red-team v2 split measures the pre-C2d/C2e implementation; it became development data during subsequent fixes and is not a current-code headline. The author-overlap synthetic gold split is secondary. The frozen v1 baseline predates C2b clause proposals and risk-field changes. Compare splits and modes separately; provider failures and offline fallbacks are not live successes. See the generated report for completed coverage and unavailable comparisons.

<!-- RESULTS:FINAL -->

Final measured results are reserved for the lead after the final run. No performance claim is inferred from the screenshots.

## Data and licences

[Data sources and reproduction](docs/DATA-SOURCES.md) documents official Ontario e-Laws excerpts, Statistics Canada/CMHC mean rents (Statistics Canada Open Licence), GRT schedules (Region of Waterloo Open Data Licence), OSM/Nominatim geocodes (OSM contributors, ODbL), and synthetic scam fixtures. [RTA verification](data/RTA-VERIFICATION.md) records retrieved excerpts; this is a dated archive, not continuous legal verification. [MIT](LICENSE) covers project code; third-party data retains its own terms.

## Scope and limitations

Ontario screening rules, English text, a small Waterloo geocode cache and scheduled transit proxies limit coverage. In live-request mode, an unknown commute with an extracted address can trigger server-side OpenStreetMap Nominatim lookup: the normalized address leaves our server, without user identity or the full listing ([API:14](api/analyze.ts#L14), [geocoder:14](api/_lib/geocode.ts#L14)). Browser offline mode makes no such lookup. Synthetic-only scam training does not establish real-world fraud probability. CMHC means are not asking-rent medians. Free-tier quota and latency can force offline mode. Ownership, identity and listing authenticity are not verified. Read [limitations](docs/LIMITATIONS.md) before relying on a verdict; seek qualified help for legal questions.

## AI disclosure

Built with Claude Code, Codex and Antigravity/Gemini through the farm workflow. Runtime production configuration uses Gemini 3.1 Flash-Lite with Flash fallback, followed by deterministic verification and policy. [AI disclosure](docs/AI-DISCLOSURE.md) distinguishes agent checks from the completed [human review by David S](docs/HUMAN-REVIEW.md), which records four selected checks and their decisions. That review does not approve every later change or submission claim.

## Repository map

- `core/`: extraction verification, decision engine, permissions, corrections and log.
- `api/`: Gemini adapter, Vercel Node handlers and local API server.
- `web/`: React/Vite interface and browser offline integration.
- `data/`, `scripts/`: cached source-derived artifacts and reproducible builders.
- `tests/`, `evals/`: automated checks, fixtures and generated evaluation evidence.
- `docs/`, `evidence/`: source provenance, accountability notes and captured checks.
