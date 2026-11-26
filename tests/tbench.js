// Catch-up, bench and dispatch (design/party_slots_and_recruiting.md). Run: cd tests && LD=./real_ld.js node tbench.js
const w=require(process.env.LD||'./real_ld.js')();const C=w.GAME_CAMPAIGN,S=w.GAME_SAVE,D=w.GAME_DATA,LO=w.GAME_LOADOUT;let fails=0;
const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const mk=(lv)=>{const st=C.newGame({race:'dwarf',name:'T'});st.inventory.gold=1000;st.roster.forEach(u=>{u.xp=LO.xpForLevel(lv||1);u.level=lv||1});return st};
const withRecruit=(st,n)=>{const out=[];for(let i=0;i<n;i++){const r=S.recruit(st,'squire',{race:'dwarf'});out.push(r.unit)}return out};
const setLv=(u,lv)=>{u.xp=LO.xpForLevel(lv);u.level=lv};
// ---- catch-up ----
{const st=mk(11),[r]=withRecruit(st,1);ok('a level 1 recruit 10 levels behind gets the full +100% (cap)',Math.abs(S.catchUp(st,r)-2)<1e-9);
 setLv(st.roster[0],10);ok('9 levels behind: +90%',Math.abs(S.catchUp(st,r)-1.9)<1e-9);setLv(st.roster[0],11);setLv(r,1);
 setLv(r,6);ok('5 levels behind: +50%',Math.abs(S.catchUp(st,r)-1.5)<1e-9);setLv(r,11);ok('level with the leader: no bonus',S.catchUp(st,r)===1);setLv(r,14);ok('above the leader: no bonus',S.catchUp(st,r)===1);
 ok('the leader never gets it',S.catchUp(st,st.roster[0])===1);}
// ---- fielded units: the same battle pays a lower unit more ----
const won=(st,xpBase)=>{const stats={};st.party.forEach(id=>{stats[id]={uses:5,helps:0,kills:0,alive:true}});return S.applyBattleResult(st,{won:true,unitStats:stats,fallen:[],factionKills:{},kills:[],turns:5},{xp:xpBase||100,days:0})};
{const st=mk(10),[r]=withRecruit(st,1);setLv(r,1);st.party=[st.roster[0].id,r.id];const lead=st.roster[0];const r0=won(JSON.parse(JSON.stringify(st)));
 const a=r0.xpAwards.find(x=>x.unit===lead.id).gained,b=r0.xpAwards.find(x=>x.unit===r.id).gained;ok('a level 1 unit in a level 10 party gains 1.9 times the XP ('+a+' vs '+b+')',Math.abs(b-1.9*a)<=1);
 const ja=r0.jpAwards.find(x=>x.unit===lead.id).jp,jb=r0.jpAwards.find(x=>x.unit===r.id).jp;ok('...and 1.9 times the JP ('+ja+' vs '+jb+')',Math.abs(jb-1.9*ja)<=1);}
// ---- bench ----
{const st=mk(10),[a,b]=withRecruit(st,2);setLv(a,1);setLv(b,10);const lead=st.roster[0];const eq=st.roster.filter(u=>u!==a&&u!==b).map(u=>u.id);st.party=eq.slice();
 const jp0=S.jpOf(a,a.primary),jb0=S.jpOf(b,b.primary),x0=a.xp,xb0=b.xp;const r=won(st);
 const fieldedJP=r.jpAwards.find(x=>x.unit===lead.id).jp,fieldedXP=r.xpAwards.find(x=>x.unit===lead.id).gained;
 const gotJP=S.jpOf(a,a.primary)-jp0,gotXP=a.xp-x0,gotJPb=S.jpOf(b,b.primary)-jb0,gotXPb=b.xp-xb0;
 ok('the bench is reported',r.benchAwards.length===2);
 ok('a level-10 benched unit earns about 35% of a fielded unit JP and XP ('+gotJPb+'/'+fieldedJP+', '+gotXPb+'/'+fieldedXP+')',Math.abs(gotJPb-0.35*fieldedJP)<=2&&Math.abs(gotXPb-0.35*fieldedXP)<=2);
 ok('a level-1 benched unit earns that with catch-up (about 67%), still less than fighting ('+gotJP+', '+gotXP+')',Math.abs(gotJP-0.665*fieldedJP)<=3&&gotJP<fieldedJP&&gotXP<fieldedXP);
 ok('JP goes into the current main class',(()=>{const u=b;return S.jpOf(u,u.primary)===jb0+gotJPb})());
 // class change: JP follows the new class
 const c0=S.jpOf(b,'archer');b.primary='scout';const j0=S.jpOf(b,'scout');won(st);ok('after a class change the bench JP goes to the new class',S.jpOf(b,'scout')>j0&&S.jpOf(b,'archer')===c0);}
// bench on a loss: JP yes, no XP
{const st=mk(5),[a]=withRecruit(st,1);const stats={};st.party.forEach(id=>{stats[id]={uses:5,helps:0,kills:0,alive:true}});const x0=a.xp;const r=S.applyBattleResult(st,{won:false,unitStats:stats,fallen:[],factionKills:{},kills:[],turns:5},{xp:100,days:0});
 ok('a lost battle gives the bench JP but no XP',r.benchAwards[0].xp===0&&a.xp===x0&&r.benchAwards[0].jp>=0);}
