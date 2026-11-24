import {
  DEFAULT_PROFILE,
  type ActionRecord,
  type AnalysisResult,
  type ClauseFinding,
  type Commute,
  type DataSourceMode,
  type Decision,
  type DecisionKind,
  type LanguageLevel,
  type LogEntry,
  type ProfileState,
  type SampleKey,
  type Span,
  type Verdict,
} from './types';

export const STORAGE_KEY = 'sublet-bouncer:v3';
const LEGACY_STORAGE_KEY = 'sublet-bouncer:v2';
const SCHEMA_VERSION = 3;

export interface PersistedState {
  schemaVersion?: number;
  listing: string;
  profile: ProfileState;
  analyzedProfile: ProfileState;
  dataSource: DataSourceMode;
  languageLevel: LanguageLevel;
  drawerOpen: boolean;
  activeSample: SampleKey | null;
  result: AnalysisResult | null;
  breakerRetryAt?: number | null;
}

const VALID_VERDICTS = new Set<Verdict>(['ADMIT', 'HOLD', 'REFUSE']);
const VALID_MODES = new Set<AnalysisResult['mode']>(['live', 'offline', 'offline-fallback']);
const VALID_VERDICT_CONFIDENCE = new Set<AnalysisResult['verdictConfidence']>(['standard', 'reduced']);
const VALID_RTA = new Set<AnalysisResult['rtaApplies']>(['applies', 'may_not_apply', 'unknown']);
const VALID_COMMUTE = new Set<Commute['status']>(['feasible', 'tight', 'infeasible', 'unknown']);
const VALID_SCAM_BAND = new Set<AnalysisResult['scam']['band']>(['proceed', 'escalate', 'block']);
const VALID_DECISION_IDS = new Set<Decision['id']>(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
const VALID_DECISION_KINDS = new Set<DecisionKind>(['llm', 'llm+rules', 'rules', 'model']);
const VALID_CLAUSE_STATUS = new Set<ClauseFinding['status']>(['void', 'questionable', 'ok']);
const VALID_ACTION_TYPES = new Set<ActionRecord['type']>([
  'draft_reply',
  'save_evidence_card',
  'export_viewing_ics',
  'copy_reply_to_clipboard',
]);
const VALID_ACTION_TIERS = new Set<ActionRecord['tier']>(['auto', 'confirm']);
const VALID_ACTION_STATUS = new Set<ActionRecord['status']>(['proposed', 'done', 'undone', 'blocked']);
const VALID_LOG_KINDS = new Set<LogEntry['kind']>(['decision', 'action', 'undo', 'correction']);
const VALID_LOG_ACTORS = new Set<LogEntry['actor']>(['agent', 'human']);
const VALID_REFUSALS = new Set(['non_english', 'too_short', 'image_only', 'injection_only']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidSpan(v: unknown, maxLen: number): v is Span {
  if (!isRecord(v)) return false;
  return (
    typeof v.text === 'string' &&
    isFiniteNumber(v.start) &&
    isFiniteNumber(v.end) &&
    v.start >= 0 &&
    v.end > v.start &&
    v.end <= maxLen
  );
}

function isValidProfile(v: unknown): v is ProfileState {
  if (!isRecord(v)) return false;
  return (
    (v.campus === 'UW' || v.campus === 'WLU') &&
    typeof v.termStart === 'string' &&
    v.termStart.length > 0 &&
    typeof v.termEnd === 'string' &&
    v.termEnd.length > 0 &&
    typeof v.classStart === 'string' &&
    v.classStart.length > 0
  );
}

function isValidAction(v: unknown): v is ActionRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.type === 'string' &&
    VALID_ACTION_TYPES.has(v.type as ActionRecord['type']) &&
    typeof v.tier === 'string' &&
    VALID_ACTION_TIERS.has(v.tier as ActionRecord['tier']) &&
    typeof v.status === 'string' &&
    VALID_ACTION_STATUS.has(v.status as ActionRecord['status']) &&
    'payload' in v &&
    (v.blockedReason === undefined || typeof v.blockedReason === 'string')
  );
}

function isValidLogEntry(v: unknown): v is LogEntry {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.ts === 'string' &&
    typeof v.kind === 'string' &&
    VALID_LOG_KINDS.has(v.kind as LogEntry['kind']) &&
    typeof v.ref === 'string' &&
    typeof v.actor === 'string' &&
    VALID_LOG_ACTORS.has(v.actor as LogEntry['actor']) &&
    typeof v.summary === 'string' &&
    (v.confidence === undefined || isFiniteNumber(v.confidence)) &&
    (v.threshold === undefined || isFiniteNumber(v.threshold))
  );
}

/**
 * Deeply validates a persisted AnalysisResult and recomputes permission gates
 * so tampered or stale storage can never crash the UI or bypass action guards.
 */
