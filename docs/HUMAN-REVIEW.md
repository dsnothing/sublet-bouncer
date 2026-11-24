# Human review of AI-assisted development

Reviewer: David S (project owner). Date: 2026-11-24.
Method: the lead agent (Claude) picked four places where an AI-written decision could hurt a student. It showed the reviewer the exact code or data with a plain-language explanation. The reviewer decided each one. Where the first explanation was unclear, the reviewer asked for a re-explanation and decided only after reading it. The AI prepared the questions; the decisions are the reviewer's.

| # | What was checked (AI-written) | What the check found | Decision |
|---|---|---|---|
| 1 | `data/rta_rules.json` → `damage_deposit` (RTA s.105(1)) loose pattern `additional deposit` (Codex, C2b) | It can match **lawful** deposits ("additional deposit for last month's rent", refundable key deposit). Because it is a fuzzy match (confidence 0.6 < 0.75), it asks the student and never auto-voids | **Kept**. Extra confirmation questions are an acceptable cost of catching illegal deposits that are only called "additional" |
| 2 | `owner_shared` (RTA s.5(i) exemption) only matches "share kitchen/bathroom *with the owner/landlord*" | Misses paraphrases such as "live-in landlord". In live mode the LLM's `owner_lives_in` field covers them | **Kept as-is** for v1; listed in `docs/LIMITATIONS.md` |
| 3 | Permission gate `core/log.ts:29`: `send_message`, `pay`, `sign`, `contact_landlord` throw `ForbiddenActionError`; `.ics` export needs commute OK, scam < 0.30, no open escalation, and a click | The gate matches the product promise: the agent drafts, the human sends | **Kept** |
| 4 | LLM rule proposals (C2b): a verified-quote Gemini match gets confidence 0.7, so it escalates and cannot void a clause by itself | Blind red-team v2: whole-system live clause precision 0.348 (recall 0.889), and 14 of the 15 wrong flags were Gemini review proposals. On blind v3, Gemini review proposals were correct 5 of 7 times. Letting the LLM void clauses would make roughly 1 in 3 of its "illegal" calls wrong | **Kept: the LLM only proposes**; rules decide |

Other human-visible checks done during development (agent-run, reviewer-approved):
- The RTA sections were verified against e-Laws text (`data/RTA-VERIFICATION.md`); unverifiable sections were dropped.
- Evaluation honesty: perfect scores on the author-written gold set were rejected as evidence. Independent blind red-team sets were commissioned instead (`evals/redteam/`, `evals/redteam-v2/`), and the contamination of v1 by the lead's examples is disclosed.

**Correction note (2026-11-24, after rubric gate 2):** when the reviewer decided item 4, the lead described Gemini's flags as "right only about 35% of the time". That figure was the *whole live system's* clause precision on blind set v2 (14 of its 15 wrong flags were Gemini proposals), not Gemini's precision alone; on blind set v3, Gemini's review proposals were correct 5 of 7 times. The table above carries the corrected numbers. The decision (the LLM only proposes) stands on both sets, but it was made on the earlier, less precise figure.
