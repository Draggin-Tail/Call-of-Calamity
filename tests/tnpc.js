// Named NPC portraits (design/visual_pass.md): busts in game/portraits/npc/, matched on the name, shown in battles, scenes and on story cards.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node tnpc.js   (SHOTS=dir to save screenshots)
const {chromium}=require('playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const IDS=['voss','harrow','osric','corisande','ilvane','thorne','crane','agathe','old_standard','hask','wil','brielle','harte','teodor','marsh','vell','rook','kit','nell','tobin','aldo','aldric','corley','maren','tobb','wen','dov','ysolde'];
(async()=>{
  ok(IDS.every(k=>fs.existsSync(__dirname+'/../game/portraits/npc/'+k+'.png')),'all 28 busts are in game/portraits/npc/');
  const b=await chromium.launch();
  for(const [w,h,o] of [[390,664,'portrait'],[780,350,'landscape']]){
    const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
    if(o==='portrait'){
      const m=await p.evaluate(()=>({voss:PORT.npcSrc('Lord Marshal Voss'),os:PORT.npcSrc('Captain Old Standard'),th:PORT.npcSrc('Brannoc Thorne'),wil:PORT.npcSrc('Wil Fenn'),tobb:PORT.npcSrc('Tobb the Pedlar'),
        farms:PORT.npcSrc('Harrow Farms'),steward:PORT.npcSrc('Steward Harrow'),nobody:PORT.npcSrc('Raider Bowman'),will:PORT.npcSrc('Willow'),ald:PORT.npcSrc('Aldric'),nov:PORT.npcSrc('Novice Aldric')}));
      ok(/voss\.png$/.test(m.voss)&&/old_standard\.png$/.test(m.os)&&/thorne\.png$/.test(m.th)&&/wil\.png$/.test(m.wil)&&/tobb\.png$/.test(m.tobb),'names find their bust ('+[m.voss,m.os,m.th,m.wil,m.tobb].join(' ')+')');
      ok(!m.farms&&!m.ald&&/aldric\.png$/.test(m.nov)&&/harrow\.png$/.test(m.steward)&&!m.nobody&&!m.will,'places and ordinary units do not, nor a recruit called Aldric ('+[m.farms,m.nobody,m.will]+')');
      // a battle unit named for an NPC shows the bust once it has loaded; an ordinary unit keeps the drawn face
      const same=await p.evaluate(async()=>{PORT.canvas({name:'Captain Old Standard',primary:'warlord'},'E');await new Promise(r=>setTimeout(r,600));
        const a=PORT.canvas({name:'Captain Old Standard',primary:'warlord'},'E'),c=PORT.canvas({name:'Raider',primary:'warlord'},'E');
        const px=cv=>Array.from(cv.getContext('2d').getImageData(60,60,4,4).data).join();return {npc:a.width,diff:px(a)!==px(c)}});
      ok(same.npc===132&&same.diff,'a unit named Captain Old Standard gets his bust, not the Warlord face');
    }
    // a scene with Voss speaking: the dialogue box shows his bust
    await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(800);
    await p.evaluate(()=>{const s=GAME_SHELL.state();s.world.flags.guide_off=1;GAME_SHELL.playScene({id:'t',map:'road_plains_b',place:'Kingsway Cross',time:'Dusk',
      cast:[{id:'v',name:'Lord Marshal Voss',primary:'warlord',team:'E',at:[5,6],face:'down'},{id:'a',name:'Mother Agathe',primary:'cleric',team:'E',at:[6,7],face:'left'}],
      steps:[{say:'v',text:'Marrow Ford. I know what they say about me.'},{say:'a',text:'Then sit, and say it yourself.'}]})});
    await p.waitForTimeout(1500);
    const sc=await p.evaluate(()=>{const i=document.querySelector('#scn img');return i?{src:i.src.slice(0,40),w:i.naturalWidth}:null});
    const want=await p.evaluate(()=>[PORT.url({name:'Lord Marshal Voss',primary:'warlord'},'E'),PORT.url({name:'Raider',primary:'warlord'},'E')]);
    const full=await p.evaluate(()=>{const i=document.querySelector('#scn img');return i?i.src:''});
    ok((full===want[0]||full.endsWith('/'+want[0]))&&want[0]!==want[1],'the scene box shows Voss\'s bust, not a drawn Warlord face');
    if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/npc_scene_'+o+'.png'});
    await p.evaluate(()=>Battle.skipScene());await p.waitForTimeout(800);
    ok(!errs.length,o+': no page errors '+errs.join(' | '));
    await p.close();
  }
  // a place sheet with Tobb: the card shows his bust beside the name
  { const p=await b.newPage({viewport:{width:390,height:664},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(2500);
    await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(800);
    const clickT=async(sel,t)=>{await p.evaluate(([sel,t])=>{const x=[...document.querySelectorAll(sel)].find(x=>x.innerText.trim()===t&&x.offsetParent);x&&x.click()},[sel,t]);await p.waitForTimeout(400)};
    await clickT('#sh-sheet button','Close');await clickT('#ss-sheet button','Onward');
    const at=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;
      for(let d=0;d<30;d++){const n=Object.keys(C.NODES).find(id=>C.npcAt(s,id).some(x=>x.id==='tobb'));if(n){s.world.location=n;C.discover(s,n);GAME_SHELL.render();return n}s.world.day++}return null});
    ok(!!at,'Tobb is somewhere on his route ('+at+')');
    await clickT('#sh-col button','Map');
    await p.evaluate(at=>{const n=GAME_CAMPAIGN.NODES[at];const b=document.querySelector('button.n[aria-label="'+n.name+'"]');b&&b.click()},at);await p.waitForTimeout(600);
    const card=await p.evaluate(()=>{const i=[...document.querySelectorAll('#sh-sheet img')].find(x=>/npc\/tobb\.png/.test(x.src));return i?{w:i.getBoundingClientRect().width,loaded:i.complete&&i.naturalWidth>0}:null});
    ok(card&&card.w>=40&&card.loaded,'Tobb\'s card on the place sheet shows his bust ('+JSON.stringify(card)+')');
    if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/npc_card.png'});
    ok(!errs.length,'place sheet: no page errors '+errs.join(' | '));await p.close() }
  await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