export function validateAndSanitizeResult(raw: unknown): AnalysisResult | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.runId !== 'string' || raw.runId.length === 0) return null;
  if (typeof raw.mode !== 'string' || !VALID_MODES.has(raw.mode as AnalysisResult['mode'])) return null;
  if (typeof raw.listing !== 'string') return null;
  if (typeof raw.verdict !== 'string' || !VALID_VERDICTS.has(raw.verdict as Verdict)) return null;
  if (typeof raw.rtaApplies !== 'string' || !VALID_RTA.has(raw.rtaApplies as AnalysisResult['rtaApplies'])) {
    return null;
  }
  if (raw.fallbackReason !== undefined && typeof raw.fallbackReason !== 'string') return null;
  if (raw.model !== undefined && typeof raw.model !== 'string') return null;
  if (raw.cached !== undefined && typeof raw.cached !== 'boolean') return null;
  if (raw.simulated !== undefined && typeof raw.simulated !== 'boolean') return null;
  if (raw.breaker !== undefined && raw.breaker !== 'open') return null;
  if (raw.cachedAt !== undefined && typeof raw.cachedAt !== 'string') return null;
  if (
    typeof raw.verdictConfidence !== 'string' ||
    !VALID_VERDICT_CONFIDENCE.has(raw.verdictConfidence as AnalysisResult['verdictConfidence'])
  ) {
    return null;
  }
  if (raw.verdictConfidenceReason !== undefined && typeof raw.verdictConfidenceReason !== 'string') {
    return null;
  }

  const listingLen = raw.listing.length;

  // Validate fields
  if (!isRecord(raw.fields)) return null;
  for (const val of Object.values(raw.fields)) {
    if (!isRecord(val) || !('value' in val) || !isFiniteNumber(val.confidence)) return null;
    if (val.span !== undefined && !isValidSpan(val.span, listingLen)) return null;
  }

  // Validate scam
  if (!isRecord(raw.scam)) return null;
  if (!isFiniteNumber(raw.scam.p) || raw.scam.p < 0 || raw.scam.p > 1) return null;
  if (typeof raw.scam.band !== 'string' || !VALID_SCAM_BAND.has(raw.scam.band as AnalysisResult['scam']['band'])) {
    return null;
  }
  if (!Array.isArray(raw.scam.topFeatures)) return null;
  for (const f of raw.scam.topFeatures) {
    if (!isRecord(f) || typeof f.name !== 'string' || !isFiniteNumber(f.weight)) return null;
  }

  // Validate commute
  if (!isRecord(raw.commute)) return null;
  if (typeof raw.commute.status !== 'string' || !VALID_COMMUTE.has(raw.commute.status as Commute['status'])) {
    return null;
  }
  if (raw.commute.minutes !== undefined && !isFiniteNumber(raw.commute.minutes)) return null;
  if (raw.commute.summary !== undefined && typeof raw.commute.summary !== 'string') return null;
  if (raw.commute.arriveBy !== undefined && typeof raw.commute.arriveBy !== 'string') return null;

  // Validate clauses
  if (!Array.isArray(raw.clauses)) return null;
  for (const c of raw.clauses) {
    if (!isRecord(c)) return null;
    if (!isValidSpan(c.span, listingLen)) return null;
    if (c.ruleId !== null && typeof c.ruleId !== 'string') return null;
    if (typeof c.status !== 'string' || !VALID_CLAUSE_STATUS.has(c.status as ClauseFinding['status'])) return null;
    if (typeof c.lesson !== 'string' || typeof c.lessonSimple !== 'string') return null;
    if (!isFiniteNumber(c.confidence)) return null;
  }

  // Validate decisions
  if (!Array.isArray(raw.decisions) || raw.decisions.length === 0) return null;
  for (const d of raw.decisions) {
    if (!isRecord(d)) return null;
    if (typeof d.id !== 'string' || !VALID_DECISION_IDS.has(d.id as Decision['id'])) return null;
    if (typeof d.kind !== 'string' || !VALID_DECISION_KINDS.has(d.kind as DecisionKind)) return null;
    if (typeof d.label !== 'string' || typeof d.reason !== 'string') return null;
    if (!isFiniteNumber(d.confidence) || typeof d.escalated !== 'boolean') return null;
    if (d.threshold !== undefined && !isFiniteNumber(d.threshold)) return null;
    if (!Array.isArray(d.evidence) || !d.evidence.every((s) => isValidSpan(s, listingLen))) return null;
  }

  // Validate escalations
  if (!Array.isArray(raw.escalations)) return null;
  for (const e of raw.escalations) {
    if (!isRecord(e)) return null;
    if (typeof e.id !== 'string' || typeof e.question !== 'string') return null;
    if (typeof e.decisionId !== 'string' || !VALID_DECISION_IDS.has(e.decisionId as Decision['id'])) return null;
    if (typeof e.blocking !== 'boolean') return null;
    if (!Array.isArray(e.options) || !e.options.every((o) => typeof o === 'string')) return null;
    if (!Array.isArray(e.evidence) || !e.evidence.every((s) => isValidSpan(s, listingLen))) return null;
  }

  // Validate actions, log, reasons, couldNotCheck, refused
  if (!Array.isArray(raw.actions) || !raw.actions.every(isValidAction)) return null;
  if (!Array.isArray(raw.log) || !raw.log.every(isValidLogEntry)) return null;
  if (!Array.isArray(raw.reasons) || !raw.reasons.every((r) => typeof r === 'string')) return null;
  if (!Array.isArray(raw.couldNotCheck) || !raw.couldNotCheck.every((c) => typeof c === 'string')) return null;
  if (raw.refused !== undefined) {
    if (!isRecord(raw.refused) || typeof raw.refused.reason !== 'string' || !VALID_REFUSALS.has(raw.refused.reason)) {
      return null;
    }
  }

  const sanitized = structuredClone(raw) as unknown as AnalysisResult;

  // Recompute permission gates deterministically so stale/tampered storage cannot unlock blocked actions.
  const canICS =
    !sanitized.refused &&
    (sanitized.commute.status === 'feasible' || sanitized.commute.status === 'tight') &&
    sanitized.scam.p < 0.3 &&
    sanitized.escalations.length === 0;

  sanitized.actions = sanitized.actions.map((action) => {
    if (action.type === 'export_viewing_ics') {
      if (!canICS) {
        return {
          ...action,
          tier: 'confirm',
          status: 'blocked',
          blockedReason: sanitized.refused
            ? 'Input cannot be analyzed'
            : 'Requires feasible commute, scam risk below 0.30, and no open questions',
        };
      }
      if (action.status === 'blocked') {
        return { ...action, tier: 'confirm', status: 'proposed', blockedReason: undefined };
      }
    }
    if ((action.type === 'draft_reply' || action.type === 'copy_reply_to_clipboard') && sanitized.refused) {
      return {
        ...action,
        status: 'blocked',
        blockedReason: 'Input cannot be analyzed',
      };
    }
    return action;
  });

  return sanitized;
}

