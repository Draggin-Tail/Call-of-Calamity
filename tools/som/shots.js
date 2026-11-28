const {chromium}=require('playwright');
async function fight(b,w,h,som,swap){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8766/index.html'+(som?'?som=1':''));await p.waitForTimeout(2500);
  await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
  const clickT=async(sel,t)=>{await p.evaluate(([sel,t])=>{const x=[...document.querySelectorAll(sel)].find(x=>x.innerText.trim()===t&&x.offsetParent);x&&x.click()},[sel,t]);await p.waitForTimeout(400)};
  await clickT('#sh-sheet button','Close');await clickT('#ss-sheet button','Onward');
  await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;s.world.location='thornfield';C.discover(s,'thornfield');GAME_SHELL.render()});
  await clickT('#sh-col button','Map');
  await p.evaluate(()=>document.querySelector('button.n[aria-label="Thornfield"]').click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Fight:/.test(x.innerText.trim())).click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Start battle/.test(x.innerText)).click());await p.waitForTimeout(2500);
  await clickT('#acts button','Begin battle');
  for(let i=0;i<20;i++){if(await p.evaluate(()=>!!document.querySelector('#acts button.cmd')))break;await p.waitForTimeout(1000)}
  if(swap) await p.evaluate(()=>{const m=units.filter(u=>u.baseTeam==='P'),f=units.filter(u=>u.baseTeam==='E');
    ['warrior','wizard','cleric'].forEach((j,i)=>m[i]&&(m[i].job=j));f[0]&&(f[0].job='ghoul');render()});
  await p.waitForTimeout(900);
  return {p,errs};
}
(async()=>{const b=await chromium.launch();const D=process.argv[2];
for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']])for(const som of [0,1])for(const swap of [0,1]){
  const {p,errs}=await fight(b,w,h,som,swap);
  await p.screenshot({path:`${D}/${o}_${som?'som':'now'}${swap?'_b':''}.png`});
  for(let z=0;z<1;z++){await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='+'&&x.offsetParent);b&&b.click()});await p.waitForTimeout(300)}
  await p.waitForTimeout(600);await p.screenshot({path:`${D}/${o}_${som?'som':'now'}${swap?'_b':''}_zoom.png`});
  if(errs.length)console.log(o,som,errs);await p.close();}
await b.close();})();
