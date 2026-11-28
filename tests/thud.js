// The full-screen battle HUD in portrait and landscape: no page scrolling, the command menu fits on screen, the board zooms, pans and rotates,
// a skill list replaces the commands, and the ⋯ menu holds FX, Log and Retreat. Serve the game folder on 8766 first (node serve.js &), then:
// NODE_PATH=$(npm root -g) node thud.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
async function run(b,w,h,tag){
  const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
  await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
  const clickT=async(sel,t)=>{await p.evaluate(([sel,t])=>{const x=[...document.querySelectorAll(sel)].find(x=>x.innerText.trim()===t&&x.offsetParent);x&&x.click()},[sel,t]);await p.waitForTimeout(400)};
  await clickT('#sh-sheet button','Close');await clickT('#ss-sheet button','Onward');
  await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;s.world.location='thornfield';C.discover(s,'thornfield');GAME_SHELL.render()});
  await clickT('#sh-col button','Map');
  await p.evaluate(()=>document.querySelector('button.n[aria-label="Thornfield"]').click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Fight:/.test(x.innerText.trim())).click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Start battle/.test(x.innerText)).click());await p.waitForTimeout(2500);
  const inView=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(!e||!e.offsetParent)return false;const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1},sel);
  ok(tag+': placement shows Begin battle on screen',await p.evaluate(()=>{const x=[...document.querySelectorAll('#acts button')].find(x=>/Begin battle/.test(x.innerText));if(!x)return false;const r=x.getBoundingClientRect();return r.bottom<=innerHeight+1}));
  await clickT('#acts button','Begin battle');
  for(let i=0;i<20;i++){if(await p.evaluate(()=>!!document.querySelector('#acts button.cmd')))break;await p.waitForTimeout(1000)}
  ok(tag+': the page itself never scrolls',await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));
  ok(tag+': the command panel is fully on screen',await inView('#info'));
  ok(tag+': the active unit card is on screen',await inView('#cards .uc.now'));
  ok(tag+': the turn order shows portraits',await p.evaluate(()=>document.querySelectorAll('#bar .chip img').length>=4));
  const z0=await p.evaluate(()=>ZEFF);await p.evaluate(()=>zoomBy(1.5));await p.waitForTimeout(300);
  const zz=await p.evaluate(()=>{const bw=document.getElementById('bw');bw.scrollTo(60,40);return {z:ZEFF,sw:bw.scrollWidth,cw:bw.clientWidth,sl:bw.scrollLeft,st:bw.scrollTop}});
  ok(tag+': zoom in makes the board bigger ('+z0.toFixed(2)+' -> '+zz.z.toFixed(2)+')',zz.z>z0);
  ok(tag+': a zoomed board can be panned',zz.sw>zz.cw&&zz.sl>0);
  const t0=await p.evaluate(()=>VIEW.t);await p.evaluate(()=>document.querySelector('.zm .rot.r').click());await p.waitForTimeout(300);
  ok(tag+': the rotate button turns the view',await p.evaluate(t=>VIEW.t===t+60,t0));
  await p.evaluate(()=>document.querySelector('#acts button.cmd').click());await p.waitForTimeout(300);
  ok(tag+': a skill list replaces the commands, with a back row',await p.evaluate(()=>!!document.querySelector('#acts button.back')&&![...document.querySelectorAll('#acts button')].some(x=>/^Move/.test(x.innerText))));
  await p.evaluate(()=>document.querySelector('#acts button.back').click());await p.waitForTimeout(300);
  ok(tag+': back returns to the commands',await p.evaluate(()=>[...document.querySelectorAll('#acts button')].some(x=>/^Move/.test(x.innerText))));
  ok(tag+': the battle menu starts closed',!(await inView('#sh-retreat')));
  await p.evaluate(()=>document.getElementById('mnb').click());await p.waitForTimeout(200);
  ok(tag+': the ⋯ menu shows Log and Retreat',await inView('#sh-retreat')&&await p.evaluate(()=>[...document.querySelectorAll('#top span button')].some(x=>x.innerText.trim()==='Log'&&x.offsetParent)));
  ok(tag+': no page errors',!errs.length);if(errs.length)console.log(errs);
  await p.close();
}
(async()=>{const b=await chromium.launch();await run(b,390,844,'portrait');await run(b,844,390,'landscape');await b.close();console.log(fails?fails+' FAILED':'ALL PASS')})().catch(e=>{console.log('ERR',e.message.split('\n')[0]);process.exit(1)});
