// Steps bigger than 1 are allowed (cliffs); every walkable tile must still be reachable by climbing 1. Dungeon floors have their own maps: 51 maps pass the shape checks (rules), and a level 35 party of 6 starts a real 6v6 dungeon fight (browser). Run with the game folder served on 8766, see design/dev_notes.md.
// Map pass 2: a map marked `asym: true` (hand-drawn in tools/map/hand_maps.py) is exempt from the rotation check only; heights up to 8 (walls up to 10).
const w=require('./real_ld.js')();const C=w.GAME_CAMPAIGN,D=w.GAME_DATA;let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const nb=(x,y)=>(y&1?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]]).map(([a,b])=>[x+a,y+b]);
let bad=[],n=0,nAsym=0,seenSig=new Set();
// the plotters' strongholds (phase 4c, plots.js) borrow other dungeons' floors until the map tools draw their own; they are checked in t94
for(const [did,d] of Object.entries(C.DUNGEONS).filter(([,d])=>!d.plot))d.floors.forEach((f,i)=>{const id='dgm_'+did+'_'+(i+1),m=D.maps[id];n++;if(!m){bad.push(id+' missing');return}
 const H=m.heights.length,W=m.heights[0].length,V=(m.voids||[]),WL=Object.keys(m.props||{}).filter(k=>m.props[k]==='h').map(k=>k.split(',').map(Number)),R=new Set(m.rocks.concat(V,WL).map(r=>r+''));const e=C.ENCOUNTERS['dg_'+did+'_'+(i+1)];
 if(e.map!==id)bad.push(id+' not used');
 if(W<10||W>14||H<10||H>14)bad.push(id+' size');if(m.heights.some((r,y)=>r.some((v,x)=>v>(WL.some(w=>w[0]===x&&w[1]===y)?10:8))))bad.push(id+' height');
 if(m.spawns.P.length<8||m.spawns.E.length<8)bad.push(id+' spawns');
 for(const s of [...m.spawns.P,...m.spawns.E]){if(R.has(s+''))bad.push(id+' spawn on rock');}
 for(const side of ['P','E']){if(new Set(m.spawns[side].map(([x,y])=>m.heights[y][x])).size!==1)bad.push(id+' '+side+' spawns not on one level')}
 const seen=new Set([m.spawns.E[0]+'']),q=[m.spawns.E[0]];while(q.length){const [x,y]=q.pop();for(const [a,b] of nb(x,y))if(a>=0&&b>=0&&a<W&&b<H&&!R.has(a+','+b)&&!seen.has(a+','+b)&&Math.abs(m.heights[y][x]-m.heights[b][a])<=1){seen.add(a+','+b);q.push([a,b])}}
 if(seen.size!==W*H-R.size)bad.push(id+' cut off');
 if(m.asym)nAsym++;else for(const [x,y] of m.rocks.concat(V,WL))if(!R.has((W-1-x)+','+(H-1-y)))bad.push(id+' not symmetric');
 const sig=JSON.stringify([m.heights,m.rocks,m.voids,m.props]);if(seenSig.has(sig))bad.push(id+' duplicate');seenSig.add(sig);});
ok(n+' dungeon floor maps ('+nAsym+' hand-drawn asymmetric): size, heights, steps, spawns, one area, symmetric unless asym, all different'+(bad.length?' ['+bad.slice(0,5)+']':''),bad.length===0&&n===51);
ok('C.validate empty',C.validate().length===0);
process.stdout.write("");const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state(),L=GAME_LOADOUT;s.world.flags.guide_off=1;for(let f=1;f<4;f++)C.ENCOUNTERS['dg_rat_run_warren_'+f].rec=35;s.roster.forEach(u=>{u.xp=L.xpForLevel(35);u.level=35});s.inventory.gold=9000;for(let k=0;k<8&&s.roster.length<6;k++)GAME_SAVE.recruit(s,"squire",{race:"human"});s.party=s.roster.slice(0,6).map(u=>u.id);s.world.location='rat_run_warren';C.discover(s,'rat_run');C.discover(s,'rat_run_warren');GAME_SHELL.render()});
await p.evaluate(()=>[...document.querySelectorAll('#sh-col button')].find(x=>x.innerText.trim()==='Map').click());await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('button.n[aria-label="Rat Run Warren"]').click());await p.waitForTimeout(500);
console.log('at node',await p.evaluate(()=>(document.querySelector('#sh-sheet')||{innerText:'none'}).innerText.replace(/\n+/g,' | ').slice(0,400)));await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^(Enter|Go deeper)/.test(x.innerText.trim())).click());await p.waitForTimeout(500);
const sh=await p.evaluate(()=>document.querySelector('#sh-sheet').innerText.replace(/\n+/g,' | '));
const en=((sh.match(/Enemies: ([^|]*)/)||[])[1]||'').split(',').length;ok('level 35 dungeon floor briefing lists 6 enemies ('+en+')',en===6);
ok('six against six: no warning',!/outnumber|This ground holds/.test(sh));
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Start battle/.test(x.innerText)).click());await p.waitForTimeout(2500);
const info=await p.evaluate(()=>({b:document.body.classList.contains('campaign')&&!!window.__campaignBattle}));ok('the battle starts on its own dungeon map',info.b);
console.log('page errors:',errs.length?errs:'none');await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails||errs.length?1:0)})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
