// Scenes (UI pass phase 5a, design/cinematics.md): the human opening plays on the board after New campaign, in portrait and landscape:
// letterbox and place name, HUD hidden, units walk in, the speaker is marked and the dialogue box points at them, tap to go on, Log, Auto,
// Skip, and the campaign comes back at the end. A test script checks the in-scene choice, its result line, enter / exit and facing.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node tscene.js   (SHOTS=dir to save screenshots)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']]){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
  await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(600);
  const st=()=>p.evaluate(()=>{const s=Battle.sceneState(),d=document.getElementById('scDlg'),vis=e=>{if(!e||!e.offsetParent)return false;const b=e.getBoundingClientRect();return b.width>0&&b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1};
    return {on:!!s,s,dlg:d&&d.classList.contains('on')?d.textContent:'',dvis:vis(d),tail:d&&d.dataset.t||'',hud:getComputedStyle(document.getElementById('hud')).display,shell:document.getElementById('shell').classList.contains('on'),
      place:(document.querySelector('#scn .pl')||{}).textContent||'',scroll:document.documentElement.scrollHeight>innerHeight+1}});
  let s=await st();
  ok(s.on&&/Kingsway Cross/.test(s.place),o+': New campaign plays the opening scene at Kingsway Cross');
  ok(s.hud==='none'&&!s.shell&&!s.scroll,o+': the battle HUD and the campaign are hidden, nothing scrolls');
  ok(/three roads, one well/.test(s.dlg)&&s.dvis,o+': the first line is narration, on screen');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/scene_'+o+'_1.png'});
  const tap=()=>p.evaluate(()=>document.getElementById('scn').click());
  await tap();await p.waitForTimeout(3500);s=await st();
  // party has walked in, the clerk has come up and is speaking
  for(let i=0;i<10&&s.s.speaker!=='clerk';i++){await p.waitForTimeout(500);s=await st()}
  ok(s.s.speaker==='clerk'&&/halfpenny/.test(s.dlg)&&/Toll-clerk/i.test(s.dlg),o+': the clerk speaks, named in the box ('+s.s.speaker+')');
  ok(s.s.units.filter(u=>/^p\d/.test(u.id)).length===3&&s.s.units.find(u=>u.id==='p0').y===8,o+': the party walked in to the well ('+JSON.stringify(s.s.units)+')');
  ok(s.dvis&&/^[tblr]$/.test(s.tail),o+': the box is on screen with a tail toward the speaker ('+s.tail+')');
  const tailOk=await p.evaluate(()=>{const d=document.getElementById('scDlg'),t=d.querySelector('.tail').getBoundingClientRect();return t.width>0});ok(tailOk,o+': the tail is drawn');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/scene_'+o+'_2.png'});
  await p.evaluate(()=>document.getElementById('scLog').click());await p.waitForTimeout(100);
  const lg=await p.evaluate(()=>document.getElementById('scLogP').textContent);ok(/three roads/.test(lg)&&/halfpenny/.test(lg),o+': Log lists the lines so far');
  await p.evaluate(()=>document.querySelector('#scLogP button').click());
  await tap();await p.waitForTimeout(300);s=await st();ok(!s.s.speaker&&s.dlg.length>20,o+': tapping moves on to the narration');
  await p.evaluate(()=>document.getElementById('scAuto').click());await p.waitForTimeout(400);
  const i0=(await st()).s.i;await p.waitForTimeout(8500);const i1=((await st()).s||{i:99}).i;ok(i1>i0,o+': Auto moves on by itself ('+i0+' → '+i1+')');
  await p.evaluate(()=>document.getElementById('scSkip').click());await p.waitForTimeout(800);s=await st();
  ok(!s.on&&s.shell,o+': Skip runs to the end and the campaign comes back');
  ok(!(await p.evaluate(()=>document.getElementById('scn'))),o+': the scene layer is gone');
  // a test script: enter, exit, facing, an in-scene choice and its result
  await p.evaluate(()=>{window.__ch=null;window.__done=null;GAME_SHELL.state().world.flags.guide_off=1;
    GAME_SHELL.playScene({map:'road_plains_b',place:'Test Field',time:'Dusk',cast:[{id:'a',name:'Voss',primary:'squire',team:'E',at:[5,6]},{id:'b',name:'Hero',primary:'scout',team:'P',at:[5,9]},{id:'c',name:'Runner',primary:'rogue',team:'E',at:[11,7],off:true}],
      steps:[{say:'a',text:'Keep the road.'},{enter:'c',from:[11,7],at:[7,7]},{face:'a',to:'c'},{say:'c',text:'Riders on the north road!'},{exit:'c',to:[11,6]},
        {choose:[{id:'stop',label:'Stop them'},{id:'ride',label:'Ride on'}],who:'a',text:'What will you do?'}]},
      {onChoose:id=>{window.__ch=id;return {text:'You chose '+id+'.'}},onDone:c=>{window.__done=c}})});
  await p.waitForTimeout(400);await tap();await p.waitForTimeout(2500);s=await st();
  ok(s.s.speaker==='c'&&s.s.units.some(u=>u.id==='c'&&u.x===7),o+': a unit enters and walks to its mark, then speaks');
  if(o==='landscape'&&process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/scene_'+o+'_3.png'});
  await tap();await p.waitForTimeout(2500);s=await st();
  ok(!s.s.units.some(u=>u.id==='c'),o+': exit walks it off and removes it');
  const btns=await p.evaluate(()=>[...document.querySelectorAll('#scDlg .ch button')].map(b=>b.textContent));
  ok(btns.join()==='Stop them,Ride on'&&/What will you do/.test(s.dlg),o+': the choice shows as buttons in the dialogue box');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/scene_'+o+'_choice.png'});
  await tap();await p.waitForTimeout(200);ok((await st()).on&&!(await p.evaluate(()=>window.__ch)),o+': tapping the board does not pick for you');
  await p.evaluate(()=>document.querySelector('#scDlg .ch button').click());await p.waitForTimeout(300);s=await st();
  ok(await p.evaluate(()=>window.__ch)==='stop'&&/You chose stop/.test(s.dlg),o+': the choice runs and its result plays as a line');
  await tap();await p.waitForTimeout(400);
  ok(await p.evaluate(()=>window.__done)==='stop'&&!(await st()).on,o+': the scene ends and reports the choice');
  ok(!errs.length,o+': no page errors '+errs.join(' | '));
  await p.close()}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0)})();
