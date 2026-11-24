import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { ClauseFinding, LanguageLevel } from '../types';

interface HighlightedListingProps {
  listing: string;
  clauses: ClauseFinding[];
  languageLevel: LanguageLevel;
}

interface PopoverState {
  clauseIndex: number;
  top: number;
  left: number;
  origin: string;
}

export const HighlightedListing: React.FC<HighlightedListingProps> = ({
  listing,
  clauses,
  languageLevel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [popover, setPopover] = useState<PopoverState | null>(null);

  useEffect(() => {
    setPopover(null);
  }, [listing, clauses]);

  useEffect(() => {
    if (!popover) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const idx = popover.clauseIndex;
        setPopover(null);
        triggerRefs.current[idx]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [popover]);

  // Sort valid non-overlapping spans
  const sorted = clauses
    .map((clause, index) => ({ clause, index }))
    .filter(
      ({ clause }) =>
        clause.span.start >= 0 &&
        clause.span.end > clause.span.start &&
        clause.span.end <= listing.length,
    )
    .sort((a, b) => a.clause.span.start - b.clause.span.start);

  const segments: Array<{ type: 'text'; text: string } | { type: 'clause'; clause: ClauseFinding; index: number }> = [];
  let cursor = 0;
  for (const item of sorted) {
    if (item.clause.span.start < cursor) continue;
    if (item.clause.span.start > cursor) {
      segments.push({ type: 'text', text: listing.slice(cursor, item.clause.span.start) });
    }
    segments.push({ type: 'clause', clause: item.clause, index: item.index });
    cursor = item.clause.span.end;
  }
  if (cursor < listing.length) {
    segments.push({ type: 'text', text: listing.slice(cursor) });
  }

  const openClause = (index: number, buttonEl: HTMLButtonElement) => {
    if (popover?.clauseIndex === index) {
      setPopover(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = buttonEl.getBoundingClientRect();

    const relTop = bRect.bottom - cRect.top + 8;
    const relLeft = Math.max(0, Math.min(bRect.left - cRect.left, Math.max(0, cRect.width - 340)));
    const originX = Math.max(12, Math.min(bRect.left - cRect.left - relLeft + bRect.width / 2, 320));

    setPopover({
      clauseIndex: index,
      top: relTop,
      left: relLeft,
      origin: `${originX}px top`,
    });
  };

  const activeClause = popover !== null ? clauses[popover.clauseIndex] : null;

  return (
    <div className="highlighted-section" ref={containerRef}>
      <div className="panel-heading" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Clause highlights</h3>
        <span className="conf-readout" style={{ color: 'var(--ink-muted)' }}>
          {clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'} flagged
        </span>
      </div>

      <div className="highlight-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-swatch void" /> Void / illegal
        </span>
        <span className="legend-item">
          <span className="legend-swatch questionable" /> Questionable
        </span>
        <span className="legend-item">
          <span className="legend-swatch ok" /> Fine
        </span>
      </div>

      <div className="highlighted-box" aria-label="Annotated listing text">
        {segments.length === 0 ? (
          <span>{listing}</span>
        ) : (
          segments.map((seg, i) =>
            seg.type === 'text' ? (
              <React.Fragment key={i}>{seg.text}</React.Fragment>
            ) : (
              <button
                key={i}
                ref={(el) => {
                  triggerRefs.current[seg.index] = el;
                }}
                type="button"
                className={`clause-mark ${seg.clause.status}`}
                aria-expanded={popover?.clauseIndex === seg.index}
                aria-label={`${seg.clause.span.text} — ${seg.clause.status} clause, RTA section ${seg.clause.section ?? 'info'}`}
                onClick={(e) => openClause(seg.index, e.currentTarget)}
              >
                {seg.clause.span.text}
              </button>
            ),
          )
        )}
      </div>

      {activeClause && popover && (
        <div
          role="dialog"
          aria-label={`RTA lesson for ${activeClause.span.text}`}
          className="lesson-popover"
          style={{
            top: popover.top,
            left: popover.left,
            transformOrigin: popover.origin,
          }}
        >
          <div className="lesson-popover-header">
            <span className={`lesson-section-chip ${activeClause.status}`}>
              {activeClause.section ? `RTA s.${activeClause.section}` : 'RTA Note'} ·{' '}
              {activeClause.status.toUpperCase()}
            </span>
            <button
              type="button"
              className="popover-close"
              aria-label="Close lesson"
              onClick={() => {
                const idx = popover.clauseIndex;
                setPopover(null);
                triggerRefs.current[idx]?.focus();
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <p className="lesson-body">
            {languageLevel === 'simple' ? activeClause.lessonSimple : activeClause.lesson}
          </p>
          {activeClause.sourceUrl && (
            <a
              className="lesson-link"
              href={activeClause.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Read Ontario e-Laws</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
