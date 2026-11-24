# C4c — Production polish + visual QA (Lane L4/L5, Antigravity)
Owns /web and evidence/ui/. Production: https://sublet-bouncer.vercel.app (live LLM can take up to 20 s on the free tier; it may fall back to offline).
1. Live wait state: when Live is analyzing, show a staged progress narrative that is honest ("Reading clauses with Gemini… verifying every quote against your listing… checking RTA rules…"), a visible elapsed timer, and a "Use offline now" button that cancels the request (AbortController) and runs core offline. Never block the UI >20 s.
2. Fix open C5 findings in evidence/review/C5-web-review.md (fixture offsets, history reset on reload, clipboard completion race) if still present.
3. Fallback banner copy: distinguish rate-limit/quota vs timeout vs network, from fallbackReason; friendly + links to "why offline still works".
4. Visual QA ON PRODUCTION (after your deploy is live — the lead deploys; you verify the local build first, then re-verify prod once the lead says deployed or after you see your commit live): 1280 and 375, keyboard-only flow, reduced motion, contrast. Use the three samples + one pasted listing. Screenshots → evidence/ui/prod-*.png.
Build must pass. Commit atomically `git commit --only -m "C4c: ..." -- web/ evidence/ui/` (shared-checkout rule in hub/WORKFLOW.md §5), push. Do NOT deploy yourself. ≤12-line HANDOFF entry (commit --only).
