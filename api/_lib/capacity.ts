import { createHash } from 'node:crypto';
import { analyze, validateRequest, type AnalyzeOptions } from '../../core/engine.js';
import { normalize, type LLMAdapter } from '../../core/extract.js';
import type { AnalyzeRequest, AnalysisResult } from '../../core/types.js';
import seeds from './sample-cache.json' with { type: 'json' };
import { SAMPLE_LISTINGS } from './samples.js';
import { createGeminiAdapter } from '../gemini.js';
import { geocode } from './geocode.js';

export const RATE_LIMIT_REASON='Live checks are limited per visitor to protect the shared free quota; offline engine used.';
export const BREAKER_REASON='Gemini is overloaded right now (3 failed calls in the last minute); offline engine used. Try again in about a minute.';
export const SIMULATED_REASON='SIMULATED OUTAGE (demo): Gemini was not called';
export const isTransientFailure = (reason: string) => /\b(?:429|503)\b|timed?\s*out|timeout/i.test(reason);
const BREAKER_WINDOW_MS = 60_000;

export function validateCapacityRequest(raw: unknown): asserts raw is AnalyzeRequest {
  validateRequest(raw);
  if (raw.simulateOutage && !SAMPLE_LISTINGS.includes(raw.listing)) {
    throw new Error('Simulation requires an exact bundled sample');
  }
}
export interface CacheEntry { key:string; cachedAt:string; runId?:string; model?:string; rawExtraction?:unknown; signature?:string; result:AnalysisResult }
export function cacheKey(req:AnalyzeRequest):string {
  const p=req.profile;
  return createHash('sha256').update(JSON.stringify([normalize(req.listing),p.termStart,p.termEnd,p.campus,p.classStart,req.mode??'live'])).digest('hex');
}
export class AnalysisCache {
  private entries=new Map<string,CacheEntry>();
  constructor(private seed:CacheEntry[]=seeds as CacheEntry[],private now=Date.now) {}
  get(req:AnalyzeRequest):AnalysisResult|undefined {
    const key=cacheKey(req);
    let entry=this.entries.get(key);
    if(entry && this.now()-Date.parse(entry.cachedAt)>=3600000){this.entries.delete(key);entry=undefined;}
    if(entry){this.entries.delete(key);this.entries.set(key,entry);}
    else if(SAMPLE_LISTINGS.includes(req.listing))entry=this.seed.find(e=>e.key===key);
    // Exact original text preserves evidence offsets; seeds may only hold public samples.
    if(!entry || entry.result.mode!=='live' || !entry.result.model || entry.result.listing!==req.listing || !Number.isFinite(Date.parse(entry.cachedAt)))return;
    return {...structuredClone(entry.result),cached:true,cachedAt:entry.cachedAt};
  }
  put(req:AnalyzeRequest,result:AnalysisResult):void {
    if(req.simulateOutage||result.simulated||result.mode!=='live'||!result.model||result.cached)return;
    const key=cacheKey(req);
    this.entries.delete(key);
    this.entries.set(key,{key,cachedAt:new Date(this.now()).toISOString(),result:structuredClone(result)});
    if(this.entries.size>200)this.entries.delete(this.entries.keys().next().value!);
  }
}
export class VisitorBuckets {
  private buckets=new Map<string,{tokens:number;at:number}>();
  constructor(private now=Date.now) {}
  take(ip:string):boolean {
    const now=this.now(),previous=this.buckets.get(ip)??{tokens:3,at:now};
    const tokens=Math.min(3,previous.tokens+Math.max(0,now-previous.at)*6/600000);
    this.buckets.delete(ip);
    this.buckets.set(ip,{tokens:tokens>=1?tokens-1:tokens,at:now});
    if(this.buckets.size>10000)this.buckets.delete(this.buckets.keys().next().value!);
    return tokens>=1;
  }
}
export function createCapacityAnalyzer(options:{cache?:AnalysisCache;limiter?:VisitorBuckets;llm?:()=>LLMAdapter;geocode?:AnalyzeOptions['geocode'];now?:()=>number}={}) {
  const now=options.now??Date.now;
  const cache=options.cache??new AnalysisCache(undefined,now),limiter=options.limiter??new VisitorBuckets(now);
  let failures: number[] = [];
  let openUntil: number | undefined;
  let breakerVersion = 0;
  let trialInFlight = false;
  const inFlight=new Map<string,{listing:string;promise:Promise<AnalysisResult>}>();

  const trip = (at: number) => {
    openUntil = at + BREAKER_WINDOW_MS;
    breakerVersion++;
    failures = [];
  };
  const run = async (req: AnalyzeRequest, ip: string): Promise<AnalysisResult> => {
    if (req.mode === 'offline') return analyze(req);
    if (openUntil !== undefined && (now() < openUntil || trialInFlight)) {
      const result = await analyze(req, {
        llm: { async extract() { throw new Error(BREAKER_REASON); } },
      });
      return result.mode === 'offline-fallback' ? { ...result, breaker: 'open' } : result;
    }

    const allowed = limiter.take(ip);
    const trial = allowed && openUntil !== undefined;
    const versionAtStart = breakerVersion;
    if (trial) trialInFlight = true;
    try {
      const llm = allowed
        ? (options.llm ?? createGeminiAdapter)()
        : { async extract() { throw new Error(RATE_LIMIT_REASON); } };
      const result = await analyze(req, {
        llm,
        ...(allowed ? { geocode: options.geocode ?? geocode } : {}),
      });
      // Requests admitted before a trip cannot extend the cooldown or close the breaker.
      if (allowed && !result.refused && result.fallbackReason !== RATE_LIMIT_REASON && versionAtStart === breakerVersion) {
        if (trial) {
          if (result.mode === 'live') openUntil = undefined;
          else trip(now());
        } else if (result.mode === 'offline-fallback' && isTransientFailure(result.fallbackReason ?? '')) {
          const at = now();
          failures = failures.filter(failure => at - failure <= BREAKER_WINDOW_MS);
          failures.push(at);
          if (failures.length >= 3) trip(at);
        } else {
          failures = [];
        }
      }
      if (!req.noCache) cache.put(req, result);
      return result;
    } finally {
      if (trial) trialInFlight = false;
    }
  };
  return async(req:AnalyzeRequest,ip:string):Promise<AnalysisResult>=>{
    validateCapacityRequest(req);
    if (req.simulateOutage) {
      const result = await analyze({ ...req, mode: 'live' }, {
        llm: { async extract() { throw new Error(SIMULATED_REASON); } },
      });
      return { ...result, simulated: true };
    }
    if(req.mode==='offline'||req.noCache)return run(req,ip);
    const cached=cache.get(req);if(cached)return cached;
    const key=cacheKey(req),pending=inFlight.get(key);
    if(pending?.listing===req.listing)return structuredClone(await pending.promise);
    const entry={listing:req.listing,promise:run(req,ip)};
    inFlight.set(key,entry);
    try {return await entry.promise;}
    finally {if(inFlight.get(key)===entry)inFlight.delete(key);}
  };
}
