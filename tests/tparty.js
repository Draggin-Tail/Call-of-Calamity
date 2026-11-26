// Recruiting and fight size (design/party_slots_and_recruiting.md). Run: cd tests && LD=./real_ld.js node tparty.js
const w=require(process.env.LD||'./real_ld.js')();const C=w.GAME_CAMPAIGN,S=w.GAME_SAVE,D=w.GAME_DATA;let fails=0;
const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const mk=(race,gold)=>{const st=C.newGame({race,name:'T'});st.inventory.gold=gold===undefined?5000:gold;return st};
// recruit nodes and their races
const nodes=Object.keys(C.NODES).filter(k=>C.NODES[k].recruit);
ok('there are recruit nodes ('+nodes.length+')',nodes.length>=8);
const want={deepdelve:'dwarf',ironforge:'dwarf',sylvan_watch:'wood_elf',crown_keep:'human',wayfarers_rest:'human',river_cities:'human',voldun:'human',hobbs_reach:'human',stilt_market:null}; // Stilt Market sits in the orc lands, so nobody is hired there while orcs are off
ok('every recruit node maps to the race of its region',nodes.every(k=>k in want&&C.recruitRace(k)===want[k]));
// inactive races give nothing
ok('a node in a region of an inactive race recruits nobody',C.recruitRace('hollow_deep')==='dwarf'&&!C.recruitRace('__none__'));
{const save=D.races.dwarf.active;D.races.dwarf.active=false;ok('switching a race off closes its recruiting',C.recruitRace('deepdelve')===null);D.races.dwarf.active=save;}
// standing: only Hostile closes
for(const [node,fac] of [['deepdelve','ironbound'],['crown_keep','crown'],['sylvan_watch','canopy'],['voldun','synod'],['river_cities','syndicate']]){
 const st=mk('human');C.discover(st,node);
 for(const [v,open] of [[-600,false],[-250,true],[0,true],[250,true],[700,true]]){st.factions.standing[fac]=v;const sv=C.nodeServices(st,node);
  ok(node+' at '+v+(open?' recruits':' is closed'),open?!!(sv.recruit&&sv.recruit.race===want[node]):!sv.recruit);}}
{const st=mk('human');st.factions.standing.crown=0;const sv=C.nodeServices(st,'wayfarers_rest');ok('an unowned town always recruits',!!sv.recruit);}
// the recruit
{const st=mk('human');const lead=st.roster[0];lead.level=12;const c0=S.recruitCost(st);const r=S.recruit(st,'squire',{race:'dwarf'});
 ok('recruit is level 1, blank, of the asked race',r.ok&&r.unit.level===1&&r.unit.race==='dwarf'&&r.unit.primary==='squire'&&st.roster.length===4);
 ok('recruit cost is the flat base times the gold economy multiplier, not the party level',c0===Math.round(S.RULES.recruitCost*C.costMult(st))&&(()=>{lead.level=30;return S.recruitCost(st)===Math.round(S.RULES.recruitCost*C.costMult(st))})());
 ok('gold is charged',st.inventory.gold===5000-r.cost&&r.cost===c0);
 const r2=S.recruit(st,'wizard',{race:'dwarf'});ok('only entry classes',!r2.ok);
 const full=mk('human');while(full.roster.length<S.RULES.rosterCap)S.recruit(full,'scout',{race:'wood_elf'});ok('roster fills to the cap ('+S.RULES.rosterCap+') then refuses',full.roster.length===S.RULES.rosterCap&&!S.recruit(full,'scout',{race:'wood_elf'}).ok);
 const poor=mk('human',10);ok('too poor refuses',!S.recruit(poor,'scout',{race:'human'}).ok);}
{const st=mk('dwarf');const a=S.recruit(st,'scout',{race:'wood_elf'}),b=S.recruit(st,'scout',{race:'wood_elf'});ok('names come from the recruit race list, no duplicates',a.ok&&b.ok&&D.races.wood_elf.names.includes(a.unit.name)&&a.unit.name!==b.unit.name);}
// fight size
{const st=mk('human');const L=st.roster[0];const size=lv=>{L.level=lv;return S.fightTier(st)};
 ok('tiers 3 / 4 / 5 / 6 at levels 1-10, 11-20, 21-30, 31+',[1,10].every(l=>size(l)===3)&&[11,20].every(l=>size(l)===4)&&[21,30].every(l=>size(l)===5)&&[31,50].every(l=>size(l)===6));
 L.level=40;ok('the party is held to the map spawn cap ('+S.RULES.mapSpawnCap+') for now',S.partySize(st)===Math.min(6,S.RULES.mapSpawnCap));
 const save=S.RULES.mapSpawnCap;S.RULES.mapSpawnCap=6;for(let i=0;i<3;i++)S.recruit(st,'squire',{race:'human'});
 L.level=5;ok('level 5 limits the party to 3',!S.setParty(st,st.roster.slice(0,4).map(u=>u.id)).ok&&S.setParty(st,st.roster.slice(0,3).map(u=>u.id)).ok);
 L.level=11;ok('level 11 allows 4 and not 5',S.setParty(st,st.roster.slice(0,4).map(u=>u.id)).ok&&!S.setParty(st,st.roster.slice(0,5).map(u=>u.id)).ok);
 S.RULES.mapSpawnCap=save;}
// data checks
ok('C.validate is empty',C.validate().length===0);
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
