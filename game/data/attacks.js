/* AI attacks (design/node_ownership_and_land.md, Phase 3c). Pure rules, no screens. Needs relations.js and supply.js.
   - A war faction attacks a place held by a faction it is at war with, next to a place it holds. The place it attacks from must be supplied.
   - The attacking force is the garrison of its strongest supplied place next to the target. It needs 1.5x the target's garrison,
     plus 0.25 for each of its attacks that failed in the last 60 days (war weariness).
   - Every attack is announced 7 days ahead. A faction waits 7 days between attacks and has at most 2 under way at once.
   - Capitals are left for Phase 3d (sieges and the "no other places left" rule). The Hearthwatch is never a target.
   - When an attack lands it is settled by a roll: the attackers win with force / (force + garrison). A winner takes the place at half its
     base garrison; the place it attacked from loses a man either way, and beaten-off defenders lose one too (never below 1).
   - During the warning the player can step in at the place: help hold it (fight the attackers) or join the attack (fight the garrison).
     A won fight decides the attack for that side at once; a lost one leaves it to the roll. Standing rises with the side helped and falls with the other.
   - Motives pick targets: places a faction held at the start come first, then the faction its motive names, then rich places
     (the Syndicate wants markets and towns), then the easier fight. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.REL || !C.SUPPLY || !C.supplyCut || !C.applyEncounterResult || C.ATTACK) return false;
    const D = window.GAME_DATA;
    const A = C.ATTACK = {
      warn: 7, cooldown: 7, maxActive: 2,
      margin: 1.5, weary: 0.25, wearyDays: 60,
      standing: 10,
      value: { castle: 4, town: 3, market: 3, village: 2, hamlet: 1.5 }, other: 1,
      squads: {
        crown: { name: 'Crown soldiers', enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }] },
        syndicate: { name: 'Syndicate sellswords', enemies: [{ primary: 'rogue', name: 'Enforcer' }, { primary: 'marksman', name: 'Counting-House Gun' }, { primary: 'warrior', name: 'Hired Blade' }] },
        synod: { name: 'Synod wardens', enemies: [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Synod Novice' }] },
        broken_banner: { name: 'Banner riders', enemies: [{ primary: 'scout', name: 'Banner Rider' }, { primary: 'warrior', name: 'Banner Veteran' }, { primary: 'archer', name: 'Banner Bowman' }] }
      }
    };
    const day = st => st.world.day, fname = f => (D.factions[f] && D.factions[f].name) || f;
    const WAR = () => C.REL.factions.filter(f => f !== 'hearthwatch');
    const AS = C.attackState = st => st.world.atk || (st.world.atk = { list: [], last: {}, fails: {}, seq: 0 });
    const rnd = st => { const r = AS(st); r.seed = ((r.seed >>> 0) || ((st.world.rng >>> 0) ^ 0x5bd1e995) || 4242); r.seed = (Math.imul(r.seed ^ (r.seed >>> 15), 2246822519) + 0x6D2B79F5) >>> 0; return r.seed / 4294967296; };
    const encId = a => 'atk_' + a.n;

    C.attackOn = (st, id) => AS(st).list.find(a => a.target === id) || null;
    C.attacks = st => AS(st).list.slice();
    const recentFails = (st, f) => { const r = AS(st), x = (r.fails[f] || []).filter(d => day(st) - d < A.wearyDays); if (x.length) r.fails[f] = x; else delete r.fails[f]; return x.length; };
    C.attackMargin = (st, f) => A.margin + A.weary * recentFails(st, f);

    // the strongest supplied place f holds next to id
    function launchFrom(st, f, id, cut) {
      let best = null, g = -1;
      for (const y of C.supplyNeighbours(id)) if (C.ownerOf(st, y) === f && !cut.has(y)) { const v = C.garrison(st, y); if (v > g || v === g && y < best) { best = y; g = v; } }
      return best ? { from: best, force: g } : null;
    }
    const targetable = (st, id) => { const n = C.NODES[id]; return !!n && !n.hidden && n.type !== 'capital' && !n.capital && C.ownerOf(st, id) !== 'hearthwatch'; };
    // every place f could attack today, best first
    C.attackOptions = function (st, f, cut) {
      cut = cut || new Set(C.supplyCut(st)); const foes = C.relEnemies(st, f).filter(g => g !== 'hearthwatch'), out = [], mg = C.attackMargin(st, f), M = C.MOTIVES[f] || {};
      if (!foes.length) return out;
      for (const id of Object.keys(C.NODES)) {
        const on = C.ownerOf(st, id); if (!foes.includes(on) || !targetable(st, id) || C.attackOn(st, id)) continue;
        const lf = launchFrom(st, f, id, cut); if (!lf) continue;
        const gar = C.garrison(st, id); if (lf.force < mg * gar) continue;
        const n = C.NODES[id], odds = lf.force / (lf.force + gar);
        const score = (A.value[n.type] || A.other) + (C.defaultOwner(id) === f ? 2 : 0) + ((M.foes || []).includes(on) ? 1 : 0)
          + (f === 'syndicate' && (n.type === 'market' || n.type === 'town') ? 1 : 0) + odds;
        out.push({ target: id, on, from: lf.from, force: lf.force, garrison: gar, odds, score });
      }
      return out.sort((a, b) => b.score - a.score || (a.target < b.target ? -1 : 1));
    };
    function launch(st, f, o) {
      const r = AS(st), a = { n: ++r.seq, by: f, on: o.on, target: o.target, from: o.from, day: day(st), lands: day(st) + A.warn };
      r.list.push(a); r.last[f] = day(st);
      C.relNews(st, 'The ' + fname(f) + ' is massing at ' + C.NODES[o.from].name + ' to take ' + C.NODES[o.target].name + ' from the ' + fname(o.on) + '.', 'attack');
      return a;
    }
    function bleed(st, id) { if (C.NODES[id] && C.garrison(st, id) > 1) C.setGarrison(st, id, C.garrison(st, id) - 1); }
    function take(st, a) {
      const id = a.target; (st.world.nodes[id] = st.world.nodes[id] || {}).owner = a.by;
      const s = C.supplyState(st); delete s.iso[id]; delete s.cut[id];
      const f0 = C.garrison(st, a.from), mv = Math.max(1, Math.ceil(f0 / 2)); C.setGarrison(st, id, mv); C.setGarrison(st, a.from, Math.max(1, f0 - mv));   // the army moves in, and may sit above the base until it drains back
      if (C.relFlip) C.relFlip(st, a.by, a.on);
    }
    function drop(st, a) { const r = AS(st); r.list = r.list.filter(x => x !== a); }
    // settle an attack: side 'attack' or 'hold' (the player decided it), or null to roll
    function settle(st, a, side) {
      const r = AS(st), T = C.NODES[a.target].name, by = fname(a.by), on = fname(a.on);
      let won;
      if (side) won = side === 'attack';
      else { const fr = launchFrom(st, a.by, a.target, new Set(C.supplyCut(st))), gar = C.garrison(st, a.target); if (!fr) { drop(st, a); C.relNews(st, 'The ' + by + ' has called off its attack on ' + T + '.', 'attack'); return { called: true }; }
        a.from = fr.from; won = rnd(st) < fr.force / (fr.force + gar); }
      drop(st, a); bleed(st, a.from);
      if (won) { take(st, a); C.relNews(st, T + ' has fallen to the ' + by + (side ? ', with your help.' : '.'), 'attack'); }
      else { bleed(st, a.target); (r.fails[a.by] = r.fails[a.by] || []).push(day(st)); C.relNews(st, 'The ' + on + ' beat off the ' + by + ' at ' + T + (side ? ', with your help.' : '.'), 'attack'); }
      return { won, side: side || null };
    }
    C.attackSettle = settle;

    C.attackTick = function (st) {
      const r = AS(st);
      for (const a of r.list.slice()) {
        if (!C.relAtWar(st, a.by, a.on) || C.ownerOf(st, a.target) !== a.on) { drop(st, a); C.relNews(st, 'The ' + fname(a.by) + ' has called off its attack on ' + C.NODES[a.target].name + '.', 'attack'); continue; }
        if (day(st) >= a.lands) settle(st, a, null);
      }
      const cut = new Set(C.supplyCut(st));
      for (const f of WAR()) {
        if (r.list.filter(a => a.by === f).length >= A.maxActive) continue;
        if (r.last[f] != null && day(st) - r.last[f] < A.cooldown) continue;
        const o = C.attackOptions(st, f, cut); if (!o.length) continue;
        // the best few are close in worth: pick among them so wars don't always run the same way
        const top = o.filter(x => x.score >= o[0].score - 0.5); launch(st, f, top[Math.floor(rnd(st) * top.length)]);
      }
      for (const k of Object.keys(C.ENCOUNTERS)) if (/^atk_\d+$/.test(k) && !r.list.some(a => encId(a) === k)) delete C.ENCOUNTERS[k];
    };
    // runs after the relations and supply ticks, so today's wars and today's cut-offs already count
    { const rt0 = C.relTick; C.relTick = function (st) { const out = rt0.apply(this, arguments); C.attackTick(st); return out; }; }

    // ---- stepping in: the place sheet offers a fight for either side ----
    const partyLevel = st => { const l = st.party.map(id => (st.roster.find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((x, y) => x + y, 0) / Math.max(1, l.length))); };
    C.attackSides = function (st, id) {
      const a = C.attackOn(st, id); if (!a) return [];
      const me = S.sworn ? S.sworn(st) : null, out = [];
      if (me !== a.by) out.push('hold'); if (me !== a.on) out.push('attack');
      return out;
    };
    // the fight for an attack, built when the sheet asks for it (it is not saved; the attack is)
    C.attackEncounter = function (st, id) {
      const a = C.attackOn(st, id); if (!a || st.world.location !== id) return null;
      const sides = C.attackSides(st, id); if (!sides.length) return null;
      const lv = partyLevel(st), k = encId(a), T = C.NODES[id].name, sq = f => A.squads[f] || A.squads.crown;
      if (!a.map || !window.GAME_DATA.maps[a.map]) a.map = C.mapFor(st, C.NODES[id].region, id);
      const reward = { xp: Math.round((40 + 14 * lv) * 0.8), gold: 15 + 6 * lv }, opt = {
        hold: { id: 'hold', label: 'Help hold ' + T + ' for the ' + fname(a.on), enemyFaction: a.by, enemies: sq(a.by).enemies.map(e => Object.assign({}, e)), standing: { [a.on]: A.standing, [a.by]: -A.standing }, reward },
        attack: { id: 'attack', label: 'Join the ' + fname(a.by) + '\'s attack on ' + T, enemyFaction: a.on, enemies: sq(a.on).enemies.map(e => Object.assign({}, e)), standing: { [a.by]: A.standing, [a.on]: -A.standing }, reward } };
      C.ENCOUNTERS[k] = { name: 'The fight for ' + T, map: a.map, rec: lv, attack: a.n, once: false, options: sides.map(s => opt[s]), reward };
      return k;
    };
    { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId0, optionId, res) {
        const out = ae0.apply(this, arguments), m = /^atk_(\d+)$/.exec(encId0 || '');
        if (m && out && res && res.won && !res.draw) { const a = AS(st).list.find(x => x.n === +m[1]); if (a) out.attack = Object.assign(settle(st, a, optionId === 'attack' ? 'attack' : 'hold'), { target: a.target, by: a.by, on: a.on }); }
        return out; }; }

    // ---- for the screens ----
    { const ns0 = C.nodeServices; C.nodeServices = function (st, id) {
        const sv = ns0.apply(this, arguments); if (!sv) return sv; const a = C.attackOn(st, id);
        if (a) sv.attack = { by: a.by, on: a.on, from: a.from, days: Math.max(0, a.lands - day(st)), sides: C.attackSides(st, id) };
        return sv; }; }
    C.validateAttacks = function () { const p = []; WAR().forEach(f => { if (!A.squads[f]) p.push('attacks: no squad for ' + f); (A.squads[f] || { enemies: [] }).enemies.forEach(u => { if (!D.classes[u.primary]) p.push('attacks: unknown class ' + u.primary); }); }); return p; };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
