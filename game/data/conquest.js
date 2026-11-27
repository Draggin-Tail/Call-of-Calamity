/* The player's wars (design/node_ownership_and_land.md, Phase 4d). Pure rules, no screens. Needs attacks.js, relations.js, unification.js and plots.js.
   - Ordering an attack: from rank 3, at a hall or the capital of your own faction, you can order an attack on a place held by a faction yours
     is at war with. It is an ordinary attack (the 3c and 3d rules: the warning, the muster, the defender's answer, the siege stages), launched
     from your faction's supplied place within marching reach that can gather the biggest army. No margin is needed: you chose it. One order at
     a time, and it does not use up your faction's own attacks or its wait between them. Step in at the place to fight a stage, or it is rolled.
   - The Hearthwatch: it never makes war, and no AI faction attacks it. From rank 4, at the same halls, you can move against it in council:
     war at once. It costs all your Hearthwatch goodwill, and standing with every faction that values mercy (your own too, if it does).
     An alliance with it breaks. After that only your orders attack its places; it never musters or strikes back.
   - The Hearthstone Priory is its capital (four stages, the last stand against Mother Agathe). Brimstone Chapel, in orc land, does not keep it
     safe. Taking the Priory ends the Hearthwatch: its places go to the taker, and four hidden refuges, one per old human area, come to light.
     They heal and shelter you like the chapels did, whatever you have done.
   - Capital gear: when a capital falls, its piece goes to you if you fought at its last stand (on either side) or ordered the attack.
     The items are in uniques.js (the plotters' leaders' pieces are first clears of their strongholds).
   A wiped-out faction's old capital becomes an ordinary place (three stages, like a castle): C.fallenCapitalSync, run on every sync.
   State: st.world.conquest ({ hearth: { day, by, faction } } once you moved against it; fell: { day, by }). Attacks carry `led` and `lastFought`. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE, D = window.GAME_DATA;
    if (!C || !S || !D || !C.ATTACK || !C.attackLaunch || !C.relDeclareWar || !C.UNION || !C.unionSync || !C.PLOT || !C.rumourSkip || !C.nodeServices || !C.applyEncounterResult || C.CONQUEST) return false;
    const HW = 'hearthwatch', PRIORY = 'hearthstone_priory';
    const K = C.CONQUEST = {
      leadRank: 3, motionRank: 4, motionRel: -0.95, mercyCost: 10,
      odds: { good: 0.6, even: 0.4 },
      gear: { crown: 'keep_wardens_plate', syndicate: 'gildhaven_key', synod: 'voldun_canon', broken_banner: 'outlaws_bell', hearthwatch: 'priory_hearthstone' },
      // one hidden refuge per old human area, a day from a quiet place
      refuges: [
        { id: 'refuge_mill_loft', name: 'The Mill Loft', parent: 'duskwater_mill', area: 'crownlands', d: [0.014, -0.012],
          desc: 'A loft over the mill-wheel, reached by a ladder the miller pulls up at night. A lamp in the window means there is room.' },
        { id: 'refuge_shepherds_hut', name: "The Shepherd's Hut", parent: 'ragged_fence', area: 'free_marches', d: [-0.014, 0.012],
          desc: 'A stone hut on the high grazing, with a fire laid and a pot on the hook. Whoever keeps it is never there when you arrive.' },
        { id: 'refuge_cask_cellar', name: 'The Cask Cellar', parent: 'cask_hollow', area: 'river_cities', d: [0.014, 0.012],
          desc: 'A cellar behind the empty casks, with straw beds and a lamp that is never let go out.' },
        { id: 'refuge_quiet_room', name: 'The Quiet Room', parent: 'pale_vigil', area: 'voldun', d: [-0.014, -0.012],
          desc: 'A back room in Pale Vigil, behind a door with no handle. The healer who kept it is gone. Someone else keeps it now.' }
      ]
    };
    const day = st => st.world.day, fname = f => (D.factions[f] && D.factions[f].name) || f, nm = id => C.NODES[id].name;
    const CS = st => st.world.conquest || (st.world.conquest = {});
    const sworn = st => (S.sworn ? S.sworn(st) : null);
    const rankIn = (st, f) => { const r = f && S.getRank ? S.getRank(st, f) : null; return r && !r.dormant ? r.rank : 0; };
    const isHall = (st, id, f) => { const n = C.NODES[id]; return !!n && C.ownerOf(st, id) === f && (n.type === 'capital' || !!n.seat); };
    const warFaction = f => !!f && f !== HW && C.REL.factions.includes(f);

    // ---- the Priory is the Hearthwatch's capital, until it falls (global data: synced per save) ----
    C.NODES[PRIORY].hearthSeat = true;
    C.hearthFallen = st => !!(C.fallen && C.fallen(st, HW));
    C.hearthSync = function (st) { const n = C.NODES[PRIORY]; if (st && C.hearthFallen(st)) { n.capital = null; n.formerCapital = true; } else { n.capital = HW; delete n.formerCapital; } };
    // a faction wiped out leaves an ordinary place behind (decided with the user in 4d): its old capital loses the mark, so whoever holds
    // it now can lose it like any castle. The union handles the absorbed factions; this handles the fallen. Global data, synced per save.
    C.fallenCapitalSync = function (st) {
      const fl = (st && st.world.fallen) || {};
      Object.keys(C.NODES).forEach(id => { const n = C.NODES[id], f = n.capital; if (f && fl[f] && !n.stronghold) { n.capital = null; n.formerCapital = true; } });
    };
    { const us0 = C.unionSync; C.unionSync = function (st) { const r = us0.apply(this, arguments); C.hearthSync(st); C.fallenCapitalSync(st); return r; }; }
    C.hearthSync(null);

    // ---- the refuges: hidden until the Hearthwatch falls ----
    K.refuges.forEach(R => {
      const par = C.NODES[R.parent]; if (!par || C.NODES[R.id]) return;
      C.NODES[R.id] = { name: R.name, region: par.region, area: R.area, type: 'poi', pos: [+(par.pos[0] + R.d[0]).toFixed(4), +(par.pos[1] + R.d[1]).toFixed(4)], desc: R.desc,
        hidden: true, refuge: true, owner: 'neutral', links: { [R.parent]: 1 } };
      par.links[R.id] = 1; if (C.EDGES) C.EDGES.push([R.parent, R.id, 1]);
    });
    const isRefuge = id => !!(C.NODES[id] && C.NODES[id].refuge);
    { const rs0 = C.rumourSkip; C.rumourSkip = (st, id) => isRefuge(id) || rs0(st, id); }   // never turned up by rumour: they come to light when the Priory falls
    // shelter: wherever the Hearthwatch holds, the refuges included
    C.sanctuaryAt = (st, id) => C.ownerOf(st, id) === HW;

    // ---- ordering an attack ----
    C.leadOk = function (st) {
      const f = sworn(st);
      if (!warFaction(f)) return { ok: false, reason: 'You serve no faction that makes war' };
      if (rankIn(st, f) < K.leadRank) return { ok: false, reason: 'Only an officer of rank ' + K.leadRank + ' or higher can order an attack' };
      if (!isHall(st, st.world.location, f)) return { ok: false, reason: 'Orders are given at a hall or the capital of the ' + fname(f) };
      if (C.attacks(st).some(a => a.led && a.by === f)) return { ok: false, busy: true, f, reason: 'Your last order is still under way' };
      return { ok: true, f };
    };
    const oddsWord = p => p >= K.odds.good ? 'good' : p >= K.odds.even ? 'even' : 'poor';
    C.leadOptions = function (st) {
      const ok = C.leadOk(st); if (!ok.ok) return [];
      const f = ok.f, foes = C.relEnemies(st, f).filter(g => !C.fallen(st, g) && !C.talking(st, f, g)); if (!foes.length) return [];
      const cut = new Set(C.supplyCut(st)), bz = C.attackBusy(st), best = {};
      for (const L of Object.keys(C.NODES)) {
        if (C.ownerOf(st, L) !== f || cut.has(L) || bz.has(L)) continue;
        const R = C.marchReach(st, f, L); let force = null;
        for (const T of Object.keys(R)) {
          const on = C.ownerOf(st, T); if (!foes.includes(on) || bz.has(T) || !C.attackTargetable(st, T, true)) continue;
          if (force === null) force = C.attackForce(st, f, L, bz, cut);
          const b = best[T]; if (!b || force > b.force || force === b.force && R[T] < b.dist) best[T] = { target: T, on, from: L, dist: R[T], force };
        }
      }
      return Object.values(best).map(o => { o.garrison = C.defendStrength(st, o.target); o.odds = o.force / (o.force + o.garrison); o.chance = oddsWord(o.odds); o.stages = C.siegeStages(o.target); return o; })
        .sort((a, b) => b.odds - a.odds || a.dist - b.dist || (a.target < b.target ? -1 : 1));
    };
    C.leadAttack = function (st, target) {
      const ok = C.leadOk(st); if (!ok.ok) return ok;
      const o = C.leadOptions(st).find(x => x.target === target); if (!o) return { ok: false, reason: 'Your faction cannot reach ' + (C.NODES[target] ? nm(target) : 'that place') + ' from here' };
      const a = C.attackLaunch(st, ok.f, o, false, true);
      return { ok: true, attack: a, text: 'Riders leave with your orders. The ' + fname(ok.f) + ' gathers at ' + nm(o.from) + ', and will be at ' + nm(o.target) + ' within a week.' };
    };

    // ---- moving against the Hearthwatch ----
    C.hearthMotionOk = function (st) {
      const f = sworn(st);
      if (C.hearthFallen(st)) return { ok: false, reason: 'The Hearthwatch is no more' };
      if (!warFaction(f)) return { ok: false, reason: 'You serve no faction that makes war' };
      if (rankIn(st, f) < K.motionRank) return { ok: false, reason: 'Only an officer of rank ' + K.motionRank + ' can bring that to the council' };
      if (!isHall(st, st.world.location, f)) return { ok: false, reason: 'The council meets at a hall or the capital of the ' + fname(f) };
      if (C.relAtWar(st, f, HW)) return { ok: false, reason: 'You are already at war with the Hearthwatch' };
      const rs = C.relState(st), k = [f, HW].sort().join('|'); if ((rs.truce[k] || 0) > day(st)) return { ok: false, reason: 'The truce with the Hearthwatch still holds' };
      return { ok: true, f, allied: C.relAllyOf(st, f) === HW };
    };
    // who will think less of you for it: every faction that values mercy, by how much it does
    C.hearthMotionCost = st => C.REL.factions.filter(g => g !== HW && !C.fallen(st, g) && ((C.IDEALS[g] || {}).mercy || 0) > 0);
    C.hearthMotion = function (st) {
      const ok = C.hearthMotionOk(st); if (!ok.ok) return ok; const f = ok.f;
      if (ok.allied) C.relBreakAlly(st, f, HW);
      S.setRelation(st, f, HW, K.motionRel, { both: true });
      C.relDeclareWar(st, f, HW);
      const rs = C.relState(st); if (rs.pending && (rs.pending.with === HW || rs.pending.faction === HW)) rs.pending = null;
      S.changeGoodwill(st, -1000, 'moved against the Hearthwatch');
      const hurt = C.hearthMotionCost(st);
      hurt.forEach(g => S.changeStanding(st, g, -K.mercyCost * C.IDEALS[g].mercy, { reason: 'moved against the Hearthwatch', ripple: false }));
      CS(st).hearth = { day: day(st), faction: f };
      C.relNews(st, 'Word goes round that it was put to the vote in the ' + fname(f) + '\'s council, and carried.', 'war');
      return { ok: true, f, hurt, broke: !!ok.allied,
        text: 'Nobody speaks for a long time. Then the vote is taken, and it is yours. By morning the heralds are on the roads, and the lamps at the chapel doors are still lit.' };
    };

    // ---- the last stand and capital gear ----
    const lastStage = a => (a.stage || 0) === (a.stages || 1) - 1 && (a.stages || 1) === C.ATTACK.siege.stages.capital;
    { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
        const m = /^atk_(\d+)$/.exec(encId || ''); if (m && res) { const a = C.attacks(st).find(x => x.n === +m[1]); if (a && lastStage(a)) a.lastFought = true; }   // won or lost, you were there
        return ae0.apply(this, arguments); }; }
    C.capitalGear = function (st, f, by, helped, a) {
      const id = K.gear[f]; if (!id || !D.gear[id]) return null;
      if (!(helped || (a && (a.led || a.lastFought)))) return null;
      const fl = st.world.flags = st.world.flags || {}; fl['capgear_' + f] = Math.max(1, day(st));
      if (C.checkUniques) C.checkUniques(st);
      return id;
    };

    // ---- the Hearthwatch falls ----
    C.afterFall = function (st, f, by, at) {
      C.fallenCapitalSync(st);
      if (f !== HW) return null;
      C.hearthSync(st); CS(st).fell = { day: day(st), by };
      const names = [];
      K.refuges.forEach(R => { if (!C.NODES[R.id]) return; (st.world.nodes[R.id] = st.world.nodes[R.id] || {}).owner = HW; C.reveal(st, R.id); names.push(R.name); });
      C.relNews(st, 'Not every lamp has gone out. Word passes quietly of Hearthwatch refuges still open: ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + '.', 'fallen');
      return { refuges: names };
    };
    C.refuges = st => K.refuges.filter(R => C.NODES[R.id] && st.world.flags && st.world.flags['reveal_' + R.id]).map(R => R.id);

    C.validateConquest = function () {
      const p = [];
      Object.entries(K.gear).forEach(([f, id]) => { if (!D.gear[id] || !D.gear[id].unique) p.push('conquest: no unique ' + id + ' for ' + f); });
      K.refuges.forEach(R => { if (!C.NODES[R.parent]) p.push('conquest: unknown refuge parent ' + R.parent); if (!C.NODES[R.id]) p.push('conquest: refuge not placed ' + R.id); });
      if (!C.NODES[PRIORY]) p.push('conquest: no Hearthstone Priory');
      if (!C.ATTACK.squads[HW]) p.push('conquest: no Hearthwatch squad');
      return p;
    };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
