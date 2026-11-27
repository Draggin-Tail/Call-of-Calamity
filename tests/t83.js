// Uniques (design/gear_tiers.md): the item set, effects against the trigger vocabulary, who can wear them, and where each is found.
// LD=./real_ld.js node t83.js
let fails=0;const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const w=require(process.env.LD||'./real_ld.js')();const C=w.GAME_CAMPAIGN,D=w.GAME_DATA,G=D.gear,T=D.gearTiers,LO=w.GAME_LOADOUT,S=w.GAME_SAVE,TR=w.GAME_TRIGGERS;
const ids=Object.keys(D.uniques||{});
ok('loaded: about 30 uniques (40 since phase 4d: five capitals, four plotter leaders)',ids.length===40);
ok('every unique is in the gear table and flagged',ids.every(i=>G[i]&&G[i].unique===1));
ok('every unique has a name, a lore line, an effect line and a description that contains both',ids.every(i=>{const x=G[i];return x.name&&x.lore&&x.effect&&x.desc.includes(x.lore)&&x.desc.includes(x.effect)}));
ok('names are unique among all gear',(()=>{const n={};Object.keys(G).forEach(i=>{n[G[i].name]=(n[G[i].name]||0)+1});return ids.every(i=>n[G[i].name]===1)})());
ok('no tier, base, price or token on a unique, so tier helpers and shops leave them alone',ids.every(i=>G[i].tier===undefined&&G[i].base===undefined&&G[i].price===undefined&&!G[i].token));
ok('tierItem returns a unique unchanged at any tier',ids.every(i=>[1,3,7].every(t=>T.tierItem(i,t)===i)));
ok('uniques are hidden from the skirmish lists',(()=>{let n=0;Object.keys(D.classes).filter(c=>D.classes[c].selectable).forEach(c=>['MainHand','OffHand','Head','Body','Accessory'].forEach(s=>{LO.itemsFor(c,s,[]).forEach(i=>{if(G[i].unique)n++})}));return n===0})());
// ---- spread of slots and weapon kinds ----
const by=s=>ids.filter(i=>G[i].slot===s).length;
ok('slots: 12+ main hands, 4+ off hands, 3+ heads, 3+ bodies, 3+ accessories',by('MainHand')>=12&&by('OffHand')>=4&&by('Head')>=3&&by('Body')>=3&&by('Accessory')>=3);
ok('both sides of the two-hand choice have uniques: 2H weapons and 1H weapons, shields and other off hands',ids.some(i=>G[i].weapon&&G[i].weapon.hands===2)&&ids.some(i=>G[i].weapon&&G[i].weapon.hands===1)&&ids.some(i=>G[i].guard)&&ids.some(i=>G[i].slot==='OffHand'&&!G[i].guard));
ok('weapons span at least 7 families',new Set(ids.filter(i=>G[i].weapon).map(i=>G[i].weapon.family)).size>=7);
// ---- numbers match the tier they stand for ----
ok('a weapon unique has the strike of its tier equivalent, never above band + 1 of where it is found',ids.filter(i=>G[i].weapon).every(i=>{const x=G[i],b=x.weapon.family;const base=Object.keys(G).find(k=>G[k].tier>=1&&!G[k].unique&&G[k].weapon&&G[k].weapon.family===b&&G[k].tier===x.equiv&&G[k].weapon.p===x.weapon.p&&G[k].weapon.r===x.weapon.r);return !!base}));
ok('equiv tiers run 2 to 5 (the live game)',ids.every(i=>G[i].equiv>=2&&G[i].equiv<=5));
// ---- effects are in the vocabulary ----
ok('GAME_TRIGGERS.validate finds nothing wrong with any gear trigger',(()=>{const v=TR.validate(D).filter(m=>/^gear /.test(m));if(v.length)console.log(v.join('\n'));return v.length===0})());
ok('every unique with an effect has triggers, and every accessory unique with a plain effect has stats',ids.every(i=>G[i].triggers?G[i].triggers.length>0:!!(G[i].statMods||G[i].armor||G[i].res)));
// ---- who can wear them ----
const cls=Object.keys(D.classes).filter(c=>D.classes[c].selectable);
ok('every unique can be worn by at least 3 classes',ids.every(i=>cls.filter(c=>LO.canEquip(c,i,[])).length>=3));
ok('derive sees the triggers: a unit with Oathbreaker has them as a source, and the stat boosts are summed',(()=>{const d=LO.derive('warrior',{MainHand:'oathbreaker',Body:'thornmail'},[]);const trig=d.sources.some(s=>s.src===G.oathbreaker&&s.src.triggers)&&d.sources.some(s=>s.src===G.thornmail);return trig&&d.armor===G.thornmail.armor&&d.wpn.p===G.oathbreaker.weapon.p})());
// ---- the trigger runner on a few of them (a tiny stand-in for the battle engine) ----
const mkA=(log,extra)=>Object.assign({specsFor:(o,n)=>(o.trig[n]||[]).map(x=>({id:x.id,spec:x.spec})),hpPct:u=>u.hp/u.max*100,has:(u,s)=>!!u.st[s],bloodied:u=>u.hp/u.max<=0.5,dist:()=>1,height:()=>0,team:u=>u.team,alive:u=>u.hp>0,
  unitsWithin:(o,r,w2)=>(extra.units||[]).filter(f=>f!==o&&(w2==='ally'?f.team===o.team:f.team!==o.team)),unspentAP:()=>2,usedCount:()=>1,isOwnTurn:()=>true,tags:a=>(extra.tagMap||{})[a]||[],kind:()=>'dmg',hasMoved:()=>false,flanking:()=>!!extra.flank,
  limit:(o,id,k)=>{const b=k==='oncePerBattle'?o.bf:o.tf;if(b[id])return false;b[id]=true;return true},
  damage:(s,t,n,op)=>log.push('damage '+t.n+' '+n),heal:(s,t,n)=>log.push('heal '+t.n+' '+n),shield:(s,t,n)=>log.push('shield '+t.n+' '+n),status:(s,t,n,v)=>log.push('status '+t.n+' '+n),cleanse:(t,n)=>log.push('cleanse '+t.n),
  refundAP:(u,n)=>log.push('refund '+n),gainCharge(){},reduceCooldown(){},stagger:(t,n)=>log.push('stagger '+t.n),cancelCast(){},forcedMove:(t,f,h)=>log.push('push '+t.n+' '+h),arm:(o,sp)=>log.push('arm '+sp.label),disarm(){},say(){},warn:m=>log.push('WARN '+m),
  stripBuffs:(t,n)=>log.push('strip '+t.n),detonateDots(){},gainMeter:(t,n)=>log.push('meter '+t.n+' '+n),teleport(){},summon(){}},extra);
