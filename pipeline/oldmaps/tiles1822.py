import numpy as np, pyproj, json, math, io, os
from PIL import Image
from scipy.ndimage import map_coordinates
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression
Q=json.load(open('model1822.json'))
im=np.asarray(Image.open('iter_weimar_1822.png').convert('RGB')).astype(np.float32)
H,W,_=im.shape
def model(q, lon, lat):
    l1,l2,s,th,tx,ty=q; X,Y=pyproj.Proj(proj='eqdc',lat_1=l1,lat_2=l2,lon_0=105,R=1)(lon,lat); c,sn=np.cos(th),np.sin(th)
    return tx+s*(c*X-sn*Y), ty-s*(sn*X+c*Y)
def sample(lon,lat):
    x,y=model(Q,lon,lat); a=(x>=76)&(x<=1256)&(y>=113)&(y<=916)
    rgb=np.stack([map_coordinates(im[...,k],[y.ravel(),x.ravel()],order=1,mode='nearest').reshape(x.shape) for k in range(3)],-1)
    return rgb,a
def tile_ll(z,x,y,n=256):
    i=(np.arange(n)+.5)/n; X=(x+i[None,:])/2**z*360-180; Yn=(y+i[:,None])/2**z
    lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*Yn)))); lon=np.broadcast_to(X,(n,n)); lat=np.broadcast_to(lat,(n,n))
    return np.array(lon), np.array(lat)
def lon2x(lon,z): return int((lon+180)/360*2**z)
def lat2y(lat,z): r=math.radians(lat); return int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**z)
tiles=[]
for z in range(1,5):
    for (a,b) in [(25,-180),(25,180)]: pass
    xs=list(range(lon2x(25,z),2**z))+list(range(0,lon2x(-160,z)+1)); ys=range(lat2y(82,z),lat2y(22,z)+1)
    n=0
    for x in xs:
        for y in ys:
            lon,lat=tile_ll(z,x,y); lon=np.where(lon<-100,lon+360,lon)
            rgb,a=sample(lon,lat)
            if not a.any(): continue
            arr=np.dstack([np.clip(rgb,0,255).astype(np.uint8),(a*255).astype(np.uint8)])
            buf=io.BytesIO(); Image.fromarray(arr,'RGBA').save(buf,'WEBP',quality=78,method=5); tiles.append((zxy_to_tileid(z,x,y),buf.getvalue())); n+=1
    print('z',z,n)
tiles.sort()
with open('weimar1822.pmtiles','wb') as f:
    w=Writer(f)
    for t,d in tiles: w.write_tile(t,d)
    w.finalize({'tile_type':TileType.WEBP,'tile_compression':Compression.NONE,'min_zoom':1,'max_zoom':4,'min_lon_e7':250000000,'min_lat_e7':220000000,'max_lon_e7':1800000000,'max_lat_e7':820000000,'center_zoom':3,'center_lon_e7':1000000000,'center_lat_e7':550000000},
      {'name':'Charte vom Asiatischen Russland, 1822','attribution':'Geographisches Institut, Weimar, 1822; скан: РНБ / World Digital Library'})
print(len(tiles), os.path.getsize('ethno1914.pmtiles')//1024,'KB')
