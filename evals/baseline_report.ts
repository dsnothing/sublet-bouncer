import { existsSync, writeFileSync } from 'node:fs';
import rules from '../data/rta_rules.json' with { type: 'json' };
import { checklist } from './baselines/b2_checklist.js';
import { score, verifyClause, type Label, type ScoreRow } from './baseline_score.js';
import { calls, cacheDir, stableHash, read, save, tokenSummary, type Attempt } from './baseline_runtime.js';

type Tokens = ReturnType<typeof tokenSummary>;
interface Pricing { model: string; input_per_1M: number; output_per_1M: number; url: string; accessed: string }
interface CachedRow {
  id: string; result: ScoreRow["result"]; attempts: Attempt[]; harness_sha256: string;
  resumed_before_first_call?: boolean; interrupted?: boolean;
}

export function writeReport(labels: Label[], frozen: { frozen_source: string; rows: Record<string, ScoreRow[]> }, cached: CachedRow[], preregCommit: string) {
  const b1: ScoreRow[] = cached.map(({ id, result }) => ({ id, result }));
  const b2 = labels.map(g => ({ id: g.id, result: checklist(g.listing) }));
  const tokensPath = cacheDir + '/bouncer-tokens.json';
  const devCache = existsSync(tokensPath) ? read(tokensPath) : null;
  const dev = devCache?.complete ? devCache.summary as Tokens : null;
  const pricingPath = 'evals/baselines/pricing.json';
  const pricing: Pricing | null = existsSync(pricingPath) ? read(pricingPath) : null;
  const systems = {
    b2: { ...score(b2, labels), precision: null, recall: null, tp: null, fp: null, fn: null },
    b1: score(b1, labels),
    offline: score(frozen.rows.offline, labels),
    live: score(frozen.rows['flash-lite'], labels),
  };
  const sectionScoring = {
    strict: 'The preregistered strict matcher compares the whole section string after case and whitespace normalization.',
    normalized: 'The normalized matcher checks each cited section against the selected rule\'s section list. A bare section number can match a listed subsection. When both specify a subsection, the cited detail must agree. Unqualified citations are read as RTA citations. Unknown rule categories count as mismatches under both methods.',
    post_hoc: 'The normalized matcher was added post-run after review found that strict matching over-counted citation mismatches. The B1 prompt and raw responses are unchanged.',
  };
  const citedMismatches = b1.flatMap(({ id, result }) => {
    const label = labels.find(label => label.id === id)!; // score has validated the row IDs.
    return result.clauses.flatMap(clause => {
      if (verifyClause(label.listing, clause).matchesRule) return [];
      const rule = rules.rules.find(rule => rule.id === clause.ruleId);
      return [{ id, category: clause.ruleId, cited: clause.section, verified: rule?.section ?? null }];
    });
  });
  const mismatchExamples = citedMismatches.filter(row => row.verified !== null).slice(0, 5);
  const unknownRuleMismatches = citedMismatches.filter(row => row.verified === null).length;
  const ledger = calls();
  const b1Attempts = cached.flatMap(row => row.attempts);
  const b1Tokens = tokenSummary(cached.map(row => row.attempts));
  const price = (summary: Tokens | null) => {
    if (!pricing || pricing.model !== 'gemini-3.1-flash-lite' || !summary || summary.mean_prompt === null || summary.mean_output === null) return null;
    return (summary.mean_prompt * pricing.input_per_1M + summary.mean_output * pricing.output_per_1M) / 1e6;
  };
  const b1Failures = { http429: 0, http503: 0, timeout: 0, retries: 0, interrupted: 0 };
  b1Failures.http429 = b1Attempts.filter(event => event.status === 429).length;
  b1Failures.http503 = b1Attempts.filter(event => event.status === 503).length;
  b1Failures.timeout = b1Attempts.filter(event => !event.status && /timeout|aborted/i.test(event.error ?? "")).length;
  b1Failures.retries = cached.reduce((n, row) => n + Math.max(0, row.attempts.length - 1), 0);
  b1Failures.interrupted = cached.filter(row => row.interrupted).length;
  const output = {
    post_v3: true, run_date: ledger[0].at.slice(0, 10), started_at: ledger[0].at, synthetic: true, n: labels.length,
    prereg_commit: preregCommit, prereg_sha256: stableHash('evals/baselines/PREREG.md'),
    harness_sha256: stableHash('evals/run_baselines_v3.ts'),
    live_harness_revisions: [...new Set(cached.map(row => row.harness_sha256))].map(sha256 => ({
      sha256, rows: cached.filter(row => row.harness_sha256 === sha256).length,
    })),
    scoring_sha256: stableHash('evals/baseline_score.ts'), frozen_source: frozen.frozen_source,
    frozen_results_sha256: stableHash('evals/results-v3-final.json'),
    systems, section_scoring: sectionScoring, b1_section_mismatch_examples: mismatchExamples,
    rows: { b1, b2 }, b1_failures: b1Failures,
    recovered_checkpoints: cached.filter(row => row.resumed_before_first_call).map(row => row.id),
    frozen_bouncer_modes: Object.fromEntries(["live", "offline-fallback", "offline"].map(mode => [
      mode, frozen.rows['flash-lite'].filter(row => row.result.mode === mode).length,
    ])),
    b1_tokens: b1Tokens, bouncer_dev_tokens: dev, bouncer_dev_adapter_sha256: devCache?.adapter_sha256 ?? null,
    bouncer_dev_successful_checks: devCache?.rows.filter((row: { success?: boolean }) => row.success).length ?? null,
    calls: ledger, pricing, cost_per_check_usd: { b1: price(b1Tokens), bouncer_dev: price(dev), b2: 0, offline: 0 },
  };
  save('evals/results-v3-baseline.json', output);
  const fmt = (n: number | null) => n === null ? 'n/a' : n.toFixed(3);
  const lines = [
    '# Post-v3 baseline comparison', '',
    "Run date: " + output.run_date + ". n = " + output.n + " synthetic listings.",
    "Harness SHA-256 (LF-normalized): " + output.harness_sha256 + ". Preregistration commit: " + preregCommit + ". Preregistration SHA-256 (LF-normalized): " + output.prereg_sha256 + ".",
    'Bouncer rows are the frozen v3 run at 9be1f86, not re-run.', '',
    '| System | Verdict acc (Wilson 95%) | Violation P/R | Unsafe ADMIT | Quotes not in listing | Section mismatches (strict) | Section mismatches (normalized) | no_answer | Tokens per check (mean) | List-price cost per check |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  const display = [
    ['b2', 'B2 checklist', null, 0],
    ['b1', 'B1 plain chatbot', b1Tokens, output.cost_per_check_usd.b1],
    ['offline', 'Bouncer offline (v3)', null, 0],
    ['live', 'Bouncer live incl. fallbacks (v3)', dev, output.cost_per_check_usd.bouncer_dev],
  ] as const;
  for (const [key, name, summary, cost] of display) {
    const system = systems[key];
    const scope = key === 'live' ? ' (dev proxy)' : '';
    const tokenCell = cost === 0 ? '0 LLM' : summary?.mean_total == null ? 'unavailable' : summary.mean_total.toFixed(1) + scope;
    const costCell = cost === null ? 'cost not computed' : '$' + cost.toFixed(6) + scope;
    lines.push("| " + [
      name, system.correct + "/" + output.n + " (" + fmt(system.verdict_accuracy) + ", " + system.wilson95.map(fmt).join(" to ") + ")",
      key === "b2" ? "n/a" : fmt(system.precision) + "/" + fmt(system.recall), system.unsafe_admit,
      system.quotes_not_in_listing, system.section_mismatches_strict, system.section_mismatches_normalized,
      system.no_answer, tokenCell, costCell,
    ].join(" | ") + " |");
  }
  const coverage = (summary: Tokens | null) => summary
    ? summary.measured_checks + "/" + summary.checks + " fully metered checks, " + summary.metadata_responses + "/" + summary.http_attempts + " attempts with usable metadata, p95 " + (summary.p95 ?? "unavailable") + " tokens"
    : "measurement unavailable";
  lines.push(
    '', `B1 found all ${systems.b1.tp + systems.b1.fn} labelled violations (recall ${systems.b1.recall?.toFixed(2)}) and had ${systems.b1.quotes_not_in_listing} quote absent from the listing. It had ${systems.b1.section_mismatches_strict} strict and ${systems.b1.section_mismatches_normalized} normalized section mismatches. These counts measure agreement with the verified rule table.`,
    '', sectionScoring.post_hoc, '', sectionScoring.strict, '', sectionScoring.normalized,
    '', '### Remaining B1 citation mismatches', '',
    '| Listing | Selected rule | Chatbot citation | Verified section |',
    '|---|---|---|---|',
    ...mismatchExamples.map(row => `| ${row.id} | ${row.category} | ${row.cited} | ${row.verified} |`),
    '', `The normalized total also includes ${unknownRuleMismatches} clauses for which B1 selected \`other\`, which has no corresponding section in the rule table.`,
    '', 'Run ledger: ' + ledger.length + '/50 attempts. B1 recorded ' + b1Failures.http429 + ' HTTP 429s, ' + b1Failures.http503 + ' HTTP 503s, ' + b1Failures.timeout + ' timeouts and ' + b1Failures.retries + ' retries. A missing B1 answer counts as a wrong verdict.',
    '', 'Frozen live-mode rows: ' + output.frozen_bouncer_modes.live + ' live successes, ' + output.frozen_bouncer_modes['offline-fallback'] + ' provider fallbacks, and ' + output.frozen_bouncer_modes.offline + ' deterministic offline refusal.',
    '', 'B1 token coverage: ' + coverage(b1Tokens) + '. Bouncer dev token coverage: ' + coverage(dev) + '. Token and cost averages use only fully metered checks. Output includes thinking tokens.',
    '', 'List-price estimate; the demo runs on the free tier ($0). ' + (pricing ? '[Google Gemini pricing](' + pricing.url + '), accessed ' + pricing.accessed + '.' : 'Cost not computed.'),
    '', 'The interrupted first worker left a pre-request checkpoint at ' + output.recovered_checkpoints.join(', ') + '. The resumed worker preserved completed replies and the same request configuration. The JSON and raw cache record both live harness revisions.',
    '', '## What this does not show',
    '', 'The small synthetic sample cannot establish real-world accuracy. B1 received the same 12 rule titles and an extra other category. It received no verified sections or Bouncer logic. B2 uses the card-defined interpretation of [RCMP guidance](https://www.rcmp.ca/en/bc/safety-tips/frauds-and-scams/rental-scams); it emits no clauses, quotes or sections.',
    '', 'Frozen v3 token usage is unavailable. The Bouncer cost proxy uses ten separate dev listings and the unmodified current Flash-Lite adapter. It cannot establish historical v3 cost, production costs under provider failure, or the overhead of the rest of the app.',
    '', 'The three demo-sample checks are outside the 30-case comparison.',
    '', '## Replay from the committed cache',
    '', 'Run `node --import tsx evals/run_baselines_v3.ts` from the repo root after installing dependencies. It regenerates this report, the metrics JSON and the sample export from the committed raw cache without network calls.',
  );
  writeFileSync('evals/RESULTS-BASELINES.md', lines.join('\n') + '\n');
}
