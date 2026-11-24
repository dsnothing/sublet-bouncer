# Demo video script — Sublet Bouncer (≈3:00, Global AI limit 2–4 min; IdeaLab 2–3 min)

**You narrate; Antigravity or you record the screen** at https://sublet-bouncer.vercel.app (1280×800 browser window, zoom 100%, dark mode off). Read it naturally in your own words; the bold lines are the facts that must be said, everything else is flexible. Upload to YouTube as **public**, embedding enabled, and paste the link into Devpost. Speed-ups must be labelled.

**Pre-flight (5 min before recording):** open the site signed out; click "Clean" once to warm the API; have a second tab ready with a pasted non-English listing (any French sentence about a room); know where **Offline** and **Live** are in the top bar. Free-tier Gemini sometimes falls back to offline. That is fine and actually useful: record again or keep it as the failure demo.

| Time | On screen | Say (≈ words) |
|---|---|---|
| **0:00–0:20** | Site homepage, Sublet Bouncer header | "Every term, Waterloo co-op students hunt for a four-month sublet, often from another city. That's where scams and illegal lease terms hit hardest. I built Sublet Bouncer: paste a listing and it checks it against Ontario tenancy law, scores scam risk, and checks your commute. (≈55)" |
| **0:20–0:55** | Click **Tricky** sample, wait for the result. Hover the red/amber highlight; open the lesson popover | "Here's a tricky listing. The poster lives in the home and shares the kitchen, so the Residential Tenancies Act may not apply at all. The app doesn't assume. It asks me to confirm, and it holds the verdict until I do. A questionable clause lights up in place, with the section of the Act and a plain-language explanation, and a Simple-English toggle. The verdict is Hold at the Rope. (≈75)" |
| **0:55–1:25** | Point to the **Accountability** drawer: decision cards with chips (rules / model / LLM), thresholds; **Needs your answer** vs **Notes to confirm**; the permission matrix | "On the right is the accountability layer. Seven typed decisions: some are rules, one is a trained scam model, one is Gemini. Each shows its confidence against a threshold. **Gemini can only ask a question; it can never declare a clause illegal**, because in my blind test about three in ten of its suggestions were wrong. And the app can draft a reply, but it **never sends, pays or signs** anything. (≈75)" |
| **1:25–1:50** | Click **Clean**: ADMIT stamp, commute strip, then **Scammy**: REFUSE with blocked actions | "A clean listing gets Admit, with a commute check to campus. A scam, payment before a viewing, gets Refuse, and payment-adjacent drafting is blocked. (≈40)" |
| **1:50–2:15** | Click **Bouncer was wrong** on a decision; show the log rewinding, the draft un-writing, the regression-fixture download | "Mistakes happen, so every action has an undo. If I tap 'Bouncer was wrong', the log rewinds, the drafted reply is withdrawn, the decision re-runs with my correction, and I get a regression test. (≈45)" |
| **2:15–2:40** | **Failure 1:** click **Offline** (or use a moment where it fell back): banner shows why; point to "Checked offline — exact wording only" and "Re-check with Gemini". **Failure 2:** paste the French listing → polite refusal | "Two different failures. When the AI provider is rate-limited or down, the app falls back to a built-in offline engine, says so, and offers a one-click re-check. And bad input, like a non-English listing, is refused instead of guessed at. (≈55)" |
| **2:40–3:05** | Cut to `evals/RESULTS-v3-FINAL.md` headline table (zoom on it) | "How well does it work? I tested on thirty blind listings written by a different AI model, one shot, with the code frozen beforehand: **twenty-four of thirty verdicts correct live, twenty-three offline.** Weak spot: it catches only about half of reworded illegal clauses. All of this is synthetic data, so it doesn't prove real-world accuracy, and it's not legal advice. (≈60)" |
| **3:05–3:15** | Repo / README (optional end card) | "Everything is open source: link below. Thanks for watching. (≈15)" |

**Total ≈ 415 words ≈ 3:00–3:15 at a relaxed pace.** If you run long, cut the 1:25 beat's second half.

## Recording tips
- Do it in one take per section; pauses can be trimmed with ffmpeg afterwards (give the files to the lead agent).
- Speak at about 140 words per minute; leave 1 s of silence after each click so results are visible.
- If a live call is slow (it can take up to ~15 s on the free tier), say "this one takes a few seconds on the free tier" over the progress screen. That's honest and it shows the wait-state design.

## IdeaLab cut (2:15)
Keep 0:00–0:20, 0:20–0:55, 1:50–2:15 (Bouncer was wrong), 2:40–3:05 reframed as "What I learned": perfect self-made scores are meaningless; blind tests exposed 43%; fixing causes got 80%; don't let AI decide what it can't verify.

## Agents-that-act cut (add in Nov 28–30)
Add: Decision Map and accountability walk-through (1:25 beat expanded), plus the **recorded wrong-decision recovery**, plus the v1.1 features that actually ship.
