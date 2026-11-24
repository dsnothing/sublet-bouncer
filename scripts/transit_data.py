"""Scheduled weekday routing: depart 07:00, earliest arrival, at most two vehicles.
Walk edges use straight-line distance at 80m/min (not a pedestrian network).
"""
import csv,io,json,math,time,zipfile,urllib.request,urllib.parse,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; CACHE=ROOT/'scripts/.cache'; CACHE.mkdir(exist_ok=True)
DATE='2026-11-24'; SERVICE='20261124'; START=7*3600; DEADLINE=8*3600+30*60
def write(name,obj): (ROOT/name).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf8')
def distance(a,b):
    lat1,lon1=a;lat2,lon2=b
    return 6371000*2*math.asin(min(1,math.sqrt(math.sin(math.radians(lat2-lat1)/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(math.radians(lon2-lon1)/2)**2)))
def geocode():
    entries=[]
    names=['Columbia Street West','King Street North','Lester Street','Sunview Street','Hickory Street West','Phillip Street','Albert Street','Regina Street North','Ezra Avenue','Bricker Avenue','Erb Street West','Westmount Road North','University Avenue West','Icon 330 Phillip Street','Sage 8 Hickory Street West','University of Waterloo Davis Centre','Wilfrid Laurier University']
    for name in names:
        q=f'{name}, Waterloo, Ontario, Canada'; p=CACHE/(hashlib.sha256(q.encode()).hexdigest()+'.json')
        if not p.exists():
            time.sleep(1.1)
            req=urllib.request.Request('https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode(dict(q=q,format='jsonv2',limit=1)),headers={'User-Agent':'sublet-bouncer-dev'})
            try:p.write_bytes(urllib.request.urlopen(req,timeout=30).read())
            except Exception as e: print('Geocode unavailable:',name,type(e).__name__);continue
        rows=json.loads(p.read_text())
        if rows:
            r=rows[0]; lat,lon=float(r['lat']),float(r['lon'])
            if not (43.4<lat<43.55 and -80.65<lon<-80.4):continue
            key=name.lower(); aliases=[key]
            for full,short in [('street','st'),('avenue','ave'),('road','rd'),('north','n'),('west','w')]:aliases+=[key.replace(full,short)]
            if 'Icon' in name:aliases+=['icon','icon towers','330 phillip']
            if 'Sage' in name:aliases+=['sage','sage condos']
            entries.append(dict(key=key,aliases=sorted(set(aliases)),lat=lat,lon=lon,confidence=.8 if 'Street' in name or 'Road' in name else .9))
    write('data/geocode_cache.json',dict(source='https://nominatim.openstreetmap.org/search (OSM, ODbL); street centroids, not address-level geocoding',retrieved=DATE,entries=entries))
    print('Geocoded entries:',len(entries))
def transit():
    stops={};trips=[]; hashes=[]
    for feed in [1,2]:
        p=CACHE/f'gtfs{feed}.zip'; url=f'https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/{feed}'
        if not p.exists():p.write_bytes(urllib.request.urlopen(url).read())
        hashes.append(hashlib.sha256(p.read_bytes()).hexdigest())
        z=zipfile.ZipFile(p)
        def rows(f):return list(csv.DictReader(io.StringIO(z.read(f).decode('utf-8-sig'))))
        active={r['service_id'] for r in rows('calendar_dates.txt') if r['date']==SERVICE and r['exception_type']=='1'}
        for r in rows('stops.txt'):
            stops[f'{feed}:{r["stop_id"]}']=(float(r['stop_lat']),float(r['stop_lon']),r['stop_name'])
        route={r['route_id']:r.get('route_short_name',r['route_id']) for r in rows('routes.txt')}
        eligible={r['trip_id']:route[r['route_id']] for r in rows('trips.txt') if r['service_id'] in active}
        grouped={}
        def sec(t):return sum(int(v)*m for v,m in zip(t.split(':'),[3600,60,1]))
        for r in rows('stop_times.txt'):
            if r['trip_id'] not in eligible:continue
            arr,dep=sec(r['arrival_time']),sec(r['departure_time'])
            if arr<START or dep>DEADLINE:continue
            grouped.setdefault(r['trip_id'],[]).append((int(r['stop_sequence']),f'{feed}:{r["stop_id"]}',arr,dep,r.get('pickup_type','0')!='1',r.get('drop_off_type','0')!='1'))
        for tid,seq in grouped.items():trips.append((eligible[tid],sorted(seq)))
    ids=list(stops)
    # Foot transfers <=250m; origin access <=600m; final walk <=600m.
    foot={s:[(t,math.ceil(distance(stops[s][:2],stops[t][:2])/80)*60) for t in ids if s!=t and distance(stops[s][:2],stops[t][:2])<=250] for s in ids}
    campuses={'UW':(43.4726,-80.5420),'WLU':(43.4738,-80.5275)}
    candidates=[s for s in ids if 43.44<=stops[s][0]<=43.505 and -80.58<=stops[s][1]<=-80.49]
    selected=[]
    # Spatially spread representative real stop coordinates rather than invented points.
    for s in sorted(candidates,key=lambda s:distance(stops[s][:2],campuses['UW'])):
        if all(distance(stops[s][:2],stops[t][:2])>=100 for t in selected):selected.append(s)
        if len(selected)==150:break
    origins=[]
    for origin in selected:
        coord=stops[origin][:2]; initial={s:(START+math.ceil(distance(coord,stops[s][:2])/80)*60,'walk') for s in ids if distance(coord,stops[s][:2])<=600}
        best=dict(initial)
        for round in range(2):
            nxt=dict(best)
            for route,seq in trips:
                boarded=None
                for _,s,arr,dep,pickup,dropoff in seq:
                    if boarded is not None and dropoff and arr<nxt.get(s,(10**9,''))[0]:nxt[s]=(arr,boarded)
                    if pickup and s in best and best[s][0]<=dep and boarded is None:boarded=best[s][1]+f' > GRT {route}'
            # Foot edges don't consume another vehicle; one transfer walk per round.
            walked=dict(nxt)
            for s,(arr,path) in nxt.items():
                for t,secs in foot[s]:
                    if arr+secs<walked.get(t,(10**9,''))[0]:walked[t]=(arr+secs,path+' > walk')
            best=walked
        dest={}
        for campus,point in campuses.items():
            options=[(START+math.ceil(distance(coord,point)/80)*60,'walk direct')]
            options += [(arr+math.ceil(distance(stops[s][:2],point)/80)*60,path+' > campus walk') for s,(arr,path) in best.items() if distance(stops[s][:2],point)<=600]
            arrival,path=min(options)
            dest[campus]=dict(arrive_by_0830=f'{arrival//3600:02d}:{arrival%3600//60:02d}',minutes=math.ceil((arrival-START)/60),summary=f'07:00 departure; {path}; straight-line walking estimate') if arrival<=DEADLINE else None
        origins.append(dict(id=origin,lat=coord[0],lon=coord[1],label=stops[origin][2],to=dest))
    write('data/commute_table.json',dict(source='https://www.grt.ca/about-grt/open-data/; staticfeeds/1 + /2 at https://webapps.regionofwaterloo.ca/api/grt-routes/api/; scheduled 2026-11-24, depart 07:00 America/Toronto; <=1 transfer; straight-line walking; not Winter 2027 service',gtfs_feed_date=DATE,walk_m_per_min=80,origins=origins))
    write('data/transit_provenance.json',dict(source=[f'https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/{i}' for i in [1,2]],retrieved=DATE,service_date=SERVICE,sha256=hashes,active_trips=len(trips),origins=len(origins),campus_coordinates=campuses,walking_limit_m=dict(access=600,transfer=250,egress=600)))
    print('Commute origins:',len(origins),'active morning trips:',len(trips))
if __name__=='__main__':
    if '--geocode' in sys.argv:geocode()
    else:transit()
