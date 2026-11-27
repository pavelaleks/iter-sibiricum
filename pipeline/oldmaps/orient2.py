import numpy as np
from PIL import Image
from scipy import ndimage as ndi
g=np.asarray(Image.open('iter_ethnographic_1914.jpg').convert('L')).astype(np.float32)/255
g=g[::2,::2]
hp=g-ndi.gaussian_filter(g,3)
gx=ndi.sobel(hp,1); gy=ndi.sobel(hp,0)
S=3
Jxx=ndi.gaussian_filter(gx*gx,S); Jyy=ndi.gaussian_filter(gy*gy,S); Jxy=ndi.gaussian_filter(gx*gy,S)
c2=(Jxx-Jyy); s2=2*Jxy; m=np.sqrt(c2**2+s2**2)+1e-9
# голос за диагональ: s2/m ≈ +1 → градиент 45° (штрих «/»), ≈ −1 → −45° (штрих «\»)
v=s2/m*np.clip(m/(Jxx+Jyy+1e-9),0,1)
V=ndi.gaussian_filter(v,10)[::2,::2]
np.save('diag.npy',V)
for nm,(x,y) in {'yakut_vil':(2880,1300),'yakut_verkh':(3060,1080),'yak_kolyma':(3300,900),'tung_olenek':(2600,920),'tung_q6':(2400,1250),'tung_okhotsk':(3400,1300),'tung_anabar':(2450,980)}.items():
    print(nm, round(float(V[y//4,x//4]),2))
img=((np.clip(V,-0.5,0.5)+0.5)*255).astype(np.uint8); Image.fromarray(img).resize((1400,1007)).save('diag.png')
