/* Enemy kits for campaign fights (design/enemy_kits.md). Wraps GAME_CAMPAIGN.encounterBuilds, so it touches campaign fights only;
   skirmish keeps full kits. Monsters and summons (classes that are not selectable) are left alone.
   - Every class has a gate level (K.gate), set by what it costs the player to unlock: Tier 2 from level 5, Tier 3 from level 9 or 10. Below its gate a class is closed to enemies: one written into a fight steps down the class
     tree (C.capClass), and none is picked as a secondary. Past the gate, enemies on an entry class may move up into it (chance ramps up level
     by level) and Tier 2 enemies into Tier 3. A fight's leader is not moved up, but is capped like everyone else; named characters and any
     enemy written with keepClass: true keep the class they were written with.
   - The story's named characters (C.NAMED) always fight as themselves: a set class with its whole kit, and a set secondary with
     three signature skills, wherever they appear.
   - Gear: each enemy's gear tier is rolled once per fight (C.GEAR_RULES): mostly one behind the fight's band, some at it, some one ahead; leaders at or above it.
   - Each enemy knows 50-75% of its class's skills, picked at random.
   - Secondary classes (from level 2): about 60% get one that fits their class, 25% none, 15% a completely random one; never a class still closed to enemies at this level. The secondary also has 50-75% of its skills.
   - Picks are made once per fight and kept, so the briefing and the battle match. Road fights keep them in the save. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, D = window.GAME_DATA, LO = window.GAME_LOADOUT;
    if (!C || !C.encounterBuilds || C.ENEMY_KITS) return; C.ENEMY_KITS = true;
    const CL = () => D.classes, sel = c => !!(CL()[c] && CL()[c].selectable);
    const K = C.KIT_RULES = {
      skillShare: [0.5, 0.75],                       // fraction of a class's skills an enemy knows
      thin: { start: 0.5, levels: 4 },               // a Tier 2 or 3 class is thinner just past its gate: the share above is x start at the gate level, rising to x 1 over this many levels (a player has only just unlocked it)
      secondary: { none: 0.25, fitting: 0.60, random: 0.15, fromLevel: 2 },
      // A class is closed to enemies below its gate level. The gate follows what it costs the player to unlock it (JP to master every class it
      // needs, about 100 JP a battle): [JP needed, first enemy level]. Entry classes are open from the start.
      gate: [[0, 1], [450, 5], [900, 5], [2900, 9], [3350, 10]],
      tier2: { 0: 0.25, 1: 0.45, 2: 0.65, 3: 0.8, 4: 0.9 },   // chance an entry-class enemy has moved up, by levels past the gate of the class it would move into (4+ uses 4)
      tier3: { 0: 0.2, 1: 0.35, 2: 0.5, 3: 0.65 }             // same for a Tier 2 enemy moving into a Tier 3 class (3+ uses 3)
    };
    // Enemy gear tier, rolled once per enemy: mostly one tier behind the fight's band, some at it, some one ahead (design/gear_tiers.md).
    // The first band (levels 1 to 7) is all tier 1. Leaders, bosses and named characters are at the band or one ahead. A `gearTier` on an enemy or fight forces it.
    const GR = C.GEAR_RULES = { behind: 0.60, at: 0.33, ahead: 0.07, leader: { at: 0.90, ahead: 0.10 } };
    const GT = () => D.gearTiers;
    C.rollGearTier = function (lv, leader, force) {
      const T = GT(); if (!T) return 1; if (force) return Math.max(1, Math.min(7, force));
      const band = T.tierForLevel(lv); if (band <= 1) return 1;
      const r = rnd(), t = leader ? (r < GR.leader.at ? band : band + 1) : (r < GR.behind ? band - 1 : r < GR.behind + GR.at ? band : band + 1);
      return Math.max(1, Math.min(7, t));
    };
    const at = (tbl, n) => { let v = 0; Object.keys(tbl).map(Number).sort((a, b) => a - b).forEach(k => { if (n >= k) v = tbl[k]; }); return n < 0 ? 0 : v; };
    // JP the player needs to unlock a class: the cost of mastering every class it needs, all the way down.
    const needs = (c, set) => { (CL()[c].requires || []).forEach(r => { if (!set.has(r)) { set.add(r); needs(r, set); } }); return set; };
    const unlockJP = c => { const S = window.GAME_SAVE; return S && S.classCost ? [...needs(c, new Set())].reduce((n, r) => n + S.classCost(r), 0) : 0; };
    C.unlockJP = unlockJP;
    const gates = {};
    C.classGate = c => { if (gates[c] === undefined) { const j = unlockJP(c); let g = 1; K.gate.forEach(([need, lv]) => { if (j >= need) g = lv; }); gates[c] = g; } return gates[c]; };
    const open = (c, lv) => lv >= C.classGate(c);
    const rnd = () => Math.random(), pick = arr => arr[Math.floor(rnd() * arr.length)];
    const thinF = (c, lv) => { if (lv === undefined || !CL()[c] || CL()[c].tier < 2) return 1; return K.thin.start + (1 - K.thin.start) * Math.max(0, Math.min(1, (lv - C.classGate(c)) / K.thin.levels)); };
    C.skillShareFor = (c, lv) => { const f = thinF(c, lv); return [K.skillShare[0] * f, K.skillShare[1] * f]; };
    const share = (n, c, lv) => { const f = thinF(c, lv); return Math.max(1, Math.min(n, Math.round(n * f * (K.skillShare[0] + rnd() * (K.skillShare[1] - K.skillShare[0]))))); };
    const someOf = (list, c, lv) => { const a = list.slice(), out = []; const n = share(a.length, c, lv); while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return list.filter(x => out.includes(x)); };
    const growsFrom = c => Object.keys(CL()).filter(x => sel(x) && (CL()[x].requires || []).includes(c));
    // classes that "fit" c: what it grew from, what grows from it (if the level allows), and its partners in the class tree
    C.fittingClasses = function (c, lv) {
      const all = Object.keys(CL()).filter(sel), req = CL()[c].requires || [], o = new Set();
      req.forEach(r => o.add(r));
      all.forEach(x => { const rq = CL()[x].requires || []; if (rq.includes(c)) { o.add(x); rq.forEach(r => o.add(r)); } if (req.some(r => rq.includes(r))) o.add(x); });
      o.delete(c); return [...o].filter(x => sel(x) && open(x, lv));
    };
    C.upgradeClass = function (c, lv) {
      let p = c;
      if (CL()[p].tier === 1) { const up = growsFrom(p).filter(x => CL()[x].tier === 2 && open(x, lv)); if (up.length) { const x = pick(up); if (rnd() < at(K.tier2, lv - C.classGate(x))) p = x; } }
      if (CL()[p].tier === 2) { const up = growsFrom(p).filter(x => CL()[x].tier === 3 && open(x, lv)); if (up.length) { const x = pick(up); if (rnd() < at(K.tier3, lv - C.classGate(x))) p = x; } }
      return p;
    };
    // A class written into a fight that is still closed to enemies at this level steps down the class tree to one that is open.
    C.capClass = function (c, lv) {
      while (CL()[c] && sel(c) && !open(c, lv)) { const dn = (CL()[c].requires || []).filter(x => sel(x)); if (!dn.length) break; const ok = dn.filter(x => open(x, lv)); c = pick(ok.length ? ok : dn); }
      return c;
    };
    C.rollKit = function (b, lv, opts) {
      opts = opts || {}; if (!sel(b.primary)) return null;
      const base = opts.cap === false ? b.primary : C.capClass(b.primary, lv), kit = { primary: opts.upgrade ? C.upgradeClass(base, lv) : base };
      kit.skills = b.skills ? b.skills.slice() : someOf(CL()[kit.primary].ab, kit.primary, lv);
      let sec = b.secondary && sel(b.secondary) && open(b.secondary, lv) ? b.secondary : null;
      if (!sec && lv >= K.secondary.fromLevel) { const r = rnd(), all = Object.keys(CL()).filter(x => sel(x) && x !== kit.primary && open(x, lv));
        if (r >= K.secondary.none) sec = r < K.secondary.none + K.secondary.fitting ? (pick(C.fittingClasses(kit.primary, lv)) || pick(all)) : pick(all); }
      if (sec) { kit.secondary = sec; kit.secSkills = b.secSkills ? b.secSkills.slice() : someOf(CL()[sec].ab.filter(a => !CL()[kit.primary].ab.includes(a)), sec, lv); }
      return kit;
    };
    // The story's named characters: a set class (whole kit) and a set secondary (three signature skills), the same every time.
    C.NAMED = {
      'Lord Osric':           { primary: 'warlord',    secondary: 'bulwark',   secSkills: ['phalanx', 'hold', 'crushing'] },        // leads from behind a wall of Aldermere spears
      'Lord Marshal Voss':    { primary: 'paladin',    secondary: 'warlord',   secSkills: ['command_strike', 'rally_point', 'decisive_blow'] }, // the realm's old knight, and its marshal
      'Brannoc Thorne':       { primary: 'inquisitor', secondary: 'warrior',   secSkills: ['bash', 'riposte', 'execute'] },         // the Synod's hunter; finishes what he starts
      'Captain Old Standard': { primary: 'warlord',    secondary: 'berserker', secSkills: ['reckless', 'bloodlust', 'hemorrhage'] }, // eighteen years with the banner; first blood
      'Inquisitor-Captain':   { primary: 'inquisitor', secondary: 'wizard',    secSkills: ['fire', 'frost', 'bolt'] },              // hunts mages with magic
      'Aldermere Captain':    { primary: 'warlord',    secondary: 'warrior',   secSkills: ['cleave', 'bash', 'taunt'] }             // a frontline officer
    };
    C.KEEP_CLASS = new Set(Object.keys(C.NAMED));
    const memo = {};
    const today = () => { try { const s = window.GAME_SHELL && window.GAME_SHELL.state && window.GAME_SHELL.state(); return s ? s.world.day : (C._storyState ? C._storyState.world.day : 0); } catch (e) { return 0; } };
    const eb0 = C.encounterBuilds;
    C.encounterBuilds = function (encId, optionId) {
      const info = eb0.apply(this, arguments); if (!info || !info.builds) return info;
      const E = C.ENCOUNTERS[encId] || {}, lv = info.level || info.rec || 1;
      const lead = info.objective && info.objective.type === 'leader' ? (info.objective.leader || 0) : -1;
      const key = encId + '|' + (optionId || '') + '|' + today();
      let kits = encId === 'wander' ? E._kits : memo[key];
      if (!kits || kits.length !== info.builds.length) {
        kits = info.builds.map((b, i) => { const src = (E.enemies || [])[i] || {}, N = C.NAMED[b.name];
          if (N && sel(N.primary)) return { primary: N.primary, skills: CL()[N.primary].ab.slice(), secondary: N.secondary, secSkills: N.secSkills.filter(a => CL()[N.secondary].ab.includes(a)) };
          return C.rollKit(b, lv, { upgrade: i !== lead && !src.keepClass, cap: !src.keepClass }); });
        kits.forEach((kit, i) => { if (kit) { const src = (E.enemies || [])[i] || {}, b = info.builds[i]; kit.gearTier = C.rollGearTier(lv, i === lead || !!C.NAMED[b.name], src.gearTier || E.gearTier); } });
        if (encId === 'wander') E._kits = kits; else memo[key] = kits;
      }
      info.builds.forEach((b, i) => { const k = kits[i]; if (!k) return;
        if (k.primary !== b.primary) { const was = b.primary; b.primary = k.primary; b.gear = LO.cleanGear(k.primary, LO.defaultGear(k.primary), b.passives || []); if (b.name === (D.classes[was] || {}).name) b.name = D.classes[k.primary].name; }
        if (k.gearTier > 1 && GT()) b.gear = LO.cleanGear(b.primary, GT().tierGear(b.gear, k.gearTier), b.passives || []);
        b.skills = k.skills; if (k.secondary) { b.secondary = k.secondary; b.secSkills = k.secSkills; } });
      // reward items take the fight's level band (a dungeon's last floor one above); the encounter record itself is not changed
      if (info.reward && info.reward.items && C.rewardTier && GT()) { const rt = C.rewardTier(encId, lv), items = {}; for (const id in info.reward.items) { const n = info.reward.items[id], to = GT().tierItem(id, rt); items[to] = (items[to] || 0) + n; } info.reward = Object.assign({}, info.reward, { items }); }
      return info;
    };
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.encounterBuilds) go();
  else if (typeof setTimeout === 'function') { let n = 0; (function wait() { if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.encounterBuilds) return go(); if (++n < 400) setTimeout(wait, 25); })(); }
})();
