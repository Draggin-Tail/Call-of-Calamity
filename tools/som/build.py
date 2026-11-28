# Builds Call of Calamity sprite sheets (4 cols x 20 rows, 64px frames) from Spell of Mastery character layers. Mockup only.
import os, sys, colorsys
from PIL import Image
L='/tmp/som_a/spell-of-mastery-sprites/character-layers/'
OUT=sys.argv[1]
FR=96; NF=64
BODY={'m':['dmh','dml','dmp','dmc','dma'],'f':['dfh','dfl','dfp','dfc','dfa'],'s':['dsh','dsl','dsp','dsc','dsa']}
# z-order slots (back to front)
Z=['toolB','offB','capeB','body','gloves','pants','feet','skirt','chest','belt','arms','cape','neck','beard','wig','head','hood','off','tool']
R={ # class: (sex, {slot: layer})
 'squire':('m',dict(chest='c2m',pants='p0',feet='f0',head='h5',off='o1',tool='t1',belt='b0')),
 'scout':('f',dict(chest='c1f',pants='p0',feet='f1',head='h6',tool='t12',wig='w1',belt='b1')),
 'acolyte':('f',dict(chest='c0f',skirt='s3',feet='f0',wig='w2',tool='t7',neck='n0')),
 'apprentice':('m',dict(chest='c4m',skirt='s3',feet='f0',cape='m1',hood='m1h',tool='t13',beard='j0')),
 'archer':('m',dict(chest='c1m',pants='p0',feet='f2',head='h6',tool='t12',belt='b0',cape='m2')),
 'rogue':('m',dict(chest='c3m',pants='s4',feet='f1',cape='m1',hood='m1h',tool='t0',belt='b1')),
 'warrior':('m',dict(chest='c2m',pants='p0',feet='f3',head='h3',off='o0',tool='t16',gloves='g0')),
 'wizard':('m',dict(chest='c4m',skirt='s3',feet='f0',head='h1',cape='m0',tool='t14',beard='j1')),
 'cleric':('f',dict(chest='c2f',skirt='s0',feet='f0',head='h2',off='o0',tool='t9',wig='w0')),
}
CLOTH={'chest','skirt','cape','capeB','hood','pants'}
def tint(im,team):
    # pull cloth towards the team colour: blue for allies, crimson for enemies (keeps light and shade)
    hue=0.61 if team=='ally' else 0.99
    px=im.load();w,h=im.size
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]
            if a==0: continue
            H,S,V=colorsys.rgb_to_hsv(r/255,g/255,b/255)
            if S<0.18: continue   # metal, white and black stay
            r2,g2,b2=colorsys.hsv_to_rgb(hue,min(1,S*1.05),V)
            px[x,y]=(int(r2*255),int(g2*255),int(b2*255),a)
    return im
def layer(name):
    p=L+name+'.png'
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
def compose(sex,parts,team):
    canvas=Image.new('RGBA',(FR*4,FR*6),(0,0,0,0))
    slots=dict(parts)
    for k in ('tool','off','cape'):
        if k in slots and os.path.exists(L+slots[k]+'b.png'): slots[k+'B' if k!='off' else 'offB']=slots[k]+'b'
    for z in Z:
        names=BODY[sex] if z=='body' else ([slots[z]] if z in slots else [])
        for n in names:
            im=layer(n)
            if im is None: continue
            if z in CLOTH: im=tint(im,team)
            canvas.alpha_composite(im)
    return canvas
def cell(sheet,c,r): return sheet.crop((c*FR,r*FR,(c+1)*FR,(r+1)*FR))
def frame(sheet,c,r,flip=False,dy=0):
    f=cell(sheet,c,r)
    if flip: f=f.transpose(Image.FLIP_LEFT_RIGHT)
    # 96 -> 64 crop, feet at y~60 (feet sit near y=88 in the source frame)
    out=Image.new('RGBA',(NF,NF),(0,0,0,0)); out.alpha_composite(f.crop((16,28+dy,80,92+dy)))
    return out
def build(cls,team):
    sex,parts=R[cls]; s=compose(sex,parts,team)
    S,N=0,3   # row offsets: south block, north block
    dirs=[(S,False),(S,False),(S,True),(N,False)]   # down, left, right, up
    anims={ # name: list of (col,row-in-block,dy)
      'idle':[(0,0,0),(0,0,-1),(0,0,-2),(0,0,-1)],
      'walk':[(0,1,0),(1,1,0),(2,1,0),(3,1,0)],
      'attack':[(0,2,0),(1,2,0),(2,2,0),(2,2,0)],
      'hit':[(1,0,0),(2,0,0),(2,0,0),(1,0,0)],
      'death':[(2,0,0),(3,0,0),(3,0,0),(3,0,0)]}
    out=Image.new('RGBA',(NF*4,NF*20),(0,0,0,0))
    for ai,a in enumerate(['idle','walk','attack','hit','death']):
        for di,(ro,fl) in enumerate(dirs):
            for fi,(c,r,dy) in enumerate(anims[a]):
                f=frame(s,c,ro+r,fl,dy)
                if f.getbbox() is None: f=frame(s,0,ro,fl)   # a missing pose falls back to idle
                out.alpha_composite(f,(fi*NF,(ai*4+di)*NF))
    os.makedirs(OUT+'/'+team,exist_ok=True); out.save(OUT+'/'+team+'/'+cls+'.png')
for cls in R:
    for team in ('ally','enemy'): build(cls,team)
print('ok',len(R))
