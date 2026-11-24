"""Extract the published CMHC mean series; room is an explicitly derived proxy."""
import csv,io,json,zipfile,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]; cache=root/'scripts/.cache/rents.zip'
cache.parent.mkdir(exist_ok=True)
if not cache.exists():
    # Node's fetch is accepted by the source, whose CDN rejects Python urllib here.
    subprocess.run(['node','-e',"fetch('https://www150.statcan.gc.ca/n1/tbl/csv/34100133-eng.zip').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);require('fs').writeFileSync(process.argv[1],Buffer.from(await r.arrayBuffer()))})",str(cache)],check=True)
z=zipfile.ZipFile(cache)
rows=[r for r in csv.DictReader(io.TextIOWrapper(z.open('34100133.csv'),encoding='utf-8-sig')) if r['REF_DATE']=='2025' and r['GEO']=='Kitchener-Cambridge-Waterloo, Ontario' and r['Type of structure']=='Row and apartment structures of three units and over']
values={r['Type of unit']:float(r['VALUE']) for r in rows if r['VALUE']}
out=dict(source='https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301',retrieved='2026-11-24',region='Kitchener-Cambridge-Waterloo',year=2025,statistic='mean',median_monthly=dict(room=values['Two bedroom units']/2,bachelor=values['Bachelor units'],one_bedroom=values['One bedroom units'],two_bedroom=values['Two bedroom units']),notes='Schema key median_monthly holds MEANS, not medians. CMHC RMS/Statistics Canada 34-10-0133-01: row and apartment structures of three units and over, 2025. Room proxy = two-bedroom mean / 2 = 908; rooms are not separately published here. Occupied/available stock rents are not current asking sublet prices. No room median is claimed.')
(root/'data/cmhc_benchmarks.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf8')
print('Verified CMHC benchmark rows:',len(rows))
