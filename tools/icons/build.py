# Build game/icons.png from the Glionox 16x16 item pack (not in the repo: it may not be redistributed).
# One icon per base item type, tinted per tier by material (metal, wood, cloth), plus one icon per unique.
# Usage: python3 -I tools/icons/build.py <folder of itemN.png> <repo root>
# Writes game/icons.png (7 tier columns x rows of 16 px) and the ICON_SHEET map into game/item_icons.js.
import sys, json, colorsys, re
import numpy as np
from PIL import Image
SRC, ROOT = sys.argv[1], sys.argv[2]
# base id -> (pack icon, material); material None = no tier tint (the frame alone shows the tier)
BASE = {
 'iron_sword':(4,'metal'),'iron_mace':(134,'metal'),'steel_dagger':(799,'metal'),'hand_crossbow':(151,'metal'),'javelin':(120,'metal'),
 'wraps':(294,None),'knuckles':(1212,'metal'),'claws':(749,None),
 'wand_fire':(126,'wood'),'wand_cold':(129,'wood'),'wand_storm':(128,'wood'),'wand_arcane':(124,'wood'),'wand_holy':(906,'wood'),'wand_shadow':(885,'wood'),'wand_nature':(127,'wood'),
 'greatsword':(6,'metal'),'katana':(19,'metal'),'maul':(62,'metal'),'longbow':(147,'wood'),'crossbow':(150,'wood'),'halberd':(71,'metal'),'spear':(118,'metal'),'lute':(842,'wood'),
 'staff_fire':(133,'wood'),'staff_cold':(145,'wood'),'staff_storm':(135,'wood'),'staff_arcane':(132,'wood'),'staff_holy':(144,'wood'),'staff_shadow':(137,'wood'),'staff_nature':(883,'wood'),
 'buckler':(198,'metal'),'round_shield':(197,'metal'),'tower_shield':(199,'metal'),'spellbook':(648,'cloth'),'tome_focus':(652,'cloth'),'holy_relic':(825,'metal'),'warding_totem':(838,'wood'),
 'plate_helm':(297,'metal'),'plate_armor':(224,'metal'),'chain_coif':(202,'metal'),'chain_hauberk':(222,'metal'),'silk_hood':(879,'cloth'),'mystic_robe':(233,'cloth'),
 'swift_charm':(599,None),'traveler_boots':(261,None),'vigor_ring':(872,None),'mana_ring':(894,None),'siphon_band':(890,None),'focus_charm':(880,None),
 'sage_pendant':(871,None),'healer_locket':(868,None),'warding_amulet':(867,None),'ember_ward':(559,None),'frost_ward':(557,None),'storm_ward':(539,None),
}
UNIQUE = {
 'keep_badge':166,'runner_seal':169,'ward_seal':643,'muster_coin':514,'candle_token':697,'rat_kings_tooth':1185,'tollkeepers_cudgel':75,'wellwater_charm':595,
 'rimeheart':136,'bog_priests_censer':722,'cantors_lute':855,'dockside_arbalest':152,'cerecloth_of_applecourt':875,'bone_splitter':61,'oathbreaker':15,
 'crown_of_the_old_king':205,'the_master_batch':146,'right_of_the_pit':3,'hushbell':937,'the_first_ward':654,'bannerets_rampart':200,'stewards_seal':642,
 'widows_needle':830,'ledger_hood':878,'inquisitors_rod':141,'robe_of_the_quiet_hour':877,'pike_of_the_old_line':117,'the_red_standard':750,
 'hearthwardens_lamp':716,'keep_wardens_plate':238,'gildhaven_key':691,'voldun_canon':886,'outlaws_bell':614,'priory_hearthstone':591,'marshals_edge':5,
 'cranes_tally':870,'ilvanes_circlet':892,'old_standards_horn':748,'the_last_word':896,'wayfinders_compass':766,'wolfmothers_fang':1187,'fen_kings_hood':211,
 'thornmail':230,'emberwick':720,'runefall_totem':586,
 # arena uniques (data/arena_uniques.js)
 'pitfighters_wraps':293,'dust_devil':9,'crowds_favourite':237,'the_last_bell':148,'laurel_of_the_sandring':210,'ledger_of_bouts':653,'gamblers_die':791,
}
# [dark, mid, light] per tier 1..7 (metal follows the old placeholder ramps: Iron grey ... Starforged violet)
METAL = [['#5d5f65','#8d8f96','#c4c6cc'],['#556373','#8a9db0','#cfdeeb'],['#6f7d8b','#b2c1cf','#f0f6fc'],['#4f7f8f','#86c4d4','#d8f6ff'],['#2f6e62','#5fb3a0','#bff0e0'],['#7a2f2a','#c4574a','#ffb7a0'],['#4f3a80','#9479d0','#eee0ff']]
WOOD  = [['#6b4a2b','#a8794a','#dcb47c'],['#5a3a20','#8b5a2f','#bf8a52'],['#6a2f1f','#a24d2c','#d47a4a'],['#3e3a38','#6e6560','#a49c94'],['#1e1a22','#3c3444','#6e6280'],['#5a1616','#9a2a22','#d4604e'],['#2e4a1e','#5b8a32','#b0d868']]
CLOTH = [['#5c4a32','#a08560','#d2b890'],['#3a4f6e','#5f7fae','#a4c0e8'],['#3d6fb0','#6fa3e6','#c0dcff'],['#38667a','#69b6cf','#c0ecf8'],['#2c5a4a','#57a88c','#a8e8cc'],['#6e2a3a','#b8506a','#f0a0b4'],['#3e2c6e','#8466d0','#d0c0ff']]
hx = lambda s: np.array([int(s[i:i+2],16) for i in (1,3,5)],np.float32)
def ramp(rp, l):   # l in 0..1 -> colour along dark, mid, light
    d,m,li = map(hx, rp); l = l[...,None]
    return np.where(l < .5, d + (m-d)*(l/.5), m + (li-m)*((l-.5)/.5))
