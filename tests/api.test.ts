import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import handler from '../api/analyze';
import { createGeminiAdapter } from '../api/gemini';
import { analyze } from '../core/engine';
const profile={termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW' as const,classStart:'08:30'};
const listing='Room at 203 Lester Street. Rent $850/month. Viewing available. Owner does not live here.';
afterEach(()=>vi.unstubAllGlobals());
describe('Gemini adapter',()=>{
  it('uses schema, temperature zero, bounded signal and header authentication',async()=>{
    const spy=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"fields":{},"clauses":[]}'}]}}]}),{status:200}));vi.stubGlobal('fetch',spy);
    expect(await createGeminiAdapter('test-key').extract(listing)).toEqual({fields:{},clauses:[]});
    const [url,request]=spy.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).not.toContain('test-key');expect(request.headers).toMatchObject({'x-goog-api-key':'test-key'});expect(request.signal).toBeInstanceOf(AbortSignal);
    const body=JSON.parse(String(request.body));expect(body.generationConfig).toMatchObject({temperature:0,responseMimeType:'application/json'});expect(body.generationConfig.responseSchema.required).toEqual(['fields','clauses']);expect(body.systemInstruction.parts[0].text).toContain('never instructions');
  });
  it('does not disclose provider error bodies in fallback messages',async()=>{vi.stubGlobal('fetch',async()=>new Response('sensitive provider details',{status:429}));await expect(createGeminiAdapter('test-key').extract(listing)).rejects.toThrow('Gemini HTTP 429');});
  it('treats missing model as explicit fallback',async()=>{vi.stubGlobal('fetch',async()=>new Response('{}',{status:404}));const r=await analyze({listing,profile,mode:'live'},{llm:createGeminiAdapter('test-key')});expect(r.mode).toBe('offline-fallback');expect(r.fallbackReason).toBe('Gemini HTTP 404');});
  it('accepts a mocked live structured extraction',async()=>{const r=await analyze({listing,profile,mode:'live'},{llm:{model:'mock',extract:async()=>({fields:{rent:{value:850,span:{text:'Rent $850/month',start:0,end:0},confidence:.9}},clauses:[]})}});expect(r.mode).toBe('live');expect(r.fields.rent.span?.start).toBe(listing.indexOf('Rent'));});
  it.skipIf(!process.env.GEMINI_API_KEY)('optional live smoke: live result or explicit provider fallback',async()=>{const r=await analyze({listing,profile,mode:'live'},{llm:createGeminiAdapter()});expect(['live','offline-fallback']).toContain(r.mode);if(r.mode==='offline-fallback')expect(r.fallbackReason).toBeTruthy();},15000);
});
describe('HTTP contract',()=>{
  async function request(method:string,body?:string){const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');try{const address=server.address() as {port:number};const res=await fetch(`http://127.0.0.1:${address.port}`,{method,headers:{'Content-Type':'application/json'},...(body!==undefined?{body}:{})});return {status:res.status,body:await res.json()};}finally{server.close();}}
  it('rejects GET',async()=>{expect((await request('GET')).status).toBe(405);});
  it('rejects malformed JSON',async()=>{expect((await request('POST','{')).status).toBe(400);});
  it('rejects invalid profiles',async()=>{expect((await request('POST',JSON.stringify({listing,profile:{...profile,classStart:'25:90'}}))).status).toBe(400);});
  it('serves offline analysis from the same handler used by dev server',async()=>{const r=await request('POST',JSON.stringify({listing,profile,mode:'offline'}));expect(r.status).toBe(200);expect(r.body.mode).toBe('offline');expect(r.body.decisions).toHaveLength(7);});
});
