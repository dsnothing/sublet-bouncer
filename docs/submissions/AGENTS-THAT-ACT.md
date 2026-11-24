# Agents that act. Systems that answer. — submission draft (Sublet Bouncer)

Submissions open **Nov 28 12:00am ET** and close **Dec 1 3:30am ET** (Devpost schedule). Build window: Hack Days Nov 28–30. Live demo: https://sublet-bouncer.vercel.app · Repo: https://github.com/dsnothing/sublet-bouncer · Track: **Public Life & Access** (secondary: Opportunity & Work).

> **Status: DRAFT. Items marked ⏳ are not done yet and must not be claimed until they exist in git with dates inside Nov 28–30.**

## Pre-existing vs new work (required disclosure)
- **Pre-existing (built from Nov 24, before submissions opened on Nov 28):** the core engine (typed decisions D1–D7, permission gate, action log with undo, "Bouncer was wrong" correction flow), the web interface, the data tables, 160 automated tests, the evaluation harness and three evaluation sets. The same core is entered in two other hackathons (Global AI Builder's Challenge, IdeaLab Hacks), each with its own write-up and video.
- **New during the Hack Days (Nov 28–30):** ⏳ policy versioning (every verdict records the rule-table version that produced it), ⏳ a "learned corrections" registry that replays past human corrections against new rule versions, ⏳ a batch triage queue for many listings, ⏳ the recorded wrong-decision recovery, ⏳ final test evidence. *Fill in only what ships, with commit SHAs and dates.*

## What it does (a real workflow, not a chatbot)
A Waterloo co-op student pastes a sublet listing. The agent turns the messy text into **gated, reversible actions**: a safe reply draft, a viewing calendar file, and a saved evidence card. It checks Ontario tenancy law, scores scam risk and checks the commute. It **cannot** send, pay, sign or contact a landlord: those throw in code, and a test proves it.

## Decision Map — at least three typed, inspectable decisions
| # | Kind | Decision | Threshold / escalation |
|---|---|---|---|
| D1 | **LLM** (Gemini, quote-verified) + rules | Extract fields and clauses; every value needs a verbatim quote that exists in the listing | missing address escalates and blocks; other dropped fields become notes |
| D2 | **Rules** (+ LLM proposals) | Match clauses against RTA rules with section citations | exact match 1.0; fuzzy 0.6; LLM proposal 0.7. Below 0.75 it only **asks** the student |
| D3 | **Model** (logistic regression, 12 features, trained on synthetic data) | Scam risk | below 0.30 proceed; 0.30–0.70 escalate; above 0.70 block payment-adjacent drafting and REFUSE |
| D4 | **Rules** over GTFS-derived table | Commute feasibility to campus | unknown is a non-blocking note; the calendar file stays locked |
| D5 | **Rules** | Whether the RTA applies (owner-shared kitchen exemption) | applies by default; asks only if the owner appears to live there |
| D6 | **Rules** | Verdict ADMIT / HOLD / REFUSE | HOLD only on blocking questions; REFUSE on scam score, payment or ID requests before a viewing, non-English |
| D7 | **Rules** | Action gate (permission matrix) | auto / confirm (human click) / never |
Details with code references: `docs/DECISION-MAP.md`.

## Accountability Layer
- **Data sources and state:** pasted listing text only (no accounts, nothing stored server-side); public sources listed in `docs/DATA-SOURCES.md`; the server sends address text to OpenStreetMap Nominatim for geocoding, disclosed in the README.
- **Permissions:** three tiers (auto, confirm, never), shown in the interface and enforced in code (`core/log.ts`).
- **Confidence thresholds:** table above.
- **Human escalation:** blocking questions ("Needs your answer before a verdict") versus non-blocking "Notes to confirm".
- **Action log:** append-only, with the decision kind, confidence, threshold and actor on every row.
- **Recovery and undo:** every action stores its inverse; "Bouncer was wrong" rolls back dependent actions, re-runs with the correction pinned, and emits a regression fixture.
Details: `docs/ACCOUNTABILITY.md`.

## Testing Evidence
- **160 automated tests** (1 optional live test skipped without a key), including failure-oriented ones: model timeout falls back to offline, malformed model output rejected, span not in listing dropped, non-English refused, prompt injection held, forbidden send throws, ungeocodable address does not guess, rate limit (429) falls back, correction rolls back and emits a fixture.
- **Held-out evaluation:** 30 blind listings, one shot, source frozen: 24/30 verdicts correct live (80%) and 23/30 offline (77%); report `evals/RESULTS-v3-FINAL.md`. Earlier blind runs scored 43% before general fixes (disclosed in the history table).
- **One recorded example of the system handling an incorrect decision:** ⏳ *to be recorded Nov 28–30* (video of "Bouncer was wrong": the log rewinds, the draft un-writes itself, the rule is corrected and a regression test appears). The mechanism exists today; the recording does not.

## Why it should score on the criteria
- **Works beyond the demo (30):** live URL where judges paste any listing; three layers (Flash-Lite, Flash, offline engine) so it never returns nothing; offline mode is marked reduced-confidence.
- **Solves a real task (25):** produces gated actions, not chat.
- **Fails honestly (25):** it says what it could not check, escalates instead of guessing, refuses non-English, and the LLM cannot declare a clause illegal on its own because blind testing showed its proposals were wrong often enough to matter (5 of 7 correct on v3; 14 of the 15 wrong clause flags on v2).
- **Shows the work (20):** decision map, accountability layer, test evidence, evaluation history with every contamination disclosed.

## Limitations (honest)
Illegal-clause recall is about 0.54 live and 0.38 offline; reworded violations are sometimes missed. 6 of 30 live calls fell back to offline on the free tier; p95 latency 14 s. The data is synthetic and small. Ontario and English only. Not legal advice. See `docs/LIMITATIONS.md`.

## Before submitting (checklist)
- [ ] ⏳ v1.1 features merged with dated commits (Nov 28–30); update the "new work" list above with real SHAs
- [ ] ⏳ Recorded wrong-decision recovery video
- [ ] Re-run `npm test` and the evaluation after v1.1; update numbers only from `evals/`
- [ ] Demo video, public repository link, team details, description pasted
- [ ] Open the live URL signed out one last time
