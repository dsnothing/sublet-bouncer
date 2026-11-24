import { normalizeAddress } from '../../core/engine.js';
import type { Data } from '../../core/data.js';
type Geo=Data['geocodes']['entries'][number];
// A single queue limits starts to one request per second in this server process.
export function createGeocoder(fetcher:typeof fetch=(...args)=>fetch(...args)) {
  const cache=new Map<string,Promise<Geo|undefined>>();
  let queue=Promise.resolve();let lastStart=0;
  return (address:string):Promise<Geo|undefined>=>{
    const key=normalizeAddress(address);const cached=cache.get(key);if(cached)return cached;
    const result=queue.then(async()=>{
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(Date.now()-lastStart))));
      lastStart=Date.now();
      try {
        const url=new URL('https://nominatim.openstreetmap.org/search');
        url.search=new URLSearchParams({q:key+', Waterloo, Ontario, Canada',format:'json',limit:'1',countrycodes:'ca'}).toString();
        const response=await fetcher(url,{headers:{'User-Agent':'sublet-bouncer/1.0'},signal:AbortSignal.timeout(5000)});
        if(!response.ok)return undefined;
        const rows=await response.json() as {lat?:string;lon?:string}[];
        if(!Array.isArray(rows)||!rows[0])return undefined;
        const lat=Number(rows[0].lat),lon=Number(rows[0].lon);
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return undefined;
        return {key,aliases:[],lat,lon,confidence:1};
      }catch{return undefined;}
    });
    cache.set(key,result);queue=result.then(()=>undefined,()=>undefined);return result;
  };
}
export const geocode=createGeocoder();
