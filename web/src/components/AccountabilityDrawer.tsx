import React, { useState } from 'react';
import { Download, RotateCcw, ShieldBan } from 'lucide-react';
import { downloadRegressionFixture } from '../ics';
import type { AnalysisResult, Commute, Decision, RegressionFixture, Span, Verdict } from '../types';

interface AccountabilityDrawerProps {
  result: AnalysisResult;
  isRewinding: boolean;
  lastFixture: RegressionFixture | null;
  engineError?: string;
  onResolveEscalation: (escId: string, answer: string) => void;
  onUndo: (logEntryId: string) => void;
  onMarkWrong: (decisionId: Decision['id'], correction: unknown) => void;
  onFocusSpan: (span: Span) => void;
}

export const AccountabilityDrawer: React.FC<AccountabilityDrawerProps> = ({
  result,
  isRewinding,
  lastFixture,
  engineError,
  onResolveEscalation,
  onUndo,
  onMarkWrong,
  onFocusSpan,
}) => {
  const [editingDecision, setEditingDecision] = useState<Decision['id'] | null>(null);
  const [d1Address, setD1Address] = useState('');
  const [d1Rent, setD1Rent] = useState('');
  const [d3Prob, setD3Prob] = useState('0.10');
  const [d4Status, setD4Status] = useState<Commute['status']>('feasible');
  const [d4Minutes, setD4Minutes] = useState('15');
  const [d5Value, setD5Value] = useState<AnalysisResult['rtaApplies']>('applies');
  const [d6Verdict, setD6Verdict] = useState<Verdict>('ADMIT');

  const undoneLogIds = new Set(
    result.log.filter((entry) => entry.kind === 'undo').map((entry) => entry.ref),
  );

  const openEditor = (decisionId: Decision['id']) => {
    setEditingDecision(decisionId);
    if (decisionId === 'D1') {
      const addr = result.fields.address?.value;
      const rent = result.fields.rent?.value;
      setD1Address(typeof addr === 'string' ? addr : '');
      setD1Rent(rent !== undefined && rent !== null ? String(rent) : '');
    } else if (decisionId === 'D3') {
      setD3Prob(result.scam.p > 0.3 ? '0.15' : '0.80');
    } else if (decisionId === 'D4') {
      setD4Status(result.commute.status === 'feasible' ? 'infeasible' : 'feasible');
      setD4Minutes(result.commute.minutes !== undefined ? String(result.commute.minutes) : '15');
    } else if (decisionId === 'D5') {
      setD5Value(result.rtaApplies === 'applies' ? 'may_not_apply' : 'applies');
    } else if (decisionId === 'D6') {
      setD6Verdict(result.verdict === 'ADMIT' ? 'HOLD' : 'ADMIT');
    }
  };

  const handleSubmitCorrection = (decisionId: Decision['id']) => {
    let correction: unknown;
    if (decisionId === 'D1') {
      const nextFields = structuredClone(result.fields);
      if (d1Address.trim()) {
        nextFields.address = { value: d1Address.trim(), confidence: 1 };
      }
      const parsedRent = Number(d1Rent);
      if (d1Rent.trim() && Number.isFinite(parsedRent) && parsedRent > 0) {
        nextFields.rent = { value: parsedRent, confidence: 1 };
      }
      correction = nextFields;
    } else if (decisionId === 'D2') {
      correction = [];
    } else if (decisionId === 'D3') {
      const parsed = Number(d3Prob);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return;
      correction = parsed;
    } else if (decisionId === 'D4') {
      const mins = Number(d4Minutes);
      correction = {
        status: d4Status,
        ...(Number.isFinite(mins) && mins > 0 ? { minutes: mins } : {}),
        summary: `Human confirmed commute as ${d4Status}`,
      };
    } else if (decisionId === 'D5') {
      correction = d5Value;
    } else if (decisionId === 'D6') {
      correction = d6Verdict;
    } else {
      return;
    }

    onMarkWrong(decisionId, correction);
    setEditingDecision(null);
  };

  return (
    <aside
      id="accountability-drawer"
      className="drawer-surface"
      data-rewinding={isRewinding ? 'true' : 'false'}
      aria-labelledby="accountability-heading"
    >
      <div className="drawer-header">
        <h2 id="accountability-heading" className="drawer-title">
          Accountability ledger
        </h2>
        <span className="conf-readout">{result.decisions.length} decisions</span>
      </div>

      {engineError && (
        <div className="drawer-error" role="alert">
          {engineError}
        </div>
      )}

      {/* Escalation Queue */}
      <section className="drawer-section" aria-labelledby="escalations-heading">
        <h3 id="escalations-heading" className="drawer-section-title">
          <span>Escalation queue</span>
          <span className="conf-readout">{result.escalations.length} open</span>
        </h3>

        {result.escalations.length === 0 ? (
          <div className="drawer-card" style={{ fontSize: 12, color: 'var(--drawer-muted)' }}>
            No open escalations. All gates cleared or decided.
          </div>
        ) : (
          result.escalations.map((esc) => {
            const requiresTypedCorrection =
              esc.decisionId === 'D4' ||
              (esc.decisionId === 'D1' &&
                /confirm (?:the monthly rent|address|rent)/i.test(esc.question));
            return (
              <div key={esc.id} className="drawer-card">
                <p className="esc-question">
                  [{esc.decisionId}] {esc.question}
                </p>
                {esc.evidence.length > 0 && (
                  <div className="evidence-spans-row" style={{ marginBottom: 8 }}>
                    {esc.evidence.map((span, idx) => (
                      <button
                        key={`${span.start}-${span.end}-${idx}`}
                        type="button"
                        className="evidence-span-btn"
                        onClick={() => onFocusSpan(span)}
                      >
                        &ldquo;{span.text.slice(0, 42)}
                        {span.text.length > 42 ? '…' : ''}&rdquo;
                      </button>
                    ))}
                  </div>
                )}
                <div className="esc-options">
                  {requiresTypedCorrection && (
                    <button
                      type="button"
                      className="esc-opt-btn"
                      onClick={() => {
                        openEditor(esc.decisionId);
                        document
                          .getElementById(`decision-card-${esc.decisionId}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      Supply {esc.decisionId} value
                    </button>
                  )}
                  {esc.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="esc-opt-btn"
                      onClick={() => onResolveEscalation(esc.id, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Typed Decisions + Bouncer was wrong */}
      <section className="drawer-section" aria-labelledby="decisions-heading">
        <h3 id="decisions-heading" className="drawer-section-title">
          <span>Typed decisions (D1–D7)</span>
        </h3>

        {lastFixture && (
          <div className="fixture-toast" role="status" data-testid="fixture-toast">
            <span>Regression fixture ready ({lastFixture.decision_id}).</span>
            <button
              type="button"
              className="wrong-btn"
              onClick={() => downloadRegressionFixture(lastFixture)}
            >
              <Download size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Download JSON
            </button>
          </div>
        )}

        <div style={{ marginTop: lastFixture ? 10 : 0 }}>
          {result.decisions.map((dec) => {
            const isEditing = editingDecision === dec.id;
            const confPct = Math.round(Math.max(0, Math.min(1, dec.confidence)) * 100);
            const threshPct =
              dec.threshold !== undefined
                ? Math.round(Math.max(0, Math.min(1, dec.threshold)) * 100)
                : undefined;
            const belowThreshold = threshPct !== undefined && confPct < threshPct;

            return (
              <div key={dec.id} id={`decision-card-${dec.id}`} className="drawer-card">
                <div className="decision-row-top">
                  <span className="decision-id-wrap">
                    <span>
                      {dec.id} {dec.label}
                    </span>
                    <span className={`kind-chip ${dec.kind.replace('+', '-')}`}>{dec.kind}</span>
                  </span>
                  <span className={`conf-readout${belowThreshold ? ' warn' : ''}`}>
                    {confPct}%{threshPct !== undefined ? ` / ${threshPct}%` : ''}
                  </span>
                </div>

                {/* Confidence vs threshold meter */}
                <div
                  className="conf-meter-wrap"
                  role="meter"
                  aria-label={`${dec.id} confidence ${confPct}%${threshPct !== undefined ? `, threshold ${threshPct}%` : ''}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={confPct}
                >
                  <div className="conf-meter-track">
                    <div
                      className={`conf-meter-fill ${belowThreshold ? 'warn' : 'ok'}`}
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                  {threshPct !== undefined && (
                    <div
                      className="conf-meter-tick"
                      style={{ left: `${threshPct}%` }}
                      title={`Threshold ${threshPct}%`}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <p className="decision-reason">
                  {dec.reason}
                  {dec.escalated ? ' · Escalated' : ''}
                </p>

                {dec.evidence.length > 0 && (
                  <div className="evidence-spans-row" aria-label={`${dec.id} evidence spans`}>
                    {dec.evidence.map((span, idx) => (
                      <button
                        key={`${span.start}-${span.end}-${idx}`}
                        type="button"
                        className="evidence-span-btn"
                        title="Jump to evidence in listing"
                        onClick={() => onFocusSpan(span)}
                      >
                        &ldquo;{span.text.slice(0, 36)}
                        {span.text.length > 36 ? '…' : ''}&rdquo;
                      </button>
                    ))}
                  </div>
                )}

                {dec.id === 'D7' ? (
                  <span className="conf-readout" style={{ display: 'inline-block', marginTop: 4 }}>
                    Policy gate locked in code
                  </span>
                ) : !isEditing ? (
                  <button
                    type="button"
                    className="wrong-btn"
                    onClick={() => openEditor(dec.id)}
                  >
                    Bouncer was wrong
                  </button>
                ) : (
                  <div className="correction-form">
                    {dec.id === 'D1' && (
                      <>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d1-addr">
                          Corrected address
                        </label>
                        <input
                          id="corr-d1-addr"
                          type="text"
                          className="correction-input"
                          placeholder="e.g. 250 Lester Street"
                          value={d1Address}
                          onChange={(e) => setD1Address(e.target.value)}
                        />
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d1-rent">
                          Corrected monthly rent ($)
                        </label>
                        <input
                          id="corr-d1-rent"
                          type="number"
                          className="correction-input"
                          placeholder="e.g. 950"
                          value={d1Rent}
                          onChange={(e) => setD1Rent(e.target.value)}
                        />
                      </>
                    )}

                    {dec.id === 'D2' && (
                      <p className="decision-reason" style={{ margin: 0 }}>
                        Clear flagged clauses (mark clauses as valid / false positive) and recompute verdict.
                      </p>
                    )}

                    {dec.id === 'D3' && (
                      <>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d3-prob">
                          Corrected scam probability (0.00 – 1.00)
                        </label>
                        <input
                          id="corr-d3-prob"
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          className="correction-input"
                          value={d3Prob}
                          onChange={(e) => setD3Prob(e.target.value)}
                        />
                      </>
                    )}

                    {dec.id === 'D4' && (
                      <>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d4-status">
                          Corrected commute status
                        </label>
                        <select
                          id="corr-d4-status"
                          className="correction-input"
                          value={d4Status}
                          onChange={(e) => setD4Status(e.target.value as Commute['status'])}
                        >
                          <option value="feasible">feasible</option>
                          <option value="tight">tight</option>
                          <option value="infeasible">infeasible</option>
                          <option value="unknown">unknown</option>
                        </select>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d4-mins">
                          Minutes (optional)
                        </label>
                        <input
                          id="corr-d4-mins"
                          type="number"
                          className="correction-input"
                          value={d4Minutes}
                          onChange={(e) => setD4Minutes(e.target.value)}
                        />
                      </>
                    )}

                    {dec.id === 'D5' && (
                      <>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d5">
                          Corrected RTA applicability
                        </label>
                        <select
                          id="corr-d5"
                          className="correction-input"
                          value={d5Value}
                          onChange={(e) => setD5Value(e.target.value as AnalysisResult['rtaApplies'])}
                        >
                          <option value="applies">applies (owner does not share kitchen/bath)</option>
                          <option value="may_not_apply">may_not_apply (s.5(i) shared with owner)</option>
                          <option value="unknown">unknown</option>
                        </select>
                      </>
                    )}

                    {dec.id === 'D6' && (
                      <>
                        <label className="field-label" style={{ color: 'var(--drawer-muted)' }} htmlFor="corr-d6">
                          Corrected verdict
                        </label>
                        <select
                          id="corr-d6"
                          className="correction-input"
                          value={d6Verdict}
                          onChange={(e) => setD6Verdict(e.target.value as Verdict)}
                        >
                          <option value="ADMIT">ADMIT</option>
                          <option value="HOLD">HOLD</option>
                          <option value="REFUSE">REFUSE</option>
                        </select>
                      </>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="esc-opt-btn"
                        style={{ minHeight: 36, flex: 1 }}
                        onClick={() => handleSubmitCorrection(dec.id)}
                      >
                        Pin correction &amp; rewind
                      </button>
                      <button
                        type="button"
                        className="wrong-btn"
                        onClick={() => setEditingDecision(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Permission Matrix */}
      <section className="drawer-section" aria-labelledby="permissions-heading">
        <h3 id="permissions-heading" className="drawer-section-title">
          <span>Permission matrix</span>
          <ShieldBan size={14} aria-hidden="true" />
        </h3>

        <table className="perm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Tier</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Analyze, draft reply, evidence card</td>
              <td>
                <span className="tier-badge auto">Auto</span>
              </td>
              <td>Safe decline if scam &gt;70%</td>
            </tr>
            <tr>
              <td>Copy reply, export viewing .ics</td>
              <td>
                <span className="tier-badge confirm">Confirm</span>
              </td>
              <td>Human click + gates clear</td>
            </tr>
            <tr>
              <td>Send message, pay, sign, contact</td>
              <td>
                <span className="tier-badge never">Never</span>
              </td>
              <td>Blocked in code</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Append-only Action Log */}
      <section className="drawer-section" aria-labelledby="action-log-heading">
        <h3 id="action-log-heading" className="drawer-section-title">
          <span>Action log (append-only)</span>
          <span className="conf-readout">{result.log.length} entries</span>
        </h3>

        <ol className="log-list">
          {[...result.log].reverse().map((entry) => {
            const hasInverse = Boolean((entry as { inverse?: unknown }).inverse);
            const canUndo =
              entry.kind === 'action' &&
              hasInverse &&
              !undoneLogIds.has(entry.id) &&
              result.actions.some((a) => a.id === entry.ref && a.status === 'done');
            const shortId = entry.id.length > 10 ? entry.id.slice(0, 8) : entry.id;
            return (
              <li key={entry.id} className={`log-item ${entry.kind}`}>
                <div>
                  <span className="log-meta">
                    {shortId} · {entry.kind.toUpperCase()} · {entry.actor}
                  </span>
                  <span>{entry.summary}</span>
                </div>
                {canUndo && (
                  <button
                    type="button"
                    className="undo-btn"
                    onClick={() => onUndo(entry.id)}
                    aria-label={`Undo ${entry.summary}`}
                  >
                    <RotateCcw
                      size={12}
                      aria-hidden="true"
                      style={{ verticalAlign: '-1px', marginRight: 4 }}
                    />
                    Undo
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
  );
};
