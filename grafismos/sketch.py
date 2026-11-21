import cv2, numpy as np, sys
src,out,crop=sys.argv[1],sys.argv[2],sys.argv[3]   # crop = x,y,w,h
x,y,w,h=map(int,crop.split(','))
img=cv2.imread(src)[y:y+h,x:x+w]; img=cv2.resize(img,(1600,1200),interpolation=cv2.INTER_CUBIC)
g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
g=cv2.bilateralFilter(g,5,25,5)
inv=255-g; bl=cv2.GaussianBlur(inv,(0,0),2.6)
dodge=cv2.divide(g,255-bl,scale=256).astype(np.float32)/255  # 1 = papel
line=1-dodge
# contraste do lápis
line=np.clip((line-0.05)/0.42,0,1)**1.1
# tons suaves de sombra (hachura leve)
sh=(1-cv2.GaussianBlur(g,(0,0),3).astype(np.float32)/255)
tone=np.clip((sh-0.35)/0.65,0,1)*0.22
ink=np.clip(line*0.95+tone,0,1)
bg=np.array([0x14,0x16,0x14],np.float32)[::-1]; fg=np.array([0xEC,0xEE,0xE6],np.float32)[::-1]; ac=np.array([0x8F,0xB5,0x73],np.float32)[::-1]
col=bg+(fg-bg)*ink[...,None]
# tinge de verde nas zonas médias (traço) mantendo brancos neutros
mid=(ink*(1-ink)*4)[...,None]
col=col*(1-0.35*mid)+ac*(0.35*mid)*ink[...,None]
cv2.imwrite(out,cv2.resize(np.clip(col,0,255).astype(np.uint8),(1200,900),interpolation=cv2.INTER_AREA))
