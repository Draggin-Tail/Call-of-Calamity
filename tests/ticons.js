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
    const rows=await p.evaluate(()=>[...document.querySelectorAll('#sh-sheet .card .stv-slot .ii')].filter(i=>/icons\.png/.test(getComputedStyle(i).backgroundImage)&&i.offsetWidth===32).length);
    ok(rows>=3,'shop rows show 32 px item icons ('+rows+')');
    if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/icons_shop.png'});
  }
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
  // as on iPhone Safari with the raw.githack preview: canvas export is refused. Icons and class portraits must still show the art.
  { const q=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const e2=[];q.on('pageerror',e=>e2.push(String(e)));
    await q.addInitScript(()=>{const d=CanvasRenderingContext2D.prototype.drawImage,t=HTMLCanvasElement.prototype.toDataURL;   // a canvas that drew an image file counts as tainted
      CanvasRenderingContext2D.prototype.drawImage=function(i,...a){if(i instanceof HTMLImageElement||(i&&i._taint))this.canvas._taint=1;return d.call(this,i,...a)};
      HTMLCanvasElement.prototype.toDataURL=function(...a){if(this._taint)throw new DOMException('The operation is insecure.','SecurityError');return t.apply(this,a)}});
    await q.goto('http://localhost:8766/index.html');await q.waitForTimeout(2500);
    await q.click('text=New campaign');await q.waitForTimeout(400);await q.click('button:has-text("Begin")',{force:true});await q.evaluate(()=>window.Battle&&Battle.skipScene&&Battle.skipScene());await q.waitForTimeout(800);
    const tabs=async re=>q.evaluate(src=>{const R=new RegExp(src);const x=[...document.querySelectorAll('#sh-col button,#sh-sheet button,#ss-sheet button')].find(x=>x.offsetParent&&R.test(x.innerText.trim()));if(x)x.click();return !!x},re.source);
    await q.evaluate(()=>{GAME_SHELL.state().world.flags.guide_off=1;GAME_SHELL.render()});await tabs(/^Close$/);await tabs(/^Onward$/);await q.waitForTimeout(300);await tabs(/^Roster$/);await q.waitForTimeout(300);
    await q.evaluate(()=>[...document.querySelectorAll('#sh-col .card')][0].click());await q.waitForTimeout(600);
    const s=await q.evaluate(()=>{const p=document.querySelector('#stv .stv-port');return {port:p&&p.getAttribute('src'),loaded:p&&p.complete&&p.naturalWidth>0,icons:[...document.querySelectorAll('#stv .stv-eq .stv-slot .ii')].filter(i=>/icons\.png/.test(getComputedStyle(i).backgroundImage)).length}});
    ok(/^portraits_gai\/\w+\.png$/.test(s.port||'')&&s.loaded,'canvas export refused: the Status portrait is the class art file ('+s.port+')');
    ok(s.icons>=3,'canvas export refused: equipment icons still come from icons.png ('+s.icons+')');
    if(process.env.SHOTS)await q.screenshot({path:process.env.SHOTS+'/icons_safari.png'});
    ok(e2.length===0,'canvas export refused: no page errors'+(e2.length?': '+e2[0]:''));await q.close(); }
  await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
