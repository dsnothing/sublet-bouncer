import {
  analyze as coreAnalyze,
  markWrong as coreMarkWrong,
  perform as corePerform,
  resolveEscalation as coreResolveEscalation,
  undo as coreUndo,
} from '../../core/index';
import admitFixtureRaw from '../../core/fixtures/sample-result.admit.json';
import holdFixtureRaw from '../../core/fixtures/sample-result.hold.json';
import refuseFixtureRaw from '../../core/fixtures/sample-result.refuse.json';
import type {
  AnalysisResult,
  AnalyzeRequest,
  DataSourceMode,
  Decision,
  RegressionFixture,
  SampleKey,
  Verdict,
} from './types';

// Clean/scammy are gold examples; tricky is a separate demo sample.
export const SAMPLE_LISTINGS: Record<
  SampleKey,
  { label: string; badge: Verdict; goldId: string; listing: string }
> = {
  clean: {
    label: 'Clean',
    badge: 'ADMIT',
    goldId: 'gold-01',
    listing:
      'At 250 Lester Street a furnished room is $950/month. January 1 to April 30 2027. Utilities included. Viewing available. Owner does not live here.',
  },
  tricky: {
    label: 'Hidden terms',
    badge: 'HOLD',
    goldId: 'demo-hero', // Demo sample, not an eval item
    listing:
      "Furnished room at 200 Lester Street, $900/month, January 1 to April 30 2027. Viewing any evening this week. Owner does not live here. First month's rent plus an extra $400 we hold in case anything gets broken. The landlord can pop in whenever he likes, no need to tell you first.",
  },
  scammy: {
    label: 'Scammy',
    badge: 'REFUSE',
    goldId: 'gold-25',
    listing:
      'Private room $450/month. No address yet. I am away. Send deposit before viewing by crypto. WhatsApp only. Act now.',
  },
};

export function getSampleListing(key: SampleKey): string {
  return SAMPLE_LISTINGS[key].listing;
}

export function isBundledSampleListing(listing: string): boolean {
  return (
    listing === SAMPLE_LISTINGS.clean.listing ||
    listing === SAMPLE_LISTINGS.tricky.listing ||
    listing === SAMPLE_LISTINGS.scammy.listing
  );
}

export function isFixturesDemoEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === 'fixtures';
  } catch {
    return false;
  }
}

export const CLIENT_LIVE_TIMEOUT_MS = 20_000;
const HEALTH_CHECK_TIMEOUT_MS = 3_500;

export async function checkApiReachable(signal?: AbortSignal): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), HEALTH_CHECK_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeoutId);
      return false;
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: timeoutController.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: unknown; liveConfigured?: unknown };
    return data?.ok === true && data?.liveConfigured === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

function matchFixtureForListing(listing: string): { result: AnalysisResult; notice?: string } {
  const lower = listing.toLowerCase();
  let fixture: AnalysisResult;
  if (
    lower.includes('crypto') ||
    lower.includes('telegram') ||
    lower.includes('abroad') ||
    lower.includes('i am away') ||
    lower.includes('before viewing') ||
    lower.includes('gift card')
  ) {
    fixture = structuredClone(refuseFixtureRaw) as unknown as AnalysisResult;
  } else if (
    lower.includes('no pets') ||
    lower.includes('damage deposit') ||
    lower.includes('post-dated') ||
    lower.includes('security deposit') ||
    lower.includes('share the kitchen') ||
    lower.includes('share kitchen')
  ) {
    fixture = structuredClone(holdFixtureRaw) as unknown as AnalysisResult;
  } else {
    fixture = structuredClone(admitFixtureRaw) as unknown as AnalysisResult;
  }

  // Keep the fixture's original listing text so all span offsets stay valid (C5 finding #2).
  const textDiffers = listing.trim() !== fixture.listing.trim();
  return {
    result: fixture,
    notice: textDiffers
      ? 'Fixture demo mode displays the matched sample fixture so clause highlight offsets remain accurate.'
      : undefined,
  };
}