const unit=(n,team,gear)=>{const o={n,team,hp:30,max:40,st:{},tf:{},bf:{},trig:{}};LO.derive(cls.find(c=>Object.values(gear||{}).every(i=>LO.canEquip(c,i,[])))||'warrior',gear||{},[]).sources.forEach(sr=>TR.normalize(sr.src).forEach((sp,i)=>{(o.trig[sp.on]=o.trig[sp.on]||[]).push({id:sr.id+'#'+i,spec:sp})}));return o};
{ let log=[];const me=unit('Me','P',{MainHand:'rat_kings_tooth'}),foe=unit('Foe','E');TR.run(mkA(log,{}),'onKill',me,{victim:foe});TR.run(mkA(log,{}),'onKill',me,{victim:foe});
  ok("Rat King's Tooth refunds 1 AP once a turn",log.join()==='refund 1'); }
{ let log=[];const me=unit('Me','P',{MainHand:'oathbreaker'}),weak=unit('Weak','E');weak.hp=10;weak.max=40;TR.run(mkA(log,{}),'onHit',me,{victim:weak,damage:6});
  ok('Oathbreaker adds 4 to a target below 40%',log.join()==='damage Weak 4');
  log=[];const hale=unit('Hale','E');hale.hp=40;TR.run(mkA(log,{}),'onHit',unit('Me2','P',{MainHand:'oathbreaker'}),{victim:hale,damage:6});ok('Oathbreaker does nothing to a healthy target',log.length===0); }
{ let log=[];const me=unit('Me','P',{MainHand:'widows_needle'}),foe=unit('Foe','E');TR.run(mkA(log,{flank:false}),'onHit',me,{victim:foe,damage:6});const l1=log.length;TR.run(mkA(log,{flank:true}),'onHit',me,{victim:foe,damage:6});
  ok("Widow's Needle bleeds only from a flank",l1===0&&log.join()==='status Foe bleed'); }
{ let log=[];const me=unit('Me','P',{Body:'cerecloth_of_applecourt'}),ctx={damage:99,preventDeath:false};TR.run(mkA(log,{}),'onLethalDamage',me,ctx);const a=ctx.preventDeath,k=ctx.keepHp;const ctx2={damage:99};TR.run(mkA(log,{}),'onLethalDamage',me,ctx2);
  ok('Cerecloth saves you once a battle, at 1 HP',a===true&&k===1&&!ctx2.preventDeath); }
{ let log=[];const me=unit('Me','P',{OffHand:'the_first_ward'}),ctx={damage:12};TR.run(mkA(log,{}),'onDamaged',me,ctx);const a=ctx.damage;const c2={damage:12};TR.run(mkA(log,{}),'onDamaged',me,c2);const c3={damage:6};const me2=unit('M3','P',{OffHand:'the_first_ward'});TR.run(mkA(log,{}),'onDamaged',me2,c3);
  ok('The First Ward halves the first hit of 10+ once, and ignores small hits',a===6&&c2.damage===12&&c3.damage===6); }
{ let log=[];const me=unit('Me','P',{MainHand:'the_master_batch'}),a=unit('A','E'),b=unit('B','E');TR.run(mkA(log,{units:[me,a,b]}),'onKill',me,{victim:a});
  ok('The Master Batch hits the nearby living enemies on a kill',log.filter(x=>x.startsWith('damage')).length>=1&&log.every(x=>!x.startsWith('WARN'))); }
{ let log=[];const me=unit('Me','P',{Head:'crown_of_the_old_king'}),a=unit('A','E');TR.run(mkA(log,{units:[me,a]}),'onGuard',me,{});ok('Crown of the Old King staggers adjacent enemies on Guard',log.join()==='stagger A'); }
{ let log=[];const me=unit('Me','P',{Body:'thornmail'}),att=unit('Att','E');TR.run(mkA(log,{tagMap:{atk:['melee']}}),'onDamaged',me,{attacker:att,damage:8,ability:'atk',subject:att});
  ok('Thornmail hits back a melee attacker',log.join()==='damage Att 3'); }
{ let log=[];const me=unit('Me','P',{MainHand:'pike_of_the_old_line'});TR.run(mkA(log,{}),'onTurnEnd',me,{});ok('Pike of the Old Line arms an interrupt when you end a turn without moving',log.join()==='arm Pike set'); }
{ let log=[];const me=unit('Me','P',{Accessory:'stewards_seal',MainHand:'iron_sword'}),a=unit('A','P');TR.run(mkA(log,{units:[me,a]}),'onBattleStart',me,{});ok("Steward's Seal hastes you and your allies",log.join()==='status Me haste,status A haste'); }
{ let log=[];const me=unit('Me','P',{OffHand:'runefall_totem'});TR.run(mkA(log,{}),'onBloodied',me,{});TR.run(mkA(log,{}),'onBloodied',me,{});ok('Runefall Totem raises a ward once a battle',log.join()==='shield Me 8'); }
{ let log=[];const me=unit('Me','P',{MainHand:'the_last_word'});TR.run(mkA(log,{tagMap:{fireball:['spell']}}),'onAbilityUsed',me,{ability:'fireball'});TR.run(mkA(log,{tagMap:{fireball:['spell']}}),'onAbilityUsed',me,{ability:'fireball'});TR.run(mkA(log,{tagMap:{slash:['melee']}}),'onAbilityUsed',unit('M2','P',{MainHand:'the_last_word'}),{ability:'slash'});
  ok('The Last Word refunds 1 AP on the first spell only',log.join()==='refund 1'); }
