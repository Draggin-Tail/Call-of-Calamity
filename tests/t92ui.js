// Node ownership phase 4a in the browser: after a war victory the realm is one. The opening scene names it and offers the oath,
// the map wears the realm's colour, and the Factions tab shows the realm and drops the absorbed factions.
// Serve the game folder on 8766 first (node serve.js &), then: NODE_PATH=$(npm root -g) node t92ui.js
const {chromium}=require('playwright');
let fails=0;const ok=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(c||!info?'':'  ['+info+']'));if(!c)fails++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:860}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');await p.waitForTimeout(2500);
await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(1000);
const text=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\n+/g,' | '):''},sel);
const closeAll=()=>p.evaluate(()=>{for(const sel of ['#ss-sheet','#sh-sheet']){const x=document.querySelector(sel)&&[...document.querySelectorAll(sel+' button')].find(x=>/Close|Continue/.test(x.innerText));if(x)x.click()}});
await closeAll();await p.waitForTimeout(300);await closeAll();
// the Crown wipes out the other three; the next day the realm is one
const loc=await p.evaluate(()=>{const C=GAME_CAMPAIGN,S=GAME_SAVE,s=GAME_SHELL.state();s.world.flags.guide_off=1;C.relState(s).next=1e9;s.factions.standing.crown=300;
  ['syndicate','synod','broken_banner'].forEach(f=>{const cap=Object.keys(C.NODES).find(id=>C.NODES[id].type==='capital'&&C.NODES[id].capital===f);
    Object.keys(C.NODES).forEach(id=>{if(C.ownerOf(s,id)===f)(s.world.nodes[id]=s.world.nodes[id]||{}).owner='crown'});C.wipeOut(s,f,'crown',false,cap)});
  S.advanceDay(s);GAME_SHELL.render();return s.world.location});
ok('the realm is one',await p.evaluate(()=>!!GAME_CAMPAIGN.union(GAME_SHELL.state())&&GAME_DATA.factions.realm.name==='Restored Throne'));
const col=await p.evaluate(()=>{const c=GAME_DATA.factions.realm.color,el=document.createElement('div');el.style.color=c;document.body.appendChild(el);const rgb=getComputedStyle(el).color;el.remove();
  const ns=[...document.querySelectorAll('.sh-map button.n')].filter(x=>!x.classList.contains('cur'));return {rgb,n:ns.length,hit:ns.filter(x=>x.style.borderColor===rgb).length}});
ok('places on the map wear the realm\'s colour',col.hit>0,JSON.stringify(col));
// the opening scene
await p.evaluate(l=>{GAME_CAMPAIGN.checkMoves(GAME_SHELL.state(),l);GAME_STORY_SCREENS.tick()},loc);await p.waitForTimeout(800);
let t=await text('#ss-sheet');
ok('the opening scene names the realm and its motto',/Restored Throne/.test(t)&&/One road, one law/.test(t),t.slice(0,600));
ok('it tells of a war won, not a Moot',/last of the old powers has fallen|last enemy banner/.test(t)&&!/Moot/.test(t));
ok('it offers the oath',/Swear to the new realm/.test(t));
await p.evaluate(()=>[...document.querySelectorAll('#ss-sheet button')].find(x=>/Swear to the new realm/.test(x.innerText)).click());await p.waitForTimeout(500);
t=await text('#ss-sheet');ok('swearing makes you a Sworn Sword of the Restored Throne',/Sworn Sword of the Restored Throne/.test(t),t.slice(0,400));
await closeAll();await p.waitForTimeout(300);
// the Factions tab
await p.evaluate(()=>[...document.querySelectorAll('#sh-col .sh-tabs button')].find(x=>/Factions/.test(x.innerText)).click());await p.waitForTimeout(400);
t=await text('#sh-col');
ok('the Factions tab says the realm is one, with its motto and ruler',/The realm is one: the Restored Throne/.test(t)&&/One road, one law/.test(t)&&/rules from Crown Keep/.test(t),t.slice(0,700));
ok('your rank is in the realm',/Sworn Sword/.test(t)&&/Restored Throne · rank 1 of 4/.test(t));
const cards=(t.split('(your people)')[1]||'').split(/How the realm sees you/i)[0];
ok('the absorbed factions are gone from the faction cards',/Restored Throne/.test(cards)&&!/Royal|Mercantile Syndicate|Ascendant Synod|Broken Banner/.test(cards),cards);
ok('no relation numbers are shown',!/-?0\.\d\d/.test(t));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?fails+' FAILED':'ALL PASS');await b.close();})();
