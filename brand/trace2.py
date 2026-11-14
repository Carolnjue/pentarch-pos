import cv2, numpy as np, cairosvg
im = cv2.imread('symbol-shot.jpg')[:, :, ::-1].astype(int)
cols = {'coral':(238,75,59),'plum':(147,70,88),'teal':(20,177,172),'deep':(34,91,100),'sun':(246,178,44),'white':(255,255,255)}
samp = {'coral':(239,83,84),'plum':(147,70,88),'teal':(19,157,159),'deep':(34,91,100),'sun':(244,175,48),'white':(255,255,255)}
names=list(samp); arr=np.array([samp[n] for n in names])
lab=((im[:,:,None,:]-arr[None,None,:,:])**2).sum(-1).argmin(-1)
M=lambda *ns: np.isin(lab,[names.index(n) for n in ns]).astype(np.uint8)*255
ys,xs=np.where(lab!=names.index('white')); x0,y0=xs.min(),ys.min(); W,H=xs.max()-x0+1,ys.max()-y0+1
def chaikin(p,it=2):
    for _ in range(it):
        q=[]
        for i in range(len(p)):
            a,b=p[i],p[(i+1)%len(p)]
            q+= [0.75*a+0.25*b, 0.25*a+0.75*b]
        p=np.array(q)
    return p
def shape(mask,fill,dil=0):
    if dil: mask=cv2.dilate(mask,np.ones((dil,dil),np.uint8))
    mask=cv2.GaussianBlur(mask,(9,9),0); _,mask=cv2.threshold(mask,127,255,0)
    cs,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    out=''
    for c in cs:
        if cv2.contourArea(c)<500: continue
        c=cv2.approxPolyDP(c,1.6,True)[:,0,:].astype(float)
        c=chaikin(c,2)
        d='M'+' L'.join(f'{x-x0:.1f},{y-y0:.1f}' for x,y in c)+'Z'
        out+=f'<path fill="{fill}" d="{d}"/>'
    return out
hx=lambda n:'#%02X%02X%02X'%cols[n]
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
svg+=shape(M('sun','plum','deep'),hx('sun'),3)+shape(M('coral','plum'),hx('coral'),3)+shape(M('teal','deep'),hx('teal'),3)
svg+=shape(M('plum'),hx('plum'),4)+shape(M('deep'),hx('deep'),4)+'</svg>'
open('pentarch-mark.svg','w').write(svg); print(len(svg))
cairosvg.svg2png(bytestring=svg.encode(), write_to='mark-test.png', output_width=400)
