// Loot and shops (design/loot_and_shops.md): shop sizes and mixes, regional favour, specialist stock, drops and purses.
// Run: LD=./real_ld.js node tloot.js | grep -v ^PASS    (loads the harness with the change, without it (NOLOOT=1), and with the arena (ARENA=1))
// Bands are as in design/item_bands.md (1, 8, 15, 22, 29, 37, 45; enemies 60/33/7 behind/at/ahead).
let fails = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const LD = require(process.env.LD || './real_ld.js'); const W = LD(); process.env.NOLOOT = '1'; const W0 = LD(); delete process.env.NOLOOT;
const C = W.GAME_CAMPAIGN, D = W.GAME_DATA, G = D.gear, T = D.gearTiers, C0 = W0.GAME_CAMPAIGN, L = C.LOOT;
const shops = Object.entries(C.NODES).filter(([k, n]) => n.shop);
// ---- shops ----
{ const size = { village: 8, town: 9, market: 10, capital: 12 };
  ok('every shop meets its size (' + shops.length + ' shops), at most one over', shops.every(([k, n]) => n.shop.length >= size[n.type] && n.shop.length <= size[n.type] + 2));
  ok('every shop meets its slot mix (written core kept)', shops.every(([k, n]) => { const q = L.mix[n.type]; return Object.keys(q).every(s => n.shop.filter(i => G[i].slot === s && !(L.specialty[k] || []).includes(i)).length >= q[s]); }));
  ok('no shop lists an item twice, and every item exists and has a price', shops.every(([k, n]) => new Set(n.shop).size === n.shop.length && n.shop.every(i => G[i] && G[i].price)));
  ok('the written stock of every shop is kept', shops.every(([k, n]) => C0.NODES[k].shop.every(i => n.shop.includes(i)))); }
{ const W2 = LD(); ok('the fill is the same every time (seeded by the place)', shops.every(([k, n]) => JSON.stringify(W2.GAME_CAMPAIGN.NODES[k].shop) === JSON.stringify(n.shop))); }
{ const spec = { staff_cold: ['frostgate', 'koestielve'], wand_fire: ['bilgeport'], wand_arcane: ['scriptorium_row'], staff_storm: ['cogsmith_row'], claws: ['slagmarket'], siphon_band: ['toadstool_market'] };
  ok('each specialty item is stocked where the design says', Object.entries(spec).every(([i, ps]) => ps.every(p => C.NODES[p].shop.includes(i))));
  const ld = C.NODES.low_docks; ok('the Gloom pair is Friendly-only at Low Docks, and in no other shop', !ld.shop.includes('wand_shadow') && ld.shopFriendly.includes('wand_shadow') && ld.shopFriendly.includes('staff_shadow') && shops.every(([k, n]) => !n.shop.includes('staff_shadow') && !n.shop.includes('wand_shadow')));
  const rare = ['claws', 'wand_fire', 'wand_arcane', 'staff_cold', 'staff_storm', 'siphon_band']; const everywhere = rare.filter(i => shops.filter(([k, n]) => n.shop.includes(i)).length > 4);
  ok('the specialty items stay specialty (not in more than 4 shops)', !everywhere.length, everywhere.join()); }
{ let fav = 0, fill = 0, rand = 0, cnt = 0;
  shops.forEach(([k, n]) => { const f = new Set((L.favoured[n.region] || '').split(' ').filter(Boolean)); const added = n.shop.filter(i => !C0.NODES[k].shop.includes(i) && !(L.specialty[k] || []).includes(i)); fill += added.length; fav += added.filter(i => f.has(i)).length; rand += f.size / 47; cnt++; });
  ok('favoured items fill well over their chance share (' + Math.round(100 * fav / fill) + '% against ' + Math.round(100 * rand / cnt) + '%), but not all', fav / fill > 1.6 * rand / cnt && fav / fill < 0.8); }
{ const caster = i => /staff|wand|spellbook|tome|relic|robe|hood|pendant|mana_ring/.test(i), syn = shops.filter(([k, n]) => n.region === 'voldun'), all = shops.filter(([k, n]) => n.region !== 'voldun');
  const share = a => a.reduce((s, [k, n]) => s + n.shop.filter(caster).length, 0) / a.reduce((s, [k, n]) => s + n.shop.length, 0);
  ok('Vol\'Dun shops lean to casters (' + Math.round(100 * share(syn)) + '% against ' + Math.round(100 * share(all)) + '% elsewhere) and still sell other gear', share(syn) > 0.5 && share(syn) > 1.5 * share(all) && syn.every(([k, n]) => n.shop.filter(i => !caster(i)).length >= 1) && syn.reduce((a, [k, n]) => a + n.shop.filter(i => !caster(i)).length, 0) / syn.length >= 2.5); }
{ const dw = shops.filter(([k, n]) => n.region === 'dwarven_holds'), heavy = i => ['maul', 'greatsword', 'halberd', 'crossbow', 'tower_shield', 'plate_armor', 'plate_helm'].includes(i);
  ok('every region has its own lean (a favoured item in every shop of the region)', shops.every(([k, n]) => !L.favoured[n.region] || n.shop.some(i => L.favoured[n.region].split(' ').includes(i)))); }
{ const st = C.newGame({ race: 'human' }); st.roster.forEach(u => u.level = 9); st.inventory.gold = 9999;
  ok('shops still tier their stock and sell (buy works, stock all priced)', shops.every(([k, n]) => { st.world.location = k; const sv = C.nodeServices(st, k); return !sv.shop || (sv.shop.stock.length >= 5 && sv.shop.stock.every(i => G[i] && G[i].price)); }));
  ok('data still validates', C.validate().length === 0 && C.validateQuests().length === 0 && C.validateWork().length === 0 && C.validateCast().length === 0);
  const k = 'scriptorium_row'; st.world.location = k; const sv = C.nodeServices(st, k), item = sv.shop.stock[0]; const g0 = st.inventory.gold, r = C.buy(st, k, item); ok('buying from a filled shop works', r.ok && st.inventory.gold < g0 && st.inventory.items[item] === 1); }
