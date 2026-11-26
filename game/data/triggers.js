/* Generic trigger runner, shared by index.html and the simulator (sim.html).
   A passive, gear item or ability may carry   triggers: [ { on, if, limit, effects } ]   (vocabulary: combatRules.keywords).
   This file knows WHAT each condition and effect means; each engine supplies an ADAPTER that knows HOW to do it
   in its own unit model. Adapter methods used:
     specsFor(owner, trigger, ctx) -> [{id, spec, armed?}]   hpPct(u)  has(u,status)  bloodied(u)  dist(a,b)  height(u)  team(u)
     alive(u)  unitsWithin(owner, radius, 'ally'|'enemy')  unspentAP(u)  usedCount(u)  isOwnTurn(u)  tags(abilityId)  kind(abilityId)
     limit(owner, id, 'oncePerTurn'|'oncePerBattle') -> bool (records use)
     damage(src,t,n,{direct,ignoreShield})  heal(src,t,n)  shield(src,t,n)  status(src,t,name,turnsOrPayload)  cleanse(t,n,list)
     refundAP(u,n)  gainCharge(t,n)  gainMana(t,n)  reduceCooldown(t,abilityOrNull,n)  stagger(t,n)  cancelCast(t)  forcedMove(t,from,hexes,'push'|'pull',{src})
     arm(owner, spec)  disarm(owner, armedEntry)  say(text)  warn(text)
   Added with the Tier-3 vocabulary:
     pet(owner) -> living summon or null   aim() -> {x,y} tile the current ability was aimed at   hasMoved(u)  flanking(owner, subject)  stripBuffs(t,count,listOrNull)  detonateDots(owner,t,mult,listOrNull)
     gainMeter(t,amount)  teleport(t, mode, anchor, hexes)  summon(owner, unitId, opts)
   preventDeath needs no adapter method: the engine fires onLethalDamage with ctx {damage, preventDeath:false, keepHp:1}
   before it applies lethal damage, then honours ctx.preventDeath. */
