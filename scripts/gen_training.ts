import { mkdirSync, writeFileSync } from 'node:fs';
let state = 33817;
const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32);
const pick = <T>(a: T[]) => a[Math.floor(random() * a.length)];
const rows = Array.from({length:200}, (_, i) => {
  const scam = +(i >= 100);
  const rent = Math.round((scam ? 420 + random()*750 : 700 + random()*650)/5)*5;
  const address = random() < (scam ? .5 : .95) ? pick(['118 Cedar Street','65 Marshall Street','92 Bridgeport Road','41 Weber Street']) : 'Address available on request';
  const red = ['Send deposit before viewing','wire transfer required','gift card payment','I am abroad','WhatsApp only','urgent today only','send passport now','luxury pool penthouse','duplicate listing posted everywhere'];
  const flags = red.filter(() => random() < (scam ? .55 : .035));
  const narrative = scam && random()<.25 ? 'I have experienced a difficult family situation and must relocate. '.repeat(24) : '';
  return {id:`train-${i+1}`,synthetic:true,source:'seeded template generator v1; seed 33817; no real landlord or listing',listing:`${pick(['Co-op room','Furnished bedroom','Student accommodation'])} at ${address}. Rent $${rent}/month. ${pick(['May to August 2027','September to December 2027'])}. ${random()<(scam?.25:.9)?'Viewing available.':'Ask for details.'} ${flags.join('. ')}. ${narrative}`,scam};
});
mkdirSync('data/training',{recursive:true});
writeFileSync('data/training/synthetic.jsonl',rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(`Generated ${rows.length} synthetic training listings; gold set is separate.`);
