// Class tree (UI pass phase 3): opens from Status, fits the screen in portrait and landscape, ? ? ? for classes out of reach,
// silhouettes for locked classes, requirement lines, the detail panel, Set primary / secondary, long press for the kit, paging, Back.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node tclasses.js   (SHOTS=dir to save screenshots)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch();
for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']]){
 const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
 await p.click('text=New campaign');await p.waitForTimeout(300);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
 // the first unit: squire and acolyte mastered, so sentinel / bulwark / cleric / warrior are unlocked; scout half learned
 await p.evaluate(()=>{const s=GAME_SHELL.state();s.world.flags.guide_off=1;const u=s.roster[0],D=GAME_DATA;u.learned=u.learned||{};
   for(const c of ['squire','acolyte'])u.learned[c]=D.classes[c].ab.slice();u.learned.scout=D.classes.scout.ab.slice(0,2);
   for(const c of ['squire','acolyte','scout','warrior','sentinel','bulwark','cleric'])if(!u.unlocked.includes(c))u.unlocked.push(c);GAME_SHELL.render()});
 const tabs=async re=>p.evaluate(src=>{const R=new RegExp(src);const x=[...document.querySelectorAll('#sh-col button,#sh-sheet button,#ss-sheet button')].find(x=>x.offsetParent&&R.test(x.innerText.trim()));if(x)x.click();return !!x},re.source);
 await tabs(/^Close$/);await tabs(/^Onward$/);await p.waitForTimeout(300);await tabs(/^Roster$/);await p.waitForTimeout(300);
 await p.evaluate(()=>[...document.querySelectorAll('#sh-col .card')][0].click());await p.waitForTimeout(300);
 const click=async(sel,txt)=>p.evaluate(([sel,txt])=>{const x=[...document.querySelectorAll(sel)].find(x=>!txt||x.textContent.trim()===txt);if(x)x.click();return !!x},[sel,txt]);
 await click('#stv .stv-acts button','Classes');await p.waitForTimeout(300);
 const st=()=>p.evaluate(()=>{const r=document.getElementById('stv');if(!r)return null;const sc=r.querySelector('.stv-screen');const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.top>=-1&&b.bottom<=innerHeight+1&&b.left>=-1&&b.right<=innerWidth+1};
   const cells=[...r.querySelectorAll('.stv-cc')].map(c=>({c:c.dataset.c,n:c.querySelector('.n').textContent,cls:c.className,v:vis(c),h:c.getBoundingClientRect().height}));
   return {mode:r.className,over:sc.scrollHeight>sc.clientHeight+1||document.documentElement.scrollHeight>innerHeight+1,frames:[...r.querySelectorAll('.stv-frame')].filter(f=>!f.closest('.stv-det')).map(f=>({c:f.className,v:vis(f)})),
     cells,lines:[...r.querySelectorAll('.stv-lines polyline')].map(l=>l.getAttribute('class')),det:(r.querySelector('.stv-cdet')||{}).textContent||'',pop:(r.querySelector('.stv-det')||{}).textContent||'',
     acts:[...r.querySelectorAll('.stv-cdet .stv-acts button')].map(x=>x.textContent+(x.disabled?'(off)':'')),sheet:!!document.querySelector('#sh-sheet.on')}});
 const pick=async c=>{await p.evaluate(c=>document.querySelector('#stv .stv-cc[data-c="'+c+'"]').click(),c);await p.waitForTimeout(150)};
 const shot=async n=>{if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/'+o+'_'+n+'.png'})};
 let s=await st();const cell=c=>s.cells.find(x=>x.c===c);
 ok(s&&s.mode==='stv-classes',o+': Classes on the Status screen opens the class tree');
 ok(!s.over,o+': no scrolling');
 ok(s.frames.every(f=>f.v)&&s.cells.every(c=>c.v),o+': every panel and class is on screen');
 ok(s.cells.length===36,o+': 36 classes over three tiers ('+s.cells.length+')');
 ok(Math.min(...s.cells.map(c=>c.h))>=40,o+': cells are big enough to tap ('+Math.round(Math.min(...s.cells.map(c=>c.h)))+'px)');
 ok(/pri/.test(cell('squire').cls)&&/sel/.test(cell('squire').cls),o+': the primary is marked and selected first');
 ok(!/lock/.test(cell('sentinel').cls)&&cell('sentinel').n==='Sentinel',o+': an unlocked class shows its name and sprite');
 ok(/lock/.test(cell('monk').cls)&&cell('monk').n==='Monk',o+': a locked class in reach (needs scout + acolyte) shows its name as a silhouette');
 ok(/unk/.test(cell('shadowknight').cls)&&cell('shadowknight').n==='? ? ?'&&s.cells.filter(c=>c.n==='? ? ?').length===15,o+': a class out of reach is ? ? ? (tier III without its tier II classes)');
 ok(cell('paladin').n==='Paladin'&&cell('shadowknight').n==='? ? ?',o+': tier III: paladin in reach, shadow knight not');
 await shot('primary');
 await pick('monk');s=await st();
 ok(s.lines.length===2&&s.lines.includes('done')&&s.lines.includes('todo'),o+': selecting Monk draws a solid line from Acolyte (mastered) and a dashed one from Scout ('+s.lines+')');
 ok(/Monk/.test(s.det)&&/Locked/.test(s.det)&&/Scout/.test(s.det)&&/2\/\d/.test(s.det)&&/Master both classes to unlock/.test(s.det),o+': the panel shows requirements with progress and the unlock hint');
 ok(!s.acts.length,o+': no set buttons for a locked class');
 await shot('locked');
 await pick('shadowknight');s=await st();
 ok(/\? \? \?/.test(s.det)&&!/Shadow/.test(s.det)&&/Warrior/.test(s.det),o+': an unknown class hides its name but shows what it needs');
 const hold=async sel=>{const el=await p.$(sel);const bb=await el.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.waitForTimeout(650);await p.mouse.up();await p.waitForTimeout(150)};
 await hold('#stv .stv-cc[data-c="sentinel"]');s=await st();
 ok(/Sentinel/.test(s.pop)&&/AP/.test(s.pop),o+': holding a known class shows its whole kit');
 await p.evaluate(()=>document.querySelector('#stv .stv-det').click());await p.waitForTimeout(100);
 await hold('#stv .stv-cc[data-c="shadowknight"]');s=await st();ok(!s.pop,o+': holding an unknown class shows nothing');
 await pick('sentinel');s=await st();
 ok(s.acts.join()==='Set primary,Set secondary',o+': an unlocked class can be set ('+s.acts+')');
 await click('#stv .stv-cdet .stv-acts button','Set secondary');await p.waitForTimeout(200);s=await st();
 let u=await p.evaluate(()=>{const u=GAME_SHELL.state().roster[0];return {p:u.primary,s:u.secondary}});
 ok(u.s==='sentinel'&&/sec/.test(s.cells.find(c=>c.c==='sentinel').cls)&&s.acts.join()==='Set primary,Remove secondary',o+': Set secondary works and the button turns into Remove');
 await shot('secondary');
 await click('#stv .stv-cdet .stv-acts button','Remove secondary');await p.waitForTimeout(200);
 u=await p.evaluate(()=>GAME_SHELL.state().roster[0].secondary||null);ok(u===null,o+': Remove secondary clears it');
 await pick('cleric');await click('#stv .stv-cdet .stv-acts button','Set primary');await p.waitForTimeout(250);s=await st();
 u=await p.evaluate(()=>GAME_SHELL.state().roster[0].primary);
 ok(u==='cleric'&&/pri/.test(s.cells.find(c=>c.c==='cleric').cls)&&s.acts[0]==='Primary(off)',o+': Set primary switches the class');
 await pick('paladin');s=await st();ok(s.lines.length===2,o+': tier III lines reach across tiers ('+s.lines.length+')');
 await shot('tier3');
 const n0=await p.evaluate(()=>document.querySelector('#stv .stv-hdr').textContent);
 await click('#stv .stv-arr[aria-label="Next unit"]');await p.waitForTimeout(150);s=await st();
 const n1=await p.evaluate(()=>document.querySelector('#stv .stv-hdr').textContent);
 ok(s.mode==='stv-classes'&&n0!==n1&&s.cells.some(c=>/pri/.test(c.cls)&&/sel/.test(c.cls)),o+': ▸ pages to the next unit\'s tree, with its primary selected');
 await click('#stv .stv-arr[aria-label="Previous unit"]');await p.waitForTimeout(100);
 await click('#stv .stv-hdr button','Back');await p.waitForTimeout(150);s=await st();
 ok(s&&s.mode==='stv-status',o+': Back returns to Status');
 await click('#stv .stv-nm');await p.waitForTimeout(200);s=await st();
 ok(s.sheet&&await p.evaluate(()=>/Rename/i.test(document.querySelector('#sh-sheet').textContent)),o+': tapping the name opens the old sheet with Rename');
 ok(!errs.length,o+': no page errors '+errs.join(' | '));
 await p.close()}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0)})();
