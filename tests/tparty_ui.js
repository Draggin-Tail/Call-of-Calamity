// Recruit sheets, the roster (dispatch, catch-up) and the briefing (enemy count, outnumbered warning) in the browser. Serve the game folder on 8766 first (node serve.js &), then: node tparty_ui.js
// Notes: "Begin" needs a forced click, and map markers are clicked through the DOM (a real click lands on the wrong spot of the transformed map). Switch tabs with nav('Map') / nav('Roster') before touching map markers.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
const txt=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return (e?e.innerText:'')+' '+document.querySelector('#sh-col').innerText}).then(x=>x.replace(/\n+/g,' | '));
const setup=(node,fac,v,lvl)=>p.evaluate(([node,fac,v,lvl])=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;s.world.location=node;C.discover(s,node);Object.keys(C.NODES[node].links||{}).forEach(i=>C.discover(s,i));s.factions.standing[fac]=v;s.inventory.gold=900;s.roster[0].level=lvl;GAME_SHELL.render();return true},[node,fac,v,lvl]);
const openNode=async name=>{await p.evaluate(n=>document.querySelector('button.n[aria-label="'+n+'"]').click(),name);await p.waitForTimeout(500)};
let ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
// Deepdelve at neutral standing: a dwarf recruit sheet
await setup('deepdelve','ironbound',0,5);await openNode('Deepdelve');let t=await txt();
ok('Deepdelve at neutral shows Recruit',/Recruit \(\d+ g\)/.test(t));
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/^Recruit \(/.test(x.innerText.trim())).click());await p.waitForTimeout(400);t=await txt();
ok('recruit sheet names dwarf recruits, level 1',/Dwarf recruits start at level 1/.test(t));
const before=await p.evaluate(()=>GAME_SHELL.state().roster.length);
await p.evaluate(()=>document.querySelector('#sh-sheet .card button').click());await p.waitForTimeout(500);
const after=await p.evaluate(()=>{const s=GAME_SHELL.state(),u=s.roster[s.roster.length-1];return [s.roster.length,u.race,u.level]});
ok('hiring adds a level 1 dwarf ('+after+')',after[0]===before+1&&after[1]==='dwarf'&&after[2]===1);
await p.evaluate(()=>document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close/.test(x.innerText))?.click());await p.waitForTimeout(200);
// hostile closes it
await setup('deepdelve','ironbound',-600,5);await openNode('Deepdelve');t=await txt();ok('Deepdelve hostile: no Recruit button',!/Recruit \(\d+ g\)/.test(t));
// Sylvan Watch: wood elf
await setup('sylvan_watch','canopy',0,5);await openNode('Sylvan Watch');t=await txt();ok('Sylvan Watch at neutral shows Recruit',/Recruit \(\d+ g\)/.test(t));
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/^Recruit \(/.test(x.innerText.trim())).click());await p.waitForTimeout(400);t=await txt();ok('...Wood Elf recruits',/Wood Elf recruits start at level 1/.test(t));
// roster screen party counter
const party=await p.evaluate(()=>{const s=GAME_SHELL.state();return GAME_SAVE.partySize(s)});ok('party size at level 5 is 3',party===3);
// ---- dispatch and the bench on the roster screen ----
await p.evaluate(()=>{const s=GAME_SHELL.state();s.roster[0].level=8;s.roster[0].xp=GAME_LOADOUT.xpForLevel(8);const r=GAME_SAVE.recruit(s,'squire',{race:'dwarf'});s.inventory.gold=900;GAME_SHELL.render()});
const nav=async n=>{await p.evaluate(n=>[...document.querySelectorAll('#sh-col button')].find(x=>x.innerText.trim()===n).click(),n);await p.waitForTimeout(400)};
await nav('Roster');let rt=await p.evaluate(()=>document.querySelector('#sh-col').innerText.replace(/\n+/g,' | '));
ok('roster shows away counter and Send out',/away 0\/3/.test(rt)&&/Send out/.test(rt));
ok('a level 1 recruit shows catching up',/Catching up: \+\d+% XP and JP/.test(rt));
await p.evaluate(()=>[...document.querySelectorAll('#sh-col button')].filter(x=>x.innerText.trim()==='Send out')[0].click());await p.waitForTimeout(400);
let sh=await p.evaluate(()=>document.querySelector('#sh-sheet').innerText.replace(/\n+/g,' | '));
ok('the send-out sheet lists patrol, escort and expedition',/Patrol · 3 days/.test(sh)&&/Escort · 6 days/.test(sh)&&/Expedition · 10 days/.test(sh));
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>x.innerText.trim()==='Send').click());await p.waitForTimeout(500);
rt=await p.evaluate(()=>document.querySelector('#sh-col').innerText.replace(/\n+/g,' | '));
ok('the unit is away, with a return day',/away 1\/3/.test(rt)&&/Patrol: back on day \d+/.test(rt));
await p.evaluate(()=>{const s=GAME_SHELL.state();s.world.day+=3});
const away=await p.evaluate(()=>GAME_SHELL.state().dispatch.out[0].unit);const xpOf=()=>p.evaluate(a=>GAME_SHELL.state().roster.find(u=>u.id===a).xp,away);const xp0=await xpOf();
await nav('Map');await nav('Roster');rt=await p.evaluate(()=>document.querySelector('#sh-col').innerText.replace(/\n+/g,' | '));
const xp1=await xpOf();
ok('opening the roster after the days brings them home and pays (xp '+xp0+' -> '+xp1+')',xp1>xp0&&/away 0\/3/.test(rt));
// ---- a level 12 party of 4 meets 4 enemies on a big map ----
await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();C.ENCOUNTERS.thornfield_camp.rec=12;const L=GAME_LOADOUT;s.roster.forEach(u=>{u.xp=L.xpForLevel(12);u.level=12});
  s.dispatch={out:[]};while(s.roster.length<5)GAME_SAVE.recruit(s,'squire',{race:'human'});s.inventory.gold=9000;s.party=s.roster.slice(0,4).map(u=>u.id);s.world.location='thornfield';C.discover(s,'thornfield');GAME_SHELL.render()});
