import numpy as np, json, pyproj
from scipy import ndimage as ndi
from skimage import measure
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
D=np.load('grid.npz'); lon=D['lon']; lat=D['lat']; inside=D['inside']
lab=np.load('lab.npy'); names=json.load(open('names.json')); ix={k:i for i,k in enumerate(names)}
C=dict(np.load('classes.npz'))
win=lambda a,b,c,e:(lon>=a)&(lon<=b)&(lat>=c)&(lat<=e)
C['kazakh_kirghiz']&=lat>=41.5
land=inside&~np.isin(lab,[ix['sea'],ix['sea2']])&(lab!=ix['russian'])
C.pop('buryat',None)
M=json.load(open('model1914.json'))
def inv(q,x,y):
    l1,l2,s,th,tx,ty=q; c,sn=np.cos(th),np.sin(th); u=(x-tx)/s; v=-(y-ty)/s
    return pyproj.Proj(proj='eqdc',lat_1=l1,lat_2=l2,lon_0=105,R=1)(c*u+sn*v,-sn*u+c*v,inverse=True)
def toll(rc):
    y=rc[:,0]*4+2; x=rc[:,1]*4+2
    loR,laR=inv(M['R'],x,y); loL,laL=inv(M['L'],x,y)
    lo=np.where(x>=2105,loR,loL); la=np.where(x>=2105,laR,laL); lo=np.where(lo<-100,lo+360,lo)
    return np.c_[lo,la]
LBL={'khanty':'остяки','samoyedic':'юраки, самоеды и тавгийцы','selkup':'остяко-самоеды','kazakh_kirghiz':'киргизы','siberian_tatar':'татары','sakha':'якуты','evenki_even':'тунгусы',
     'chukchi':'чукчи','koryak':'коряки','itelmen_kamchadal':'камчадалы','yukaghir':'юкагиры, чуванцы и другие палеоазиаты','nivkh':'юкагиры, чуванцы и другие палеоазиаты (на Амуре и Сахалине — гиляки)'}
from shapely.geometry import shape, box
LAND=unary_union([shape(f['geometry']) for f in json.load(open('/home/claude/atlas2/build/land.json'))['features'] if shape(f['geometry']).intersects(box(25,25,200,82))])
# Чукотка за 180° в данных Natural Earth лежит у −180…−165: переносим её копию на 180…195
from shapely.affinity import translate
LAND=unary_union([LAND, translate(LAND.intersection(box(-180,50,-160,80)),360,0)])
LAKES=unary_union([shape(f['geometry']) for f in json.load(open('/home/claude/atlas2/build/lakes.json'))['features'] if (f['properties'].get('scalerank') or 9)<=5])
LAND=LAND.difference(LAKES)
# Камчатка и Чукотка на карте 1914 г. целиком закрашены палеоазиатскими группами; цвет их серой заливки
# сливается с морем, поэтому их контуры строятся по суше в границах, которые проведены на карте
NE=LAND.intersection(box(155.4,50.8,195,73))
CHUK=NE.intersection(unary_union([box(162,64.6,195,73),box(172,62.3,195,73)]))
KOR=NE.intersection(box(155.4,57.6,175,64.6)).difference(CHUK)
KAM=NE.intersection(box(155.4,50.8,164.5,57.6))
EXTRA={'chukchi':CHUK,'koryak':KOR,'itelmen_kamchadal':KAM}
F=[]
for k,m in C.items():
    sm=ndi.gaussian_filter(m.astype(float),1.2)
    polys=[]
    for c in measure.find_contours(np.pad(sm,1),0.5):
        c=c-1
        if len(c)<8: continue
        p=Polygon(toll(c)).buffer(0)
        if p.area>0.15: polys.append(p)
    if k in EXTRA: polys=[EXTRA[k]]  # см. выше
    if not polys: continue
    u=unary_union(polys).intersection(LAND).simplify(0.06,preserve_topology=True)
    if u.is_empty: continue
    from shapely.geometry.polygon import orient
    u=unary_union([orient(g,1.0) for g in (u.geoms if hasattr(u,'geoms') else [u]) if g.geom_type=='Polygon'])
    if u.geom_type=='Polygon': u=orient(u,1.0)
    else:
        from shapely.geometry import MultiPolygon; u=MultiPolygon([orient(g,1.0) for g in u.geoms])
    geom=mapping(u)  # внешние кольца против часовой стрелки (RFC 7946)
    groups=[k]+(['nenets'] if k=='samoyedic' else [])+(['samoyedic'] if k=='selkup' else [])
    F.append({'type':'Feature','properties':{'groups':groups,'term':LBL[k],'source':'1914'},'geometry':geom})
    print(k, u.geom_type, round(u.area,1), len(json.dumps(geom))//1000,'KB')
json.dump({'type':'FeatureCollection','features':F},open('areas1914.geojson','w'),ensure_ascii=False,separators=(',',':'))
import os; print(os.path.getsize('areas1914.geojson')//1024,'KB')
