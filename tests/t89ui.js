// Node ownership phase 3b in the browser: the place sheet shows the garrison in words, and a cut-off place says so.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t89ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
const sheet=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return e?e.innerText.replace(/\n+/g,' | '):''});
const close=()=>p.evaluate(()=>{const x=document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()});
ok('the supply rules loaded in the page',await p.evaluate(()=>!!GAME_CAMPAIGN.SUPPLY&&GAME_CAMPAIGN.validateSupply().length===0));
await close();
await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.discover(s,'crown_keep');GAME_SHELL.nodeSheet('crown_keep')});await p.waitForTimeout(300);
let t=await sheet();ok('a capital shows a fortress garrison',/Garrison: fortress\./.test(t),t.slice(0,400));ok('...and no cut-off line when supplied',!/Cut off/.test(t));
await close();
await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state(),T='wayfarers_rest';C.discover(s,T);C.supplyNeighbours(T).forEach(y=>{(s.world.nodes[y]=s.world.nodes[y]||{}).owner='outlaws'});
  C.SUPPLY.defectChance=0;S.advanceDay(s,22);GAME_SHELL.render();GAME_SHELL.nodeSheet(T)});await p.waitForTimeout(300);
t=await sheet();ok('a place cut off for 22 days says so, with its capital',/Cut off from Crown Keep for 22 days/.test(t),t.slice(0,500));
ok('...its garrison is below strength, in words',/Garrison: held \(below strength\)/.test(t));
ok('...and it is dwindling',/garrison is dwindling/.test(t));
ok('...with no numbers for the garrison',!/Garrison: \d/.test(t));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
