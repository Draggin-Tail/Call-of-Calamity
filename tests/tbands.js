// Item bands, enemy gear odds and the gold curve (design/item_bands.md). Supersedes the band, shop-level, enemy-gear and pace checks in t82, tgold and tloot.
// GAME_DIR=<game folder> LD=./real_ld.js node tbands.js | grep -v ^PASS
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const LD=require(process.env.LD||'./real_ld.js');const W=LD();process.env.ARENA='1';const WA=LD();delete process.env.ARENA;
const C=W.GAME_CAMPAIGN,D=W.GAME_DATA,G=D.gear,T=D.gearTiers,LO=W.GAME_LOADOUT;
// ---- bands ----
ok('bands start at 1, 8, 15, 22, 29, 37, 45',T.bands.join()==='1,8,15,22,29,37,45');
ok('tierForLevel at every edge',[[1,1],[7,1],[8,2],[14,2],[15,3],[21,3],[22,4],[28,4],[29,5],[36,5],[37,6],[44,6],[45,7],[50,7]].every(([l,t])=>T.tierForLevel(l)===t));
ok('every band is 7 or 8 levels wide up to tier 7 (the cap is 50)',T.bands.slice(1).every((b,i)=>b-T.bands[i]>=7&&b-T.bands[i]<=8));
// ---- enemy gear ----
const spread=(lv,ld)=>{const c={};for(let i=0;i<20000;i++){const t=C.rollGearTier(lv,ld);c[t]=(c[t]||0)+1}return c};
const pc=(c,t)=>(c[t]||0)/20000;
ok('levels 1 to 7: every enemy is tier 1, leaders too',[1,4,7].every(l=>JSON.stringify(spread(l))==='{"1":20000}'&&JSON.stringify(spread(l,true))==='{"1":20000}'));
{const s=spread(10);ok('level 10 (band 2): 60% tier 1, 33% tier 2, 7% tier 3',Math.abs(pc(s,1)-0.6)<0.02&&Math.abs(pc(s,2)-0.33)<0.02&&Math.abs(pc(s,3)-0.07)<0.015);}
{const s=spread(30);ok('level 30 (band 5): tier 4, 5, 6 at 60/33/7',Math.abs(pc(s,4)-0.6)<0.02&&Math.abs(pc(s,5)-0.33)<0.02&&Math.abs(pc(s,6)-0.07)<0.015);}
{const s=spread(10,true);ok('leaders at level 10: tier 2 90%, tier 3 10%, never behind',!s[1]&&Math.abs(pc(s,2)-0.9)<0.02&&Math.abs(pc(s,3)-0.1)<0.015);}
ok('an enemy is one tier above its band 5 to 10% of the time (regulars 7%, leaders 10%)',C.GEAR_RULES.ahead>=0.05&&C.GEAR_RULES.ahead<=0.1&&C.GEAR_RULES.leader.ahead>=0.05&&C.GEAR_RULES.leader.ahead<=0.1);
{const s=spread(48);ok('at the top the tier is capped at 7 (level 48: 60% tier 6, 40% tier 7)',!s[8]&&Math.abs(pc(s,7)-0.4)<0.02);}
ok('a forced gearTier wins',C.rollGearTier(9,false,5)===5);
C.ENCOUNTERS.wander={name:'Ambush',map:'classic_ridge',rec:10,enemyFaction:'outlaws',enemies:[{primary:'squire',name:'Boss'},{primary:'squire'},{primary:'scout'},{primary:'archer',gearTier:6}],objective:{type:'leader',leader:0},wander:true,reward:{xp:10,gold:5}};
{let okT=true,lead=true,forced=true,same=true;for(let i=0;i<150;i++){delete C.ENCOUNTERS.wander._kits;const a=C.encounterBuilds('wander',null),b=C.encounterBuilds('wander',null);if(JSON.stringify(a.builds)!==JSON.stringify(b.builds))same=false;
  a.builds.forEach((x,j)=>{const ts=Object.values(x.gear).map(g=>T.tierOfItem(g));if(j===3){if(ts.some(t=>t>1&&t!==6&&G[Object.values(x.gear).find(g=>T.tierOfItem(g)===t)].slot!=='Accessory'))forced=false}else if(ts.some(t=>t>3))okT=false;if(j===0&&ts.some(t=>t<2))lead=false})}
  ok('level 10 fights: enemy gear is tier 1 to 3 (accessories by grade), kept between briefing and battle',okT&&same);ok('the leader never wears below the band; gearTier 6 is honoured',lead&&forced);}
// ---- shops ----
{const st=C.newGame({race:'human'});const shops=Object.keys(C.NODES).filter(n=>C.NODES[n].shop);const town=shops.find(n=>C.NODES[n].type==='town'),cap=shops.find(n=>C.NODES[n].type==='capital'),vil=shops.find(n=>!['town','market','capital','hall'].includes(C.NODES[n].type)),mkt=shops.find(n=>['market','hall'].includes(C.NODES[n].type));
  const tier=(n,lv,s)=>{st.roster.forEach(u=>u.level=lv);return C.shopTier(st,n,s)};
  ok('levels 1 to 7: every shop is tier 1 only',shops.every(n=>{st.roster.forEach(u=>u.level=7);st.world.location=n;const sv=C.nodeServices(st,n);return !sv.shop||sv.shop.stock.every(i=>T.tierOfItem(i)===1||G[i].slot==='Accessory'||G[i].token)}));
  ok('a village tops out at tier 2 from level 8 and a town at tier 3 from level 15',tier(vil,8)===2&&tier(vil,40)===2&&tier(town,14)===2&&tier(town,15)===3&&tier(town,50)===3);
  ok('a market or hall tops out at tier 4 from level 22; a capital follows the band',tier(mkt,21)===3&&tier(mkt,22)===4&&tier(mkt,50)===4&&tier(cap,29)===5&&tier(cap,37)===6&&tier(cap,45)===7);
  ok('Friendly or Allied standing adds one tier (a town at level 10 is tier 2, tier 3 when Friendly)',tier(town,10,'neutral')===2&&tier(town,10,'friendly')===3&&tier(town,10,'allied')===3&&tier(cap,50,'allied')===7);
  ok('Friendly standing opens tier 2 even in the first band (level 5)',tier(town,5,'friendly')===2&&tier(town,5,'neutral')===1); }
