import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Info,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrainFront,
  Zap,
} from 'lucide-react';
import { verdictHeadline } from '../../../core/index';
import baselineSamplesRaw from '../data/baseline-samples.json';
import { buildViewingIcs, downloadEvidenceCard, downloadTextFile } from '../ics';
import type { AnalysisResult, DataSourceMode, LanguageLevel, ProfileState, Span } from '../types';

interface BaselineClause {
  category: string;
  quote: string;
  section: string;
  inListing: boolean;
  matchesRule: boolean;
}

interface BaselineSampleEntry {
  listing: string;
  model: string;
  recordedAt: string;
  rawAnswer: string;
  verdict: string;
  clauses: BaselineClause[];
}

interface BaselineSamplesFile {
  model: string;
  date: string;
  samples: Record<'clean' | 'tricky' | 'scammy', BaselineSampleEntry>;
}

const BASELINE_SAMPLES = baselineSamplesRaw as BaselineSamplesFile;
const BASELINE_REPORT_URL =
  'https://github.com/dsnothing/sublet-bouncer/blob/main/evals/RESULTS-BASELINES.md';

function findBaselineSample(listing: string): BaselineSampleEntry | null {
  const entries = Object.values(BASELINE_SAMPLES.samples);
  return entries.find((entry) => entry.listing === listing) ?? null;
}

interface BoardingPassProps {
  result: AnalysisResult;
  profile: ProfileState;
  languageLevel: LanguageLevel;
  isRewinding: boolean;
  isAnalyzing: boolean;
  analyzingSource: DataSourceMode;
  elapsedMs: number;
  notice?: string;
  canRecheckWithGemini: boolean;
  onUseOfflineNow: () => void;
  onRecheckWithGemini: () => void;
  onRunFreshCheck: () => void;
  onPerformAction: (actionId: string, expectedRunId?: string) => boolean;
  onFocusSpan: (span: Span) => void;
}

export function getLiveWaitStage(elapsedMs: number, source: DataSourceMode): string {
  if (source !== 'api') {
    return 'Checking Ontario RTA rules and commute offline…';
  }
  if (elapsedMs < 3500) {
    return 'Reading clauses with Gemini…';
  }
  if (elapsedMs < 8500) {
    return 'Verifying every quote against your listing…';
  }
  return 'Checking Ontario RTA rules and commute…';
}

interface FallbackBannerInfo {
  kind: 'info' | 'simulated' | 'breaker';
  title: string;
  body: string;
  showOfflineExplainer: boolean;
  rawDetail?: string;
}

