import admitFixtureRaw from '../../core/fixtures/sample-result.admit.json';
import holdFixtureRaw from '../../core/fixtures/sample-result.hold.json';
import refuseFixtureRaw from '../../core/fixtures/sample-result.refuse.json';
import type {
  AnalysisResult,
  AnalyzeRequest,
  Decision,
  DataSourceMode,
  LogEntry,
  RegressionFixture,
  SampleKey,
  Verdict,
} from './types';

function cloneResult(raw: unknown): AnalysisResult {
  const base = structuredClone(raw) as AnalysisResult;
  // Ensure confirm-tier actions are represented so the Permission Matrix and Action bar
  // can demonstrate the full SPEC §4 gate flow even on minimal fixtures.
  const hasIcs = base.actions.some((a) => a.type === 'export_viewing_ics');
  const hasCopy = base.actions.some((a) => a.type === 'copy_reply_to_clipboard');

  if (!hasCopy) {
    const replyAction = base.actions.find((a) => a.type === 'draft_reply');
    base.actions.push({
      id: 'A-copy',
      type: 'copy_reply_to_clipboard',
      tier: 'confirm',
      status: 'proposed',
      payload: typeof replyAction?.payload === 'string' ? replyAction.payload : 'Could we arrange a viewing?',
    });
  }

  if (!hasIcs) {
    const icsAllowed =
      (base.commute.status === 'feasible' || base.commute.status === 'tight') &&
      base.scam.p < 0.3 &&
      base.escalations.length === 0;
    const blockedReason =
      base.scam.p >= 0.3
        ? `Scam risk ${(base.scam.p * 100).toFixed(0)}% exceeds 30% limit`
        : base.escalations.length > 0
          ? 'Resolve open escalations first'
          : base.commute.status !== 'feasible' && base.commute.status !== 'tight'
            ? `Commute is ${base.commute.status}`
            : undefined;
    base.actions.push({
      id: 'A-ics',
      type: 'export_viewing_ics',
      tier: 'confirm',
      status: icsAllowed ? 'proposed' : 'blocked',
      payload: {
        summary: 'Sublet Viewing — Waterloo',
        location: base.listing.slice(0, 60),
      },
      blockedReason,
    });
  }

  // Ensure action records that are already 'done' have matching log entries so Undo works immediately
  for (const act of base.actions) {
    if (act.status === 'done' && !base.log.some((l) => l.kind === 'action' && l.ref === act.id)) {
      base.log.push({
        id: `L-act-${act.id}`,
        ts: new Date().toISOString(),
        kind: 'action',
        ref: act.id,
        actor: 'agent',
        summary: `Auto-executed ${act.type.replaceAll('_', ' ')}`,
      });
    }
  }

  return base;
}

export const SAMPLE_FIXTURES: Record<SampleKey, { label: string; badge: Verdict; result: () => AnalysisResult }> = {
  clean: {
    label: 'Clean',
    badge: 'ADMIT',
    result: () => cloneResult(admitFixtureRaw),
  },
  tricky: {
    label: 'Tricky',
    badge: 'HOLD',
    result: () => cloneResult(holdFixtureRaw),
  },
  scammy: {
    label: 'Scammy',
    badge: 'REFUSE',
    result: () => cloneResult(refuseFixtureRaw),
  },
};

export function getSampleListing(key: SampleKey): string {
  return SAMPLE_FIXTURES[key].result().listing;
}

function matchFixtureForListing(listing: string): AnalysisResult {
  const lower = listing.toLowerCase();
  if (
    lower.includes('crypto') ||
    lower.includes('telegram') ||
    lower.includes('abroad') ||
    lower.includes('western union') ||
    lower.includes('before viewing') ||
    lower.includes('gift card')
  ) {
    const r = cloneResult(refuseFixtureRaw);
    r.listing = listing;
    return r;
  }
  if (
    lower.includes('no pets') ||
    lower.includes('damage deposit') ||
    lower.includes('post-dated') ||
    lower.includes('security deposit') ||
    lower.includes('as-is') ||
    lower.includes('share kitchen')
  ) {
    const r = cloneResult(holdFixtureRaw);
    r.listing = listing;
    // Re-locate span if user edited text
    for (const clause of r.clauses) {
      const idx = listing.toLowerCase().indexOf(clause.span.text.toLowerCase());
      if (idx >= 0) {
        clause.span = {
          text: listing.slice(idx, idx + clause.span.text.length),
          start: idx,
          end: idx + clause.span.text.length,
        };
      }
    }
    return r;
  }
  const r = cloneResult(admitFixtureRaw);
  r.listing = listing;
  return r;
}

