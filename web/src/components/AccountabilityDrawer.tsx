import React, { useState } from 'react';
import { Download, RotateCcw, ShieldBan } from 'lucide-react';
import { downloadRegressionFixture } from '../ics';
import type { AnalysisResult, Decision, RegressionFixture } from '../types';

interface AccountabilityDrawerProps {
  result: AnalysisResult;
  isRewinding: boolean;
  lastFixture: RegressionFixture | null;
  onResolveEscalation: (escId: string, answer: string) => void;
  onUndo: (logEntryId: string) => void;
  onMarkWrong: (decisionId: Decision['id'], correction: string) => void;
}

export const AccountabilityDrawer: React.FC<AccountabilityDrawerProps> = ({
  result,
  isRewinding,
  lastFixture,
  onResolveEscalation,
  onUndo,
  onMarkWrong,
}) => {
  const [editingDecision, setEditingDecision] = useState<Decision['id'] | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [customEscalationInput, setCustomEscalationInput] = useState<Record<string, string>>({});

  const undoneLogIds = new Set(
    result.log.filter((entry) => entry.kind === 'undo').map((entry) => entry.ref),
  );

  const handleSubmitCorrection = (decisionId: Decision['id']) => {
    const trimmed = correctionText.trim();
    if (!trimmed) return;
    onMarkWrong(decisionId, trimmed);
    setEditingDecision(null);
    setCorrectionText('');
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
            const needsTextInput = esc.options.some((o) =>
              o.toLowerCase().includes('provide address'),
            );
            return (
              <div key={esc.id} className="drawer-card">
                <p className="esc-question">
                  [{esc.decisionId}] {esc.question}
                </p>
                {needsTextInput && (
                  <input
                    type="text"
                    className="correction-input"
                    style={{ marginBottom: 8 }}
                    placeholder="e.g. 203 Lester St, Waterloo"
                    aria-label={`Answer for ${esc.question}`}
                    value={customEscalationInput[esc.id] ?? ''}
                    onChange={(e) =>
                      setCustomEscalationInput((prev) => ({
                        ...prev,
                        [esc.id]: e.target.value,
                      }))
                    }
                  />
                )}
                <div className="esc-options">
                  {esc.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="esc-opt-btn"
                      onClick={() => {
                        const val =
                          needsTextInput && customEscalationInput[esc.id]?.trim()
                            ? `${opt}: ${customEscalationInput[esc.id].trim()}`
                            : opt;
                        onResolveEscalation(esc.id, val);
                      }}
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
          <div className="fixture-toast" role="status">
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
            return (
              <div key={dec.id} className="drawer-card">
                <div className="decision-row-top">
                  <span className="decision-id-wrap">
                    <span>
                      {dec.id} {dec.label}
                    </span>
                    <span className={`kind-chip ${dec.kind}`}>{dec.kind}</span>
                  </span>
                  <span className="conf-readout">
                    {Math.round(dec.confidence * 100)}%
                    {dec.threshold !== undefined ? ` / ${Math.round(dec.threshold * 100)}%` : ''}
                  </span>
                </div>
                <p className="decision-reason">
                  {dec.reason}
                  {dec.escalated ? ' · Escalated' : ''}
                </p>

                {!isEditing ? (
                  <button
                    type="button"
                    className="wrong-btn"
                    onClick={() => {
                      setEditingDecision(dec.id);
                      setCorrectionText('');
                    }}
                  >
                    Bouncer was wrong
                  </button>
                ) : (
                  <div className="correction-form">
                    <label className="sr-only" htmlFor={`corr-${dec.id}`}>
                      Correction for {dec.id}
                    </label>
                    <input
                      id={`corr-${dec.id}`}
                      type="text"
                      className="correction-input"
                      placeholder="What should the right outcome be? (e.g. Safe, ADMIT)"
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmitCorrection(dec.id);
                        if (e.key === 'Escape') setEditingDecision(null);
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="esc-opt-btn"
                        style={{ minHeight: 36, flex: 1 }}
                        onClick={() => handleSubmitCorrection(dec.id)}
                      >
                        Pin correction & rewind
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
            const canUndo =
              entry.kind === 'action' &&
              !undoneLogIds.has(entry.id) &&
              result.actions.some((a) => a.id === entry.ref && a.status === 'done');
            return (
              <li key={entry.id} className={`log-item ${entry.kind}`}>
                <div>
                  <span className="log-meta">
                    {entry.id} · {entry.kind.toUpperCase()} · {entry.actor}
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
