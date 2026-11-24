import { afterEach, expect, it, vi } from 'vitest';
import { createGeminiAdapter, PRIMARY_TIMEOUT_MS, FALLBACK_TIMEOUT_MS, RULE_CODES, responseSchema } from '../api/gemini';
import { analyze, LLM_TIMEOUT_MS } from '../core/engine';
const listing='Room at 203 Lester Street. Rent $850/month. Viewing available. Owner does not live here.';
const profile={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW' as const,classStart:'08:30'};
const answer=(raw:unknown={fields:{},clauses:[]})=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(raw)}]}}]}));
const pending=(_url:unknown,init:RequestInit)=>new Promise<Response>((_,reject)=>init.signal!.addEventListener('abort',()=>reject(init.signal!.reason),{once:true}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('gives a timed-out primary 14 seconds and fallback 6, within the engine 20-second budget',async()=>{
 vi.useFakeTimers();
 expect(PRIMARY_TIMEOUT_MS+FALLBACK_TIMEOUT_MS).toBe(LLM_TIMEOUT_MS);
 const spy=vi.fn(pending);vi.stubGlobal('fetch',spy);
 const result=analyze({listing,profile,mode:'live'},{llm:createGeminiAdapter('test','gemini-3.1-flash-lite','gemini-3-flash-preview')});
 await vi.advanceTimersByTimeAsync(13999);expect(spy).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(spy).toHaveBeenCalledTimes(2);
 expect(spy.mock.calls[0][1].signal!.aborted).toBe(true);
 await vi.advanceTimersByTimeAsync(5999);expect(spy.mock.calls[1][1].signal!.aborted).toBe(false);
 await vi.advanceTimersByTimeAsync(1);expect((await result).mode).toBe('offline-fallback');
 expect(spy.mock.calls[1][1].signal!.aborted).toBe(true);
 expect(vi.getTimerCount()).toBe(0);
});
it('recovers after primary timeout and preserves the answering model',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(pending).mockImplementationOnce(async()=>answer()));
 const adapter=createGeminiAdapter('test','gemini-3.1-flash-lite','gemini-3-flash-preview');
 const result=analyze({listing,profile,mode:'live'},{llm:adapter});
 await vi.advanceTimersByTimeAsync(14000);
 expect(await result).toMatchObject({mode:'live',model:'gemini-3-flash-preview'});
 expect(adapter.fallbackReason).toContain('timeout');expect(vi.getTimerCount()).toBe(0);
});
it('limits a fast rate-limit fallback to 6 seconds rather than consuming the total remainder',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('',{status:429})).mockImplementationOnce(pending));
 const result=analyze({listing,profile,mode:'live'},{llm:createGeminiAdapter('test')});
 await vi.advanceTimersByTimeAsync(6000);expect((await result).fallbackReason).toContain('attempt timeout');expect(vi.getTimerCount()).toBe(0);
});
it('bounds the response body read as well as the initial fetch',async()=>{
 vi.useFakeTimers();
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>({ok:true,status:200,json:()=>pending(_url,init)})));
 const result=analyze({listing,profile,mode:'live'},{llm:createGeminiAdapter('test')});
 await vi.advanceTimersByTimeAsync(20000);expect((await result).mode).toBe('offline-fallback');expect(vi.getTimerCount()).toBe(0);
});
it('expands short rule codes before span verification and retains C2b risk flags',async()=>{
 const text='A reserve is retained until the room is returned intact.';
 const risk='Funds must arrive ahead of your inspection.';
 vi.stubGlobal('fetch',async()=>answer({fields:{payment_before_viewing:{value:true,confidence:.9,span:{text:risk}}},clauses:[{span:{text},proposed_rule_id:RULE_CODES[0]}]}));
 const result=await analyze({listing:listing+' '+text+' '+risk,profile,mode:'live'},{llm:createGeminiAdapter('test')});
 expect(result.mode).toBe('live');expect(result.verdict).toBe('REFUSE');
 expect(result.clauses[0]).toMatchObject({ruleId:'damage_deposit',confidence:.7,status:'questionable'});
 expect(result.clauses[0].span.start).toBe(listing.length+1);
 expect(result.escalations.some(e=>e.decisionId==='D2')).toBe(true);
});
it('requests minimal thinking, bounded tokens and clauses, without unused output',async()=>{
 const spy=vi.fn(async()=>answer());vi.stubGlobal('fetch',spy);
 await createGeminiAdapter('test','gemini-3.1-flash-lite').extract(listing);
 const body=JSON.parse(String((spy.mock.calls[0] as unknown as [string,RequestInit])[1].body));
 expect(body.generationConfig).toMatchObject({thinkingConfig:{thinkingLevel:'minimal'},maxOutputTokens:2048});
 expect(responseSchema.properties.clauses.maxItems).toBe(12);
 expect(responseSchema.properties.clauses.items.properties).not.toHaveProperty('rationale');
 expect(responseSchema.properties.clauses.items.properties).not.toHaveProperty('confidence');
 expect(responseSchema.properties.fields.properties).not.toHaveProperty('utilities');
});
