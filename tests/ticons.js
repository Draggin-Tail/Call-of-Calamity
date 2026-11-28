// Item icons (design/visual_pass.md V3): Glionox art packed in game/icons.png, one icon per item type tinted per tier, one per unique.
// Run: node serve.js &  then  NODE_PATH=$(npm root -g) node ticons.js   (SHOTS=dir to save screenshots)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8766/index.html');await p.waitForFunction(()=>window.GAME_DATA&&GAME_DATA.gear.gamblers_die,null,{timeout:15000}).catch(()=>{});await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const I=window.ITEM_ICON,g=GAME_DATA.gear,ids=Object.keys(g);
    const miss=ids.filter(id=>!I.has(id));
    const t1=I.url('iron_sword',2),t7=I.url('t7_iron_sword',2),ph=I.names&&document.createElement('canvas');
    return {n:ids.length,miss,diff:t1&&t7&&t1!==t7,uniq:ids.filter(id=>g[id].unique).every(id=>I.has(id)&&I.tier(id)===0)}});
  ok(r.miss.length===0,'every one of the '+r.n+' items has a packed icon'+(r.miss.length?' (missing: '+r.miss.slice(0,8).join(', ')+')':''));
  ok(r.diff,'a Starforged sword is tinted differently from an Iron one');
  ok(r.uniq,'every unique has its own icon and the gold unique frame');
  // shop rows show the icon
  await p.click('text=New campaign');await p.waitForTimeout(400);await p.click('button:has-text("Begin")',{force:true});await p.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await p.waitForTimeout(800);
  const shop=await p.evaluate(()=>{const C=GAME_CAMPAIGN,s=GAME_SHELL.state();s.world.flags.guide_off=1;
    const id=Object.keys(C.NODES).find(k=>{try{return C.discover(s,k),C.nodeServices(s,k).shop}catch(e){return false}});if(!id)return null;s.world.location=id;C.discover(s,id);GAME_SHELL.render();return id});
  ok(!!shop,'found a place with a shop ('+shop+')');
  if(shop){
    await p.evaluate(id=>document.querySelector('button.n[aria-label="'+GAME_CAMPAIGN.NODES[id].name+'"]').click(),shop);await p.waitForTimeout(400);
    await p.evaluate(()=>{const x=[...document.querySelectorAll('#sh-sheet button')].find(x=>/^Shop$/.test(x.innerText.trim()));x&&x.click()});await p.waitForTimeout(600);
    const rows=await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet .card .stv-slot img')].filter(i=>i.complete&&i.naturalWidth===32).length);
    ok(rows>=3,'shop rows show 32 px item icons ('+rows+')');
    if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/icons_shop.png'});
  }
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
  await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
