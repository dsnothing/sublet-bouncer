// Source: https://www.rcmp.ca/en/bc/safety-tips/frauds-and-scams/rental-scams
// Accessed 2026-11-24. Card-defined operationalization, not an RCMP scoring tool.
// The advisory directly discusses deposits before viewing, overseas recipients,
// absent landlords and checking the address. The remaining flags and thresholds
// are prescribed by C12, not a verbatim or exhaustive RCMP checklist.
export function checklist(listing: string) {
  const flags: string[] = [];
  const tests: [string, RegExp][] = [
    ['payment_before_viewing', /(?:pay|send|transfer|deposit)[^.\n]{0,100}(?:before|prior to|without)[^.\n]{0,40}(?:view|see|tour|meet)|(?:before|prior to)[^.\n]{0,30}(?:view|tour)[^.\n]{0,80}(?:pay|deposit)/i],
    ['landlord_away', /(?:landlord|owner|I(?: am|'m))[^.\n]{0,50}(?:abroad|overseas|out of (?:the )?(?:country|town)|away)|(?:abroad|overseas)[^.\n]{0,40}(?:landlord|owner)/i],
    ['risky_payment', /wire(?: transfer)?|crypto(?:currency)?|bitcoin|gift\s*cards?/i],
    ['urgency', /urgent|immediately|act (?:now|fast)|today only|high (?:in )?demand|first come|(?:pay|deposit|send)[^.\n]{0,50}(?:today|tonight|within \d+ hours)/i],
    ['messaging_only', /(?:whats\s*app|telegram|signal|messenger)\s+only|only\s+(?:on\s+|via\s+|through\s+)?(?:whats\s*app|telegram|signal|messenger)/i],
  ];
  for (const [name, pattern] of tests) if (pattern.test(listing)) flags.push(name);
  if (!/\b\d{1,5}\s+[\w .'-]+?\s(?:street|st\b|road|rd\b|avenue|ave\b|drive|dr\b|crescent|cres\b|boulevard|blvd\b|lane|ln\b|place|pl\b|court|ct\b)/i.test(listing)) flags.push('no_address');
  return { verdict: flags.length >= 2 ? 'REFUSE' : flags.length ? 'HOLD' : 'ADMIT', flags, clauses: [] };
}
