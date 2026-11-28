import sys
from PIL import Image
src=Image.open(sys.argv[1]).convert('RGBA'); OUT=sys.argv[2]
NF=64; CW,CH=87,98
def cell(c,r,flip=False):
    x0=c*CW+15-32; y0=r*CH+72-60   # body centre ~15px in, feet ~72px down
    f=Image.new('RGBA',(NF,NF)); f.alpha_composite(src.crop((max(0,x0),y0,x0+NF,y0+NF)),(max(0,-x0),0))
    return f.transpose(Image.FLIP_LEFT_RIGHT) if flip else f
def blk(cols_s,col_n,rows):
    pass
anims={'idle':[(0,0),(0,1),(0,0),(0,1)],'walk':[(2,0),(2,1),(2,2),(2,3)],'attack':[(4,0),(4,1),(4,2),(4,3)],
       'hit':[(6,1),(6,0),(6,0),(6,1)],'death':[(6,1),(6,2),(6,3),(6,3)]}
north={0:1,2:3,4:5}
out=Image.new('RGBA',(NF*4,NF*20))
for ai,a in enumerate(['idle','walk','attack','hit','death']):
    for di,(n,fl) in enumerate([(0,False),(0,False),(0,True),(1,False)]):
        for fi,(c,r) in enumerate(anims[a]):
            cc=north.get(c,c) if n else c
            out.alpha_composite(cell(cc,r,fl),(fi*NF,(ai*4+di)*NF))
out.save(OUT)
