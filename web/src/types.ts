export type {
  ActionRecord,
  AnalysisResult,
  AnalyzeRequest,
  ClauseFinding,
  Commute,
  Decision,
  DecisionKind,
  Escalation,
  LogEntry,
  Span,
  Verdict,
} from '../../core/types';

export type DataSourceMode = 'fixtures' | 'api' | 'offline';
export type SampleKey = 'clean' | 'tricky' | 'scammy';
export type LanguageLevel = 'plain' | 'simple';

export interface ProfileState {
  termStart: string;
  termEnd: string;
  campus: 'UW' | 'WLU';
  classStart: string;
}

export interface RegressionFixture {
  listing: string;
  decision_id: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7';
  expected: string;
  recordedAt: string;
}

export const DEFAULT_PROFILE: ProfileState = {
  termStart: '2027-01-01',
  termEnd: '2027-04-30',
  campus: 'UW',
  classStart: '08:30',
};
