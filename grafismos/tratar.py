import cv2, numpy as np, glob, os
A='/mnt/user-data/attachments/cbb8335e-1c96-5333-8c07-1059f2115f1f/fae52198-image.jpg'
os.makedirs('tratadas',exist_ok=True)
stops=np.array([(0x10,0x12,0x10),(0x1C,0x20,0x1B),(0x30,0x36,0x2C),(0x50,0x5C,0x45),(0x77,0x8C,0x63),(0x9C,0xB5,0x84),(0xCF,0xD8,0xC3),(0xEC,0xEE,0xE6)],np.float32)
xs=np.linspace(0,255,len(stops))
lut=np.stack([np.interp(np.arange(256),xs,stops[:,c]) for c in range(3)],1).astype(np.float32)  # RGB
def crop43(im,bias=.3):
    h,w=im.shape[:2]
    if w/h>4/3: cw=int(h*4/3); x=(w-cw)//2; return im[:,x:x+cw]
    ch=int(w*3/4); y=int((h-ch)*bias); return im[y:y+ch]
rng=np.random.default_rng(3)
W,H=1200,900
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
# curvas de nível suaves
cl=np.zeros((H,W),np.float32)
for k in range(22):
    y0=10+k*44;a=24+(k*7%28);xs_=np.linspace(-20,W+20,70)
    ys=y0+a*np.sin(xs_/W*5.2+k*.7)*.5+a*.35*np.sin(xs_/W*11+k)
    cv2.polylines(cl,[np.stack([xs_,ys],1).astype(np.int32)],False,float(.5 if k%4==0 else .26),1,cv2.LINE_AA)
cl=cv2.GaussianBlur(cl,(0,0),.6)
vig=np.clip(1-0.38*(((xx-W/2)/(W/2))**2*0.7+((yy-H/2)/(H/2))**2),0.5,1)
bot=np.clip((yy-H*0.62)/(H*0.38),0,1)**1.6*0.55
for f in sorted(glob.glob('../src/caminhos/*.jpg')):
    slug=os.path.basename(f)[:-4]
    im=cv2.imread(A if slug=='posto-de-vigia' else f)
    if slug=='posto-de-vigia':
        m=np.zeros(im.shape[:2],np.uint8); m[826:950,296:368]=255; im=cv2.inpaint(im,m,9,cv2.INPAINT_TELEA)[150:960]
    im=crop43(im); im=cv2.resize(im,(W,H),interpolation=cv2.INTER_LANCZOS4)
    sm=cv2.GaussianBlur(im,(0,0),1.2); im=cv2.addWeighted(im,1.5,sm,-0.5,0)
    g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
    g=cv2.createCLAHE(1.6,(6,6)).apply(g)
    lo,hi=np.percentile(g,[1,99.5]); g=np.clip((g.astype(np.float32)-lo)/(hi-lo),0,1)**1.05*255
    gi=np.clip(g,0,255).astype(np.uint8)
    rgb=lut[gi]                               # RGB float
    col=rgb[...,::-1]*0.88+im.astype(np.float32)*0.12*np.array([0.85,1.0,0.8],np.float32)  # resquício da cor original
    col=col*vig[...,None]
    col=col*(1-bot[...,None])+np.array([0x14,0x16,0x14],np.float32)[::-1]*bot[...,None]
    col=col+np.array([0xA3,0xA8,0x95],np.float32)[::-1]*cl[...,None]*0.10
    grain=cv2.GaussianBlur(rng.normal(0,1,(H,W)).astype(np.float32),(0,0),.9)*2.2
    cv2.imwrite(f'tratadas/{slug}.jpg',np.clip(col+grain[...,None],0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,90])
fs=sorted(glob.glob('tratadas/*.jpg'));tw,th=400,300;cols=4;rows=(len(fs)+cols-1)//cols
sheet=np.full((rows*th,cols*tw,3),20,np.uint8)
for i,f in enumerate(fs):
    im=cv2.resize(cv2.imread(f),(tw,th),interpolation=cv2.INTER_AREA);cv2.putText(im,os.path.basename(f)[:-4],(6,16),cv2.FONT_HERSHEY_SIMPLEX,.45,(200,220,190),1,cv2.LINE_AA)
    r,c=divmod(i,cols);sheet[r*th:(r+1)*th,c*tw:(c+1)*tw]=im
cv2.imwrite('contacto-tratadas.jpg',sheet)
