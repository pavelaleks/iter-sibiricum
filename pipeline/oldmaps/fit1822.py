import numpy as np, pyproj, json, sys
from scipy.optimize import least_squares
P=[(288,490,58.20,68.25,'Тобольск'),(298,584,54.98,73.37,'Омск'),(591,740,52.29,104.28,'Иркутск'),(870,556,62.03,129.73,'Якутск'),(1000,577,59.36,143.24,'Охотск'),
   (752,798,51.97,116.58,'Нерчинск'),(527,445,65.80,87.95,'Туруханск'),(497,597,58.45,92.17,'Енисейск'),(505,655,56.01,92.87,'Красноярск'),(1220,653,50.87,156.67,'м. Лопатка'),
   (789,569,60.37,120.42,'Олёкминск'),(775,477,66.77,123.37,'Жиганск')]
if len(sys.argv)>1: P=json.load(open(sys.argv[1]))
A=np.array([p[:4] for p in P],float); x,y,la,lo=A.T
def model(q,lo,la):
    l1,l2,s,th,tx,ty=q; X,Y=pyproj.Proj(proj='eqdc',lat_1=l1,lat_2=l2,lon_0=105,R=1)(lo,la); c,sn=np.cos(th),np.sin(th)
    return tx+s*(c*X-sn*Y), ty-s*(sn*X+c*Y)
res=lambda q: np.r_[model(q,lo,la)[0]-x, model(q,lo,la)[1]-y]
r=least_squares(res,[45,65,900,0,600,1500],loss='soft_l1',f_scale=6,bounds=([20,25,100,-1,-9000,-9000],[75,85,9000,1,9000,9000]),x_scale=[5,5,100,.05,100,100])
e=np.hypot(*res(r.x).reshape(2,-1)); print(np.round(r.x,3),'rmse',round(float(np.sqrt((e**2).mean())),1)); [print(p[4],round(float(ee),1)) for p,ee in zip(P,e)]
json.dump(list(map(float,r.x)),open('model1822.json','w'))