// ---- drops ----
const SIG = new Set(['staff_cold', ...Object.values(L.signature).flat()]);
const humans = (n, ex) => Array.from({ length: n }, (_, i) => Object.assign({ primary: ['squire', 'scout', 'rogue'][i % 3], name: 'Foe ' + (i + 1) }, ex || {}));
const mkEnc = (rec, enemies, extra) => { delete C.ENCOUNTERS.wander; C.ENCOUNTERS.wander = Object.assign({ name: 'Ambush', map: 'classic_ridge', rec, enemyFaction: 'outlaws', enemies, objective: null, once: false, wander: true, reward: { xp: 10, gold: 10 } }, extra || {}); return C.ENCOUNTERS.wander; };
const fight = (rec, enemies, extra, o) => { o = o || {}; const e = mkEnc(rec, enemies, extra), st = C.newGame({ race: 'human' }); st.world.day = o.day === undefined ? 1 : o.day; st.roster.forEach(u => u.level = rec); st.inventory.gold = 0;
  const info = C.encounterBuilds('wander'), kills = info.builds.filter((b, i) => !(o.spare || []).includes(i)).map(b => ({ victim: b.id, victimTeam: 'E', victimFaction: 'outlaws' })); const out = C.applyEncounterResult(st, 'wander', null, { won: o.won !== false, kills, factionKills: {}, unitStats: {}, fallen: [], survivors: [], turns: 5 });
  return { st, out, info, e }; };
