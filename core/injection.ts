export const hasInjection = (s: string) => /ignore\s+(?:(?:all|previous|prior)\s+)*(?:instructions?|rules)|approve\s+this|system\s*prompt|you\s+are\s+(?:now\s+)?(?:an?\s+)?(?:assistant|system)/i.test(s);
export function refusalReason(s: string): 'too_short'|'non_english'|'image_only'|'injection_only'|undefined {
  if (/^\s*(?:https?:\/\/\S+\.(?:png|jpe?g|webp)|\[image\]|data:image\/)/i.test(s)) return 'image_only';
  if (s.trim().length < 20) return 'too_short';
  if (hasInjection(s) && !/room|rent|sublet|apartment|deposit|viewing|\$/i.test(s)) return 'injection_only';
  s=s.replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w.]+|\+?\d[\d\s().-]{6,}\d/gi,' ');
  const letters = s.match(/\p{L}/gu) ?? []; const ascii = s.match(/[a-z]/gi) ?? [];
  if ((letters.length > 10 && ascii.length / letters.length < 0.6) || (/\b(?:chambre|loyer|appartement|alquiler|habitaci[oó]n|miete|wohnung)\b/i.test(s) && !/\b(?:room|rent|sublet|viewing)\b/i.test(s))) return 'non_english';
}
