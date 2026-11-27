// Node ownership phase 4d in the browser: the player's wars. At the capital as a rank 4 Crown officer, the Factions tab offers
// "Order an attack" (in words) and "Move against the Hearthwatch" (with a confirming sheet); an order goes out; after the Priory falls,
// a refuge's sheet offers the Hearthwatch's shelter, and a taken chapel no longer does.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t95ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
const text=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\n+/g,' | '):''},sel);
const closeAll=()=>p.evaluate(()=>{for(const sel of ['#ss-sheet','#sh-sheet']){const x=document.querySelector(sel)&&[...document.querySelectorAll(sel+' button')].find(x=>/Close|Continue|Not now/.test(x.innerText));if(x)x.click()}});
const tab=name=>p.evaluate(n=>[...document.querySelectorAll('#sh-col .sh-tabs button')].find(x=>x.innerText.includes(n)).click(),name);
const click=(sel,re)=>p.evaluate(([sel,re])=>{const x=[...document.querySelectorAll(sel+' button')].find(x=>new RegExp(re).test(x.innerText));if(x)x.click();return !!x},[sel,re]);
await closeAll();await p.waitForTimeout(300);await closeAll();
// a rank 4 Crown officer at Crown Keep, at war with the Banner
await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;s.world.rbNext=1e9;
  S.joinRank(s,'crown',{force:true,leave:true});while(S.getRank(s,'crown').rank<4)S.promote(s,'crown',{force:true});
  C.relState(s).wars['broken_banner|crown']={since:1,by:'crown'};S.setRelation(s,'crown','broken_banner',-0.9,{both:true});s.world.location='crown_keep';GAME_SHELL.render()});
await closeAll();await p.waitForTimeout(300);await closeAll();await tab('Factions');await p.waitForTimeout(400);
let t=await text('#sh-col');
ok('the Factions tab offers orders, in words',/Order an attack/.test(t)&&/held by the Broken Banner/.test(t)&&/(good|even|poor) odds/.test(t)&&/Order it/.test(t),t.slice(0,1500));
ok('no numbers in the orders',(()=>{const m=t.split('Order an attack')[1]||'';return !/\d/.test(m.split('Move against')[0])})());
ok('and the motion against the Hearthwatch',/Move against the Hearthwatch/.test(t)&&/Put it to the council/.test(t));
await click('#sh-col','^Order it$');await p.waitForTimeout(400);
const led=await p.evaluate(()=>GAME_CAMPAIGN.attacks(GAME_SHELL.state()).filter(a=>a.led).length);
t=await text('#sh-col');
ok('ordering sends an attack, and the card waits for it',led===1&&/Your last order is still under way/.test(t),t.slice(0,800));
await click('#sh-col','Put it to the council');await p.waitForTimeout(400);
t=await text('#sh-sheet');
ok('the motion asks first, and says what it costs in words',/lose all your goodwill/.test(t)&&/Broken Banner/.test(t)&&/Ask for war/.test(t)&&!/\d/.test(t),t.slice(0,800));
await click('#sh-sheet','Ask for war');await p.waitForTimeout(400);
const atWar=await p.evaluate(()=>GAME_CAMPAIGN.relAtWar(GAME_SHELL.state(),'crown','hearthwatch'));
ok('asking means war with the Hearthwatch',atWar);
// the Priory falls; a refuge shelters you, a taken chapel does not
await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();['millstream','drowned_chapel'].forEach(id=>{(s.world.nodes[id]=s.world.nodes[id]||{}).owner='crown'});
  const a={n:999,by:'crown',on:'hearthwatch',target:'hearthstone_priory',from:'crown_keep',day:s.world.day,lands:s.world.day,stage:3,stages:4,led:true};C.attackState(s).list.push(a);C.attackSettle(s,a,'attack');
  s.world.location='refuge_cask_cellar';GAME_SHELL.render()});
await closeAll();await p.waitForTimeout(300);
await tab('Map');await p.waitForTimeout(300);
const onMap=await p.evaluate(()=>!!document.querySelector('button.n[aria-label="The Cask Cellar"]'));
ok('the refuge is on the map',onMap);
await p.evaluate(()=>document.querySelector('button.n[aria-label="The Cask Cellar"]').click());await p.waitForTimeout(500);
t=await text('#sh-sheet');
ok('its sheet offers the Hearthwatch\'s shelter',/Hearthwatch refuge/.test(t)&&/Rest here/.test(t),t.slice(0,800));
await closeAll();await p.evaluate(()=>{const s=GAME_SHELL.state();s.world.location='millstream';GAME_CAMPAIGN.discover(s,'millstream');GAME_SHELL.render()});await p.waitForTimeout(300);
await p.evaluate(()=>{const x=document.querySelector('button.n[aria-label="Millstream"]');if(x)x.click()});await p.waitForTimeout(500);
t=await text('#sh-sheet');
ok('a taken chapel offers none',/Millstream/.test(t)&&!/Hearthwatch sanctuary/.test(t),'['+t.slice(0,600)+']');
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
