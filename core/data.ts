import rules from '../data/rta_rules.json' with { type: 'json' };
import model from '../data/scam_model.json' with { type: 'json' };
import geocodes from '../data/geocode_cache.json' with { type: 'json' };
import commutes from '../data/commute_table.json' with { type: 'json' };
import benchmarks from '../data/cmhc_benchmarks.json' with { type: 'json' };
export interface Data {
  rules: typeof rules;
  model: typeof model;
  geocodes: typeof geocodes;
  commutes: { source:string; gtfs_feed_date:string; walk_m_per_min:number; origins:{id:string;lat:number;lon:number;label:string;to:Record<'UW'|'WLU',{arrive_by_0830?:string|null;minutes:number;summary:string}|null>}[] };
  benchmarks: typeof benchmarks;
}
export const data: Data = { rules, model, geocodes, commutes, benchmarks };
