// Victory screen (UI pass phase 4): after a campaign fight, a full-screen result with spoils, greatest contribution and the company's
// XP and JP (bars, level-ups, newly learnable skills), the bench share, a Reports page for everything else, and Continue. Also a defeat.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node tvictory.js   (SHOTS=dir to save screenshots)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
async function fight(b,w,h,o,win){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
  await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
  const clickT=async(sel,t)=>{await p.evaluate(([sel,t])=>{const x=[...document.querySelectorAll(sel)].find(x=>x.innerText.trim()===t&&x.offsetParent);x&&x.click()},[sel,t]);await p.waitForTimeout(400)};
  await clickT('#sh-sheet button','Close');await clickT('#ss-sheet button','Onward');
  // the leader is one level-up away and has JP banked just short of a skill, so the screen has a level-up and a newly learnable skill to show
  await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,LO=GAME_LOADOUT,s=GAME_SHELL.state();s.world.flags.guide_off=1;s.world.location='thornfield';C.discover(s,'thornfield');
    const u=s.roster[0];u.xp=LO.xpForLevel(u.level+1)-2;const L=S.learnable(u),c=Math.min(...L.skills.map(x=>x.cost));u.jp=u.jp||{};u.jp[u.primary]=Math.max(0,c-1);GAME_SHELL.render()});
  await clickT('#sh-col button','Map');
  await p.evaluate(()=>document.querySelector('button.n[aria-label="Thornfield"]').click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Fight:/.test(x.innerText.trim())).click());await p.waitForTimeout(400);
  await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>/Start battle/.test(x.innerText)).click());await p.waitForTimeout(2500);
  await clickT('#acts button','Begin battle');
  for(let i=0;i<20;i++){if(await p.evaluate(()=>!!document.querySelector('#acts button.cmd')))break;await p.waitForTimeout(1000)}
  // end the fight: the second unit did the most damage and felled two
  await p.evaluate(win=>{const mine=units.filter(u=>u.baseTeam==='P'),foes=units.filter(u=>u.baseTeam==='E');
    mine.forEach((u,i)=>{u.tally={uses:3,helps:0,dmg:i===1?41:12}});
    foes.forEach((f,i)=>{if(win){f.hp=0;if(i<2)KILLS.push({killer:mine[1].uid,killerTeam:'P',victim:f.uid,victimTeam:'E',ability:'attack',turn:1})}});
    if(!win)mine.forEach(u=>u.hp=0);checkEnd()},win);
  await p.waitForTimeout(1500);
  return {p,errs};
}
const view=p=>p.evaluate(()=>{const r=document.getElementById('vic');if(!r)return null;const sc=r.querySelector('.vic-screen');
  const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1};
  const t=s=>(r.querySelector(s)||{}).textContent||'';
  return {cls:r.className,title:t('.vic-ban h1'),line:t('.vic-ban'),over:sc.scrollHeight>sc.clientHeight+1||document.documentElement.scrollHeight>innerHeight+1,
    frames:[...r.querySelectorAll('.stv-frame')].filter(f=>!f.closest('.stv-det')&&getComputedStyle(f).display!=='none').map(f=>({c:f.className,v:vis(f)})),
    spoils:t('.vic-sp'),best:t('.vic-best'),rows:[...r.querySelectorAll('.vic-u')].map(u=>({t:u.textContent,v:vis(u),up:u.classList.contains('up'),w:(u.querySelector('.gain')||{style:{}}).style.width})),
    btns:[...r.querySelectorAll('.vic-foot button')].map(b=>b.textContent),btnVis:[...r.querySelectorAll('.vic-foot button')].every(vis),bench:t('.vic-bench'),reps:r.querySelectorAll('.vic-rl > *').length,det:t('.stv-det')}});
