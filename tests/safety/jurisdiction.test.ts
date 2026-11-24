import { it, expect } from 'vitest';
import { analyze } from '../../core/engine';
import { markWrong, resolveEscalation } from '../../core/log';
import { shell, profile, stub } from './helpers';

it.each([
  ['Vancouver, BC', 'Vancouver, BC'],
  ['Montréal, QC', 'Montréal, QC'],
  ["St. John's, NL", "St. John's, NL"],
  ['Calgary, AB', 'Calgary, AB'],
  ['Winnipeg, MB', 'Winnipeg, MB'],
  ['Halifax, NS', 'Halifax, NS'],
  ['Victoria V8W 1P6', 'V8W 1P6'],
  ['Seattle, WA 98101', 'Seattle, WA 98101'],
  ['New York, NY 10001', 'New York, NY 10001'],
  ['H2X 1Y4', 'H2X 1Y4'],
  ['T2P 1J9', 'T2P 1J9'],
  ['I moved from Vancouver. Calgary, AB.', 'Calgary, AB'],
])('blocks non-Ontario location %s', async (text, evidenceText) => {
  const listing = shell(text);
  for (const mode of ['offline', 'live'] as const) {
    const result = await analyze({listing, profile, mode}, {llm:stub(listing)});
    expect(result.mode).toBe(mode);
    expect(result.rtaApplies).toBe('may_not_apply');
    expect(result.verdict).toBe('HOLD');
    const start = listing.indexOf(evidenceText);
    expect(result.escalations.filter(e => e.decisionId === 'D5')).toMatchObject([{
      blocking: true,
      question: "This listing appears to be outside Ontario ('" + evidenceText + "'). Ontario's Residential Tenancies Act may not apply; check local law.",
      evidence: [{text:evidenceText, start, end:start + evidenceText.length}],
    }]);
  }
});

it.each([
  "I'm a student from Vancouver", 'moving from Montreal', "BC = bachelor's",
  "My degree, BC = bachelor's", 'N2L 3G1', 'Waterloo, ON', 'Toronto M5V 2T6',
  'I am moving from Vancouver, BC.', 'A student from Seattle, WA 98101.',
  'I am moving from Vancouver, BC V8W 1P6.',
])('does not infer foreign location from %s', async text => {
  const result = await analyze({listing:shell(text), profile, mode:'offline'});
  expect(result.rtaApplies).toBe('applies');
  expect(result.escalations.some(e => e.decisionId === 'D5')).toBe(false);
});

it('keeps the jurisdiction block when the question is answered or decisions are corrected', async () => {
  const result = await analyze({listing:shell('Vancouver, BC'), profile, mode:'offline'});
  const escalation = result.escalations.find(e => e.decisionId === 'D5')!;
  const revisions = [
    resolveEscalation(result, escalation.id, 'Confirm'),
    markWrong(result, 'D1', result.fields).result,
    markWrong(result, 'D5', 'applies').result,
    markWrong(result, 'D6', 'ADMIT').result,
  ];
  for (const revised of revisions) {
    expect(revised.rtaApplies).toBe('may_not_apply');
    expect(revised.verdict).toBe('HOLD');
    expect(revised.escalations.filter(e => e.decisionId === 'D5')).toMatchObject([{
      question: escalation.question,
      evidence: escalation.evidence,
      blocking: true,
    }]);
  }
});
