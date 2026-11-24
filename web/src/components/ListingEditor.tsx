import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { SAMPLE_FIXTURES } from '../adapter';
import type { ProfileState, SampleKey } from '../types';

interface ListingEditorProps {
  listing: string;
  onListingChange: (text: string) => void;
  profile: ProfileState;
  onProfileChange: (next: ProfileState) => void;
  activeSample: SampleKey | null;
  onSelectSample: (key: SampleKey) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const SAMPLE_KEYS: SampleKey[] = ['clean', 'tricky', 'scammy'];

export const ListingEditor: React.FC<ListingEditorProps> = ({
  listing,
  onListingChange,
  profile,
  onProfileChange,
  activeSample,
  onSelectSample,
  onAnalyze,
  isAnalyzing,
}) => {
  return (
    <section aria-labelledby="listing-editor-heading">
      <div className="panel-heading">
        <h2 id="listing-editor-heading" style={{ margin: 0, fontSize: 'inherit' }}>
          Sublet listing
        </h2>
      </div>

      <div className="sample-row" role="group" aria-label="Sample listings">
        {SAMPLE_KEYS.map((key) => {
          const item = SAMPLE_FIXTURES[key];
          return (
            <button
              key={key}
              type="button"
              className="sample-btn"
              aria-pressed={activeSample === key}
              onClick={() => onSelectSample(key)}
            >
              <span>{item.label}</span>
              <span className={`sample-tag ${item.badge}`}>{item.badge}</span>
            </button>
          );
        })}
      </div>

      <label className="field-label" htmlFor="listing-textarea">
        Paste listing text (Kijiji, Facebook, Reddit)
      </label>
      <textarea
        id="listing-textarea"
        className="listing-textarea"
        value={listing}
        onChange={(e) => onListingChange(e.target.value)}
        placeholder="Paste rent, address, dates, deposits, and house rules..."
      />

      <div className="profile-grid">
        <div>
          <label className="field-label" htmlFor="campus-select">
            Campus
          </label>
          <select
            id="campus-select"
            className="profile-select"
            value={profile.campus}
            onChange={(e) =>
              onProfileChange({ ...profile, campus: e.target.value as 'UW' | 'WLU' })
            }
          >
            <option value="UW">University of Waterloo (UW)</option>
            <option value="WLU">Wilfrid Laurier (WLU)</option>
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="class-start-input">
            Earliest class
          </label>
          <input
            id="class-start-input"
            type="time"
            className="profile-input"
            value={profile.classStart}
            onChange={(e) => onProfileChange({ ...profile, classStart: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="term-start-input">
            Term start
          </label>
          <input
            id="term-start-input"
            type="date"
            className="profile-input"
            value={profile.termStart}
            onChange={(e) => onProfileChange({ ...profile, termStart: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="term-end-input">
            Term end
          </label>
          <input
            id="term-end-input"
            type="date"
            className="profile-input"
            value={profile.termEnd}
            onChange={(e) => onProfileChange({ ...profile, termEnd: e.target.value })}
          />
        </div>
      </div>

      <div className="editor-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onAnalyze}
          disabled={isAnalyzing || listing.trim().length === 0}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          <span>{isAnalyzing ? 'Checking listing...' : 'Check listing'}</span>
        </button>
      </div>
    </section>
  );
};