function classifyFallback(
  mode: AnalysisResult['mode'],
  rawReason?: string,
  model?: string,
  simulated?: boolean,
  breaker?: AnalysisResult['breaker'],
): FallbackBannerInfo | null {
  if (simulated === true) {
    return {
      kind: 'simulated',
      title: 'Simulated outage: Gemini was not called.',
      body: "This is the offline engine's answer, shown the way a real outage would be.",
      showOfflineExplainer: true,
      rawDetail: rawReason ?? 'SIMULATED OUTAGE (demo): Gemini was not called',
    };
  }

  if (breaker === 'open' || (rawReason ?? '').startsWith('Gemini is overloaded right now')) {
    return {
      kind: 'breaker',
      title:
        rawReason ??
        'Gemini is overloaded right now (3 failed calls in the last minute); offline engine used. Try again in about a minute.',
      body: '',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  if (!rawReason && mode !== 'offline-fallback') return null;
  const text = (rawReason ?? '').toLowerCase();

  // Live mode answered via backup model (primary 429/503/timeout -> fallback model succeeded)
  if (mode === 'live' && rawReason) {
    return {
      kind: 'info',
      title: 'Primary Gemini model was busy — used backup model',
      body: `Your listing was still analyzed live${model ? ` with ${model}` : ''}.`,
      showOfflineExplainer: false,
      rawDetail: rawReason,
    };
  }

  // Non-fallback informational notices (e.g. fixture demo mode)
  if (mode !== 'offline-fallback') {
    return {
      kind: 'info',
      title: rawReason ?? '',
      body: '',
      showOfflineExplainer: false,
    };
  }

  // Offline fallback: distinguish visitor limit vs Gemini rate-limit/quota vs timeout vs network
  if (text.includes('limited per visitor') || text.includes('per visitor')) {
    return {
      kind: 'info',
      title: "You've used this visitor's live checks for now.",
      body: 'The offline engine answered; try again in a few minutes.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  if (
    text.includes('429') ||
    text.includes('503') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('resource_exhausted')
  ) {
    return {
      kind: 'info',
      title: 'Gemini hit its free-tier rate limit',
      body: 'Switched to the built-in offline engine so your listing was still checked right away.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  if (text.includes('timeout') || text.includes('timed out') || text.includes('deadline')) {
    return {
      kind: 'info',
      title: 'Live AI took too long to respond',
      body: 'Switched to the built-in offline engine so the page stays responsive.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  if (
    text.includes('unreachable') ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('not configured') ||
    text.includes('econnrefused') ||
    text.includes('http 5')
  ) {
    return {
      kind: 'info',
      title: 'Could not reach the live AI service',
      body: 'Ran the built-in offline engine in your browser instead.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  return {
    kind: 'info',
    title: 'Live AI was unavailable',
    body: 'Ran the built-in offline engine in your browser instead.',
    showOfflineExplainer: true,
    rawDetail: rawReason,
  };
}

const STAMP_TEXT: Record<AnalysisResult['verdict'], string> = {
  ADMIT: 'ADMIT',
  HOLD: 'HOLD AT THE ROPE',
  REFUSE: 'REFUSE',
};

const REFUSAL_COPY: Record<
  NonNullable<AnalysisResult['refused']>['reason'],
  { title: string; body: string; tip: string }
> = {
  non_english: {
    title: 'This listing is not in English',
    body: 'Sublet Bouncer currently checks Ontario Residential Tenancies Act (RTA) clauses and scam signals in English only, so we paused before scoring rather than guessing.',
    tip: 'Translate the listing to English first, then paste it back in for a full check.',
  },
  too_short: {
    title: 'Not enough listing detail to check',
    body: 'This snippet is too short to extract rent, address, or lease terms reliably.',
    tip: 'Paste the full listing text including monthly rent, street address, term dates, and house rules.',
  },
  image_only: {
    title: 'Image or link-only listings are not supported yet',
    body: 'Sublet Bouncer does not scrape external URLs or read text from images in v1.',
    tip: 'Copy and paste the plain text of the listing directly into the editor on the left.',
  },
  injection_only: {
    title: 'Listing contains instructions instead of rental details',
    body: 'Listing text is treated as untrusted data, never instructions. This input appears to contain prompt-override text without a real sublet listing.',
    tip: 'Paste the original sublet advertisement text without embedded instructions.',
  },
};

function formatCachedDate(cachedAt?: string): string | null {
  if (!cachedAt) return null;
  const ms = Date.parse(cachedAt);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(ms));
  } catch {
    return cachedAt.slice(0, 10);
  }
}

export const BoardingPass: React.FC<BoardingPassProps> = ({
  result,
  profile,
  languageLevel,
  isRewinding,
  isAnalyzing,
  analyzingSource,
  elapsedMs,
  notice,
  canRecheckWithGemini,
  onUseOfflineNow,
  onRecheckWithGemini,
  onRunFreshCheck,
  onPerformAction,
  onFocusSpan,
}) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWhyOffline, setShowWhyOffline] = useState<boolean>(false);
  const [showChatbotCompare, setShowChatbotCompare] = useState<boolean>(false);

  const rawFallbackReason = result.fallbackReason ?? notice;
  const isSimulatedOutage = result.simulated === true;
  const isBreakerOpen =
    result.breaker === 'open' || (rawFallbackReason ?? '').startsWith('Gemini is overloaded right now');

  const [breakerCooldownSec, setBreakerCooldownSec] = useState<number>(() => (isBreakerOpen ? 60 : 0));

  useEffect(() => {
    setCopiedId(null);
    setActionError(null);
    setShowWhyOffline(false);
  }, [result.runId]);

  useEffect(() => {
    setShowChatbotCompare(false);
  }, [result.listing]);

  useEffect(() => {
    if (!isBreakerOpen) {
      setBreakerCooldownSec(0);
      return;
    }
    setBreakerCooldownSec(60);
    const id = window.setInterval(() => {
      setBreakerCooldownSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [result.runId, isBreakerOpen]);

  const draftAction = result.actions.find((a) => a.type === 'draft_reply');
  const copyAction = result.actions.find((a) => a.type === 'copy_reply_to_clipboard');
  const icsAction = result.actions.find((a) => a.type === 'export_viewing_ics');
  const evidenceAction = result.actions.find((a) => a.type === 'save_evidence_card');

  const rawAddress = result.fields.address?.value;
  const extractedAddress =
    typeof rawAddress === 'string' && rawAddress.trim().length > 0 ? rawAddress.trim() : null;

  const draftText =
    typeof draftAction?.payload === 'string'
      ? draftAction.payload
      : 'Could we arrange a viewing before any payment?';

  const handleCopy = async () => {
    if (!copyAction || copyAction.status === 'blocked') return;
    const targetRunId = result.runId;
    const targetActionId = copyAction.id;
    setActionError(null);
    try {
      await navigator.clipboard.writeText(draftText);
    } catch {
      setActionError('Clipboard unavailable. Select and copy the draft text manually.');
      return;
    }
    if (!onPerformAction(targetActionId, targetRunId)) return;
    setCopiedId(targetActionId);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === targetActionId ? null : prev));
    }, 1800);
  };

  const handleExportIcs = () => {
    if (!icsAction || icsAction.status === 'blocked') return;
    if (!onPerformAction(icsAction.id, result.runId)) return;
    const ics =
      typeof icsAction.payload === 'string' && icsAction.payload.includes('BEGIN:VCALENDAR')
        ? icsAction.payload
        : buildViewingIcs(result, profile);
    downloadTextFile(`sublet-viewing-${result.runId.slice(0, 8)}.ics`, ics, 'text/calendar;charset=utf-8');
  };

  const handleSaveEvidence = () => {
    downloadEvidenceCard(result);
    if (evidenceAction && evidenceAction.status !== 'done' && evidenceAction.status !== 'blocked') {
      onPerformAction(evidenceAction.id, result.runId);
    }
  };

  const scamPct = Math.round(result.scam.p * 100);
  const commuteTone =
    result.commute.status === 'feasible'
      ? 'ok'
      : result.commute.status === 'tight'
        ? 'warn'
        : result.commute.status === 'infeasible'
          ? 'bad'
          : 'neutral';

  const fallbackInfo = classifyFallback(
    result.mode,
    rawFallbackReason,
    result.model,
    result.simulated,
    result.breaker,
  );

  const noteEscalations = result.escalations.filter((esc) => !esc.blocking);
  const hasRtaAssumptionNote =
    !result.refused &&
    result.rtaApplies === 'applies' &&
    !result.escalations.some((esc) => esc.decisionId === 'D5') &&
    result.couldNotCheck.some((item) => /RTA applies unless/i.test(item));
  const totalNotesCount = noteEscalations.length + (hasRtaAssumptionNote ? 1 : 0);

  const refusalInfo = result.refused ? REFUSAL_COPY[result.refused.reason] : null;
  const shortRunId = result.runId.length > 12 ? result.runId.slice(0, 8) : result.runId;
  const isCachedResult = result.cached === true;
  const cachedDate = isCachedResult ? formatCachedDate(result.cachedAt) : null;
  const savedResultLabel = isCachedResult
    ? [
        'Saved live result',
        result.model ?? 'gemini-3.1-flash-lite',
        ...(cachedDate ? [cachedDate] : []),
      ].join(' · ')
    : null;
  const isReducedConfidence = result.verdictConfidence === 'reduced';
  const confidenceReason = isReducedConfidence
    ? result.verdictConfidenceReason ??
      'Offline mode checks exact wording only; reworded clauses may be missed'
    : undefined;
  const remainingCouldNotCheck = confidenceReason
    ? result.couldNotCheck.filter((item) => item !== confidenceReason)
    : result.couldNotCheck;
  const hasCouldNotCheck = Boolean(confidenceReason) || remainingCouldNotCheck.length > 0;
  const headline = verdictHeadline(result, languageLevel);
  const isOutsideOntario = result.escalations.some(
    (esc) => esc.decisionId === 'D5' && /outside Ontario/i.test(esc.question),
  );

  const resolveSpanForItem = (item: { ruleId?: string; spanText?: string }): Span | null => {
    if (!item.spanText) return null;
    const matchedClause =
      result.clauses.find(
        (c) => c.span.text === item.spanText && (!item.ruleId || c.ruleId === item.ruleId),
      ) ?? result.clauses.find((c) => c.span.text === item.spanText);
    if (matchedClause) return matchedClause.span;
    const idx = result.listing.indexOf(item.spanText);
    if (idx >= 0) {
      return { start: idx, end: idx + item.spanText.length, text: item.spanText };
    }
    return null;
  };

  const renderHeadlineNodes = (): React.ReactNode => {
    const linkItems = headline.items
      .map((item) => ({ item, span: resolveSpanForItem(item) }))
      .filter((entry): entry is { item: (typeof headline.items)[number]; span: Span } => entry.span !== null);

    if (linkItems.length === 0) {
      return headline.text;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    linkItems.forEach(({ item, span }, idx) => {
      const matchIdx = headline.text.indexOf(item.label, cursor);
      if (matchIdx === -1) return;
      if (matchIdx > cursor) {
        nodes.push(
          <React.Fragment key={`t-${idx}`}>{headline.text.slice(cursor, matchIdx)}</React.Fragment>,
        );
      }
      nodes.push(
        <button
          key={`l-${idx}`}
          type="button"
          className="headline-span-link"
          title={`Jump to "${span.text}" in listing`}
          onClick={() => onFocusSpan(span)}
          data-testid="headline-span-link"
        >
          {item.label}
        </button>,
      );
      cursor = matchIdx + item.label.length;
    });

    if (cursor < headline.text.length) {
      nodes.push(<React.Fragment key="t-end">{headline.text.slice(cursor)}</React.Fragment>);
    }

    return nodes;
  };

  const baselineSample = !result.refused ? findBaselineSample(result.listing) : null;
  const showRecheckBtn =
    isReducedConfidence && (canRecheckWithGemini || isBreakerOpen) && !result.refused;
  const showFreshCheckBtn = isCachedResult && !result.refused;

  return (
    <article
      id="boarding-pass"
      className="boarding-pass"
      data-rewinding={isRewinding ? 'true' : 'false'}
      aria-busy={isAnalyzing ? 'true' : 'false'}
      aria-labelledby="boarding-pass-heading"
    >
      <div className={`pass-top-band${isSimulatedOutage ? ' simulated' : ''}`}>
        <span className="pass-airline">WATERLOO CO-OP GATE PASS</span>
        <span className="pass-meta-mono" data-testid="pass-top-meta">
          {shortRunId} ·{' '}
          {isSimulatedOutage
            ? 'SIMULATED'
            : isCachedResult
              ? 'SAVED LIVE'
              : result.mode.toUpperCase()}
          {!isSimulatedOutage && result.model ? ` · ${result.model}` : ''}
        </span>
      </div>

      {isAnalyzing && (
        <div className="live-wait-bar" role="status" aria-live="polite" data-testid="live-wait-bar">
          <div className="live-wait-head">
            <span className="live-wait-stage">{getLiveWaitStage(elapsedMs, analyzingSource)}</span>
            <span className="live-wait-timer">{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          {analyzingSource === 'api' && (
            <div className="live-wait-actions">
              <span className="live-wait-hint">Free-tier Gemini can take up to 20 s.</span>
              <button type="button" className="btn-offline-now" onClick={onUseOfflineNow}>
                <Zap size={14} aria-hidden="true" />
                <span>Use offline now</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="pass-body">
        <div className="verdict-hero">
          <div className="verdict-live-wrap" aria-live="polite" aria-atomic="true">
            <h2
              id="boarding-pass-heading"
              className={`verdict-headline ${result.verdict}${isReducedConfidence ? ' reduced' : ''}`}
              data-testid="verdict-headline"
            >
              {renderHeadlineNodes()}
            </h2>

            <div className="verdict-stamp-col">
              <div
                key={`${result.runId}-${result.verdict}-${result.verdictConfidence}`}
                className={`verdict-stamp ${result.verdict}${isReducedConfidence ? ' reduced' : ''}`}
                data-verdict-confidence={result.verdictConfidence}
              >
                {result.verdict === 'ADMIT' && <ShieldCheck size={16} aria-hidden="true" />}
                {result.verdict === 'HOLD' && <AlertTriangle size={16} aria-hidden="true" />}
                {result.verdict === 'REFUSE' && <ShieldAlert size={16} aria-hidden="true" />}
                <span>{STAMP_TEXT[result.verdict]}</span>
                {result.verdict === 'ADMIT' && !result.refused && totalNotesCount > 0 && (
                  <span className="sr-only">
                    , with {totalNotesCount} non-blocking {totalNotesCount === 1 ? 'note' : 'notes'} to confirm
                  </span>
                )}
              </div>
              {isReducedConfidence && (
                <span className="confidence-tag" data-testid="confidence-tag">
                  Checked offline — exact wording only
                </span>
              )}
              {savedResultLabel && (
                <span className="saved-result-tag" data-testid="saved-result-tag">
                  {savedResultLabel}
                </span>
              )}
            </div>
          </div>

          {(showRecheckBtn || showFreshCheckBtn) && (
            <div className="verdict-hero-actions">
              {showRecheckBtn && (
                <button
                  type="button"
                  className="btn-recheck-gemini"
                  onClick={onRecheckWithGemini}
                  disabled={isAnalyzing || breakerCooldownSec > 0}
                  data-testid="recheck-gemini-btn"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span className="recheck-btn-label">
                    {breakerCooldownSec > 0
                      ? `Re-check with Gemini (${breakerCooldownSec}s)`
                      : 'Re-check with Gemini'}
                  </span>
                </button>
              )}
              {showFreshCheckBtn && (
                <button
                  type="button"
                  className="btn-fresh-check"
                  onClick={onRunFreshCheck}
                  disabled={isAnalyzing}
                  data-testid="run-fresh-check-btn"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span>Run fresh check</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="verdict-meta-row">
          <div className="verdict-route">
            <span className={extractedAddress ? 'verdict-address' : 'verdict-address unlisted'}>
              {extractedAddress ?? 'Unlisted address'}
            </span>
            <span aria-hidden="true">→</span>
            <span>{profile.campus}</span>
          </div>
          {!extractedAddress && !result.refused && (
            <p className="verdict-esc-hint">
              No geocodable street address found — confirm via Escalation Queue or pin a D1 correction.
            </p>
          )}
          <p className="verdict-sub">
            {profile.termStart} to {profile.termEnd} · Earliest class {profile.classStart}
          </p>
        </div>

        {fallbackInfo && (
          <div
            className={`banner-alert ${
              fallbackInfo.kind === 'simulated'
                ? 'simulated'
                : fallbackInfo.kind === 'breaker'
                  ? 'breaker'
                  : 'info'
            } fallback-banner`}
            role="status"
            aria-live={fallbackInfo.kind === 'simulated' || fallbackInfo.kind === 'breaker' ? 'polite' : undefined}
            data-testid={
              fallbackInfo.kind === 'simulated'
                ? 'simulated-outage-banner'
                : fallbackInfo.kind === 'breaker'
                  ? 'breaker-open-banner'
                  : 'fallback-banner'
            }
          >
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="fallback-banner-body">
              <div>
                {fallbackInfo.kind === 'simulated' && (
                  <span className="simulated-pill">SIMULATED</span>
                )}
                <strong>
                  {fallbackInfo.title}
                  {fallbackInfo.body && !/[.!?]$/.test(fallbackInfo.title) ? '.' : ''}
                </strong>
                {fallbackInfo.body ? ` ${fallbackInfo.body}` : ''}
              </div>
              {fallbackInfo.kind === 'simulated' && fallbackInfo.rawDetail && (
                <div className="simulated-api-label">{fallbackInfo.rawDetail}</div>
              )}
              {fallbackInfo.showOfflineExplainer && (
                <div className="fallback-links-row">
                  <button
                    type="button"
                    className="fallback-why-btn"
                    aria-expanded={showWhyOffline}
                    aria-controls="why-offline-panel"
                    onClick={() => setShowWhyOffline((v) => !v)}
                  >
                    {showWhyOffline ? 'Hide why offline still works' : 'Why offline still works'}
                  </button>
                </div>
              )}
              {showWhyOffline && fallbackInfo.showOfflineExplainer && (
                <div id="why-offline-panel" className="fallback-why-panel">
                  <p style={{ margin: '0 0 6px 0' }}>
                    Offline mode runs the same verified 12-section Ontario RTA rule table, Waterloo GTFS
                    commute lookup, and scam-risk scorer locally in your browser. Live Gemini only adds
                    extraction for unusual phrasing and paraphrased clauses.
                  </p>
                  {fallbackInfo.rawDetail && (
                    <p className="fallback-tech-detail">Detail: {fallbackInfo.rawDetail}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {refusalInfo && result.refused && (
          <section className="refusal-card" role="alert" aria-label="Listing refused">
            <div className="refusal-card-head">
              <ShieldAlert size={18} aria-hidden="true" />
              <h3>{refusalInfo.title}</h3>
              <span className="status-pill bad">{result.refused.reason.replaceAll('_', ' ')}</span>
            </div>
            <p className="refusal-card-body">{refusalInfo.body}</p>
            <p className="refusal-card-tip">
              <strong>Next step:</strong> {refusalInfo.tip}
            </p>
          </section>
        )}

        {!result.refused && result.rtaApplies === 'may_not_apply' && (
          <div className="banner-alert warn" role="status">
            <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            {isOutsideOntario ? (
              <span>
                <strong>Outside Ontario detected:</strong> Ontario&apos;s Residential Tenancies Act may
                not apply; check local tenancy law before paying anything.
              </span>
            ) : (
              <span>
                <strong>RTA s.5(i) exemption may apply:</strong> sharing a kitchen or bathroom with the
                owner or their immediate family can remove Ontario RTA protections.
              </span>
            )}
          </div>
        )}

        {!result.refused && result.verdict === 'ADMIT' && totalNotesCount > 0 && (
          <div className="admit-notes-callout" role="note" data-testid="admit-notes-callout">
            <Info size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>
                Admitted with {totalNotesCount} {totalNotesCount === 1 ? 'note' : 'notes'} to confirm.
              </strong>{' '}
              {noteEscalations.length > 0
                ? 'Nothing blocks this verdict; confirm open notes in the Accountability ledger to unlock viewing export.'
                : "Nothing blocks this verdict; Ontario RTA applies unless you'd share a kitchen or bathroom with the owner."}
            </span>
          </div>
        )}

        {result.reasons.length > 0 && (
          <ul className="reasons-list" aria-label="Verdict reasons">
            {result.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        )}

        {baselineSample && (
          <section className="chatbot-compare-section" aria-label="Plain chatbot comparison">
            <button
              type="button"
              className="chatbot-compare-toggle"
              aria-expanded={showChatbotCompare}
              aria-controls="chatbot-comparison-panel"
              onClick={() => setShowChatbotCompare((v) => !v)}
              data-testid="chatbot-compare-toggle"
            >
              <span className="chatbot-compare-toggle-label">
                <MessageSquare size={14} aria-hidden="true" />
                <span>What a plain chatbot said</span>
              </span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={`chatbot-compare-chevron${showChatbotCompare ? ' open' : ''}`}
              />
            </button>

            {showChatbotCompare && (
              <div
                id="chatbot-comparison-panel"
                className="chatbot-compare-panel"
                data-testid="chatbot-comparison-panel"
              >
                <p className="chatbot-compare-provenance">
                  Saved output from a plain chatbot prompt (Gemini 3.1 Flash-Lite), not a live call,
                  run {BASELINE_SAMPLES.date}.
                </p>

                <div className="chatbot-compare-grid">
                  <div className="chatbot-compare-col">
                    <div className="chatbot-col-head">
                      <h3 className="chatbot-col-title">Plain chatbot</h3>
                      <span
                        className={`status-pill ${
                          baselineSample.verdict === 'ADMIT'
                            ? 'ok'
                            : baselineSample.verdict === 'HOLD'
                              ? 'warn'
                              : 'bad'
                        }`}
                      >
                        {baselineSample.verdict}
                      </span>
                    </div>

                    {baselineSample.clauses.length === 0 ? (
                      <p className="chatbot-empty-note">No clauses flagged.</p>
                    ) : (
                      <ul className="chatbot-clause-list">
                        {baselineSample.clauses.map((clause, idx) => (
                          <li key={idx} className="chatbot-clause-item">
                            <div className="chatbot-clause-quote">
                              {clause.inListing ? (
                                <span>&ldquo;{clause.quote}&rdquo;</span>
                              ) : (
                                <>
                                  <del className="chatbot-struck">&ldquo;{clause.quote}&rdquo;</del>
                                  <span className="chatbot-flag-badge">not in the listing</span>
                                </>
                              )}
                            </div>
                            <div className="chatbot-clause-meta">
                              <span className="chatbot-cat-chip">{clause.category}</span>
                              {clause.matchesRule ? (
                                <span className="chatbot-sec-chip">{clause.section}</span>
                              ) : (
                                <>
                                  <del className="chatbot-struck chatbot-sec-struck">
                                    {clause.section}
                                  </del>
                                  <span className="chatbot-flag-badge">
                                    doesn&apos;t match the rule
                                  </span>
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="chatbot-compare-col bouncer">
                    <div className="chatbot-col-head">
                      <h3 className="chatbot-col-title">Sublet Bouncer</h3>
                      <span
                        className={`status-pill ${
                          result.verdict === 'ADMIT'
                            ? 'ok'
                            : result.verdict === 'HOLD'
                              ? 'warn'
                              : 'bad'
                        }`}
                      >
                        {result.verdict}
                      </span>
                    </div>

                    {result.clauses.length === 0 ? (
                      <p className="chatbot-empty-note">No clauses flagged.</p>
                    ) : (
                      <ul className="chatbot-clause-list">
                        {result.clauses.map((clause, idx) => (
                          <li key={idx} className="chatbot-clause-item">
                            <div className="chatbot-clause-quote">
                              <button
                                type="button"
                                className="chatbot-span-jump"
                                onClick={() => onFocusSpan(clause.span)}
                                title={`Jump to "${clause.span.text}" in listing`}
                              >
                                &ldquo;{clause.span.text}&rdquo;
                              </button>
                            </div>
                            <div className="chatbot-clause-meta">
                              {clause.ruleId && (
                                <span className="chatbot-cat-chip">{clause.ruleId}</span>
                              )}
                              {clause.section && (
                                <span className="chatbot-sec-verified">{clause.section}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <p className="chatbot-compare-honest-note">
                  The plain chatbot found the violations but cited law sections that don&apos;t
                  match the verified table; Bouncer&apos;s quotes and sections are verified.{' '}
                  <a
                    href={BASELINE_REPORT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="chatbot-report-link"
                  >
                    Full comparison: evals/RESULTS-BASELINES.md
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {!result.refused && (
        <>
          <div className="pass-perforation" aria-hidden="true">
            <div className="pass-perforation-line" />
          </div>

          <div className="pass-body" style={{ paddingTop: 10 }}>
            <div className="telemetry-grid">
              {/* Commute Strip */}
              <div className="telemetry-box">
                <div className="telemetry-header">
                  <h3 className="telemetry-title">
                    <TrainFront
                      size={14}
                      aria-hidden="true"
                      style={{ verticalAlign: '-2px', marginRight: 6 }}
                    />
                    Commute to {profile.campus}
                  </h3>
                  <span className={`status-pill ${commuteTone}`}>{result.commute.status}</span>
                </div>
                <div className="commute-metrics">
                  {result.commute.minutes !== undefined ? (
                    <>
                      <span>
                        Duration: <strong>{result.commute.minutes} min</strong>
                      </span>
                      {result.commute.arriveBy && (
                        <span>
                          Arrive by: <strong>{result.commute.arriveBy}</strong>
                        </span>
                      )}
                      {result.commute.summary && <span>{result.commute.summary}</span>}
                    </>
                  ) : (
                    <span>
                      {result.commute.summary ??
                        'Address could not be verified — commute unknown (added to Notes to confirm).'}
                    </span>
                  )}
                </div>
              </div>

              {/* Scam Meter */}
              <div className="telemetry-box">
                <div className="telemetry-header">
                  <h3 className="telemetry-title">Scam risk</h3>
                  <span
                    className={`status-pill ${
                      result.scam.band === 'proceed'
                        ? 'ok'
                        : result.scam.band === 'escalate'
                          ? 'warn'
                          : 'bad'
                    }`}
                  >
                    {scamPct}% · {result.scam.band}
                  </span>
                </div>

                <div
                  className="scam-track-wrap"
                  role="meter"
                  aria-label="Scam risk probability"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={scamPct}
                >
                  <div className="scam-track">
                    <div
                      className={`scam-fill ${result.scam.band}`}
                      style={{ width: `${Math.min(100, Math.max(2, scamPct))}%` }}
                    />
                  </div>
                  <div className="scam-tick" style={{ left: '30%' }} aria-hidden="true" />
                  <span className="scam-tick-label" style={{ left: '30%' }}>
                    0.30 escalate
                  </span>
                  <div className="scam-tick" style={{ left: '70%' }} aria-hidden="true" />
                  <span className="scam-tick-label" style={{ left: '70%' }}>
                    0.70 block
                  </span>
                </div>

                {result.scam.topFeatures.length > 0 && (
                  <div className="scam-features" aria-label="Top scam signals">
                    {result.scam.topFeatures.slice(0, 3).map((feat) => (
                      <span key={feat.name} className="feature-chip">
                        {feat.name} ({feat.weight >= 0 ? '+' : ''}
                        {feat.weight.toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pass-perforation" aria-hidden="true">
            <div className="pass-perforation-line" />
          </div>

          <div className="pass-body" style={{ paddingTop: 10 }}>
            <div className="telemetry-header" style={{ marginBottom: 8 }}>
              <h3 className="telemetry-title">Safe actions (never sends, pays, or signs)</h3>
              {draftAction?.status === 'undone' && (
                <span className="status-pill warn">Draft undone</span>
              )}
            </div>

            <div className="draft-box">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 4 }}>
                DRAFT REPLY {result.scam.p > 0.7 || result.verdict === 'REFUSE' ? '(SAFE DECLINE TEMPLATE)' : ''}
              </div>
              <div>{draftAction?.status === 'undone' ? 'Draft rolled back via Undo.' : draftText}</div>
            </div>

            {actionError && <p role="alert">{actionError}</p>}
            <div className="action-btn-row">
              <button
                type="button"
                className="btn-primary"
                onClick={handleCopy}
                disabled={!copyAction || copyAction.status === 'blocked' || draftAction?.status === 'undone'}
              >
                {copiedId ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                <span>{copiedId ? 'Copied reply' : 'Copy reply'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportIcs}
                disabled={!icsAction || icsAction.status === 'blocked'}
              >
                <CalendarPlus size={16} aria-hidden="true" />
                <span>Export viewing .ics</span>
              </button>

              <button type="button" className="btn-secondary" onClick={handleSaveEvidence}>
                <Download size={16} aria-hidden="true" />
                <span>Save evidence card</span>
              </button>
            </div>

            {icsAction?.status === 'blocked' && icsAction.blockedReason && (
              <p className="blocked-note">
                Viewing invite locked: {icsAction.blockedReason}.
              </p>
            )}
          </div>
        </>
      )}

      {hasCouldNotCheck && (
        <section className="could-not-check-panel" aria-labelledby="could-not-check-heading">
          <h3 id="could-not-check-heading" className="could-not-check-title">
            <EyeOff size={14} aria-hidden="true" />
            <span>What I couldn&apos;t check</span>
          </h3>
          <ul className="could-not-list">
            {confidenceReason && (
              <li className="could-not-confidence-item" data-testid="confidence-reason-item">
                <strong>Reduced confidence:</strong> {confidenceReason}
              </li>
            )}
            {remainingCouldNotCheck.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="stub-footer">
        <div>
          <strong>Not legal advice.</strong> Sublet Bouncer provides general Ontario Residential
          Tenancies Act information for students. Verify lease terms with UW/WLU legal aid or the
          Landlord and Tenant Board.
        </div>
      </footer>
    </article>
  );
};
