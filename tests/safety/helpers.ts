import { offlineExtract } from '../../core/extract';
import { SAMPLE_PROFILE as profile } from '../../api/_lib/samples';
export { profile };
export const shell = (text:string) => 'Room at 200 Lester Street, Waterloo, ON. Rent $900/month. Viewing available. Owner does not live here. '+text;
export const stub = (listing:string, text?:string, ruleId?:string) => ({model:'stub-no-network',extract:async()=>({...offlineExtract(listing),clauses:text&&ruleId?[{span:{text,start:listing.indexOf(text),end:listing.indexOf(text)+text.length},confidence:1,proposed_rule_id:ruleId,rationale:'Check this term'}]:[]})});
