# IdeaLab Hacks — Devpost write-up (Sublet Bouncer)

Deadline **Nov 30, 2026 11:45pm ET**. Live demo: https://sublet-bouncer.vercel.app · Repo: https://github.com/dsnothing/sublet-bouncer · Video: (insert YouTube link, 2–3 min walkthrough)

**What-if:** *What if a nightclub bouncer checked every sublet listing before a student could be fooled by it?*

## The idea (creativity and originality)
Finding a 4-month sublet in Waterloo feels like trying to get into a club: urgent, unclear rules, and someone at the door who may be lying to you. Sublet Bouncer turns that into the interface. You paste a listing and the bouncer reads it. Each suspicious phrase lights up **in place** with a small tenancy-law lesson, and a boarding-pass verdict is stamped **ADMIT, HOLD AT THE ROPE or REFUSE**. A route strip shows the bus and ION trip to campus. Then the part nobody expects: tap **"Bouncer was wrong"** and the action log visibly rewinds, the drafted reply un-writes itself, and a regression test is produced.

## What we learned (clarity and learning)
1. **Perfect scores from your own test set mean nothing.** Our first test set was written by the same agent that wrote the rules and scored 100%. A blind set written by another model scored 43% on verdicts. We then fixed general causes and, after looking at that set, commissioned a fresh blind set that scored 77% offline and 80% live, as a one-shot test (`evals/RESULTS-v3-FINAL.md`).
2. **Don't let the AI decide what it can't verify.** On the blind tests, Gemini's rule suggestions were correct 5 of 7 times, and 14 of the 15 wrong clause flags on the earlier set were Gemini proposals. So Gemini may only raise a question, backed by a quote that code checks against the listing. In a synthetic corruption test the quote check rejected 23 of 23 fabricated values (the unchecked path catches none, by construction), and it rejected both real fabricated quotes Gemini produced.
3. **A cautious system can be wrong in a quiet way.** Our first version put most clean listings on HOLD because it could not check things listings never mention (who owns the building, our own address gaps). We separated "blocks a verdict" from "note to confirm". Verdict accuracy on the dev set rose from 13/30 to 25/30. We report that as a development number, not a headline.
4. **Free-tier AI is a design constraint.** About 1 in 5 live calls failed on the free tier, so offline mode is a first-class engine, labelled "Checked offline — exact wording only", with a one-click re-check.
5. **Compare against the obvious alternative, and report where it wins.** After the frozen v3 run we ran the same 30 listings through a plain chatbot prompt and a keyword checklist (`evals/RESULTS-BASELINES.md`). The chatbot found all 13 labelled violations (recall 1.00); Bouncer's recall is 0.38 offline and 0.54 live. Bouncer had more correct verdicts (23 to 24 of 30 vs 20) and fewer unsafe ADMITs live (2 vs 4), and each of its quotes and sections is code-verified, where 6 chatbot citations differ from the verified rule table. Intervals overlap at n = 30, so this is not a claim that Bouncer beats a chatbot. We also had to correct our own scoring: the strict citation matcher over-counted (19), and a normalized matcher added after the run gives 6; both are disclosed.
6. **Disclosing contamination is worth the awkwardness.** One of our own examples leaked into the fix for the first blind set, so that set no longer counts as evidence. It is labelled that way in the report.

## Usefulness and experience
- A one-line headline beside the stamp says what is wrong in plain words, and sample buttons show a "Saved live result" tag so a recorded Gemini run is never passed off as fresh. A "Simulate a Gemini outage" button shows the offline fallback on demand.
- Plain-language lessons with a **Simple English** toggle, for students reading English as a second language.
- Keyboard-only flow, screen-reader verdict announcements, reduced-motion support, WCAG AA contrast checked on the live site, works at 375 px.
- It never sends, pays or signs anything for you. It drafts; you decide.
- Every verdict says what it could not check, and "not legal advice" is stated on the card.

## Execution
Live site, 370 automated tests (1 optional live test skipped), three layers of AI fallback (Gemini Flash-Lite, Gemini Flash, offline engine). Offline mode runs fully in the browser. Held-out result: 24/30 verdicts correct live, 23/30 offline, on 30 blind synthetic listings. Post-v3 work (not re-evaluated on v3): clearer hero sample, Ontario-only guard, an 83-check safety suite (development data; 3 known key-deposit gaps), saved live samples with a circuit breaker, and the baseline comparison above. Weaknesses: reworded illegal clauses are only partly caught (recall about 0.54 live, 0.38 offline), and the free tier caps live reliability.

## Tools and credits
Claude Code, Codex and Antigravity/Gemini built the project through a written workflow; Gemini API powers live extraction. Public sources: Ontario Residential Tenancies Act (e-Laws), Grand River Transit GTFS, CMHC/Statistics Canada rent tables, OpenStreetMap Nominatim. React, Vite, Vitest, Vercel.

## Pre-existing vs event work
Nothing predates Nov 24, 2026: the repository's first commit is that day, inside this event's window and before its deadline. The same core is also entered in Global AI Builder's Challenge and Agents that act, with different write-ups and videos.

## Honest limits
Synthetic, small-sample testing; illegal-clause recall is partial; Ontario and English only; a commute table built from the current-term bus schedule. **Not legal advice.**
