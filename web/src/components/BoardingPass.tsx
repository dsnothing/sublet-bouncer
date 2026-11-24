import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Copy,
  Download,
  Info,
  ShieldAlert,
  ShieldCheck,
  TrainFront,
} from 'lucide-react';
import { buildViewingIcs, downloadEvidenceCard, downloadTextFile } from '../ics';
import type { AnalysisResult, ProfileState } from '../types';

interface BoardingPassProps {
  result: AnalysisResult;
  profile: ProfileState;
  isRewinding: boolean;
  notice?: string;
  onPerformAction: (actionId: string) => void;
}

const STAMP_TEXT: Record<AnalysisResult['verdict'], string> = {
  ADMIT: 'ADMIT',
  HOLD: 'HOLD AT THE ROPE',
  REFUSE: 'REFUSE',
};

export const BoardingPass: React.FC<BoardingPassProps> = ({
  result,
  profile,
  isRewinding,
  notice,
  onPerformAction,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const draftAction = result.actions.find((a) => a.type === 'draft_reply');
  const copyAction = result.actions.find((a) => a.type === 'copy_reply_to_clipboard');
  const icsAction = result.actions.find((a) => a.type === 'export_viewing_ics');
  const evidenceAction = result.actions.find((a) => a.type === 'save_evidence_card');

  const draftText =
    typeof draftAction?.payload === 'string'
      ? draftAction.payload
      : 'Could we arrange a viewing before any payment?';

  const handleCopy = async () => {
    if (!copyAction) return;
    try {
      await navigator.clipboard.writeText(draftText);
    } catch {
      // Clipboard API may be restricted in headless contexts; still record the confirmed action
    }
    onPerformAction(copyAction.id);
    setCopiedId(copyAction.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportIcs = () => {
    if (!icsAction || icsAction.status === 'blocked') return;
    const ics = buildViewingIcs(result, profile);
    downloadTextFile(`sublet-viewing-${result.runId}.ics`, ics, 'text/calendar;charset=utf-8');
    onPerformAction(icsAction.id);
  };

  const handleSaveEvidence = () => {
    downloadEvidenceCard(result);
    if (evidenceAction && evidenceAction.status !== 'done') {
      onPerformAction(evidenceAction.id);
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

  return (
    <article
      id="boarding-pass"
      className="boarding-pass"
      data-rewinding={isRewinding ? 'true' : 'false'}
      aria-labelledby="boarding-pass-heading"
    >
      <div className="pass-top-band">
        <span className="pass-airline">WATERLOO CO-OP GATE PASS</span>
        <span className="pass-meta-mono">
          {result.runId} · {result.mode.toUpperCase()}
        </span>
      </div>

      <div className="pass-body">
        <div className="verdict-row">
          <div>
            <h2 id="boarding-pass-heading" className="verdict-route">
              <span>LISTING</span>
              <span aria-hidden="true">→</span>
              <span>{profile.campus}</span>
            </h2>
            <p className="verdict-sub">
              {profile.termStart} to {profile.termEnd} · Earliest class {profile.classStart}
            </p>
          </div>

          <div aria-live="polite" aria-atomic="true">
            <div
              key={`${result.runId}-${result.verdict}`}
              className={`verdict-stamp ${result.verdict}`}
            >
              {result.verdict === 'ADMIT' && <ShieldCheck size={20} aria-hidden="true" />}
              {result.verdict === 'HOLD' && <AlertTriangle size={20} aria-hidden="true" />}
              {result.verdict === 'REFUSE' && <ShieldAlert size={20} aria-hidden="true" />}
              <span>{STAMP_TEXT[result.verdict]}</span>
            </div>
          </div>
        </div>

        {(result.fallbackReason || notice) && (
          <div className="banner-alert info" role="status">
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{result.fallbackReason ?? notice}</span>
          </div>
        )}

        {result.refused && (
          <div className="banner-alert danger" role="alert">
            <ShieldAlert size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Listing refused before scoring: <strong>{result.refused.reason.replaceAll('_', ' ')}</strong>.
            </span>
          </div>
        )}

        {result.rtaApplies === 'may_not_apply' && (
          <div className="banner-alert warn" role="status">
            <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>RTA s.5(i) exemption may apply:</strong> sharing a kitchen or bathroom with the
              owner or their immediate family can remove Ontario RTA protections.
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
                <span>Address could not be verified — commute unknown (escalated).</span>
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
            DRAFT REPLY {result.scam.p > 0.7 ? '(SAFE DECLINE TEMPLATE)' : ''}
          </div>
          <div>{draftAction?.status === 'undone' ? 'Draft rolled back via Undo.' : draftText}</div>
        </div>

        <div className="action-btn-row">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCopy}
            disabled={!copyAction || draftAction?.status === 'undone'}
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

      <footer className="stub-footer">
        <div>
          <strong>Not legal advice.</strong> Sublet Bouncer provides general Ontario Residential
          Tenancies Act information for students. Verify lease terms with UW/WLU legal aid or the
          Landlord and Tenant Board.
        </div>
        {result.couldNotCheck.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>What I could not check:</strong>
            <ul className="could-not-list">
              {result.couldNotCheck.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </footer>
    </article>
  );
};
