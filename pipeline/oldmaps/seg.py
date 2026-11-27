import numpy as np, json
from PIL import Image
from skimage import color, filters
im=np.asarray(Image.open('iter_ethnographic_1914.jpg').convert('RGB')).astype(np.float32)/255
ox,oy=95,690
rows={'russian':130,'tajik':165,'chukchi':240,'koryak':272,'kamchadal':312,'paleo_other':348,'buryat':428,'mongol_other':462,'tungus':540,'tungus_other':578,'sart':652,'kirghiz':688,'yakut':722,'turkmen':757,'uzbek':793,'tatar':828,'karakalpak':864,'samoyed':942,'ostyak_samoyed':978,'ostyak':1055,'vogul':1090}
ref={}
for k,y in rows.items():
    x0,x1=62,113
    if k=='kirghiz': x0,x1=62,86
    sw=im[oy+y-9:oy+y+9, ox+x0:ox+x1]
    # убрать тёмные цифры и рамку: медиана по яркости
    px=sw.reshape(-1,3); L=px.mean(1); px=px[L>np.percentile(L,25)]
    ref[k]=px.mean(0)
ref['kara_kirghiz']=im[oy+688-9:oy+688+9, ox+90:ox+112].reshape(-1,3).mean(0)
lab={k:color.rgb2lab(v[None,None,:])[0,0] for k,v in ref.items()}
for k,v in lab.items(): print(f'{k:15s}', np.round(ref[k]*255).astype(int), np.round(v,1))
json.dump({k:list(map(float,v)) for k,v in lab.items()},open('legend_lab.json','w'))
