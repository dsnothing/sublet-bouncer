import type { AnalysisResult, Span } from './types';
import rules from '../data/rta_rules.json';
export const RULE_IDS = rules.rules.map(rule => rule.id);
export const LIVE_RISK_FIELDS = ['payment_before_viewing', 'landlord_abroad', 'risky_payment_method'] as const;
export interface Extraction { fields: AnalysisResult['fields']; clauses: { span: Span; confidence: number; proposed_rule_id?: string; rationale?: string }[] }
export interface LLMAdapter { extract(listing: string): Promise<unknown>; model?: string }
export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
export function findSpan(listing: string, text: string): Span | undefined {
  if (!normalize(text)) return;
  const escaped = normalize(text).split(' ').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const m = new RegExp(escaped).exec(listing);
  return m ? { text: m[0], start: m.index, end: m.index + m[0].length } : undefined;
}
export function offlineExtract(listing: string): Extraction {
  const fields: Extraction['fields'] = {};
  const add = (name: string, re: RegExp, value?: (m: RegExpExecArray) => unknown) => {
    const m = re.exec(listing); if (m) fields[name] = { value: value ? value(m) : m[0], span: { text: m[0], start: m.index, end: m.index + m[0].length }, confidence: 0.9 };
  };
  add('address', /\b\d{1,5}\s+[\w .'-]+?\s(?:street|st\b|road|rd\b|avenue|ave\b|drive|dr\b|crescent|cres\b|boulevard|blvd\b)(?:\s+[NWSE]\b)?/i);
  add('rent', /(?:rent\s*(?:is|:)?\s*)?\$\s*([\d,]+)(?:\.\d{2})?(?:\s*(?:\/|per\s*)?(?:month|mo)\b)?/i, m => Number(m[1].replace(/,/g, '')));
  add('dates', /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b[^.\n]{0,70}(?:20\d{2}|\d{1,2})/i);
  add('deposits', /[^.\n]*(?:deposit|first\s*(?:and|\+)\s*last)[^.\n]*/i);
  add('utilities', /utilities\s+(?:included|extra|not included)|(?:hydro|water|internet)\s+included/i);
  add('contact_channel', /(?:whats\s*app|telegram|email|phone|messenger)(?:\s+only)?/i);
  add('payment_methods', /(?:crypto(?:currency)?|bitcoin|gift\s*cards?|wire\s*transfer|e-transfer|cash|cheques?)/i);
  add('viewing_offered', /(?:no\s+viewings?|viewing\s+(?:available|offered|welcome)|(?:book|arrange|schedule)\s+(?:a\s+)?viewing|view\s+before\s+pay)/i, m => !/^no\b/i.test(m[0]));
  add('owner_lives_in', /(?:owner|landlord)\s+(?:(?:does\s+not|doesn't)\s+live\s+(?:here|there|in)|(?:lives?|living)\s+(?:here|there|in|with)|(?:shares?|sharing)\s+(?:the\s+)?(?:kitchen|bathroom))|shar(?:e|ing)\s+(?:a\s+|the\s+)?(?:kitchen|bathroom)\s+with\s+(?:the\s+)?(?:owner|landlord)/i, m => !/does\s+not|doesn't/i.test(m[0]));
  return { fields, clauses: [] };
}
export function verifyExtraction(raw: unknown, listing: string): { extraction: Extraction; issues: string[] } {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  const x = raw as Extraction;
  if (!x || typeof x.fields !== 'object' || !x.fields || Array.isArray(x.fields) || !Array.isArray(x.clauses)) throw new Error('Invalid extraction schema');
  const fields: Extraction['fields'] = {}; const issues: string[] = [];
  const allowed = ['address','rent','dates','deposits','utilities','contact_channel','payment_methods','viewing_offered','owner_lives_in',...LIVE_RISK_FIELDS];
  for (const [name, f] of Object.entries(x.fields)) {
    if (!allowed.includes(name)) continue;
    if (!f || typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1 || !f.span || typeof f.span.text !== 'string') throw new Error('Invalid field schema');
    if ((LIVE_RISK_FIELDS as readonly string[]).includes(name) && typeof f.value !== 'boolean') throw new Error('Invalid risk boolean');
    const span = findSpan(listing, f.span.text);
    if (!span) { issues.push(`Dropped ${name}: evidence is absent from the listing`); continue; }
    // Values controlling policy must agree with a deterministic reading of their cited evidence.
    let parsed = offlineExtract(span.text).fields[name];
    if (name === 'rent' && !parsed) {
      const contextual = offlineExtract(listing).fields.rent;
      if (contextual?.span && span.start >= contextual.span.start && span.end <= contextual.span.end) parsed = contextual;
    }
    if (['rent','owner_lives_in','viewing_offered'].includes(name) && (!parsed || parsed.value !== f.value)) { issues.push(`Dropped ${name}: value conflicts with evidence`); continue; }
    if (['address','contact_channel'].includes(name) && (typeof f.value !== 'string' || !normalize(span.text).toLowerCase().includes(normalize(f.value).toLowerCase()))) { issues.push(`Dropped ${name}: value conflicts with evidence`); continue; }
    fields[name] = { ...f, span };
  }
  const clauses: Extraction['clauses'] = [];
  for (const c of x.clauses) {
    if (!c?.span || typeof c.span.text !== 'string' || typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1) throw new Error('Invalid clause schema');
    if (typeof c.proposed_rule_id !== 'string' || ![...RULE_IDS,'none'].includes(c.proposed_rule_id)) throw new Error('Invalid proposed rule id');
    if (typeof c.rationale !== 'string' || normalize(c.rationale).split(' ').filter(Boolean).length > 20) throw new Error('Invalid clause rationale');
    const span = findSpan(listing, c.span.text);
    if (span) clauses.push({ span, confidence: c.confidence, proposed_rule_id: c.proposed_rule_id, rationale: c.rationale });
    else issues.push('Dropped clause: evidence is absent from the listing');
  }
  return { extraction: { fields, clauses }, issues };
}
