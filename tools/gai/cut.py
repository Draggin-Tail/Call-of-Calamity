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
def pose(im,fwd,lean=0,legs=0,sy=1.0,sx=1.0,rot=0,flash=None,dark=0):
    """Deform one figure: squash/stretch from the feet, lean the body (shear above the hips, + is forward),
    shear the legs (stride), tip over (rot degrees, backward), and tint (flash=(r,g,b,amount), dark=amount)."""
    w,h=im.size
    if sx!=1 or sy!=1: im=im.resize((max(1,round(w*sx)),max(1,round(h*sy))),Image.LANCZOS); w,h=im.size
    a=np.asarray(im).astype(np.float32); P=12
    out=np.zeros((h,w+2*P,4),np.float32)
    for r in range(h):
        t=(h-1-r)/max(1,h-1)   # 0 at the feet, 1 at the head
        sh=lean*max(0.0,(t-0.35)/0.65)+legs*max(0.0,(0.35-t)/0.35)
        sh*=fwd; i=int(np.floor(sh)); fr=sh-i
        row=a[r]; x0=P+i
        out[r,x0:x0+w]+=row*(1-fr); out[r,x0+1:x0+1+w]+=row*fr
    if flash:
        fr,fg,fb,k=flash; m=out[...,3]>0
        for c,v in enumerate((fr,fg,fb)): out[...,c]=np.where(m,out[...,c]*(1-k)+v*k*out[...,3]/255,out[...,c])
    if dark: out[...,:3]*=1-dark
    o=Image.fromarray(out.clip(0,255).astype(np.uint8)); bb=o.getbbox()
    if bb: o=o.crop((bb[0],0,bb[2],h))
    if rot: o=o.rotate(rot*fwd,expand=True,resample=Image.BICUBIC); bb=o.getbbox(); o=o.crop(bb) if bb else o
    return o
# per animation: 4 frames of (pose kwargs, dx forward, dy)
ANIMS=[
  [dict(sy=1.0),0,0],[dict(sy=.99,sx=1.005),0,0],[dict(sy=.978,sx=1.01),0,0],[dict(sy=.99,sx=1.005),0,0],                       # idle: breathing
  [dict(lean=2,legs=3,sy=.97,sx=1.02),0,0],[dict(lean=2,sy=1.0),0,-2],[dict(lean=2,legs=-3,sy=.97,sx=1.02),0,0],[dict(lean=2),0,-2],  # walk: stride, push off
  [dict(lean=-4,sy=1.03,sx=.98),-2,0],[dict(lean=5,legs=-2,sy=.95,sx=1.05),4,0],[dict(lean=7,legs=-3,sy=.93,sx=1.08),7,0],[dict(lean=2),2,0],  # attack: wind-up, lunge, strike, recover
  [dict(lean=-5,legs=1,flash=(255,255,255,.6)),-3,0],[dict(lean=-3,flash=(255,90,80,.3)),-3,0],[dict(lean=-1),-1,0],[dict(),0,0],          # hit: white flash, knocked back
  [dict(lean=-3,sy=.95,flash=(255,255,255,.4)),-1,0],[dict(lean=4,legs=-2,sy=.8,sx=1.06),0,0],[dict(rot=55,sy=.85,dark=.1),0,0],[dict(rot=88,dark=.25),0,0],  # death: hit, knees buckle, tip, lie
]
def sheet(front,back,scale,team):
    def fit(arr):
        im=Image.fromarray(arr); w,h=im.size; s=scale
        return im.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    F=fit(front);B=fit(back)
    F,B=(tint(F),tint(B)) if team=='enemy' else (blue(F),blue(B))
    out=Image.new('RGBA',(NF*4,NF*20))
    def put(img,col,row,dx=0,dy=0):
        x=(NF-img.width)//2+dx; y=(NF-4)-img.height+dy
        tile=Image.new('RGBA',(NF,NF)); tile.alpha_composite(img,(max(0,min(NF-img.width,x)),max(0,y)))
        out.alpha_composite(tile,(col*NF,row*NF))
    dirs=[(F,False),(F,False),(F,True),(B,False)]   # down, left, right, up; the front art faces left, the back art faces right
    for di,(im,fl) in enumerate(dirs):
        fwd=-1 if im is F else 1
        for k,(kw,dx,dy) in enumerate(ANIMS):
            p=pose(im,fwd,**kw); s=fwd
            if fl: p=p.transpose(Image.FLIP_LEFT_RIGHT); s=-s
            put(p,k%4,(k//4)*4+di,s*dx,dy)
    return out
def blue(im):   # allies: the grey-blue cloth turns a clearer blue
    a=np.asarray(im).astype(np.float32); r,g,b,al=[a[...,i] for i in range(4)]
    mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
    m=(b>=r)&(b>=g-4)&(mx-mn<90)&(mx>40)&(al>0)
    return Image.fromarray(np.dstack([np.where(m,mx*.55,r),np.where(m,mx*.70,g),np.where(m,mx*1.05,b),al]).clip(0,255).astype(np.uint8))
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
