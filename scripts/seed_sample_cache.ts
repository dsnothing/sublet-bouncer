// Run explicitly with real provider env vars; never run as part of tests or evals.
import { writeFile } from 'node:fs/promises';
import { analyze } from '../core/engine.js';
import { createGeminiAdapter } from '../api/gemini.js';
import { cacheKey, type CacheEntry } from '../api/_lib/capacity.js';
import { SAMPLE_LISTINGS, SAMPLE_PROFILE } from '../api/_lib/samples.js';
import { geocode } from '../api/_lib/geocode.js';

const entries:CacheEntry[]=[];
for(const [index,listing] of SAMPLE_LISTINGS.entries()) {
  if(index)await new Promise(resolve=>setTimeout(resolve,8000));
  const req={listing,profile:SAMPLE_PROFILE,mode:'live' as const,noCache:true};
  const result=await analyze(req,{llm:createGeminiAdapter(),geocode});
  if(result.mode!=='live'||!result.model)throw new Error(`Sample ${index+1} did not complete live; existing seed file preserved`);
  entries.push({key:cacheKey(req),cachedAt:new Date().toISOString(),result});
}
await writeFile(new URL('../api/_lib/sample-cache.json',import.meta.url),JSON.stringify(entries,null,2)+'\n');
console.log(`Saved ${entries.length} live sample results with original model and timestamps.`);
