// Enemy count by tier and the party limit per map (design/party_slots_and_recruiting.md). Run: cd tests && LD=./real_ld.js node tfight.js
const w=require(process.env.LD||'./real_ld.js')();const C=w.GAME_CAMPAIGN,S=w.GAME_SAVE,D=w.GAME_DATA,LO=w.GAME_LOADOUT;let fails=0;
const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const mk=lv=>{const st=C.newGame({race:'human',name:'T'});st.roster.forEach(u=>{u.xp=LO.xpForLevel(lv);u.level=lv});return st};
const validBefore=C.validate();
D.maps.t_m3={heights:[[0]],rocks:[],spawns:{P:[[0,0],[1,0],[2,0]],E:[[0,1],[1,1],[2,1]]}};D.maps.t_m5={heights:[[0]],rocks:[],spawns:{P:[[0,0],[1,0],[2,0],[3,0],[4,0]],E:[[0,1],[1,1],[2,1],[3,1],[4,1]]}}; // test-only maps with few spawn tiles (every real map now holds 8)
const trio=[{primary:'squire',name:'Captain Test'},{primary:'scout'},{primary:'acolyte'}];
const mkEnc=(id,map,rec,extra)=>{C.ENCOUNTERS[id]=Object.assign({name:'x',map,rec,enemyFaction:'outlaws',enemies:trio.map(e=>Object.assign({},e)),reward:{xp:10,gold:10}},extra||{});return C.encounterBuilds(id)};
// map capacities
ok('mapCap is the smaller spawn list',C.mapCap('golden_reach')===8&&C.mapCap('t_m3')===3&&C.mapCap('t_m5')===5&&C.mapCap('nope')===3);
ok('tierFor 3/4/5/6',[1,10].every(l=>C.tierFor(l)===3)&&[11,20].every(l=>C.tierFor(l)===4)&&[21,30].every(l=>C.tierFor(l)===5)&&[31,60].every(l=>C.tierFor(l)===6));
// enemy count by recommended level, on a map with room (6)
for(const [lv,n] of [[1,3],[10,3],[11,4],[20,4],[21,5],[30,5],[31,6],[50,6]]){const r=mkEnc('t_'+lv,'golden_reach',lv);ok('a rec '+lv+' fight on a big map fields '+n+' (got '+r.builds.length+')',r.builds.length===n);}
// map room limits it
ok('a rec 40 fight on a 5-spawn map fields 5',mkEnc('t_a','t_m5',40).builds.length===5);
ok('a rec 40 fight on a 3-spawn map fields 3',mkEnc('t_b','t_m3',40).builds.length===3);
// the extras
{const r=mkEnc('t_c','golden_reach',31,{objective:{type:'leader',leader:0}});const names=r.builds.map(b=>b.name);
 ok('the named leader is not copied',names.filter(n=>n==='Captain Test').length<=1&&r.builds[0].name==='Captain Test'&&r.builds.slice(1).every(b=>b.name!=='Captain Test'));
 ok('extras copy the other enemies in turn (classes '+r.builds.map(b=>b.primary)+')',r.builds.length===6);
 ok('ids are unique e1..e6',new Set(r.builds.map(b=>b.id)).size===6&&r.builds[5].id==='e6');
 ok('every enemy has a kit and gear',r.builds.every(b=>Array.isArray(b.skills)&&b.skills.length&&b.gear));}
// flagged and special fights keep what they were written with
ok('a fight flagged small keeps 3',mkEnc('t_d','golden_reach',40,{small:true}).builds.length===3);
ok('an arena bout keeps 3',mkEnc('t_e','golden_reach',40,{arena:true}).builds.length===3);
{C.ENCOUNTERS.t_f={name:'x',map:'golden_reach',rec:40,enemyFaction:'outlaws',enemies:[{primary:'squire'},{primary:'scout'}],reward:{xp:1,gold:1}};ok('a fight written with 2 keeps 2',C.encounterBuilds('t_f').builds.length===2);}
// options
{C.ENCOUNTERS.t_g={name:'x',map:'golden_reach',rec:25,enemyFaction:'outlaws',options:[{id:'a',label:'A',enemies:trio.map(e=>({...e})),reward:{xp:1,gold:1}}],reward:{xp:1,gold:1}};ok('an option fight scales too',C.encounterBuilds('t_g','a').builds.length===5);}
// the written record is not changed
ok('the encounter record keeps its 3 enemies',C.ENCOUNTERS.t_c===undefined||C.ENCOUNTERS.t_c.enemies.length===3);
// every real encounter: enemies fit the map, no more than the tier, and below level 11 nothing changed
{let bad=[],n=0;for(const [id,e] of Object.entries(C.ENCOUNTERS)){if(id.startsWith('t_')||id==='wander')continue;const ids=e.options?e.options.map(o=>o.id):[undefined];for(const o of ids){const r=C.encounterBuilds(id,o);if(!r)continue;n++;const cap=C.mapCap(e.map),written=(e.options?e.options.find(x=>x.id===o):e).enemies.length;
   if(r.builds.length>cap&&written<=cap)bad.push(id+' over map '+r.builds.length+'/'+cap);if(r.builds.length>6)bad.push(id+' over 6');if((e.rec||1)<11&&r.builds.length!==written)bad.push(id+' changed below 11');
   if(!e.arena&&!e.small&&written===3&&(e.rec||1)>=11&&r.builds.length!==Math.min(C.tierFor(e.rec),cap))bad.push(id+' wrong count '+r.builds.length);}}
 ok('all '+n+' real encounters: fit the map, at most 6, unchanged below level 11, tier count above'+(bad.length?' ['+bad.slice(0,6)+']':''),bad.length===0);}
// the party limit
{const st=mk(5);ok('level 5: 3 on any map',C.partyLimit(st,'golden_reach')===3&&C.partyLimit(st,'t_m3')===3);
 const s11=mk(11);ok('level 11: 4 on a big map, 3 on a 3-spawn map',C.partyLimit(s11,'golden_reach')===4&&C.partyLimit(s11,'t_m3')===3);
 const s35=mk(35);ok('level 35: 6 on a big map, 5 on a 5-spawn map',C.partyLimit(s35,'golden_reach')===6&&C.partyLimit(s35,'t_m5')===5);
 ok('S.partySize is the tier now (the map limits it per fight)',S.partySize(s11)===4&&S.partySize(s35)===6&&S.partySize(st)===3);}
ok('C.validate is empty (checked before the test encounters are added)',validBefore.length===0);
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
