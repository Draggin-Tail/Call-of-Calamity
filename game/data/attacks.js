/* AI attacks (design/node_ownership_and_land.md, Phase 3c). Pure rules, no screens. Needs relations.js and supply.js.
   - A war faction attacks a place held by a faction it is at war with, up to 3 roads from one of its own supplied places. The march may pass
     its own places, unclaimed land and beast dens, nothing else.
   - Muster: when it announces an attack, the faction pulls men into the launch place from its places within 3 roads, each stripped down to half
     its base (rounded up). The army (the launch place's garrison) must be at least 1.5x the target's garrison, plus 0.25 for each of its
     attacks that failed in the last 60 days (war weariness).
   - The defender answers at once: it calls in men to hold the target the same way, or, if even that leaves the attackers the better odds,
     it strikes back at one of the attacker's places instead (often one the muster stripped).
   - Every week a faction at war sends a man from each place away from the fighting to its most outmatched front place.
   - Every attack is announced 7 days ahead. A faction waits 7 days between attacks (a counterattack doesn't wait) and has at most 2 under way.
   - Capitals are left for Phase 3d (sieges and the "no other places left" rule). The Hearthwatch is never a target.
   - When an attack lands it is settled by a roll: the attackers win with army / (army + garrison). A winner moves half its army in (a garrison
     may sit above its base and drains back over time); the launch place loses a man either way, and beaten-off defenders lose one too.
   - During the warning the player can step in at the place: help hold it (fight the attackers) or join the attack (fight the garrison).
     A won fight decides the attack for that side at once; a lost one leaves it to the roll. Standing rises with the side helped and falls with the other.
   - Motives pick targets: places a faction held at the start come first, then the faction its motive names, then rich places
     (the Syndicate wants markets and towns), then the easier fight and the shorter march.
   - Trade grabs (the Syndicate's motive): at peace with everyone, the Syndicate eyes a weakly held market or town up to 6 roads from its land,
     held by a faction already at war with someone else,
     (one it could take by the margin), on a way that passes only its own, unclaimed and beast ground and the holder's places. Its relation with the
     holder sours each day until it declares war; it attacks only the prize and the holder's places on the way to it, and once it holds the prize,
     it asks for terms (the relation warms each day until peace). If the place stops being weak, changes hands or the war ends first, it lets go.
     Between grabs it waits 60 days. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.REL || !C.SUPPLY || !C.supplyCut || !C.applyEncounterResult || C.ATTACK) return false;
    const D = window.GAME_DATA;
    const A = C.ATTACK = {
      warn: 7, cooldown: 7, maxActive: 2,
      margin: 1.5, weary: 0.25, wearyDays: 60,
      reach: 3,                       // roads an army may march, and the reach of a muster
      keep: 0.5,                      // a place is stripped down to this share of its base (rounded up)
      counterOdds: 0.6,               // a defender strikes back elsewhere when the attackers' odds would still be above this after calling in men
      redeployEvery: 7, frontCap: 2,  // weekly redeployment; a front is fed up to 1.5x the strongest enemy within reach, never past 2x its base
      standing: 10,
      grab: { by: 'syndicate', types: ['market', 'town'], reach: 6, sour: 0.01, terms: 0.02, rest: 60 },
      value: { castle: 4, town: 3, market: 3, village: 2, hamlet: 1.5 }, other: 1,
      squads: {
        crown: { name: 'Crown soldiers', enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }] },
        syndicate: { name: 'Syndicate sellswords', enemies: [{ primary: 'rogue', name: 'Enforcer' }, { primary: 'marksman', name: 'Counting-House Gun' }, { primary: 'warrior', name: 'Hired Blade' }] },
        synod: { name: 'Synod wardens', enemies: [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Synod Novice' }] },
        broken_banner: { name: 'Banner riders', enemies: [{ primary: 'scout', name: 'Banner Rider' }, { primary: 'warrior', name: 'Banner Veteran' }, { primary: 'archer', name: 'Banner Bowman' }] }
      }
    };
    const day = st => st.world.day, fname = f => (D.factions[f] && D.factions[f].name) || f, nm = id => C.NODES[id].name;
    const WAR = () => C.REL.factions.filter(f => f !== 'hearthwatch');
    const AS = C.attackState = st => st.world.atk || (st.world.atk = { list: [], last: {}, fails: {}, seq: 0 });
    const rnd = st => { const r = AS(st); r.seed = ((r.seed >>> 0) || ((st.world.rng >>> 0) ^ 0x5bd1e995) || 4242); r.seed = (Math.imul(r.seed ^ (r.seed >>> 15), 2246822519) + 0x6D2B79F5) >>> 0; return r.seed / 4294967296; };
    const encId = a => 'atk_' + a.n;

    C.attackOn = (st, id) => AS(st).list.find(a => a.target === id) || null;
    C.attacks = st => AS(st).list.slice();
    const recentFails = (st, f) => { const r = AS(st), x = (r.fails[f] || []).filter(d => day(st) - d < A.wearyDays); if (x.length) r.fails[f] = x; else delete r.fails[f]; return x.length; };
    C.attackMargin = (st, f) => A.margin + A.weary * recentFails(st, f);

    // ---- marching: up to 3 roads through f's own places, unclaimed land and beast dens ----
    const passable = (st, f, id) => { const o = C.ownerOf(st, id); return o === f || o === 'neutral' || o === 'monsters'; };
    C.marchReach = function (st, f, from, steps) {
      steps = steps == null ? A.reach : steps; const dist = { [from]: 0 }, q = [from];
      while (q.length) { const x = q.shift(); if (dist[x] >= steps) continue;
        for (const y of C.supplyNeighbours(x)) if (!(y in dist)) { dist[y] = dist[x] + 1; if (passable(st, f, y)) q.push(y); } }
      return dist;
    };
    const keepOf = id => Math.ceil(C.garrisonBase(id) * A.keep);
    const busy = st => { const b = new Set(); AS(st).list.forEach(a => { b.add(a.target); b.add(a.from); }); return b; };
    // men f could pull into `into` from its places within reach, each down to half its base
    function donors(st, f, into, bz, cut) {
      const out = [], R = C.marchReach(st, f, into);
      for (const y of Object.keys(R)) { if (y === into || bz.has(y) || C.ownerOf(st, y) !== f || cut.has(y)) continue; const give = C.garrison(st, y) - keepOf(y); if (give > 0) out.push([y, give]); }
      return out;
    }
    const pool = (st, f, into, bz, cut) => donors(st, f, into, bz, cut).reduce((n, [, g]) => n + g, 0);
    function muster(st, f, into, bz, cut) {
      let n = 0; for (const [y, g] of donors(st, f, into, bz, cut)) { C.setGarrison(st, y, C.garrison(st, y) - g); n += g; }
      if (n) C.setGarrison(st, into, C.garrison(st, into) + n); return n;
    }

    const targetable = (st, id) => { const n = C.NODES[id]; return !!n && !n.hidden && n.type !== 'capital' && !n.capital && C.ownerOf(st, id) !== 'hearthwatch'; };
    // every place f could attack today, best first: { target, on, from, dist, force (with the muster), garrison, odds, score }
    C.attackOptions = function (st, f, cut, only) {
      cut = cut || new Set(C.supplyCut(st)); const foes = C.relEnemies(st, f).filter(g => g !== 'hearthwatch' && (!only || g === only)), M = C.MOTIVES[f] || {};
      if (!foes.length) return [];
      const bz = busy(st), mg = C.attackMargin(st, f), best = {};
      for (const L of Object.keys(C.NODES)) {
        if (C.ownerOf(st, L) !== f || cut.has(L) || bz.has(L)) continue;
        const R = C.marchReach(st, f, L); let force = null;
        for (const T of Object.keys(R)) {
          const on = C.ownerOf(st, T); if (!foes.includes(on) || !targetable(st, T) || bz.has(T)) continue;
          if (force === null) force = C.garrison(st, L) + pool(st, f, L, bz, cut);
          const b = best[T]; if (!b || force > b.force || force === b.force && R[T] < b.dist) best[T] = { target: T, on, from: L, dist: R[T], force };
        }
      }
      const out = [];
      for (const o of Object.values(best)) {
        o.garrison = C.garrison(st, o.target); if (o.force < mg * o.garrison) continue;
        const n = C.NODES[o.target]; o.odds = o.force / (o.force + o.garrison);
        o.score = (A.value[n.type] || A.other) + (C.defaultOwner(o.target) === f ? 2 : 0) + ((M.foes || []).includes(o.on) ? 1 : 0)
          + (f === 'syndicate' && (n.type === 'market' || n.type === 'town') ? 1 : 0) + o.odds - 0.3 * (o.dist - 1);
        out.push(o);
      }
      const g = AS(st).grab; if (g && g.by === f) { const way = g.took ? new Set() : grabWay(st, g); return out.filter(o => o.on !== g.on || way.has(o.target)).map(o => (o.target === g.target && (o.score += 3), o)).sort((a, b) => b.score - a.score || (a.target < b.target ? -1 : 1)); }   // a grab war is about one prize and the way to it
      return out.sort((a, b) => b.score - a.score || (a.target < b.target ? -1 : 1));
    };
    function launch(st, f, o, counter) {
      const r = AS(st), cut = new Set(C.supplyCut(st)), bz = busy(st); bz.add(o.target);
      const n = muster(st, f, o.from, bz, cut);
      const a = { n: ++r.seq, by: f, on: o.on, target: o.target, from: o.from, day: day(st), lands: day(st) + A.warn, counter: !!counter };
      r.list.push(a); if (!counter) r.last[f] = day(st);
      C.relNews(st, counter ? 'The ' + fname(f) + ' answers by striking at ' + nm(o.target) + ', marching from ' + nm(o.from) + '.'
        : 'The ' + fname(f) + ' is ' + (n ? 'gathering men at ' : 'massing at ') + nm(o.from) + ' to take ' + nm(o.target) + ' from the ' + fname(o.on) + '.', 'attack');
      if (!counter) respond(st, a);
      return a;
    }
    // the defender's answer: call in men to hold the place, or, if that would not be enough, strike back elsewhere
    function respond(st, a) {
      const D0 = a.on; if (!WAR().includes(D0)) return;
      const cut = new Set(C.supplyCut(st)), bz = busy(st), F = C.garrison(st, a.from), G = C.garrison(st, a.target) + pool(st, D0, a.target, bz, cut);
      const mine = AS(st).list.filter(x => x.by === D0).length;
      if (F / (F + G) > A.counterOdds && mine < A.maxActive) { const o = C.attackOptions(st, D0, cut, a.by); if (o.length) { a.answer = 'counter'; launch(st, D0, o[0], true); return; } }
      const n = muster(st, D0, a.target, bz, cut); a.answer = 'hold';
      if (n) C.relNews(st, 'The ' + fname(D0) + ' is calling in men to hold ' + nm(a.target) + '.', 'attack');
    }
    // weekly: each faction at war feeds its most outmatched front place, a man from each place away from the fighting
    C.redeploy = function (st, f, cut) {
      cut = cut || new Set(C.supplyCut(st)); const foes = C.relEnemies(st, f).filter(g => g !== 'hearthwatch'); if (!foes.length) return null;
      const mine = Object.keys(C.NODES).filter(id => C.ownerOf(st, id) === f && !cut.has(id)), bz = busy(st), front = [];
      for (const P of mine) { let threat = 0; const R = C.marchReach(st, f, P); for (const y of Object.keys(R)) if (foes.includes(C.ownerOf(st, y))) threat = Math.max(threat, C.garrison(st, y)); if (threat) front.push([P, threat]); }
      const fr = new Set(front.map(x => x[0]));
      const want = front.map(([P, t]) => [P, Math.min(Math.ceil(A.margin * t), A.frontCap * C.garrisonBase(P)) - C.garrison(st, P)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      if (!want.length) return null; let [P, need] = want[0], n = 0;
      for (const y of mine) { if (need <= 0) break; if (fr.has(y) || bz.has(y) || C.garrison(st, y) <= keepOf(y)) continue; C.setGarrison(st, y, C.garrison(st, y) - 1); n++; need--; }
      if (n) C.setGarrison(st, P, C.garrison(st, P) + n); return n ? { to: P, men: n } : null;
    };
    // ---- trade grabs: the Syndicate's motive ----
    const pk = (a, b) => [a, b].sort().join('|');
    const shiftRel = (st, a, b, d) => S.setRelation(st, a, b, C.relValue(st, a, b) + d, { both: true });
    // the strongest army f could gather against T (launch place plus muster), from a supplied place within reach
    function bestForce(st, f, T, cut, bz) {
      let best = 0; for (const L of Object.keys(C.NODES)) { if (C.ownerOf(st, L) !== f || cut.has(L) || bz.has(L)) continue; if (!(T in C.marchReach(st, f, L))) continue;
        best = Math.max(best, C.garrison(st, L) + pool(st, f, L, bz, cut)); }
      return best;
    }
    // roads from the grabber's land, through its own, unclaimed and beast ground and X's places (the way a grab war would clear)
    function grabDist(st, G, X, from) {
      const ok = id => { const o = C.ownerOf(st, id); return o === G || o === 'neutral' || o === 'monsters' || o === X && targetable(st, id); };
      const d = {}, q = []; from.forEach(id => { d[id] = 0; q.push(id); });
      while (q.length) { const x = q.shift(); if (d[x] >= A.grab.reach) continue; for (const y of C.supplyNeighbours(x)) if (!(y in d) && ok(y)) { d[y] = d[x] + 1; q.push(y); } }
      return d;
    }
    const mineOf = (st, G) => Object.keys(C.NODES).filter(id => C.ownerOf(st, id) === G);
    // the holder's places on a shortest way from the grabber's land to the prize, and the prize itself
    function grabWay(st, g) {
      const dS = grabDist(st, g.by, g.on, mineOf(st, g.by)), dP = grabDist(st, g.by, g.on, [g.target]), L = dS[g.target], way = new Set([g.target]);
      if (L == null) return way;
      for (const y of Object.keys(dS)) if (C.ownerOf(st, y) === g.on && dP[y] != null && dS[y] + dP[y] === L) way.add(y);
      return way;
    }
    C.grabWay = (st) => { const g = AS(st).grab; return g ? [...grabWay(st, g)] : []; };
    C.grabOptions = function (st, cut) {
      const G = A.grab.by, rs = C.relState(st), bz = busy(st), out = [], mine = mineOf(st, G); cut = cut || new Set(C.supplyCut(st));
      const army = {}; for (const L of mine) if (!cut.has(L) && !bz.has(L)) army[L] = C.garrison(st, L) + pool(st, G, L, bz, cut);
      for (const X of WAR()) {
        if (X === G || C.relAllyOf(st, G) === X || (rs.truce[pk(G, X)] || 0) > day(st)) continue;
        if (!C.relEnemies(st, X).some(e => e !== G && e !== 'hearthwatch')) continue;   // only from a rival busy with a war of its own
        const d = grabDist(st, G, X, mine);
        for (const T of Object.keys(d)) { const n = C.NODES[T]; if (C.ownerOf(st, T) !== X || !A.grab.types.includes(n.type) || bz.has(T)) continue;
          // the army that could open the way: the biggest one gathered within marching reach of the first of X's places on it
          const way = [...grabWay(st, { by: G, on: X, target: T })], first = way.filter(y => d[y] === Math.min(...way.map(z => d[z])));
          let F = 0; for (const L of Object.keys(army)) { const R = C.marchReach(st, G, L); if (first.some(y => y in R)) F = Math.max(F, army[L]); }
          const gar = C.garrison(st, T); if (F < C.attackMargin(st, G) * gar) continue;
          out.push({ target: T, on: X, dist: d[T], force: F, garrison: gar, score: (A.value[n.type] || A.other) + F / (F + gar) - 0.3 * d[T] }); }
      }
      return out.sort((a, b) => b.score - a.score || (a.target < b.target ? -1 : 1));
    };
    C.relDeclarer = (st, a, b) => { const g = (st.world.atk || {}).grab; return g && !g.took && (g.on === a || g.on === b) && (g.by === a || g.by === b) ? g.by : null; };
    function grabTick(st, cut) {
      const r = AS(st), G = A.grab.by; if (!WAR().includes(G)) return; let g = r.grab;
      const end = text => { r.grab = null; r.grabNext = day(st) + A.grab.rest; if (text) C.relNews(st, text, 'grab'); };
      if (g) {
        const war = C.relAtWar(st, G, g.on); if (war) g.warred = true;
        if (g.took) { if (!war) end(null); else shiftRel(st, G, g.on, A.grab.terms); return; }
        if (C.ownerOf(st, g.target) === G) { g.took = day(st); C.relNews(st, 'The ' + fname(G) + ' has what it wanted in ' + nm(g.target) + ', and is asking the ' + fname(g.on) + ' for terms.', 'grab'); return; }
        if (C.ownerOf(st, g.target) !== g.on) return end('The ' + fname(G) + ' has lost interest in ' + nm(g.target) + '.');
        if (g.warred && !war) return end(null);
        if (!war) { if (!C.grabOptions(st, cut).some(o => o.target === g.target)) return end('Syndicate factors have stopped buying up debts in ' + nm(g.target) + '.');
          shiftRel(st, G, g.on, -A.grab.sour); }
        return;
      }
      if (C.relEnemies(st, G).length || (r.grabNext || 0) > day(st)) return;
      const o = C.grabOptions(st, cut)[0]; if (!o) return;
      r.grab = { by: G, target: o.target, on: o.on, day: day(st) };
      C.relNews(st, 'Syndicate factors are buying up the debts of ' + nm(o.target) + '. The ' + fname(o.on) + ' does not like it.', 'grab');
    }
    C.grabTick = grabTick;
    function bleed(st, id) { if (C.NODES[id] && C.garrison(st, id) > 1) C.setGarrison(st, id, C.garrison(st, id) - 1); }
    function take(st, a) {
      const id = a.target; (st.world.nodes[id] = st.world.nodes[id] || {}).owner = a.by;
      const s = C.supplyState(st); delete s.iso[id]; delete s.cut[id];
      const f0 = C.garrison(st, a.from), mv = Math.max(1, Math.ceil(f0 / 2)); C.setGarrison(st, id, mv); C.setGarrison(st, a.from, Math.max(1, f0 - mv));   // the army moves in, and may sit above the base until it drains back
      if (C.relFlip) C.relFlip(st, a.by, a.on);
    }
    function drop(st, a) { const r = AS(st); r.list = r.list.filter(x => x !== a); }
    const callOff = (st, a) => { drop(st, a); C.relNews(st, 'The ' + fname(a.by) + ' has called off its attack on ' + nm(a.target) + '.', 'attack'); return { called: true }; };
    // settle an attack: side 'attack' or 'hold' (the player decided it), or null to roll
    function settle(st, a, side) {
      const r = AS(st), T = nm(a.target), by = fname(a.by), on = fname(a.on);
      let won;
      if (side) won = side === 'attack';
      else { if (C.ownerOf(st, a.from) !== a.by) return callOff(st, a);
        const F = C.garrison(st, a.from), gar = C.garrison(st, a.target); won = rnd(st) < F / (F + gar); }
      drop(st, a); bleed(st, a.from);
      if (won) { take(st, a); C.relNews(st, T + ' has fallen to the ' + by + (side ? ', with your help.' : '.'), 'attack'); }
      else { bleed(st, a.target); (r.fails[a.by] = r.fails[a.by] || []).push(day(st)); C.relNews(st, 'The ' + on + ' beat off the ' + by + ' at ' + T + (side ? ', with your help.' : '.'), 'attack'); }
      return { won, side: side || null };
    }
    C.attackSettle = settle;

    C.attackTick = function (st) {
      const r = AS(st);
      for (const a of r.list.slice()) {
        if (!C.relAtWar(st, a.by, a.on) || C.ownerOf(st, a.target) !== a.on) { callOff(st, a); continue; }
        if (day(st) >= a.lands) settle(st, a, null);
      }
      let cut = new Set(C.supplyCut(st)); r.moved = r.moved || {}; C.grabTick(st, cut);
      for (const f of WAR()) if (r.moved[f] == null || day(st) - r.moved[f] >= A.redeployEvery) { if (C.relEnemies(st, f).some(g => g !== 'hearthwatch')) { C.redeploy(st, f, cut); r.moved[f] = day(st); } }
      for (const f of WAR()) {
        if (r.list.filter(a => a.by === f).length >= A.maxActive) continue;
        if (r.last[f] != null && day(st) - r.last[f] < A.cooldown) continue;
        const o = C.attackOptions(st, f, cut); if (!o.length) continue;
        // the best few are close in worth: pick among them so wars don't always run the same way
        const top = o.filter(x => x.score >= o[0].score - 0.5); launch(st, f, top[Math.floor(rnd(st) * top.length)]); cut = new Set(C.supplyCut(st));
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