def hsv(a):
    r,g,b = [a[...,i]/255 for i in range(3)]; mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b); d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h, np.where(mx>0,d/(mx+1e-6),0), mx
def tint(im, mat, t):
    a = np.asarray(im.convert('RGBA')).astype(np.float32); h,s,v = hsv(a); al = a[...,3] > 0
    lum = (a[...,0]*.3+a[...,1]*.59+a[...,2]*.11)/255
    if mat == 'metal': m = al & (s < .28) & (v > .22); rp = METAL[t-1]
    elif mat == 'wood': m = al & (h > 8) & (h < 48) & (s > .25) & (v > .18) & (v < .92); rp = WOOD[t-1]
    else:   # cloth: the main saturated hue of the icon
        hs = h[al & (s > .3) & (v > .25)]
        if not len(hs): return im
        dom = np.bincount((hs//30).astype(int) % 12, minlength=12).argmax()*30+15
        m = al & (s > .25) & (v > .2) & (np.minimum(abs(h-dom), 360-abs(h-dom)) < 40); rp = CLOTH[t-1]
    if not m.any(): return im
    lo, hi = lum[m].min(), lum[m].max(); n = (lum - lo)/max(.05, hi-lo)
    out = a.copy(); out[...,:3] = np.where(m[...,None], ramp(rp, n.clip(0,1)*.9+.05), a[...,:3])
    return Image.fromarray(out.clip(0,255).astype(np.uint8))
src = lambda n: Image.open(f'{SRC}/item{n}.png').convert('RGBA')
rows, IDX = [], {}
for k,(n,mat) in BASE.items():
    IDX[k] = [len(rows), 1 if mat else 0]; rows.append([tint(src(n),mat,t) if mat else src(n) for t in range(1,8)])
for k,n in UNIQUE.items():
    IDX[k] = [len(rows), 0]; rows.append([src(n)]+[None]*6)
sheet = Image.new('RGBA',(16*7,16*len(rows)))
for r,row in enumerate(rows):
    for c,im in enumerate(row):
        if im is not None: sheet.alpha_composite(im,(c*16,r*16))
sheet.save(f'{ROOT}/game/icons.png', optimize=True)
p = f'{ROOT}/game/item_icons.js'; js = open(p).read()
line = '  const ICON_SHEET = ' + json.dumps(IDX, separators=(',',':')) + ';   // generated by tools/icons/build.py: id -> [row, tinted per tier]'
js = re.sub(r'  const ICON_SHEET = .*\n', line.replace('\\','\\\\')+'\n', js) if 'const ICON_SHEET' in js else js
open(p,'w').write(js)
print(len(rows), 'rows;', 'ICON_SHEET' in js)