export async function runAnalysis(
  req: AnalyzeRequest,
  source: DataSourceMode,
  options?: { signal?: AbortSignal },
): Promise<{ result: AnalysisResult; notice?: string }> {
  if (source === 'fixtures') {
    if (req.listing === SAMPLE_LISTINGS.tricky.listing) {
      return {
        result: await coreAnalyze({ ...req, mode: 'offline' }),
        notice: 'Fixture demo mode runs this sample with the offline engine.',
      };
    }
    return matchFixtureForListing(req.listing);
  }

  if (source === 'api') {
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, CLIENT_LIVE_TIMEOUT_MS);

    const onExternalAbort = () => timeoutController.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        window.clearTimeout(timeoutId);
        throw new DOMException('Analysis aborted', 'AbortError');
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, mode: 'live' }),
        signal: timeoutController.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error || `API returned ${res.status}`);
      }
      const data = (await res.json()) as AnalysisResult;
      return {
        result: data,
        notice:
          data.mode === 'offline-fallback'
            ? data.fallbackReason ?? 'Live LLM fell back to offline engine'
            : undefined,
      };
    } catch (err) {
      // If the user explicitly cancelled (e.g. clicked "Use offline now" or started a new run), propagate AbortError.
      if (options?.signal?.aborted) {
        throw new DOMException('Analysis aborted', 'AbortError');
      }
      const reason = req.simulateOutage
        ? timedOut
          ? `Simulated outage API call timed out after ${Math.round(CLIENT_LIVE_TIMEOUT_MS / 1000)}s; fell back locally to the offline core engine in browser`
          : err instanceof Error
            ? `Simulated outage API call failed (${err.message}); fell back locally to the offline core engine in browser`
            : 'Simulated outage API call failed; fell back locally to the offline core engine in browser'
        : timedOut
          ? `Live request timed out after ${Math.round(CLIENT_LIVE_TIMEOUT_MS / 1000)}s; ran offline core engine in browser`
          : err instanceof Error
            ? `Live API unreachable (${err.message}); ran offline core engine in browser`
            : 'Live API unreachable; ran offline core engine in browser';
      const fallback = await coreAnalyze({ ...req, mode: 'offline' });
      fallback.mode = 'offline-fallback';
      fallback.fallbackReason = reason;
      return {
        result: fallback,
        notice: reason,
      };
    } finally {
      window.clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  // Offline mode: run real core engine in-browser
  const offlineRes = await coreAnalyze({ ...req, mode: 'offline' });
  return { result: offlineRes };
}

export function resolveEscalationEngine(
  prev: AnalysisResult,
  escalationId: string,
  answer: string,
): { result: AnalysisResult; error?: string } {
  try {
    return { result: coreResolveEscalation(prev, escalationId, answer) };
  } catch (err) {
    return {
      result: prev,
      error: err instanceof Error ? err.message : 'Could not resolve escalation',
    };
  }
}

export function performActionEngine(
  prev: AnalysisResult,
  actionId: string,
): { result: AnalysisResult; error?: string } {
  try {
    return { result: corePerform(prev, actionId) };
  } catch (err) {
    return {
      result: prev,
      error: err instanceof Error ? err.message : 'Action blocked',
    };
  }
}

export function undoLogEntryEngine(
  prev: AnalysisResult,
  logEntryId: string,
): { result: AnalysisResult; error?: string } {
  try {
    return { result: coreUndo(prev, logEntryId) };
  } catch (err) {
    return {
      result: prev,
      error: err instanceof Error ? err.message : 'Could not undo entry',
    };
  }
}

export function markWrongEngine(
  prev: AnalysisResult,
  decisionId: Decision['id'],
  correction: unknown,
): { result: AnalysisResult; fixture?: RegressionFixture; error?: string } {
  try {
    const out = coreMarkWrong(prev, decisionId, correction);
    return {
      result: out.result,
      fixture: {
        ...out.fixture,
        recordedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      result: prev,
      error: err instanceof Error ? err.message : 'Could not apply correction',
    };
  }
}
