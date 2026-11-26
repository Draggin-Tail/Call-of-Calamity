window.GAME_DATA = window.GAME_DATA || {};

/* Headless battle engine for sim.html.
   THIS IS A PORT OF THE BATTLE CODE IN index.html (v. "scored AI"): the same turn order, damage pipeline, casts, statuses, traps,
   summons, movement and the same enemy AI (aiStep / aiConfused), run synchronously with no board drawing, log or sound.
   Function names match index.html on purpose (hurt, resolveAct, act, startCast, resolveCast, advance, nextTurn, endTurn, reach, moveTo,
   aiStep ...), so a rule change in index.html can be copied across line by line.
   Both sides are played by the game's enemy AI (the player side has no AI of its own in the game).
   Not simulated: campaign objectives (every battle is "defeat all enemies"), party placement, enemy kits (random skill subsets) and levels
   other than the one chosen in sim.html. Check drift with tools/parity.js (real game vs this file; see design/sim_notes.md). */
(function () {
  const ENTRY_IDS = ['squire', 'scout', 'acolyte', 'apprentice'];
  const LD = () => window.GAME_LOADOUT;
  const TR = () => window.GAME_TRIGGERS;

  // ------------------------------------------------------------------ loadouts (sim-only: random builds for balance runs)
  function rollLoadout(classId, cls) {
    const el = document.getElementById('buildMode');
    const mode = el ? el.value : 'base';
    if (cls.selectable === false) return { gear: {}, passives: [] };
    // Gear tier (design/gear_tiers.md): every unit's gear is moved to the chosen tier (1 to 7) with GAME_DATA.gearTiers.tierItem. Uniques are never in the pool.
    const tierSel = document.getElementById('gearTier'), tierN = tierSel ? (parseInt(tierSel.value, 10) || 1) : 1, GT = GAME_DATA.gearTiers;
    const tiered = g => { if (tierN > 1 && GT) for (const sl of Object.keys(g)) if (g[sl]) g[sl] = GT.tierItem(g[sl], tierN); return g; };
    if (mode !== 'equipped' && mode !== 'gear') return { gear: tiered(Object.assign({}, LD().defaultGear(classId))), passives: [] };
    const P = GAME_DATA.passives || {}, innate = LD().innateOf(classId);
    const pKeys = Object.keys(P).filter(k => !innate.includes(k) && !(P[k].innateFor));
    const passives = [];
    while (mode === 'equipped' && passives.length < Math.min(2, pKeys.length)) { const k = pKeys[Math.floor(Math.random() * pKeys.length)]; if (!passives.includes(k)) passives.push(k); }
    const gear = {};
    const pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    gear.MainHand = pick(LD().itemsFor(classId, 'MainHand', passives));
    // Each non-weapon slot is left empty some of the time so 'no off hand / no armor' shows up in the loadout data (rate in combatRules.loadout.randomEmptyChance, default 0.2).
    const emptyP = (GAME_DATA.combatRules.loadout && GAME_DATA.combatRules.loadout.randomEmptyChance !== undefined) ? GAME_DATA.combatRules.loadout.randomEmptyChance : 0.2;
    for (const sl of ['OffHand', 'Head', 'Body', 'Accessory']) { const it = pick(LD().itemsFor(classId, sl, passives, gear.MainHand)); if (it && Math.random() >= emptyP) gear[sl] = it; }
    return { gear: tiered(gear), passives };
  }

  // ------------------------------------------------------------------ battle state (module level, like index.html)
  let CR, AB, JOBS, BLD, SH, TICK, DEC, NEG;
  let W = 8, H = 8, HT = [], ROCKS = new Set();
  let units = [], traps = [], active = null, spent = 0, bonus = 0, TURN = 0, over = false, winner = null, CUR = null, FLK = false, EXO = 0;
  let TEL = null, BAT = null, FAT = null;
  let RULES_SRC = null;
  function initRules() {
    const D = GAME_DATA;
    if (RULES_SRC === D.combatRules && AB === D.abilities) return;
    RULES_SRC = D.combatRules; CR = D.combatRules; AB = D.abilities; JOBS = D.classes; BLD = CR.build; SH = window.GAME_SHAPES;
    TICK = Object.keys(CR.statuses).filter(k => CR.statuses[k].tick === 'ownTurnStart');
    DEC = Object.keys(CR.statuses).filter(k => CR.statuses[k].decrement === 'ownTurnEnd');
    NEG = Object.keys(CR.statuses).filter(k => CR.statuses[k].negative);
  }

  // ------------------------------------------------------------------ hex board (same maths as index.html)
  const cube = p => ({ q: p.x - (p.y - (p.y & 1)) / 2, r: p.y });
  const dist = (a, b) => { if (!a || !b || a.x === undefined || b.x === undefined) return 99; const A = cube(a), B = cube(b), dq = A.q - B.q, dr = A.r - B.r; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
  const nbrs = (x, y) => (y & 1 ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]]).map(([dx, dy]) => [x + dx, y + dy]);
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const ht = (x, y) => (HT[y] && HT[y][x] !== undefined) ? HT[y][x] : 0;
  const rockAt = (x, y) => ROCKS.has(x + ',' + y);
  const alive = () => units.filter(u => u.hp > 0);
  const at = (x, y) => alive().find(u => u.x === x && u.y === y);

  function flank(u, t) { // an ally of the attacker stands on the opposite side of the target
    if (dist(u, t) !== 1) return false;
    const A = cube(u), T = cube(t), q = 2 * T.q - A.q, r = 2 * T.r - A.r, o = at(q + (r - (r & 1)) / 2, r);
    if (o && o !== u && o.team === u.team) return true;
    const wide = (u.trig.onFlankCheck || []).some(x => (x.spec.effects || []).some(e => e.type === 'flankHexes' && e.value === 'rear3'));
    if (wide) return nbrs(t.x, t.y).some(([x, y]) => { const w = at(x, y); return w && w !== u && w.team === u.team && dist(u, { x, y }) === 2; });
    return false;
  }

  // ------------------------------------------------------------------ units (index.html mk)
  const newSt = () => Object.fromEntries(Object.entries(CR.statuses).filter(([, v]) => !v.storedOn).map(([k]) => [k, CR.statuses[k].tick ? null : 0]));
  const sp = u => Math.max(CR.turn.minSpeed, u.spd + LD().speedMod(u));
  const ppt = () => CR.turn.pointsPerTurn + (active ? LD().apMod(active) : 0);   // Fatigue and Orders change the turn's points
  const left = () => ppt() + bonus - spent;
  const rootOf = u => u.root || u.job;

  function createUnit(classId, team, pos, idx, secId, raceId, level) {
    const J = JOBS[classId];
    const secCls = secId && JOBS[secId] && secId !== classId ? JOBS[secId] : null;
    const sec = secCls ? secCls.ab.filter(a => AB[a] && !J.ab.includes(a)) : [];
    const lo = rollLoadout(classId, J);
    const dv = LD().derive(classId, lo.gear, lo.passives, raceId);
    const trig = {};
    dv.sources.forEach(sr => { if (TR()) TR().normalize(sr.src).forEach((sp2, i) => { (trig[sp2.on] = trig[sp2.on] || []).push({ id: sr.id + '#' + i, spec: sp2 }); }); });
    const lm = LD().levelMods(level || 1), stat = dv.stat, hp = Math.round((J.hp + stat.hp) * lm.hp);
    return {
      lvl: lm.level, lvPow: lm.power, job: classId, root: classId, team, baseTeam: team, id: team + '_' + idx + '_' + classId, n: J.name + ' ' + team + idx,
      hp, max: hp, spd: J.spd + stat.spd, mv: J.mv + stat.mv, jump: (J.jump || CR.height.defaultClimb) + stat.jump,
      ab: [dv.attackId].concat(J.ab, sec), secAbs: new Set(sec), secId: secCls ? secId : null, mods: { cost: dv.cost, power: dv.power },
      wpn: dv.wpn, attackId: dv.attackId, armor: dv.armor, bldArmor: dv.bloodiedArmor, bldRes: dv.bloodiedRes, rangedReduce: dv.rangedReduce, apBonus: dv.apBonus || 0, pushImmune: dv.pushImmune, res: dv.res, elemRes: dv.elemRes,
      spellPow: dv.spellPow, healPow: dv.healPow, crit: dv.crit, canGuard: dv.guard, mana: dv.manaMax, manaMax: dv.manaMax, manaRegen: dv.manaRegen,
      gearIds: dv.gear, passiveIds: dv.passives, x: pos[0], y: pos[1], meter: CR.turn.startingMeter, guard: false, charge: 0, cd: {}, st: newSt(),
      castHaste: stat.castHaste || 0, painPower: (J.painPower || 0) + (dv.painPower || 0), quarry: null, metaNow: null, cast: null, hasMovedThisTurn: false, movedAny: false, trig, tf: {}, bf: {}, armed: [], usedAb: new Set(), dead: false
    };
  }
  // Point costs after the secondary penalty, passives and gear.
  const moveCost = u => Math.max(BLD.minMoveCost, CR.turn.moveCost + (u.mods.cost.move || 0));
  const guardCost = u => (JOBS[u.job].guard === null || !u.canGuard) ? null : Math.max(BLD.minGuardCost, JOBS[u.job].guard + (u.mods.cost.guard || 0));
  const qcOn = (u, a) => !!(u.st && u.st.quickcast > 0 && AB[a] && AB[a].k !== 'self' && AB[a].k !== 'summon' && LD().isSpell(AB[a]));   // Apprentice: Quick Cast takes 1 AP off the next spell
  const cost = (u, a) => AB[a].free ? 0 : Math.max(BLD.minAbilityCost, AB[a].c + (u.secAbs.has(a) ? BLD.secondaryCostPenalty : 0) + (u.mods.cost[a] || 0) - (qcOn(u, a) ? 1 : 0));
  const manaCost = (u, a) => LD().manaCost(AB[a]);
  const powerBonus = (u, A, a) => LD().powerBonus(u, A, a);
  const effP = (u, A, a) => { let p = (A.p || 0) + (LD().weaponSkill(A) ? LD().weaponPart(u, A) : 0) + LD().castPart(u, A); if (A.k === 'dmg' && p > 0) p += powerBonus(u, A, a); return Math.round(p * LD().potency(u, A)); };

  // ------------------------------------------------------------------ status rules (combatRules.statuses)
  const jumpDelta = u => { let d = 0; if (u && u.st) for (const k in u.st) if (u.st[k] > 0 && CR.statuses[k] && CR.statuses[k].jumpDelta) d += CR.statuses[k].jumpDelta; return d; };
  const jumpOf = (u, extra = 0) => (u.jump || CR.height.defaultClimb) + jumpDelta(u) + extra;
  const zocPenalty = u => alive().some(f => f.team !== u.team && f.st.zoc > 0 && dist(f, u) === 1) ? CR.statuses.zoc.zocRangePenalty : 0;
  const moveRange = u => Math.max(1, u.mv - zocPenalty(u) + LD().moveMod(u));
  const stActive = (u, pred) => Object.keys(CR.statuses).find(k => u.st[k] > 0 && pred(CR.statuses[k]));
  const blocker = (u, what) => { const k = stActive(u, D => (D.blocks || []).includes(what)); return k ? CR.statuses[k].label : ''; };
  const isBlocked = (u, what) => !!blocker(u, what);
  const petOf = u => units.find(s => s.owner === u && s.hp > 0 && !s.dead);
  const hidden = t => !!t.st.vanish && !stActive(t, D => D.ignoresVanish);
  const rangeMod = u => { let d = 0; if (u && u.st) for (const k in u.st) if (u.st[k] > 0 && CR.statuses[k] && CR.statuses[k].rangeDelta) d += CR.statuses[k].rangeDelta; return d; };
  const skipsTurn = u => !!stActive(u, D => D.skipsTurn);
  const bloodiedAt = u => u.hp <= u.max * CR.resourceCosts.bloodiedThreshold;
  const blockReason = (u, a) => {
    const A = AB[a];
    if (A.needsPet && !petOf(u)) return 'no summon';
    if (A.needsBloodied && !bloodiedAt(u)) return 'not bloodied';
    if (isBlocked(u, 'ability')) return blocker(u, 'ability');
    if (A.k === 'move' && isBlocked(u, 'dash')) return blocker(u, 'dash');
    if (manaCost(u, a) > u.mana) return 'mana';
    if (LD().weaponBlocked(u, A)) return 'needs a ranged weapon';
    const k = stActive(u, D => (D.blocks || []).some(b => b.startsWith('tag:') && (A.tags || []).includes(b.slice(4))));
    return k ? CR.statuses[k].label : '';
  };

  // ------------------------------------------------------------------ reach, range, targets
  function reach(u, mv = moveRange(u), jb = 0) {
    const prev = new Map([[u.x + ',' + u.y, null]]), dd = new Map([[u.x + ',' + u.y, 0]]), q = [[u.x, u.y]], out = new Map();
    while (q.length) {
      const [x, y] = q.shift(), k0 = x + ',' + y, d = dd.get(k0);
      if (d >= mv) continue;
      for (const [nx, ny] of nbrs(x, y)) {
        const k = nx + ',' + ny;
        if (!inb(nx, ny) || dd.has(k) || rockAt(nx, ny) || Math.abs(ht(nx, ny) - ht(x, y)) > jumpOf(u, jb)) continue;
        const o = at(nx, ny);
        if (o && o.team !== u.team) continue; // enemies block, allies can be passed through
        dd.set(k, d + 1); prev.set(k, k0); q.push([nx, ny]);
        if (!o) { const path = []; for (let c = k; c !== null; c = prev.get(c)) path.unshift(c.split(',').map(Number)); out.set(k, path.slice(1)); }
      }
    }
    return out;
  }
  const slipMap = (u, a) => { const o = new Map(); for (const [k, v] of reach(u, AB[a].mv, AB[a].climbBonus || 0)) { const [x, y] = k.split(',').map(Number); if (alive().some(f => f.team !== u.team && dist(f, { x, y }) === 1)) o.set(k, v); } return o; };
  function inRange(from, A, x, y) {
    const d = dist(from, { x, y }); if (d === 0) return true;
    const dh = ht(from.x, from.y) - ht(x, y);
    if (A.r <= CR.targeting.meleeRange) return d === 1 && Math.abs(dh) <= CR.targeting.meleeMaxHeightGap;
    return d <= Math.max(CR.height.minRange, A.r + Math.trunc(dh / CR.height.rangedReach.levelsPerRange) + rangeMod(from));
  }
  function targets(u, a) {
    const A = AB[a];
    return alive().filter(t => {
      if (!inRange(u, A, t.x, t.y)) return false;
      if (A.minR && dist(u, t) < A.minR) return false;
      if (A.k === 'dmg' || A.k === 'debuff') return t.team !== u.team && (A.revealsHidden || !hidden(t));
      if (A.k === 'heal') return t.team === u.team && t.hp < t.max;
      if (A.k === 'buff') return t.team === u.team;
      return false;
    });
  }
  const summonTiles = u => nbrs(u.x, u.y).filter(([x, y]) => inb(x, y) && !rockAt(x, y) && !at(x, y) && Math.abs(ht(x, y) - ht(u.x, u.y)) <= CR.summons.maxHeightStep).map(([x, y]) => x + ',' + y);

  const isAreaSkill = A => !!A.area || A.k === 'summon';
  const groundTargeted = A => SH.isGround(A);
  const aimOf = (u, A, aim) => A.self ? { x: u.x, y: u.y } : aim;
  const aimSpec = A => (A.area === 'line' || A.area === 'cone') && (A.len || 0) > (A.r || 1) ? Object.assign({}, A, { r: A.len }) : A;
  // Metamagic (Wizard): Widen/Reach reshape the next spell. Active while the status is up, and while that spell resolves (u.metaNow).
  const metaOn = (u, k) => u.st[k] > 0 || !!(u.metaNow && u.metaNow[k]);
  const metaA = (u, A) => {
    if (!u || !A || !LD().isSpell(A) || !(u.st.widen > 0 || u.st.reach > 0 || u.metaNow)) return A;
    let o = A; if (metaOn(u, 'widen') && A.widen) o = Object.assign({}, o, A.widen);
    if (metaOn(u, 'reach') && (o.area === 'line' || o.area === 'cone')) o = Object.assign({}, o, { len: (o.len || o.r || 1) + 2 });
    return o;
  };
  function aoeFootprint(u, A, ctr) {
    A = metaA(u, A);
    const ally = A.k === 'heal' || A.k === 'buff', pool = A.k === 'trap' ? [] : alive().filter(f => ally ? f.team === u.team : f.team !== u.team && !hidden(f)), hit = new Set(), tiles = new Set();
    if (A.area === 'chain') {
      const C = CR.areaShapes.chain, tgt = pool.find(f => f.x === ctr.x && f.y === ctr.y); tiles.add(ctr.x + ',' + ctr.y); if (tgt) hit.add(tgt.x + ',' + tgt.y);
      pool.filter(f => f !== tgt && dist(f, ctr) <= C.radius).sort((a, b) => dist(a, ctr) - dist(b, ctr)).slice(0, C.extraTargets).forEach(f => hit.add(f.x + ',' + f.y));
    } else {
      SH.footprint(A, u, aimOf(u, A, ctr), inb).forEach(([x, y]) => tiles.add(x + ',' + y));
      pool.filter(f => tiles.has(f.x + ',' + f.y)).forEach(f => hit.add(f.x + ',' + f.y));
    }
    return { tiles, hit, ally };
  }
  const areaUnits = (u, A, aim) => { const fp = aoeFootprint(u, A, aim); return alive().filter(f => fp.hit.has(f.x + ',' + f.y)); };

  // ------------------------------------------------------------------ telemetry helpers
  const cls = u => (TEL && TEL.classStats[rootOf(u)]) || null;
  const abst = id => (TEL && id && TEL.abStats[id]) || null;

  // ------------------------------------------------------------------ triggers adapter (data/triggers.js)
  const cleanse = (u, n, list) => { let c = 0; for (const k of (list || NEG)) { if (c >= n) break; if (CR.statuses[k] && u.st[k]) { if (CR.statuses[k].tick) { if (n >= 99 || LD().dotPopNewest(u.st[k])) u.st[k] = null; } else u.st[k] = 0; c++; } } };   // a one-status cleanse peels the newest stack of a DoT
  function checkBloodied(u, prev) { if (prev > u.max * CR.resourceCosts.bloodiedThreshold && u.hp > 0 && bloodiedAt(u)) fire('onBloodied', u, {}); }
  function payHp(u, A) { if (!A.hpCostPct) return; const c = Math.min(Math.floor(u.hp * A.hpCostPct), u.hp - 1); if (c > 0) { const prev = u.hp; u.hp -= c; checkBloodied(u, prev); } }
  function directLoss(t, n, src) { const prev = t.hp; t.hp = Math.max(0, t.hp - n); if (TEL && n > 0) { const vc = cls(t); if (vc && !t.owner) vc.taken += Math.min(prev, n); } if (t.hp <= 0) onDeath(t, src); else checkBloodied(t, prev); }
  // Forced movement (push / pull): any drop down, climb only up; falls cost more per level; a push stopped by a unit or rock hurts too (mirrors index.html)
  const fallDmg = n => n > 0 ? n * CR.forced.fallBase + CR.forced.fallStep * n * (n - 1) / 2 : 0;
  function pushPath(t, from, hexes, dir) {   // straight line away from (or toward) the source; it never slides around an obstacle
    const px = (x, y) => [x + (y & 1 ? 0.5 : 0), y * 0.8660254];
    let x = t.x, y = t.y; const steps = []; let hit = false;
    for (let i = 0; i < hexes; i++) {
      const a0 = px(x, y), f0 = px(from.x, from.y); let vx = a0[0] - f0[0], vy = a0[1] - f0[1]; if (dir === 'pull') { vx = -vx; vy = -vy; }
      const vl = Math.hypot(vx, vy); if (vl < 1e-9) break;
      let best = null, bs = 0.5;
      for (const [a, b] of nbrs(x, y)) { const c = px(a, b), dx = c[0] - a0[0], dy = c[1] - a0[1], sc = (dx * vx + dy * vy) / (Math.hypot(dx, dy) * vl); if (sc > bs) { bs = sc; best = [a, b]; } }
      if (!best) break; const [a, b] = best;
      if (!inb(a, b)) break;
      if (dir === 'pull' && dist({ x: a, y: b }, from) < 1) break;
      if (ht(a, b) - ht(x, y) > jumpOf(t)) break;
      if (rockAt(a, b) || at(a, b)) { if (dir === 'push') hit = true; break; }
      steps.push([a, b, Math.max(0, ht(x, y) - ht(a, b))]); x = a; y = b;
    }
    return { steps, hit, fall: steps.reduce((n, s) => n + (s[2] > jumpOf(t) ? fallDmg(s[2]) : 0), 0) };
  }
  function forcedMove(t, from, hexes, dir, opts) {
    if (!from || isBlocked(t, 'forcedMove')) return;
    if (dir === 'push' && t.pushImmune) return;
    const P = pushPath(t, from, hexes, dir);
    for (const [a, b] of P.steps) { t.x = a; t.y = b; }
    trapCheck(t);
    const src = opts && opts.src;
    if (P.fall > 0 && t.hp > 0) directLoss(t, P.fall, src);
    if (P.hit && t.hp > 0) directLoss(t, CR.forced.collision, src);
  }
  const TA = {
    specsFor(o, trgName, ctx) {
      const out = (o.trig[trgName] || []).map(x => ({ id: x.id, spec: x.spec }));
      if (ctx.byOwner && ctx.ability && AB[ctx.ability] && AB[ctx.ability].triggers)
        AB[ctx.ability].triggers.forEach((sp2, i) => { if (sp2.on === trgName) out.push({ id: 'ab:' + ctx.ability + '#' + i, spec: sp2 }); });
      for (const ar of o.armed) if (ar.spec.on === trgName) out.push({ id: 'armed:' + ar.spec.label, spec: ar.spec, armed: ar });
      return out;
    },
    hpPct: u => u.hp / u.max * 100, has: (u, s) => !!u.st[s], bloodied: bloodiedAt, dist, height: u => ht(u.x, u.y), team: u => u.team, alive: u => u.hp > 0,
    unitsWithin: (o, r, w) => alive().filter(f => f !== o && dist(f, o) <= r && (w === 'ally' ? f.team === o.team : f.team !== o.team)),
    unspentAP: u => u === active ? Math.max(0, left()) : 0, usedCount: u => u.usedAb.size, isOwnTurn: u => u === active,
    tags: a => (AB[a] && AB[a].tags) || [], kind: a => AB[a] && AB[a].k,
    limit(o, id, kind) { const bag = kind === 'oncePerBattle' ? o.bf : o.tf; if (bag[id]) return false; bag[id] = true; return true; },
    damage(src, t, n, opt) {
      if (opt.direct) { directLoss(t, n, src); return; }
      hurt(src, t, n, opt.ignoreShield ? { ignore: 1 } : {}, null); checkEnd();
    },
    heal(src, t, n) { n = Math.round(n * LD().healMult(t)); const h = Math.min(n, t.max - t.hp); t.hp += h; },
    shield(src, t, n) { t.st.shield += n; },
    status(src, t, name, v) { const D = CR.statuses[name]; if (D && D.tick && !Array.isArray(v)) return; applyFx(t, { [name]: v }); },
    cleanse: (t, n, list) => cleanse(t, n, list),
    refundAP(u, n) { if (u === active) spent = Math.max(0, spent - n); },
    gainCharge(t, n) { t.charge = Math.min(CR.charge.max, t.charge + n); },
    gainMana(t, n) { if (t.manaMax) t.mana = Math.min(t.manaMax, t.mana + n); },
    reduceCooldown(t, ab, n) { for (const k in t.cd) if (!ab || k === ab) t.cd[k] = Math.max(0, t.cd[k] - n); },
    stagger(t, n) { t.meter -= n; t.charge = 0; cancelCast(t); },
    cancelCast: t => cancelCast(t),
    forcedMove,
    arm(o, spec) { o.armed.push({ spec }); },
    disarm(o, e) { o.armed = o.armed.filter(x => x !== e); },
    hasMoved: u => !!u.movedAny,
    pet: u => petOf(u) || null, aim: () => CUR && CUR.tile || null,
    flanking: (o, s) => flank(o, s) || (!!FLK && !!CUR && CUR.u === o),
    stripBuffs(t, n, list) {
      const L = list || Object.keys(CR.statuses).filter(k => !CR.statuses[k].negative && !CR.statuses[k].skipsTurn); let c = 0;
      for (const k of L) { if (c >= n) break; if (CR.statuses[k] && t.st[k]) { t.st[k] = CR.statuses[k].tick ? null : 0; c++; } }
    },
    detonateDots(o, t, mult, list) {
      let tot = 0; for (const k of (list || ['poison', 'bleed', 'burn'])) if (t.st[k]) { tot += LD().dotTotal(t.st[k]); t.st[k] = null; }
      tot = Math.floor(tot * mult); if (tot > 0) { directLoss(t, tot, o); checkEnd(); }
    },
    gainMeter(t, n) { if (t === active) t.meterBank = (t.meterBank || 0) + n; else t.meter += n; },
    teleport(t, mode, anchor, hexes) {
      if (!anchor || isBlocked(t, 'dash')) return;
      const all = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push({ x, y });
      const h = TR().pickTeleportHex(mode, t, anchor, hexes, { dist, all: () => all, free: (x, y) => !rockAt(x, y) && !at(x, y) });
      if (h) { t.x = h.x; t.y = h.y; trapCheck(t); }
    },
    summon(o, id, opt) {
      const tiles = summonTiles(o); if (!tiles.length) return;
      const mine = units.filter(s => s.owner === o && s.job === id && s.hp > 0), max = (opt && opt.max) || 1;
      while (mine.length >= max) { const s = mine.shift(); s.hp = 0; s.dead = true; }
      const [x, y] = tiles[0].split(',').map(Number), s = createUnit(id, o.team, [x, y], 500 + units.length, null, null, 1); s.owner = o; s.root = rootOf(o); s.meter = CR.summons.initialMeter; units.push(s);
    },
    say() {}, warn() {}
  };
  const fire = (name, o, ctx) => { if (TR()) TR().run(TA, name, o, ctx || {}); };

  function noteAbility(u, a, t) { // onAbilityUsed + cooldown + mana
    CUR = { u, a };
    if (TEL) { const c = cls(u), s = abst(a); if (c && !u.owner) c.ap += cost(u, a); if (s) s.casts++; }
    u.usedSkill = true;
    u.mana -= manaCost(u, a); u.usedAb.add(a); if (AB[a].cd) u.cd[a] = AB[a].cd;
    if (AB[a].tags && AB[a].tags.includes('song') && !AB[a].spendVerse) u.verse = Math.min((CR.verse && CR.verse.max) || 6, (u.verse || 0) + 1);
    fire('onAbilityUsed', u, { ability: a, target: t || null, subject: t || null, byOwner: true });
  }
  function onDeath(v, killer, aid, srcCls) { // onKill + onAnyDeath
    if (v.dead) return; v.dead = true;
    if (TEL) {
      const vc = cls(v); if (vc && !v.owner) { vc.deaths++; vc.deathTurn += TURN; }
      const kc = killer ? cls(killer) : (srcCls && TEL.classStats[srcCls]);
      if (kc && !v.owner) kc.kills++;
      if (aid && abst(aid) && !v.owner) abst(aid).kills++;
      if (BAT && BAT.firstKill == null && !v.owner) { BAT.firstKill = TURN; if (kc) kc.firstBlood++; }
    }
    if (killer && killer.quarry === v && killer === active) spent = Math.max(0, spent - 1);   // Quarry: a kill refunds 1 AP
    if (killer && killer.hp > 0) fire('onKill', killer, { victim: v, subject: v, ability: aid || null, byOwner: true });
    for (const w of alive()) fire('onAnyDeath', w, { victim: v, subject: v, killer: killer || null });
  }
  function applyFx(t, fx) {
    for (const k in fx) {
      const v = fx[k], D = CR.statuses[k];
      if (Array.isArray(v)) LD().addDot(t, k, v, CUR && CUR.u ? rootOf(CUR.u) : null, CUR ? CUR.a : null);
      else if (LD().stackApply(t, k, v)) { /* Exposed, Chill: stacked */ }
      else if (k === 'shield') { const cp0 = CUR && AB[CUR.a] && AB[CUR.a].shieldCap, cp = cp0 && cp0 + (CUR.u ? LD().wardBonus(CUR.u, AB[CUR.a]) : 0); t.st.shield = cp ? Math.max(t.st.shield, Math.min(t.st.shield + v, cp)) : t.st.shield + v; if (TEL && CUR && CUR.u) { const c = cls(CUR.u), s = abst(CUR.a); if (c && !CUR.u.owner) c.heal += v; if (s) s.heal += v; } }
      else t.st[k] = v;
      if (D && D.clearsOnApply) { if (D.clearsOnApply.includes('cast')) cancelCast(t); if (D.clearsOnApply.includes('charge')) t.charge = 0; }
      fire('onStatusApplied', t, { status: k });
    }
  }

  // ------------------------------------------------------------------ damage (index.html hurt)
  function hurt(u, t, p, A, aid) {
    const D = CR.damage, GC = D.guardCounter;
    let d = p, SHD = 0, ICP = 0, crit = false;
    if (t.st.evasion > 0) { t.st.evasion = 0; return 0; }   // Evasion: the hit misses
    if (u.lvPow && u.lvPow > 1) d = Math.round(d * u.lvPow);
    if (u.st.wither) d = Math.round(d * D.witherMultiplier);
    if (u.st.empowered > 0) d = Math.ceil(d * CR.statuses.empowered.damageDealtMultiplier);
    d = Math.ceil(d * LD().dealtMult(u));   // Reckless
    if (u.quarry === t && t.st.quarry > 0) d = Math.ceil(d * CR.quarry.damageMultiplier);   // Tracker's Quarry
    for (const k in CR.statuses) { const D2 = CR.statuses[k]; if (D2.damageTakenMultiplier && t.st[k] > 0) d = Math.ceil(d * D2.damageTakenMultiplier); }
    if (A.k === 'dmg') { const ch = LD().critChance(u, A, FLK); if (ch > 0 && Math.random() * 100 < ch) { d = Math.ceil(d * LD().critMult()); crit = true; } }
    { const mp = LD().mitigationPct(u, t, A); if (mp > 0) d = Math.max(CR.loadout.minHit, Math.round(d * (1 - mp / 100))); }
    if (d > 0) d += LD().flatTaken(t);   // Judged: +2 holy damage, ignores armor
    if (!A.ignore) { if (t.guard) d = Math.ceil(d * D.guardMultiplier); const ab = Math.min(t.st.shield, d); t.st.shield -= ab; d -= ab; SHD = ab; }
    if (d > 0) { // Intercept: an adjacent Intercepting ally of the victim takes half of the hit (after the victim's shield)
      const ic = alive().find(w => w !== t && w.team === t.team && w.st.intercept > 0 && dist(w, t) === 1);
      if (ic) {
        const half = Math.floor(d * CR.statuses.intercept.redirectsAllyDamage);
        if (half > 0) { d -= half; ICP = half; const ab2 = Math.min(ic.st.shield, half); ic.st.shield -= ab2; if (half - ab2 > 0) directLoss(ic, half - ab2, u); }
      }
    }
    const allyCtx = { attacker: u, victim: t, subject: t, damage: d, ability: aid || null };
    if (d > 0) for (const w of alive()) if (w !== t && w.team === t.team) { fire('onAllyDamaged', w, allyCtx); if (allyCtx.damage <= 0) break; }
    const selfCtx = { attacker: u, victim: t, subject: u, damage: allyCtx.damage, ability: aid || null };
    fire('onDamaged', t, selfCtx); d = selfCtx.damage;
    if (d >= t.hp && t.hp > 0 && t.st.deathSave > 0) { const keep = t.st.deathSave; t.st.deathSave = 0; t.hp = keep; d = 0; }
    if (d >= t.hp && t.hp > 0) { const lc = { attacker: u, victim: t, subject: u, damage: d, ability: aid || null, preventDeath: false, keepHp: 1 }; fire('onLethalDamage', t, lc); if (lc.preventDeath) d = Math.max(0, Math.min(d, t.hp - lc.keepHp)); }
    const prev = t.hp; t.hp = Math.max(0, t.hp - d);
    const actual = prev - t.hp;
    { const ls = LD().lifesteal(u); if (ls && actual > 0 && u.hp > 0) u.hp = Math.min(u.max, u.hp + Math.floor(actual * ls / 100)); }   // Bloodthirst
    if (TEL) {
      const vc = cls(t); if (vc && !t.owner) { vc.taken += actual; vc.absorbed += SHD + ICP; }
      const as = abst(aid); if (as) { as.hits++; as.overkill += d - actual; as.absorbed += SHD + ICP; as.dmg += actual; }
      const sc = cls(u); if (sc) { sc.dmg += actual; if (crit) sc.crits = (sc.crits || 0) + 1; }
    }
    if (d > 0) for (const k in CR.statuses) if (CR.statuses[k].breaksOnDamage && t.st[k] > 0) t.st[k] = 0;
    if (t.hp <= 0) onDeath(t, u, aid); else checkBloodied(t, prev);
    if (d > 0) fire('onHit', u, { attacker: u, victim: t, subject: t, damage: d, ability: aid || null, byOwner: true });
    if (d > 0 && t.st.wrath > 0 && u.st.judged > 0 && u.hp > 0) directLoss(u, CR.statuses.wrath.judgedReflect, t);   // Righteous Wrath
    if (d > 0 && t.st.thorns > 0 && u.hp > 0 && aid && AB[aid] && AB[aid].r <= CR.targeting.meleeRange && dist(u, t) === 1) directLoss(u, CR.statuses.thorns.reflectDamage, t);
    if (!A.ignore && t.guard && GC.classes.includes(t.job) && dist(u, t) === GC.range && t.hp > 0) { const pv = u.hp; u.hp = Math.max(0, u.hp - GC.damage); if (TEL) { const gc = cls(t); if (gc) gc.dmg += pv - u.hp; } if (u.hp <= 0) onDeath(u, t); else checkBloodied(u, pv); }
    return actual;
  }

  // ------------------------------------------------------------------ casts and abilities (index.html act / startCast / resolveCast / resolveAct)
  function act(u, a, t, aim) {
    const A = AB[a], g = groundTargeted(A);
    if (g) { if (!aim) aim = t ? { x: t.x, y: t.y } : { x: u.x, y: u.y }; aim = aimOf(metaA(u, A), A, aim); t = null; }
    let meta = null; // Metamagic: the next spell takes Widen / Reach / Twin and uses them up
    if (LD().isSpell(A) && A.k !== 'self' && A.k !== 'summon' && (u.st.widen > 0 || u.st.reach > 0 || u.st.twin > 0)) { meta = { widen: u.st.widen > 0, reach: u.st.reach > 0, twin: u.st.twin > 0 }; u.st.widen = u.st.reach = u.st.twin = 0; }
    spent += cost(u, a); if (qcOn(u, a)) u.st.quickcast = 0; noteAbility(u, a, t); payHp(u, A);
    if (A.ct > 0) return startCast(u, a, t, g ? aim : (t ? { x: t.x, y: t.y } : { x: u.x, y: u.y }), meta);
    resolveActM(u, a, t, g ? aim : undefined, meta);
  }
  function resolveActM(u, a, t, tile, meta) { u.metaNow = meta || null; try { resolveAct(u, a, t, tile); } finally { u.metaNow = null; } }
  function summon(u, a, x, y) {
    spent += cost(u, a); noteAbility(u, a); payHp(u, AB[a]);
    if (AB[a].ct > 0) return startCast(u, a, null, { x, y });
    resolveSummon(u, a, x, y);
  }
  function startCast(u, a, t, tile, meta) {
    const A = AB[a], area = isAreaSkill(A), need = Math.max(CR.cast.minThreshold, Math.min(CR.cast.maxCt, A.ct) - (u.castHaste || 0));
    u.cast = { a, t: area ? null : t, tile: area ? tile : null, meter: 0, need, meta: meta || null, conf: u.st.confused > 0 };
    fire('onCastStart', u, { ability: a, target: t, subject: t, byOwner: true });
  }
  function cancelCast(u) { if (u.cast) { const a = u.cast.a; u.cast = null; fire('onCastInterrupted', u, { ability: a, byOwner: true }); } }
  function resolveCast(u) {
    const c = u.cast; u.cast = null; if (!c || u.hp <= 0) return;
    const A = AB[c.a], hostile = A.k === 'dmg' || A.k === 'debuff';
    if (A.k === 'summon') {
      if (at(c.tile.x, c.tile.y) || rockAt(c.tile.x, c.tile.y)) return;
      fire('onCastResolve', u, { ability: c.a, byOwner: true }); resolveSummon(u, c.a, c.tile.x, c.tile.y); return;
    }
    if (groundTargeted(A)) { fire('onCastResolve', u, { ability: c.a, byOwner: true }); resolveActM(u, c.a, null, c.tile, c.meta); return; }
    let t = c.t;
    if (isAreaSkill(A)) { const o = at(c.tile.x, c.tile.y); t = o && (hostile ? (c.conf || o.team !== u.team) && !hidden(o) : (c.conf || o.team === u.team)) ? o : null; }
    else if (t && (t.hp <= 0 || (hostile && hidden(t)))) t = null;
    if (!t && A.k !== 'self' && !(isAreaSkill(A) && hostile)) return;
    fire('onCastResolve', u, { ability: c.a, target: t, subject: t, byOwner: true });
    resolveActM(u, c.a, t, c.tile, c.meta);
  }
  function spendAllCharge(u) {
    const n = u.charge; if (n <= 0) return 0;
    if (u === active) { const unspent = Math.max(0, left() - Math.max(0, ppt() - spent)); bonus -= Math.min(unspent, n * CR.charge.bonusPointsPerCharge); }
    u.charge = 0; return n;
  }
  const echoed = u => u.usedAb.size >= 2;
  const swapPlaces = (a, b) => { const x = a.x, y = a.y; a.x = b.x; a.y = b.y; b.x = x; b.y = y; };
  function abMult(A, h) { let m = 1; for (const k in A.multVsStatus || {}) if (h && h.st[k]) m *= A.multVsStatus[k]; return m; }   // Breaching Shot: double damage to a shielded target
  function abBonus(u, A, h, amb, chg) {
    let b = 0;
    if (A.echo && A.echo.p && echoed(u)) b += A.echo.p;
    if (A.spendCharge && A.spendCharge.dmgPer) b += chg * A.spendCharge.dmgPer;
    if (A.spendVerse) b += (u.verse || 0) * A.spendVerse.per;
    for (const k in A.bonusVsStatus || {}) if (h.st[k]) b += A.bonusVsStatus[k];
    for (const k in A.bonusPerStack || {}) b += A.bonusPerStack[k] * LD().stacks(h, k);   // Sunder: Execute vs Exposed stacks
    if (amb && A.bonusIfVanished) b += A.bonusIfVanished;
    if (A.rootedAim && !u.movedAny) b += A.rootedAim;
    if (A.bonusIfPetAdjacent) { const pt = petOf(u); if (pt && dist(pt, h) === 1) b += A.bonusIfPetAdjacent; }
    if (A.bonusPerNegative) b += A.bonusPerNegative * NEG.filter(k => h.st[k]).length;
    if (u.painPower && A.k === 'dmg') b += u.painPower * LD().selfDebuffs(u);   // Berserker: Pain Is Power
    if (A.bonusFromOwnShield) b += Math.floor(u.st.shield / A.bonusFromOwnShield);
    if (A.bonusPerShieldedAlly) b += A.bonusPerShieldedAlly * alive().filter(f => f.team === u.team && f !== u && f.st.shield > 0).length;
    if (A.bonusIfMoved && u.movedAny) b += A.bonusIfMoved;
    if (A.perDistinct) b += Math.min(A.perDistinct.max, A.perDistinct.per * Math.max(0, u.usedAb.size - 1));
    if (A.exorcism) b += A.exorcism.perStatus * EXO;
    const dh = ht(u.x, u.y) - ht(h.x, h.y);
    if (A.highGroundBonus && dh > 0) b += A.highGroundBonus;
    if (A.heightBonus && dh > 0) b += A.heightBonus * dh;
    return b;
  }
  let SCALE = 1;   // Twin's second cast deals a fraction of the damage
  function resolveAct(u, a, t, tile) {
    const A = AB[a]; CUR = { u, a, tile: tile || (t ? { x: t.x, y: t.y } : { x: u.x, y: u.y }) };
    const fat = FAT ? FAT() : { dmg: 0, heal: 1 };
    if (A.k === 'trap') { placeTrap(u, a, tile); return; }
    if (A.k === 'self') {
      if (A.spendCharge && A.spendCharge.shieldPer) { const n = spendAllCharge(u); if (n > 0) u.st.shield += n * A.spendCharge.shieldPer; }
      if (A.charge) u.charge = Math.min(CR.charge.max, u.charge + A.charge);
      if (A.cd) u.cd[a] = A.cd;
      if (A.swapPet) { const pt = petOf(u); if (pt) swapPlaces(u, pt); }
      if (A.refundAP && u === active) bonus += A.refundAP;
      if (A.fx) applyFx(u, LD().wardFx(u, A));
      return;
    }
    if (A.k === 'heal' || A.k === 'buff') {
      const grp = groundTargeted(A) ? areaUnits(u, A, tile || (t ? { x: t.x, y: t.y } : { x: u.x, y: u.y })) : [t];
      let P = Math.round((A.p + (A.k === 'heal' ? LD().castPart(u, A) : 0)) * LD().potency(u, A) * (A.k === 'heal' && u.lvPow ? u.lvPow : 1) * (A.k === 'heal' ? fat.heal : 1));
      if (A.k === 'heal' && A.consumeShield) { const x = Math.min(u.st.shield, A.consumeShield); u.st.shield -= x; P += x; }
      let ch = 0; const SC = A.spendCharge;
      if (SC && (SC.healPer || SC.shieldPer)) { ch = spendAllCharge(u); if (ch === 0 && A.bankIfEmpty) u.charge = Math.min(CR.charge.max, u.charge + A.bankIfEmpty); if (SC.healPer) P += ch * SC.healPer; }
      if (!grp.length) return;
      if (A.swap && t && t !== u) { swapPlaces(u, t); return; }
      if (A.transferStatus) {
        const k = NEG.find(n => t.st[n]), foe = alive().filter(f => f.team !== u.team && !hidden(f) && dist(f, t) <= 3).sort((x, y) => dist(x, t) - dist(y, t))[0];
        if (k && foe) { foe.st[k] = t.st[k]; t.st[k] = CR.statuses[k].tick ? null : 0; }
        return;
      }
      for (const m of grp) {
        if (A.k === 'heal') {
          let Pm = P; if (A.lowHpBonus && m.hp < m.max * A.lowHpBonus.pct) Pm += A.lowHpBonus.p;
          if (A.detonateRegen && m.st.regen) { Pm += Math.floor(LD().dotTotal(m.st.regen) * A.detonateRegen); m.st.regen = null; }
          Pm = Math.round(Pm * LD().healMult(m)); const h = Math.min(Pm, m.max - m.hp), over = Pm - h; m.hp += h;
          if (TEL) { const c = cls(u), s = abst(a); if (c && !u.owner) { c.heal += h; c.overheal += over; } if (s) { s.heal += h; s.overheal += over; } }
          const ctx = { target: m, subject: m, amount: h, overflow: over, ability: a, byOwner: true };
          fire('onHeal', u, ctx); if (over > 0) fire('onHealOverflow', u, ctx);
        } else { if (A.fx) applyFx(m, LD().wardFx(u, A)); if (ch && SC.shieldPer) m.st.shield += ch * SC.shieldPer; }
        if (A.cleanse) cleanse(m, A.cleanse);
        if (A.echo && A.echo.shield && echoed(u)) m.st.shield += A.echo.shield;
      }
      if (A.selfFx) applyFx(u, A.selfFx);
      return;
    }
    const amb = u.st.vanish > 0; u.st.vanish = 0;
    const bld = !!A.bloodied && u.hp <= u.max * CR.resourceCosts.bloodiedThreshold;
    const ground = groundTargeted(A), ctr = t || tile || { x: u.x, y: u.y }, hits = (!ground && t) ? [[t, A.p]] : [], foes = alive().filter(f => (u.st.confused > 0 ? f !== u : f.team !== u.team) && f !== t);
    if (ground) { areaUnits(u, A, tile || ctr).forEach(f => hits.push([f, A.p])); if (hits.length) t = hits.slice().sort((x, y) => dist(x[0], ctr) - dist(y[0], ctr))[0][0]; }
    if (A.area === 'chain') { const C = CR.areaShapes.chain; foes.filter(f => dist(f, ctr) <= C.radius).sort((x, y) => dist(x, ctr) - dist(y, ctr)).slice(0, C.extraTargets).forEach(f => hits.push([f, C.extraPower])); }
    let tot = 0; const pDone = [], chg = A.spendCharge && A.spendCharge.dmgPer ? spendAllCharge(u) : 0;
    const rfx = A.randomFx ? A.randomFx[Math.floor(Math.random() * A.randomFx.length)] : null;
    EXO = 0; if (A.exorcism) for (const m of alive().filter(f => f.team === u.team && dist(f, u) <= A.exorcism.radius)) { EXO += NEG.filter(k => m.st[k]).length; cleanse(m, 99); }
    for (const [h, p0] of hits) {
      const hadNeg = NEG.some(k => h.st[k]), hadVs = A.fxVsStatus ? Object.keys(A.fxVsStatus).filter(k => h.st[k] > 0) : [];
      const p00 = p0 + (LD().weaponSkill(A) ? LD().weaponPart(u, A) : 0) + (p0 > 0 ? LD().castPart(u, A) : 0);
      let p = p00 > 0 && A.k === 'dmg' ? Math.max(1, Math.round((p00 + powerBonus(u, A, a) + (bld && A.bloodied.p || 0) + abBonus(u, A, h, amb, chg) + fat.dmg) * LD().potency(u, A) * SCALE * abMult(A, h))) : p00;
      FLK = amb || flank(u, h);
      if (A.flank) { if (amb) p *= CR.damage.ambushMultiplier; else if (flank(u, h)) p = Math.ceil(p * CR.damage.flankMultiplier); }
      if (p > 0) tot += hurt(u, h, p, A, a);
      pDone.push([h, p]);
      if (A.consumeStatus && h.st[A.consumeStatus] > 0) h.st[A.consumeStatus] = 0;   // Smite Evil consumes Judged
      if (h.hp > 0) for (const k of hadVs) applyFx(h, A.fxVsStatus[k]);   // Consecrate pins Judged foes
      if (A.selfHealIfNegative && hadNeg && u.hp > 0) u.hp = Math.min(u.max, u.hp + A.selfHealIfNegative);
      if (A.petStrike && h.hp > 0) {
        const pt = petOf(u);
        if (pt) {
          if (A.petStrike.teleport && dist(pt, h) > 1) {
            const spot = nbrs(h.x, h.y).filter(([x, y]) => inb(x, y) && !rockAt(x, y) && !at(x, y) && Math.abs(ht(x, y) - ht(h.x, h.y)) <= jumpOf(pt)).sort((x, y) => dist({ x: x[0], y: x[1] }, pt) - dist({ x: y[0], y: y[1] }, pt))[0];
            if (spot) { pt.x = spot[0]; pt.y = spot[1]; }
          }
          if (dist(pt, h) === 1) tot += hurt(pt, h, A.petStrike.p, {}, 'spirit_bite');
        }
      }
      if (A.swapMeter) { TA.gainMeter(u, Math.max(0, h.meter)); h.meter = -spent * CR.turn.meterPenaltyPerPointSpent; }
      if (A.markQuarry && h.hp > 0) { if (u.quarry && u.quarry !== h) u.quarry.st.quarry = 0; u.quarry = h; h.st.quarry = A.markQuarry; }   // Tracker: one Quarry at a time
      if (h.hp > 0) { if (A.fx) applyFx(h, A.fx); if (rfx) applyFx(h, rfx); if (A.stagger) { h.meter -= A.stagger; h.charge = 0; cancelCast(h); } }
    }
    if (u.metaNow && A.k === 'dmg' && !u.metaDone) { // Metamagic riders
      const MM = CR.metamagic, meta = u.metaNow, enemies = () => alive().filter(f => f.team !== u.team && !hidden(f));
      if (meta.widen && A.widenSplash && t && pDone.length) { // Widen on a single-target spell: a splash around the target, same riders
        const pT = pDone[0][1];
        for (const f of enemies().filter(f => f !== t && dist(f, t) <= MM.splashRadius)) { if (pT > 0) tot += hurt(u, f, Math.max(1, Math.round(pT * MM.splashFraction)), A, a); if (f.hp > 0 && A.fx) applyFx(f, A.fx); }
      }
      if (meta.twin && A.twin === 'chain') { // every enemy hit sends a chain to the nearest other enemy
        for (const [h, pp] of pDone.slice()) { const f = enemies().filter(x => x !== h && dist(x, h) <= MM.chainRange).sort((x, y) => dist(x, h) - dist(y, h))[0]; if (f && pp > 0) tot += hurt(u, f, Math.max(1, Math.round(pp * MM.chainFraction)), A, a); }
      }
      if (meta.twin && A.twin === 'pull2') { for (const [h] of pDone) if (h.hp > 0) forcedMove(h, ctr, 1, 'pull'); }
      if (meta.twin && A.twin === 'repeat') { // cast it again: 40% damage, full status; retarget the nearest legal target, fizzle if none
        let t2 = t && t.hp > 0 && !hidden(t) ? t : enemies().filter(f => inRange(u, A, f.x, f.y)).sort((x, y) => dist(x, u) - dist(y, u))[0];
        if (t2 && !over) { SCALE = MM.twinFraction; u.metaNow = { widen: meta.widen, reach: meta.reach }; try { resolveAct(u, a, t2, undefined); } finally { SCALE = 1; } }
      }
    }
    if (A.spendVerse) u.verse = 0;
    if (A.k === 'dmg' && u.st.empowered > 0) u.st.empowered = 0;
    if (A.drainAlly && tot > 0) {
      const al = alive().filter(f => f.team === u.team && f !== u && dist(f, u) <= 3 && f.hp < f.max).sort((x, y) => (y.max - y.hp) - (x.max - x.hp))[0];
      if (al) { const g = Math.min(al.max - al.hp, Math.round(tot * A.drainAlly)); al.hp += g; if (TEL) { const c = cls(u); if (c) c.heal += g; } }
    }
    if (A.drain) { const pld = A.drainIfPulled && u.pulled && pDone.some(([h]) => u.pulled.has(h)); const dm = pld ? A.drainIfPulled : A.drainPerDebuff ? A.drain + A.drainPerDebuff * LD().selfDebuffs(u) : (bld && A.bloodied.drainMult || 1), h0 = u.hp; u.hp = Math.min(u.max, u.hp + Math.round(tot * dm)); if (TEL && u.hp > h0) { const c = cls(u), s = abst(a); if (c && !u.owner) c.heal += u.hp - h0; if (s) s.heal += u.hp - h0; } }
    if (A.drainShield && tot > 0) u.st.shield += Math.round(tot * (bld && A.bloodied.drainMult || 1));
    if (A.selfFx) applyFx(u, A.selfFx);
    checkEnd();
  }
  function resolveSummon(u, a, x, y) {
    const id = AB[a].summonId || 'skeleton';
    units.forEach(s => { if (s.owner === u && s.hp > 0) { s.hp = 0; s.dead = true; } });
    const s = createUnit(id, u.team, [x, y], 600 + units.length, null, null, 1); s.owner = u; s.root = rootOf(u); s.meter = CR.summons.initialMeter; units.push(s);
  }

  // ------------------------------------------------------------------ traps
  const trapAt = (x, y) => traps.find(r => r.x === x && r.y === y);
  function trapTileOk(u, A, x, y) { return inb(x, y) && !rockAt(x, y) && (A.persist || (!at(x, y) && !trapAt(x, y))) && inRange(u, aimSpec(A), x, y); }
  function trapHit(A, a, own, f) { if (A.p) hurt(own, f, A.p * (own.quarry === f && f.st.quarry > 0 ? 2 : 1), {}, a); if (f.hp > 0 && A.fx) applyFx(f, A.fx); }
  function placeTrap(u, a, tile) {
    const A = AB[a]; if (A.cd) u.cd[a] = A.cd;
    if (!tile || (!A.persist && (at(tile.x, tile.y) || trapAt(tile.x, tile.y)))) return;
    traps = traps.filter(r => !(r.owner === u && r.a === a));
    const tl = A.persist ? SH.footprint(A, u, tile, inb).filter(([x, y]) => !rockAt(x, y)) : [[tile.x, tile.y]];
    tl.forEach(([x, y]) => traps.push({ x, y, team: u.team, owner: u, a }));
    if (A.persist) { const set = new Set(tl.map(([x, y]) => x + ',' + y)); for (const f of alive().filter(f => f.team !== u.team && set.has(f.x + ',' + f.y))) trapHit(A, a, u, f); }
  }
  function trapCheck(m) { // true when the mover sprang a one-shot trap
    if (m.hp <= 0) return false; let stop = false, any = false;
    for (const r of traps.filter(q => q.x === m.x && q.y === m.y && q.team !== m.team)) {
      if (!traps.includes(r) || m.hp <= 0) continue;
      const A = AB[r.a], own = r.owner; any = true;
      if (A.persist) { trapHit(A, r.a, own, m); continue; }
      traps.splice(traps.indexOf(r), 1); stop = true;
      const tiles = new Set(SH.footprint(A, own, { x: r.x, y: r.y }, inb).map(([x, y]) => x + ',' + y));
      for (const f of alive().filter(f => f.team !== r.team && tiles.has(f.x + ',' + f.y))) trapHit(A, r.a, own, f);
    }
    if (any) checkEnd();
    return stop;
  }
  function moveTriggers(mover) { // onEnemyMoveNear: every enemy of the mover may react (armed interrupts like Overwatch)
    for (const w of alive()) if (w !== mover && w.team !== mover.team) { fire('onEnemyMoveNear', w, { subject: mover, attacker: mover }); if (mover.hp <= 0 || over) return true; }
    return false;
  }
  function moveTo(u, x, y, mcost = moveCost(u), mvr = moveRange(u), std = true, jb = 0) { // std=false for dash abilities
    const path = reach(u, mvr, jb).get(x + ',' + y);
    spent += mcost; u.movedAny = true; if (std) { u.hasMovedThisTurn = true; if (TEL) { const c = cls(u); if (c && !u.owner) c.moveAp += mcost; } }
    for (const [px, py] of path) { u.x = px; u.y = py; if (trapCheck(u) || moveTriggers(u) || over) break; }
    if (u.hp > 0 && !over) fire('onMove', u, { byOwner: true });
    checkEnd();
  }

  // ------------------------------------------------------------------ the AI (index.html aiStep / aiConfused)
  function aiStep(u) {
    const AI = CR.ai, L = left();
    if (u.st.confused > 0) return aiConfused(u, L);
    const ok = u.ab.filter(a => AB[a] && !AB[a].swap && !AB[a].swapPet && cost(u, a) <= L && !(AB[a].ct > 0 && u.cast) && !(u.cd[a] > 0) && !blockReason(u, a));
    const foes = alive().filter(f => f.team !== u.team), nd = (x, y) => foes.length ? Math.min(...foes.map(f => dist({ x, y }, f))) : 99, near = (t, r) => foes.filter(f => dist(f, t) <= r).length;
    const lvl = u.lvPow && u.lvPow > 1 ? u.lvPow : 1, amb = hidden(u), spellUser = t => t.ab.some(a => AB[a] && AB[a].tags && AB[a].tags.includes('spell') && AB[a].k === 'dmg');
    const est = (a, t) => {
      const A = AB[a]; let p = (effP(u, A, a) + abBonus(u, A, t, amb, u.charge || 0)) * abMult(A, t);
      if (A.flank && (amb || flank(u, t))) p *= amb ? 2 : 1.5; p *= lvl; if (u.st.wither) p *= CR.damage.witherMultiplier;
      for (const k in CR.statuses) { const D2 = CR.statuses[k]; if (D2.damageTakenMultiplier && t.st[k] > 0) p *= D2.damageTakenMultiplier; }
      const mp = LD().mitigationPct(u, t, A); if (mp > 0) p = Math.max(CR.loadout.minHit, p * (1 - mp / 100));
      if (!A.ignore) { if (t.guard) p *= CR.damage.guardMultiplier; p -= Math.min(t.st.shield || 0, p) * 0.6; }
      return Math.max(0, p);
    };
    const RW = { slow: 3, pin: 4, root: 4, stun: 9, wither: 3, marked: 3, blind: 3, taunt: 2, confused: 7, charm: 9, mez: 8, dontAct: 8, silence: t => spellUser(t) ? 7 : 2, exposed: 3, chill: 3, judged: 5, fear: 8, grievous: t => t.max - t.hp > 6 || t.ab.some(x => AB[x] && AB[x].k === 'heal') ? 4 : 1.5, disarm: t => t.ab.some(x => AB[x] && AB[x].tags && AB[x].tags.includes('physical') && AB[x].k === 'dmg') ? 5 : 1, fatigue: 6, quarry: 2 };
    const rider = (A, t) => {
      let v = 0; const fx = A.fx || {};
      if (A.stagger) v += t.cast ? 10 + A.stagger / 5 : A.stagger / 5;
      if (A.drainIfPulled && u.pulled && u.pulled.has(t)) v += 7; // Soul Leech on a pulled foe: full heal
      if (u.ab.includes('soul_leech') && !(u.cd.soul_leech > 0) && L >= A.c + 2 && A.triggers && A.triggers.some(g => g.effects && g.effects.some(e => e.type === 'pull' && e.target === 'victim'))) v += 4; // setting up Leech
      for (const k of ['poison', 'bleed', 'burn']) if (fx[k] && !t.st[k]) { const q = Array.isArray(fx[k]) ? fx[k] : [2, fx[k]]; v += q[0] * q[1] * 0.8; }
      for (const k in fx) { const w = RW[k]; if (w && !(t.st[k] > 0)) v += typeof w === 'function' ? w(t) : w; }
      if (A.triggers && A.triggers.some(g => g.effects && g.effects.some(e => /push|pull|stealMeter|stripBuffs|detonateDots/.test(e.type)))) v += 3;
      for (const g of A.triggers || []) for (const e of g.effects || []) if ((e.type === 'push' || e.type === 'pull') && e.target === 'victim') { const P = pushPath(t, u, e.hexes || 1, e.type); v += P.fall + (P.hit ? CR.forced.collision : 0); }   // a push off a ledge or into a wall is worth its damage
      if (A.drain || A.drainShield || A.drainAlly) v += 2; if (A.petStrike) v += (A.petStrike.p || 4) * lvl; if (A.aiBonus) v += A.aiBonus; if (A.randomFx) v += 3.5; for (const g of A.triggers || []) for (const e of g.effects || []) { if (e.type === 'gainCharge' && e.target === 'self' && u.charge < CR.charge.max) v += 2.5; if (e.type === 'heal' && e.target === 'self') v += Math.min(e.amount, u.max - u.hp) * 0.8; } return v;
    };
    const ally = (A, t) => {
      let v = 0; const fx = A.fx || {}, th = near(t, 3) > 0;
      if (fx.shield) v += Math.max(0, Math.min(fx.shield, 12) - (t.st.shield || 0) * 0.6) * (th ? 0.7 : 0.25); if (fx.haste && !(t.st.haste > 0)) v += 4; if (fx.empowered && !(t.st.empowered > 0)) v += 5;
      if (fx.regen && !(t.st.regen > 0)) { const q = fx.regen; v += Math.min(q[0] * q[1], t.max - t.hp) * 0.6; } if (fx.deathSave && !(t.st.deathSave > 0)) v += t.hp < t.max * 0.5 ? 9 : 2;
      for (const k of ['zoc', 'thorns', 'intercept', 'steeled', 'unmovable', 'farsight', 'vanish', 'siege']) if (fx[k] && !(t.st[k] > 0)) v += th ? 3 : 1;
      if (A.cleanse) v += 5 * NEG.filter(k => t.st[k]).length; if (A.transferStatus && NEG.some(k => t.st[k])) v += 6;
      if (A.triggers) for (const g of A.triggers) for (const e of g.effects || []) if (e.type === 'gainMeter' && e.target === 'target') v += Math.min(e.amount || 0, 100 - t.meter) / 6;
      if (A.aiBonus) v += A.aiBonus;
      if (!Object.keys(fx).length && !A.cleanse && !A.transferStatus) v += 2; return v;
    };
    const heal = (a, t) => { const A = AB[a], miss = t.max - t.hp, P = effP(u, A, a) * lvl; if (miss < Math.max(3, P * 0.4)) return 0; return Math.min(P, miss) * (t.hp < t.max * AI.healBelowFraction ? 1.6 : 1) + ally(A, t); };
    const pick = (a, list) => { const tn = list.filter(x => x.st.taunt > 0 && x.team !== u.team); return tn.length ? tn : list; };
    const C = []; // [value, how(), ability]
    for (const a of ok) {
      const A = AB[a];
      if (A.k === 'summon') { if (!units.some(s => s.owner === u && s.hp > 0)) { const back = A.spot === 'back', ts = summonTiles(u).map(k => k.split(',').map(Number)).sort((x, y) => back ? nd(...y) - nd(...x) : nd(...x) - nd(...y)), sid = A.summonId || 'skeleton', d0 = nd(u.x, u.y), sv = sid === 'bone_golem' ? (d0 <= 3 ? 26 : 19) : sid === 'skeleton_archer' ? (d0 > 6 ? 24 : d0 > 3 ? 22 : 17) : (d0 > 3 && d0 <= 6 ? 24 : d0 <= 3 ? 21 : 20); if (ts.length) C.push([sv, () => summon(u, a, ...ts[0]), a]); } continue; }
      if (A.k === 'dmg' || A.k === 'debuff') {
        if (groundTargeted(A)) {
          const aims = A.self ? [{ x: u.x, y: u.y }] : pick(a, foes.filter(f => !hidden(f) || A.revealsHidden)).map(f => ({ x: f.x, y: f.y }));
          for (const aim of aims) {
            const fp = aoeFootprint(u, A, aim); if (!fp.hit.size || (!A.self && !inRange(u, A, aim.x, aim.y))) continue; let v = 0;
            for (const f of foes) if (fp.hit.has(f.x + ',' + f.y)) { const d = A.k === 'dmg' ? est(a, f) : 0; v += d + rider(A, f) + (d >= f.hp ? 12 : 0); }
            if (v > 0) C.push([v, () => act(u, a, null, aim), a]);
          }
        } else for (const t of pick(a, targets(u, a))) { const d = A.k === 'dmg' ? est(a, t) : 0, v = d + rider(A, t) + (A.k === 'debuff' ? 1 : 0) + (d >= t.hp ? 12 : 0) + (1 - t.hp / t.max) * 3; if (v > 0) C.push([v, () => act(u, a, t), a]); }
        continue;
      }
      if (A.k === 'heal') {
        if (groundTargeted(A)) { for (const t of alive().filter(f => f.team === u.team && f.hp < f.max)) { const g = areaUnits(u, A, { x: t.x, y: t.y }); const v = g.reduce((s, m) => s + heal(a, m), 0); if (v > 0) C.push([v, () => act(u, a, null, { x: t.x, y: t.y }), a]); } }
        else for (const t of targets(u, a)) { const v = heal(a, t); if (v > 0) C.push([v, () => act(u, a, t), a]); }
        continue;
      }
      if (A.k === 'buff') {
        if (A.swap) continue; const pool = targets(u, a).filter(t => t.team === u.team);
        if (groundTargeted(A)) { for (const t of pool) { const v = areaUnits(u, A, { x: t.x, y: t.y }).reduce((s, m) => s + ally(A, m), 0) + (A.selfFx && A.self ? ally({ fx: A.selfFx }, u) : 0); if (v > 0) C.push([v, () => act(u, a, null, { x: t.x, y: t.y }), a]); } }
        else for (const t of pool) { const v = ally(A, t) + (A.triggers && t !== u ? (Object.values(t.cd || {}).filter(n => n > 0).length) : 0); if (v > 0) C.push([v, () => act(u, a, t), a]); }
        continue;
      }
      if (A.k === 'self') {
        let v = 0; const fx = A.fx || {}, th = near(u, 2);
        if (A.charge) v += u.charge < CR.charge.max ? 4 : 0;
        if (fx.shield) v += (A.shieldCap ? Math.min(fx.shield, 12, Math.max(0, A.shieldCap - (u.st.shield || 0))) : Math.max(0, Math.min(fx.shield, 12) - (u.st.shield || 0) * 0.6)) * (th ? 0.7 : (A.shieldCap && near(u, 5) ? 0.5 : 0.15));
        if (fx.vanish && !amb) v += near(u, 5) ? (u.ab.some(x => AB[x] && (AB[x].flank || AB[x].bonusIfVanished)) ? 10 : 4) : 0;
        if (fx.taunt) v += alive().some(m => m.team === u.team && m !== u && near(m, 2)) && u.hp > u.max * 0.5 ? 5 : 0;
        for (const k of ['steeled', 'thorns', 'zoc', 'unmovable', 'standfast']) if (fx[k] && !(u.st[k] > 0)) v += th ? 4 : 0.5;
        if (fx.siege && !(u.st.siege > 0)) v += u.ab.some(x => AB[x] && AB[x].k === 'dmg' && AB[x].r > 2) && nd(u.x, u.y) <= 5 ? 4 : 0;
        if (fx.farsight && !(u.st.farsight > 0)) v += 3; if (fx.haste && !(u.st.haste > 0)) v += 4;
        if (fx.reckless && !(u.st.reckless > 0)) v += near(u, 3) ? 6 + (u.painPower || 0) : 0;   // Berserker: take the risk when a fight is close
        if (u.painPower) for (const k of ['exposed', 'winded', 'dazed']) if (fx[k] && !(u.st[k] > 0)) v += near(u, 3) ? 2 + u.painPower : 0;
        if (fx.evasion && !(u.st.evasion > 0)) v += near(u, 2) ? 4 : 0;
        if (fx.wrath && !(u.st.wrath > 0)) v += foes.some(f => f.st.judged > 0 && dist(f, u) <= 3) ? 8 : 0;
        if ((fx.widen || fx.reach || fx.twin) && !(u.st.widen > 0 || u.st.reach > 0 || u.st.twin > 0)) { // Metamagic: only worth the AP when a spell can follow
          const sp1 = u.ab.filter(x => AB[x] && AB[x].k === 'dmg' && LD().isSpell(AB[x]) && cost(u, x) + A.c <= L && manaCost(u, x) <= u.mana && !(u.cd[x] > 0) && !blockReason(u, x));
          if (sp1.length) {
            const f0 = foes.filter(f => !hidden(f)).sort((p, q) => dist(p, u) - dist(q, u))[0], crowd = f0 ? near(f0, 2) : 0;
            if (fx.twin) v += u.mana >= 14 ? 5 : 1.5;
            if (fx.widen) v += crowd >= 2 ? 2 + 2 * crowd : 1;
            if (fx.reach) v += f0 && !sp1.some(x => inRange(u, AB[x], f0.x, f0.y)) ? 8 : 0.5;
          }
        }
        if (fx.quickcast && !(u.st.quickcast > 0)) v += u.ab.some(x => AB[x] && AB[x].k === 'dmg' && LD().isSpell(AB[x]) && AB[x].c >= 2 && cost(u, x) <= L && manaCost(u, x) <= u.mana && !(u.cd[x] > 0) && !blockReason(u, x)) ? 4 : 0;   // Quick Cast: only when a 2+ AP spell can follow
        if (fx.regen && !(u.st.regen > 0)) v += Math.min(fx.regen[0] * fx.regen[1], u.max - u.hp) * 0.5;
        if (A.triggers && A.triggers.some(g => g.effects && g.effects.some(e => e.type === 'armInterrupt'))) v += near(u, 2) ? 6 : 1;
        if (A.refundAP) v += u.hp > u.max * 0.6 && L <= 2 ? 5 : 0;
        if (A.spendCharge && A.spendCharge.shieldPer) v += (u.charge || 0) * A.spendCharge.shieldPer * (th ? 0.7 : 0.2);
        if (A.hpCostPct) v -= u.hp < u.max * 0.5 ? 6 : 1;
        if (fx.deathSave && !(u.st.deathSave > 0)) v += near(u, 2) || foes.some(f => dist(f, u) <= 3) ? (u.hp > u.max * 0.3 ? 9 : 0) : 0;
        if (A.aiBonus) v += A.aiBonus;
        for (const g of A.triggers || []) for (const e of g.effects || []) {
          if (e.type === 'teleport' && e.anchor === 'nearestEnemy') { const f0 = foes.filter(f => !hidden(f)).sort((p, q) => dist(p, u) - dist(q, u))[0]; if (f0 && dist(f0, u) <= 1 && u.ab.some(x => AB[x] && AB[x].k === 'dmg' && AB[x].r > 2)) { const all = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push({ x, y }); const hx = TR().pickTeleportHex(e.mode, u, f0, e.hexes, { dist, all: () => all, free: (x, y) => !rockAt(x, y) && !at(x, y) }); if (hx && dist(hx, f0) > dist(u, f0) + 1) v += 6 + (u.hp < u.max * 0.5 ? 5 : 0); } }
          if (e.type === 'reduceCooldown' && e.target === 'self') v += Object.values(u.cd).filter(n => n > 0).length * 3;
          if (e.type === 'heal' && e.target === 'self') v += Math.min(e.amount, u.max - u.hp) * 0.8;
          if (e.type === 'gainMana' && e.target === 'self' && u.manaMax && u.mana < u.manaMax * 0.6) v += Math.min(e.amount, u.manaMax - u.mana) * 0.6;
          if (e.type === 'heal' && e.target === 'pet') { const pt = petOf(u); if (pt) v += Math.min(e.amount, pt.max - pt.hp) * 0.8; }
        }
        if (v > 0) C.push([v, () => act(u, a, u), a]); continue;
      }
      if (A.k === 'move') {
        const melee = u.ab.filter(x => AB[x] && AB[x].k === 'dmg' && AB[x].r <= 1 && x !== a);
        if (!melee.length || foes.some(f => dist(f, u) === 1 && !hidden(f))) continue;
        let best = null, bv = 0;
        for (const [k] of slipMap(u, a)) {
          const [x, y] = k.split(',').map(Number); if (A.climbBonus && ht(x, y) <= ht(u.x, u.y)) continue; const adj = foes.filter(f => dist(f, { x, y }) === 1 && !hidden(f));
          for (const f of adj) { const v = 6 + Math.max(...melee.map(m => est(m, f))) * 0.5 + (1 - f.hp / f.max) * 3; if (v > bv) { bv = v; best = [x, y]; } }
        }
        if (best) { const tb = A.triggers ? 3 : 0; C.push([bv + tb, () => { moveTo(u, best[0], best[1], cost(u, a), A.mv, false, A.climbBonus || 0); noteAbility(u, a); }, a]); }
        continue;
      }
      if (A.k === 'trap') {
        if (traps.some(r => r.owner === u && r.a === a)) continue;
        const f0 = foes.filter(f => !hidden(f)).sort((x, y) => dist(x, u) - dist(y, u))[0]; if (!f0 || dist(f0, u) < 2 || dist(f0, u) > 6) continue;
        let tile = null, td = 99; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!trapTileOk(u, A, x, y)) continue; const d = dist({ x, y }, f0); if (d >= 1 && d < td) { td = d; tile = { x, y }; } }
        if (tile) C.push([7, () => act(u, a, null, tile), a]); continue;
      }
    }
    const mc = a => manaCost(u, a) || 0;
    const fin = C.map(([v, go, a]) => { let s = v / (0.6 + 0.4 * Math.max(1, cost(u, a))); if (u.usedAb && u.usedAb.has(a) && a !== u.attackId) s *= 0.85; if (mc(a) > 0 && u.manaMax && u.mana < u.manaMax * 0.25) s *= 0.8; return [s, go]; }).sort((x, y) => y[0] - x[0]);
    const canMove = L >= moveCost(u) && !isBlocked(u, 'move') && !(CR.movement.standardMoveOncePerTurn && u.hasMovedThisTurn);
    const idle = !fin.length || fin[0][0] < 3; // nothing worth much from here: close in first, then act
    if (fin.length && fin[0][0] > 0.5 && !(idle && canMove && nd(u.x, u.y) > 2)) { fin[0][1](); return true; }
    if (canMove) {
      const effs = u.ab.filter(a => AB[a].k === 'dmg').map(a => [a, effP(u, AB[a], a)]), topP = Math.max(0, ...effs.map(e => e[1])), dmgA = effs.filter(e => e[1] > 0 && e[1] >= topP * 0.5).map(e => AB[e[0]]);
      const score = (x, y) => { const hit = foes.some(f => dmgA.some(A => inRange({ x, y, st: u.st }, A, f.x, f.y))); return (hit ? AI.canHitScoreBonus + nd(x, y) : -nd(x, y)) + ht(x, y) * AI.heightScorePerLevel; };
      let best = null, bs = score(u.x, u.y);
      for (const k of reach(u).keys()) { const [x, y] = k.split(',').map(Number), s = score(x, y); if (s > bs) { bs = s; best = [x, y]; } }
      if (best) { moveTo(u, best[0], best[1]); return true; }
    }
    if (fin.length && fin[0][0] > 0.5) { fin[0][1](); return true; }
    return false;
  }
  // Confused: acts on its own against the nearest unit of EITHER team (lowest HP breaks ties); otherwise walks toward it.
  // Fear: at the start of its turn the unit runs from the nearest enemies (free movement), then cannot act.
  function fleeMove(u) {
    const foes = alive().filter(f => f.team !== u.team); if (!foes.length || u.hp <= 0) return;
    const nd = (x, y) => Math.min(...foes.map(f => dist({ x, y }, f)));
    let best = null, bd = nd(u.x, u.y);
    for (const k of reach(u).keys()) { const [x, y] = k.split(',').map(Number), d = nd(x, y); if (d > bd) { bd = d; best = [x, y]; } }
    if (best) moveTo(u, best[0], best[1], 0, moveRange(u), false);
  }
  function aiConfused(u, L) {
    const others = alive().filter(f => f !== u && !hidden(f));
    if (!others.length) return false;
    const nearest = (x, y) => others.map(f => ({ f, d: dist({ x, y }, f) })).sort((a, b) => a.d - b.d || a.f.hp - b.f.hp)[0];
    const n0 = nearest(u.x, u.y);
    // random skill on a random unit of EITHER team: attacks, heals and buffs all roll
    const opts = u.ab.filter(a => ['dmg', 'debuff', 'heal', 'buff'].includes(AB[a].k) && cost(u, a) <= L && !(AB[a].ct > 0 && u.cast) && !(u.cd[a] > 0) && !blockReason(u, a));
    const plays = [];
    for (const a of opts) {
      const A = AB[a];
      const pool = alive().filter(t => (A.k === 'heal' || A.k === 'buff' || t !== u) && !(A.swap && t === u) && (t === u || !hidden(t)) && inRange(u, A, t.x, t.y) && !(A.minR && dist(u, t) < A.minR));
      if (pool.length) plays.push([a, pool]);
    }
    if (plays.length) { const [a, pool] = plays[Math.floor(Math.random() * plays.length)]; act(u, a, pool[Math.floor(Math.random() * pool.length)]); return true; }
    if (L >= moveCost(u) && !isBlocked(u, 'move') && !(CR.movement.standardMoveOncePerTurn && u.hasMovedThisTurn)) {
      let best = null, bd = n0.d;
      for (const k of reach(u).keys()) { const [x, y] = k.split(',').map(Number), d = dist({ x, y }, n0.f); if (d < bd) { bd = d; best = [x, y]; } }
      if (best) { moveTo(u, best[0], best[1]); return true; }
    }
    return false;
  }

  // ------------------------------------------------------------------ turn order and the battle loop (index.html advance / nextTurn / endTurn)
  const evSort = (a, b) => (Math.abs(a.t - b.t) > 1e-9 ? a.t - b.t : 0) || a.p - b.p || a.team - b.team;
  function advance() {
    for (let i = 0; i < 200; i++) {
      const evs = [];
      for (const u of alive()) {
        evs.push({ t: Math.max(0, (CR.turn.meterThreshold - u.meter) / sp(u)), p: 1, team: u.team === 'P' ? 0 : 1, u });
        if (u.cast) evs.push({ t: Math.max(0, (u.cast.need - u.cast.meter) / sp(u)), p: 0, team: 0, u, cast: true });
      }
      if (!evs.length) return null;
      evs.sort(evSort); const e = evs[0];
      alive().forEach(u => { const d = e.t * sp(u); u.meter += d; if (u.cast) u.cast.meter += d; });
      if (!e.cast) return e.u;
      resolveCast(e.u);
      if (over) return null;
    }
    return null;
  }
  function checkEnd() {
    if (over) return;
    const p = alive().some(u => u.baseTeam === 'P'), e = alive().some(u => u.baseTeam === 'E');
    if (!p) { over = true; winner = 'E'; } else if (!e) { over = true; winner = 'P'; }
  }
  // Starts the next turn. Returns false when the unit died or the battle ended before it could act.
  function beginTurn(best) {
    TURN++; active = best;
    active.team = active.baseTeam; active.guard = false; active.hasMovedThisTurn = false; active.movedAny = false; active.usedSkill = false; active.tf = {}; active.usedAb = new Set(); active.armed = []; active.pulled = null;
    spent = 0; bonus = active.charge * CR.charge.bonusPointsPerCharge + (active.apBonus || 0);
    if (TEL) { const c = cls(active); if (c && !active.owner) c.turns++; for (const id of active.ab) if (abst(id) && !active.owner) abst(id).avail++; }
    if (active.st.charm > 0) active.team = active.baseTeam === 'P' ? 'E' : 'P';
    for (const k of TICK) { // start of own turn: poison/bleed/burn hurt, regen heals (each stacked instance ticks on its own)
      const p = active.st[k]; if (!p) continue;
      const prev = active.hp, insts = LD().dotInsts(p).slice();
      if (CR.statuses[k].negative) {
        for (const i of insts) {
          const before = active.hp; active.hp = Math.max(0, active.hp - i.d);
          if (TEL) { const dealt = before - active.hp, sc = i.sc && TEL.classStats[i.sc]; if (sc) { sc.dmg += dealt; sc.dot += dealt; } const as = abst(i.ab); if (as) as.dmg += dealt; const vc = cls(active); if (vc && !active.owner) vc.taken += dealt; }
          if (active.hp <= 0) break;
        }
      } else {
        const hm = LD().healMult(active);
        for (const i of insts) {
          const h = Math.min(Math.round(i.d * hm), active.max - active.hp); active.hp += h;
          if (TEL) { const sc = i.sc && TEL.classStats[i.sc]; if (sc) sc.heal += h; const as = abst(i.ab); if (as) as.heal += h; }
        }
      }
      if (LD().dotAdvance(p)) { active.st[k] = null; fire('onStatusExpired', active, { status: k }); }
      if (active.hp <= 0) { onDeath(active, null, insts[0].ab, insts[0].sc); break; }
      checkBloodied(active, prev);
    }
    checkEnd();
    if (active.hp <= 0 || over) return false;
    active.mana = Math.min(active.manaMax, active.mana + active.manaRegen + LD().manaRegenBonus(active)); // mana trickles back at the start of your turn
    fire('onTurnStart', active, {}); checkEnd();
    if (!over && active.hp > 0 && active.st.fear > 0) fleeMove(active);
    return !over;
  }
  function endTurn(skipped) {
    if (over) return;
    if (!skipped) { fire('onTurnEnd', active, {}); checkEnd(); if (over) return; }
    const used = Math.min(bonus, Math.max(0, spent - ppt())); // bonus points are spent last
    active.charge = Math.max(0, active.charge - Math.ceil(used / CR.charge.bonusPointsPerCharge));
    for (const k of DEC) if (active.st[k] > 0 && --active.st[k] <= 0) fire('onStatusExpired', active, { status: k });
    for (const k in active.cd) if (active.cd[k] > 0) active.cd[k]--;
    active.team = active.baseTeam; // charm only lasts through its own turn
    active.meter = -spent * CR.turn.meterPenaltyPerPointSpent + (active.meterBank || 0); active.meterBank = 0;
  }

  function pickBattlefield() {
    const maps = GAME_DATA.maps || {};
    const choice = document.getElementById('mapFilter') ? document.getElementById('mapFilter').value : 'rotate';
    const keys = Object.keys(maps);
    if (!keys.length) return { key: 'default', bf: CR.battlefield };
    if (maps[choice]) return { key: choice, bf: maps[choice] };
    const classic = ['classic_ridge', 'corner_ambush', 'twin_cliffs', 'king_spire', 'sunken_causeway'].filter(k => maps[k]);
    const pool = choice === 'classic' && classic.length ? classic : keys;
    const k = pool[Math.floor(Math.random() * pool.length)];
    return { key: k, bf: maps[k] };
  }

  function simulateBattle(partyP, partyE, telemetry) {
    initRules();
    const picked = pickBattlefield(), bf = picked.bf;
    HT = bf.heights; H = HT.length; W = HT[0].length;
    ROCKS = new Set((bf.rocks || []).map(r => Array.isArray(r) ? r.join(',') : r));
    // Maps list spawn tiles per side; a bigger squad fills in the nearest free hexes.
    const fillSpawns = (list, n, other) => {
      const out = list.slice(0, n), taken = new Set(list.concat(other).map(q => q.join(',')));
      for (let r = 1; out.length < n && r < 8; r++)
        for (const base of list.slice())
          for (const q of nbrs(base[0], base[1]).filter(z => inb(z[0], z[1]) && !rockAt(z[0], z[1])))
            if (out.length < n && !taken.has(q.join(','))) { taken.add(q.join(',')); out.push(q); }
      return out;
    };
    const spawnsP = fillSpawns(bf.spawns.P, partyP.length, bf.spawns.E), spawnsE = fillSpawns(bf.spawns.E, partyE.length, bf.spawns.P);
    const pid = e => (typeof e === 'string' ? e : e.p), sid = e => (typeof e === 'string' ? null : e.s);   // a party entry is a class id or {p: primary, s: secondary}
    const lvEl = document.getElementById('unitLevel'), level = lvEl ? Math.max(1, parseInt(lvEl.value, 10) || 1) : 1;
    units = partyP.map((c, i) => createUnit(pid(c), 'P', spawnsP[i], i, sid(c), null, level)).concat(partyE.map((c, i) => createUnit(pid(c), 'E', spawnsE[i], i, sid(c), null, level)));
    traps = []; active = null; spent = 0; bonus = 0; TURN = 0; over = false; winner = null; CUR = null; EXO = 0;
    TEL = telemetry; BAT = { firstKill: null };
    // Optional sudden death (off by default: the game has none). window.SIM_FATIGUE = true adds damage and halves healing in very long fights.
    const fatStart = 40 + (partyP.length + partyE.length) * 4;
    FAT = window.SIM_FATIGUE ? () => TURN > fatStart ? { dmg: Math.floor((TURN - (fatStart - 10)) / 10), heal: 0.5 } : { dmg: 0, heal: 1 } : null;
    const maxTurns = 300 + (partyP.length + partyE.length) * 40;

    units.forEach(u => fire('onBattleStart', u, {}));
    checkEnd();
    while (!over && TURN < maxTurns) {
      const best = advance();
      if (!best) break;
      const turnsBefore = TURN, cid = rootOf(best);
      if (!beginTurn(best)) continue;
      const c = TEL && !best.owner ? cls(best) : null;
      if (skipsTurn(best)) { if (c) c.idleTurns++; endTurn(true); continue; }   // stun: the unit loses its turn (no onTurnEnd triggers)
      for (let n = 0; n < CR.ai.maxActionsPerTurn && !over; n++) {
        if (best.hp <= 0) break;
        const did = aiStep(best);
        if (!did || best.hp <= 0) break;
      }
      if (c && !best.usedSkill) c.idleTurns++;
      if (over) break;
      if (best.hp > 0) endTurn(); else best.team = best.baseTeam;   // a unit that died on its own turn just passes the turn on
    }
    const w = winner || 'Draw';
    const sv = w === 'Draw' ? [] : units.filter(u => u.baseTeam === w && u.hp > 0 && !u.owner);
    const maxSum = sv.reduce((a, u) => a + u.max, 0);
    if (telemetry) for (const u of units) if (u.hp > 0 && !u.owner) { const c = cls(u); if (c) c.survived++; }
    const res = { winner: w, turns: TURN, mapKey: picked.key, survivors: sv.length, hpPct: maxSum ? sv.reduce((a, u) => a + u.hp, 0) / maxSum : 0, firstKill: BAT.firstKill,
      loads: units.filter(u => !u.owner).map(u => ({ team: u.baseTeam, c: rootOf(u), gear: u.gearIds || {}, pas: u.passiveIds || [] })) };
    TEL = null;
    return res;
  }

  // click a column header to sort a .sortable table (numeric when the cells parse as numbers)
  function makeSortable(root) {
    root.querySelectorAll('table.sortable').forEach(tb => {
      const heads = tb.querySelectorAll('th');
      heads.forEach((th, ci) => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          const body = tb.tBodies[0], rows = Array.from(body.rows), dir = th.dataset.dir === 'desc' ? 'asc' : 'desc';
          heads.forEach(h => { delete h.dataset.dir; });
          th.dataset.dir = dir;
          const val = r => { const t = r.cells[ci].textContent.replace(/[%,]/g, '').trim(), n = parseFloat(t); return isNaN(n) ? t.toLowerCase() : n; };
          rows.sort((a, b) => { const x = val(a), y = val(b); const c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y)); return dir === 'desc' ? -c : c; });
          rows.forEach(r => body.appendChild(r));
        });
      });
    });
  }
  function toCsv(rows, cols) {
    const q = v => { const t = String(v === undefined || v === null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return cols.join(',') + '\n' + rows.map(r => cols.map(c => q(typeof r[c] === 'number' ? Math.round(r[c] * 1000) / 1000 : r[c])).join(',')).join('\n');
  }
  window.SIM_EXPORT = function (kind) {
    const L = window.SIM_LAST; if (!L) return;
    let text, name, type = 'text/csv';
    if (kind === 'classes') { text = toCsv(L.classes, Object.keys(L.classes[0])); name = 'sim-classes.csv'; }
    else if (kind === 'abilities') { text = toCsv(L.abilities, Object.keys(L.abilities[0])); name = 'sim-abilities.csv'; }
    else if (kind === 'loadouts') { const R = window.SIM_LOADOUTS || []; if (!R.length) return; text = toCsv(R, ['dim', 'label', 'cls', 'picks', 'wins', 'rate', 'ci']); name = 'sim-loadouts.csv'; }
    else if (kind === 'matchups') {
      const rows = []; Object.keys(L.matchups).forEach(a => Object.keys(L.matchups[a]).forEach(b => rows.push({ class: a, opponent: b, wins: L.matchups[a][b].w, meetings: L.matchups[a][b].n, winRate: L.matchups[a][b].w / L.matchups[a][b].n })));
      text = toCsv(rows, ['class', 'opponent', 'wins', 'meetings', 'winRate']); name = 'sim-matchups.csv';
    } else { text = JSON.stringify(L, null, 1); name = 'sim-results.json'; type = 'application/json'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
  function renderCompTable(title, colHeader, rows) {
    if (!rows.length) return '';
    return '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">' + title + '</h2>' +
      '<table><thead><tr><th>' + colHeader + '</th><th>Picks</th><th>Avg Turns</th><th>Win Rate</th></tr></thead><tbody>' +
      rows.map(r => {
        const cls = r.rate >= 58 ? 'win-high' : (r.rate <= 42 ? 'win-low' : '');
        return '<tr><td><strong>' + r.label + '</strong></td><td>' + r.picks + '</td><td>' + r.avgTurns.toFixed(1) + '</td>' +
          '<td class="' + cls + '"><div class="bar-bg"><div class="bar-fill" style="width:' + Math.min(100, r.rate) + '%"></div></div>' +
          r.rate.toFixed(1) + '%</td></tr>';
      }).join('') + '</tbody></table>';
  }

  window.SIM_API = { simulateBattle: simulateBattle };   // used by the optimal-play checks
  window.runSimulation = function() {
    const count = parseInt(document.getElementById('matchCount').value, 10) || 500;
    const filter = document.getElementById('tierFilter').value;
    const teamSize = Math.min(6, Math.max(1, parseInt(document.getElementById('teamSize') ? document.getElementById('teamSize').value : '3', 10) || 3));

    let pool = Object.keys(GAME_DATA.classes).filter(id => GAME_DATA.classes[id].selectable);
    if (filter === 'tier2') pool = pool.filter(id => !ENTRY_IDS.includes(id));
    if (filter === 'entry') pool = pool.filter(id => ENTRY_IDS.includes(id));

    const telemetry = { classStats: {}, abStats: {} };
    pool.forEach(id => {
      telemetry.classStats[id] = { picks: 0, wins: 0, dmg: 0, heal: 0, turns: 0, idleTurns: 0, taken: 0, absorbed: 0, overheal: 0, kills: 0, deaths: 0, deathTurn: 0, firstBlood: 0, survived: 0, ap: 0, moveAp: 0, dot: 0 };
    });
    Object.keys(GAME_DATA.abilities || {}).forEach(abId => {
      telemetry.abStats[abId] = { casts: 0, dmg: 0, heal: 0, hits: 0, kills: 0, overkill: 0, overheal: 0, absorbed: 0, avail: 0 };
    });

    const compStats = {};
    const archStats = {};
    const recordTeam = (teamIds, won, turns) => {
      const sortedIds = teamIds.slice().sort();
      const compKey = sortedIds.join('+');
      if (!compStats[compKey]) {
        compStats[compKey] = {
          label: sortedIds.map(id => GAME_DATA.classes[id].name).join(' + '),
          picks: 0,
          wins: 0,
          turns: 0
        };
      }
      compStats[compKey].picks++;
      compStats[compKey].turns += turns;
      if (won) compStats[compKey].wins++;

      const roles = teamIds.map(id => GAME_DATA.classes[id].role).sort();
      const archKey = roles.join(' + ');
      if (!archStats[archKey]) archStats[archKey] = { label: archKey, picks: 0, wins: 0, turns: 0 };
      archStats[archKey].picks++;
      archStats[archKey].turns += turns;
      if (won) archStats[archKey].wins++;
    };

    const agg = { lens: [], side: { P: 0, E: 0 }, surv: 0, hp: 0, nw: 0, fk: 0, fkn: 0, maps: {}, vs: {} };
    let totalTurns = 0;
    let draws = 0;
    const drawsByMap = {};
    const pickTeam = () => Array.from({ length: teamSize }, () => pool.at(Math.floor(Math.random() * pool.length)));
    // Secondary class: 'random' gives every unit a random other class as its secondary (full access to its skills, no cost penalty by default)
    const secMode = document.getElementById('secMode') ? document.getElementById('secMode').value : 'none';
    const secPool = Object.keys(GAME_DATA.classes).filter(id => GAME_DATA.classes[id].selectable);
    const withSec = ids => secMode === 'random'
      ? ids.map(id => { const o = secPool.filter(x => x !== id); return { p: id, s: o.at(Math.floor(Math.random() * o.length)) }; })
      : ids;
    const buildModeNow = document.getElementById('buildMode') ? document.getElementById('buildMode').value : 'base';
    const trackLoads = buildModeNow === 'equipped' || buildModeNow === 'gear';
    const LS = {};   // loadout stats: 'dimension|label' -> { dim, label, cls, n, w }
    const lsAdd = (dim, label, won, cls) => { const k = dim + '|' + label + '|' + (cls || ''); const o = LS[k] || (LS[k] = { dim: dim, label: label, cls: cls || '', n: 0, w: 0 }); o.n++; if (won) o.w++; };
    const recordLoads = (loads, winner) => {
      const G = GAME_DATA.gear, ARM = ['none', 'light', 'medium', 'heavy'];
      for (const u of loads) {
        const won = u.team === winner, g = u.gear, mh = g.MainHand ? G[g.MainHand] : null, oh = g.OffHand ? G[g.OffHand] : null;
        const fam = mh ? mh.weapon.family : 'unarmed', hands = mh ? (mh.weapon.hands === 2 ? '2H' : '1H') : 'unarmed';
        const ohType = oh ? (oh.offType || 'off hand') : (mh && mh.weapon.hands === 2 ? 'none (2H weapon)' : 'none (empty)');
        const hw = g.Head ? G[g.Head].weight : 'none', bw = g.Body ? G[g.Body].weight : 'none';
        lsAdd('Weapon family', fam, won); lsAdd('Hands', hands + (hands === '1H' ? (oh ? ' + off hand' : ' + empty off hand') : ''), won);
        if (mh) lsAdd('Main hand item', mh.name, won);
        lsAdd('Off-hand type', ohType, won); if (oh) lsAdd('Off-hand item', oh.name, won);
        lsAdd('Body armor', bw, won); lsAdd('Head armor', hw, won);
        lsAdd('Armor set (head / body)', hw + ' / ' + bw, won);
        if (g.Accessory) lsAdd('Accessory', G[g.Accessory].name, won); else lsAdd('Accessory', 'none', won);
        for (const p of u.pas) lsAdd('Passive', GAME_DATA.passives[p] ? GAME_DATA.passives[p].name : p, won);
        lsAdd('Class x weapon family', GAME_DATA.classes[u.c].name + ' - ' + fam, won, u.c);
        lsAdd('Class x hands', GAME_DATA.classes[u.c].name + ' - ' + hands, won, u.c);
        lsAdd('Class x off-hand type', GAME_DATA.classes[u.c].name + ' - ' + ohType, won, u.c);
      }
    };
    const secStats = {}, pairStats = {};
    secPool.forEach(id => { secStats[id] = { picks: 0, wins: 0 }; });

    for (let i = 0; i < count; i++) {
      const pTeam = pickTeam();
      const eTeam = pickTeam();
      pTeam.forEach(id => { telemetry.classStats[id].picks++; });
      eTeam.forEach(id => { telemetry.classStats[id].picks++; });

      const pB = withSec(pTeam), eB = withSec(eTeam);
      const res = simulateBattle(pB, eB, telemetry);
      if (secMode === 'random') {
        const mark = (builds, won) => builds.forEach(b => {
          secStats[b.s].picks++; if (won) secStats[b.s].wins++;
          const k = b.p + '|' + b.s; const pr = pairStats[k] || (pairStats[k] = { p: b.p, s: b.s, n: 0, w: 0 }); pr.n++; if (won) pr.w++;
        });
        if (res.winner !== 'Draw') { mark(pB, res.winner === 'P'); mark(eB, res.winner === 'E'); }
      }
      if (trackLoads && res.winner !== 'Draw') recordLoads(res.loads, res.winner);
      totalTurns += res.turns;
      agg.lens.push(res.turns);
      const mp = agg.maps[res.mapKey] || (agg.maps[res.mapKey] = { n: 0, p: 0, d: 0, turns: 0 });
      mp.n++; mp.turns += res.turns;
      if (res.firstKill != null) { agg.fk += res.firstKill; agg.fkn++; }
      if (res.winner === 'Draw') mp.d++;
      else {
        agg.side[res.winner]++; agg.surv += res.survivors; agg.hp += res.hpPct; agg.nw++;
        if (res.winner === 'P') mp.p++;
        const W = res.winner === 'P' ? pTeam : eTeam, Lz = res.winner === 'P' ? eTeam : pTeam;
        for (const a of new Set(W)) for (const b of new Set(Lz)) {
          (agg.vs[a] || (agg.vs[a] = {}))[b] = agg.vs[a][b] || { w: 0, n: 0 }; agg.vs[a][b].w++; agg.vs[a][b].n++;
          (agg.vs[b] || (agg.vs[b] = {}))[a] = agg.vs[b][a] || { w: 0, n: 0 }; agg.vs[b][a].n++;
        }
      }
      if (res.winner === 'Draw') {
        draws++;
        drawsByMap[res.mapKey] = (drawsByMap[res.mapKey] || 0) + 1;
      } else {
        const pWon = res.winner === 'P';
        const winTeam = pWon ? pTeam : eTeam;
        winTeam.forEach(id => { telemetry.classStats[id].wins++; });
        recordTeam(pTeam, pWon, res.turns);
        recordTeam(eTeam, !pWon, res.turns);
      }
    }

    const drawSub = draws > 0
      ? Object.entries(drawsByMap).map(([k, v]) => k + ': ' + v).join(', ')
      : '0 timeouts across all maps';

    document.getElementById('summaryCards').innerHTML =
      '<div class="card"><div class="val">' + count + ' (' + teamSize + 'v' + teamSize + ')</div><div class="lbl">Matches Simulated</div></div>' +
      '<div class="card"><div class="val">' + (document.getElementById('gearTier') ? 'Tier ' + document.getElementById('gearTier').value : 'Tier 1') + '</div><div class="lbl">Gear Tier</div></div>' +
      '<div class="card"><div class="val">' + (totalTurns / count).toFixed(1) + '</div><div class="lbl">Avg Turns / Match</div></div>' +
      '<div class="card"><div class="val" style="color:' + (draws > count * 0.02 ? '#f87171' : '#34d399') + '">' + draws + ' (' + ((draws / count) * 100).toFixed(1) + '%)</div><div class="lbl">Draws</div><div style="font-size:0.7rem;color:#9ca3af;margin-top:2px;">' + drawSub + '</div></div>' +
      '<div class="card"><div class="val">' + pool.length + '</div><div class="lbl">Classes Tested</div></div>';

    const classRows = pool.map(id => {
      const s = telemetry.classStats[id];
      const picks = s.picks || 1;
      const turns = s.turns || 1;
      const p = s.picks ? s.wins / s.picks : 0;
      return {
        id: id,
        name: GAME_DATA.classes[id].name,
        role: GAME_DATA.classes[id].role,
        picks: s.picks,
        rate: p * 100,
        ci: s.picks ? 1.96 * Math.sqrt(p * (1 - p) / s.picks) * 100 : 0,
        avgDmg: s.dmg / picks,
        avgHeal: s.heal / picks,
        avgTaken: s.taken / picks,
        avgAbs: s.absorbed / picks,
        avgOver: s.overheal / picks,
        kills: s.kills / picks,
        survive: (s.survived / picks) * 100,
        deathTurn: s.deaths ? s.deathTurn / s.deaths : 0,
        dmgPerAp: s.ap ? s.dmg / s.ap : 0,
        firstBlood: (s.firstBlood / picks) * 100,
        dotShare: s.dmg ? (s.dot / s.dmg) * 100 : 0,
        moveShare: (s.ap + s.moveAp) ? (s.moveAp / (s.ap + s.moveAp)) * 100 : 0,
        avgTurns: s.turns / picks,
        idlePct: (s.idleTurns / turns) * 100
      };
    }).sort((a, b) => b.rate - a.rate);

    const minCompSample = teamSize <= 2 ? (count >= 2000 ? 8 : 3) : (teamSize === 3 ? (count >= 2000 ? 4 : 2) : 2);
    const allComps = Object.values(compStats)
      .filter(t => t.picks >= minCompSample)
      .map(t => ({ label: t.label, picks: t.picks, avgTurns: t.turns / t.picks, rate: (t.wins / t.picks) * 100 }))
      .sort((a, b) => b.rate - a.rate);

    const topComps = allComps.slice(0, 10);
    const botComps = allComps.slice(-10).reverse();

    const minArchSample = teamSize <= 4 ? 5 : 3;
    const archRows = Object.values(archStats)
      .filter(a => a.picks >= minArchSample)
      .map(a => ({ label: a.label, picks: a.picks, avgTurns: a.turns / a.picks, rate: (a.wins / a.picks) * 100 }))
      .sort((a, b) => b.rate - a.rate);

    const owners = {};
    pool.forEach(cid => (GAME_DATA.classes[cid].ab || []).forEach(a => { (owners[a] = owners[a] || []).push(GAME_DATA.classes[cid].name); }));
    const abRows = Object.keys(GAME_DATA.abilities || {}).map(id => {
      const ab = GAME_DATA.abilities[id];
      const s = telemetry.abStats[id];
      return {
        id: id,
        name: ab.n,
        kind: ab.k,
        cost: ab.c,
        owners: (owners[id] || []).join(', '),
        casts: s.casts,
        perMatch: s.casts / count,
        useRate: s.avail ? s.casts / s.avail : 0,
        avgDmg: s.casts ? s.dmg / s.casts : 0,
        dmgPerAp: s.casts && ab.c ? s.dmg / (s.casts * ab.c) : 0,
        avgHeal: s.casts ? s.heal / s.casts : 0,
        hitsPerCast: s.casts ? s.hits / s.casts : 0,
        kills: s.kills,
        overkill: s.hits ? s.overkill / s.hits : 0,
        overheal: s.casts ? s.overheal / s.casts : 0,
        avail: s.avail
      };
    }).sort((a, b) => b.casts - a.casts);

    // ---- extra aggregates for the richer report
    const lens = agg.lens.slice().sort((a, b) => a - b);
    const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
    const p90 = lens.length ? lens[Math.floor(lens.length * 0.9)] : 0;
    const bucket = 10, hist = {};
    lens.forEach(t => { const b = Math.floor(t / bucket) * bucket; hist[b] = (hist[b] || 0) + 1; });
    const histMax = Math.max(1, ...Object.values(hist));
    const decided = agg.side.P + agg.side.E;
    const extraCards =
      '<div class="card"><div class="val">' + (decided ? (agg.side.P / decided * 100).toFixed(1) : '0') + '%</div><div class="lbl">Side P Win Rate</div></div>' +
      '<div class="card"><div class="val">' + median + ' / ' + p90 + '</div><div class="lbl">Median / P90 Turns</div></div>' +
      '<div class="card"><div class="val">' + (agg.nw ? (agg.surv / agg.nw).toFixed(1) : '0') + ' · ' + (agg.nw ? (agg.hp / agg.nw * 100).toFixed(0) : '0') + '%</div><div class="lbl">Winner Survivors · HP Left</div></div>' +
      '<div class="card"><div class="val">' + (agg.fkn ? (agg.fk / agg.fkn).toFixed(1) : '-') + '</div><div class="lbl">Avg First-Kill Turn</div></div>';
    document.getElementById('summaryCards').insertAdjacentHTML('beforeend', extraCards);

    const T = (cls, v, d) => '<td class="' + cls + '">' + (v === null || v === undefined ? '' : (typeof v === 'number' ? v.toFixed(d === undefined ? 1 : d) : v)) + '</td>';
    const classTable =
      '<h2 style="font-size:1.05rem; margin:12px 0 8px; color:#f59e0b;">Class Win Rates &amp; Combat Telemetry (' + teamSize + 'v' + teamSize + ')</h2>' +
      '<div class="scroll"><table class="sortable"><thead><tr><th>Class</th><th>Role</th><th>Win Rate</th><th title="95% confidence half-width">±</th><th>Picks</th><th>Dmg/M</th><th>Taken/M</th><th title="Shield + intercept absorbed per match">Absorb/M</th><th>Heal+Shd/M</th><th title="Wasted healing per match">Overheal/M</th><th>Kills/M</th><th title="Share of picks still alive at the end">Survive %</th><th title="Average match turn when this class dies">Death Turn</th><th title="Damage per AP spent on skills">Dmg/AP</th><th title="Share of matches where this class got the first kill">1st Blood %</th><th title="Share of damage from damage-over-time">DoT %</th><th title="Share of AP spent walking">Move AP %</th><th>Turns/M</th><th>No-Skill %</th></tr></thead><tbody>' +
      classRows.map(r => {
        const cls = r.rate >= 56 ? 'win-high' : (r.rate <= 44 ? 'win-low' : '');
        const idleCls = r.idlePct >= 45 ? 'win-low' : '';
        return '<tr><td><strong>' + r.name + '</strong></td><td>' + r.role + '</td>' +
          '<td class="' + cls + '"><div class="bar-bg"><div class="bar-fill" style="width:' + Math.min(100, r.rate) + '%"></div></div>' + r.rate.toFixed(1) + '%</td>' +
          T('', r.ci) + T('', r.picks, 0) + T('', r.avgDmg) + T('', r.avgTaken) + T('', r.avgAbs) + T('', r.avgHeal) + T(r.avgOver > 4 ? 'win-low' : '', r.avgOver) +
          T('', r.kills, 2) + T('', r.survive, 0) + T('', r.deathTurn) + T('', r.dmgPerAp, 2) + T('', r.firstBlood, 0) + T('', r.dotShare, 0) + T('', r.moveShare, 0) + T('', r.avgTurns) +
          '<td class="' + idleCls + '">' + r.idlePct.toFixed(0) + '%</td></tr>';
      }).join('') + '</tbody></table></div>';

    // class vs class matchups
    const vsMin = Math.max(4, Math.round(count / 400));
    const cell = (a, b) => { const c = (agg.vs[a] || {})[b]; return c && c.n >= vsMin ? c : null; };
    const order = classRows.map(r => r.id);
    const heat = '<details><summary style="cursor:pointer;color:#f59e0b;margin:14px 0 6px;">Class vs Class Win-Rate Matrix (row beats column; cells need ' + vsMin + '+ meetings)</summary><div class="scroll"><table class="heat"><thead><tr><th></th>' +
      order.map(id => '<th title="' + GAME_DATA.classes[id].name + '">' + GAME_DATA.classes[id].name.slice(0, 4) + '</th>').join('') + '</tr></thead><tbody>' +
      order.map(a => '<tr><th>' + GAME_DATA.classes[a].name + '</th>' + order.map(b => {
        if (a === b) return '<td class="hx"></td>';
        const c = cell(a, b); if (!c) return '<td class="hx">·</td>';
        const r = c.w / c.n, h = Math.round(r * 120);
        return '<td style="background:hsl(' + h + ',55%,' + (28 + Math.abs(r - .5) * 18) + '%)" title="' + GAME_DATA.classes[a].name + ' vs ' + GAME_DATA.classes[b].name + ': ' + c.w + '/' + c.n + '">' + Math.round(r * 100) + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div></details>';
    const bw = order.map(a => {
      const list = order.filter(b => b !== a && cell(a, b)).map(b => ({ b: b, r: cell(a, b).w / cell(a, b).n, n: cell(a, b).n }));
      list.sort((x, y) => x.r - y.r);
      const nm = id => GAME_DATA.classes[id].name;
      const fmt = x => x ? nm(x.b) + ' (' + Math.round(x.r * 100) + '%)' : '-';
      return { name: nm(a), worst: list.slice(0, 3).map(fmt).join(', '), best: list.slice(-3).reverse().map(fmt).join(', ') };
    });
    const bwTable = '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">Best &amp; Worst Matchups</h2><div class="scroll"><table><thead><tr><th>Class</th><th>Beats</th><th>Loses to</th></tr></thead><tbody>' +
      bw.map(r => '<tr><td><strong>' + r.name + '</strong></td><td style="text-align:left">' + r.best + '</td><td style="text-align:left">' + r.worst + '</td></tr>').join('') + '</tbody></table></div>';

    const histHtml = '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">Match Length (turns)</h2><div class="hist">' +
      Object.keys(hist).map(Number).sort((a, b) => a - b).map(b => '<div class="hb"><div class="hbar" style="height:' + Math.round(hist[b] / histMax * 70) + 'px" title="' + hist[b] + ' matches"></div><span>' + b + '</span></div>').join('') + '</div>';
    const mapTable = '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">By Map</h2><table><thead><tr><th>Map</th><th>Matches</th><th>Side P Win %</th><th>Draws</th><th>Avg Turns</th></tr></thead><tbody>' +
      Object.keys(agg.maps).map(k => { const m = agg.maps[k], dec = m.n - m.d; return '<tr><td><strong>' + k + '</strong></td><td>' + m.n + '</td><td>' + (dec ? (m.p / dec * 100).toFixed(1) : '-') + '%</td><td>' + m.d + '</td><td>' + (m.turns / m.n).toFixed(1) + '</td></tr>'; }).join('') + '</tbody></table>';

    const abTable =
      '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">Ability Usage &amp; Output</h2>' +
      '<div class="scroll"><table class="sortable"><thead><tr><th>Ability</th><th>Owners</th><th>AP</th><th>Uses / Match</th><th title="Casts per turn taken by a unit that owns the ability. Under 0.03 = the AI almost never picks it">Casts / Owner Turn</th><th>Avg Dmg / Cast</th><th title="Damage per AP spent">Dmg/AP</th><th title="Targets damaged per cast">Hits / Cast</th><th>Avg Heal+Shd / Cast</th><th>Overheal / Cast</th><th>Kills</th><th title="Damage wasted beyond remaining HP, per hit">Overkill</th><th>Total Casts</th></tr></thead><tbody>' +
      abRows.map(a => {
        const zeroCls = a.casts === 0 ? 'win-low' : '';
        const rare = a.casts > 0 && a.useRate < 0.03 ? 'win-low' : '';
        return '<tr class="' + zeroCls + '"><td><strong>' + a.name + '</strong></td><td style="text-align:left;font-size:.72rem">' + a.owners + '</td><td>' + a.cost + '</td>' +
          T('', a.perMatch, 2) + T(rare, a.useRate, 2) + T('', a.avgDmg) + T('', a.dmgPerAp, 2) + T('', a.hitsPerCast, 2) + T('', a.avgHeal) + T('', a.overheal) + T('', a.kills, 0) + T('', a.overkill) + '<td>' + a.casts + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    let secHtml = '';
    if (secMode === 'random') {
      const secRows = secPool.map(id => {
        const q = secStats[id], p = q.picks ? q.wins / q.picks : 0;
        return { id: id, name: GAME_DATA.classes[id].name, tier: GAME_DATA.classes[id].tier || 0, picks: q.picks, rate: p * 100, ci: q.picks ? 1.96 * Math.sqrt(p * (1 - p) / q.picks) * 100 : 0 };
      }).sort((a, b) => b.rate - a.rate);
      const tierMean = t => { const r = secRows.filter(x => x.tier === t && x.picks); return r.length ? r.reduce((n, x) => n + x.rate, 0) / r.length : 0; };
      const pairRows = Object.values(pairStats).filter(x => x.n >= 12).map(x => ({ p: x.p, s: x.s, n: x.n, rate: x.w / x.n * 100 })).sort((a, b) => b.rate - a.rate);
      const nm = id => GAME_DATA.classes[id].name;
      const pr = r => '<tr><td><strong>' + nm(r.p) + '</strong> + ' + nm(r.s) + '</td><td>' + r.n + '</td><td>' + r.rate.toFixed(0) + '%</td></tr>';
      secHtml = '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">Secondary Kit Value (win rate of units carrying this class as their secondary)</h2>' +
        '<div class="sub">Tier means: entry ' + tierMean(1).toFixed(1) + '% · tier 2 ' + tierMean(2).toFixed(1) + '% · tier 3 ' + tierMean(3).toFixed(1) + '%</div>' +
        '<div class="scroll"><table class="sortable"><thead><tr><th>Secondary Class</th><th>Tier</th><th>Win Rate</th><th>±</th><th>Picks</th></tr></thead><tbody>' +
        secRows.map(r => '<tr><td><strong>' + r.name + '</strong></td><td>' + r.tier + '</td><td class="' + (r.rate >= 56 ? 'win-high' : (r.rate <= 44 ? 'win-low' : '')) + '">' + r.rate.toFixed(1) + '%</td><td>' + r.ci.toFixed(1) + '</td><td>' + r.picks + '</td></tr>').join('') + '</tbody></table></div>' +
        '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">Strongest / Weakest Builds (primary + secondary, min 12 units; small samples)</h2>' +
        '<div class="scroll"><table><thead><tr><th>Build</th><th>Units</th><th>Win Rate</th></tr></thead><tbody>' + pairRows.slice(0, 10).map(pr).join('') + '<tr><td colspan="3" style="text-align:center">…</td></tr>' + pairRows.slice(-10).map(pr).join('') + '</tbody></table></div>';
      window.SIM_SECONDARY = { rows: secRows, pairs: Object.values(pairStats) };
    }
    let loadHtml = '';
    if (trackLoads) {
      const rows = Object.values(LS).map(o => { const p = o.n ? o.w / o.n : 0; return { dim: o.dim, label: o.label, cls: o.cls, picks: o.n, wins: o.w, rate: p * 100, ci: o.n ? 1.96 * Math.sqrt(p * (1 - p) / o.n) * 100 : 0 }; });
      window.SIM_LOADOUTS = rows;
      const dims = ['Weapon family', 'Hands', 'Off-hand type', 'Off-hand item', 'Main hand item', 'Body armor', 'Head armor', 'Armor set (head / body)', 'Accessory', 'Passive'];
      const big = ['Class x weapon family', 'Class x hands', 'Class x off-hand type'];
      const tbl = (r, withCls) => '<div class="scroll"><table class="sortable"><thead><tr><th>Loadout</th><th>Picks</th><th>Win Rate</th><th>±</th></tr></thead><tbody>' +
        r.map(x => '<tr><td><strong>' + x.label + '</strong></td><td>' + x.picks + '</td><td class="' + (x.rate >= 56 ? 'win-high' : (x.rate <= 44 ? 'win-low' : '')) + '">' + x.rate.toFixed(1) + '%</td><td>' + x.ci.toFixed(1) + '</td></tr>').join('') + '</tbody></table></div>';
      const H = '<h2 style="font-size:1.05rem; margin:20px 0 8px; color:#f59e0b;">';
      loadHtml = H + 'Loadout Win Rates (' + (buildModeNow === 'equipped' ? 'random gear + passives' : 'random gear') + '; each unit is a pick, empty slots allowed)</h2>' +
        '<div class="sub">Unit-level win rate by what the unit carried. Differences under the ± are noise. Mixed classes: compare within a class below.</div>' +
        dims.map(d => '<details open style="margin:6px 0"><summary style="cursor:pointer;color:#cbd5e1">' + d + '</summary>' + tbl(rows.filter(x => x.dim === d).sort((a, b) => b.rate - a.rate)) + '</details>').join('') +
        big.map(d => '<details style="margin:6px 0"><summary style="cursor:pointer;color:#cbd5e1">' + d + ' (per class)</summary>' + tbl(rows.filter(x => x.dim === d).sort((a, b) => a.label < b.label ? -1 : 1)) + '</details>').join('');
    }
    const buttons = '<div class="exports"><button onclick="SIM_EXPORT(\'classes\')">Download class CSV</button><button onclick="SIM_EXPORT(\'abilities\')">Download ability CSV</button><button onclick="SIM_EXPORT(\'matchups\')">Download matchup CSV</button>' + (trackLoads ? '<button onclick="SIM_EXPORT(\'loadouts\')">Download loadout CSV</button>' : '') + '<button onclick="SIM_EXPORT(\'json\')">Download all JSON</button></div>';

    window.SIM_LAST = { gearTier: document.getElementById('gearTier') ? +document.getElementById('gearTier').value : 1, secondary: secMode === 'random' ? secStats : null, count: count, teamSize: teamSize, classes: classRows, abilities: abRows, matchups: agg.vs, lens: lens, maps: agg.maps, side: agg.side };
    document.getElementById('resultsTable').innerHTML = buttons + classTable +
      renderCompTable('Role Archetype Synergy (' + teamSize + '-Unit Makeup)', 'Role Lineup', archRows) +
      renderCompTable('Top 10 Highest Win-Rate Squads (Min ' + minCompSample + ' Matches)', teamSize + '-Class Lineup', topComps) +
      renderCompTable('Bottom 10 Lowest Win-Rate Squads (Min ' + minCompSample + ' Matches)', teamSize + '-Class Lineup', botComps) +
      secHtml + loadHtml + heat + bwTable + histHtml + mapTable + abTable;
    makeSortable(document.getElementById('resultsTable'));
  };

  window.addEventListener('load', function() {
    const box = document.getElementById('summaryCards');
    if (!window.GAME_DATA || !GAME_DATA.classes || !GAME_DATA.abilities || !GAME_DATA.combatRules) {
      box.innerHTML = '<div class="card" style="border:1px solid #f59e0b; grid-column: 1 / -1;">' +
        '<div class="lbl" style="color:#fbbf24;">Missing Data Files</div>' +
        '<div style="font-size:0.85rem; margin-top:4px;">Check that data/combatRules.js, classes.js, and abilities.js loaded without syntax errors.</div></div>';
      return;
    }
    window.runSimulation();
  });
})();
