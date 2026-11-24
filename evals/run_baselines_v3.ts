import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { collect, recordsComplete, preregPaths, windowsText, pathFor } from './baseline_b1.js';
import { writeReport } from './baseline_report.js';
import { exportSamples } from './baseline_samples.js';
import { type Label } from './baseline_score.js';
import { cacheDir, files, hashText, read, setup, stableHash } from './baseline_runtime.js';

setup();
const args = process.argv.slice(2);
const live = args.includes('--live');
const samples = args.includes('--samples');
const sampleSourceArg = args.indexOf('--sample-source');
const sampleSource = sampleSourceArg >= 0 ? args[sampleSourceArg + 1] : undefined;
if (sampleSourceArg >= 0 && (!samples || !live || !sampleSource)) throw new Error('--sample-source requires --samples --live and a file path');
const preregPath = 'evals/baselines/PREREG.md';
const prereg = readFileSync(preregPath, 'utf8');
for (const path of preregPaths) {
  if (!prereg.includes(stableHash(path))) throw new Error('Preregistered file changed: ' + path);
}
const preregCommit = execFileSync('git', ['log', '-1', '--format=%H', '--', preregPath], { encoding: 'utf8' }).trim();
if (!preregCommit) throw new Error('Commit preregistration before live calls');
const frozen = read('evals/results-v3-final.json');
const fixtures = files('evals/redteam-v3');
if (fixtures.length !== 30) throw new Error('Expected frozen n=30');
const labels = fixtures.map(file => {
  const path = 'evals/redteam-v3/' + file;
  const bytes = readFileSync(path);
  const label: Label = JSON.parse(bytes.toString("utf8"));
  const listingHash: string = frozen.fixture_hashes[file];
  if (listingHash !== hashText(bytes) && listingHash !== hashText(windowsText(path))) {
    throw new Error('Frozen fixture changed: ' + path);
  }
  return { ...label, listingHash };
});

if (samples) {
  if (live && !recordsComplete(labels.map(label => label.id))) throw new Error('Complete the frozen comparison before sample calls');
  const devPath = cacheDir + '/bouncer-tokens.json';
  if (live && (!existsSync(devPath) || !read(devPath).complete)) throw new Error('Complete the dev token measurement before sample calls');
  await exportSamples(preregCommit, live, sampleSource);
}
const b1 = await collect(labels, preregCommit, live && !samples, 'b1');
writeReport(labels, frozen, b1, preregCommit);
if (!samples && !live && ['clean', 'tricky', 'scammy'].every(key => existsSync(pathFor('sample-' + key)))) {
  await exportSamples(preregCommit, false);
}
