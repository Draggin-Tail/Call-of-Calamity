// Node ownership phase 4c in the browser: the realm's plotters. The Factions tab names them in words; a found cell is a scene at its place,
// and rooting it out opens a road fight. Also the first core beat once sworn to the realm.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t94ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
const text=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\n+/g,' | '):''},sel);
const closeAll=()=>p.evaluate(()=>{for(const sel of ['#ss-sheet','#sh-sheet']){const x=document.querySelector(sel)&&[...document.querySelectorAll(sel+' button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()}});
await closeAll();await p.waitForTimeout(300);await closeAll();
// Archon Ilvane is crowned; the Crown's and the Banner's seats voted against her
const cellAt=await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;s.world.rbNext=1e9;
  C.applyRealm(s,'ilvane');for(let i=0;i<C.UNION.coronation;i++)S.advanceDay(s);C.union(s).seen=1;delete s.world.plot;C.union(s).plotters=['crown','broken_banner'];C.makePlot(s,{});
  const c=C.findCell(s,'crown_keep');GAME_SHELL.render();return c.at});
await closeAll();await p.waitForTimeout(300);await closeAll();
await p.evaluate(()=>[...document.querySelectorAll('#sh-col .sh-tabs button')].find(x=>/Factions/.test(x.innerText)).click());await p.waitForTimeout(400);
let t=await text('#sh-col');
ok('the realm card has a Plotters section in words',/Plotters/.test(t)&&/Old Oath loyalists are plotting/.test(t)&&/Cells found:/.test(t),t.slice(0,1200));
ok('no numbers in the plot lines',(()=>{const m=t.split('Plotters |')[1];return !!m&&!/\d/.test(m.split('| THE REALM')[0])})(),t.slice(0,1200));
// arrive at the cell's place: its scene opens
await p.evaluate(at=>{const s=GAME_SHELL.state();s.world.location=at;GAME_CAMPAIGN.checkMoves(s,at);GAME_STORY_SCREENS.tick()},cellAt);await p.waitForTimeout(800);
t=await text('#ss-sheet');
ok('the cell is a scene at its place',/keep a cell here/i.test(t)&&/Root them out/.test(t)&&/Not yet/.test(t),t.slice(0,500));
await p.evaluate(()=>[...document.querySelectorAll('#ss-sheet button')].find(x=>/Root them out/.test(x.innerText)).click());await p.waitForTimeout(800);
const wv=await p.evaluate(()=>{const w=GAME_SHELL.state().world.wander;return w&&w.enc&&w.enc.name});
ok('rooting them out sets up the fight',/A cell of the Old Oath loyalists/.test(wv||''),wv);
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
