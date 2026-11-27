// Node ownership, phase 3d (design/node_ownership_and_land.md section 17): sieges. Stages by place type, one roll per stage a week apart,
// defenders thinning with each lost stage, a held stage breaking the siege, stepping in at a stage, the last stand against a leader,
// the capital rule (only when the faction holds nothing else), and the wipe-out (wars, alliances, talks, ranks, relations, joining).
// Run: cd tests && node t91.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, A = C.ATTACK;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const war = (st, a, b) => { C.relState(st).wars[[a, b].sort().join('|')] = { since: 1, by: a }; };
const own = (st, id, f) => { (st.world.nodes[id] = st.world.nodes[id] || {}).owner = f; };
const byType = (st, f, t) => Object.keys(C.NODES).find(id => C.ownerOf(st, id) === f && C.NODES[id].type === t && !C.NODES[id].hidden);
const siege = (st, by, on, target, from) => { const a = { n: 900 + Math.floor(Math.random() * 99), by, on, target, from, day: st.world.day, lands: st.world.day, stage: 0, stages: C.siegeStages(target) }; C.attackState(st).list.push(a); return a; };
const capOf = f => Object.keys(C.NODES).find(id => C.NODES[id].type === 'capital' && C.NODES[id].capital === f);

ok('the agreed stages: hamlet 1, village/market/town 2, castle 3, capital 4, a week apart',
  C.siegeStages(Object.keys(C.NODES).find(id => C.NODES[id].type === 'hamlet')) === 1 && C.siegeStages(Object.keys(C.NODES).find(id => C.NODES[id].type === 'village')) === 2 &&
  C.siegeStages(Object.keys(C.NODES).find(id => C.NODES[id].type === 'town')) === 2 && C.siegeStages(Object.keys(C.NODES).find(id => C.NODES[id].type === 'castle')) === 3 &&
  C.siegeStages(capOf('crown')) === 4 && A.siege.every === 7);
ok('roads and other small places fall in one stage', C.siegeStages(Object.keys(C.NODES).find(id => C.NODES[id].type === 'road')) === 1);

// ---- stages ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const T = byType(st, 'crown', 'castle'), L = byType(st, 'crown', 'town');
  own(st, T, 'broken_banner'); C.setGarrison(st, T, 6); C.setGarrison(st, L, 20); const a = siege(st, 'crown', 'broken_banner', T, L);
  ok('a new siege starts at its first stage, named', a.stage === 0 && C.stageName(a) === 'the walls');
  const r1 = C.attackSettle(st, a, 'attack');
  ok('winning a stage takes it, not the place: the siege goes on to the next a week later', !r1.taken && r1.won && a.stage === 1 && a.lands === st.world.day + 7 && C.ownerOf(st, T) === 'broken_banner' && C.attacks(st).includes(a));
  ok('the defenders lose men with the stage', C.garrison(st, T) === 4, C.garrison(st, T));
  ok('it is in the news', C.relState(st).news.some(n => n.text.includes('has taken the walls') && n.text.includes('The gate is next')));
  ok('the sheet shows the siege and its stage', C.nodeServices(st, T).attack.stage === 1 && C.nodeServices(st, T).attack.stageName === 'the gate' && C.nodeServices(st, T).attack.done.join() === 'the walls');
  C.attackSettle(st, a, 'attack'); const r3 = C.attackSettle(st, a, 'attack');
  ok('taking the last stage takes the place', r3.taken && C.ownerOf(st, T) === 'crown' && !C.attacks(st).includes(a)); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const T = byType(st, 'crown', 'town'), L = byType(st, 'crown', 'castle');
  own(st, T, 'broken_banner'); const a = siege(st, 'crown', 'broken_banner', T, L); C.attackSettle(st, a, 'attack');
  const r = C.attackSettle(st, a, 'hold');
  ok('a stage held breaks the siege', !r.won && !C.attacks(st).includes(a) && C.ownerOf(st, T) === 'broken_banner' && C.relState(st).news.some(n => n.text.includes('beat off') && n.text.includes('the hold-out'))); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const T = byType(st, 'crown', 'village'), L = byType(st, 'crown', 'castle');
  own(st, T, 'broken_banner'); C.setGarrison(st, L, 30); C.setGarrison(st, T, 1); const a = siege(st, 'crown', 'broken_banner', T, L); let n = 0;
  for (let i = 0; i < 30 && C.attacks(st).includes(a); i++) { st.world.day = a.lands; C.attackTick(st); n++; }
  ok('off-screen, each stage rolls in its turn (two for a village)', C.ownerOf(st, T) === 'crown' && n === 2, n); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown');
  ok('a launched attack knows its stages', a && a.stages === C.siegeStages(a.target) && a.stage === 0); }

