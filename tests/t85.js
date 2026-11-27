// Node ownership, phase 1 (design/node_ownership_and_land.md): one human land, an owner on every place, patrols and gates by owner.
// Run: cd tests && node t85.js | grep -v ^PASS
let fails = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const fs = require('fs'), path = require('path');
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, D = w.GAME_DATA, N = C.NODES;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; return st; };
const AREAS = ['crownlands', 'free_marches', 'river_cities', 'voldun'];
// ---- one human land ----
ok('the four human territories are one region, "human"', !!C.REGIONS.human && AREAS.every(a => !C.REGIONS[a] && !C.TERRITORIES[a] && C.AREAS[a]));
ok('every human place is in it and keeps its old territory as its area', Object.values(N).filter(n => n.region === 'human').every(n => AREAS.includes(n.area)) && Object.values(N).filter(n => n.area).every(n => n.region === 'human'));
ok('no territory still names an old human territory as a neighbour', Object.values(C.TERRITORIES).every(t => t.next.every(r => C.TERRITORIES[r])));
ok('the human land has its own picture (a crop of the world map)', fs.existsSync(path.join(__dirname, '..', 'game', C.TERRITORIES.human.img)));
ok('places made from a parent (dungeons, the Rookwood Barn) carry its area', Object.values(N).filter(n => n.dungeon && n.region === 'human').every(n => n.area));
ok('areas keep their danger: a Marches place is danger 3, a Crownlands town 1', C.landDanger('wayfarers_rest') === 3 && C.landDanger('crown_keep') === 1);
ok('areas keep their battle terrain: a fight at Vol\'Dun is on a ruins map', (() => { const st = fresh(); const m = C.mapFor(st, 'human', 'voldun'); return D.maps[m].pool === 'ruins'; })());
ok('area names still read for old wander records', C.landName('crownlands') === 'Crownlands' && C.landName('human') === C.REGIONS.human.name);
// ---- an owner on every place ----
{ const st = fresh(), bad = Object.keys(N).filter(id => !C.isOwnerId(C.ownerOf(st, id)));
  ok('every place has a valid owner (' + Object.keys(N).length + ' places)', bad.length === 0, bad.join()); }
{ const st = fresh(), o = id => C.ownerOf(st, id);
  ok('human areas start with their holder: Crown Keep crown, Gildhaven syndicate, Vol\'Dun synod', o('crown_keep') === 'crown' && o('river_cities') === 'syndicate' && o('voldun') === 'synod');
  const M = Object.keys(N).filter(id => N[id].area === 'free_marches' && !N[id].dungeon && !['broken_banner', 'hearthwatch'].includes(o(id)));
  ok('the Marches: towns, villages, hamlets and castles are Crown', M.filter(id => ['town', 'village', 'hamlet', 'castle'].includes(N[id].type)).every(id => o(id) === 'crown'));
  ok('the Marches: zones, roads and other open places are unclaimed', M.filter(id => ['zone', 'road'].includes(N[id].type)).every(id => o(id) === 'neutral') && o('bandit_ford') === 'neutral');
  ok('the Banner holds its three camps plus Gullsong and the Lowmeadows', ['outlaws_rest', 'widows_barrow', 'heron_hide', 'gullsong', 'lowmeadows'].every(id => o(id) === 'broken_banner'));
  ok('Banner land is joined up: every Banner place links to another', ['outlaws_rest', 'widows_barrow', 'heron_hide', 'gullsong', 'lowmeadows'].every(id => Object.keys(N[id].links).some(l => o(l) === 'broken_banner')));
  ok('exceptions kept: Syndicate enclaves in orc land, Hearthwatch chapels', o('greywater_landing') === 'syndicate' && o('stilt_market') === 'syndicate' && o('hearthstone_priory') === 'hearthwatch' && o('drowned_chapel') === 'hearthwatch' && o('millstream') === 'hearthwatch');
  ok('dungeons belong to what lives in them: beasts are monsters, the Vats Bilge Rats, the Undercity Synod', o('rat_run_warren') === 'monsters' && o('bubbling_vats_undercellar') === 'bilge_rats' && o('voldun_undercity') === 'synod');
  ok('outside the human land an unnamed place takes the land\'s faction (roads included)', Object.keys(N).filter(id => N[id].region !== 'human' && !N[id].dungeon && !N[id].owner).every(id => o(id) === (C.REGIONS[N[id].region].faction || 'neutral')));
  ok('factionOwner is null for unclaimed, monster and player ground', C.factionOwner(st, 'bandit_ford') === null && C.factionOwner(st, 'rat_run_warren') === null && C.factionOwner(st, 'crown_keep') === 'crown'); }
{ const st = fresh(); (st.world.nodes.thornfield = st.world.nodes.thornfield || {}).owner = 'player'; (st.world.nodes.wayfarers_rest = st.world.nodes.wayfarers_rest || {}).owner = 'outlaws';
  ok('the save still overrides: the Kingmaker hold is the player\'s, a besieged town the outlaws\'', C.ownerOf(st, 'thornfield') === 'player' && C.ownerOf(st, 'wayfarers_rest') === 'outlaws' && C.nodeServices(st, 'wayfarers_rest').besieged); }
{ const st = fresh(); let okS = true; Object.keys(N).forEach(id => { try { C.nodeServices(st, id); } catch (e) { okS = false; console.log('  ' + id + ': ' + e.message); } });
  ok('services work at every place, owned or not', okS);
  ok('an unclaimed place opens at neutral prices', C.nodeServices(st, 'bandit_ford').tier === 'neutral'); }
