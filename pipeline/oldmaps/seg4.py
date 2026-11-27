import numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
D=np.load('grid.npz'); LAB=D['LAB']; lon=D['lon']; lat=D['lat']; inside=D['inside']
LABs=np.stack([ndi.gaussian_filter(LAB[...,k],2.0) for k in range(3)],-1)
L,A,B=LABs[...,0],LABs[...,1],LABs[...,2]
lab=np.load('lab.npy'); names=json.load(open('names.json')); ix={k:i for i,k in enumerate(names)}
V=np.load('diag.npy')[:lab.shape[0],:lab.shape[1]]
win=lambda a,b,c,e:(lon>=a)&(lon<=b)&(lat>=c)&(lat<=e)
C={}
C['khanty']=lab==ix['ostyak']
C['samoyedic']=lab==ix['samoyed']
C['selkup']=lab==ix['ostyak_samoyed']
C['kazakh_kirghiz']=lab==ix['kirghiz']
C['siberian_tatar']=(lab==ix['tatar'])&win(58,95,50,61)
east=((lab==ix['yakut'])|(lab==ix['tungus']))
C['sakha']=east&(V<-0.2)
C['evenki_even']=east&(V>=-0.2)
C['buryat']=win(97,122,49,57.5)&(A>6)&(B-A>9)&(L>58)&inside&(lab!=ix['russian'])
pal=lab==ix['paleo']
C['chukchi']=pal&((lat>=64.6)|((lon>=172)&(lat>=62)))&(lon>=162)
C['koryak']=pal&~C['chukchi']&(lat>=57.6)&(lon>=156)
C['itelmen_kamchadal']=pal&(lat<57.6)&(lon>=154)
C['yukaghir']=pal&(lon<162)&(lat>=62)
C['nivkh']=pal&win(136,144.5,50.5,55)
def clean(m, close=3, minpix=60):
    m=ndi.binary_closing(m,structure=np.ones((3,3)),iterations=close)
    m=ndi.binary_opening(m,structure=np.ones((3,3)),iterations=1)
    m=ndi.binary_fill_holes(m)
    lb,n=ndi.label(m); sz=ndi.sum(m,lb,range(1,n+1)); keep=np.isin(lb,np.where(sz>=minpix)[0]+1)
    return keep
out={}
for k,m in C.items():
    out[k]=clean(m, minpix=25 if k in ('nivkh','itelmen_kamchadal','buryat','yukaghir','siberian_tatar') else 60)
    print(k,int(m.sum()),'->',int(out[k].sum()))
np.savez_compressed('classes.npz',**out)
colors={'khanty':(40,170,60),'samoyedic':(150,100,210),'selkup':(90,50,130),'kazakh_kirghiz':(200,160,90),'siberian_tatar':(110,80,20),'sakha':(230,60,160),'evenki_even':(250,190,0),'buryat':(255,110,0),'chukchi':(0,120,255),'koryak':(0,200,220),'itelmen_kamchadal':(0,60,160),'yukaghir':(120,200,255),'nivkh':(255,0,0)}
base=np.asarray(Image.open('e_small.jpg').resize((lab.shape[1],lab.shape[0]))).astype(float)
ov=base.copy()
for k,m in out.items(): ov[m]=ov[m]*0.35+np.array(colors[k])*0.65
Image.fromarray(ov.astype(np.uint8)).resize((1400,1007)).save('classes.jpg')
