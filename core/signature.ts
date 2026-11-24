import type { AnalysisResult } from './types.js';

// Preserve the frozen v3 repeat signature, including its treatment of rule IDs.
export function decisionSignature(result: AnalysisResult): string {
  const fields = Object.fromEntries(
    Object.entries(result.fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, field]) => [key, field.value])
  );
  const clauses = result.clauses.map(clause => clause.ruleId).sort();
  return JSON.stringify({ fields, clauses, verdict: result.verdict });
}
