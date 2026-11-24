import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { ClauseFinding, LanguageLevel, Span } from '../types';

interface HighlightedListingProps {
  listing: string;
  clauses: ClauseFinding[];
  languageLevel: LanguageLevel;
  focusedSpan?: Span | null;
  focusSeq?: number;
}

interface PopoverState {
  clauseIndex: number;
  top: number;
  left: number;
  origin: string;
}

type Segment =
  | { type: 'text'; text: string }
  | { type: 'clause'; clause: ClauseFinding; index: number; isFocused: boolean }
  | { type: 'evidence'; span: Span };

export const HighlightedListing: React.FC<HighlightedListingProps> = ({
  listing,
  clauses,
  languageLevel,
  focusedSpan = null,
  focusSeq = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const evidenceMarkRef = useRef<HTMLElement | null>(null);
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

  // Scroll to and highlight the focused evidence span when clicked in AccountabilityDrawer
  useEffect(() => {
    if (!focusedSpan || focusSeq === 0) return;
    const matchingClauseIdx = clauses.findIndex(
      (c) => c.span.start === focusedSpan.start && c.span.end === focusedSpan.end,
    );
    const targetEl =
      matchingClauseIdx >= 0 ? triggerRefs.current[matchingClauseIdx] : evidenceMarkRef.current;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (targetEl instanceof HTMLButtonElement) {
        targetEl.focus({ preventScroll: true });
      }
    } else {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedSpan, focusSeq, clauses]);

  // Build non-overlapping sorted annotations (clauses + optional focused evidence span)
  const validClauses = clauses
    .map((clause, index) => ({ clause, index }))
    .filter(
      ({ clause }) =>
        clause.span.start >= 0 &&
        clause.span.end > clause.span.start &&
        clause.span.end <= listing.length,
    );

  const hasValidFocused =
    focusedSpan !== null &&
    focusedSpan.start >= 0 &&
    focusedSpan.end > focusedSpan.start &&
    focusedSpan.end <= listing.length;

  const focusedMatchesClause =
    hasValidFocused &&
    validClauses.some(
      ({ clause }) =>
        clause.span.start === focusedSpan.start && clause.span.end === focusedSpan.end,
    );

  type RawAnnot =
    | { kind: 'clause'; start: number; end: number; clause: ClauseFinding; index: number }
    | { kind: 'evidence'; start: number; end: number; span: Span };

  const annots: RawAnnot[] = validClauses.map(({ clause, index }) => ({
    kind: 'clause',
    start: clause.span.start,
    end: clause.span.end,
    clause,
    index,
  }));

  if (hasValidFocused && !focusedMatchesClause) {
    const overlapsClause = annots.some(
      (a) => focusedSpan.start < a.end && focusedSpan.end > a.start,
    );
    if (!overlapsClause) {
      annots.push({
        kind: 'evidence',
        start: focusedSpan.start,
        end: focusedSpan.end,
        span: focusedSpan,
      });
    }
  }

  annots.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const item of annots) {
    if (item.start < cursor) continue;
    if (item.start > cursor) {
      segments.push({ type: 'text', text: listing.slice(cursor, item.start) });
    }
    if (item.kind === 'clause') {
      const isFocused =
        hasValidFocused &&
        item.clause.span.start === focusedSpan.start &&
        item.clause.span.end === focusedSpan.end;
      segments.push({ type: 'clause', clause: item.clause, index: item.index, isFocused });
    } else {
      segments.push({ type: 'evidence', span: item.span });
    }
    cursor = item.end;
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
    <div id="highlighted-listing" className="highlighted-section" ref={containerRef}>
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
          segments.map((seg, i) => {
            if (seg.type === 'text') {
              return <React.Fragment key={i}>{seg.text}</React.Fragment>;
            }
            if (seg.type === 'evidence') {
              return (
                <mark
                  key={`ev-${focusSeq}-${i}`}
                  ref={evidenceMarkRef}
                  className="evidence-mark"
                >
                  {listing.slice(seg.span.start, seg.span.end)}
                </mark>
              );
            }
            return (
              <button
                key={i}
                ref={(el) => {
                  triggerRefs.current[seg.index] = el;
                }}
                type="button"
                className={`clause-mark ${seg.clause.status}${seg.isFocused ? ' evidence-focused' : ''}`}
                aria-expanded={popover?.clauseIndex === seg.index}
                aria-label={`${seg.clause.span.text} — ${seg.clause.status} clause, RTA section ${seg.clause.section ?? 'info'}`}
                onClick={(e) => openClause(seg.index, e.currentTarget)}
              >
                {seg.clause.span.text}
              </button>
            );
          })
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
              {activeClause.section ? `RTA ${/^s\./i.test(activeClause.section) ? activeClause.section : `s.${activeClause.section}`}` : 'RTA Note'} ·{' '}
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
