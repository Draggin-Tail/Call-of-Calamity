# Cut AI-generated sprites and portraits off magenta and build game sheets. Mockup.
import sys, os, json
import numpy as np
from PIL import Image
U='/mnt/user-data/uploads/'; OUT=sys.argv[1]
def key(path,purple=False):
    a=np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    r,g,b=a[...,0],a[...,1],a[...,2]; m=np.minimum(r,b)
    bg=((m>g*1.4+5)&(np.abs(r-b)<40)&(r>70)) if purple else ((m>g*1.8+30)&(np.abs(r-b)<70))
    ex=np.clip(m-(g+18),0,None)*(0.6 if purple else 0.9)
    r=np.where(ex>0,r-ex,r); b=np.where(ex>0,b-ex,b)
    al=np.where(bg,0,255)
    return np.dstack([r,g,b,al]).clip(0,255).astype(np.uint8)
def segs(v,gap,minw):
    out=[];s=None;run=0
    for i,x in enumerate(list(v)+[False]*(gap+1)):
        if x:
            if s is None:s=i
            run=0;e=i
        elif s is not None:
            run+=1
            if run>gap: out.append((s,e+1));s=None;run=0
    return [o for o in out if o[1]-o[0]>=minw]
def figures(path,purple=False):
    A=key(path,purple); mask=A[...,3]>0
    # remove specks
    rows=segs(mask.sum(1)>3,8,40); figs=[]
    for (y0,y1) in rows:
        cols=segs(mask[y0:y1].sum(0)>2,6,25)
        for (x0,x1) in cols:
            sub=mask[y0:y1,x0:x1]; ys=np.where(sub.any(1))[0]
            figs.append(A[y0+ys[0]:y0+ys[-1]+1,x0:x1])
    return figs
def figures_grid(path,purple,cols,rows):
    A=key(path,purple); H,W=A.shape[:2]; out=[]
    for r in range(rows):
        for c in range(cols):
            x0,x1,y0,y1=c*W//cols,(c+1)*W//cols,r*H//rows,(r+1)*H//rows
            sub=A[y0:y1,x0:x1]; m=sub[...,3]>0
            # drop specks: keep rows/cols with a few pixels
            ys=np.where(m.sum(1)>2)[0]; xs=np.where(m.sum(0)>2)[0]
            out.append(sub[ys[0]:ys[-1]+1,xs[0]:xs[-1]+1])
    return out
NF=64
def sheet(front,back,scale,team):
    def fit(arr):
        im=Image.fromarray(arr); w,h=im.size; s=scale
        return im.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    F=fit(front);B=fit(back)
    if team=='enemy': F,B=tint(F),tint(B)
    out=Image.new('RGBA',(NF*4,NF*20))
    def put(img,col,row,dx=0,dy=0,flip=False,rot=0):
        im=img.transpose(Image.FLIP_LEFT_RIGHT) if flip else img
        if rot: im=im.rotate(rot,expand=True,resample=Image.BICUBIC)
        x=col*NF+(NF-im.width)//2+dx; y=row*NF+(NF-4)-im.height+dy
        tile=Image.new('RGBA',(NF,NF)); tile.alpha_composite(im,(x-col*NF,y-row*NF)) if True else None
        out.alpha_composite(tile,(col*NF,row*NF))
    dirs=[(F,False),(F,False),(F,True),(B,False)]   # down, left, right, up
    for di,(im,fl) in enumerate(dirs):
        s=-1 if not fl else 1   # facing sign for forward shifts (front faces left)
        if im is B: s=1
        for f,dy in enumerate([0,-1,-2,-1]): put(im,f,0+di,0,dy,fl)
        for f,dy in enumerate([0,-2,0,-2]): put(im,f,4+di,0,dy,fl)
        for f,dx in enumerate([0,3,6,3]): put(im,f,8+di,s*dx,0,fl)
        for f,dx in enumerate([-3,-4,-2,0]): put(im,f,12+di,s*dx,0,fl)
        for f,rt in enumerate([0,30,70,90]): put(im,f,16+di,0,0,fl,rot=rt*(1 if fl else -1))
    return out
def tint(im):
    a=np.asarray(im).astype(np.float32); r,g,b,al=[a[...,i] for i in range(4)]
    mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
    blueish=(b>=r)&(b>=g-4)&(mx-mn<90)&(mx>40)&(al>0)
    v=mx; nr=np.where(blueish,v*1.0,r); ng=np.where(blueish,v*0.42,g); nb=np.where(blueish,v*0.40,b)
    return Image.fromarray(np.dstack([nr,ng,nb,al]).clip(0,255).astype(np.uint8))
T1=['squire','scout','acolyte','apprentice']
T2=['warrior','sentinel','bulwark','rogue','monk','berserker','archer','marksman','tracker','cleric','druid','shaman','wizard','necro','enchanter','bard']
info={}
T3=['shadowknight','shadowmage','warlord','assassin','songweaver','spellbow','paladin','blood_knight','warden','siegebreaker','zen_archer','ranger','beastlord','ascetic','inquisitor','stormcaller']
for src,names in [('c7c1563b-image.jpg',T1),('ec1f2a0b-image.jpg',T2),('30409ee9-image.jpg',T3)]:
    figs=figures_grid(U+src,True,8,4) if src.startswith('304') else figures(U+src); info[src]=len(figs)
    hs=sorted(f.shape[0] for f in figs); scale=54/hs[len(hs)//2]
    if len(figs)!=2*len(names): print('figure count',src,len(figs),[f.shape for f in figs]); continue
    for i,n in enumerate(names):
        for team in ('ally','enemy'):
            os.makedirs(OUT+'/sprites/gai/'+team,exist_ok=True)
            sheet(figs[2*i],figs[2*i+1],scale,team).save(OUT+'/sprites/gai/'+team+'/'+n+'.png')
# portraits: 2x2 sheets (1024) and the tier-1 6-up sheet
P=[('d10e5cb2-image.jpg',None),('66fd5f6b-image.jpg',['warrior','sentinel','bulwark','rogue']),('471ee388-image.jpg',['monk','berserker','archer','marksman']),
   ('8ee4cdd5-image.jpg',['tracker','cleric','druid','shaman']),('0eea419d-image.jpg',['wizard','necro','enchanter','bard']),
   ('1c2cbf25-image.jpg',['shadowknight','shadowmage','warlord','assassin']),('22d6f07c-image.jpg',['songweaver','spellbow','paladin','blood_knight']),
   ('1de81e61-image.jpg',['warden','siegebreaker','zen_archer','ranger']),('9f9fd74a-image.jpg',['beastlord','ascetic','inquisitor','stormcaller'])]
os.makedirs(OUT+'/portraits',exist_ok=True); PS=128
for src,names in P:
    A=key(U+src); H,W=A.shape[:2]
    if names is None:   # tier 1: 4 on top, 2 below (squire, -, scout, -, acolyte, apprentice)
        cw=W//4; cells=[(0,0,cw,H//2),(2*cw,0,3*cw,H//2),(W//2-cw,H//2,W//2,H),(W//2,H//2,W//2+cw,H)]; names=T1
    else: cells=[(0,0,W//2,H//2),(W//2,0,W,H//2),(0,H//2,W//2,H),(W//2,H//2,W,H)]
    for n,(x0,y0,x1,y1) in zip(names,cells):
        c=Image.fromarray(A[y0+4:y1-4,x0+4:x1-4]); s=min(c.size)
        c=c.crop(((c.width-s)//2,0,(c.width-s)//2+s,s)).resize((PS,PS),Image.LANCZOS)
        c.save(OUT+'/portraits/'+n+'.png')
print(info)