await nav('Map');await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('button.n[aria-label="Thornfield"]').click());await p.waitForTimeout(500);
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Fight:/.test(x.innerText.trim())).click());await p.waitForTimeout(500);
sh=await p.evaluate(()=>document.querySelector('#sh-sheet').innerText.replace(/\n+/g,' | '));
const nEn=(sh.match(/Enemies: ([^|]*)/)||[])[1]||'';ok('the briefing lists 4 enemies ('+nEn.split(',').length+')',nEn.split(',').length===4);
ok('four against four: no outnumbered warning',!/outnumber/.test(sh)&&!/This ground holds/.test(sh));
await p.evaluate(()=>{const s=GAME_SHELL.state();s.party=s.roster.slice(0,3).map(u=>u.id)});
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close/.test(x.innerText))?.click());await p.waitForTimeout(300);await p.evaluate(()=>GAME_SHELL.render());await nav('Map');
await p.evaluate(()=>document.querySelector('button.n[aria-label="Thornfield"]').click());await p.waitForTimeout(400);
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Fight:/.test(x.innerText.trim())).click());await p.waitForTimeout(500);
sh=await p.evaluate(()=>document.querySelector('#sh-sheet').innerText.replace(/\n+/g,' | '));ok('with 3 against 4 the briefing warns',/They outnumber you: 4 against your 3/.test(sh));
await p.evaluate(()=>{const s=GAME_SHELL.state();s.party=s.roster.slice(0,4).map(u=>u.id)});
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Start battle/.test(x.innerText)).click());await p.waitForTimeout(2500);
const inB=await p.evaluate(()=>document.body.classList.contains('campaign')&&!!window.__campaignBattle);ok('the battle starts with no engine error',inB);
console.log('page errors:',errs.length?errs:'none');await b.close();})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