export async function runAnalysis(
  req: AnalyzeRequest,
  source: DataSourceMode,
): Promise<{ result: AnalysisResult; notice?: string }> {
  if (source === 'fixtures') {
    return { result: matchFixtureForListing(req.listing) };
  }

  if (source === 'api') {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error || `API returned ${res.status}`);
      }
      const data = (await res.json()) as AnalysisResult;
      return { result: cloneResult(data) };
    } catch (err) {
      const fallback = matchFixtureForListing(req.listing);
      fallback.mode = 'offline-fallback';
      fallback.fallbackReason =
        err instanceof Error ? `API unavailable (${err.message}); using local fixture fallback` : 'API unavailable';
      return {
        result: fallback,
        notice: fallback.fallbackReason,
      };
    }
  }

  // Offline mode: try dynamic import of @core/index when C2 lands it; otherwise deterministic fixture fallback
  try {
    const coreModulePath = '../../core/index.ts';
    const mod = (await import(/* @vite-ignore */ coreModulePath)) as {
      analyze?: (r: AnalyzeRequest) => Promise<AnalysisResult> | AnalysisResult;
    };
    if (typeof mod.analyze === 'function') {
      const res = await mod.analyze({ ...req, mode: 'offline' });
      return { result: cloneResult(res) };
    }
  } catch {
    // core/index.ts not yet committed by C2; fall through cleanly
  }

  const offlineRes = matchFixtureForListing(req.listing);
  offlineRes.mode = 'offline';
  return {
    result: offlineRes,
    notice: 'Running in local fixture mode until core/index.ts is built.',
  };
}

function nextLogId(log: LogEntry[]): string {
  return `L${log.length}`;
}

function recomputeActionGates(result: AnalysisResult): void {
  const ics = result.actions.find((a) => a.type === 'export_viewing_ics');
  if (ics && ics.status !== 'done' && ics.status !== 'undone') {
    const ok =
      (result.commute.status === 'feasible' || result.commute.status === 'tight') &&
      result.scam.p < 0.3 &&
      result.escalations.length === 0;
    ics.status = ok ? 'proposed' : 'blocked';
    ics.blockedReason = ok
      ? undefined
      : result.scam.p >= 0.3
        ? `Scam risk ${(result.scam.p * 100).toFixed(0)}% exceeds 30% limit`
        : result.escalations.length > 0
          ? 'Resolve open escalations first'
          : `Commute is ${result.commute.status}`;
  }
}

export function resolveEscalationLocal(
  prev: AnalysisResult,
  escalationId: string,
  answer: string,
): AnalysisResult {
  const next = structuredClone(prev);
  const esc = next.escalations.find((e) => e.id === escalationId);
  if (!esc) return prev;

  next.escalations = next.escalations.filter((e) => e.id !== escalationId);
  const dec = next.decisions.find((d) => d.id === esc.decisionId);
  if (dec) {
    dec.escalated = false;
    dec.reason = `Resolved by student: "${answer}"`;
  }

  next.log.push({
    id: nextLogId(next.log),
    ts: new Date().toISOString(),
    kind: 'action',
    ref: escalationId,
    actor: 'human',
    summary: `Resolved ${esc.decisionId} escalation: ${answer}`,
  });

  // Update draft reply if it was a clause removal request
  if (esc.decisionId === 'D2') {
    const draft = next.actions.find((a) => a.type === 'draft_reply');
    if (draft) {
      draft.payload =
        'Hi! I am interested in the Waterloo sublet. Under Ontario RTA s.14, a no-pets clause is void — could we use the Ontario Standard Lease without that restriction and set up a viewing?';
    }
    const copy = next.actions.find((a) => a.type === 'copy_reply_to_clipboard');
    if (copy && draft) {
      copy.payload = draft.payload;
    }
  }

  // Recompute verdict if no escalations remain and not REFUSE
  if (next.verdict === 'HOLD' && next.escalations.length === 0) {
    const hasVoid = next.clauses.some((c) => c.status === 'void' || c.status === 'questionable');
    if (!hasVoid || answer.toLowerCase().includes('remove') || answer.toLowerCase().includes('confirm')) {
      next.verdict = 'ADMIT';
      next.reasons = [`Escalation resolved (${answer}); cleared to proceed with viewing`];
      const d6 = next.decisions.find((d) => d.id === 'D6');
      if (d6) {
        d6.output = 'ADMIT';
        d6.reason = 'Recomputed after student resolved open escalation';
      }
      next.log.push({
        id: nextLogId(next.log),
        ts: new Date().toISOString(),
        kind: 'decision',
        ref: 'D6',
        actor: 'agent',
        summary: 'Verdict updated to ADMIT after escalation resolution',
      });
    }
  }

  recomputeActionGates(next);
  return next;
}

