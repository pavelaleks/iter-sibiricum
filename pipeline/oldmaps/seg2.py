import numpy as np, json, pyproj
from PIL import Image
from skimage import color
from scipy import ndimage as ndi
M=json.load(open('model1914.json')); ref=json.load(open('legend_lab.json'))
im=np.asarray(Image.open('iter_ethnographic_1914.jpg').convert('RGB')).astype(np.float32)/255
F=4
bl=np.stack([ndi.gaussian_filter(im[...,k],5) for k in range(3)],-1)[::F,::F]
LAB=color.rgb2lab(bl)
h,w=LAB.shape[:2]
ys,xs=np.mgrid[0:h,0:w]*F+F/2
def inv(q,x,y):
    l1,l2,s,th,tx,ty=q; c,sn=np.cos(th),np.sin(th); u=(x-tx)/s; v=-(y-ty)/s
    X=c*u+sn*v; Y=-sn*u+c*v; return pyproj.Proj(proj='eqdc',lat_1=l1,lat_2=l2,lon_0=105,R=1)(X,Y,inverse=True)
lonR,latR=inv(M['R'],xs,ys); lonL,latL=inv(M['L'],xs,ys)
lon=np.where(xs>=2105,lonR,lonL); lat=np.where(xs>=2105,latR,latL); lon=np.where(lon<-100,lon+360,lon)
inside=(xs>=95)&(xs<=4170)&(ys>=222)&(ys<=2900)&~((xs<860)&(ys<690))&~((xs<648)&(ys<1838))
np.savez_compressed('grid.npz',LAB=LAB,lon=lon,lat=lat,inside=inside)
def samp(x,y): return np.round(LAB[int(y//F),int(x//F)],1)
for nm,(x,y) in {'sea':(2500,300),'sea2':(3300,700),'mongolia':(2700,2420),'eurrus':(1000,1000),'eurrus2':(700,1950),'china':(3000,2500),'yak_vil':(2880,1300),'tung_q6':(2400,1250),'chuk':(3700,600),'kory':(3820,790),'kamch':(3950,1100),'buryat?':(2600,2090)}.items(): print(nm, samp(x,y))