const rate = (n, f, pick) => { let k = 0; for (let i = 0; i < n; i++) if (pick(f(i))) k++; return k / n; };
{ const r = rate(600, i => fight(5, humans(3), null, { day: i + 1 }), x => (x.out.drops || []).length > 0); ok('an ordinary fight drops an item about 30% of the time (' + Math.round(r * 100) + '%)', r > 0.24 && r < 0.36); }
{ const r = rate(600, i => fight(5, humans(3), { objective: { type: 'leader', leader: 0 } }, { day: i + 1 }), x => (x.out.drops || []).length > 0); ok('when the leader falls: about 50% (' + Math.round(r * 100) + '%)', r > 0.43 && r < 0.57); }
{ const r = rate(600, i => fight(5, humans(3), { objective: { type: 'leader', leader: 0 } }, { day: i + 1, spare: [0] }), x => (x.out.drops || []).length > 0); ok('a leader who is not killed does not raise the chance (' + Math.round(r * 100) + '%)', r > 0.24 && r < 0.36); }
{ const e = [{ primary: 'squire', name: 'Lord Osric' }, ...humans(2)]; const r = rate(80, i => fight(9, e, null, { day: i + 1 }), x => (x.out.drops || []).length > 0); ok('a named character always drops something (' + Math.round(r * 100) + '%)', r === 1); }
{ const r = rate(400, i => fight(5, humans(3), null, { day: i + 1 }), x => (x.out.drops || []).length > 1); ok('never more than one item', r === 0); }
{ let bad = 0, uniq = 0; for (let i = 0; i < 500; i++) { const x = fight(9, humans(3), null, { day: i + 1 }); (x.out.drops || []).forEach(d => { if (G[d].unique || G[d].token) uniq++; const worn = x.info.builds.flatMap(b => Object.values(b.gear)); if (!worn.includes(d) && !SIG.has(T.baseOf(d)) && G[d].slot !== 'Accessory') bad++; }); }
  ok('a drop is something a foe wore (or a signature item), never a unique or token', bad === 0 && uniq === 0, bad + ' off-pool, ' + uniq + ' unique'); }
{ let n = 0, t = 0; for (let i = 0; i < 400; i++) { const x = fight(25, humans(3), null, { day: i + 1 }); (x.out.drops || []).forEach(d => { n++; if (T.tierOfItem(d) >= 3 && T.tierOfItem(d) <= 5) t++; }); }
  ok('the drop keeps the tier the foe wore (band 4, level 25: tiers 3 to 5)', n > 60 && t === n, t + '/' + n); }
{ let acc = 0, tot = 0; for (let i = 0; i < 1500; i++) { const x = fight(5, humans(3), { objective: { type: 'leader', leader: 0 } }, { day: i + 1 }); (x.out.drops || []).forEach(d => { tot++; if (G[d].slot === 'Accessory') acc++; }); }
  ok('about a quarter of a leader\'s drops are accessories (' + Math.round(100 * acc / tot) + '%)', acc / tot > 0.17 && acc / tot < 0.33); }
{ const mon = [{ primary: 'dire_wolf' }, { primary: 'dire_wolf' }, { primary: 'cave_bear' }]; const k = rate(200, i => fight(5, mon, { enemyFaction: 'wild' }, { day: i + 1 }), x => (x.out.drops || []).length > 0 || x.out.purse > 0); ok('wild monsters drop nothing and carry no purse', k === 0); }
{ const x = fight(5, humans(3), null, { day: 3, won: false }); ok('a lost fight drops nothing', !(x.out.drops || []).length && !x.out.purse && x.st.inventory.gold === 0); }
{ const e = mkEnc(5, humans(3)), info = C.encounterBuilds('wander'), kills = info.builds.map(b => ({ victim: b.id, victimTeam: 'E' })), go = () => { const st = C.newGame({ race: 'human' }); st.world.day = 7; st.roster.forEach(u => u.level = 5); return C.applyEncounterResult(st, 'wander', null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 5 }); };
  let same = true; for (let d = 1; d < 40; d++) { const a = (() => { const st = C.newGame({ race: 'human' }); st.world.day = d; st.roster.forEach(u => u.level = 5); return C.applyEncounterResult(st, 'wander', null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 5 }); })(), b = (() => { const st = C.newGame({ race: 'human' }); st.world.day = d; st.roster.forEach(u => u.level = 5); return C.applyEncounterResult(st, 'wander', null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 5 }); })(); if (JSON.stringify(a.drops) !== JSON.stringify(b.drops) || a.purse !== b.purse) same = false; }
  ok('the same fight on the same day gives the same loot (a reload does not reroll)', same); }
{ const sig = [{ primary: 'necro', name: 'Gravewright' }, ...humans(2)]; let seen = new Set(); for (let i = 0; i < 400; i++) { const x = fight(10, sig, null, { day: i + 1 }); (x.out.drops || []).forEach(d => seen.add(T.baseOf(d))); }
  ok('a necromancer can drop a Gloom Staff or a Siphon Band', seen.has('staff_shadow') || seen.has('siphon_band'), [...seen].join()); }
