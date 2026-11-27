// Node ownership, phase 3b (design/node_ownership_and_land.md section 4): garrisons, supply paths to the capital, and what isolation does
// (shops thin at 10 days, garrisons shrink from 20, the place may defect from 30, to whoever cut it off).
// Run: cd tests && node t89.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, P = C.SUPPLY;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const war = (st, a, b) => { C.relState(st).wars[[a, b].sort().join('|')] = { since: 1, by: a }; };
const own = (st, id, f) => { (st.world.nodes[id] = st.world.nodes[id] || {}).owner = f; };
const surround = (st, id, f) => C.supplyNeighbours(id).forEach(y => own(st, y, f));
const ticks = (st, n) => { for (let i = 0; i < n; i++) { st.world.day++; C.supplyTick(st); } };
const T = 'wayfarers_rest';   // a Crown town in the Marches with a shop

ok('data checks pass', C.validateSupply().length === 0, C.validateSupply().join('; '));
ok('garrison bases follow the agreed table', C.garrisonBase('crown_keep') === 10 && C.garrisonBase(T) === 4 && C.garrisonBase('hobbs_reach') === 3 && C.garrisonBase('greywatch_post') === 6
  && C.garrisonBase('free_marches') === 1 && C.garrisonBase('wardens_lodge') === 7);
ok('garrisons read as words, never numbers', ['thin', 'held', 'held', 'held', 'strong', 'strong', 'fortress'].join() === [1, 2, 3, 4, 5, 8, 10].map(C.garrisonWord).join());

// ---- supply ----
{ const st = fresh(); ok('nothing is cut off at the start', C.supplyCut(st).length === 0, C.supplyCut(st).join());
  ['broken_banner', 'syndicate', 'synod'].forEach(f => war(st, 'crown', f)); war(st, 'syndicate', 'synod');
  ok('wars alone cut nothing off on the starting map (there is always a way round)', C.supplyCut(st).length === 0, C.supplyCut(st).join()); }
{ const st = fresh(); surround(st, T, 'broken_banner');
  ok('surrounded by a faction at peace, a place is still supplied', !C.supplyCut(st).includes(T));
  war(st, 'crown', 'broken_banner'); ok('surrounded by a faction at war with its owner, it is cut off', C.supplyCut(st).includes(T)); }
{ const st = fresh(); surround(st, T, 'outlaws'); ok('outlaw places cut a path, war or not', C.supplyCut(st).includes(T)); }
{ const st = fresh(); surround(st, T, 'monsters'); ok('monster ground does not cut a path', !C.supplyCut(st).includes(T)); }
{ const st = fresh(); const E = 'greywater_landing'; surround(st, E, 'outlaws');
  ok('a Syndicate enclave in orc land counts as supplied (a trade link)', !C.supplyCut(st).includes(E)); }
{ const st = fresh(); war(st, 'crown', 'hearthwatch'); ok('the Hearthwatch, with no capital, has nothing to cut off', !C.supplyCut(st).some(id => C.ownerOf(st, id) === 'hearthwatch')); }

// ---- isolation ----
{ const st = fresh(); surround(st, T, 'outlaws'); w.Math.random = Math.random; st.world.supply = { iso: {}, regrow: {}, cut: {}, seed: 1 };
  const whole = () => { const s = C.supplyState(st), v = s.iso[T]; delete s.iso[T]; const n = C.nodeServices(st, T).shop.stock.length; if (v != null) s.iso[T] = v; return n; };
  ticks(st, 1); ok('cut off: news says so, and the place sheet knows', C.relState(st).news.some(n => n.kind === 'supply' && n.text.includes('cut off')) && C.nodeServices(st, T).cutOff.cut);
  ticks(st, 8); ok('before 10 days the shop is whole', C.nodeServices(st, T).shop.stock.length === whole());
  ticks(st, 1); const stock0 = whole(), s10 = C.nodeServices(st, T).shop.stock.length; ok('from 10 days the shop thins by about a third', s10 < stock0 && s10 >= Math.floor(stock0 * 2 / 3) - 1, stock0 + ' -> ' + s10);
  ok('the garrison holds until 20 days', C.garrison(st, T) === 4); ticks(st, 10); ok('at 20 days the garrison loses a man', C.garrison(st, T) === 3 && C.nodeServices(st, T).weakened);
  ticks(st, 5); ok('and another every 5 days', C.garrison(st, T) === 2);
  C.SUPPLY.defectChance = 0; ticks(st, 40); ok('it never falls below 1', C.garrison(st, T) === 1); C.SUPPLY.defectChance = 0.05; }
{ const st = fresh(); surround(st, T, 'broken_banner'); war(st, 'crown', 'broken_banner'); ticks(st, 29);
  ok('no defection before 30 days', C.ownerOf(st, T) === 'crown'); C.SUPPLY.defectChance = 1; ticks(st, 1); C.SUPPLY.defectChance = 0.05;
  ok('after 30 days it defects to whoever cut it off', C.ownerOf(st, T) === 'broken_banner');
  ok('defection is in the news and resets the isolation', C.relState(st).news.some(n => n.kind === 'defect') && !C.supplyState(st).iso[T]);
  ok('the defector starts at half strength', C.garrison(st, T) === 2); }
{ const st = fresh(); surround(st, T, 'outlaws'); ticks(st, 40); C.SUPPLY.defectChance = 1; ticks(st, 1); C.SUPPLY.defectChance = 0.05;
  ok('cut off by outlaws, it goes over to the outlaws', C.ownerOf(st, T) === 'outlaws'); }
{ const st = fresh(); const ns = C.supplyNeighbours(T); surround(st, T, 'outlaws'); C.SUPPLY.defectChance = 0; ticks(st, 25); C.SUPPLY.defectChance = 0.05;
  ns.forEach(y => delete st.world.nodes[y].owner); ticks(st, 1);
  ok('reconnected: news says so', C.relState(st).news.some(n => n.text.includes('back in touch')) && !C.nodeServices(st, T).cutOff.cut);
  const g = C.garrison(st, T); ticks(st, 10); ok('a weakened garrison regrows a man every 10 days while supplied', C.garrison(st, T) === g + 1, g + ' -> ' + C.garrison(st, T));
  ok('isolation drains slowly (half a point a day)', Math.abs(C.isolation(st, T).days - (25 - 0.5 * 11)) < 1e-9, C.isolation(st, T).days);
  ticks(st, 60); ok('fully recovered: garrison at strength, no isolation left', C.garrison(st, T) === 4 && !C.supplyState(st).iso[T] && !st.world.nodes[T].garrison && !C.nodeServices(st, T).cutOff); }

// ---- wiring ----
{ const st = fresh(); surround(st, T, 'outlaws'); S.advanceDay(st, 3); ok('the daily tick runs from advanceDay', C.isolation(st, T).days === 3, C.isolation(st, T).days); }
{ const st = fresh(); const s2 = S.repair(JSON.parse(JSON.stringify(st))).state; ok('a save without supply state loads and ticks', (delete s2.world.supply, S.advanceDay(s2, 1), !!s2.world.supply)); }
{ let cut = 0; const t = Date.now(); for (let g = 0; g < 10; g++) { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rng = (g * 7919 + 13) >>> 0; S.advanceDay(st, 200); cut += C.supplyCut(st).length; }
  ok('200 days of real play: no place is cut off without borders moving (3c), and the tick is cheap', cut === 0 && Date.now() - t < 20000, cut + ' cut, ' + (Date.now() - t) + ' ms'); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
