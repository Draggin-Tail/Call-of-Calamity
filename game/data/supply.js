/* Supply and garrisons (design/node_ownership_and_land.md section 4, Phase 3b). Pure rules, no screens. Needs relations.js.
   - Every place held by a war faction has a garrison: a base by place type, weakened by isolation (and, from 3c, by attacks), regrowing while supplied.
   - A place is supplied if a road path leads to its owner's capital without crossing a place held by a faction at war with the owner, or by outlaws.
     Neutral, monster and player ground, and factions at peace, let supply through. Places in another race's land count as supplied (a trade link),
     and so does a faction with no capital (the Hearthwatch).
   - Cut off, a place's isolation counter rises a point a day; supplied again, it drains half a point a day.
     10+: its shop thins (a third of the stock is gone). 20+: its garrison loses a man every 5 days (never below 1).
     30+: each day it may defect to whoever cut it off (the faction at war with its owner holding the most places next to it; outlaws if none).
   - Players see garrisons in words (thin, held, strong, fortress), never numbers. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.REL || !C.relState || !C.nodeServices || C.SUPPLY) return false;
    const D = window.GAME_DATA;
    const P = C.SUPPLY = {
      base: { hamlet: 2, village: 3, market: 4, town: 4, castle: 6, capital: 10 },
      hall: 1,                        // a faction seat (n.seat) adds one
      other: 1,                       // road, POI, zone, dungeon and anything else
      regrowEvery: 10,
      thinAt: 10, shrinkAt: 20, shrinkEvery: 5, defectAt: 30, defectChance: 0.05,
      drain: 0.5, thinShare: 1 / 3,
      words: [[1, 'thin'], [4, 'held'], [8, 'strong'], [Infinity, 'fortress']]
    };
    const day = st => st.world.day, fname = f => (D.factions[f] && D.factions[f].name) || f;
    const WAR = () => C.REL.factions.filter(f => f !== 'hearthwatch');
    const NS = (st, id) => st.world.nodes[id] || (st.world.nodes[id] = {});
    const SS = st => st.world.supply || (st.world.supply = { iso: {}, day: day(st), regrow: {}, shrink: {}, cut: {} });
    C.supplyState = SS;
    // 4c: a risen plotter's stronghold counts as its capital
    const capitals = () => { const o = {}; Object.keys(C.NODES).forEach(id => { const n = C.NODES[id]; if ((n.type === 'capital' || n.stronghold) && n.capital) o[n.capital] = id; }); return o; };
    let ADJ = null;
    const adj = () => { if (ADJ) return ADJ; ADJ = {}; const add = (a, b) => { (ADJ[a] = ADJ[a] || new Set()).add(b); (ADJ[b] = ADJ[b] || new Set()).add(a); };
      (C.EDGES || []).forEach(([a, b]) => add(a, b)); Object.keys(C.NODES).forEach(a => Object.keys(C.NODES[a].links || {}).forEach(b => { if (C.NODES[b]) add(a, b); })); return ADJ; };

    C.supplyNeighbours = id => [...(adj()[id] || [])];

    // ---- garrisons ----
    C.garrisonBase = function (id) { const n = C.NODES[id]; if (!n) return 0; return (P.base[n.type] || P.other) + (n.seat && n.type !== 'capital' ? P.hall : 0); };
    C.garrison = function (st, id) { const g = (st.world.nodes[id] || {}).garrison; return typeof g === 'number' ? g : C.garrisonBase(id); };
    C.setGarrison = function (st, id, v) { const b = C.garrisonBase(id); v = Math.max(0, Math.round(v)); if (v === b) delete NS(st, id).garrison; else NS(st, id).garrison = v; return v; };   // above base after an army moves in (3c)
    C.garrisonWord = v => P.words.find(([m]) => v <= m)[1];

    // ---- supply ----
    // passable for faction f: its own, an ally's, anyone it is not at war with; never outlaws or a faction at war with it
    const blocks = (st, f, id) => { const o = C.ownerOf(st, id); if (o === f) return false; if (o === 'outlaws') return true; return WAR().includes(o) && C.relAtWar(st, f, o); };
    C.supplied = function (st) {
      const caps = capitals(), out = {}, A = adj();
      for (const f of WAR()) {
        const cap = caps[f]; if (!cap || C.ownerOf(st, cap) !== f) continue;
        const seen = new Set([cap]), q = [cap];
        while (q.length) { const x = q.shift(); for (const y of A[x] || []) if (!seen.has(y) && !blocks(st, f, y)) { seen.add(y); q.push(y); } }
        out[f] = seen;
      }
      return out;
    };
    // places that count: held by a war faction with a capital, in its own land
    C.supplyCut = function (st, sup) {
      sup = sup || C.supplied(st); const caps = capitals(), cut = [];
      for (const id of Object.keys(C.NODES)) {
        const f = C.ownerOf(st, id); if (!sup[f] || C.NODES[id].hidden && !(st.world.nodes[id] || {}).owner) continue;
        if (C.NODES[id].region !== C.NODES[caps[f]].region) continue;   // an enclave in another land: a trade link keeps it supplied
        if (!sup[f].has(id)) cut.push(id);
      }
      return cut;
    };
    const rnd = st => { const r = SS(st); r.seed = ((r.seed >>> 0) || ((st.world.rng >>> 0) ^ 0x9e3779b9) || 777); r.seed = (Math.imul(r.seed ^ (r.seed >>> 15), 2246822519) + 0x6D2B79F5) >>> 0; return r.seed / 4294967296; };
    function defectTo(st, id) {
      const own = C.ownerOf(st, id), cnt = {};
      for (const y of adj()[id] || []) { const o = C.ownerOf(st, y); if (WAR().includes(o) && o !== own && C.relAtWar(st, own, o)) cnt[o] = (cnt[o] || 0) + 1; }
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      return best ? best[0] : 'outlaws';
    }
    C.defect = function (st, id, to) {
      const from = C.ownerOf(st, id); to = to || defectTo(st, id); NS(st, id).owner = to;
      const s = SS(st); delete s.iso[id]; delete s.cut[id]; C.setGarrison(st, id, Math.max(1, Math.floor(C.garrisonBase(id) / 2)));
      if (C.relFlip && to !== 'outlaws') C.relFlip(st, to, from);
      const n = C.NODES[id].name; C.relNews(st, to === 'outlaws' ? n + ', cut off from the ' + fname(from) + ' too long, has thrown its lot in with the outlaws.' : n + ', cut off from the ' + fname(from) + ' too long, has opened its gates to the ' + fname(to) + '.', 'defect');
      return { from, to };
    };
    C.supplyTick = function (st) {
      const s = SS(st), sup = C.supplied(st), cut = new Set(C.supplyCut(st, sup));
      for (const id of cut) {
        const f = C.ownerOf(st, id);
        if (!s.cut[id]) { s.cut[id] = day(st); C.relNews(st, C.NODES[id].name + ' is cut off from the ' + fname(f) + '.', 'supply'); }
        const v = s.iso[id] = (s.iso[id] || 0) + 1;
        if (v >= P.shrinkAt && (v - P.shrinkAt) % P.shrinkEvery === 0 && C.garrison(st, id) > 1) C.setGarrison(st, id, C.garrison(st, id) - 1);
        if (v >= P.defectAt && rnd(st) < P.defectChance) C.defect(st, id);
      }
      for (const id of Object.keys(s.iso)) if (!cut.has(id)) { if (s.cut[id]) { delete s.cut[id]; C.relNews(st, C.NODES[id].name + ' is back in touch with the ' + fname(C.ownerOf(st, id)) + '.', 'supply'); } s.iso[id] -= P.drain; if (s.iso[id] <= 0) delete s.iso[id]; }
      // regrowth: one man every 10 days, while supplied; a garrison above its base (an army that moved in, 3c) drains back a man every 10 days, supplied or not
      // a faction's men never exceed the sum of its places' base garrisons (3c): men mustered elsewhere are moved, not made, so regrowth only refills that total
      const men = {}, cap = {}; for (const id of Object.keys(C.NODES)) { const f = C.ownerOf(st, id); if (!WAR().includes(f)) continue; men[f] = (men[f] || 0) + C.garrison(st, id); cap[f] = (cap[f] || 0) + C.garrisonBase(id) * (C.capShare ? C.capShare(st, id) : 1); }
      for (const id of Object.keys(st.world.nodes)) { const g = st.world.nodes[id].garrison; if (typeof g !== 'number') continue; const over = g > C.garrisonBase(id), f = C.ownerOf(st, id); if (cut.has(id) && !over) continue;
        s.regrow[id] = (s.regrow[id] || 0) + 1; if (s.regrow[id] < (over || !C.regrowFactor ? 1 : C.regrowFactor(st, id)) * P.regrowEvery) continue;   // 3c: new holdings slower, a rallying home faster
        if (!over && men[f] != null && men[f] >= cap[f]) continue;   // full strength already: wait until men are lost
        s.regrow[id] = 0; C.setGarrison(st, id, g + (over ? -1 : 1)); if (men[f] != null) men[f] += over ? -1 : 1; }
      for (const id of Object.keys(s.regrow)) if (typeof (st.world.nodes[id] || {}).garrison !== 'number') delete s.regrow[id];
    };
    C.isolation = function (st, id) { const v = SS(st).iso[id] || 0; return { days: v, cut: !!SS(st).cut[id], stage: v >= P.defectAt ? 3 : v >= P.shrinkAt ? 2 : v >= P.thinAt ? 1 : 0 }; };
    // runs right after the relations tick, so wars declared today already count
    { const rt0 = C.relTick; C.relTick = function (st) { const r = rt0.apply(this, arguments); C.supplyTick(st); return r; }; }

    // ---- the place sheet: a thinner shop, and the garrison in words ----
    { const ns0 = C.nodeServices; C.nodeServices = function (st, id) {
        const sv = ns0.apply(this, arguments); if (!sv) return sv; const f = C.ownerOf(st, id);
        if (WAR().includes(f)) { const iso = C.isolation(st, id); sv.garrison = C.garrisonWord(C.garrison(st, id)); sv.weakened = C.garrison(st, id) < C.garrisonBase(id); sv.cutOff = iso.cut || iso.stage ? iso : null;
          if (iso.stage >= 1 && sv.shop && sv.shop.stock) sv.shop.stock = sv.shop.stock.filter((x, i) => i % 3 !== 2); }
        return sv; }; }
    C.validateSupply = function () { const p = [], caps = capitals(); WAR().forEach(f => { if (!caps[f]) p.push('supply: no capital for ' + f); }); return p; };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
