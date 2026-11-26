/* Loadout rules shared by the game (index.html) and the simulator (data/simEngine.js).
   Pure helpers: equipment access, a unit's derived stats (weapon, armor, resistance, spell/heal power, crit, mana),
   weapon-driven damage, mitigation, crit and mana costs. Numbers live in combatRules.loadout, gear.js, passives.js and classes.js.
   Load after combatRules, classes, abilities, passives, gear. */
(function () {
  const G = () => window.GAME_DATA;
  const LR = () => G().combatRules.loadout;
  const ELEMENTS = ['fire', 'frost', 'lightning', 'arcane', 'holy', 'nature', 'shadow', 'song', 'mind'];
  const L = {};

  // ---- ability classification ----
  L.typeLabel = A => !A ? '' : A.k === 'heal' ? 'Heal' : A.k === 'buff' ? 'Buff' : (A.tags || []).includes('spell') ? 'Spell' : 'Physical';
  L.isSpell = A => !!A && (A.tags || []).includes('spell');
  L.elementOf = A => (A && A.tags || []).find(t => ELEMENTS.includes(t)) || null;
  // Physical damage skills are built on the equipped weapon: damage = weapon strike x weaponMod + the skill's own p.
  L.weaponSkill = A => !!A && A.k === 'dmg' && !A.isAttack && !L.isSpell(A) && !(A.petStrike && !A.p);
  L.weaponMod = A => (A.wm !== undefined ? A.wm : ((LR().weaponModByCost || {})[A.c] !== undefined ? LR().weaponModByCost[A.c] : 1));

  // ---- weapons ----
  const WEAPON_DEFAULT_COST = () => LR().attackCost || 2;
  L.weaponOf = function (itemId) {
    const R = LR(), it = itemId && G().gear[itemId];
    if (it && it.weapon) return Object.assign({ id: itemId, name: it.name, item: it }, it.weapon);
    return null;
  };
  L.unarmed = () => Object.assign({ id: 'unarmed', family: 'fist', hands: 1 }, LR().unarmed);
  L.natural = () => Object.assign({ id: 'natural', family: 'natural', hands: 1 }, LR().natural);
  // The weapon's strike value on a 2-AP footing (a 1-AP dagger counts double), used by weapon skills.
  L.strike = w => w.p * (WEAPON_DEFAULT_COST() / (w.c || WEAPON_DEFAULT_COST()));
  // Every weapon gets a registered Attack ability (atk_<id>) so the whole targeting / cost / log machinery just works.
  L.attackId = w => 'atk_' + w.id;
  L.registerAttacks = function () {
    const D = G(), ab = D.abilities, list = [];
    for (const id of Object.keys(D.gear)) { const w = L.weaponOf(id); if (w) list.push(w); }
    list.push(L.unarmed(), L.natural());
    for (const w of list) {
      const tags = ['damage', w.spell ? 'ranged' : (w.ranged ? 'ranged' : 'melee'), w.spell ? 'spell' : 'physical'];
      if (w.element) tags.push(w.element);
      ab[L.attackId(w)] = { n: 'Attack (' + (w.name || 'Weapon') + ')', c: w.c || WEAPON_DEFAULT_COST(), r: w.r || 1, k: 'dmg', p: w.p, ct: 0, isAttack: 1, wid: w.id, tags,
        desc: (w.name || 'Weapon') + ' strike: ' + w.p + ' damage' + (w.r > 1 ? ', range ' + w.r : '') + (w.spell ? ' (' + (w.element || 'spell') + ', reduced by resistance)' : '') + '.' };
    }
  };

  // ---- equipment access ----
  L.unlocksOf = function (passiveIds) {
    const P = G().passives, o = { weapons: [], offhand: [], armor: [] };
    for (const id of passiveIds || []) { const u = P[id] && P[id].unlocks; if (u) for (const k in o) (u[k] || []).forEach(x => { if (!o[k].includes(x)) o[k].push(x); }); }
    return o;
  };
  L.innateOf = classId => (G().classes[classId] && G().classes[classId].innate) || [];
  L.canEquip = function (classId, itemId, passiveIds) {
    const D = G(), c = D.classes[classId], it = D.gear[itemId];
    if (!c || !it) return false;
    const eq = c.equip || {}, un = L.unlocksOf([...(passiveIds || []), ...L.innateOf(classId)]);
    if (it.slot === 'MainHand') return !!it.weapon && ((eq.weapons || []).includes(it.weapon.family) || un.weapons.includes(it.weapon.family));
    if (it.slot === 'OffHand') return (eq.offhand || []).includes(it.offType) || un.offhand.includes(it.offType);
    if (it.slot === 'Head' || it.slot === 'Body') return (eq.armor || []).includes(it.weight) || un.armor.includes(it.weight);
    return true;
  };
  // Items of one slot this class could equip (given its chosen passives), honouring a two-handed main hand.
  L.itemsFor = function (classId, slot, passiveIds, mainHandId) {
    const D = G(), out = [];
    if (slot === 'OffHand' && mainHandId && D.gear[mainHandId] && D.gear[mainHandId].weapon && D.gear[mainHandId].weapon.hands === 2) return out;
    for (const id of Object.keys(D.gear)) if (D.gear[id].slot === slot && L.canEquip(classId, id, passiveIds)) out.push(id);
    return out;
  };
  L.defaultGear = classId => Object.assign({}, (G().classes[classId] && G().classes[classId].gear) || {});
  // Drops anything this class cannot equip and clears the off hand behind a two-hander.
  L.cleanGear = function (classId, gear, passiveIds) {
    const D = G(), out = {};
    for (const sl of D.combatRules.build.equipmentSlots) {
      const id = gear && gear[sl];
      if (id && D.gear[id] && D.gear[id].slot === sl && L.canEquip(classId, id, passiveIds)) out[sl] = id;
    }
    const mh = out.MainHand && D.gear[out.MainHand].weapon;
    if (mh && mh.hands === 2) delete out.OffHand;
    return out;
  };

  // ---- a unit's derived loadout ----
  // Returns { wpn, attackId, armor, res, elemRes, spellPow, healPow, crit, guard, stat{hp,spd,mv,jump,castHaste}, cost{}, power{}, manaMax, manaRegen, sources[] }
  // `sources` are the passive/gear objects (for trigger normalisation by the caller).
  L.derive = function (classId, gear, passiveIds, raceId) {
    const D = G(), cls = D.classes[classId] || {}, gearIds = L.cleanGear(classId, gear || {}, passiveIds);
    const innate = L.innateOf(classId), pas = [...innate.filter(id => !(passiveIds || []).includes(id)), ...(passiveIds || [])];
    const sources = [], d = { stat: { hp: 0, spd: 0, mv: 0, jump: 0, castHaste: 0 }, cost: {}, power: {}, armor: 0, res: 0, bloodiedArmor: 0, bloodiedRes: 0, painPower: 0, elemRes: {}, spellPow: 0, healPow: 0, crit: 0, guard: false, gear: gearIds, passives: pas };
    let mana = 0, regen = 0;
    const take = (src, id, kind) => {
      if (!src) return;
      sources.push({ id: kind + id, src });
      for (const k in src.statMods || {}) { if (k === 'mana') mana += src.statMods[k]; else if (k === 'manaRegen') regen += src.statMods[k]; else d.stat[k] = (d.stat[k] || 0) + src.statMods[k]; }
      for (const k in src.costMods || {}) d.cost[k] = (d.cost[k] || 0) + src.costMods[k];
      for (const k in src.powerMods || {}) d.power[k] = (d.power[k] || 0) + src.powerMods[k];
      d.armor += src.armor || 0; d.res += src.res || 0; d.bloodiedArmor += src.bloodiedArmor || 0; d.bloodiedRes += src.bloodiedRes || 0; d.painPower += src.painPower || 0; d.spellPow += src.spellPow || 0; d.healPow += src.healPow || 0; d.crit += src.crit || 0;
      for (const k in src.elemRes || {}) d.elemRes[k] = (d.elemRes[k] || 0) + src.elemRes[k];
      if (src.guard) d.guard = true;
    };
    for (const id of pas) take(D.passives[id], id, 'p:');
    for (const sl of D.combatRules.build.equipmentSlots) if (gearIds[sl]) take(D.gear[gearIds[sl]], gearIds[sl], 'g:');
    const rc = raceId && D.races && D.races[raceId]; // race traits (data/races.js): flat stat mods, armor, ranged damage reduction, push immunity
    d.rangedReduce = 0; d.pushImmune = false;
    const ct = cls.traits; // creature traits (monsters): flat armor/res, elemental weaknesses (negative elemRes), ranged reduction, push immunity
    if (ct) { d.armor += ct.armor || 0; d.res += ct.res || 0; for (const k in ct.elemRes || {}) d.elemRes[k] = (d.elemRes[k] || 0) + ct.elemRes[k]; for (const k in ct.statMods || {}) d.stat[k] = (d.stat[k] || 0) + ct.statMods[k]; d.rangedReduce = ct.rangedReduce || 0; d.pushImmune = !!ct.pushImmune; d.apBonus = ct.ap || 0; for (const k in ct.powerMods || {}) d.power[k] = (d.power[k] || 0) + ct.powerMods[k]; }
    if (rc) { for (const k in rc.statMods || {}) d.stat[k] = (d.stat[k] || 0) + rc.statMods[k]; d.armor += rc.armor || 0; d.rangedReduce = rc.rangedReduce || 0; d.pushImmune = !!rc.pushImmune; }
    const w = gearIds.MainHand ? L.weaponOf(gearIds.MainHand) : (cls.selectable === false ? L.natural() : L.unarmed());
    d.wpn = w; d.attackId = L.attackId(w);
    const cap = LR().mitigationCap;
    d.armor = Math.min(cap, d.armor); d.res = Math.min(cap, d.res);
    const pool = (LR().mana.pools[cls.arch] || LR().mana.pools.martial);
    d.manaMax = Math.max(0, pool.max + mana); d.manaRegen = Math.max(0, pool.regen + regen);
    d.sources = sources;
    return d;
  };

  // ---- damage ----
  // Flat power a unit adds to this ability (passives and gear powerMods; 'unarmed' applies to fist attacks).
  L.powerBonus = function (u, A, aid) {
    let b = 0; const meleeR = G().combatRules.targeting.meleeRange, pm = u.mods ? u.mods.power : u.powerMods || {};
    for (const k in pm) {
      if (k === aid || k === '*' || (k === 'melee' && A.r <= meleeR) || (k === 'ranged' && A.r > meleeR)) b += pm[k];
      else if (k === 'unarmed' && u.wpn && u.wpn.family === 'fist' && (A.isAttack || L.weaponSkill(A))) b += pm[k];
    }
    return b;
  };
  // The weapon's contribution to a physical skill (not to the Attack itself, whose p is already the weapon).
  L.weaponPart = (u, A) => (L.weaponSkill(A) && u.wpn) ? L.strike(u.wpn) * L.weaponMod(A) : 0;
  // Spells, heals and wards also build on the equipped weapon: a share of its strike (combatRules.loadout.spellWeaponShare, default 30%),
  // scaled by the skill's cost like a weapon skill. Wards are any buff that grants a shield, spell or physical.
  L.castPart = function (u, A) {
    if (!A || !u || !u.wpn) return 0;
    const spellDmg = A.k === 'dmg' && !A.isAttack && L.isSpell(A), heal = A.k === 'heal', ward = (A.k === 'buff' || A.k === 'self') && !!(A.fx && A.fx.shield);
    if (!(spellDmg || heal || ward)) return 0;
    const share = LR().spellWeaponShare !== undefined ? LR().spellWeaponShare : 0.3;
    return share * L.strike(u.wpn) * L.weaponMod(A);
  };
  // The shield an ability grants once the weapon share is added (wards only).
  // Shields (buff or self skills): base + weapon share (+ armor for physical shields), then x spell power for spell wards.
  L.wardParts = (u, A) => {
    if (!A || !(A.k === 'buff' || A.k === 'self') || !A.fx || !A.fx.shield || !u) return null;
    const base = A.fx.shield, wp = L.castPart(u, A), spell = L.isSpell(A), sc = LR().wardArmorScale !== undefined ? LR().wardArmorScale : 0.2;
    const ar = spell ? 0 : (u.armor || 0) * sc, pot = spell ? 1 + (u.spellPow || 0) / 100 : 1, total = Math.round((base + wp + ar) * pot);
    return { base, weapon: wp, armor: ar, pot, total };
  };
  L.wardBonus = (u, A) => { const w = L.wardParts(u, A); return w ? w.total - w.base : 0; };
  L.wardFx = (u, A) => { const w = L.wardParts(u, A); return w && w.total !== w.base ? Object.assign({}, A.fx, { shield: w.total }) : (A && A.fx); };

  // ---- skill card numbers ----
  // Calculated output of a skill for a unit (armor and resistance of the target are not known, so they are left out).
  // u = anything with { wpn, spellPow, healPow, mods:{power} | powerMods, lvPow }. Returns { kind, total, parts:[[label,n]], mults:[[label,x]], notes:[...], dots:[...] } or null for skills with no number.
  L.skillCalc = function (u, A, id) {
    if (!A || !u) return null;
    const lv = u.lvPow && u.lvPow > 1 ? u.lvPow : 1, out = { kind: null, total: 0, parts: [], mults: [], notes: [], dots: [] };
    const R = G().combatRules, rnd = x => Math.round(x * 10) / 10;
    const dotOf = fx => { for (const k of ['poison', 'bleed', 'burn']) { const v = fx && fx[k]; if (Array.isArray(v)) out.dots.push({ status: k, per: v[1], turns: v[0], total: v[0] * v[1] }); } };
    if (A.k === 'dmg' && (A.p || L.weaponSkill(A) || A.isAttack)) {
      out.kind = 'dmg';
      const wp = L.weaponPart(u, A), cp = (A.p > 0) ? L.castPart(u, A) : 0, pb = L.powerBonus(u, A, id), pot = L.potency(u, A);
      if (A.isAttack) out.parts.push(['Weapon', A.p]); else { if (A.p) out.parts.push(['Skill', A.p]); if (wp) out.parts.push(['Weapon', rnd(wp)]); if (cp) out.parts.push(['Spell share of weapon', rnd(cp)]); }
      if (pb) out.parts.push(['Gear and passives', pb]);
      const raw = (A.p || 0) + wp + cp, p0 = Math.max(1, Math.round((raw + pb) * pot));
      if (pot !== 1) out.mults.push([L.isSpell(A) ? 'spell power' : 'power', pot]);
      if (lv !== 1) out.mults.push(['level', lv]);
      out.total = Math.round(p0 * lv);
      if (A.flank) out.notes.push('Flanking x' + R.damage.flankMultiplier + ', from stealth x' + R.damage.ambushMultiplier);
      if (A.echo && A.echo.p) out.notes.push('+' + A.echo.p + ' if you used another skill this turn');
      if (A.bloodied && A.bloodied.p) out.notes.push('+' + A.bloodied.p + ' while Bloodied');
      for (const k in A.bonusVsStatus || {}) out.notes.push('+' + A.bonusVsStatus[k] + ' against ' + ((R.statuses[k] || {}).label || k));
      if (A.bonusPerNegative) out.notes.push('+' + A.bonusPerNegative + ' per negative status on the target');
      if (A.heightBonus) out.notes.push('+' + A.heightBonus + ' per level of height advantage');
      if (A.highGroundBonus) out.notes.push('+' + A.highGroundBonus + ' from high ground');
      if (A.rootedAim) out.notes.push('+' + A.rootedAim + ' if you have not moved');
      if (A.bonusIfMoved) out.notes.push('+' + A.bonusIfMoved + ' if you moved this turn');
      if (A.bonusIfVanished) out.notes.push('+' + A.bonusIfVanished + ' from stealth');
      if (A.bonusIfPetAdjacent) out.notes.push('+' + A.bonusIfPetAdjacent + ' if your summon is adjacent');
      if (A.spendCharge && A.spendCharge.dmgPer) out.notes.push('+' + A.spendCharge.dmgPer + ' per banked Charge (spends it)');
      if (A.spendVerse) out.notes.push('+' + A.spendVerse.per + ' per banked verse (spends them)');
      if (A.perDistinct) out.notes.push('+' + A.perDistinct.per + ' per other skill used this turn');
      if (A.bonusFromOwnShield) out.notes.push('+1 per ' + A.bonusFromOwnShield + ' of your shield');
      if (A.area === 'chain') { const C = R.areaShapes && R.areaShapes.chain; if (C) out.notes.push('Chains to ' + C.extraTargets + ' more for ' + C.extraPower + ' power each'); }
      else if (A.area) out.notes.push('Each target in the area takes this');
      if (A.ignore) out.notes.push('Ignores shield and Guard');
      dotOf(A.fx);
    } else if (A.k === 'heal' && (A.p || L.castPart(u, A))) {
      out.kind = 'heal';
      const cp = L.castPart(u, A), pot = L.potency(u, A);
      if (A.p) out.parts.push(['Skill', A.p]); if (cp) out.parts.push(['Spell share of weapon', rnd(cp)]);
      if (pot !== 1) out.mults.push(['heal power', pot]);
      if (lv !== 1) out.mults.push(['level', lv]);
      out.total = Math.round(Math.round(((A.p || 0) + cp) * pot) * lv);
      if (A.lowHpBonus) out.notes.push('+' + A.lowHpBonus.p + ' on a target below ' + Math.round(A.lowHpBonus.pct * 100) + '% HP');
      if (A.consumeShield) out.notes.push('Spends up to ' + A.consumeShield + ' of your shield to heal that much more');
      if (A.area) out.notes.push('Each ally in the area is healed');
      if (A.fx && Array.isArray(A.fx.regen)) out.dots.push({ status: 'regen', per: A.fx.regen[1], turns: A.fx.regen[0], total: A.fx.regen[0] * A.fx.regen[1] });
    } else if ((A.k === 'buff' || A.k === 'self') && A.fx && A.fx.shield) {
      out.kind = 'shield';
      const w = L.wardParts(u, A) || { base: A.fx.shield, weapon: 0, armor: 0, pot: 1, total: A.fx.shield };
      out.parts.push(['Skill', w.base]); if (Math.round(w.weapon)) out.parts.push(['Weapon share', Math.round(w.weapon)]); if (Math.round(w.armor)) out.parts.push(['Armor', Math.round(w.armor)]);
      if (w.pot !== 1) out.mults.push(['spell power', w.pot]);
      out.total = w.total;
      if (A.shieldCap) out.notes.push('Tops your shield up to at most ' + (A.shieldCap + L.wardBonus(u, A)));
      if (A.area) out.notes.push('Each ally in the area gains it');
      if (A.fx && Array.isArray(A.fx.regen)) out.dots.push({ status: 'regen', per: A.fx.regen[1], turns: A.fx.regen[0], total: A.fx.regen[0] * A.fx.regen[1] });
    } else if ((A.k === 'buff' || A.k === 'self') && A.fx && Array.isArray(A.fx.regen)) {
      out.kind = 'regen'; out.dots.push({ status: 'regen', per: A.fx.regen[1], turns: A.fx.regen[0], total: A.fx.regen[0] * A.fx.regen[1] });
    } else if (A.k === 'trap' && (A.p || A.fx)) {
      out.kind = 'dmg'; out.total = A.p || 0; out.parts.push(['Trap', A.p || 0]); dotOf(A.fx);
      if (!A.p) return out.dots.length ? out : null;
    } else if (A.fx) { dotOf(A.fx); if (out.dots.length) out.kind = 'dot'; else return null; }
    else return null;
    return out;
  };
  // Plain-text version for tooltips and cards: { head, detail, extra }.
  L.skillCalcText = function (u, A, id) {
    const c = L.skillCalc(u, A, id); if (!c) return null;
    const word = { dmg: 'damage', heal: 'healing', shield: 'shield', regen: 'regeneration', dot: 'over time' }[c.kind];
    let head = c.kind === 'regen' || c.kind === 'dot' ? '' : c.total + ' ' + word;
    const dots = c.dots.map(d => (d.status === 'regen' ? d.per + ' HP/turn for ' : d.per + ' ' + d.status + '/turn for ') + d.turns + (d.turns === 1 ? ' turn' : ' turns') + ' (' + d.total + ' total)');
    if (dots.length) head += (head ? ', plus ' : '') + dots.join(', ');
    const bits = c.parts.map(p => p[0].toLowerCase() + ' ' + p[1]);
    const detail = c.parts.length > 1 || c.mults.length ? bits.join(' + ') + c.mults.map(m => ', x' + (Math.round(m[1] * 100) / 100) + ' ' + m[0]).join('') : '';
    return { head: head, detail: detail, extra: c.notes };
  };

  // Spell damage and heal scaling (percent).
  L.potency = (u, A) => A.k === 'heal' ? 1 + (u.healPow || 0) / 100 : (L.isSpell(A) && A.k === 'dmg') ? 1 + (u.spellPow || 0) / 100 : 1;
  // Percentage armor (physical) or resistance (spells); blunt weapons shave armor first. Pierce skills skip it.
  L.mitigationPct = function (att, tgt, A) {
    if (!A || A.ignore) return 0;
    const rr = (tgt.rangedReduce && (A.tags || []).includes('ranged')) ? tgt.rangedReduce : 0; // Wood Elf: less damage from ranged attacks
    const base = L.mitigationBase(att, tgt, A);
    return rr ? 100 - (100 - base) * (1 - rr / 100) : base;
  };
  // Blood Knight: extra armor / resistance (percent points) while at or below the bloodied HP threshold (passive fields bloodiedArmor, bloodiedRes).
  L.bloodiedDef = function (tgt, kind) {
    const v = kind === 'res' ? tgt.bldRes : tgt.bldArmor;
    return (v && tgt.hp <= tgt.max * G().combatRules.resourceCosts.bloodiedThreshold) ? v : 0;
  };
  L.mitigationBase = function (att, tgt, A) {
    if (L.isSpell(A)) { let rb = 0; const S2 = G().combatRules.statuses || {}; if (tgt.st) for (const k in S2) if (S2[k].resBonus && tgt.st[k] > 0) rb += S2[k].resBonus; return Math.max(-50, Math.min(LR().mitigationCap, (tgt.res || 0) + L.bloodiedDef(tgt, 'res') + rb + ((tgt.elemRes || {})[L.elementOf(A)] || 0))); }   // Warded
    const ig = (att && att.wpn && (A.isAttack || L.weaponSkill(A))) ? (att.wpn.ignoreArmor || 0) : 0;
    let ar = (tgt.armor || 0) + L.bloodiedDef(tgt, 'armor'); const SS = G().combatRules.statuses || {}; if (tgt.st) for (const k in SS) if (SS[k].armorBonus && tgt.st[k] > 0) ar += SS[k].armorBonus * L.stacks(tgt, k);   // Stand Fast, Exposed (negative, per stack) and the like
    ar = Math.max(0, ar);
    return Math.min(LR().mitigationCap, ar * (1 - ig / 100));
  };
  L.mitigate = function (dmg, att, tgt, A) {
    if (dmg <= 0) return dmg;
    const pct = L.mitigationPct(att, tgt, A);
    return pct > 0 ? Math.max(LR().minHit, Math.round(dmg * (1 - pct / 100))) : pct < 0 ? Math.round(dmg * (1 - pct / 100)) : dmg;
  };
  // Crit chance in percent for this hit (0 for non-damage). `flanked` = flank or ambush.
  L.critChance = function (att, A, flanked) {
    if (!att || !A || A.k !== 'dmg') return 0;
    const R = LR(); let c = att.crit || 0;
    if (A.isAttack || L.weaponSkill(A)) { c += (att.wpn.crit || 0) + (flanked ? (att.wpn.critFlank || 0) : 0); }
    else c += R.baseSpellCrit;
    return Math.max(0, Math.min(R.critCap, c));
  };
  L.critMult = () => LR().critMultiplier;

  // ---- mana ----
  L.manaCost = A => (!A || A.isAttack) ? 0 : (A.m !== undefined ? A.m : (A.c || 0) * LR().mana.costPerAP);
  // A weapon skill that needs a ranged weapon the unit does not hold (obvious cases only).
  L.weaponBlocked = (u, A) => !!(L.weaponSkill(A) && (A.tags || []).includes('ranged') && !A.wn && u.wpn && !u.wpn.ranged);

  // ---- levels ----
  const sumRates = (segs, lv) => { let prev = 1, add = 0; for (const [end, rate] of segs) { const top = Math.min(lv, end); if (top > prev) add += rate * (top - prev); prev = end; } return add; };
  L.levelMods = level => { const R = G().combatRules.level, lv = Math.max(1, Math.min(R.cap, Math.floor(+level || 1))); return { level: lv, hp: 1 + sumRates(R.hp, lv), power: 1 + sumRates(R.power, lv) }; };
  L.xpToNext = lv => { const R = G().combatRules.level; return R.xp.base + R.xp.step * (lv - 1); };
  L.xpForLevel = lv => { let t = 0; for (let i = 1; i < lv; i++) t += L.xpToNext(i); return t; };
  L.levelForXp = xp => { const cap = G().combatRules.level.cap; let lv = 1, need = L.xpToNext(1); xp = Math.max(0, +xp || 0); while (lv < cap && xp >= need) { xp -= need; lv++; need = L.xpToNext(lv); } return lv; };

  // ---- stacking statuses, damage-over-time instances, and the small status modifiers (shared by the game and the simulator) ----
  const SSR = () => G().combatRules.statuses || {};
  // Stacks of a stackable status on a unit (0 when inactive; 1 for an ordinary status).
  L.stacks = (t, k) => (t && t.st && t.st[k] > 0) ? ((t.stk && t.stk[k]) || 1) : 0;
  // Sum of speedDelta over active statuses (per stack): Haste, Slow, Chill.
  L.speedMod = u => { let d = 0; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].speedDelta && u.st[k] > 0) d += S[k].speedDelta * L.stacks(u, k); return d; };
  L.moveMod = u => { let d = 0; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].moveDelta && u.st[k] > 0) d += S[k].moveDelta; return d; };
  L.apMod = u => { let d = 0; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].apDelta && u.st[k] > 0) d += S[k].apDelta; return d; };
  L.healMult = t => { let m = 1; const S = SSR(); if (t && t.st) for (const k in S) if (S[k].healMultiplier && t.st[k] > 0) m *= S[k].healMultiplier; return m; };
  L.dealtMult = u => { let m = 1; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].damageDealtMultiplier && !S[k].consumedOnAttack && u.st[k] > 0) m *= S[k].damageDealtMultiplier; return m; };
  L.manaRegenBonus = u => { let d = 0; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].manaRegen && u.st[k] > 0) d += S[k].manaRegen; return d; };
  L.flatTaken = t => { let d = 0; const S = SSR(); if (t && t.st) for (const k in S) if (S[k].flatDamageTaken && t.st[k] > 0) d += S[k].flatDamageTaken; return d; };   // Judged
  L.lifesteal = u => { let d = 0; const S = SSR(); if (u && u.st) for (const k in S) if (S[k].lifesteal && u.st[k] > 0) d += S[k].lifesteal; return d; };
  // Negative statuses on the unit itself, for Pain Is Power (Reckless counts although it is a buff).
  L.selfDebuffs = u => { let n = 0; const S = SSR(); if (u && u.st) for (const k in S) if ((S[k].negative || S[k].selfDebuff) && (S[k].tick ? u.st[k] : u.st[k] > 0)) n++; return n; };
  // Stackable status (Exposed, Chill): +1 stack up to the cap, timer refreshed, extra statuses at stack thresholds. Returns false for ordinary statuses.
  L.stackApply = (t, k, v) => {
    const D = SSR()[k]; if (!D || !D.stackable || Array.isArray(v)) return false;
    t.stk = t.stk || {}; const cur = t.st[k] > 0 ? (t.stk[k] || 1) : 0, n = Math.min(D.stackable, cur + 1); t.stk[k] = n; t.st[k] = Math.max(t.st[k] || 0, v);
    if (D.atStacks) for (const s in D.atStacks) if (n >= +s) for (const fk in D.atStacks[s]) t.st[fk] = Math.max(t.st[fk] || 0, D.atStacks[s][fk]);
    return true;
  };
  // Poison, bleed, burn and regen stack: every application is its own instance with its own timer. The unit keeps the merged view {n, d} for old readers.
  L.dotSum = e => { e.n = 0; e.d = 0; for (const i of e.inst) { e.d += i.d; if (i.n > e.n) e.n = i.n; } const last = e.inst[e.inst.length - 1]; if (last) { e.sc = last.sc; e.ab = last.ab; } return e; };
  L.addDot = (t, k, v, src, ab) => {
    let e = t.st[k]; if (!e || typeof e !== 'object') e = t.st[k] = { n: 0, d: 0, inst: [] };
    if (!e.inst) e.inst = [{ n: e.n, d: e.d, sc: e.sc, ab: e.ab }];
    e.inst.push({ n: v[0], d: v[1], sc: src || null, ab: ab || null }); return L.dotSum(e);
  };
  L.dotInsts = e => e.inst || [e];
  L.dotTotal = e => L.dotInsts(e).reduce((s, i) => s + i.n * i.d, 0);   // damage or healing still to come
  L.dotAdvance = e => { if (!e.inst) return --e.n <= 0; e.inst = e.inst.filter(i => --i.n > 0); if (!e.inst.length) return true; L.dotSum(e); return false; };   // true when the last instance ran out
  L.dotPopNewest = e => { if (e.inst && e.inst.length > 1) { e.inst.pop(); L.dotSum(e); return false; } return true; };   // true when nothing is left to keep

  window.GAME_LOADOUT = L;
  if (window.GAME_DATA && window.GAME_DATA.gear && window.GAME_DATA.abilities) L.registerAttacks();
})();
