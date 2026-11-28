// Status and Equip screens (UI pass phase 2): open from the roster, fit the screen in portrait and landscape, item icons,
// tap to select then tap again to edit, long press for details, the equip compare, Equip, Remove and Best gear, unit paging.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node tstatus.js
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']]){
 const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
 await p.click('text=New campaign');await p.waitForTimeout(300);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
 await p.evaluate(()=>{const s=GAME_SHELL.state();s.world.flags.guide_off=1;const it=s.inventory.items;it.t2_iron_sword=1;it.spear=1;it.t2_round_shield=1;it.swift_charm=2;it.iron_mace=1;it.t3_chain_coif=1;
   s.roster[0].level=6;s.roster[0].jp={squire:400};GAME_SAVE.learnSkill(s,s.roster[0].id,'brace');GAME_SHELL.render()});
 const tabs=async re=>p.evaluate(src=>{const R=new RegExp(src);const x=[...document.querySelectorAll('#sh-col button,#sh-sheet button,#ss-sheet button')].find(x=>x.offsetParent&&R.test(x.innerText.trim()));if(x)x.click();return !!x},re.source);
 await tabs(/^Close$/);await tabs(/^Onward$/);await p.waitForTimeout(300);await tabs(/^Roster$/);await p.waitForTimeout(300);
 await p.evaluate(()=>[...document.querySelectorAll('#sh-col .card')][0].click());await p.waitForTimeout(300);
 const st=()=>p.evaluate(()=>{const r=document.getElementById('stv');if(!r)return null;const sc=r.querySelector('.stv-screen');const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1};
   return {mode:r.className,over:sc.scrollHeight>sc.clientHeight+1||document.documentElement.scrollHeight>innerHeight+1,frames:[...r.querySelectorAll('.stv-frame')].filter(f=>getComputedStyle(f).display!=='none'&&!f.closest('.stv-det')).map(f=>({c:f.className,v:vis(f)})),
   icons:r.querySelectorAll('.stv-eq .stv-slot img,.stv-eq .stv-slot .ii').length,acts:[...r.querySelectorAll('.stv-acts button')].map(x=>x.textContent+(x.disabled?'(off)':'')),help:(r.querySelector('.stv-help')||{}).textContent||'',det:(r.querySelector('.stv-det')||{}).textContent||'',sheet:!!document.querySelector('#sh-sheet.on')}});
 let s=await st();
 ok(s&&s.mode==='stv-status',o+': a roster card opens the Status screen');
 ok(!s.over,o+': no scrolling');
 ok(s.frames.every(f=>f.v),o+': every panel is on screen ('+s.frames.filter(f=>!f.v).map(f=>f.c).join(',')+')');
 ok(s.icons>=4,o+': equipped items show their pixel icons ('+s.icons+')');
 ok(s.acts.join()==='Classes,Equip,Learn',o+': Classes, Equip and Learn buttons');
 ok(/Basics/.test(s.help)&&/Slash/.test(s.help),o+': the help box explains the primary and lists its skills');
 // tap a passive row once: help changes, no sheet
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-ab .stv-row')][2].click());await p.waitForTimeout(150);s=await st();
 ok(/passive slot/i.test(s.help)&&!s.sheet,o+': one tap selects a row and explains it');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-ab .stv-row')][2].click());await p.waitForTimeout(200);s=await st();
 ok(s.mode==='stv-equip stv-learn'&&!s.sheet,o+': a second tap opens the Learn screen (no old sheet)');
 ok(await p.evaluate(()=>/Passives/.test(document.querySelector('#stv .stv-strip .on').textContent)),o+': ... on the Passives page');
 ok(s.frames.every(f=>f.v)&&!s.over,o+': the Learn screen fits ('+s.frames.filter(f=>!f.v).map(f=>f.c).join(',')+')');
 // skills page: pick an unlearned skill and learn it with JP
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-strip button')][0].click());await p.waitForTimeout(150);
 const lr=await p.evaluate(()=>{const u=GAME_SHELL.state().roster[0],before=u.skills?JSON.stringify(u.skills):'';const r=[...document.querySelectorAll('#stv .stv-list .stv-row')].find(x=>x.querySelector('.stv-jp:not(.no)'));if(!r)return null;r.click();return 1});
 await p.waitForTimeout(150);
 const jp0=await p.evaluate(()=>GAME_SAVE.jpOf?GAME_SAVE.jpOf(GAME_SHELL.state().roster[0],'squire'):null);
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-acts button')].find(x=>/^Learn/.test(x.textContent)).click());await p.waitForTimeout(200);
 const jp1=await p.evaluate(()=>GAME_SAVE.jpOf?GAME_SAVE.jpOf(GAME_SHELL.state().roster[0],'squire'):null);
 ok(lr&&jp0!==null&&jp1<jp0,o+': Learn spends JP on the picked skill ('+jp0+' to '+jp1+')');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-hdr button')].find(x=>x.textContent==='Back').click());await p.waitForTimeout(200);s=await st();ok(s&&!s.sheet&&s.mode==='stv-status',o+': Back returns to Status');
 // long press an equipment row
 const hold=async sel=>{const el=await p.$(sel);const bb=await el.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.waitForTimeout(650);await p.mouse.up();await p.waitForTimeout(150)};
 await hold('#stv .stv-eq .stv-row');s=await st();
 ok(/Iron Sword/.test(s.det)&&/Attack: \d+ damage/.test(s.det)&&/Worn by/.test(s.det),o+': holding an item shows its details');
 ok(s.mode==='stv-status',o+': a long press does not also tap (stays on Status)');
 await p.evaluate(()=>document.querySelector('#stv .stv-det').click());await p.waitForTimeout(100);
 await hold('#stv .stv-ab .stv-row');s=await st();
 ok(/Basics/.test(s.det)&&/not learned/.test(s.det)&&/AP/.test(s.det),o+': holding the primary shows every class skill, learned or not');
 await p.evaluate(()=>document.querySelector('#stv .stv-det').click());
 await p.evaluate(()=>document.querySelector('#stv .stv-ab .stv-row').click());await p.waitForTimeout(100);
 await hold('#stv .stv-help .stv-chips span');s=await st();
 ok(/AP/.test(s.det)&&/damage|heal|shield|Guard/i.test(s.det),o+': holding a skill shows its cost and numbers');
 await p.evaluate(()=>document.querySelector('#stv .stv-det').click());
 // paging
 const n0=await p.evaluate(()=>document.querySelector('#stv .stv-nm span').textContent);
 await p.evaluate(()=>document.querySelector('#stv .stv-arr[aria-label="Next unit"]').click());await p.waitForTimeout(100);
 const n1=await p.evaluate(()=>document.querySelector('#stv .stv-nm span').textContent);
 ok(n0!==n1,o+': ▸ pages to the next unit');
 await p.evaluate(()=>document.querySelector('#stv .stv-arr[aria-label="Previous unit"]').click());await p.waitForTimeout(100);
 // equip
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-acts button')].find(x=>x.textContent==='Equip').click());await p.waitForTimeout(150);s=await st();
 ok(s.mode==='stv-equip'&&!s.over&&s.frames.every(f=>f.v),o+': Equip screen fits ('+s.frames.filter(f=>!f.v).map(f=>f.c).join(',')+')');
 const rows=await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-list .stv-row b')].map(x=>x.textContent));
 ok(rows[0]==='Iron Sword'&&rows.includes('Steel Sword')&&rows.includes('Spear')&&rows.includes('Iron Mace'),o+': the list has the worn item first, then what the stash holds ('+rows.join(', ')+')');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-list .stv-row')].find(r=>r.querySelector('b').textContent==='Spear').click());await p.waitForTimeout(150);
 const cmp=await p.evaluate(()=>document.querySelector('#stv .stv-cmp').textContent);
 ok(/Weapon/.test(cmp)&&/→/.test(cmp)&&/Two-handed: the Round Shield goes back/.test(cmp),o+': picking a two-hander previews the change and warns about the shield');
 ok(await p.evaluate(()=>!!document.querySelector('#stv .stv-cg .up,#stv .stv-cg .dn')),o+': changes are coloured up or down');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-list .stv-row')].find(r=>r.querySelector('b').textContent==='Steel Sword').click());await p.waitForTimeout(100);
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-acts button')].find(x=>x.textContent==='Equip').click());await p.waitForTimeout(150);
 let g=await p.evaluate(()=>{const s=GAME_SHELL.state();return {m:s.roster[0].gear.MainHand,iron:s.inventory.items.iron_sword||0}});
 ok(g.m==='t2_iron_sword'&&g.iron===1,o+': Equip wears it and the old one goes to the stash');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-strip button,#stv .stv-eq .stv-row')].filter(x=>x.offsetParent)[4].click());await p.waitForTimeout(100);
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-acts button')].find(x=>x.textContent==='Best gear').click());await p.waitForTimeout(150);
 g=await p.evaluate(()=>{const u=GAME_SHELL.state().roster[0];return u.gear});
 ok(g.OffHand==='t2_round_shield'&&g.Head==='t3_chain_coif'&&g.Accessory==='swift_charm'&&g.MainHand==='t2_iron_sword',o+': Best gear takes the strongest of each kind and fills the empty accessory ('+JSON.stringify(g)+')');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-acts button')].find(x=>x.textContent==='Remove').click());await p.waitForTimeout(100);
 g=await p.evaluate(()=>GAME_SHELL.state().roster[0].gear.Accessory||null);ok(g===null,o+': Remove empties the slot');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-hdr button')].find(x=>x.textContent==='Back').click());await p.waitForTimeout(100);s=await st();
 ok(s&&s.mode==='stv-status',o+': Back from Equip returns to Status');
 await p.evaluate(()=>[...document.querySelectorAll('#stv .stv-hdr button')].find(x=>x.textContent==='Back').click());await p.waitForTimeout(150);s=await st();
 ok(!s,o+': Back from Status returns to the roster');
 ok(!errs.length,o+': no page errors '+errs.join(' | '));
 await p.close()}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0)})();
