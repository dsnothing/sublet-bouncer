import { findSpan } from '../core/extract.js';
import rules from '../data/rta_rules.json' with { type: 'json' };

export interface Label { id: string; listing: string; verdict: string; clauses: string[]; info_topics?: string[] }
export interface Answer { verdict: string; mode?: string; clauses: { ruleId?: string | null; quote?: string; span?: { text: string }; section?: string }[] }
export interface ScoreRow { id: string; result: Answer }
const violations = new Set(rules.rules.filter(r => ['void', 'questionable'].includes(r.status)).map(r => r.id));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const lawName = String.raw`rta|(?:ontario(?:['’]s)? )?residential tenancies act(?:,? 2006)?|o\.?\s*reg\.?\s*\d+/\d+`;
const sectionPattern = new RegExp(
  String.raw`^(?:(${lawName})[,:]?\s+)?(?:sections?\s+|s\.\s*|§\s*)?(\d+(?:\.\d+)*)(\s*(?:\([a-z\d]+\)\s*)*)(?:[-–]\s*(\(\d+\)))?(?:\s+of\s+(?:the\s+)?(${lawName}))?\.?$`,
);

function parseSection(text: string) {
  const match = norm(text).match(sectionPattern);
  if (!match) return null;
  const [, prefix, number, detail, rangeEnd, suffix] = match;
  if ((prefix && suffix) || (rangeEnd && !/^\(\d+\)$/.test(detail.trim()))) return null;
  const law = (prefix ?? suffix ?? '').replace(/[.\s]/g, '');
  return { law: law.startsWith('oreg') ? law : 'rta', number, detail: detail.replace(/\s/g, ''), rangeEnd };
}

function matchesSection(citation: string, ruleSection: string) {
  const verified = ruleSection.split(';').map(parseSection);
  return citation.split(';').every(text => {
    const cited = parseSection(text);
    if (!cited) return false;
    return verified.some(rule => {
      if (!rule || rule.law !== cited.law || rule.number !== cited.number) return false;
      if (!rule.detail || !cited.detail) return true;
      if (!rule.rangeEnd) return !cited.rangeEnd && rule.detail === cited.detail;
      const rangeStart = Number(rule.detail.slice(1, -1));
      const rangeEnd = Number(rule.rangeEnd.slice(1, -1));
      const inRange = (detail: string) => {
        if (!/^\(\d+\)$/.test(detail)) return false;
        const value = Number(detail.slice(1, -1));
        return value >= rangeStart && value <= rangeEnd;
      };
      return inRange(cited.detail) && (!cited.rangeEnd || inRange(cited.rangeEnd));
    });
  });
}

export function verifyClause(listing: string, clause: Answer["clauses"][number]) {
  const rule = rules.rules.find(r => r.id === clause.ruleId);
  const quote = clause.quote ?? clause.span?.text ?? '';
  const section = clause.section ?? '';
  const strictMatchesRule = Boolean(rule && norm(section) === norm(rule.section));
  return {
    inListing: Boolean(findSpan(norm(listing), norm(quote))),
    matchesRule: strictMatchesRule || Boolean(rule && matchesSection(section, rule.section)),
    strictMatchesRule,
  };
}
export function wilson(correct: number, n: number) {
  const z = 1.96, p = correct / n, d = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / d;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [center - half, center + half];
}
export function score(rows: ScoreRow[], labels: Label[]) {
  if (rows.length !== labels.length || new Set(rows.map(r => r.id)).size !== labels.length) throw new Error('Expected one row per label');
  let correct = 0, tp = 0, fp = 0, fn = 0, unsafe_admit = 0, quotes_not_in_listing = 0, no_answer = 0;
  let section_mismatches_strict = 0, section_mismatches_normalized = 0;
  for (const row of rows) {
    const label = labels.find(g => g.id === row.id);
    if (!label) throw new Error('Unknown row id');
    const result = row.result;
    if (result.verdict === label.verdict) correct++;
    if (result.verdict === 'no_answer') no_answer++;
    if (label.verdict !== 'ADMIT' && result.verdict === 'ADMIT') unsafe_admit++;
    const actual = new Set(result.clauses.map(c => c.ruleId).filter((id): id is string => !!id && violations.has(id)));
    const expected = new Set([...label.clauses, ...(label.info_topics ?? [])].filter(id => violations.has(id)));
    for (const id of actual) expected.has(id) ? tp++ : fp++;
    for (const id of expected) if (!actual.has(id)) fn++;
    for (const clause of result.clauses) {
      const evidence = verifyClause(label.listing, clause);
      if (!evidence.inListing) quotes_not_in_listing++;
      if (!evidence.strictMatchesRule) section_mismatches_strict++;
      if (!evidence.matchesRule) section_mismatches_normalized++;
    }
  }
  return { n: labels.length, correct, verdict_accuracy: correct / labels.length, wilson95: wilson(correct, labels.length), tp, fp, fn,
    precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null,
    unsafe_admit, quotes_not_in_listing, section_mismatches_strict, section_mismatches_normalized, no_answer };
}
