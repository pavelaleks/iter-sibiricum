import numpy as np, pyproj, json
from scipy.optimize import least_squares
from gcp1914 import L, R
def proj(l1,l2): return pyproj.Proj(proj='eqdc', lat_1=l1, lat_2=l2, lon_0=105, R=1)
def model(q, lon, lat):
    l1,l2,s,th,tx,ty = q; X,Y = proj(l1,l2)(lon, lat); c,sn=np.cos(th),np.sin(th)
    return tx + s*(c*X - sn*Y), ty - s*(sn*X + c*Y)
def fit(P):
    P=np.array([p[:4] for p in P],float); x,y,la,lo=P.T
    res=lambda q: np.r_[model(q,lo,la)[0]-x, model(q,lo,la)[1]-y]
    r=least_squares(res,[42,66,3090,.13,2900,4870],loss='soft_l1',f_scale=8,bounds=([20,25,300,-1,-20000,-20000],[75,85,20000,1,20000,20000]),x_scale=[5,5,300,.05,300,300])
    return r.x, np.hypot(*res(r.x).reshape(2,-1))
out={}
for nm,P in [('L',L),('R',R)]:
    q,e=fit(P); keep=[p for p,ee in zip(P,e) if ee<35]; q,e=fit(keep)
    print(nm,'n',len(keep),'of',len(P),'rmse',round(float(np.sqrt((e**2).mean())),1),'max',round(float(e.max()),1), np.round(q,3))
    out[nm]=list(map(float,q))
json.dump(out,open('model1914.json','w'))
# сдвиг между страницами: одна и та же точка в двух моделях
xL,yL=model(out['L'],np.array([92.17,88.0]),np.array([58.45,65.8])); xR,yR=model(out['R'],np.array([92.17,88.0]),np.array([58.45,65.8]))
print('L vs R for Yeniseysk/Turukhansk', np.round(xL),np.round(yL), np.round(xR),np.round(yR))
