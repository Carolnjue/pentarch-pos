import cv2, numpy as np
im = cv2.imread('symbol-shot.jpg')[:, :, ::-1].astype(int)  # RGB
cols = {'coral':(239,83,84),'plum':(147,70,88),'teal':(19,157,159),'deep':(34,91,100),'sun':(244,175,48),'white':(255,255,255)}
names=list(cols); arr=np.array([cols[n] for n in names])
d = ((im[:,:,None,:]-arr[None,None,:,:])**2).sum(-1)
lab = d.argmin(-1)
# crop to bbox of non-white
ys,xs=np.where(lab!=names.index('white')); x0,y0,x1,y1=xs.min(),ys.min(),xs.max(),ys.max()
print(x0,y0,x1,y1)
paths=[]
for n in ['coral','sun','teal','plum','deep']:
    m=(lab==names.index(n)).astype(np.uint8)*255
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    m=cv2.GaussianBlur(m,(5,5),0); _,m=cv2.threshold(m,127,255,0)
    cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c)<400: continue
        c=cv2.approxPolyDP(c,0.8,True)[:,0,:]
        pts=' '.join(f'{p[0]-x0:.0f},{p[1]-y0:.0f}' for p in c)
        hexc='#%02X%02X%02X'%cols[n]
        paths.append(f'<polygon fill="{hexc}" points="{pts}"/>')
W,H=x1-x0+1,y1-y0+1
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'+''.join(paths)+'</svg>'
open('pentarch-mark.svg','w').write(svg); print(len(svg), W, H)