// ---- stepping in at a stage, and the last stand ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const T = byType(st, 'crown', 'castle'), L = byType(st, 'crown', 'town');
  own(st, T, 'broken_banner'); const a = siege(st, 'crown', 'broken_banner', T, L); a.stage = 1; a.lands = st.world.day + 7; st.world.location = T;   // a fight takes time: keep the roll away
  const k = C.attackEncounter(st, T); ok('the fight is named for its stage', /: the gate$/.test(C.ENCOUNTERS[k].name), C.ENCOUNTERS[k].name);
  const out = C.applyEncounterResult(st, k, 'attack', { won: true, kills: [], survivors: [] });
  ok('a won fight decides that stage only', out.attack && out.attack.won && !out.attack.taken && a.stage === 2); }
{ const st = fresh(); const cap = capOf('broken_banner'); war(st, 'crown', 'broken_banner');
  Object.keys(C.NODES).forEach(id => { if (C.ownerOf(st, id) === 'broken_banner' && id !== cap) own(st, id, 'crown'); });
  const a = siege(st, 'crown', 'broken_banner', cap, Object.keys(C.NODES).find(id => C.ownerOf(st, id) === 'crown' && C.supplyNeighbours(cap).includes(id)) || 'crown_keep'); a.stage = 3; st.world.location = cap;
  const k = C.attackEncounter(st, cap), E = C.ENCOUNTERS[k], at = E.options.find(o => o.id === 'attack');
  ok('the last stand of a capital: the faction\'s leader and guards, leader marked', /the last stand/.test(E.name) && at.enemies[0].name === 'Captain Old Standard' && at.objective.type === 'leader', at.enemies.map(e => e.name).join());
  ok('...harder and better paid', E.rec >= 3); }

// ---- the capital rule ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const cap = capOf('broken_banner');
  ok('a capital is no target while its faction holds anything else', !C.attackTargetable(st, cap));
  Object.keys(C.NODES).forEach(id => { if (C.ownerOf(st, id) === 'broken_banner' && id !== cap) own(st, id, 'crown'); });
  ok('once it holds only its capital, the capital can be besieged', C.attackTargetable(st, cap));
  const hid = Object.keys(C.NODES).find(id => C.NODES[id].hidden && C.ownerOf(st, id) === 'crown'); if (hid) { own(st, hid, 'broken_banner');
    ok('a hidden place still counts as holding something', !C.attackTargetable(st, cap)); }
  ok('the Hearthwatch is never a target', !Object.keys(C.NODES).some(id => C.ownerOf(st, id) === 'hearthwatch' && C.attackTargetable(st, id))); }

// ---- wipe-out ----
{ const st = fresh(); const cap = capOf('broken_banner'); war(st, 'crown', 'broken_banner'); war(st, 'synod', 'broken_banner');
  const rs = C.relState(st); rs.allies.broken_banner = 'syndicate'; rs.allies.syndicate = 'broken_banner';
  S.joinRank(st, 'broken_banner', { force: true });
  Object.keys(C.NODES).forEach(id => { if (C.ownerOf(st, id) === 'broken_banner' && id !== cap) own(st, id, 'crown'); });
  let gearCall = null; const g0 = C.capitalGear; C.capitalGear = (s, f, by, helped) => { gearCall = { f, by, helped }; return null; };
  const other = siege(st, 'synod', 'broken_banner', cap, 'voldun'); const a = siege(st, 'crown', 'broken_banner', cap, 'crown_keep'); a.stage = 3;
  C.attackState(st).list = C.attackState(st).list.filter(x => x !== other).concat([Object.assign({}, other, { target: 'nowhere_' })]);
  const r = C.attackSettle(st, a, 'attack'); C.capitalGear = g0;
  ok('taking the last stand takes the capital and wipes the faction out', r.taken && r.fell && r.fell.faction === 'broken_banner' && C.fallen(st, 'broken_banner') && C.ownerOf(st, cap) === 'crown');
  ok('its wars and alliances end', !Object.keys(rs.wars).some(k => k.includes('broken_banner')) && !rs.allies.broken_banner && !rs.allies.syndicate);
  ok('attacks by it or on it end', !C.attacks(st).some(x => x.by === 'broken_banner' || x.on === 'broken_banner'));
  ok('a player sworn to it loses the rank', !S.sworn(st) && r.fell.rank);
  ok('no one can join it now', !S.canJoin(st, 'broken_banner', { force: true }).ok && !S.invitations(st).some(x => x.faction === 'broken_banner'));
  ok('the capital-gear hook is called with who took it and whether you helped', gearCall && gearCall.f === 'broken_banner' && gearCall.by === 'crown' && gearCall.helped === true);
  ok('it is in the news', rs.news.some(n => n.kind === 'fallen' && n.text.includes('is no more')));
  const v = C.relValue(st, 'crown', 'broken_banner'); for (let i = 0; i < 30; i++) { st.world.day++; C.relTick(st); }
  ok('it drops out of relations: no drift, no wars, not in the report', C.relValue(st, 'crown', 'broken_banner') === v && !Object.keys(rs.wars).some(k => k.includes('broken_banner')) && !C.relReport(st).pairs.some(p => p.a === 'broken_banner' || p.b === 'broken_banner') && C.relReport(st).fallen.includes('broken_banner')); }

// ---- saves and a long run ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st)[0]; delete a.stage; delete a.stages; st.world.day = a.lands;
  let e = null; try { C.attackTick(st); } catch (x) { e = x; } ok('an attack saved before sieges settles as a single stage', !e && !C.attacks(st).includes(a), e && e.message); }
{ let fell = 0, t = Date.now(); for (let g = 0; g < 4; g++) { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rng = (g * 7919 + 13) >>> 0; S.advanceDay(st, 400); fell += Object.keys(st.world.fallen || {}).length; }
  ok('400 days of real play run cleanly and stay cheap', Date.now() - t < 60000, (Date.now() - t) + ' ms, ' + fell + ' fallen'); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
