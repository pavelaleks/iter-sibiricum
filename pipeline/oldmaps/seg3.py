import numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
D=np.load('grid.npz'); LAB=D['LAB']; lon=D['lon']; lat=D['lat']; inside=D['inside']
LAB=np.stack([ndi.gaussian_filter(LAB[...,k],2.0) for k in range(3)],-1)
ref=json.load(open('legend_lab.json'))
W={'russian':(30,195,35,75),'samoyed':(40,115,63,79),'ostyak_samoyed':(74,92,56,67.5),'ostyak':(58,92,56,67.5),'vogul':(55,68,57,65),
   'tatar':(58,95,48,60.5),'kirghiz':(45,86,40,56),'kara_kirghiz':(68,82,38,44),'buryat':(97,122,49,57.5),'mongol_other':(74,96,42,53),
   'tungus_other':(125,150,43,64),'yakut':(105,162,56,74),'tungus':(84,150,50,72),'paleo':(138,195,49,73),'tajik':(65,75,36,41),'sart':(60,75,37,45),'uzbek':(55,72,37,44),'turkmen':(50,65,35,43),'karakalpak':(56,63,40,46)}
ref['paleo']=list(np.mean([ref[k] for k in ['chukchi','koryak','kamchadal','paleo_other']],0))
bg={'paper':[88,0,11],'paper2':[82,-4,6],'sea':[76,-3,4.5],'sea2':[70,-2,5]}
names=list(W)+list(bg); refs=np.array([ref[k] if k in ref else bg[k] for k in names])
wt=np.array([.45,1.6,1.6])
d=np.sqrt((((LAB[...,None,:]-refs[None,None])*wt)**2).sum(-1))
for i,k in enumerate(names):
    if k in W:
        a,b,c,e=W[k]; ok=(lon>=a)&(lon<=b)&(lat>=c)&(lat<=e); d[...,i]=np.where(ok,d[...,i],1e9)
lab=d.argmin(-1); dm=d.min(-1); lab[(dm>14)|~inside]=len(names)  # не уверены
lab=ndi.median_filter(lab,size=5)
np.save('lab.npy',lab); json.dump(names,open('names.json','w'))
pal=np.array([[220,60,60],[150,110,200],[90,60,120],[40,160,60],[140,220,120],[90,70,20],[220,200,120],[200,160,80],[240,140,50],[200,90,20],[250,200,0],[250,240,120],[255,255,190],[150,150,150],[255,180,200],[180,140,100],[120,100,60],[100,90,40],[160,120,80],[255,255,255],[255,255,255],[190,220,255],[190,220,255],[0,0,0]],np.uint8)
img=pal[lab]; Image.fromarray(img).save('lab.png')
for i,k in enumerate(names): print(k,(lab==i).sum())
