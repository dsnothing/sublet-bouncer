# Sublet Bouncer — SPEC (v1, 2026-11-24, owner: Claude L2)

> A velvet-rope bouncer for Waterloo co-op sublets. Paste any messy listing. An accountable agent checks its clauses against the Ontario Residential Tenancies Act (RTA), scores scam risk and checks the commute to campus. It returns **ADMIT / HOLD AT THE ROPE / REFUSE** with evidence, and drafts the safe reply and viewing invite. It never sends, pays or signs. Every action has an undo.

Targets: Global AI Builder's (due **Nov 28, 6 pm ET**; internal freeze **Nov 27, 6 pm ET**), Agents that act (v1.1 built Nov 28–30), IdeaLab (Nov 30). The rubric mapping is in `RUBRIC.md`.

## 1. Users and core journey
A Waterloo co-op student, often international, often searching from another city, needs a 4-month sublet.
1. Paste a listing (Kijiji, Facebook, Reddit text). Set term dates, campus (UW / WLU) and earliest class time; defaults are Winter 2027, UW and 8:30.
2. Within about 15 s the listing re-renders with highlights. Red means void/illegal, amber questionable, green fine. Each highlight opens a plain-language RTA lesson with its section number and a link to e-Laws.
3. A boarding-pass verdict is stamped ADMIT / HOLD / REFUSE, with a commute strip and a scam meter.
4. The Accountability drawer shows the typed decisions (kind chip, confidence vs threshold), the escalation queue, the permission matrix and the action log with Undo.
5. The student resolves escalations with one tap each. The agent then (re)computes actions: a draft reply, a viewing `.ics` and a saved evidence card.
6. "Bouncer was wrong" on any decision marks it wrong, rolls back dependent actions, re-runs from that step with the correction pinned, and appends a regression fixture.

## 2. Architecture (TypeScript, npm workspaces, Node 20+)
```
/core      pure TS, isomorphic (browser + Node). All decisions, gate, log/undo. NO network calls inside core.
/api       Vercel serverless functions: POST /api/analyze, GET /api/health. Gemini calls live here only.
/web       Vite + React + TS UI (Antigravity owns). Can run the full pipeline offline in-browser via /core.
/data      rta_rules.json, scam_model.json, commute_table.json, geocode_cache.json, cmhc_benchmarks.json (all with source + retrieved date)
/scripts   train_scam_model.ts, build_commute_table.ts, build_geocode_cache.ts
/evals     gold/*.json (40 listings), run_eval.ts -> results.json + RESULTS.md
/tests     vitest
```
- LLM: `gemini-2.5-flash` (stable). Ablation alternatives: `gemini-2.5-flash-lite` and offline regex. Use JSON-schema structured output (`responseMimeType: application/json` + `responseSchema`), temperature 0. The key is read from the env `GEMINI_API_KEY`; never commit it, and keep `.env` git-ignored.
- Timeouts: LLM 12 s. Any error, timeout, 429 or schema failure falls back to `offline` extraction and sets `mode:"offline-fallback"` with the reason shown in the UI.
- Listing text is **data, never instructions**. The system prompt says so. `core/injection.ts` flags patterns like "ignore (all|previous) instructions" or "approve this", and a flagged listing adds an escalation. The rules engine never reads LLM prose, only schema fields with spans.

## 3. Typed decisions (the heart; each one is logged)
| id | kind | what | output | threshold / escalation |
|---|---|---|---|---|
| D1 | `llm` (or `rules` offline) | Field + clause extraction | fields {address, rent, dates, deposits[], utilities, contact_channel, payment_methods[], viewing_offered, owner_lives_in}, clauses[] each with **verbatim `span`** | Each span must be an exact substring of the listing (normalized whitespace), otherwise the field is dropped and flagged. A field with confidence <0.8 is escalated as "please confirm" |
| D2 | `rules` | Clause legality vs RTA table | per clause {rule_id, status: void/questionable/ok, section, lesson, confidence} | exact pattern = 1.0, fuzzy = 0.6. <0.75 escalates |
| D3 | `model` | Scam risk: logistic regression over ~12 features | p_scam + top 3 contributing features | <0.30 proceed · 0.30–0.70 escalate · >0.70 block payment-adjacent drafting |
| D4 | `rules` | Commute feasibility (GTFS-derived table) | feasible/tight/infeasible/unknown + minutes + route summary | Arrival ≥10 min before class = feasible, 0–10 min = tight, otherwise infeasible. An ungeocodable address = unknown, which escalates (never guess) |
| D5 | `rules` | RTA applicability (s.5(i) shared kitchen/bath with owner) | applies / may_not_apply / unknown | may_not_apply shows a banner, and the void verdicts become "questionable: RTA may not apply" |
| D6 | `rules` | Verdict aggregate | ADMIT/HOLD/REFUSE + reasons[] | REFUSE if p_scam>0.70, or payment requested before viewing. HOLD if any escalation is open or any void/questionable clause exists. Otherwise ADMIT |
| D7 | `rules` | Action gate (permission matrix) | allowed actions | see §4 |