(async()=>{const b=await chromium.launch();
for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']]){
  const {p,errs}=await fight(b,w,h,o,true);
  let v=await view(p);
  ok(v&&/Vanquished/i.test(v.title)&&v.cls.includes('won'),o+': a win opens the victory screen ('+(v&&v.title)+')');
  ok(!v.over,o+': no scrolling');
  ok(v.frames.every(f=>f.v)&&v.rows.every(r=>r.v)&&v.btnVis,o+': every panel, unit and button is on screen ('+v.frames.filter(f=>!f.v).map(f=>f.c)+')');
  ok(/won in round \d+/.test(v.line)&&/no one fell/.test(v.line),o+': the banner says where, when and who fell');
  ok(/gold/.test(v.spoils),o+': spoils list the gold ('+v.spoils+')');
  const name1=await p.evaluate(()=>GAME_SHELL.state().party.map(id=>GAME_SHELL.state().roster.find(u=>u.id===id).name)[1]);
  ok(v.best.includes(name1)&&/2 foes felled/.test(v.best)&&/41 damage dealt/.test(v.best),o+': greatest contribution names the top unit with kills and damage ('+v.best+')');
  ok(v.rows.length>=2&&v.rows.every(r=>/\+\d+ XP/.test(r.t)&&/\+\d+ JP in/.test(r.t)),o+': each unit shows XP and JP gained');
  ok(v.rows[0].up&&/LEVEL UP/.test(v.rows[0].t)&&/→/.test(v.rows[0].t)&&/HP \+\d/.test(v.rows[0].t),o+': a level-up is marked with the new level and HP gain');
  ok(/can be learned/.test(v.rows[0].t),o+': a newly learnable skill is called out');
  ok(v.rows.every(r=>/calc|%/.test(r.w)&&r.w!=='0px'&&r.w!=='0'),o+': XP bars fill in ('+v.rows.map(r=>r.w)+')');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/vic_'+o+'.png'});
  // hold the level-up row: what can be learned
  const el=await p.$('#vic .vic-u');const bb=await el.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.waitForTimeout(650);await p.mouse.up();await p.waitForTimeout(150);
  v=await view(p);ok(/can now learn/.test(v.det),o+': holding a unit with a new skill lists it');
  await p.evaluate(()=>document.querySelector('#vic .stv-det').click());
  // tap a unit: Status opens above, Back returns to the victory screen
  await p.evaluate(()=>document.querySelectorAll('#vic .vic-u')[1].click());await p.waitForTimeout(200);
  ok(await p.evaluate(()=>{const s=document.getElementById('stv');return !!s&&+getComputedStyle(s).zIndex>+getComputedStyle(document.getElementById('vic')).zIndex}),o+': tapping a unit opens its Status above');
  await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-hdr button')].find(x=>x.textContent==='Back').click());await p.waitForTimeout(200);
  v=await view(p);ok(v&&!(await p.evaluate(()=>document.getElementById('stv'))),o+': Back from Status returns to the victory screen');
  const last=v.btns[v.btns.length-1];
  if(/reports/.test(last)){
    await p.evaluate(()=>[...document.querySelectorAll('#vic .vic-foot button')].pop().click());await p.waitForTimeout(200);v=await view(p);
    ok(v.reps>0&&v.btns.join()==='Back,Continue'&&!v.over,o+': Reports page lists the rest ('+v.reps+')');
    if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/vic_rep_'+o+'.png'});
  } else ok(last==='Continue',o+': Continue when there is nothing more to report');
  await p.evaluate(()=>[...document.querySelectorAll('#vic .vic-foot button')].pop().click());await p.waitForTimeout(300);
  ok(!(await view(p)),o+': Continue closes the victory screen');
  ok(await p.evaluate(()=>document.getElementById('shell').classList.contains('on')),o+': back on the campaign');
  ok(!errs.length,o+': no page errors '+errs.join(' | '));
  await p.close();
}
{const {p,errs}=await fight(b,390,664,'defeat',false);const v=await view(p);
  ok(v&&/Defeat/i.test(v.title)&&v.cls.includes('lost')&&/A day passes/.test(v.line),'defeat: the screen says so and a day passes');
  ok(!v.over&&v.frames.every(f=>f.v),'defeat: fits');
  ok(/Nothing taken/.test(v.spoils),'defeat: no spoils');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/vic_defeat.png'});
  await p.evaluate(()=>[...document.querySelectorAll('#vic .vic-foot button')].pop().click());await p.waitForTimeout(200);
  if(await view(p))await p.evaluate(()=>[...document.querySelectorAll('#vic .vic-foot button')].pop().click());await p.waitForTimeout(200);
  ok(!(await view(p)),'defeat: Continue closes it');ok(!errs.length,'defeat: no page errors '+errs.join(' | '));await p.close()}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0)})();
