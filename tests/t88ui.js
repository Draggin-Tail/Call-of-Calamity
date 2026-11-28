// Node ownership phase 3a in the browser: the realm on the Factions tab (wars, word on the roads, your faction's mood), speaking in council
// at a hall, and the council scene. Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t88ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
const txt=()=>p.evaluate(()=>{const e=document.querySelector('#sh-sheet');return (e?e.innerText:'')+' '+document.querySelector('#sh-col').innerText}).then(x=>x.replace(/\n+/g,' | '));
const nav=async n=>{await p.evaluate(n=>{const x=[...document.querySelectorAll('#sh-col button')].find(x=>x.innerText.trim()===n);if(x)x.click()},n);await p.waitForTimeout(400)};
const close=()=>p.evaluate(()=>{const x=document.querySelector('#sh-sheet')&&[...document.querySelectorAll('#sh-sheet button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()});
ok('the relations rules loaded in the page',await p.evaluate(()=>!!GAME_CAMPAIGN.REL&&GAME_CAMPAIGN.validateRelations().length===0));
// a Crown officer at Crown Keep; the Crown and the Synod at war
const hall=await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;['crown','syndicate','synod','broken_banner'].forEach(f=>{s.factions.standing[f]=0;s.factions.met=s.factions.met||{};});
  S.joinRank(s,'crown',{force:true});S.promote(s,'crown',{force:true});['syndicate','synod','broken_banner'].forEach(f=>S.markMet?S.markMet(s,f):null);
  const h=Object.keys(C.NODES).find(id=>C.ownerOf(s,id)==='crown'&&C.NODES[id].type==='capital');s.world.location=h;C.discover(s,h);
  S.setRelation(s,'synod','broken_banner',-0.8,{both:true});S.advanceDay(s,1);GAME_SHELL.render();return h});
await close();await nav('Factions');let t=await txt();
ok('the Factions tab shows the state of the realm',/The state of the realm/i.test(t),t.slice(0,600));
ok('...with the war, in words',/At war: the Ascendant Synod against the Broken Banner/.test(t),t.slice(0,800));
ok('...and the word on the roads',/declared war on the/.test(t));
ok('...and no numbers for relations',!/-0\.|0\.\d/.test(t));
ok('an officer at a Crown hall can speak in council',/Speak in council/i.test(t)&&/For alliance/.test(t),t.slice(0,900));
await p.evaluate(()=>[...document.querySelectorAll('#sh-col button')].find(x=>/For alliance/.test(x.innerText)).click());await p.waitForTimeout(300);t=await txt();
ok('once heard, the faction says so',/heard you recently/.test(t));
// the council: the Crown wants war on the Banner
const beat=await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();S.setRelation(s,'crown','broken_banner',-0.75,{both:true});S.advanceDay(s,1);return C.relState(s).pending&&C.relState(s).pending.kind});
ok('the Crown calls its council',beat==='war');
await nav('Factions');t=await txt();
ok('the Factions tab says the council is waiting',/has called its council/i.test(t));
const opened=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();const b=C.startMove(s,'faction_council');return !!b});
ok('the council scene opens at the hall',opened);
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
