import sys, numpy as np
from PIL import Image
U='/mnt/user-data/uploads/'; OUT=sys.argv[1]
S=[('74aeafce',['voss','harrow','osric','corisande']),('8485b1c9',['ilvane','thorne','crane','agathe']),('3b680944',['old_standard','hask','wil','brielle']),
   ('8264c21f',['harte','teodor','marsh','vell']),('5a19ef5e',['rook','kit','nell','tobin']),('26758bdf',['aldo','aldric','corley','maren']),('f4aa05d6',['tobb','wen','dov','ysolde'])]
for f,names in S:
    a=np.asarray(Image.open(U+f+'-image.png').convert('RGB')).astype(np.int32); r,g,b=a[...,0],a[...,1],a[...,2]; m=np.minimum(r,b)
    bg=(m>g*1.8+30)&(np.abs(r-b)<70); ex=np.clip(m-(g+18),0,None)*0.9
    A=np.dstack([np.where(ex>0,r-ex,r),g,np.where(ex>0,b-ex,b),np.where(bg,0,255)]).clip(0,255).astype(np.uint8)
    H,W=A.shape[:2]
    for n,(x0,y0) in zip(names,[(0,0),(W//2,0),(0,H//2),(W//2,H//2)]):
        c=Image.fromarray(A[y0+6:y0+H//2-6,x0+6:x0+W//2-6]).resize((128,128),Image.LANCZOS); c.save(OUT+'/'+n+'.png')
print('ok')