export function loadInitialState(
  fixturesAllowed: boolean,
  defaultListing: string,
): PersistedState {
  const defaultSource: DataSourceMode = fixturesAllowed ? 'fixtures' : 'api';
  const fallback: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    listing: defaultListing,
    profile: DEFAULT_PROFILE,
    analyzedProfile: DEFAULT_PROFILE,
    dataSource: defaultSource,
    languageLevel: 'plain',
    drawerOpen: true,
    activeSample: 'tricky',
    result: null,
    breakerRetryAt: null,
  };

  try {
    const rawV3 = window.localStorage.getItem(STORAGE_KEY);
    const rawLegacy = rawV3 ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const raw = rawV3 ?? rawLegacy;
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed.listing !== 'string') {
      return fallback;
    }

    const storedSource = parsed.dataSource ?? defaultSource;
    const safeSource: DataSourceMode =
      storedSource === 'offline'
        ? 'offline'
        : storedSource === 'fixtures' && fixturesAllowed
          ? 'fixtures'
          : 'api';

    const safeProfile = isValidProfile(parsed.profile) ? parsed.profile : DEFAULT_PROFILE;
    const safeAnalyzedProfile = isValidProfile(parsed.analyzedProfile) ? parsed.analyzedProfile : safeProfile;

    // Only restore persisted AnalysisResult from v3 schema after deep validation + gate recomputation.
    const validatedResult =
      rawV3 && parsed.schemaVersion === SCHEMA_VERSION && parsed.result
        ? validateAndSanitizeResult(parsed.result)
        : null;

    return {
      schemaVersion: SCHEMA_VERSION,
      listing: parsed.listing,
      profile: safeProfile,
      analyzedProfile: validatedResult ? safeAnalyzedProfile : safeProfile,
      dataSource: safeSource,
      languageLevel: parsed.languageLevel === 'simple' ? 'simple' : 'plain',
      drawerOpen: typeof parsed.drawerOpen === 'boolean' ? parsed.drawerOpen : true,
      activeSample:
        parsed.activeSample === 'clean' || parsed.activeSample === 'tricky' || parsed.activeSample === 'scammy'
          ? parsed.activeSample
          : null,
      result: validatedResult,
      breakerRetryAt:
        validatedResult && isFiniteNumber(parsed.breakerRetryAt) ? parsed.breakerRetryAt : null,
    };
  } catch {
    return fallback;
  }
}

export function savePersistedState(state: Omit<PersistedState, 'schemaVersion'>): void {
  try {
    const payload: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      ...state,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-mode errors per SPEC §6
  }
}
