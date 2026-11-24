import { createHash } from 'node:crypto';
import { analyze, type AnalyzeOptions } from '../../core/engine.js';
import { normalize, type LLMAdapter } from '../../core/extract.js';
import type { AnalyzeRequest, AnalysisResult } from '../../core/types.js';
import seeds from './sample-cache.json' with { type: 'json' };
import { SAMPLE_LISTINGS } from './samples.js';
import { createGeminiAdapter } from '../gemini.js';
import { geocode } from './geocode.js';

export const RATE_LIMIT_REASON='Live checks are limited per visitor to protect the shared free quota; offline engine used.';
export interface CacheEntry { key:string; cachedAt:string; result:AnalysisResult }
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
    if(result.mode!=='live'||!result.model||result.cached)return;
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
export function createCapacityAnalyzer(options:{cache?:AnalysisCache;limiter?:VisitorBuckets;llm?:()=>LLMAdapter;geocode?:AnalyzeOptions['geocode']}={}) {
  const cache=options.cache??new AnalysisCache(),limiter=options.limiter??new VisitorBuckets();
  const inFlight=new Map<string,{listing:string;promise:Promise<AnalysisResult>}>();
  const run=async(req:AnalyzeRequest,ip:string):Promise<AnalysisResult>=>{
    if(req.mode==='offline')return analyze(req);
    const allowed=limiter.take(ip);
    const llm=allowed?(options.llm??createGeminiAdapter)():{extract:async()=>{throw new Error(RATE_LIMIT_REASON);}};
    const result=await analyze(req,{llm,...(allowed?{geocode:options.geocode??geocode}:{})});
    if(!req.noCache)cache.put(req,result);
    return result;
  };
  return async(req:AnalyzeRequest,ip:string):Promise<AnalysisResult>=>{
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
