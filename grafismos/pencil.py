import cv2, numpy as np, sys
rng=np.random.default_rng(7)
src,out,crop=sys.argv[1],sys.argv[2],sys.argv[3]
inp=sys.argv[4] if len(sys.argv)>4 else ''   # x0,y0,x1,y1 a apagar (coords da foto)
x,y,w,h=map(int,crop.split(','))
im=cv2.imread(src)
if inp:
    a,b,c,d=map(int,inp.split(','));m=np.zeros(im.shape[:2],np.uint8);m[b:d,a:c]=255
    im=cv2.inpaint(im,m,9,cv2.INPAINT_TELEA)
im=im[y:y+h,x:x+w]; im=cv2.resize(im,(1600,1200),interpolation=cv2.INTER_CUBIC); H,W=im.shape[:2]
b_,g_,r_=[im[...,i].astype(np.float32) for i in range(3)]
sky=((b_>r_+28)&(b_>g_+8)).astype(np.uint8)*255
sky=cv2.morphologyEx(sky,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)); sky=cv2.GaussianBlur(sky,(0,0),2)/255.
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY); g=cv2.bilateralFilter(g,7,30,7)
gf=g.astype(np.float32)/255
# normaliza tons (fora do céu)
v=gf[sky<.5]; lo,hi=np.percentile(v,[2,98]); gn=np.clip((gf-lo)/(hi-lo),0,1)
tone=(1-gn)*(1-sky)
# linhas de lápis (dodge)
inv=255-g; bl=cv2.GaussianBlur(inv,(0,0),3.2)
dodge=cv2.divide(g,255-bl,scale=256).astype(np.float32)/255
line=np.clip((1-dodge-0.03)/0.45,0,1)*(1-sky*0.98)
# hachura direcional
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def hatch(ang,period,thr,gain):
    t=np.deg2rad(ang);u=xx*np.cos(t)+yy*np.sin(t)
    pat=0.5+0.5*np.sin(2*np.pi*u/period+ cv2.resize(rng.normal(0,1,(H//40+2,W//40+2)).astype(np.float32),(W,H))*1.2)
    gate=cv2.resize(rng.random((H//18+2,W//18+2)).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC)
    s=np.clip((pat-(1-np.clip((tone-thr)*gain,0,1)))*7,0,1)
    return s*np.clip(gate*1.6,0,1)
h1=hatch(52,9,.38,1.5); h2=hatch(-38,10,.6,1.7); h3=hatch(8,8,.8,2.0)
hat=np.clip(h1*0.55+h2*0.5+h3*0.55,0,1)*(1-sky)
# sombra suave
soft=cv2.GaussianBlur(tone,(0,0),5)*0.55
ink=np.clip(line*0.85+hat*0.40+soft,0,1)
# tremor de mão
dx=cv2.resize(rng.normal(0,1,(H//60+2,W//60+2)).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC)*2.2
dy=cv2.resize(rng.normal(0,1,(H//60+2,W//60+2)).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC)*2.2
ink=cv2.remap(ink,xx+dx,yy+dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
# linhas de construção soltas
canny=cv2.Canny(g,60,140)
ls=cv2.HoughLinesP(canny,1,np.pi/360,threshold=120,minLineLength=140,maxLineGap=10)
cons=np.zeros((H,W),np.float32)
if ls is not None:
    for l in ls[:70]:
        l=l.reshape(-1)
        x1,y1,x2,y2=l.astype(float);d=np.array([x2-x1,y2-y1]);n=np.linalg.norm(d)
        if n<1:continue
        d/=n;e=rng.uniform(.10,.35)*n
        p1=(int(x1-d[0]*e),int(y1-d[1]*e));p2=(int(x2+d[0]*e),int(y2+d[1]*e))
        cv2.line(cons,p1,p2,float(rng.uniform(.18,.40)),1,cv2.LINE_AA)
cons=cv2.GaussianBlur(cons,(0,0),.7)
ink=np.clip(ink+cons*0.8,0,1)
# papel
paper=np.array([228,231,226],np.float32)[::-1]  # BGR: #E2E7E4 ligeiramente esverdeado
grain=cv2.GaussianBlur(rng.normal(0,1,(H,W)).astype(np.float32),(0,0),1.1)*3.2
vig=1-0.10*(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2)
pap=(paper[None,None,:]+grain[...,None])*vig[...,None]
graph=np.array([42,44,40],np.float32)[::-1]
col=pap*(1-ink[...,None])+graph*ink[...,None]
col=np.clip(col,0,255).astype(np.uint8)
col=cv2.resize(col,(1200,900),interpolation=cv2.INTER_AREA)
# rota pontilhada em verde (marca da app)
pts=np.array([[40,868],[330,862],[620,874],[900,862],[1160,846]],np.float32)
for t in np.linspace(0,1,120):
    px=np.interp(t*1120+40,pts[:,0],pts[:,1]);cv2.circle(col,(int(40+t*1120),int(px)),3,(0x45,0x7A,0x5A)[::-1] if False else (0x45,0x78,0x4F),-1,cv2.LINE_AA)
cv2.circle(col,(40,868),9,(0x45,0x78,0x4F),2,cv2.LINE_AA)
cv2.imwrite(out,col)
