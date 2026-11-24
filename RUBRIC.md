# Rubric matrix: every criterion maps to a feature, an evidence artifact and an owner

## (A) Global AI Builder's (/100; judged from the video and write-up only)
| Item | pts | Feature | Evidence artifact | Owner |
|---|---|---|---|---|
| V1 need & fit | 8 | Co-op sublet scams + illegal clauses | Cited CAFC/rental-scam stats + RTA in write-up | Claude L7 |
| V2 advantage vs current | 8 | vs "ask Reddit / read the RTA yourself" | Side-by-side table, time-to-verdict | Claude L7 + evals |
| V3 realistic use | 4 | Free, no account, English listings | Deployed URL | lead |
| A1 justified AI choice | 6 | gemini-2.5-flash, structured output | Latency/accuracy/cost table vs flash-lite + offline | evals (Codex) |
| A2 project-specific AI design | 10 | Verbatim span verification + LLM cannot invent law | Ablation: flash vs flash+span-verify | evals (Codex) |
| A3 AI quality eval + limits | 8 | 40-listing gold set | RESULTS.md, with limits stated | Codex + Claude |
| A4 human check of AI-assisted dev | 6 | Review log: what was checked, found, kept/changed/rejected | `docs/HUMAN-REVIEW.md` (the user reviews 5 items, about 10 min) | user + Claude |
| R1 complete flow in demo | 6 | paste→verdict→escalation→action→undo | video | Antigravity L5 |
| R2 correct results | 16 | 2 ordinary + repeat + demanding | results table in the write-up from evals | Codex + Claude |
| R3 two failures handled | 8 | API outage → offline; non-English → refused | video + tests | Codex |
| D1–D5 design/UX | 20 | velvet-rope UI, a11y | screenshots, video | Antigravity |
Category stacking: Best AI Agent, AI for Education, AI for Accessibility, AI for Community Impact, Best Design & UX, Originality, Best Demo, People's Choice.

## (B) Agents that act
| Criterion | wt | Evidence |
|---|---|---|
| Works beyond the demo | 30 | Live URL; judges paste unseen listings; offline fallback |
| Solves a real task | 25 | Gated actions (draft, ics, evidence card), not chat |
| Fails honestly | 25 | Escalation queue, thresholds, refusals, recorded markWrong recovery, ≥3 failure tests |
| Shows the work | 20 | Decision map (D1–D7), accountability layer doc, ≥10 tests, dev log |
Required artifacts: Decision Map, Accountability Layer, Testing Evidence (≥10 tests, ≥3 failure-oriented, 1 recorded wrong-decision recovery), Documentation.

## (C) IdeaLab (25% each)
Creativity (bouncer/boarding-pass metaphor, rewinding log) · Execution (works live) · Usefulness & Experience (a11y, simple-English toggle) · Clarity & Learning ("what we learned" section, tools credited, pre-existing vs event work separated).
