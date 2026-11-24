import type { AnalysisResult, ProfileState, RegressionFixture } from './types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIcsStamp(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

export function buildViewingIcs(result: AnalysisResult, profile: ProfileState): string {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const locationField = result.fields.address?.value;
  const location =
    typeof locationField === 'string' && locationField.trim().length > 0
      ? locationField.trim()
      : 'Waterloo, ON (confirm exact unit before arrival)';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sublet Bouncer//Waterloo Co-op Gate//EN',
    'BEGIN:VEVENT',
    `UID:${result.runId}@sublet-bouncer.local`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:Sublet Viewing (${profile.campus} ${profile.termStart} to ${profile.termEnd})`,
    `LOCATION:${location.replace(/[\r\n]/g, ' ')}`,
    `DESCRIPTION:Verdict: ${result.verdict}. Scam risk: ${(result.scam.p * 100).toFixed(0)}%. Never pay before viewing in person.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadEvidenceCard(result: AnalysisResult): void {
  const payload = {
    runId: result.runId,
    verdict: result.verdict,
    reasons: result.reasons,
    rtaApplies: result.rtaApplies,
    scam: result.scam,
    commute: result.commute,
    clauses: result.clauses,
    couldNotCheck: result.couldNotCheck,
    savedAt: new Date().toISOString(),
  };
  downloadTextFile(
    `sublet-bouncer-evidence-${result.runId}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

export function downloadRegressionFixture(fixture: RegressionFixture): void {
  downloadTextFile(
    `regression-${fixture.decision_id}-${Date.now()}.json`,
    JSON.stringify(fixture, null, 2),
    'application/json',
  );
}