// ---- reward items ----
C.ENCOUNTERS.__t={name:'t',map:'classic_ridge',rec:10,enemyFaction:'outlaws',enemies:[{primary:'squire'}],reward:{xp:10,gold:5,items:{iron_sword:1,vigor_ring:1}}};
{const ri=C.encounterBuilds('__t',null).reward.items;ok('reward items take the band (level 10 = tier 2: a Steel Sword; accessories only grade at 1, 3, 5, 7)',ri.t2_iron_sword===1&&C.ENCOUNTERS.__t.reward.items.iron_sword===1);}
delete C.ENCOUNTERS.__t;
// ---- gold curve ----
const old=L=>12+5*L+4.5;
ok('curve hits its points',[[1,55],[4,71],[11,101],[18,140],[25,185],[33,235],[41,320],[50,360]].every(([l,g])=>Math.abs(C.goldFor(l)-g)<1e-9));
ok('curve is linear between points and flat after 50',Math.abs(C.goldFor(8)-(71+30*4/7))<1e-9&&C.goldFor(80)===360);
ok('multiplier is about 1.3 to 2.6 over levels 1 to 50 and 1 far above the cap',Array.from({length:50},(_,i)=>C.goldMult(i+1)).every(m=>m>=1.25&&m<=2.7)&&C.goldMult(300)===1);
{const cls=Object.keys(D.classes).filter(c=>D.classes[c].selectable!==false);const kit=t=>cls.reduce((s,c)=>{const g=LO.defaultGear(c,[]);let x=0;for(const sl in g)x+=(G[T.tierItem(g[sl],t)]||{}).price||0;return s+x},0)/cls.length;
  const mid=T.bands.slice(0,6).map((b,i)=>(b+T.bands[i+1]-1)/2);
  mid.forEach((L,i)=>{const net=3*(kit(i+2)-0.5*kit(i+1)),r=12*C.goldFor(L)/net;ok('band '+(i+1)+' (middle level '+L+'): 12 fights earn '+Math.round(r*100)+'% of the next tier (70% to 110%)',r>=0.7&&r<=1.1)}); }
// ---- arena stays at about the designed share of a fight ----
{const CA=WA.GAME_CAMPAIGN,st=CA.newGame({race:'human'});st.roster.forEach(u=>u.level=8);const mid={pit:3,sand:6,gold:9.5,gate:13};
  CA.arenaStatus(st).forEach(R=>{const L=mid[R.id],w=CA.goldFor(L),f=R.bouts[0].purse,c=R.bouts[2].purse;
    ok(R.id+': opening bout pays 90% to 250% of a wander fight ('+f+' vs '+Math.round(w)+')',f>=0.9*w&&f<=2.5*w);ok(R.id+': champion about 3x the opening bout ('+c+')',c>=2.4*f&&c<=3.6*f);ok(R.id+': gate fee under a quarter of the opening purse ('+R.fee+')',R.fee<=0.25*f)});
  const T2=CA.ARENA_TOURNEY;ok('Tourney prizes rise and the fee is under 0.6 of the first prize ('+T2.fee+' / '+T2.prizes+')',T2.prizes[0]<T2.prizes[1]&&T2.prizes[1]<T2.prizes[2]&&T2.fee<0.6*T2.prizes[0]); }
// ---- arena wager follows the curve ----
{const CA=WA.GAME_CAMPAIGN,st=CA.newGame({race:'human'});st.inventory.gold=1e6;const cap=lv=>{st.roster.forEach(u=>u.level=lv);return CA.arenaBetCap(st)};
  ok('wager cap is three wander fights at the party level, to 5 gold (level 1: '+cap(1)+', 10: '+cap(10)+', 50: '+cap(50)+')',[1,8,20,35,50].every(l=>Math.abs(cap(l)-3*CA.goldFor(l))<=2.5));
  ok('wager cap rises with level and is one quarter of the gold at most',cap(5)<cap(15)&&cap(15)<cap(40)&&(()=>{st.inventory.gold=100;st.roster.forEach(u=>u.level=20);return CA.arenaBetCap(st)===25})());
  const fs=require('fs'),path=require('path'),dir=process.env.GAME_DIR||path.join(__dirname,'..','game');
  ok('no wager code still uses a per-level number (arena.js and the shell use C.arenaBetMax)',!/45 \* Math\.round/.test(fs.readFileSync(path.join(dir,'data','arena.js'),'utf8'))&&!/20 \* Math\.round\(C\.arenaPartyLevel/.test(fs.readFileSync(path.join(dir,'shell.js'),'utf8'))); }
delete C.ENCOUNTERS.wander;ok('data still validates',C.validate().length===0&&C.validateQuests().length===0&&C.validateWork().length===0&&C.validateCast().length===0);
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