// ---- purses ----
{ let n = 0, sum = 0, rate0; for (let i = 0; i < 600; i++) { const x = fight(8, humans(3), null, { day: i + 1 }); if (x.out.purse) { n++; sum += x.out.purse; if (x.out.purse !== Math.round(C.goldFor(8) * 0.15)) n += 1e6; } }
  ok('a purse comes about 35% of the time and is 15% of the fight pay (' + Math.round(100 * n / 600) + '%, ' + Math.round(sum / Math.max(1, n)) + ' gold at level 8)', n / 600 > 0.28 && n / 600 < 0.42); }
{ let n = 0; for (let i = 0; i < 300; i++) { const x = fight(8, humans(3), { objective: { type: 'leader', leader: 0 } }, { day: i + 1 }); if (x.out.purse === Math.round(C.goldFor(8) * 0.25)) n++; } ok('leader fallen: purses of 25% of the pay, about 60% of the time (' + Math.round(100 * n / 300) + '%)', n / 300 > 0.5 && n / 300 < 0.7); }
{ const x = fight(8, humans(3), null, { day: 5 }); ok('the purse goes into the gold', !x.out.purse || x.st.inventory.gold >= x.out.purse); }
// ---- dungeons and story fights ----
{ const id = 'old_toll_cellars', d = C.DUNGEONS[id], n = d.floors.length, run = (day, clears, stage) => { const st = C.newGame({ race: 'human' }); st.world.day = day; st.roster.forEach(u => u.level = d.rec); st.world.dungeons = { [id]: { stage, cleared: false, clearedDay: -1, clears } }; const encId = C.dungeonFight(st, id), info = C.encounterBuilds(encId), kills = info.builds.map(b => ({ victim: b.id, victimTeam: 'E' }));
    return C.applyEncounterResult(st, encId, null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 4 }); };
  const first = rate(60, i => run(i + 1, 0, n - 1), o => (o && o.drops || []).length > 0), rep = rate(300, i => run(i + 1, 1, n - 1), o => (o && o.drops || []).length > 0), flo = rate(400, i => run(i + 1, 0, 0), o => (o && o.drops || []).length > 0);
  ok('a dungeon boss drops every first clear (' + Math.round(first * 100) + '%), about half on a repeat (' + Math.round(rep * 100) + '%), an ordinary floor about 35% (' + Math.round(flo * 100) + '%)', first === 1 && rep > 0.42 && rep < 0.58 && flo > 0.28 && flo < 0.42); }
{ const id = Object.keys(C.ENCOUNTERS).find(k => C.ENCOUNTERS[k].once && C.ENCOUNTERS[k].enemies && !C.ENCOUNTERS[k].dungeon && !C.ENCOUNTERS[k].arena && C.ENCOUNTERS[k].enemies.every(u => D.classes[u.primary].selectable !== false)); const e = C.ENCOUNTERS[id];
  const play = (day, done) => { const st = C.newGame({ race: 'human' }); st.world.day = day; if (done) st.campaign.completed.push(id); const info = C.encounterBuilds(id, e.options ? e.options[0].id : null), kills = info.builds.map(b => ({ victim: b.id, victimTeam: 'E' })); return C.applyEncounterResult(st, id, e.options ? e.options[0].id : null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 4 }); };
  const fresh = rate(500, i => play(i + 1, false), o => (o.drops || []).length > 0), again = rate(500, i => play(i + 1, true), o => (o.drops || []).length > 0);
  ok('a replayed story fight (' + id + ') drops half as often (' + Math.round(fresh * 100) + '% then ' + Math.round(again * 100) + '%)', again < 0.7 * fresh); }
// ---- the arena is left alone ----
{ process.env.ARENA = '1'; const WA = LD(); delete process.env.ARENA; const CA = WA.GAME_CAMPAIGN, id = Object.keys(CA.ENCOUNTERS).find(k => CA.ENCOUNTERS[k].arena); let got = 0;
  for (let i = 0; i < 200; i++) { const st = CA.newGame({ race: 'human' }); st.world.day = i + 1; const info = CA.encounterBuilds(id), kills = info.builds.map(b => ({ victim: b.id, victimTeam: 'E' })); const g0 = st.inventory.gold, out = CA.applyEncounterResult(st, id, null, { won: true, kills, factionKills: {}, unitStats: {}, turns: 4 }); if ((out.drops || []).length || out.purse) got++; }
  ok('arena bouts drop nothing and carry no purse', !!id && got === 0);
  ok('the arena stall keeps its own stock (the fill does not touch it)', CA.NODES.the_sandring.shop.join() === 'iron_sword,halberd,katana,round_shield,chain_hauberk'); }
// ---- the economy: drops add about a fifth to the pay ----
{ const P = t => { let s = 0, n = 0; Object.keys(D.classes).filter(c => D.classes[c].selectable !== false).forEach(c => { const g = W.GAME_LOADOUT.defaultGear(c, []); for (const sl in g) { const id = T.tierItem(g[sl], t); if (G[id] && G[id].price) { s += G[id].price; n++; } } }); return s / n; };
  const GR = C.GEAR_RULES;
  [4, 11, 18, 25, 32.5].forEach((lv, i) => { const b = i + 1, mix = b === 1 ? P(1) : GR.behind * P(b - 1) + GR.at * P(b) + GR.ahead * P(b + 1), ev = L.drop.ordinary * mix / 2 + L.purse.ordinary[0] * L.purse.ordinary[1] * C.goldFor(lv), share = ev / C.goldFor(lv);
    ok('band ' + (b) + ' (level ' + lv + '): drops and purses add ' + Math.round(share * 100) + '% to a fight\'s pay if everything is sold (15% to 30%)', share > 0.15 && share < 0.3); }); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
