// Node ownership phase 4b in the browser: the realm's policy dials. The Factions tab names them in words, and the Recruit sheet
// charges each class its own price (the faction's recruit lean and the realm's magic law).
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t93ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
const text=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\n+/g,' | '):''},sel);
const closeAll=()=>p.evaluate(()=>{for(const sel of ['#ss-sheet','#sh-sheet']){const x=document.querySelector(sel)&&[...document.querySelectorAll(sel+' button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()}});
await closeAll();await p.waitForTimeout(300);await closeAll();
// Archon Ilvane is crowned: the Ascendancy (medium taxes, watched roads, hedge-mages hunted, cautious)
await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;s.world.rbNext=1e9;
  C.applyRealm(s,'ilvane');for(let i=0;i<C.UNION.coronation;i++)S.advanceDay(s);s.world.flags.union_opening=1;s.inventory.gold=2000;GAME_SHELL.render()});
await closeAll();await p.waitForTimeout(300);await closeAll();
ok('the realm is one: the Ascendancy',await p.evaluate(()=>GAME_CAMPAIGN.union(GAME_SHELL.state()).flavour==='synod'));
await p.evaluate(()=>[...document.querySelectorAll('#sh-col .sh-tabs button')].find(x=>/Factions/.test(x.innerText)).click());await p.waitForTimeout(400);
let t=await text('#sh-col');
ok('the realm card names its dials in words',/Taxes are as they were/.test(t)&&/Its roads are watched/.test(t)&&/Hedge-mages are hunted/.test(t)&&/slow to war and slow to trust/.test(t),t.slice(0,900));
ok('no numbers in the dial lines',!/\d+ ?%|x ?\d|0\.\d/.test((t.match(/Taxes are[^|]*\|[^|]*\|[^|]*\|[^|]*/)||[''])[0]));
// the Recruit sheet at a realm place
const at=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();const id=Object.keys(C.NODES).find(id=>C.ownerOf(s,id)==='realm'&&(C.nodeServices(s,id)||{}).recruit);s.world.location=id;GAME_SHELL.render();return id});
ok('a realm place takes recruits',!!at);
await p.evaluate(id=>GAME_SHELL.nodeSheet(id),at);await p.waitForTimeout(400);
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Recruit \(/.test(x.innerText)).click());await p.waitForTimeout(400);
const prices=await p.evaluate(()=>{const out={};[...document.querySelectorAll('#sh-sheet .card')].forEach(c=>{const n=c.querySelector('b'),bt=c.querySelector('button');if(n&&bt)out[n.innerText]=parseInt(bt.innerText)});return out});
const base=await p.evaluate(()=>GAME_SAVE.recruitCost(GAME_SHELL.state()));
ok('apprentices cost a quarter more under the hunt',prices.Apprentice===Math.round(base*1.25),JSON.stringify(prices)+' base '+base);
ok('other classes at the plain price',Object.entries(prices).filter(([k])=>k!=='Apprentice').every(([,v])=>v===base),JSON.stringify(prices));
const g0=await p.evaluate(()=>GAME_SHELL.state().inventory.gold);
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet .card')].find(c=>/Apprentice/.test(c.innerText)).querySelector('button').click());await p.waitForTimeout(400);
const g1=await p.evaluate(()=>GAME_SHELL.state().inventory.gold);
ok('recruiting an apprentice charges the shown price',g0-g1===prices.Apprentice,g0+' -> '+g1);
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
