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
tone=np.clip(gn*1.05-0.05,0,1)*(1-sky)
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
# versão Granito e musgo: traço claro sobre fundo escuro, hachura em verde, curvas de nível
BG=np.array([0x14,0x16,0x14],np.float32)[::-1]; FG=np.array([0xEC,0xEE,0xE6],np.float32)[::-1]; AC=np.array([0x8F,0xB5,0x73],np.float32)[::-1]; GR=np.array([0x3D,0x43,0x3B],np.float32)[::-1]
hatn=cv2.remap(hat,xx+dx,yy+dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
lin=np.clip(ink-hatn*0.40-soft*0.8+cons*0.8,0,1)
canvas=np.tile(BG,(H,W,1)).astype(np.float32)
# curvas de nível
cl=np.zeros((H,W),np.float32)
for k in range(24):
    y0=20+k*52; a=26+(k*7%30)
    xs=np.linspace(-20,W+20,60)
    ys=y0+a*np.sin(xs/W*5.2+k*.7)*.5+a*.35*np.sin(xs/W*11+k)
    cv2.polylines(cl,[np.stack([xs,ys],1).astype(np.int32)],False,float(.16 if k%4 else .30),1,cv2.LINE_AA)
canvas=canvas+(GR-BG+ (np.array([0xA3,0xA8,0x95],np.float32)[::-1]-GR)*0.2)*cl[...,None]*0.9
# luz suave do verde atrás da torre
glow=cv2.GaussianBlur((1-sky).astype(np.float32),(0,0),90)
canvas=canvas+AC*glow[...,None]*0.07
# sombras e hachura em verde-musgo; contorno em branco-granito
shade=np.clip(hatn*0.75+soft*1.0,0,1)
canvas=canvas*(1-shade[...,None]*0.0)+( (GR*0.9+AC*0.35) - BG)*shade[...,None]*1.0
canvas=canvas+(AC-BG)*np.clip(hatn,0,1)[...,None]*0.30
canvas=canvas*(1-lin[...,None])+FG*lin[...,None]
grain=cv2.GaussianBlur(rng.normal(0,1,(H,W)).astype(np.float32),(0,0),1.1)*2.0
canvas=np.clip(canvas+grain[...,None],0,255).astype(np.uint8)
cv2.imwrite(out,cv2.resize(canvas,(1200,900),interpolation=cv2.INTER_AREA))