export function performActionLocal(prev: AnalysisResult, actionId: string): AnalysisResult {
  const next = structuredClone(prev);
  const action = next.actions.find((a) => a.id === actionId);
  if (!action || action.status === 'blocked') return prev;

  action.status = 'done';
  next.log.push({
    id: nextLogId(next.log),
    ts: new Date().toISOString(),
    kind: 'action',
    ref: action.id,
    actor: action.tier === 'confirm' ? 'human' : 'agent',
    summary: `Executed ${action.type.replaceAll('_', ' ')}`,
  });
  return next;
}

export function undoLogEntryLocal(prev: AnalysisResult, logEntryId: string): AnalysisResult {
  const next = structuredClone(prev);
  const target = next.log.find((l) => l.id === logEntryId);
  if (!target || target.kind !== 'action') return prev;

  const action = next.actions.find((a) => a.id === target.ref);
  if (action && action.status === 'done') {
    action.status = 'undone';
  }

  next.log.push({
    id: nextLogId(next.log),
    ts: new Date().toISOString(),
    kind: 'undo',
    ref: target.id,
    actor: 'human',
    summary: `Undid "${target.summary}" (history preserved)`,
  });

  recomputeActionGates(next);
  return next;
}

export function markWrongLocal(
  prev: AnalysisResult,
  decisionId: Decision['id'],
  correction: string,
): { result: AnalysisResult; fixture: RegressionFixture } {
  const next = structuredClone(prev);
  const dec = next.decisions.find((d) => d.id === decisionId);
  const now = new Date().toISOString();

  if (dec) {
    dec.reason = `Human correction pinned: ${correction}`;
    dec.escalated = false;
  }

  // Roll back dependent actions (append-only undo entries)
  for (const act of next.actions) {
    if (act.status === 'done') {
      act.status = 'undone';
      next.log.push({
        id: nextLogId(next.log),
        ts: now,
        kind: 'undo',
        ref: act.id,
        actor: 'agent',
        summary: `Rolled back ${act.type.replaceAll('_', ' ')} due to ${decisionId} correction`,
      });
    }
  }

  // Pin correction in log
  next.log.push({
    id: nextLogId(next.log),
    ts: now,
    kind: 'correction',
    ref: decisionId,
    actor: 'human',
    summary: `Marked ${decisionId} wrong → "${correction}"`,
  });

  // Re-run downstream verdict based on correction text
  const lower = correction.toLowerCase();
  if (lower.includes('admit') || lower.includes('safe') || lower.includes('valid') || lower.includes('false positive')) {
    next.verdict = 'ADMIT';
    next.reasons = [`Corrected at ${decisionId}: ${correction}`];
  } else if (lower.includes('refuse') || lower.includes('scam')) {
    next.verdict = 'REFUSE';
    next.reasons = [`Corrected at ${decisionId}: ${correction}`];
  } else {
    next.verdict = 'HOLD';
    next.reasons = [`Re-evaluating after ${decisionId} correction: ${correction}`];
  }

  const d6 = next.decisions.find((d) => d.id === 'D6');
  if (d6) {
    d6.output = next.verdict;
    d6.reason = `Re-run after ${decisionId} correction`;
  }

  recomputeActionGates(next);

  const fixture: RegressionFixture = {
    listing: next.listing,
    decision_id: decisionId,
    expected: correction,
    recordedAt: now,
  };

  return { result: next, fixture };
}