// ---- dispatch ----
{const st=mk(10),[a,b,c,d]=withRecruit(st,4);setLv(a,1);setLv(b,1);setLv(c,1);setLv(d,1);const lead=st.roster[0];
 ok('the leader cannot be sent',!S.dispatchSend(st,lead.id,'patrol').ok);
 const r=S.dispatchSend(st,a.id,'patrol');ok('a unit can be sent on a patrol, ends 3 days later',r.ok&&r.entry.end===st.world.day+3);
 ok('they are away',S.isAway(st,a.id)&&!S.setParty(st,[a.id]).ok);
 ok('a sent unit in the party is taken out of it',(()=>{st.party=[lead.id,b.id];S.dispatchSend(st,b.id,'escort');return !st.party.includes(b.id)&&st.party.length===1})());
 ok('the same unit cannot be sent twice',!S.dispatchSend(st,a.id,'patrol').ok);
 ok('the third goes, the fourth is refused (max '+S.RULES.dispatch.maxOut+')',S.dispatchSend(st,c.id,'expedition').ok&&!S.dispatchSend(st,d.id,'patrol').ok);
 ok('nothing is ready yet',S.dispatchReady(st).length===0&&S.dispatchCollect(st).length===0);
 const gold0=st.inventory.gold,xa=a.xp,ja=S.jpOf(a,a.primary);const rw=r.entry.reward;
 st.world.day+=3;const got=S.dispatchCollect(st);ok('after 3 days the patrol returns and pays',got.length===1&&got[0].unit===a.id&&a.xp===xa+rw.xp&&S.jpOf(a,a.primary)===ja+rw.jp&&st.inventory.gold===gold0+rw.gold);
 ok('...and they are free again',!S.isAway(st,a.id)&&S.setParty(st,[lead.id,a.id]).ok);
 st.world.day+=10;ok('the others come back later',S.dispatchCollect(st).length===2&&S.dispatchState(st).out.length===0);}
// reward sizes: a dispatch pays below fighting, longer pays more per day
{const st=mk(10),[a]=withRecruit(st,1);setLv(a,10);const R=k=>S.dispatchReward(st,a,k);const K=S.RULES.dispatch.kinds;
 ok('longer errands pay more in total and more per day',R('patrol').xp<R('escort').xp&&R('escort').xp<R('expedition').xp&&R('patrol').xp/K.patrol.days<R('expedition').xp/K.expedition.days);
 ok('a patrol is worth under one fight (XP '+R('patrol').xp+' vs a level 10 fight '+(30+12*10)+', gold '+R('patrol').gold+' vs '+Math.round(C.goldFor(10))+')',R('patrol').xp<30+12*10&&R('patrol').gold<C.goldFor(10));
 ok('per day an expedition is still below one fight a day',R('expedition').xp/K.expedition.days<30+12*10&&R('expedition').gold/K.expedition.days<C.goldFor(10));}
// ---- saves ----
{const st=mk(10),[a,b]=withRecruit(st,2);S.dispatchSend(st,a.id,'escort');const rp=S.repair(JSON.parse(JSON.stringify(st))).state;
 ok('dispatch survives repair',rp.dispatch.out.length===1&&rp.dispatch.out[0].unit===a.id&&rp.dispatch.out[0].reward.xp===st.dispatch.out[0].reward.xp);
 const bad=JSON.parse(JSON.stringify(st));bad.dispatch.out.push({unit:'ghost',kind:'patrol',start:0,end:3,reward:{}},{unit:b.id,kind:'nonsense',start:0,end:3,reward:{}},{unit:a.id,kind:'patrol',start:0,end:3,reward:{}});
 ok('repair drops ghosts, bad kinds and duplicates',S.repair(bad).state.dispatch.out.length===1);
 const old=JSON.parse(JSON.stringify(st));delete old.dispatch;const ro=S.repair(old).state;ok('an old save without dispatch repairs to none',ro.dispatch.out.length===0&&S.validate(ro).length===0);
 const away=JSON.parse(JSON.stringify(st));away.party.push(a.id);ok('repair takes an away unit out of the party',!S.repair(away).state.party.includes(a.id));}
// ---- nothing left to learn ----
{const st=mk(10),[a]=withRecruit(st,1);ok('a fresh unit has things to learn',!S.nothingLeft(a));
 const cls=a.primary;a.learned[cls]=D.classes[cls].ab.slice();a.passivesKnown=Array.from(new Set([...a.passivesKnown,...((D.passiveLists||{})[cls]||[])]));ok('with every skill and passive known there is nothing left',S.nothingLeft(a));
 a.passivesKnown=a.passivesKnown.filter(p=>!(((D.passiveLists||{})[cls]||[]).includes(p)));ok('an unlearned passive means there is still something',((D.passiveLists||{})[cls]||[]).length===0||!S.nothingLeft(a));}
// ---- data checks ----
ok('C.validate is empty',C.validate().length===0);
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
