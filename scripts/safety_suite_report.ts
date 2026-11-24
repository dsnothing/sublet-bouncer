import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

interface TestReport {
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: {
    name: string;
    status: string;
    assertionResults: {fullName:string; status:string}[];
  }[];
}

const directory = mkdtempSync(join(tmpdir(), 'sublet-safety-'));
const output = join(directory, 'results.json');
try {
  const run = spawnSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', 'tests/safety',
    '--reporter=json', '--outputFile=' + output,
  ], {encoding:'utf8', env:{...process.env, GEMINI_API_KEY:''}});
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  if (run.error) throw run.error;
  const results: TestReport = JSON.parse(readFileSync(output, 'utf8'));
  const pairs: {id:string; ruleId:string; knownFail?:string}[] =
    JSON.parse(readFileSync('tests/safety/minimal_pairs.json', 'utf8'));
  const known = pairs.filter(pair => pair.knownFail);
  const pairSuite = results.testResults.find(suite => basename(suite.name) === 'minimal-pairs.test.ts');
  const pairTests = pairSuite?.assertionResults ?? [];
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--', '.', ':(exclude)evals/SAFETY-SUITE.md'], {encoding:'utf8'}).trim();
  const lines = [
    'Regression suite written alongside the code (development data). Not a held-out accuracy number.',
    '', '# Safety suite', '', 'Git SHA: ' + sha, 'Date: ' + new Date().toISOString(),
    ...(dirty ? ['The test run includes working-tree changes on top of this SHA.'] : []),
    'Tests: ' + results.numPassedTests + ' passed, ' + results.numFailedTests + ' failed, ' + results.numPendingTests + ' skipped.',
    'Minimal pairs: ' + pairs.length + '. Known failures: ' + known.length + ' (asserted).',
    '', '| Family or suite | Regression status | Known failing pairs |', '|---|---|---|',
  ];
  for (const family of new Set(pairs.map(pair => pair.ruleId))) {
    const familyPairs = pairs.filter(pair => pair.ruleId === family);
    const failures = familyPairs.filter(pair => pair.knownFail).length;
    const passing = familyPairs.every(pair => pairTests.some(test =>
      test.fullName.startsWith(pair.id + ' ') && test.status === 'passed'));
    const status = !passing ? 'FAIL' : failures ? 'KNOWN FAIL' : 'PASS';
    lines.push('| ' + family + ' | ' + status + ' | ' + failures + ' |');
  }
  for (const suite of results.testResults) {
    if (suite === pairSuite) continue;
    lines.push('| ' + basename(suite.name) + ' | ' + (suite.status === 'passed' ? 'PASS' : 'FAIL') + ' | 0 |');
  }
  const mixedTerms = pairTests.filter(test => test.fullName.startsWith('a lawful statement'));
  const mixedStatus = mixedTerms.length && mixedTerms.every(test => test.status === 'passed') ? 'PASS' : 'FAIL';
  lines.push('| Mixed lawful and unlawful terms | ' + mixedStatus + ' | 0 |');

  lines.push('', '## Known failures', ...known.map(pair => '- ' + pair.id + ': ' + pair.knownFail),
    '', 'Live paths use a stub and make no provider calls.', '');
  writeFileSync('evals/SAFETY-SUITE.md', lines.join('\n'));
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(output, {force:true});
  rmdirSync(directory);
}