// ---- patrols and checkpoints by owner ----
{ const st0 = fresh(), held = Object.keys(N).find(id => N[id].type === 'road' && C.ownerOf(st0, id) === 'crown' && Object.keys(N[id].links).some(l => C.ownerOf(st0, l) !== 'crown'));
  const outside = Object.keys(N[held].links).find(l => C.ownerOf(st0, l) !== 'crown'), inside = Object.keys(N[held].links).find(l => C.ownerOf(st0, l) === 'crown');
  const roll = (from, to) => { const st = fresh(); st.factions.standing.crown = -600; st.world.pass = {}; st.world.calm = 0; st.world.location = from; Object.keys(N).forEach(k => { st.world.flags['gate_' + k] = 1; }); return C.rollWander(st, from, to, 1); };
  ok('found a Crown road with a way in (' + held + ' from ' + outside + ')', !!held && !!outside);
  const r = roll(outside, held); ok('stepping onto a hostile faction\'s road stops you at a checkpoint', r && r.kind === 'checkpoint' && r.faction === 'crown');
  if (inside) { let seen = 0; for (let i = 0; i < 30; i++) { const x = roll(inside, held); if (x && x.kind === 'checkpoint') seen++; } ok('moving along its own roads does not', seen === 0); } }
{ const hits = road => { let pat = 0; for (let i = 0; i < 150; i++) { const st = fresh(); Object.keys(D.factions).forEach(f => st.factions.standing[f] = -600); st.world.pass = {}; st.world.calm = 9; st.world.day = 2 + i * 7; Object.keys(N).forEach(k => { st.world.flags['gate_' + k] = 1; });
    const from = Object.keys(N[road].links)[0]; st.world.location = from; const x = C.rollWander(st, from, road, 1); if (x && (x.kind === 'checkpoint' || x.faction)) pat++; } return pat; };
  const st0 = fresh(), free = Object.keys(N).find(id => N[id].type === 'road' && N[id].area === 'free_marches'), held = Object.keys(N).find(id => N[id].type === 'road' && C.ownerOf(st0, id) === 'synod');
  const a = hits(held), b = hits(free);
  ok('a hostile faction\'s road (' + held + ') does raise patrols or checkpoints (' + a + ' of 150)', a > 0);
  ok('unclaimed ground (' + free + ') has none, even when everyone hates you', b === 0); }
// ---- gates ----
{ const st = fresh(), pairs = C.EDGES.filter(([a, b]) => N[a].region === 'human' && N[b].region === 'human' && N[a].area !== N[b].area);
  ok('roads still join the old human areas (' + pairs.length + ')', pairs.length > 0);
  ok('no border gate inside the human land', pairs.every(([a, b]) => !C.gateAt(st, a, b) && !C.gateAt(st, b, a)));
  const out = C.EDGES.find(([a, b]) => N[a].region === 'human' && N[b].region !== 'human' && N[b].region !== 'scorched_desolation');
  ok('the border out of the human land still has its gate', !!out && !!C.gateAt(st, out[0], out[1])); }
// ---- saves ----
{ const st = fresh(); st.world.wander = { kind: 'event', region: 'crownlands', from: 'crown_keep', to: 'thornfield', day: 1, text: 'x' }; st.world.flags.gate_fallow_gate = 3; (st.world.nodes.kings_mile = st.world.nodes.kings_mile || {}).owner = 'synod';
  const r = S.repair(JSON.parse(JSON.stringify(st))); ok('a save from before the merge repairs cleanly and keeps its owners', r.state && S.validate(r.state).length === 0 && C.ownerOf(r.state, 'kings_mile') === 'synod'); }
// ---- data ----
ok('C.validate finds nothing', C.validate().length === 0);
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
