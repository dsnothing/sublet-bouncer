import type { AnalysisResult } from './types';
import { findSpan, LIVE_RISK_FIELDS, offlineExtract } from './extract';
export interface CmhcBenchmarks { median_monthly: { room?: number; bachelor: number; one_bedroom?: number; two_bedroom?: number }; [key:string]: unknown }
export const FEATURE_NAMES = ['rent_to_median','payment_before_viewing','risky_payment_method','landlord_abroad','off_platform_only','no_address','no_viewing_offered','urgency_language','sob_story_length','early_id_request','amenities_vs_price','duplicate_markers'] as const;
export type FeatureName = typeof FEATURE_NAMES[number];
export const featureNames = FEATURE_NAMES;
export const paymentBeforeViewing = (s: string) => /(?:pay|send|transfer|deposit)[^.\n]{0,90}before\s+(?:(?:a|the)\s+)?(?:viewing|tour|visit|seeing)|(?:viewing|tour)[^.\n]{0,40}(?:after|once)[^.\n]{0,40}(?:pay|deposit)|deposit\s+(?:first|to\s+(?:book|secure))/i.test(s);
export function computeFeatures(listing: string, suppliedFields?: Partial<AnalysisResult['fields']>, benchmarks?: CmhcBenchmarks): Record<FeatureName, number> {
  const fields = { ...offlineExtract(listing).fields, ...suppliedFields };
  const median = benchmarks?.median_monthly.room ?? benchmarks?.median_monthly.bachelor ?? 1000;
  const rent = Number(fields.rent?.value); const ratio = rent > 0 ? rent / median : 1;
  const features = Object.fromEntries(featureNames.map((n,i) => [n, [ratio,+paymentBeforeViewing(listing),+/crypto|bitcoin|gift\s*card|wire\s*transfer|e-transfer[^.\n]{0,30}deposit/i.test(listing),+/\babroad\b|out of (?:the )?country|i(?:'m| am) away/i.test(listing),+/(?:whatsapp|telegram|email)\s+only/i.test(listing),+!fields.address,+!(fields.viewing_offered?.value === true),+/urgent|act now|today only|immediately|won't last/i.test(listing),Math.max(0,listing.length-1200)/1000,+/\b(?:SIN|social insurance|passport|photo ID)\b/i.test(listing),+(ratio < .6 && /luxury|pool|penthouse|all inclusive/i.test(listing)),+/copy.?paste|posted everywhere|duplicate listing/i.test(listing)][i]])) as Record<FeatureName, number>;
  for (const name of LIVE_RISK_FIELDS) {
    const f = suppliedFields?.[name];
    if (f?.value === true && f.span && findSpan(listing,f.span.text)) features[name] = 1;
  }
  return features;
}

export function extractFeatures(listing:string, fields:AnalysisResult['fields'], median=1000) { return computeFeatures(listing,fields,{median_monthly:{bachelor:median}}); }
