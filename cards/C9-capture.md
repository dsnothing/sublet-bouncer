# C9 — Silent screen-capture clips for the demo video (Lane L5, Antigravity)
The owner records narration in their own voice from docs/submissions/VIDEO-SCRIPT.md. You capture SILENT clips of the live site https://sublet-bouncer.vercel.app that the lead will sync to the audio. Do NOT open evals/ except to read the headline table in evals/RESULTS-v3-FINAL.md for clip 08 (render it as a clean zoomed HTML/Markdown view, not raw source).

Produce 1280x800 mp4 clips, 30 fps, no audio, cursor visible, ~1 s pause after each click, 10-35 s each, one per script row:
- c9-01-intro (homepage)
- c9-02-tricky-highlights-lesson (Tricky sample; hover a highlight; open the lesson popover; toggle Simple English)
- c9-03-accountability-drawer (scroll decision chips + thresholds; "Needs your answer" vs "Notes to confirm"; permission matrix)
- c9-04-admit-and-refuse (Clean, then Scammy)
- c9-05-bouncer-was-wrong (log rewinds, draft un-writes, regression fixture download)
- c9-06-failure-offline (Offline toggle and/or "Use offline now" during a slow call; show "Checked offline — exact wording only" and "Re-check with Gemini")
- c9-07-failure-non-english (paste a French listing -> polite refusal)
- c9-08-results-table
- c9-09-repo-readme (GitHub README top)

Method: headless Chrome via CDP screencast (frames -> ffmpeg), or Chrome tab capture. ffmpeg is being installed by the lead (winget Gyan.FFmpeg); if it is not on PATH yet, look under %LOCALAPPDATA%\Microsoft\WinGet\Packages or retry shortly. Re-record any clip where a live call fell back unexpectedly, unless that clip is the failure demo. The free Gemini tier is slow and rate-limited: pace live calls >= 8 s apart.
Save clips to evidence/demo/clips/ and add that folder to .gitignore if the total is over 50 MB; commit only evidence/demo/MANIFEST.md (clip, duration, what it shows). Commit via your private index, touch nothing else, no deploy. Never type secrets (the site needs none). Reply with the manifest.
