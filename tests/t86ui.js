// Node ownership phase 2 in the browser: a rival's place sheet, the Factions tab with one rank, an offer that means leaving, the Journal.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t86ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.waitForTimeout(1000);
const txt=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return (e?e.innerText:'')+' '+document.querySelector('#sh-col').innerText}).then(x=>x.replace(/\n+/g,' | '));
const nav=async n=>{await p.evaluate(n=>{const x=[...document.querySelectorAll('#sh-col button')].find(x=>x.innerText.trim()===n);if(x)x.click()},n);await p.waitForTimeout(400)};
const close=()=>p.evaluate(()=>{const x=document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()});
const openNode=async id=>{await p.evaluate(id=>{const n=GAME_CAMPAIGN.NODES[id].name;document.querySelector('button.n[aria-label="'+n+'"]').click()},id);await p.waitForTimeout(500)};
const go=id=>p.evaluate(id=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;s.world.location=id;C.discover(s,id);Object.keys(C.NODES[id].links||{}).forEach(i=>C.discover(s,i));GAME_SHELL.render();return true},id);
// serve the Syndicate, stand at Vol'Dun (the Synod is Opposed to the Syndicate)
await p.evaluate(()=>{const S=GAME_SAVE,s=GAME_SHELL.state();['crown','syndicate','synod','broken_banner'].forEach(f=>s.factions.standing[f]=0);S.joinRank(s,'syndicate',{force:true});s.inventory.gold=900});
await close();await nav('Map');await go('voldun');await openNode('voldun');
let t=await txt();
ok('a rival place says it knows whom you serve',/They know you serve the Mercantile Syndicate/.test(t),t.slice(0,300));
ok('...and that its recruiters will not deal with you',/recruiters will not deal with you/.test(t));
ok('...and shows no recruit button',!/Recruit \(/.test(t));
ok('...and no allegiance oath at the hall',!/Swear allegiance/.test(t));
await close();await p.waitForTimeout(200);
await nav('Factions');t=await txt();
ok('the Factions tab shows one rank',/Your rank/i.test(t)&&!/of 3\)/.test(t),t.slice(0,500));
ok('nothing about secrets, suspicion or a double life is left on it',!/double life|suspicion|secret rank|your cover|Lie low/i.test(t));
ok('no separate allegiance oath on it',!/Allegiance:/.test(t));
// an offer from the Crown, at the place where it waits
const at=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.factions.standing.crown=300;s.world.flags.tryout_crown=1;const o=C.offers(s).find(x=>x.faction==='crown');return o&&o.at});
ok('the Crown makes an offer',!!at);
await nav('Map');await go(at);await openNode(at);t=await txt();
ok('the offer says yes means leaving your faction',/Saying yes means leaving the Mercantile Syndicate/.test(t),t.slice(0,400));
ok('...and the button says so',/Leave and accept/.test(t));
await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet button, #sh-col button')].find(x=>/Leave and accept/.test(x.innerText)).click());await p.waitForTimeout(500);t=await txt();
ok('accepting: you are one of them, and have left the Syndicate',/You are one of them/.test(t)&&/You have left the Mercantile Syndicate/.test(t),t.slice(0,300));
const ranks=await p.evaluate(()=>GAME_SAVE.listRanks(GAME_SHELL.state()).map(r=>r.faction+r.rank).join());
ok('you hold one rank: Crown 1',ranks==='crown1',ranks);
await close();await nav('Journal');t=await txt();
ok('the Journal reads with no secret offers',!/in secret/i.test(t));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
