// The new map: world view, region views, crossing borders. Serve the game (node serve.js &), then: node tmap.js
// (borders are pre-opened here: border gates have their own test, t80.js)
const {chromium}=require('playwright');let fails=0;const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForSelector('#shell.on');
await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=C.newGame({race:'human'});s.world.flags.guide_off=1;Object.keys(C.NODES).forEach(id=>{C.discover(s,id);if(C.NODES[id].type==='road')s.world.flags['gate_'+id]=1});s.world.rbNext=1e9;Object.assign(C.WANDER,{base:0,zoneBase:0,perDanger:0});C.EVENTS.length=0;GAME_SHELL._set(s);GAME_SHELL.render()});
await p.waitForTimeout(300);let t=await p.textContent('.mhd');ok('the map opens on the party\'s land (the human land is one region now)',/Verdant Central Plains/.test(t));
const img=await p.evaluate(()=>getComputedStyle(document.querySelector('.sh-map>div')).backgroundImage);ok('the region shows its own picture',/regions\/human\.jpg/.test(img));
ok('every territory has a picture file',await p.evaluate(async()=>{for(const t of Object.values(GAME_CAMPAIGN.TERRITORIES)){const r=await fetch(t.img);if(!r.ok)return false}return (await fetch('art/world.jpg')).ok}));
await p.click('text=◂ World');await p.waitForTimeout(300);t=await p.textContent('.mhd');ok('World shows the whole realm',/The Realm/.test(t));
const L=await p.evaluate(()=>GAME_CAMPAIGN.TERRITORIES.elven_realms.label);await p.evaluate(x=>{const b=document.querySelector('.sh-map'),i=b.firstChild;b.scrollLeft=x*i.offsetWidth-150},L[0]);
const bb=await (await p.$('.sh-map>div')).boundingBox();await p.mouse.click(bb.x+L[0]*bb.width,bb.y+L[1]*bb.height);await p.waitForTimeout(300);
t=await p.textContent('.mhd');ok('tapping a territory opens it',/Silvan Thicket/.test(t));
await p.click('button[aria-label="Sylvan Watch"]');await p.waitForTimeout(200);const tr=await p.$('button:has-text("Travel here")');ok('Sylvan Watch can be reached',!!tr);
await tr.click();for(let i=0;i<120;i++){await p.waitForTimeout(150);const c=await p.$('#sh-sheet.on button.pri');if(c){const x=(await c.textContent());if(/Travel/.test(x))break;await c.click()}const loc=await p.evaluate(()=>GAME_SHELL.state().world.location);if(loc==='sylvan_watch')break}
ok('the party arrives at Sylvan Watch',await p.evaluate(()=>GAME_SHELL.state().world.location==='sylvan_watch'));
await p.waitForTimeout(600);await p.evaluate(()=>{const x=document.querySelector('#sh-sheet.on .ph button');x&&x.click()});await p.waitForTimeout(200);t=await p.textContent('.mhd');ok('the map follows the party into the forest',/Silvan Thicket/.test(t));
const tabs=await p.$$eval('.etab',x=>x.map(e=>e.textContent));ok('the forest shows its neighbours as tabs',tabs.length>=3);
await p.click('.etab:has-text("Mirewood")');await p.waitForTimeout(300);t=await p.textContent('.mhd');ok('a tab opens the neighbour',/Mirewood/.test(t));
await p.click('text=◂ World');await p.waitForTimeout(200);const S=await p.evaluate(()=>GAME_CAMPAIGN.TERRITORIES.scorched_desolation.label);
await p.evaluate(x=>{document.querySelector('.sh-map').scrollLeft=0},0);const bb2=await (await p.$('.sh-map>div')).boundingBox();await p.mouse.click(bb2.x+S[0]*bb2.width,bb2.y+S[1]*bb2.height);await p.waitForTimeout(200);
ok('the Scorched Desolation says it is unclaimed',/no one holds this land/.test(await p.textContent('#sh-toast')));
ok('no places in the Scorched Desolation',await p.evaluate(()=>!Object.values(GAME_CAMPAIGN.NODES).some(n=>n.region==='scorched_desolation')));
await p.evaluate(()=>{GAME_SHELL.state().world.location='kingsway_cross';GAME_SHELL.render()});
await p.click('button[aria-label="Map key"]');await p.waitForTimeout(300);
const key=await p.evaluate(()=>{const rows=[...document.querySelectorAll('.mkey .n[class*="t-"]')].slice(0,10);return {n:rows.length,looks:new Set(rows.map(r=>{const c=getComputedStyle(r);return c.width+c.borderRadius+c.backgroundColor+c.borderStyle})).size}});
ok('the map key shows all ten kinds of place',key.n===10);ok('each kind of place looks different',key.looks===10);
ok('no place uses an old type',await p.evaluate(()=>!Object.values(GAME_CAMPAIGN.NODES).some(n=>['hall','battle','choice','contested'].includes(n.type))));
{const f=await p.evaluate(()=>{const a=GAME_SHELL._ownerField().builds;GAME_SHELL.render();GAME_SHELL.render();const b=GAME_SHELL._ownerField().builds;const s=GAME_SHELL.state();(s.world.nodes.thornfield=s.world.nodes.thornfield||{}).owner='synod';GAME_SHELL.render();return [a,b,GAME_SHELL._ownerField().builds,!!document.querySelector('.ofield img')]});
ok('owner colours are drawn, kept across redraws, and redrawn only when an owner changes ('+f.slice(0,3)+')',f[3]&&f[0]>=1&&f[1]===f[0]&&f[2]===f[0]+1);}
ok('no page errors',errs.length===0);if(errs.length)console.log(errs);console.log('fails='+fails);await b.close();process.exit(fails?1:0)})();
