export type DecisionKind = 'llm' | 'llm+rules' | 'rules' | 'model';
export type Verdict = 'ADMIT' | 'HOLD' | 'REFUSE';
export interface Span { text: string; start: number; end: number }       // offsets into original listing
export interface Decision { id: 'D1'|'D2'|'D3'|'D4'|'D5'|'D6'|'D7'; kind: DecisionKind; label: string;
  output: unknown; confidence: number; threshold?: number; escalated: boolean; reason: string; evidence: Span[] }
export interface ClauseFinding { span: Span; ruleId: string | null; status: 'void'|'questionable'|'ok';
  section?: string; lesson: string; lessonSimple: string; sourceUrl?: string; confidence: number }
export interface Commute { status: 'feasible'|'tight'|'infeasible'|'unknown'; minutes?: number; summary?: string; arriveBy?: string }
export interface Escalation { id: string; decisionId: Decision['id']; blocking: boolean; question: string; options: string[]; evidence: Span[] }
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
