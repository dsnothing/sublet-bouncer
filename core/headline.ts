import { data } from './data.js';
import type { AnalysisResult } from './types.js';

const labels: Record<string, string> = {
  damage_deposit: 'damage deposit',
  excess_rent_deposit: 'extra rent deposit',
  key_deposit: 'key deposit',
  no_pets: 'pet ban',
  entry_notice: 'entry without notice',
  postdated_cheques: 'required advance cheques or auto pay',
  maintenance_waiver: 'giving up repair rights',
  lockout: 'lockout',
  deposit_interest: 'rent deposit interest',
};
const simpleLabels: Record<string, string> = {
  entry_notice: 'coming in without notice',
  postdated_cheques: 'must pay by cheque or auto pay',
  lockout: 'being locked out',
};
const scamLabels = new Map(data.model.features.map(({name, description}) =>
  [name, description.charAt(0).toUpperCase() + description.slice(1)]));

export function verdictHeadline(result: AnalysisResult, level: 'plain'|'simple'): {
  text: string; items: {ruleId?: string; label: string; spanText?: string}[];
} {
  const items: {ruleId?: string; label: string; spanText?: string}[] = [];
  // Money can enter the headline through verified clause evidence only.
  const withoutMoney = (text: string) => text.replace(/\$(?:\s*\d[\d,.]*)?/g, 'the amount');
  const clauses = result.clauses.filter(c => c.status !== 'ok');
  let text: string;
  if (result.verdict === 'REFUSE' && (result.scam.p > .7 || result.reasons.some(r => /before viewing/i.test(r)))) {
    for (const feature of result.scam.topFeatures.filter(f => f.weight > 0).slice(0, 2)) {
      items.push({label: scamLabels.get(feature.name) ?? withoutMoney(feature.name.replaceAll('_', ' '))});
    }
    text = "REFUSE: " + (items.map(i => i.label).join(', ') || 'unsafe request') + ". Don't send money.";
  } else if (result.verdict !== 'ADMIT' && clauses.length) {
    for (const {ruleId, span} of clauses) {
      const verified = Number.isInteger(span.start) && Number.isInteger(span.end)
        && span.start >= 0 && span.end <= result.listing.length && span.end > span.start
        && result.listing.slice(span.start, span.end) === span.text;
      const amount = verified ? span.text.match(/\$\s*\d[\d,]*(?:\.\d+)?/)?.[0] : undefined;
      const label = (level === 'simple' && simpleLabels[ruleId ?? '']) || labels[ruleId ?? ''] || 'lease term';
      items.push({
        ...(ruleId ? {ruleId} : {}),
        label: amount ? amount + ' ' + label : label,
        ...(verified ? {spanText:span.text} : {}),
      });
    }
    const groups = (['void','questionable'] as const).map(status => {
      const names = items.filter((_, i) => clauses[i].status === status).map(i => i.label);
      if (!names.length) return '';
      const terms = names.length + (names.length === 1 ? ' term' : ' terms');
      const allowed = status === 'void' ? "doesn't allow" : 'may not allow';
      return terms + ' Ontario law ' + allowed + ' (' + names.join(', ') + ')';
    }).filter(Boolean);
    text = result.verdict + ': ' + groups.join('; ') + '. Ask before you pay anything.';
  } else if (result.verdict === 'ADMIT') {
    const notes = result.escalations.filter(e => !e.blocking).length;
    text = 'ADMIT: no checked problem found' + (notes ? ', ' + notes + (notes === 1 ? ' note' : ' notes') + ' to confirm' : '');
  } else if (result.verdict === 'REFUSE') {
    const reason = result.refused?.reason === 'injection_only' ? 'text tries to direct the check' : 'this text cannot be safely checked';
    text = "REFUSE: " + reason + ". Don't send money.";
  } else {
    for (const escalation of result.escalations.filter(e => e.blocking)) {
      let label = withoutMoney(escalation.question);
      if (level === 'simple') {
        label = label.replace(/\b(?:O\. Reg\. \d+\/\d+ )?(?:s\.\s*|sections?\s+)\d+(?:\([^)]*\))*/gi, 'the law');
        if (escalation.decisionId === 'D5' && label.startsWith('This listing appears to be outside Ontario')) {
          label = 'Is this place outside Ontario? Check local law.';
        }
      }
      items.push({label});
    }
    if (items.length) {
      text = 'HOLD: ' + items.length + (items.length === 1 ? ' question' : ' questions') + ' to answer first (' + items.map(i => i.label).join('; ') + ')';
    } else {
      text = result.commute.status === 'infeasible' ? 'HOLD: the trip gets you to class late' : 'HOLD: check before you pay anything';
    }
  }
  if (result.verdictConfidence === 'reduced') text += ' (offline check: reworded terms may be missed)';
  return {text, items};
}
