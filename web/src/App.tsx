import React, { useEffect, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  SAMPLE_FIXTURES,
  getSampleListing,
  markWrongLocal,
  performActionLocal,
  resolveEscalationLocal,
  runAnalysis,
  undoLogEntryLocal,
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
} from './types';

const STORAGE_KEY = 'sublet-bouncer:v1';

interface PersistedState {
  listing: string;
  profile: ProfileState;
  dataSource: DataSourceMode;
  languageLevel: LanguageLevel;
  drawerOpen: boolean;
  activeSample: SampleKey | null;
  result: AnalysisResult;
}

function loadInitialState(): PersistedState {
  const fallbackResult = SAMPLE_FIXTURES.tricky.result();
  const fallback: PersistedState = {
    listing: fallbackResult.listing,
    profile: DEFAULT_PROFILE,
    dataSource: 'fixtures',
    languageLevel: 'plain',
    drawerOpen: true,
    activeSample: 'tricky',
    result: fallbackResult,
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed.listing !== 'string' || !parsed.result) {
      return fallback;
    }
    return {
      listing: parsed.listing,
      profile: parsed.profile ?? DEFAULT_PROFILE,
      dataSource: parsed.dataSource ?? 'fixtures',
      languageLevel: parsed.languageLevel ?? 'plain',
      drawerOpen: typeof parsed.drawerOpen === 'boolean' ? parsed.drawerOpen : true,
      activeSample: parsed.activeSample ?? null,
      result: parsed.result,
    };
  } catch {
    return fallback;
  }
}

export const App: React.FC = () => {
  const initial = loadInitialState();

  const [listing, setListing] = useState<string>(initial.listing);
  const [profile, setProfile] = useState<ProfileState>(initial.profile);
  const [dataSource, setDataSource] = useState<DataSourceMode>(initial.dataSource);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>(initial.languageLevel);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(initial.drawerOpen);
  const [activeSample, setActiveSample] = useState<SampleKey | null>(initial.activeSample);
  const [result, setResult] = useState<AnalysisResult>(initial.result);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isRewinding, setIsRewinding] = useState<boolean>(false);
  const [lastFixture, setLastFixture] = useState<RegressionFixture | null>(null);
  const rewindTimerRef = useRef<number | null>(null);

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
    const sampleResult = SAMPLE_FIXTURES[key].result();
    setActiveSample(key);
    setListing(getSampleListing(key));
    setResult(sampleResult);
    setNotice(undefined);
    setLastFixture(null);
  };

  const handleAnalyze = async () => {
    if (!listing.trim()) return;
    setIsAnalyzing(true);
    setNotice(undefined);
    try {
      const { result: nextResult, notice: nextNotice } = await runAnalysis(
        {
          listing,
          profile,
          mode: dataSource === 'api' ? 'live' : 'offline',
        },
        dataSource,
      );
      setResult(nextResult);
      setNotice(nextNotice);
      setLastFixture(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResolveEscalation = (escId: string, answer: string) => {
    setResult((prev) => resolveEscalationLocal(prev, escId, answer));
  };

  const handlePerformAction = (actionId: string) => {
    setResult((prev) => performActionLocal(prev, actionId));
  };

  const handleUndo = (logEntryId: string) => {
    triggerRewind();
    setResult((prev) => undoLogEntryLocal(prev, logEntryId));
  };

  const handleMarkWrong = (decisionId: Decision['id'], correction: string) => {
    triggerRewind();
    setResult((prev) => {
      const { result: updated, fixture } = markWrongLocal(prev, decisionId, correction);
      setLastFixture(fixture);
      return updated;
    });
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

  const scamPct = Math.round(result.scam.p * 100);

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
              <button
                type="button"
                className="seg-btn"
                aria-pressed={dataSource === 'fixtures'}
                onClick={() => setDataSource('fixtures')}
              >
                Fixtures
              </button>
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
              {result.escalations.length > 0 && (
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
              result.verdict === 'ADMIT' ? 'ok' : result.verdict === 'HOLD' ? 'warn' : 'bad'
            }`}
          >
            {result.verdict}
          </span>
          <span className="status-pill neutral">Scam {scamPct}%</span>
          <span className="status-pill neutral">
            {result.commute.minutes !== undefined ? `${result.commute.minutes}m` : result.commute.status}
          </span>
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
            listing={result.listing}
            clauses={result.clauses}
            languageLevel={languageLevel}
          />
        </div>

        <BoardingPass
          result={result}
          profile={profile}
          isRewinding={isRewinding}
          notice={notice}
          onPerformAction={handlePerformAction}
        />

        {drawerOpen && (
          <AccountabilityDrawer
            result={result}
            isRewinding={isRewinding}
            lastFixture={lastFixture}
            onResolveEscalation={handleResolveEscalation}
            onUndo={handleUndo}
            onMarkWrong={handleMarkWrong}
          />
        )}
      </main>
    </>
  );
};
