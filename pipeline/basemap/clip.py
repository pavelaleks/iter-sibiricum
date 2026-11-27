import json
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
NE='/tmp/ne/geojson/'
REG=[box(-15,25,180,82), box(-180,25,-165,82)]
def load(n): return json.load(open(NE+n))['features']
def clip(feats, keep, regional=True, simp=0):
    out=[]
    for f in feats:
        g=shape(f['geometry'])
        if not g.is_valid: g=g.buffer(0)
        parts=[g.intersection(b) for b in REG] if regional else [g]
        for p in parts:
            if p.is_empty: continue
            if simp: p=p.simplify(simp, preserve_topology=True)
            out.append({'type':'Feature','properties':{k:f['properties'].get(k) for k in keep},'geometry':mapping(p)})
    return out
land=load('ne_10m_land.geojson')
json.dump({'type':'FeatureCollection','features':clip(land,['scalerank'],False)},open('land_world.json','w'))
json.dump({'type':'FeatureCollection','features':clip(land,['scalerank'])},open('land.json','w'))
lk=[f for f in load('ne_10m_lakes.geojson')]
json.dump({'type':'FeatureCollection','features':clip(lk,['scalerank','name','name_ru','name_en'])},open('lakes.json','w'))
rv=[f for f in load('ne_10m_rivers_lake_centerlines.geojson') if f['properties'].get('featurecla')!='Lake Centerline (Intermittent)']
json.dump({'type':'FeatureCollection','features':clip(rv,['scalerank','name','name_ru','name_en','featurecla'])},open('rivers.json','w'))
import os;[print(n, os.path.getsize(n)//1024,'K') for n in ['land_world.json','land.json','lakes.json','rivers.json']]
print(set(f['properties'].get('featurecla') for f in rv))