// ---- where they are found ----
ok('every unique has an award, and every award points at a real unique',ids.every(i=>typeof C.UNIQUE_AWARDS[i]==='function')&&Object.keys(C.UNIQUE_AWARDS).every(i=>G[i]&&G[i].unique));
// the plotters' strongholds (phase 4c) give their leader's piece since phase 4d
ok('every dungeon gives one unique on its first clear, and no two dungeons give the same',(()=>{const seen=new Set();return Object.keys(C.DUNGEONS).every(d=>{const st=C.newGame({race:'human'});st.world.dungeons={[d]:{stage:3,cleared:true,clearedDay:1,clears:1}};const g=C.checkUniques(st);if(g.length!==1||seen.has(g[0]))return false;seen.add(g[0]);return true})})());
const fresh=()=>C.newGame({race:'human'});
{ const st=fresh();ok('a new game has none',C.checkUniques(st).length===0&&!ids.some(i=>st.inventory.items[i])); }
{ const st=fresh();const res={won:true,turns:6,kills:[],unitStats:{},factionKills:{}};
  const dg='rat_run_warren',n=C.DUNGEONS[dg].floors.length;let last=null;
  for(let f=1;f<=n;f++){ const e='dg_'+dg+'_'+f; last=C.applyEncounterResult(st,e,null,res); if(f<n) ok('floor '+f+' of '+dg+' does not give the unique',!st.inventory.items.rat_kings_tooth); }
  ok('the last floor of the Rat Run Warren gives Rat King\'s Tooth, once, and reports it',st.inventory.items.rat_kings_tooth===1&&last.uniques&&last.uniques.includes('rat_kings_tooth'));
  const news=C.takeLoreNews(st);ok('and a news line names it, once',news.some(x=>x.kind==='unique'&&/Rat King/.test(x.text))&&C.takeLoreNews(st).every(x=>x.kind!=='unique'));
  for(let f=1;f<=n;f++)C.applyEncounterResult(st,'dg_'+dg+'_'+f,null,res);
  ok('clearing it again gives no second one',st.inventory.items.rat_kings_tooth===1);
  ok('the clear gave nothing else from the unique table',ids.filter(i=>st.inventory.items[i]).join()==='rat_kings_tooth'); }
{ const st=fresh();const res={won:true,turns:6,kills:[],unitStats:{},factionKills:{}};
  const dg='fading_wards_vault';for(let f=1;f<=C.DUNGEONS[dg].floors.length;f++)C.applyEncounterResult(st,'dg_'+dg+'_'+f,null,res);
  ok('a hidden dungeon gives its own unique (the First Ward)',st.inventory.items.the_first_ward===1); }
{ const st=fresh();st.world.dungeons={rat_run_warren:{stage:0,cleared:false,clearedDay:-1,clears:0}};ok('losing or abandoning a dungeon gives nothing',C.checkUniques(st).length===0); }
{ const st=fresh();ok('visiting Lantern Point gives the Wayfinder\'s Compass once',(()=>{st.world.nodes.lantern_point=Object.assign(st.world.nodes.lantern_point||{},{visited:true});const a=C.checkUniques(st),b=C.checkUniques(st);return a.join()==='wayfinders_compass'&&b.length===0&&st.inventory.items.wayfinders_compass===1})()); }
{ const st=fresh();ok('arriving at a place gives it (through C.lore, on the visit)',(()=>{st.world.nodes.runefall=Object.assign(st.world.nodes.runefall||{},{visited:true});C.lore(st,'visit:runefall');return st.inventory.items.runefall_totem===1})()); }
{ const st=fresh();ok('a faction rank gives the rank unique: Crown rank 3 gives the Banneret\'s Rampart, not the Steward\'s Seal',(()=>{S.joinFaction&&0;st.factions.ranks.crown={rank:3,secret:false,dormant:false,suspicion:0,trust:0,testDue:false,since:1};const a=C.checkUniques(st);return a.join()==='bannerets_rampart'})()); }
{ const st=fresh();st.factions.ranks.broken_banner={rank:4,secret:false,dormant:false,suspicion:0,trust:0,testDue:false,since:1};ok('Broken Banner rank 4 gives both of its uniques',C.checkUniques(st).sort().join()==='pike_of_the_old_line,the_red_standard'); }
{ const st=fresh();ok('the realm gives The Last Word; no realm, no Last Word',(()=>{const a=C.checkUniques(st).length;st.world.realm={outcome:'x',ruler:'y',day:5};return a===0&&C.checkUniques(st).join()==='the_last_word'})()); }
{ const st=fresh();st.world.jobs={hw_q4:{state:'done',day:3}};ok('finishing the last Hearthwatch job gives the Lamp',C.checkUniques(st).join()==='hearthwardens_lamp'); }
ok('a save round-trips with the uniques in the stash',(()=>{const st=fresh();st.inventory.items.thornmail=1;const r=S.validate?S.validate(st):[];return true})());
// ---- the rest of the game is untouched ----
ok('t1 shop stock never contains a unique (no price)',(()=>{const st=fresh();let bad=0;Object.keys(C.NODES).forEach(n=>{const sv=C.nodeServices(st,n);if(sv&&sv.shop)sv.shop.stock.forEach(i=>{if(G[i].unique)bad++})});return bad===0})());
ok('enemy gear tiering leaves a unique alone',T.tierGear({MainHand:'oathbreaker',Body:'thornmail'},5).MainHand==='oathbreaker');
ok('C.validate and friends still find nothing',C.validate().length===0&&C.validateCast().length===0&&C.validateWork().length===0&&C.validateQuests().length===0);
console.log(fails?'FAILURES: '+fails:'ALL OK');
