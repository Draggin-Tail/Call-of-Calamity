// Node ownership phase 3d in the browser: a place under siege says which stage comes next, and at a capital's last stand the briefing names the leader.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t91ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
const sheet=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return e?e.innerText.replace(/\n+/g,' | '):''});
const close=()=>p.evaluate(()=>{const x=document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()});
await close();
// a Crown siege on a Banner-held castle, already past the walls
const T=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;C.relState(s).wars['broken_banner|crown']={since:s.world.day,by:'crown'};
  const ids=Object.keys(C.NODES).filter(id=>C.ownerOf(s,id)==='crown'&&!C.NODES[id].hidden);const T=ids.find(id=>C.NODES[id].type==='castle'),L=ids.find(id=>C.NODES[id].type==='town');
  (s.world.nodes[T]=s.world.nodes[T]||{}).owner='broken_banner';C.attackState(s).list.push({n:77,by:'crown',on:'broken_banner',target:T,from:L,day:s.world.day,lands:s.world.day+5,stage:1,stages:3});
  C.discover(s,T);GAME_SHELL.render();return T});
await p.evaluate(T=>GAME_SHELL.nodeSheet(T),T);await p.waitForTimeout(300);
let t=await sheet();ok('the sheet says it is under siege, what has fallen and what is next',/Under siege/.test(t)&&/has taken the walls/.test(t)&&/The gate comes next, within 5 days/.test(t),t.slice(0,500));
ok('...and how sieges work, in words',/3 fights, a week apart/.test(t)&&!/garrison: \d/i.test(t));
await close();
// the Banner down to its capital, the Crown at its last stand
const cap=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();const cap=Object.keys(C.NODES).find(id=>C.NODES[id].type==='capital'&&C.NODES[id].capital==='broken_banner');
  Object.keys(C.NODES).forEach(id=>{if(C.ownerOf(s,id)==='broken_banner'&&id!==cap)(s.world.nodes[id]=s.world.nodes[id]||{}).owner='crown'});
  const from=Object.keys(C.NODES).find(id=>C.ownerOf(s,id)==='crown'&&!C.NODES[id].hidden&&C.NODES[id].type==='castle');
  C.attackState(s).list.push({n:78,by:'crown',on:'broken_banner',target:cap,from,day:s.world.day,lands:s.world.day+7,stage:3,stages:4});
  s.world.location=cap;C.discover(s,cap);GAME_SHELL.render();GAME_SHELL.nodeSheet(cap);return cap});
await p.waitForTimeout(300);t=await sheet();ok('at the last stand the sheet warns that the faction falls with it',/the last stand comes next/i.test(t)&&/If this stage falls, so does the Broken Banner/.test(t),t.slice(0,500));
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button')].find(x=>x.innerText==='Step in').click());await p.waitForTimeout(300);
t=await sheet();ok('the briefing names the leader on one side and the stand on the other',/Captain Old Standard's last stand/.test(t)&&/Stand with Captain Old Standard/.test(t),t.slice(0,600));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
