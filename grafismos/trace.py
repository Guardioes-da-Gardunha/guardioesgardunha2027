import cv2, numpy as np
img=cv2.imread('../src/caminhos/alpedrinha-teatro.jpg'); h,w=img.shape[:2]
# crop 4:3 around building
cw=int(h*4/3); x0=30; img=img[:,x0:x0+cw]; h,w=img.shape[:2]
img=cv2.resize(img,(1600,1200),interpolation=cv2.INTER_CUBIC); H,W=img.shape[:2]; sx=W/w
poly=np.array([(0,0),(1280,0),(1280,372),(1232,342),(1175,322),(1150,330),(1137,300),(1130,262),(1122,300),(1108,326),(1098,345),(1070,300),(940,115),(920,62),(620,125),(520,135),(400,132),(330,148),(210,235),(95,280),(80,290),(0,325)],float)
poly[:,0]-=x0; poly=(poly*sx).astype(np.int32)
sky=np.zeros((H,W),np.uint8); cv2.fillPoly(sky,[poly],255)
sky=cv2.GaussianBlur(sky,(0,0),1.2)
g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
g=cv2.bilateralFilter(g,9,40,9); g=cv2.bilateralFilter(g,9,40,9)
g=cv2.GaussianBlur(g,(0,0),3.5)
m=sky<128
lo,hi=np.percentile(g[m],[3,99]); g=np.clip((g.astype(float)-lo)/(hi-lo)*255,0,255).astype(np.uint8)
# duotone ramp
ramp=np.array([(0x14,0x16,0x14),(0x1D,0x21,0x1C),(0x2C,0x33,0x28),(0x42,0x50,0x38),(0x5E,0x77,0x4A),(0x8F,0xB5,0x73),(0xC9,0xDB,0xB8),(0xEC,0xEE,0xE6)],float)[:,::-1]
q=np.clip((g.astype(float)/255*len(ramp)).astype(int),0,len(ramp)-1)
# bias darker
q=np.clip(((g.astype(float)/255)**1.0*len(ramp)).astype(int),0,len(ramp)-1)
out=ramp[q].astype(np.uint8)
# structural edges
e=cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(img,cv2.COLOR_BGR2GRAY),(0,0),3.2),22,55)
out[e>0]=(out[e>0]*0.2+np.array([0xC9,0xDB,0xB8])[::-1]*0.8).astype(np.uint8)
a=(255-sky)
rgba=np.dstack([out,a]); cv2.imwrite('base.png',rgba)
print(W,H)
