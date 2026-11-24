# Demo video script — Sublet Bouncer (≈3:00, Global AI limit 2–4 min; IdeaLab 2–3 min)

**You narrate; Antigravity or you record the screen** at https://sublet-bouncer.vercel.app (1280×800 browser window, zoom 100%, dark mode off). Read it naturally in your own words; the bold lines are the facts that must be said, everything else is flexible. Upload to YouTube as **public**, embedding enabled, and paste the link into Devpost. Speed-ups must be labelled.

**Pre-flight (5 min before recording):** open the site signed out; click "Clean" once to warm the API; have a second tab ready with a pasted non-English listing (any French sentence about a room); know where **Offline**, **Live** and **Simulate a Gemini outage** are. Sample buttons now replay saved live results, so the main takes do not depend on the free tier; "Run fresh check" can still fall back, and that is fine as an extra failure demo.

| Time | On screen | Say (≈ words) |
|---|---|---|
| **0:00–0:15** | Site homepage, Sublet Bouncer header | "Every term, Waterloo co-op students hunt for a four-month sublet, often from another city. Scams and illegal lease terms hit hardest. Sublet Bouncer checks a pasted listing against Ontario tenancy law, scores scam risk, and checks your commute. (≈40)" |
| **0:15–0:50** | Land on the default **Hidden terms** sample (saved result). Point to the **one-line headline** beside the stamp, then the **"Saved live result · gemini-3.1-flash-lite · Nov 24, 2026"** tag. Hover a highlight; open the lesson popover; click a span in the headline to jump to its quote | "This listing looks friendly, but the headline says it in one line: HOLD, with a damage deposit and entry without notice that Ontario law doesn't allow. Click a term and it jumps to the exact quote, with the section of the Act and a Simple-English toggle. **This is a saved result from a real Gemini run, labelled with the model and date; Run fresh check asks Gemini again.** (≈75)" |
| **0:50–1:15** | **Accountability** drawer: decision cards with chips (rules / model / LLM), thresholds; **Needs your answer** vs **Notes to confirm**; permission matrix | "Seven typed decisions: some rules, one trained scam model, one Gemini. **Gemini can only ask a question; it can never declare a clause illegal**, because in my blind test about three in ten of its suggestions were wrong. And the app **never sends, pays or signs** anything. (≈55)" |
| **1:15–1:35** | **Clean**: ADMIT, commute strip. **Scammy**: REFUSE headline, blocked actions | "A clean listing gets Admit with a commute check. Payment before a viewing gets Refuse, and the headline says don't send money. (≈30)" |
| **1:35–1:55** | **Bouncer was wrong**: log rewinds, draft un-writes, fixture download | "Every action has an undo. Tap 'Bouncer was wrong': the log rewinds, the draft is withdrawn, the decision re-runs with my correction, and I get a regression test. (≈35)" |
| **1:55–2:20** | **Failure 1:** click **Simulate a Gemini outage** on a sample: the SIMULATED band and banner "Gemini was not called", the offline verdict, **Re-check with Gemini**. **Failure 2:** paste the French listing → polite refusal | "Two failures. When the AI provider is down, the app falls back to a built-in offline engine, says so, and offers a re-check. Here I simulate the outage on purpose, so nothing is hidden: Gemini isn't called. And a non-English listing is refused instead of guessed at. (≈55)" |
| **2:20–2:50** | Open **"What a plain chatbot said"** on the Scammy or Hidden terms sample: chatbot clauses beside Bouncer's verified spans; note the "Saved output… not a live call" label and the honest note | "Why not just ask a chatbot? Here is a saved answer from a plain Gemini prompt on the same listing. **On my thirty test listings the chatbot actually found all thirteen violations. Bouncer finds fewer.** What Bouncer adds is that every quote and section is checked by code; some chatbot citations don't match the verified rule table. It also had more correct verdicts, twenty-three to twenty-four of thirty against twenty, and fewer unsafe admits live, though the sample is small. (≈85)" |
| **2:50–3:10** | Cut to `evals/RESULTS-v3-FINAL.md` headline table, then `evals/RESULTS-BASELINES.md` table (zoom) | "The main test: thirty blind listings from a different AI model, one shot, code frozen: **twenty-four of thirty verdicts correct live, twenty-three offline.** It catches only about half of reworded illegal clauses. The chatbot comparison came afterward and the frozen test wasn't re-tuned. It's all synthetic data, not legal advice. (≈55)" |
| **3:10–3:15** | Repo / README (optional end card) | "Open source, link below. Thanks for watching. (≈10)" |

**Total ≈ 435 words ≈ 3:05–3:15 at a relaxed pace.** If you run long, cut the 1:15 Clean/Scammy beat to the Scammy half. Say the chatbot recall line exactly as written; do not shorten it to "better than a chatbot".

## Recording tips
- Do it in one take per section; pauses can be trimmed with ffmpeg afterwards (give the files to the lead agent).
- Speak at about 140 words per minute; leave 1 s of silence after each click so results are visible.
- If a live call is slow (it can take up to ~15 s on the free tier), say "this one takes a few seconds on the free tier" over the progress screen. That's honest and it shows the wait-state design.

## IdeaLab cut (2:15)
Keep 0:00–0:15, 0:15–0:50, 1:35–1:55 (Bouncer was wrong), 2:20–2:50 (chatbot comparison, with its recall note) and 2:50–3:10 reframed as "What I learned": perfect self-made scores are meaningless; blind tests exposed 43%; fixing causes got 80%; don't let AI decide what it can't verify.

## Agents-that-act cut (add in Nov 28–30)
Add: Decision Map and accountability walk-through (0:50 beat expanded), the simulated outage as the failure demo, plus the **recorded wrong-decision recovery**, plus the v1.1 features that actually ship.

## Clips: reuse vs re-record (`evidence/demo/MANIFEST.md` lists the c9 clips, recorded on production commit `301d63b`, before C10–C12)
- **Re-record (UI changed):** c9-01 intro (hero and headline), c9-02 (the Tricky sample is now Hidden terms; its beat is the headline and "Saved live result" tag), c9-04 (headline on Clean and Scammy), c9-05 (stamp and headline now differ), c9-06 (replace Offline toggle with **Simulate a Gemini outage**).
- **Probably re-record for consistency:** c9-03 (accountability drawer; the layout beside the new headline).
- **New clips:** the "What a plain chatbot said" toggle (Hidden terms or Scammy, 1280 px, zero network calls) and the RESULTS-BASELINES table view.
- **Reusable as is:** c9-07 (French refusal), c9-09 (README), and c9-08 if only the v3 table is shown (extend it with the baselines table).
- Screenshots to use for stills and checks: `evidence/ui/c10-*`, `c11-*`, `c12-*`, `c12d-*`, `fix-*`.
