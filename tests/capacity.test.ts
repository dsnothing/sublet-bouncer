import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyze } from '../core/engine';
import type { AnalyzeRequest } from '../core/types';
import { AnalysisCache, VisitorBuckets, cacheKey, createCapacityAnalyzer, RATE_LIMIT_REASON } from '../api/_lib/capacity';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE as profile } from '../api/_lib/samples';
import { createGeminiAdapter } from '../api/gemini';
import handler from '../api/analyze';
import type { ApiRequest } from '../api/analyze';
import type { ServerResponse } from 'node:http';
const listing=SAMPLE_LISTINGS[0];
const req:AnalyzeRequest={listing,profile,mode:'live'};
const raw={fields:{},clauses:[]};
const gemini=(value:unknown=raw)=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]}));
beforeEach(()=>{
 vi.stubEnv('GEMINI_API_KEY','mock-key');vi.stubEnv('GEMINI_MODEL','gemini-3.1-flash-lite');vi.stubEnv('GEMINI_FALLBACK_MODEL','gemini-3-flash-preview');
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('visitor bucket has burst 3 and refills at 6 per ten minutes; visitors are independent',()=>{
 let now=0;const buckets=new VisitorBuckets(()=>now);expect([buckets.take('a'),buckets.take('a'),buckets.take('a'),buckets.take('a')]).toEqual([true,true,true,false]);expect(buckets.take('b')).toBe(true);
 now=100000;expect(buckets.take('a')).toBe(true);expect(buckets.take('a')).toBe(false);now=1000000;expect([buckets.take('a'),buckets.take('a'),buckets.take('a'),buckets.take('a')]).toEqual([true,true,true,false]);
});
it('cache keeps live provenance, clones results, isolates profile/mode and never caches fallback',async()=>{
 let now=1000;const cache=new AnalysisCache([],()=>now);const live=await analyze(req,{llm:{model:'gemini-3.1-flash-lite',extract:async()=>raw}});cache.put(req,live);
 const hit=cache.get(req)!;expect(hit).toMatchObject({mode:'live',model:'gemini-3.1-flash-lite',cached:true,cachedAt:new Date(now).toISOString()});hit.verdict='REFUSE';expect(cache.get(req)!.verdict).toBe(live.verdict);
 expect(cache.get({...req,profile:{...profile,campus:'WLU'}})).toBeUndefined();expect(cache.get({...req,mode:'offline'})).toBeUndefined();
 const fallback=await analyze(req);cache.put({...req,listing:'custom'},fallback);expect(cache.get({...req,listing:'custom'})).toBeUndefined();
 now+=3600000;expect(cache.get(req)).toBeUndefined();
});
it('cache LRU evicts at 200 and does not reuse spans for whitespace changes',async()=>{
 const cache=new AnalysisCache([]);const live=await analyze(req,{llm:{model:'mock',extract:async()=>raw}});
 for(let i=0;i<200;i++){const request={...req,listing:`${listing} ${i}`};cache.put(request,{...live,listing:request.listing});}
 const first={...req,listing:`${listing} 0`},second={...req,listing:`${listing} 1`};cache.get(first);cache.put(req,live);expect(cache.get(first)).toBeDefined();expect(cache.get(second)).toBeUndefined();
 expect(cacheKey({...req,listing:listing.replaceAll(' ','  ')})).toBe(cacheKey(req));expect(cache.get({...req,listing:listing.replaceAll(' ','  ')})).toBeUndefined();
});
it('seeds only serve exact public samples and reject offline entries',async()=>{
 const live=await analyze(req,{llm:{model:'original',extract:async()=>raw}});const entry={key:cacheKey(req),cachedAt:'2026-01-01T00:00:00Z',result:live};
 expect(new AnalysisCache([entry]).get(req)).toMatchObject({cached:true,model:'original',cachedAt:entry.cachedAt});
 expect(new AnalysisCache([{...entry,result:{...live,mode:'offline-fallback'}}]).get(req)).toBeUndefined();
 const pasted={...req,listing:'Custom pasted listing'};expect(new AnalysisCache([{...entry,key:cacheKey(pasted),result:{...live,listing:pasted.listing}}]).get(pasted)).toBeUndefined();
});
it('noCache bypasses cache reads and writes; cache hits do not spend visitor tokens',async()=>{
 const llm=vi.fn(()=>({model:'mock',extract:async()=>raw}));const service=createCapacityAnalyzer({llm,geocode:async()=>undefined,cache:new AnalysisCache([])});
 expect((await service(req,'a')).cached).toBeUndefined();expect((await service(req,'a')).cached).toBe(true);expect(llm).toHaveBeenCalledTimes(1);
 expect((await service({...req,noCache:true},'a')).cached).toBeUndefined();expect(llm).toHaveBeenCalledTimes(2);
 const other={...req,listing:listing+' Other.'};await service({...other,noCache:true},'a');expect((await service(other,'b')).cached).toBeUndefined();expect(llm).toHaveBeenCalledTimes(4);
});
it('limited live requests return honest offline fallback; offline mode consumes no tokens',async()=>{
 const llm=vi.fn(()=>({model:'mock',extract:async()=>raw}));const service=createCapacityAnalyzer({llm,geocode:async()=>undefined,cache:new AnalysisCache([])});
 await service({...req,mode:'offline'},'a');for(let i=0;i<3;i++)expect((await service({...req,noCache:true},'a')).mode).toBe('live');
 const result=await service({...req,noCache:true},'a');expect(result.mode).toBe('offline-fallback');expect(result.fallbackReason).toBe(RATE_LIMIT_REASON);expect(result.verdictConfidence).toBe('reduced');expect(llm).toHaveBeenCalledTimes(3);
});
it('handler applies first x-forwarded-for hop and returns HTTP 200 when limited',async()=>{
 const spy=vi.fn(async()=>gemini());vi.stubGlobal('fetch',spy);
 async function call(ip:string){let result:any;let status:number|undefined;const res={setHeader:vi.fn(),writeHead:vi.fn(),end:vi.fn((text:string)=>{result=JSON.parse(text);}),set statusCode(value:number){status=value;}} as unknown as ServerResponse;
 await handler({method:'POST',headers:{'x-forwarded-for':ip},body:{...req,noCache:true}} as unknown as ApiRequest,res);return {result,status};}
 for(let i=0;i<3;i++)expect((await call(`198.51.100.7, proxy${i}`)).result.mode).toBe('live');
 const limited=await call('198.51.100.7, newproxy');expect(limited.status).toBe(200);expect(limited.result.fallbackReason).toBe(RATE_LIMIT_REASON);expect(spy).toHaveBeenCalledTimes(3);
});
it('public seed sample definitions stay identical to UI',()=>{
 const ui=readFileSync('web/src/adapter.ts','utf8');for(const sample of SAMPLE_LISTINGS)expect(ui).toContain(sample);
});
it('coalesces an identical in-flight burst into one upstream call with honest live flags',async()=>{
 let finish!:(raw:unknown)=>void;const extract=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const service=createCapacityAnalyzer({llm:()=>({model:'mock',extract}),geocode:async()=>undefined,cache:new AnalysisCache([])});
 const burst=Array.from({length:10},(_,i)=>service(req,`ip${i}`));expect(extract).toHaveBeenCalledTimes(1);finish(raw);
 const results=await Promise.all(burst);expect(new Set(results.map(r=>r.runId)).size).toBe(1);expect(results.every(r=>r.mode==='live'&&!r.cached)).toBe(true);
 results[1].verdict='REFUSE';expect(results[0].verdict).not.toBe('REFUSE');expect((await service(req,'new')).cached).toBe(true);
});
it('clears failed in-flight results so the next request can try live again',async()=>{
 const extract=vi.fn().mockRejectedValueOnce(new Error('mock failure')).mockResolvedValue(raw);
 const service=createCapacityAnalyzer({llm:()=>({model:'mock',extract}),geocode:async()=>undefined,cache:new AnalysisCache([])});
 const results=await Promise.all([service(req,'a'),service(req,'b')]);expect(results.every(r=>r.mode==='offline-fallback')).toBe(true);expect(extract).toHaveBeenCalledTimes(1);
 expect((await service(req,'c')).mode).toBe('live');expect(extract).toHaveBeenCalledTimes(2);
});
it('noCache requests are independent while identical requests are in flight',async()=>{
 const extract=vi.fn(async()=>raw);const service=createCapacityAnalyzer({llm:()=>({model:'mock',extract}),geocode:async()=>undefined,cache:new AnalysisCache([])});
 await Promise.all([service({...req,noCache:true},'a'),service({...req,noCache:true},'b')]);expect(extract).toHaveBeenCalledTimes(2);
});
it.each([429,503])('retries primary once after advertised short retryDelay on %i',async(status)=>{
 vi.useFakeTimers();const spy=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{details:[{retryDelay:'2s'}]}}),{status})).mockResolvedValueOnce(gemini());vi.stubGlobal('fetch',spy);
 const promise=analyze(req,{llm:createGeminiAdapter()});await vi.advanceTimersByTimeAsync(1999);expect(spy).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1);
 const result=await promise;expect(result.mode).toBe('live');expect(result.model).toBe('gemini-3.1-flash-lite');expect(spy.mock.calls[0][0]).toBe(spy.mock.calls[1][0]);
});
it('one advertised retry then Flash on repeated rate limits, without exceeding budget',async()=>{
 vi.useFakeTimers();const busy=()=>new Response('',{status:429,headers:{'retry-after':'3'}});
 const spy=vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockResolvedValueOnce(gemini());vi.stubGlobal('fetch',spy);
 const promise=analyze(req,{llm:createGeminiAdapter()});await vi.advanceTimersByTimeAsync(3100);const result=await promise;
 expect(result.model).toBe('gemini-3-flash-preview');expect(spy).toHaveBeenCalledTimes(3);expect(spy.mock.calls[0][0]).toBe(spy.mock.calls[1][0]);expect(spy.mock.calls[2][0]).toContain('gemini-3-flash-preview');
});
it.each(['4s','invalid','-1s'])('skips excessive or invalid advertised delay %s',async(retryDelay)=>{
 const spy=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{details:[{retryDelay}]}}),{status:503})).mockResolvedValueOnce(gemini());vi.stubGlobal('fetch',spy);
 const result=await analyze(req,{llm:createGeminiAdapter()});expect(result.model).toBe('gemini-3-flash-preview');expect(spy).toHaveBeenCalledTimes(2);
});
it('retry plus slow primary and fallback stays within the existing 14/6-second split',async()=>{
 vi.useFakeTimers();const pending=(_url:unknown,init:RequestInit)=>new Promise<Response>((_,reject)=>init.signal!.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}));
 const spy=vi.fn().mockResolvedValueOnce(new Response('',{status:429,headers:{'retry-after':'3'}})).mockImplementation(pending);vi.stubGlobal('fetch',spy);
 const promise=analyze(req,{llm:createGeminiAdapter()});await vi.advanceTimersByTimeAsync(19999);expect(spy).toHaveBeenCalledTimes(3);await vi.advanceTimersByTimeAsync(2);
 expect((await promise).mode).toBe('offline-fallback');
});
