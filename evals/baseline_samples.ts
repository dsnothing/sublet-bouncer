import { existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { collect, pathFor, rawAnswer } from './baseline_b1.js';
import { verifyClause } from './baseline_score.js';
import { hashText, read, save } from './baseline_runtime.js';
import { SAMPLE_LISTINGS } from '../api/_lib/samples.js';

const keys = ['clean', 'tricky', 'scammy'] as const;
export async function exportSamples(preregCommit: string, live: boolean, source?: string) {
  let listings = SAMPLE_LISTINGS;
  if (source) listings = (await import(pathToFileURL(source).href)).SAMPLE_LISTINGS;
  const inputs = keys.map((key, index) => {
    const id = "sample-" + key;
    // Offline replay uses the listing recorded alongside the actual response.
    const listing: string = !live && existsSync(pathFor(id)) ? read(pathFor(id)).listing : listings[index];
    if (typeof listing !== 'string' || !listing.length) throw new Error('Missing exact sample listing for ' + key);
    return { id, listing, listingHash: hashText(listing) };
  });
  const rows = await collect(inputs, preregCommit, live, "sample");
  const samples = Object.fromEntries(rows.map((row, i) => {
    const listing = inputs[i].listing;
    const event = row.attempts.at(-1);
    const answered = row.result.verdict !== "no_answer";
    const clauses = row.result.clauses.map(clause => ({
      category: clause.ruleId, quote: clause.quote, section: clause.section, ...verifyClause(listing, clause),
    }));
    return [keys[i], {
      listing, model: row.model, recordedAt: event?.at ?? null, rawAnswer: answered && event ? rawAnswer(event) : null,
      verdict: row.result.verdict, clauses,
    }];
  }));
  const start = rows.flatMap(row => row.attempts).at(0)?.at;
  mkdirSync('web/src/data', { recursive: true });
  save('web/src/data/baseline-samples.json', { model: rows[0].model, date: start?.slice(0, 10) ?? null, samples });
}