The rule table `data/rta_rules.json` has fields {id, section, title, patterns[], fuzzy_patterns[], status, lesson_plain, lesson_simple_english, source_url}. Each section must be **verified against the e-Laws text** (https://www.ontario.ca/laws/statute/06r17) with a quoted excerpt in `data/RTA-VERIFICATION.md`. The minimum set:
- Damage/security deposit is prohibited; only a rent deposit (max one period) and a refundable key deposit are allowed (s.105, s.106; O. Reg. 516/06 s.17)
- Rent deposit above one month/period (s.106)
- No-pets clause void (s.14)
- Post-dated cheques / automatic debit cannot be required (s.108)
- Entry without 24 h written notice (s.27)
- Tenant waives the landlord's maintenance duty / "as-is, tenant does all repairs" (s.20, s.4)
- Eviction or lock-out without the LTB process (s.37, s.39, s.24)
- Interest on rent deposit (s.106(6)), questionable when stated as "non-refundable last month"
- Standard lease form (s.12.1) as an informational lesson
- Sublet requires landlord consent, not to be unreasonably withheld (s.97), as an informational lesson
- s.5(i) exemption handled by D5
Codex must not invent sections. Anything not verified is dropped from v1.

Scam features (D3; design informed by Canadian Anti-Fraud Centre advisories): rent/CMHC median ratio, payment before viewing, wire/gift card/crypto/e-transfer-deposit request, landlord abroad/"I'm away", off-platform-only contact (WhatsApp/Telegram/email only), no address, no viewing offered, urgency language, over-long sob story, request for ID/SIN early, too-good amenities vs price, copy-paste/listing duplication markers. Training data is ~200 **synthetic** labelled listings from `scripts/gen_training.ts` (template-based, seeded) and must be disclosed as synthetic. Report AUC on the held-out gold set, never on training data.

## 4. Permission matrix and action log (D7)
| action | tier | precondition |
|---|---|---|
| read/analyze | auto | — |
| draft_reply | auto | if p_scam>0.70, the draft is a safe "decline / ask for viewing" template only |
| save_evidence_card | auto | — |
| export_viewing_ics | confirm | commute ∈ {feasible,tight} and p_scam<0.30 and no open escalation |
| copy_reply_to_clipboard | confirm | human click |
| send_message, pay, sign, contact_landlord | **never** | `gate.perform()` throws `ForbiddenActionError`, and a test proves it |

`core/log.ts` is an append-only log of entries {id, ts, kind: decision/action/undo/correction, decision_id?, decision_kind?, inputs_hash, output, confidence, threshold, actor: agent/human}. Every action stores an inverse, so `undo(entryId)` appends an undo entry and reverts state (never deletes history). `markWrong(decisionId, correction)` rolls back dependent actions, re-runs downstream decisions with the correction pinned, and returns a `RegressionFixture` {listing, decision_id, expected} that the UI can download or that dev mode writes to `tests/fixtures/regressions/`.

## 5. API contract (Codex implements; Antigravity consumes). Source of truth: `core/types.ts`
```ts
export type DecisionKind = 'llm' | 'rules' | 'model';
export type Verdict = 'ADMIT' | 'HOLD' | 'REFUSE';
export interface Span { text: string; start: number; end: number }       // offsets into original listing
export interface Decision { id: 'D1'|'D2'|'D3'|'D4'|'D5'|'D6'|'D7'; kind: DecisionKind; label: string;
  output: unknown; confidence: number; threshold?: number; escalated: boolean; reason: string; evidence: Span[] }
export interface ClauseFinding { span: Span; ruleId: string | null; status: 'void'|'questionable'|'ok';
  section?: string; lesson: string; lessonSimple: string; sourceUrl?: string; confidence: number }
export interface Commute { status: 'feasible'|'tight'|'infeasible'|'unknown'; minutes?: number; summary?: string; arriveBy?: string }
export interface Escalation { id: string; decisionId: Decision['id']; question: string; options: string[]; evidence: Span[] }
export interface ActionRecord { id: string; type: 'draft_reply'|'save_evidence_card'|'export_viewing_ics'|'copy_reply_to_clipboard';
  tier: 'auto'|'confirm'; status: 'proposed'|'done'|'undone'|'blocked'; payload: unknown; blockedReason?: string }
export interface LogEntry { id: string; ts: string; kind: 'decision'|'action'|'undo'|'correction'; ref: string; actor: 'agent'|'human'; summary: string; confidence?: number; threshold?: number }
export interface AnalysisResult { runId: string; mode: 'live'|'offline'|'offline-fallback'; fallbackReason?: string; model?: string;
  listing: string; fields: Record<string, { value: unknown; span?: Span; confidence: number }>;
  clauses: ClauseFinding[]; scam: { p: number; band: 'proceed'|'escalate'|'block'; topFeatures: {name: string; weight: number}[] };
  commute: Commute; rtaApplies: 'applies'|'may_not_apply'|'unknown'; verdict: Verdict; reasons: string[];
  decisions: Decision[]; escalations: Escalation[]; actions: ActionRecord[]; log: LogEntry[]; couldNotCheck: string[];
  refused?: { reason: 'non_english'|'too_short'|'image_only'|'injection_only' } }
export interface AnalyzeRequest { listing: string; profile: { termStart: string; termEnd: string; campus: 'UW'|'WLU'; classStart: string };
  mode?: 'live'|'offline' }
// POST /api/analyze  body: AnalyzeRequest -> 200 AnalysisResult | 400 {error}
// core exports: analyze(req, {llm?}), resolveEscalation(result, escId, answer), perform(result, actionId),
//               undo(result, logEntryId), markWrong(result, decisionId, correction) -> {result, fixture}
```
Codex commits `core/types.ts` **first**, together with `core/fixtures/sample-result.*.json` (ADMIT, HOLD and REFUSE examples), so the UI can build against fixtures immediately.

## 6. UI (Antigravity owns /web)
The concept is velvet rope + boarding pass. It should be distinctive, not a templated dashboard.
- Layout ≥1024 px: paste/listing panel on the left with inline highlights, verdict boarding pass in the centre, Accountability drawer on the right (collapsible). At 375 px, stack them with sticky verdict chips.
- Components: ListingEditor (paste + sample buttons: "clean", "scammy", "tricky"); HighlightedListing (spans, keyboard-focusable marks, lesson popover); BoardingPass (stamp animation, reduced-motion respected); CommuteStrip; ScamMeter (threshold ticks at 0.30/0.70); EscalationQueue (one-tap answers); PermissionMatrix; ActionLog (Undo per row, visible rewind animation on undo/markWrong); "Bouncer was wrong" on each decision; ModeToggle (Live LLM / Offline); Plain ↔ Simple-English toggle; "Not legal advice" + "What I couldn't check" panel.
- A11y: full keyboard flow, ARIA live region for the verdict, WCAG AA contrast, 44 px targets, reduced motion.
- State persists in localStorage, wrapped in try/catch.

## 7. Tests (≥16, ≥6 failure-oriented), all via `npm test`
Ordinary: clean listing ADMIT; illegal damage deposit is void s.105; no-pets void s.14; post-dated cheques s.108; commute feasible; ics only after confirm; undo reverts a draft; log is append-only.
Failure-oriented: LLM timeout → offline-fallback; LLM returns a span not in the listing → field dropped and flagged; malformed LLM JSON → fallback; non-English listing → refused; prompt-injection listing → escalation, verdict not ADMIT; forbidden `send_message` throws; ungeocodable address → commute unknown and escalated; 429 → fallback; markWrong rolls back dependent actions and emits a fixture; shared-kitchen-with-owner → RTA may_not_apply.

## 8. Evals (`npm run eval`, writes evals/results.json + evals/RESULTS.md)
The gold set is 40 listings: 15 clean, 15 scam/illegal, 10 tricky. They are synthetic but realistic, with no real people's data, and each has labelled fields, clauses, scam label and verdict. Hold them out from training.
Report: clause precision/recall; scam AUC + confusion at 0.30/0.70; extraction field accuracy for **offline regex vs flash-lite vs flash vs flash+span-verify** (the ablation that is the A2 evidence); verdict accuracy; **repeat consistency** (same 5 listings × 3 live runs); latency p50/p95; and the rubric cases: 2 ordinary, 1 repeat, 1 demanding (multi-clause adversarial). Every number in the write-ups must come from this file.

## 9. Deployment
Vercel: static `/web` build + `/api` functions, with `GEMINI_API_KEY` set as a Vercel env var. A public GitHub repo with MIT license and a README (setup, architecture diagram, decision map, limitations, AI disclosure). The lead handles the deploy and repo creation.

## 10. Out of scope (v1)
Scraping sites, image/OCR listings (refused politely), non-Ontario law, accounts, sending anything.
## 11. v1.1 for Agents-that-act (built Nov 28–30, disclosed as new)
Policy versioning (the rule table is versioned; each verdict records its policy version), "learned corrections" registry from markWrong with replay, a batch triage of N listings with a queue, the decision-map document, and a recorded wrong-decision recovery video.
