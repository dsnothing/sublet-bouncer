const injectionPatterns = [
  /\bignore\s+(?:(?:all|previous|prior)\s+)*(?:instructions?|rules)\b|\bapprove\s+this\b|\bsystem\s*prompt\b|\byou\s+are\s+(?:now\s+)?(?:an?\s+)?(?:assistant|system)\b/i,
  // Addressing an AI role, rather than mentioning a human assistant/agent.
  /\b(?:ai\s+assistants?\b|(?:attention|dear|note\s+to)\s+(?:the\s+)?(?:ai(?:\s+assistants?)?|assistants?|llms?|bots?|models?|agents?)\b|(?:ai|assistants?|llms?|bots?|models?|agents?)\s*:)/i,
  /\b(?:mark|rate|classify|label|set|return|output)\s+(?:(?:this|the)\s+(?:(?:listing|post|ad)\s+)?)?(?:as\s+)?(?:safe|legit|legitimate|verified|approved|admit|clean)\b/i,
  /\bapprove\s+(?:(?:this|the)\s+)?(?:listing|post|ad)\b|\bgive\s+(?:this\s+)?an?\s+admit\b/i,
  /\b(?:disregard|forget|override)\s+(?:(?:all|the|your|any|previous|prior|existing|above)\s+)*(?:rules?|instructions?|guidelines?|polic(?:y|ies))\b/i,
  /\b(?:respond\s+with|output)\s+(?:only\s+)?(?:json|admit)\b/i,
  /<\/\s*listing\s*>|\[\s*system\s*\]|###\s*instructions?\b/i,
];
export const hasInjection = (s: string) => {
  // Compatibility normalization catches full-width text; format characters can
  // otherwise invisibly split instruction keywords. Keep original evidence intact.
  const normalized = s.normalize('NFKC').replace(/\p{Cf}/gu, '');
  return injectionPatterns.some(pattern => pattern.test(normalized));
};
export function refusalReason(s: string): 'too_short'|'non_english'|'image_only'|'injection_only'|undefined {
  if (/^\s*(?:https?:\/\/\S+\.(?:png|jpe?g|webp)|\[image\]|data:image\/)/i.test(s)) return 'image_only';
  if (s.trim().length < 20) return 'too_short';
  if (hasInjection(s) && !/room|rent|sublet|apartment|deposit|viewing|\$/i.test(s)) return 'injection_only';
  s=s.replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w.]+|\+?\d[\d\s().-]{6,}\d/gi,' ');
  const letters = s.match(/\p{L}/gu) ?? []; const ascii = s.match(/[a-z]/gi) ?? [];
  if ((letters.length > 10 && ascii.length / letters.length < 0.6) || (/\b(?:chambre|loyer|appartement|alquiler|habitaci[oó]n|miete|wohnung)\b/i.test(s) && !/\b(?:room|rent|sublet|viewing)\b/i.test(s))) return 'non_english';
}
