// Node ownership phase 3c in the browser: a place under attack pulses on the map, its sheet warns from afar, and at the place you can step in for either side.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t90ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
const sheet=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return e?e.innerText.replace(/\n+/g,' | '):''});
const close=()=>p.evaluate(()=>{const x=document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()});
ok('the attack rules loaded in the page',await p.evaluate(()=>!!GAME_CAMPAIGN.ATTACK&&GAME_CAMPAIGN.validateAttacks().length===0));
await close();
// a war, and the Crown's first attack: on the Lowmeadows, from Wayfarer's Rest
const T=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;C.relState(s).wars['broken_banner|crown']={since:s.world.day,by:'crown'};
  C.attackTick(s);const a=C.attacks(s).find(x=>x.by==='crown');C.discover(s,a.target);C.discover(s,a.from);GAME_SHELL.render();return a.target});
const tabs=await p.$$('#sh-col button');for(const x of tabs){if((await x.innerText()).trim()==='Map'){await x.click();break}}await p.waitForTimeout(300);
const name=await p.evaluate(T=>GAME_CAMPAIGN.NODES[T].name,T);
ok('the threatened place pulses on the map',await p.evaluate(n=>{const e=document.querySelector('button.n[aria-label="'+n+'"]');return !!e&&e.classList.contains('contested')&&/--atk/.test(e.getAttribute('style'))},name));
await p.evaluate(T=>GAME_SHELL.nodeSheet(T),T);await p.waitForTimeout(300);
let t=await sheet();ok('from afar the sheet warns who is coming, and when',/Under threat/.test(t)&&/Royalist Crown is massing at/.test(t)&&/within 7 days/.test(t),t.slice(0,500));
ok('...and says to be there to have a say',/Be here before then/.test(t)&&!/Step in/.test(t));
await close();
await p.evaluate(T=>{const s=GAME_SHELL.state();s.world.location=T;GAME_SHELL.render();GAME_SHELL.nodeSheet(T)},T);await p.waitForTimeout(300);
t=await sheet();ok('at the place you can step in',/Step in/.test(t),t.slice(0,500));
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>x.innerText==='Step in').click());await p.waitForTimeout(300);
t=await sheet();ok('the briefing offers both sides',/Help hold .* for the Broken Banner/.test(t)&&/Join the Royalist Crown's attack on/.test(t),t.slice(0,600));
ok('...with the standing at stake',/Royalist Crown \+10/.test(t)&&/Broken Banner -10/.test(t));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
