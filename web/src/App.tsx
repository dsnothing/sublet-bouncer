import React, { useEffect, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  getSampleListing,
  isFixturesDemoEnabled,
  markWrongEngine,
  performActionEngine,
  resolveEscalationEngine,
  runAnalysis,
  undoLogEntryEngine,
} from './adapter';
import { AccountabilityDrawer } from './components/AccountabilityDrawer';
import { BoardingPass } from './components/BoardingPass';
import { HighlightedListing } from './components/HighlightedListing';
import { ListingEditor } from './components/ListingEditor';
import {
  DEFAULT_PROFILE,
  type AnalysisResult,
  type DataSourceMode,
  type Decision,
  type LanguageLevel,
  type ProfileState,
  type RegressionFixture,
  type SampleKey,
  type Span,
} from './types';

const STORAGE_KEY = 'sublet-bouncer:v2';

interface PersistedState {
  listing: string;
  profile: ProfileState;
  dataSource: DataSourceMode;
  languageLevel: LanguageLevel;
  drawerOpen: boolean;
  activeSample: SampleKey | null;
  result: AnalysisResult | null;
}

function loadInitialState(fixturesAllowed: boolean): PersistedState {
  const defaultSource: DataSourceMode = fixturesAllowed ? 'fixtures' : 'api';
  const fallback: PersistedState = {
    listing: getSampleListing('tricky'),
    profile: DEFAULT_PROFILE,
    dataSource: defaultSource,
    languageLevel: 'plain',
    drawerOpen: true,
    activeSample: 'tricky',
    result: null,
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed.listing !== 'string') {
      return fallback;
    }
    const storedSource = parsed.dataSource ?? defaultSource;
    const safeSource: DataSourceMode =
      storedSource === 'fixtures' && !fixturesAllowed ? 'api' : storedSource;
    return {
      listing: parsed.listing,
      profile: parsed.profile ?? DEFAULT_PROFILE,
      dataSource: safeSource,
      languageLevel: parsed.languageLevel ?? 'plain',
      drawerOpen: typeof parsed.drawerOpen === 'boolean' ? parsed.drawerOpen : true,
      activeSample: parsed.activeSample ?? null,
      result: parsed.result ?? null,
    };
  } catch {
    return fallback;
  }
}

export const App: React.FC = () => {
  const fixturesAllowed = isFixturesDemoEnabled();
  const initial = loadInitialState(fixturesAllowed);

  const [listing, setListing] = useState<string>(initial.listing);
  const [profile, setProfile] = useState<ProfileState>(initial.profile);
  const [dataSource, setDataSource] = useState<DataSourceMode>(initial.dataSource);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>(initial.languageLevel);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(initial.drawerOpen);
  const [activeSample, setActiveSample] = useState<SampleKey | null>(initial.activeSample);
  const [result, setResult] = useState<AnalysisResult | null>(initial.result);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [engineError, setEngineError] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isRewinding, setIsRewinding] = useState<boolean>(false);
  const [lastFixture, setLastFixture] = useState<RegressionFixture | null>(null);
  const [focusedSpan, setFocusedSpan] = useState<Span | null>(null);
  const [focusSeq, setFocusSeq] = useState<number>(0);
  const rewindTimerRef = useRef<number | null>(null);
  const didAutoRunRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        listing,
        profile,
        dataSource,
        languageLevel,
        drawerOpen,
        activeSample,
        result,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota or private-mode errors per SPEC §6
    }
  }, [listing, profile, dataSource, languageLevel, drawerOpen, activeSample, result]);

  useEffect(() => {
    return () => {
      if (rewindTimerRef.current !== null) {
        window.clearTimeout(rewindTimerRef.current);
      }
    };
  }, []);

  const executeAnalysis = async (
    text: string,
    prof: ProfileState,
    source: DataSourceMode,
  ) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setNotice(undefined);
    setEngineError(undefined);
    try {
      const { result: nextResult, notice: nextNotice } = await runAnalysis(
        {
          listing: text,
          profile: prof,
          mode: source === 'api' ? 'live' : 'offline',
        },
        source,
      );
      setResult(nextResult);
      setNotice(nextNotice);
      setLastFixture(null);
      setFocusedSpan(null);
    } finally {
      setIsAnalyzing(false);
    }
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

  const handlePerformAction = (actionId: string) => {
    if (!result) return;
    setEngineError(undefined);
    const { result: next, error } = performActionEngine(result, actionId);
    if (error) {
      setEngineError(error);
      return;
    }
    setResult(next);
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

  return (
    <>
      <a className="skip-link" href="#boarding-pass">
        Skip to verdict boarding pass
      </a>

      <header className="topbar">
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
              {result && result.escalations.length > 0 && (
                <span className="esc-count-pill" aria-label={`${result.escalations.length} open escalations`}>
                  {result.escalations.length}
                </span>
              )}
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
            }`}
          >
            {result ? result.verdict : 'CHECKING'}
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
            profile={profile}
            isRewinding={isRewinding}
            notice={notice}
            onPerformAction={handlePerformAction}
          />
        ) : (
          <article id="boarding-pass" className="boarding-pass" aria-busy="true">
            <div className="pass-top-band">
              <span className="pass-airline">WATERLOO CO-OP GATE PASS</span>
              <span className="pass-meta-mono">ANALYZING…</span>
            </div>
            <div className="pass-body">
              <p className="verdict-sub">Checking Ontario RTA clauses, commute, and scam signals…</p>
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