window.GAME_DATA = window.GAME_DATA || {};
(function () {
  const subjectOf = c => c.subject || c.victim || c.target || null;
  let depth = 0;

  const CONDITIONS = {
    selfHpBelowPct: (A, o, c, v) => A.hpPct(o) < v,
    selfHpAbovePct: (A, o, c, v) => A.hpPct(o) > v,
    selfHasStatus: (A, o, c, v) => A.has(o, v),
    selfLacksStatus: (A, o, c, v) => !A.has(o, v),
    selfBloodied: (A, o, c, v) => A.bloodied(o) === !!v,
    subjectHpBelowPct: (A, o, c, v) => { const s = subjectOf(c); return !!s && A.hpPct(s) < v; },
    subjectHasStatus: (A, o, c, v) => { const s = subjectOf(c); return !!s && A.has(s, v); },
    subjectLacksStatus: (A, o, c, v) => { const s = subjectOf(c); return !!s && !A.has(s, v); },
    withinHexes: (A, o, c, v) => { const s = subjectOf(c); return !!s && A.dist(o, s) <= v; },
    subjectIsEnemy: (A, o, c, v) => { const s = subjectOf(c); return !!s && (A.team(s) !== A.team(o)) === !!v; },
    subjectIsAlly: (A, o, c, v) => { const s = subjectOf(c); return !!s && s !== o && (A.team(s) === A.team(o)) === !!v; },
    heightAdvantage: (A, o, c, v) => { const s = subjectOf(c); return !!s && (A.height(o) > A.height(s)) === !!v; },
    abilityTag: (A, o, c, v) => !!c.ability && A.tags(c.ability).includes(v),
    abilityKind: (A, o, c, v) => !!c.ability && A.kind(c.ability) === v,
    abilityId: (A, o, c, v) => c.ability === v,
    distinctAbilitiesThisTurn: (A, o, c, v) => A.usedCount(o) >= v,
    unspentAPAtLeast: (A, o, c, v) => A.unspentAP(o) >= v,
    damageAtLeast: (A, o, c, v) => (c.damage || 0) >= v,
    isOwnTurn: (A, o, c, v) => A.isOwnTurn(o) === !!v,
    selfHasMoved: (A, o, c, v) => A.hasMoved(o) === !!v,
    isFlanking: (A, o, c, v) => { const s = subjectOf(c); return !!s && A.flanking(o, s) === !!v; },
    // N  (enemies within 1 hex)   or   { count: N, radius: R, who: 'enemy' | 'ally' }
    targetCountWithin: (A, o, c, v) => {
      const q = typeof v === 'object' ? v : { count: v };
      return A.unitsWithin(o, q.radius || 1, q.who === 'ally' ? 'ally' : 'enemy').length >= (q.count || 1);
    }
  };

  // Picks the destination hex for the teleport effect. G = { dist(a,b), free(x,y), all() -> [{x,y}] } supplied by the engine.
  //   towardTarget / adjacentTarget: free hex next to the anchor, nearest to the mover      (Charge, Blink Strike)
  //   behindTarget:                  free hex next to the anchor, farthest from the mover   (Shadowstep)
  //   awayFromTarget:                free hex within `hexes` of the mover, farthest from the anchor (Fade Step, Evade)
  function pickTeleportHex(mode, mover, anchor, hexes, G) {
    if (!anchor) return null;
    if ((mode === 'towardTarget' || mode === 'adjacentTarget') && G.dist(mover, anchor) === 1) return null;   // already adjacent
    const cand = G.all().filter(h => G.free(h.x, h.y));
    const reach = h => hexes === undefined || G.dist(h, mover) <= hexes;
    let list;
    if (mode === 'awayFromTarget') {
      const here = G.dist(mover, anchor);
      list = cand.filter(h => G.dist(h, mover) <= (hexes || 2) && G.dist(h, anchor) > here)
                 .sort((a, b) => G.dist(b, anchor) - G.dist(a, anchor) || G.dist(a, mover) - G.dist(b, mover));
    } else if (mode === 'behindTarget') {
      list = cand.filter(h => G.dist(h, anchor) === 1 && reach(h)).sort((a, b) => G.dist(b, mover) - G.dist(a, mover));
    } else {
      list = cand.filter(h => G.dist(h, anchor) === 1 && reach(h)).sort((a, b) => G.dist(a, mover) - G.dist(b, mover));
    }
    return list[0] || null;
  }

  function targetsOf(A, e, o, c) {
    switch (e.target || 'self') {
      case 'self': return [o];
      case 'attacker': return c.attacker ? [c.attacker] : [];
      case 'victim': return c.victim ? [c.victim] : [];
      case 'subject': return subjectOf(c) ? [subjectOf(c)] : [];
      case 'target': return c.target ? [c.target] : [];
      case 'alliesWithin': return A.unitsWithin(o, e.radius || 1, 'ally');
      case 'enemiesWithin': return A.unitsWithin(o, e.radius || 1, 'enemy');
      case 'allAllies': return A.unitsWithin(o, 99, 'ally');
      case 'allEnemies': return A.unitsWithin(o, 99, 'enemy');
      case 'pet': { const p = A.pet && A.pet(o); return p ? [p] : []; }                    // the owner's summon
      case 'nearestEnemy': { const f = A.unitsWithin(o, 99, 'enemy').sort((a, b) => A.dist(a, o) - A.dist(b, o))[0]; return f ? [f] : []; }
      case 'woundedAlly': { const f = A.unitsWithin(o, e.radius || 3, 'ally').filter(x => x.hp < x.max).sort((a, b) => (b.max - b.hp) - (a.max - a.hp))[0]; return f ? [f] : []; }
      default: A.warn('triggers: unknown target "' + e.target + '"'); return [];
    }
  }

  function amount(A, e, o, c) {
    let n = e.amount !== undefined ? e.amount : 0;
    if (e.scaleBy === 'unspentAP') n *= A.unspentAP(o);
    else if (e.scaleBy === 'overflow') n = (c.overflow || 0) * (e.mult !== undefined ? e.mult : 1);
    else if (e.scaleBy === 'damage') n = (c.damage || 0) * (e.mult !== undefined ? e.mult : 1);
    if (e.max !== undefined) n = Math.min(n, e.max);
    return Math.floor(n);
  }

  const EFFECTS = {
    damage: (A, e, o, c, ts) => { const n = amount(A, e, o, c); if (n > 0) ts.forEach(t => A.damage(o, t, n, { direct: !!e.direct, ignoreShield: !!e.ignoreShield })); },
    heal: (A, e, o, c, ts) => { const n = amount(A, e, o, c); if (n > 0) ts.forEach(t => A.heal(o, t, n)); },
    shield: (A, e, o, c, ts) => { const n = amount(A, e, o, c); if (n > 0) ts.forEach(t => A.shield(o, t, n)); },
    applyStatus: (A, e, o, c, ts) => ts.forEach(t => A.status(o, t, e.status, e.payload !== undefined ? e.payload : (e.turns || 1))),
    cleanse: (A, e, o, c, ts) => ts.forEach(t => A.cleanse(t, e.count || 1, e.statuses || null)),
    refundAP: (A, e, o, c) => { const n = amount(A, e, o, c); if (n > 0) A.refundAP(o, n); },
    gainCharge: (A, e, o, c, ts) => ts.forEach(t => A.gainCharge(t, e.amount || 1)),
    gainLedger: (A, e, o, c, ts) => ts.forEach(t => { t.ledger = Math.min(window.GAME_DATA.combatRules.ledger.max, (t.ledger || 0) + (e.amount || 0)); }),
    gainMana: (A, e, o, c, ts) => ts.forEach(t => A.gainMana(t, e.amount || 0)),
    reduceCooldown: (A, e, o, c, ts) => ts.forEach(t => A.reduceCooldown(t, e.ability || null, e.amount || 1)),
    modifyDamage: (A, e, o, c) => {
      if (c.damage === undefined) return;
      let d = c.damage;
      if (e.mult !== undefined) d = Math.round(d * e.mult);
      if (e.flat) d += e.flat;
      c.damage = Math.max(0, d);
    },
    stagger: (A, e, o, c, ts) => ts.forEach(t => A.stagger(t, e.amount || 20)),
    cancelCast: (A, e, o, c, ts) => ts.forEach(t => A.cancelCast(t)),
    push: (A, e, o, c, ts) => ts.forEach(t => A.forcedMove(t, e.from === 'attacker' ? c.attacker : e.from === 'subject' ? subjectOf(c) : e.from === 'aim' && A.aim && A.aim() ? A.aim() : o, e.hexes || 1, 'push', { src: o })),
    pull: (A, e, o, c, ts) => ts.forEach(t => { if (o) (o.pulled || (o.pulled = new Set())).add(t); /* Shadowknight: Soul Leech reads this */ A.forcedMove(t, e.from === 'attacker' ? c.attacker : e.from === 'subject' ? subjectOf(c) : e.from === 'aim' && A.aim && A.aim() ? A.aim() : o, e.hexes || 1, 'pull'); }),
    armInterrupt: (A, e, o) => A.arm(o, { on: e.on || 'onEnemyMoveNear', if: e.if || {}, effects: e.effects || [], expires: e.expires || 'ownTurnStart', label: e.label || 'armed' }),
    flankHexes: () => {},   // read by the flank rule; nothing to execute
    stripBuffs: (A, e, o, c, ts) => ts.forEach(t => A.stripBuffs(t, e.count || 1, e.statuses || null)),
    detonateDots: (A, e, o, c, ts) => ts.forEach(t => A.detonateDots(o, t, e.mult !== undefined ? e.mult : 1, e.statuses || null)),
    gainMeter: (A, e, o, c, ts) => { const n = amount(A, e, o, c); if (n) ts.forEach(t => A.gainMeter(t, n)); },
    // takes `amount` meter from the target and gives it to the owner (Chrono Siphon)
    stealMeter: (A, e, o, c, ts) => { const n = Math.abs(amount(A, e, o, c)); if (n) ts.forEach(t => { if (t !== o) { A.gainMeter(t, -n); A.gainMeter(o, n); } }); },
    teleport: (A, e, o, c, ts) => {
      const anchor = e.anchor === 'attacker' ? c.attacker : e.anchor === 'victim' ? c.victim : e.anchor === 'nearestEnemy' ? targetsOf(A, { target: 'nearestEnemy' }, o, c)[0] : (c.target || subjectOf(c));
      ts.forEach(t => A.teleport(t, e.mode || 'towardTarget', anchor, e.hexes));
    },
    // onLethalDamage only: the hit cannot take the owner below keepHp (default 1)
    preventDeath: (A, e, o, c) => { c.preventDeath = true; c.keepHp = e.keepHp !== undefined ? e.keepHp : 1; },
    summon: (A, e, o) => { for (let i = 0; i < (e.count || 1); i++) A.summon(o, e.unitId, { max: e.max }); }
  };

  function check(A, spec, owner, ctx) {
    const cond = spec.if || {};
    for (const k of Object.keys(cond)) {
      const fn = CONDITIONS[k];
      if (!fn) { A.warn('triggers: unknown condition "' + k + '"'); return false; }
      if (!fn(A, owner, ctx, cond[k])) return false;
    }
    return true;
  }

  function exec(A, e, owner, ctx) {
    const fn = EFFECTS[e.type];
    if (!fn) { A.warn('triggers: unknown effect "' + e.type + '"'); return; }
    const ts = targetsOf(A, e, owner, ctx).filter(t => A.alive(t));
    if (!ts.length && !['refundAP', 'modifyDamage', 'armInterrupt', 'flankHexes', 'preventDeath', 'summon'].includes(e.type)) return;
    fn(A, e, owner, ctx, ts);
  }

  // Runs every spec the owner has for this trigger. ctx is shared with effects (modifyDamage edits ctx.damage).
  function run(A, trigger, owner, ctx) {
    ctx = ctx || {};
    if (depth > 3) return ctx;            // guards against effect chains that re-trigger themselves
    depth++;
    try {
      for (const entry of A.specsFor(owner, trigger, ctx)) {
        const spec = entry.spec;
        if (!A.alive(owner) && trigger !== 'onAnyDeath' && trigger !== 'onKill') continue;
        if (!check(A, spec, owner, ctx)) continue;
        if (spec.limit && !A.limit(owner, entry.id, spec.limit)) continue;
        for (const e of spec.effects || []) exec(A, e, owner, ctx);
        if (entry.armed) A.disarm(owner, entry.armed);
      }
    } finally { depth--; }
    return ctx;
  }

  const normalize = entry => (entry && Array.isArray(entry.triggers)) ? entry.triggers : [];

  // Reports every word the data uses that the runner does not know. Returns an array of messages.
  function validate(GD) {
    const out = [], KW = (GD.combatRules && GD.combatRules.keywords) || {};
    const trig = new Set(Object.keys(KW.triggers || {})), tags = new Set(KW.tags || []);
    const statuses = (GD.combatRules && GD.combatRules.statuses) || {};
    const limits = new Set(Object.keys(KW.limits || { oncePerTurn: 1, oncePerBattle: 1 }));
    const checkSpec = (where, sp) => {
      if (!trig.has(sp.on)) out.push(where + ': unknown trigger "' + sp.on + '"');
      for (const k of Object.keys(sp.if || {})) if (!CONDITIONS[k]) out.push(where + ': unknown condition "' + k + '"');
      if (sp.limit && !limits.has(sp.limit)) out.push(where + ': unknown limit "' + sp.limit + '"');
      const walk = es => (es || []).forEach(e => {
        if (!EFFECTS[e.type]) out.push(where + ': unknown effect "' + e.type + '"');
        if (e.type === 'applyStatus' && !statuses[e.status]) out.push(where + ': unknown status "' + e.status + '"');
        if (['stripBuffs', 'detonateDots'].includes(e.type)) for (const s of e.statuses || []) if (!statuses[s]) out.push(where + ': unknown status "' + s + '"');
        if (e.type === 'summon' && !(GD.classes && GD.classes[e.unitId])) out.push(where + ': unknown summon unit "' + e.unitId + '"');
        if (e.type === 'teleport' && !['towardTarget', 'adjacentTarget', 'behindTarget', 'awayFromTarget'].includes(e.mode || 'towardTarget')) out.push(where + ': unknown teleport mode "' + e.mode + '"');
        if (e.type === 'armInterrupt') { if (e.on && !trig.has(e.on)) out.push(where + ': unknown trigger "' + e.on + '"'); walk(e.effects); }
      });
      walk(sp.effects);
    };
    for (const [grp, obj] of [['passive', GD.passives], ['gear', GD.gear], ['ability', GD.abilities]])
      for (const [id, x] of Object.entries(obj || {})) {
        normalize(x).forEach((sp, i) => checkSpec(grp + ' ' + id + '[' + i + ']', sp));
        if (grp === 'ability') {
          for (const t of x.tags || []) if (!tags.has(t)) out.push('ability ' + id + ': unknown tag "' + t + '"');
          for (const f of [x.fx, x.selfFx]) for (const k of Object.keys(f || {})) if (k !== 'shield' && !statuses[k]) out.push('ability ' + id + ': unknown status "' + k + '"');
        }
      }
    return out;
  }

  window.GAME_TRIGGERS = { run, check, exec, normalize, validate, pickTeleportHex, CONDITIONS, EFFECTS };
})();
