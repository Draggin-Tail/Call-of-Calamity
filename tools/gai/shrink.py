# Post-process the cut GAI sheets: tint ally grey-blue cloth to a clearer blue, then quantize every sheet to 128 colours (with alpha) for phones.
import sys, glob
import numpy as np
from PIL import Image
D = sys.argv[1]  # game/sprites/gai
def blue(im):
    a = np.asarray(im).astype(np.float32); r, g, b, al = [a[..., i] for i in range(4)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    m = (b >= r) & (b >= g - 4) & (mx - mn < 90) & (mx > 40) & (al > 0)
    nr = np.where(m, mx * 0.55, r); ng = np.where(m, mx * 0.70, g); nb = np.where(m, mx * 1.05, b)
    return Image.fromarray(np.dstack([nr, ng, nb, al]).clip(0, 255).astype(np.uint8))
for f in sorted(glob.glob(D + '/*/*.png')):
    im = Image.open(f).convert('RGBA')
    if '/ally/' in f and '--no-tint' not in sys.argv: im = blue(im)
    im.quantize(128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f, optimize=True)
