import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Copy,
  Download,
  EyeOff,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrainFront,
  Zap,
} from 'lucide-react';
import { buildViewingIcs, downloadEvidenceCard, downloadTextFile } from '../ics';
import type { AnalysisResult, DataSourceMode, ProfileState } from '../types';

interface BoardingPassProps {
  result: AnalysisResult;
  profile: ProfileState;
  isRewinding: boolean;
  isAnalyzing: boolean;
  analyzingSource: DataSourceMode;
  elapsedMs: number;
  notice?: string;
  canRecheckWithGemini: boolean;
  onUseOfflineNow: () => void;
  onRecheckWithGemini: () => void;
  onPerformAction: (actionId: string, expectedRunId?: string) => boolean;
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
  title: string;
  body: string;
  showOfflineExplainer: boolean;
  rawDetail?: string;
}

function classifyFallback(
  mode: AnalysisResult['mode'],
  rawReason?: string,
  model?: string,
): FallbackBannerInfo | null {
  if (!rawReason && mode !== 'offline-fallback') return null;
  const text = (rawReason ?? '').toLowerCase();

  // Live mode answered via backup model (primary 429/503/timeout -> fallback model succeeded)
  if (mode === 'live' && rawReason) {
    return {
      title: 'Primary Gemini model was busy — used backup model',
      body: `Your listing was still analyzed live${model ? ` with ${model}` : ''}.`,
      showOfflineExplainer: false,
      rawDetail: rawReason,
    };
  }

  // Non-fallback informational notices (e.g. fixture demo mode)
  if (mode !== 'offline-fallback') {
    return {
      title: rawReason ?? '',
      body: '',
      showOfflineExplainer: false,
    };
  }

  // Offline fallback: distinguish rate-limit/quota vs timeout vs network
  if (
    text.includes('429') ||
    text.includes('503') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('resource_exhausted')
  ) {
    return {
      title: 'Gemini hit its free-tier rate limit',
      body: 'Switched to the built-in offline engine so your listing was still checked right away.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  if (text.includes('timeout') || text.includes('timed out') || text.includes('deadline')) {
    return {
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
      title: 'Could not reach the live AI service',
      body: 'Ran the built-in offline engine in your browser instead.',
      showOfflineExplainer: true,
      rawDetail: rawReason,
    };
  }

  return {
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

export const BoardingPass: React.FC<BoardingPassProps> = ({
  result,
  profile,
  isRewinding,
  isAnalyzing,
  analyzingSource,
  elapsedMs,
  notice,
  canRecheckWithGemini,
  onUseOfflineNow,
  onRecheckWithGemini,
  onPerformAction,
}) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWhyOffline, setShowWhyOffline] = useState<boolean>(false);

  useEffect(() => {
    setCopiedId(null);
    setActionError(null);
    setShowWhyOffline(false);
  }, [result.runId]);

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

  const rawFallbackReason = result.fallbackReason ?? notice;
  const fallbackInfo = classifyFallback(result.mode, rawFallbackReason, result.model);

  const noteEscalations = result.escalations.filter((esc) => !esc.blocking);
  const hasRtaAssumptionNote =
    !result.refused &&
    result.rtaApplies === 'applies' &&
    !result.escalations.some((esc) => esc.decisionId === 'D5') &&
    result.couldNotCheck.some((item) => /RTA applies unless/i.test(item));
  const totalNotesCount = noteEscalations.length + (hasRtaAssumptionNote ? 1 : 0);

  const refusalInfo = result.refused ? REFUSAL_COPY[result.refused.reason] : null;
  const shortRunId = result.runId.length > 12 ? result.runId.slice(0, 8) : result.runId;
  const isReducedConfidence = result.verdictConfidence === 'reduced';
  const confidenceReason = isReducedConfidence
    ? result.verdictConfidenceReason ??
      'Offline mode checks exact wording only; reworded clauses may be missed'
    : undefined;
  const remainingCouldNotCheck = confidenceReason
    ? result.couldNotCheck.filter((item) => item !== confidenceReason)
    : result.couldNotCheck;
  const hasCouldNotCheck = Boolean(confidenceReason) || remainingCouldNotCheck.length > 0;

  return (
    <article
      id="boarding-pass"
      className="boarding-pass"
      data-rewinding={isRewinding ? 'true' : 'false'}
      aria-busy={isAnalyzing ? 'true' : 'false'}
      aria-labelledby="boarding-pass-heading"
    >
      <div className="pass-top-band">
        <span className="pass-airline">WATERLOO CO-OP GATE PASS</span>
        <span className="pass-meta-mono">
          {shortRunId} · {result.mode.toUpperCase()}
          {result.model ? ` · ${result.model}` : ''}
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
        <div className="verdict-row">
          <div className="verdict-heading-wrap">
            <h2 id="boarding-pass-heading" className="verdict-route">
              <span className={extractedAddress ? 'verdict-address' : 'verdict-address unlisted'}>
                {extractedAddress ?? 'Unlisted address'}
              </span>
              <span aria-hidden="true">→</span>
              <span>{profile.campus}</span>
            </h2>
            {!extractedAddress && !result.refused && (
              <p className="verdict-esc-hint">
                No geocodable street address found — confirm via Escalation Queue or pin a D1 correction.
              </p>
            )}
            <p className="verdict-sub">
              {profile.termStart} to {profile.termEnd} · Earliest class {profile.classStart}
            </p>
          </div>

          <div className="verdict-stamp-col">
            <div className="verdict-live-wrap" aria-live="polite" aria-atomic="true">
              <div
                key={`${result.runId}-${result.verdict}-${result.verdictConfidence}`}
                className={`verdict-stamp ${result.verdict}${isReducedConfidence ? ' reduced' : ''}`}
                data-verdict-confidence={result.verdictConfidence}
              >
                {result.verdict === 'ADMIT' && <ShieldCheck size={20} aria-hidden="true" />}
                {result.verdict === 'HOLD' && <AlertTriangle size={20} aria-hidden="true" />}
                {result.verdict === 'REFUSE' && <ShieldAlert size={20} aria-hidden="true" />}
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
            </div>
            {isReducedConfidence && canRecheckWithGemini && !result.refused && (
              <button
                type="button"
                className="btn-recheck-gemini"
                onClick={onRecheckWithGemini}
                disabled={isAnalyzing}
                data-testid="recheck-gemini-btn"
              >
                <RefreshCw size={13} aria-hidden="true" />
                <span>Re-check with Gemini</span>
              </button>
            )}
          </div>
        </div>

        {fallbackInfo && (
          <div className="banner-alert info fallback-banner" role="status" data-testid="fallback-banner">
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="fallback-banner-body">
              <div>
                <strong>
                  {fallbackInfo.title}
                  {fallbackInfo.body && !/[.!?]$/.test(fallbackInfo.title) ? '.' : ''}
                </strong>
                {fallbackInfo.body ? ` ${fallbackInfo.body}` : ''}
              </div>
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
            <span>
              <strong>RTA s.5(i) exemption may apply:</strong> sharing a kitchen or bathroom with the
              owner or their immediate family can remove Ontario RTA protections.
            </span>
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
