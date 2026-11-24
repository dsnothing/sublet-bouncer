# Improvement plan (judge-panel pick, 2026-11-24)

## Sequencing
Nov 24 evening to Nov 25:
- Codex thread 1 does C10 Part A in a worktree.
- Codex thread 2 does C11 Part A (signature, seed hardening, parity test, breaker, simulateOutage, smoke script) in a separate worktree. The two overlap only in core/types.ts, core/index.ts and api/_lib/samples.ts parity, so merge C10 first and rebase C11 on it.
- At the same time, Codex (thread 2 when it is free, or a third thread) commits the C12 pre-registration and runs the frozen-v3 B1/B2 baselines and token measurement (evals/ only, no product dependency). The lead supplies pricing.json.

Nov 26:
- Antigravity runs C10 Part B, then C11 Part B, each with the visual gate.
- Codex runs the C12 3-sample toggle data once C10's hero text is merged.
- Antigravity then builds the C12 toggle.
- Codex cross-reviews Antigravity's diffs, and Antigravity browser-QAs the Codex output (L6).

Engine freeze Nov 26 evening (no core/ or api/ behaviour change after this for Global). Then the lead (L8):
- regenerates the seed (C11 seed run) and checks the parity test is green;
- deploys from a clean committed HEAD;
- runs scripts/prod_smoke.ts and commits the evidence.

Nov 27:
- Claude L7 (one touch) updates the Global, IdeaLab and Agents write-ups and the VIDEO-SCRIPT with C12 numbers, the C10 hero narration and the F3-F11 fixes.
- The Sonnet rubric gate runs.
- Antigravity records the Global video (and a separate IdeaLab take) by Nov 27 evening.
- Freeze Global by Nov 27 23:59.

Nov 28 00:00-12:00 ET: the C8 Agents pack, as additive-only deploys with a sample smoke test after each.

Do not make live calls (seed, smoke, baselines) during the Global judging window. Any engine change after the seed run fails the parity test until the seed is regenerated.

## Runners-up
- C11 video re-cut: not one of the three improvements, but required for Global because the video placeholder (F14) is a hard blocker. Schedule it right after the UI freeze. Antigravity records against the frozen deploy with the 'Saved live result' tag on screen and uses the C11 simulated outage as failure B. The lead writes the script once (L7) using only numbers from evals/. Fallback: record against the current UI plus C10 alone.
- C4 Judge Mode stepper: its best part (a deterministic, labelled outage) is grafted into C11. A trimmed 5-step '?judge=1' strip using C10 and C11 pieces can follow if Antigravity has time on Nov 27. Include the failing demanding case and an 'Expected vs Got' line.
- C8 Agents Hack-Day pack: needed for Agents (recorded wrong-decision run, team details, dated new work). Cards are written now and code starts Nov 28 00:00 ET. The redeploy during Global judging must be additive only.
- C2 sealed v4 set (cut-down version): repeat cell plus a small sealed set plus Wilson CIs. It is worth R2 points, but the dependency chain (C3 and C5 must merge, then the SHA freezes) does not fit before Nov 27 noon. It is a candidate for the Agents window as dated new work.
- C10 real-advisory eval (advisory arm only): its RCMP provenance is already grafted into C12 B2. The full arm is possible later, labelled as constructed wrappers.
- C6 offline-first instant verdict: mostly redundant on the sample path once C11 seeds exist, and a flipping verdict invites 'which do I trust?'.
- C3 offline clause matcher: no allowed way to show the lift without C2, and it carries precision risk. Its slot-gating idea is covered by C10's minimal-pair rejection tests.
- C9 case-file loop: Agents only, after C8, scoped to 2-3 question types.
- C12 Ontario-wide packs: defer and mention breadth in the copy instead.