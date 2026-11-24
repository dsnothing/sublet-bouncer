import { findSpan } from '../core/extract.js';
import rules from '../data/rta_rules.json' with { type: 'json' };

export interface Label { id: string; listing: string; verdict: string; clauses: string[]; info_topics?: string[] }
export interface Answer { verdict: string; mode?: string; clauses: { ruleId?: string | null; quote?: string; span?: { text: string }; section?: string }[] }
export interface ScoreRow { id: string; result: Answer }
const violations = new Set(rules.rules.filter(r => ['void', 'questionable'].includes(r.status)).map(r => r.id));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
export function verifyClause(listing: string, clause: Answer["clauses"][number]) {
  const rule = rules.rules.find(r => r.id === clause.ruleId);
  const quote = clause.quote ?? clause.span?.text ?? '';
  return {
    inListing: Boolean(findSpan(norm(listing), norm(quote))),
    matchesRule: Boolean(rule && norm(clause.section ?? '') === norm(rule.section)),
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
  let correct = 0, tp = 0, fp = 0, fn = 0, unsafe_admit = 0, quotes_not_in_listing = 0, section_mismatches = 0, no_answer = 0;
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
      if (!evidence.matchesRule) section_mismatches++;
    }
  }
  return { n: labels.length, correct, verdict_accuracy: correct / labels.length, wilson95: wilson(correct, labels.length), tp, fp, fn,
    precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null,
    unsafe_admit, quotes_not_in_listing, section_mismatches, no_answer };
}
