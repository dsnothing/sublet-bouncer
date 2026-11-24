import React, { useEffect, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  checkApiReachable,
  getSampleListing,
  isFixturesDemoEnabled,
  markWrongEngine,
  performActionEngine,
  resolveEscalationEngine,
  runAnalysis,
  undoLogEntryEngine,
} from './adapter';
import { AccountabilityDrawer } from './components/AccountabilityDrawer';
import { BoardingPass, getLiveWaitStage } from './components/BoardingPass';
import { HighlightedListing } from './components/HighlightedListing';
import { ListingEditor } from './components/ListingEditor';
import { loadInitialState, savePersistedState } from './storage';
import {
  type AnalysisResult,
  type DataSourceMode,
  type Decision,
  type LanguageLevel,
  type ProfileState,
  type RegressionFixture,
  type SampleKey,
  type Span,
} from './types';

export const App: React.FC = () => {
  const fixturesAllowed = isFixturesDemoEnabled();
  const [initial] = useState(() => loadInitialState(fixturesAllowed, getSampleListing('tricky')));

  const [listing, setListing] = useState<string>(initial.listing);
  const [profile, setProfile] = useState<ProfileState>(initial.profile);
  const [analyzedProfile, setAnalyzedProfile] = useState<ProfileState>(initial.analyzedProfile);
  const [dataSource, setDataSource] = useState<DataSourceMode>(initial.dataSource);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>(initial.languageLevel);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(initial.drawerOpen);
  const [activeSample, setActiveSample] = useState<SampleKey | null>(initial.activeSample);
  const [result, setResult] = useState<AnalysisResult | null>(initial.result);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [engineError, setEngineError] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingSource, setAnalyzingSource] = useState<DataSourceMode>(initial.dataSource);
  const [analyzingSimulated, setAnalyzingSimulated] = useState<boolean>(false);
  const [breakerRetryAt, setBreakerRetryAt] = useState<number | null>(initial.breakerRetryAt ?? null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isRewinding, setIsRewinding] = useState<boolean>(false);
  const [apiReachable, setApiReachable] = useState<boolean>(false);
  const [lastFixture, setLastFixture] = useState<RegressionFixture | null>(null);
  const [focusedSpan, setFocusedSpan] = useState<Span | null>(null);
  const [focusSeq, setFocusSeq] = useState<number>(0);
  const rewindTimerRef = useRef<number | null>(null);
  const analysisSeqRef = useRef(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<AnalysisResult | null>(initial.result);
  const didAutoRunRef = useRef<boolean>(false);
  const topbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const syncHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty('--topbar-height', `${h}px`);
      }
    };
    syncHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, []);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    savePersistedState({
      listing,
      profile,
      analyzedProfile,
      dataSource,
      languageLevel,
      drawerOpen,
      activeSample,
      result,
      breakerRetryAt,
    });
  }, [listing, profile, analyzedProfile, dataSource, languageLevel, drawerOpen, activeSample, result, breakerRetryAt]);

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!result) return;
    if (result.mode === 'live') {
      setApiReachable(true);
      return;
    }
    if (result.verdictConfidence !== 'reduced') return;
    const controller = new AbortController();
    void checkApiReachable(controller.signal).then((reachable) => {
      if (!controller.signal.aborted) {
        setApiReachable(reachable);
      }
    });
    return () => controller.abort();
  }, [result?.runId, result?.mode, result?.verdictConfidence]);

  useEffect(() => {
    return () => {
      if (rewindTimerRef.current !== null) {
        window.clearTimeout(rewindTimerRef.current);
      }
      activeAbortRef.current?.abort();
    };
  }, []);

  const executeAnalysis = async (
    text: string,
    prof: ProfileState,
    source: DataSourceMode,
    options?: { noCache?: boolean; simulateOutage?: boolean },
  ) => {
    if (!text.trim()) return;
    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;

    const seq = ++analysisSeqRef.current;
    setIsAnalyzing(true);
    setAnalyzingSource(source);
    setAnalyzingSimulated(Boolean(options?.simulateOutage));
    setNotice(undefined);
    setEngineError(undefined);
    try {
      const { result: nextResult, notice: nextNotice } = await runAnalysis(
        {
          listing: text,
          profile: prof,
          mode: source === 'api' ? 'live' : 'offline',
          ...(options?.noCache ? { noCache: true } : {}),
          ...(options?.simulateOutage ? { simulateOutage: true } : {}),
        },
        source,
        { signal: controller.signal },
      );
      if (seq !== analysisSeqRef.current) return;
      resultRef.current = nextResult;
      const isBreaker =
        nextResult.breaker === 'open' ||
        (nextResult.fallbackReason ?? nextNotice ?? '').startsWith('Gemini is overloaded right now');
      setBreakerRetryAt(isBreaker ? Date.now() + 60_000 : null);
      setResult(nextResult);
      setAnalyzedProfile(prof);
      setNotice(nextNotice);
      setLastFixture(null);
      setFocusedSpan(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (seq === analysisSeqRef.current) setNotice(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      if (seq === analysisSeqRef.current) {
        setIsAnalyzing(false);
        setAnalyzingSimulated(false);
        if (activeAbortRef.current === controller) {
          activeAbortRef.current = null;
        }
      }
    }
  };

  const handleUseOfflineNow = () => {
    activeAbortRef.current?.abort();
    setDataSource('offline');
    void executeAnalysis(listing, profile, 'offline');
  };

  const handleRecheckWithGemini = () => {
    setDataSource('api');
    const bypassCache = resultRef.current?.simulated === true;
    void executeAnalysis(listing, profile, 'api', bypassCache ? { noCache: true } : undefined);
  };

  const handleRunFreshCheck = () => {
    setDataSource('api');
    void executeAnalysis(listing, profile, 'api', { noCache: true });
  };

  const handleSimulateOutage = () => {
    void executeAnalysis(listing, profile, 'api', { simulateOutage: true });
  };

  // Run initial analysis automatically on first load when no persisted result exists
  useEffect(() => {
    if (didAutoRunRef.current || result !== null) return;
    didAutoRunRef.current = true;
    void executeAnalysis(listing, profile, dataSource);
  }, []);

  const triggerRewind = () => {
    if (rewindTimerRef.current !== null) {
      window.clearTimeout(rewindTimerRef.current);
    }
    setIsRewinding(false);
    window.requestAnimationFrame(() => {
      setIsRewinding(true);
      rewindTimerRef.current = window.setTimeout(() => {
        setIsRewinding(false);
        rewindTimerRef.current = null;
      }, 360);
    });
  };

  const handleSelectSample = (key: SampleKey) => {
    const sampleText = getSampleListing(key);
    setActiveSample(key);
    setListing(sampleText);
    void executeAnalysis(sampleText, profile, dataSource);
  };

  const handleAnalyze = () => {
    void executeAnalysis(listing, profile, dataSource);
  };

  const handleResolveEscalation = (escId: string, answer: string) => {
    if (!result) return;
    setEngineError(undefined);
    const { result: next, error } = resolveEscalationEngine(result, escId, answer);
    if (error) {
      setEngineError(error);
      return;
    }
    setResult(next);
  };

  const handlePerformAction = (actionId: string, expectedRunId?: string) => {
    const current = resultRef.current;
    if (!current) return false;
    if (expectedRunId && current.runId !== expectedRunId) return false;
    setEngineError(undefined);
    const { result: next, error } = performActionEngine(current, actionId);
    if (error) {
      setEngineError(error);
      return false;
    }
    resultRef.current = next;
    setResult(next);
    return true;
  };

  const handleUndo = (logEntryId: string) => {
    if (!result) return;
    setEngineError(undefined);
    const { result: next, error } = undoLogEntryEngine(result, logEntryId);
    if (error) {
      setEngineError(error);
      return;
    }
    triggerRewind();
    setResult(next);
  };

  const handleMarkWrong = (decisionId: Decision['id'], correction: unknown) => {
    if (!result) return;
    setEngineError(undefined);
    const { result: updated, fixture, error } = markWrongEngine(result, decisionId, correction);
    if (error) {
      setEngineError(error);
      return;
    }
    triggerRewind();
    setResult(updated);
    if (fixture) {
      setLastFixture(fixture);
    }
  };

  const handleFocusSpan = (span: Span) => {
    setFocusedSpan(span);
    setFocusSeq((n) => n + 1);
  };

  const jumpTo = (id: string) => {
    if (id === 'accountability-drawer' && !drawerOpen) {
      setDrawerOpen(true);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const scamPct = result ? Math.round(result.scam.p * 100) : 0;
  const blockingCount = result ? result.escalations.filter((e) => e.blocking).length : 0;
  const noteCount = result ? result.escalations.filter((e) => !e.blocking).length : 0;

  return (
    <>
      <a className="skip-link" href="#boarding-pass">
        Skip to verdict boarding pass
      </a>

      <header className="topbar" ref={topbarRef}>
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              SB
            </span>
            <div>
              <h1 className="brand-title">Sublet Bouncer</h1>
              <div className="brand-gate">WATERLOO CO-OP SUBLET GATE</div>
            </div>
          </div>

          <div className="topbar-controls">
            <div className="seg-group" role="group" aria-label="Analysis mode">
              <button
                type="button"
                className="seg-btn"
                aria-pressed={dataSource === 'api'}
                onClick={() => setDataSource('api')}
              >
                Live LLM
              </button>
              <button
                type="button"
                className="seg-btn"
                aria-pressed={dataSource === 'offline'}
                onClick={() => setDataSource('offline')}
              >
                Offline
              </button>
              {fixturesAllowed && (
                <button
                  type="button"
                  className="seg-btn"
                  aria-pressed={dataSource === 'fixtures'}
                  onClick={() => setDataSource('fixtures')}
                >
                  Fixtures
                </button>
              )}
            </div>

            <div className="seg-group" role="group" aria-label="Explanation language level">
              <button
                type="button"
                className="seg-btn"
                aria-pressed={languageLevel === 'plain'}
                onClick={() => setLanguageLevel('plain')}
              >
                Plain
              </button>
              <button
                type="button"
                className="seg-btn"
                aria-pressed={languageLevel === 'simple'}
                onClick={() => setLanguageLevel('simple')}
              >
                Simple English
              </button>
            </div>

            <button
              type="button"
              className="drawer-toggle-btn"
              aria-expanded={drawerOpen}
              aria-controls="accountability-drawer"
              onClick={() => setDrawerOpen((v) => !v)}
            >
              {drawerOpen ? (
                <PanelRightClose size={16} aria-hidden="true" />
              ) : (
                <PanelRightOpen size={16} aria-hidden="true" />
              )}
              <span>Accountability</span>
              {blockingCount > 0 ? (
                <span
                  className="esc-count-pill"
                  aria-label={`${blockingCount} blocking ${blockingCount === 1 ? 'question' : 'questions'}`}
                >
                  {blockingCount}
                </span>
              ) : noteCount > 0 ? (
                <span
                  className="esc-count-pill notes"
                  aria-label={`${noteCount} ${noteCount === 1 ? 'note' : 'notes'} to confirm`}
                >
                  {noteCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sticky verdict strip (<1024px) */}
      <nav className="mobile-verdict-strip" aria-label="Sticky verdict summary">
        <div className="mobile-chips">
          <span
            className={`status-pill ${
              !result
                ? 'neutral'
                : result.verdict === 'ADMIT'
                  ? 'ok'
                  : result.verdict === 'HOLD'
                    ? 'warn'
                    : 'bad'
            }${result?.verdictConfidence === 'reduced' ? ' reduced' : ''}`}
          >
            {result
              ? result.simulated
                ? `${result.verdict} · SIMULATED`
                : result.verdictConfidence === 'reduced'
                  ? `${result.verdict} · OFFLINE`
                  : result.cached
                    ? `${result.verdict} · SAVED`
                    : result.verdict
              : 'CHECKING'}
          </span>
          {result && !result.refused && (
            <>
              <span className="status-pill neutral">Scam {scamPct}%</span>
              <span className="status-pill neutral">
                {result.commute.minutes !== undefined ? `${result.commute.minutes}m` : result.commute.status}
              </span>
            </>
          )}
        </div>
        <div className="mobile-jump-row">
          <button type="button" className="mobile-jump-btn" onClick={() => jumpTo('listing-panel')}>
            Listing
          </button>
          <button type="button" className="mobile-jump-btn" onClick={() => jumpTo('boarding-pass')}>
            Pass
          </button>
          <button
            type="button"
            className="mobile-jump-btn"
            onClick={() => jumpTo('accountability-drawer')}
          >
            Ledger
          </button>
        </div>
      </nav>

      <main className={`workspace ${drawerOpen ? '' : 'drawer-closed'}`}>
        <div id="listing-panel" className="panel-card">
          <ListingEditor
            listing={listing}
            onListingChange={(text) => {
              setListing(text);
              setActiveSample(null);
            }}
            profile={profile}
            onProfileChange={setProfile}
            activeSample={activeSample}
            onSelectSample={handleSelectSample}
            onAnalyze={handleAnalyze}
            onSimulateOutage={handleSimulateOutage}
            isAnalyzing={isAnalyzing}
          />
          <HighlightedListing
            listing={result?.listing ?? listing}
            clauses={result?.clauses ?? []}
            languageLevel={languageLevel}
            focusedSpan={focusedSpan}
            focusSeq={focusSeq}
          />
        </div>

        {result ? (
          <BoardingPass
            result={result}
            profile={analyzedProfile}
            activeSample={activeSample}
            editorListing={listing}
            languageLevel={languageLevel}
            isRewinding={isRewinding}
            isAnalyzing={isAnalyzing}
            analyzingSource={analyzingSource}
            analyzingSimulated={analyzingSimulated}
            breakerRetryAt={breakerRetryAt}
            elapsedMs={elapsedMs}
            notice={notice}
            canRecheckWithGemini={apiReachable}
            onUseOfflineNow={handleUseOfflineNow}
            onRecheckWithGemini={handleRecheckWithGemini}
            onRunFreshCheck={handleRunFreshCheck}
            onPerformAction={handlePerformAction}
            onFocusSpan={handleFocusSpan}
          />
        ) : (
          <article id="boarding-pass" className="boarding-pass" aria-busy="true">
            <div className="pass-top-band">
              <span className="pass-airline">WATERLOO CO-OP GATE PASS</span>
              <span className="pass-meta-mono">
                {analyzingSimulated ? 'SIMULATED' : analyzingSource === 'api' ? 'LIVE LLM' : 'OFFLINE'} ·{' '}
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="live-wait-bar" data-testid="live-wait-bar">
              <div className="live-wait-head">
                <span className="live-wait-stage" role="status" aria-live="polite" aria-atomic="true">
                  {getLiveWaitStage(elapsedMs, analyzingSource, analyzingSimulated)}
                </span>
                <span className="live-wait-timer" aria-hidden="true">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
              {analyzingSource === 'api' && !analyzingSimulated && (
                <div className="live-wait-actions">
                  <span className="live-wait-hint">Free-tier Gemini can take up to 20 s.</span>
                  <button
                    type="button"
                    className="btn-offline-now"
                    onClick={handleUseOfflineNow}
                  >
                    Use offline now
                  </button>
                </div>
              )}
              {analyzingSimulated && (
                <div className="live-wait-actions">
                  <span className="live-wait-hint">Testing the offline fallback path without calling Gemini.</span>
                </div>
              )}
            </div>
            <div className="pass-body">
              <p className="verdict-sub">Waiting for analysis result…</p>
            </div>
          </article>
        )}

        {drawerOpen && result && (
          <AccountabilityDrawer
            result={result}
            isRewinding={isRewinding}
            lastFixture={lastFixture}
            engineError={engineError}
            onResolveEscalation={handleResolveEscalation}
            onUndo={handleUndo}
            onMarkWrong={handleMarkWrong}
            onFocusSpan={handleFocusSpan}
          />
        )}
      </main>
    </>
  );
};
