/* Roads that slow the map down (design/roadblocks.md). Pure rules, no screens.
   1. Border gates: the first time you cross into a land you have never set foot in, its holder's people stop you on the border road.
      Three ways through: be known to them, pay the toll, or force your way past. Or turn back.
   2. Roadblocks: every week or so, a road toward somewhere you have not been yet is blocked: brigands, wolves, webs, opened graves,
      a bear, a flooded ford. Fight through, find a way round (days), or deal with it another way.
   Both are road events (st.world.wander, kind 'obstacle'), shown by the shell's road sheet. */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
  if (C.ROADS) return; C.ROADS = true;
  const fl = st => st.world.flags, N = id => C.NODES[id];
  const visited = (st, id) => !!(st.world.nodes[id] && st.world.nodes[id].visited);
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const rnd = st => { let x = (st.world.rbSeed || (st.world.day * 7919 + 17)) | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; st.world.rbSeed = x || 1; return ((x >>> 0) % 100003) / 100003; };   // saved with the game, so a reload gives the same road
  const regionName = r => (C.REGIONS[r] || {}).name || r;
  const fname = f => (window.GAME_DATA.factions[f] || {}).name || f;
  const HUMAN = ['crownlands', 'free_marches', 'voldun', 'river_cities'];
  const setFight = (st, w, enc) => { st.world.wander = Object.assign({}, w, { kind: 'fight', enc, text: w.fightText || w.text }); C.ENCOUNTERS.wander = enc; return { ok: true, fight: true }; };
  const encFor = (st, w, name, faction, enemies, extra) => { const lv = lvl(st) + (extra || 0);
    return { name, map: C.mapFor(st, w.region, w.to), rec: lv, enemyFaction: faction, enemies: enemies.map(e => Object.assign({}, e)), objective: null, once: false, wander: true, obstacle: w.obstacle, gate: w.gate || null,
      reward: { xp: Math.round((40 + 14 * lv) * 0.7), gold: 12 + 5 * lv } }; };
  const more = (st, list, base) => { const n = Math.min(list.length, base + Math.floor(lvl(st) / 3)); return list.slice(0, n); };   // bigger groups as you grow

  // ===== 1. Border gates =====
  // The gate sits on the road where the land changes. You pass it once; after that the border knows you.
  const gateStop = (from, to) => N(from).type === 'road' ? from : N(to).type === 'road' ? to : from;
  C.gateAt = function (st, from, to) {
    if (!N(from) || !N(to) || N(from).region === N(to).region) return null;
    const stop = gateStop(from, to); if (fl(st)['gate_' + stop]) return null;
    // been in that land before (an older save, or coming home): no gate
    if (Object.keys(st.world.nodes).some(id => visited(st, id) && N(id) && N(id).region === N(to).region)) { fl(st)['gate_' + stop] = Math.max(1, st.world.day); return null; }
    const holder = C.ownerOf(st, to) || (C.REGIONS[N(to).region] || {}).faction || 'outlaws';
    return { stop, holder, region: N(to).region, human: HUMAN.includes(N(to).region) };
  };
  const GATE_TEXT = {
    harvest_road: 'A Synod toll-chapel stands across the Harvest Road. Two wardens with lamps look over everyone going east into Vol\'Dun, and write down what they see.',
    fallow_gate: 'A Crown post bars the road north into the Marches: a timber gate, a fire, and a sergeant who has stopped believing anyone\'s papers.',
    willow_flats: 'A Syndicate weigh-gate spans the road into the River Cities. Nothing goes in or out without a receipt, and that includes you.',
    arch_mile: 'An arch of old stone, and under it Synod wardens checking hands and faces for the marks of magic.',
    dry_culvert: 'The culvert road is barred by a Crown picket. They are watching for Vol\'Dun\'s inquisitors as much as for raiders.',
    kings_mile: 'Where the King\'s Mile enters the old forest, Canopy Wardens step out of the trees with bows half-drawn. The forest does not welcome humans.'
  };
  const gateText = (st, g) => GATE_TEXT[g.stop] || ('The border into ' + regionName(g.region) + ' is held. ' + fname(g.holder) + ' guards stand across the road and look you over: a stranger, from the wrong side.');
  const known = (st, g) => {
    if (g.stop === 'kings_mile' && fl(st).banner_contact) return 'Hask\'s name opens the way: a Banner scout leads you round the Wardens by a deer path.';
    if (S.getRank && S.getRank(st, g.holder)) return 'You show your rank. They step aside.';
    if (S.getStanding(st, g.holder) >= 100) return 'One of them knows your name. "Let this one through."';
    return null; };
  const price = (st, B) => Math.round(B.pay.cost(st) * (C.costMult ? C.costMult(st) : 1));
  const toll = (st, g) => Math.round((g.human ? 25 : 50 + 5 * lvl(st)) * (C.costMult ? C.costMult(st) : 1));
  function gateEvent(st, from, to, g) {
    const w = { kind: 'obstacle', obstacle: 'gate', gate: g.stop, holder: g.holder, region: g.region, from, to, day: st.world.day, human: g.human,
      title: 'The border', text: gateText(st, g) + '\n\nBeyond it lies ' + regionName(g.region) + ', land you have never walked.',
      fightText: 'You force the gate.' };
    st.world.wander = w; return w;
  }

  // ===== 2. Roadblocks =====
  const BLOCKS = {
    barricade: { title: 'A barricade', text: 'A cart has been tipped across the road and lashed in place. Behind it, brigands with crossbows and a man with a ledger.\n\n"Road\'s closed," he says. "Unless it isn\'t. That depends on you."',
      fight: { name: 'Barricade brigands', faction: 'outlaws', enemies: [['rogue', 'Brigand'], ['archer', 'Brigand Crossbow'], ['warrior', 'Brigand Chief'], ['rogue', 'Brigand'], ['berserker', 'Hired Axe']], base: 3 },
      pay: { label: 'Pay their "road fee"', cost: st => 20 + 5 * lvl(st), text: 'The man with the ledger writes your name down and waves you on. You suspect you are now on a list.' },
      detour: 1 },
    wolves: { title: 'Wolves on the road', text: 'Wolves have denned in the hollow beside the road. A dead mule lies half-eaten in the ditch, and the pack is watching you from the bracken.',
      fight: { name: 'Dire wolf pack', faction: 'wild', enemies: [['dire_wolf', 'Dire Wolf'], ['dire_wolf', 'Dire Wolf'], ['dire_wolf', 'Pack Leader'], ['dire_wolf', 'Dire Wolf'], ['dire_wolf', 'Dire Wolf']], base: 2 },
      pay: { label: 'Leave them meat and walk past slowly', cost: () => 10, text: 'They take the meat. Every head turns as you pass. None of them follow.' },
      detour: 1 },
    webs: { title: 'Webs across the road', text: 'Where the road runs under the trees, something has strung it with grey web, thick as rope. Things hang in it. Some of them are still moving.',
      fight: { name: 'Webspinners', faction: 'wild', enemies: [['giant_spider', 'Giant Spider'], ['giant_spider', 'Giant Spider'], ['giant_spider', 'Brood Mother'], ['giant_spider', 'Giant Spider']], base: 2 },
      detour: 2 },
    graves: { title: 'Opened graves', text: 'The roadside graveyard has been opened from the inside. As the light goes, shapes climb out of the earth and stand in the road, waiting.',
      fight: { name: 'Ghoul pack', faction: 'wild', enemies: [['ghoul', 'Ghoul'], ['ghoul', 'Ghoul'], ['bone_archer', 'Grave Archer'], ['ghoul', 'Ghoul']], base: 2, min: 3 },
      wait: { label: 'Make camp and wait for dawn (1 day)', days: 1, text: 'At first light the road is empty, and the graves are only graves again.' },
      detour: 1 },
    bear: { title: 'A bear on the bridge', text: 'A cave bear has made the old bridge its own. It sits in the middle, eating something, and looks at you as if you might be next.',
      fight: { name: 'Cave bear', faction: 'wild', enemies: [['cave_bear', 'Cave Bear'], ['dire_wolf', 'Hungry Wolf'], ['dire_wolf', 'Hungry Wolf']], base: 1, min: 3 },
      pay: { label: 'Throw it your rations and slip past', cost: () => 15, text: 'It is busy with your supper. You are across before it looks up.' },
      detour: 2 },
    flood: { title: 'The ford is in flood', text: 'Rain in the hills has turned the ford into a brown torrent. A ferryman sits on the bank with a rope and a boat that has seen better days.',
      pay: { label: 'Pay the ferryman', cost: st => 10 + 2 * lvl(st), text: 'The boat leaks, the ferryman sings, and you arrive wet but whole.' },
      wait: { label: 'Wait for the water to drop (1 day)', days: 1, text: 'By the next evening the river is back in its bed.' },
      detour: 2 }
  };
  const blockKinds = (st, to) => { const r = N(to).region, out = ['barricade', 'wolves', 'flood'];
    if (lvl(st) >= 2) out.push('webs'); if (lvl(st) >= 3) out.push('graves', 'bear');
    if (r === 'goblin_fens') out.push('webs', 'flood'); if (r === 'dwarven_holds' || r === 'iceflow') out.push('bear', 'wolves'); if (r === 'elven_realms') out.push('webs', 'wolves');
    return out.filter(k => !BLOCKS[k].fight || !BLOCKS[k].fight.min || lvl(st) >= BLOCKS[k].fight.min); };
  C.ROADBLOCK = { first: 5, every: 7, spread: 5 };
  function blockDue(st, from, to) {
    const R = C.ROADBLOCK; if (st.world.rbNext === undefined) st.world.rbNext = R.first;
    if (st.world.day < st.world.rbNext) return false;
    if (visited(st, to) || N(to).type === 'road' || N(from).region !== N(to).region) return false;   // only on the way somewhere new, not at the borders
    const f = fl(st); if (f.opening && !f.guide_done && !f.guide_off && !f.guide_none) return false;   // not during the guided first week
    return true;
  }
  function blockEvent(st, from, to) {
    const ks = blockKinds(st, to), k = ks[Math.floor(rnd(st) * ks.length)], B = BLOCKS[k];
    st.world.rbNext = st.world.day + C.ROADBLOCK.every + Math.floor(rnd(st) * C.ROADBLOCK.spread);
    const w = { kind: 'obstacle', obstacle: k, region: N(to).region, from, to, day: st.world.day, title: B.title, text: B.text + '\n\nThe road to ' + N(to).name + ' runs on beyond it.', fightText: B.title + '.' };
    st.world.wander = w; return w;
  }

  // ===== the choices at a gate or a roadblock =====
  C.obstacleOptions = function (st, w) {
    if (!w || w.kind !== 'obstacle') return [];
    if (w.obstacle === 'gate') { const g = { stop: w.gate, holder: w.holder, human: w.human }, k = known(st, g), t = toll(st, g);
      return [{ id: 'known', label: 'Let them see who you are', ok: !!k, note: k ? null : 'They do not know you here. Not yet.', hint: k ? 'You have friends on this side of the border.' : null },
        { id: 'pay', label: 'Pay the border toll (' + t + ' g)', ok: st.inventory.gold >= t, hint: 'The polite way through.' },
        { id: 'fight', label: 'Force your way past', ok: true, hint: fname(w.holder) + ' will not forget it.' },
        { id: 'turn', label: 'Turn back', ok: true, hint: 'The border will still be here.' }]; }
    const B = BLOCKS[w.obstacle], out = [];
    if (B.fight) out.push({ id: 'fight', label: 'Fight through', ok: true, hint: 'Clear the road. Lose, and you wake where you set out.' });
    if (B.pay) { const c = price(st, B); out.push({ id: 'pay', label: B.pay.label + ' (' + c + ' g)', ok: st.inventory.gold >= c }); }
    if (B.wait) out.push({ id: 'wait', label: B.wait.label, ok: true });
    out.push({ id: 'detour', label: 'Find another way round (' + B.detour + ' day' + (B.detour > 1 ? 's' : '') + ')', ok: true, hint: 'Slower, and safe.' });
    out.push({ id: 'turn', label: 'Turn back', ok: true });
    return out;
  };
  C.resolveObstacle = function (st, choice) {
    const w = st.world.wander; if (!w || w.kind !== 'obstacle') return { ok: false, reason: 'Nothing in the road' };
    const o = C.obstacleOptions(st, w).find(x => x.id === choice); if (!o || !o.ok) return { ok: false, reason: 'Not possible' };
    const pass = text => { if (w.gate) fl(st)['gate_' + w.gate] = Math.max(1, st.world.day); st.world.wander = null; return { ok: true, passed: true, text }; };
    if (choice === 'turn') { C.turnBack(st, w.from); return { ok: true, turned: true, text: 'You turn back.' }; }
    if (w.obstacle === 'gate') {
      if (choice === 'known') return pass(known(st, { stop: w.gate, holder: w.holder }));
      if (choice === 'pay') { const t = toll(st, { human: w.human }); st.inventory.gold -= t; return pass('You pay the toll. The gate swings open, and the border knows you now.'); }
      const P = C.PATROLS[w.holder], enemies = P ? P.enemies : [{ primary: 'warrior', name: 'Border Guard' }, { primary: 'archer', name: 'Border Archer' }, { primary: 'warrior', name: 'Border Guard' }];
      return setFight(st, w, encFor(st, w, 'The border gate', P ? w.holder : 'outlaws', enemies, w.human ? 0 : 1));
    }
    const B = BLOCKS[w.obstacle];
    if (choice === 'fight') return setFight(st, w, encFor(st, w, B.fight.name, B.fight.faction, more(st, B.fight.enemies, B.fight.base).map(([primary, name]) => ({ primary, name }))));
    if (choice === 'pay') { st.inventory.gold -= price(st, B); return pass(B.pay.text); }
    if (choice === 'wait') { S.advanceDay(st, B.wait.days); return pass(B.wait.text); }
    if (choice === 'detour') { S.advanceDay(st, B.detour); return pass('You leave the road and find another way. It costs you ' + B.detour + ' day' + (B.detour > 1 ? 's' : '') + '.'); }
    return { ok: false, reason: 'Not possible' };
  };

  // the road roll: a gate first, then whatever the road was going to bring, then (if the road was quiet) a roadblock
  { const rw0 = C.rollWander; C.rollWander = function (st, from, to, days) {
      const g = C.gateAt(st, from, to); if (g) return gateEvent(st, from, to, g);
      const r = rw0.apply(this, arguments); if (r) return r;
      if (blockDue(st, from, to)) return blockEvent(st, from, to);
      return r; }; }
  // winning a gate fight opens the gate (and the holder remembers how); fleeing a gate fight leaves you on your own side
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) { const E = C.ENCOUNTERS[encId], out = ae0.apply(this, arguments);
      if (E && E.gate && res && res.won) { fl(st)['gate_' + E.gate] = Math.max(1, st.world.day); S.changeStanding(st, E.enemyFaction, -15, { reason: 'forced the border', ripple: false }); }
      return out; }; }
  { const fl0 = C.flee; C.flee = function (st) { const w = st.world.wander, r = fl0.apply(this, arguments); if (w && w.enc && w.enc.gate && w.from) { st.world.location = w.from; r.turnedBack = true; } return r; }; }
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.STORY_WORLD) go(); else { const t = setInterval(() => { if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.STORY_WORLD) { clearInterval(t); go(); } }, 20); }
})();
