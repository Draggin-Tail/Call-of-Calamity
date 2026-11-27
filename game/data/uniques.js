/* Uniques (design/gear_tiers.md). About 30 hand-written (40 now: 4d added five capital pieces and four plotter leaders' pieces) items on top of the seven material tiers. Never sold, never random.
   Each unique:
   - starts from a tier item (about one tier above the band where it is found, so never ahead of the best shop gear) and adds a `triggers` entry
     (same vocabulary as passives: combatRules.keywords) or hand-set stats for accessories;
   - has no `tier` or `base`, so the tier helpers leave it alone (GAME_DATA.gearTiers.tierItem returns it unchanged);
   - is hidden from the skirmish lists, and carries `unique: 1`, `equiv` (the tier its numbers match), `lore` (one line) and `effect` (the rule in words).
   Where each is found: GAME_CAMPAIGN.UNIQUE_AWARDS. A unique is given once per save, from the first time its condition is true (a dungeon cleared for the
   first time, a faction rank, a job done, a place reached). It is checked when a battle result is applied, on arrival at a place, and on a promotion.
   Load after gear_tiers.js. */
(function () {
  const D = window.GAME_DATA, G = D && D.gear; if (!G || !D.gearTiers || D.uniques) return;
  const clone = o => JSON.parse(JSON.stringify(o));
  const U = D.uniques = {};

  const bonus = it => {
    const p = [], s = it.statMods || {};
    if (it.armor) p.push('+' + it.armor + '% armor'); if (it.res) p.push('+' + it.res + '% resistance');
    for (const e in it.elemRes || {}) p.push('+' + it.elemRes[e] + '% resistance to ' + e);
    if (it.spellPow) p.push('+' + it.spellPow + '% spell power'); if (it.healPow) p.push('+' + it.healPow + '% heal power'); if (it.crit) p.push('+' + it.crit + '% crit chance');
    if (s.hp) p.push((s.hp > 0 ? '+' : '') + s.hp + ' HP'); if (s.mana) p.push('+' + s.mana + ' mana'); if (s.manaRegen) p.push('+' + s.manaRegen + ' mana regeneration');
    if (s.spd) p.push((s.spd > 0 ? '+' : '') + s.spd + ' Speed'); if (s.mv) p.push('+' + s.mv + ' move'); if (s.jump) p.push('+' + s.jump + ' jump');
    return p.join(', ');
  };
  const stats = it => {
    if (it.weapon) {
      const w = it.weapon, p = ['Attack: ' + w.p + ' damage'];
      if (w.r > 1) p.push('range ' + w.r); if (w.ignoreArmor) p.push('ignores ' + w.ignoreArmor + '% of armor'); if (w.c === 1) p.push('1 AP');
      const b = bonus(it);
      return (w.hands === 2 ? 'Two-handed. ' : '') + p.join(', ') + '.' + (b ? ' ' + b + '.' : '');
    }
    const w = it.weight ? { heavy: 'Heavy. ', medium: 'Medium. ', light: 'Light. ' }[it.weight] : (it.guard ? 'Lets you Guard. ' : '');
    const b = bonus(it); return w + (b ? b + '.' : '');
  };

  // spec: { base, tier, name, lore, effect, add?: {armor,res,spellPow,healPow,crit,statMods,elemRes}, triggers? } or, for accessories, { acc: {slot data}, ... }
  function make(id, s) {
    let it;
    if (s.acc) it = Object.assign({ slot: 'Accessory' }, clone(s.acc));
    else {
      const src = s.tier === 1 ? G[s.base] : G['t' + s.tier + '_' + s.base];
      if (!src) throw new Error('uniques: no source item for ' + id + ' (' + s.base + ' tier ' + s.tier + ')');
      it = clone(src); delete it.base; delete it.tier; delete it.price;
      for (const k of ['armor', 'res', 'spellPow', 'healPow', 'crit']) if (s.add && s.add[k]) it[k] = (it[k] || 0) + s.add[k];
      if (s.add && s.add.statMods) { it.statMods = Object.assign({}, it.statMods); for (const k in s.add.statMods) it.statMods[k] = (it.statMods[k] || 0) + s.add.statMods[k]; }
      if (s.add && s.add.elemRes) { it.elemRes = Object.assign({}, it.elemRes); for (const k in s.add.elemRes) it.elemRes[k] = (it.elemRes[k] || 0) + s.add.elemRes[k]; }
    }
    it.name = s.name; it.unique = 1; it.equiv = s.equiv || s.tier; it.lore = s.lore; it.effect = s.effect; if (s.triggers) it.triggers = s.triggers;
    it.desc = s.lore + ' ' + s.effect + ' ' + stats(it);
    G[id] = it; U[id] = it; return it;
  }

  const T = (on, ifc, limit, effects) => { const o = { on, effects }; if (ifc) o.if = ifc; if (limit) o.limit = limit; return o; };
  const ALL = 'allAllies';

  // ------------------------------------------------------------------ dungeon bosses (first clear)
  make('rat_kings_tooth', { base: 'steel_dagger', tier: 2, name: "Rat King's Tooth",
    lore: "Pulled from the Warren boss's grin. Runners call it lucky and keep their distance.",
    effect: 'A kill gives back 1 AP, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'refundAP', amount: 1 }])] });
  make('tollkeepers_cudgel', { base: 'iron_mace', tier: 2, name: "Tollkeeper's Cudgel",
    lore: "The last keeper's club, worn smooth by a great many unpaid tolls.",
    effect: 'A hit of 8 or more staggers the target (pushes it back in the turn order), once a turn.',
    triggers: [T('onHit', { damageAtLeast: 8 }, 'oncePerTurn', [{ type: 'stagger', target: 'victim', amount: 15 }])] });
  make('wellwater_charm', { equiv: 2, name: 'Wellwater Charm',
    lore: 'A pebble from the bottom of the well. It is damp, however long it sits in a pocket.',
    effect: 'You begin each battle with Regen: 2 HP at the start of your first 3 turns.',
    acc: { statMods: { hp: 4 }, triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'regen', payload: [3, 2] }])] } });
  make('rimeheart', { base: 'staff_cold', tier: 3, name: 'Rimeheart',
    lore: 'The ice at its core has never melted, not even beside a forge.',
    effect: 'A frost hit slows the target for a turn, once a turn.',
    triggers: [T('onHit', { abilityTag: 'frost' }, 'oncePerTurn', [{ type: 'applyStatus', target: 'victim', status: 'slow', turns: 1 }])] });
  make('bog_priests_censer', { base: 'holy_relic', tier: 3, name: "Bog-Priest's Censer",
    lore: 'The idol\'s priests burned something sweet in it. It still smells of reeds.',
    effect: 'A heal also clears one bad status from the target, once a turn.',
    triggers: [T('onHeal', null, 'oncePerTurn', [{ type: 'cleanse', target: 'target', count: 1 }])] });
  make('cantors_lute', { base: 'lute', tier: 3, name: "Cantor's Lute",
    lore: 'Kept in tune by a hymn nobody finished.',
    effect: 'The first song each battle costs 2 less AP.',
    triggers: [T('onAbilityUsed', { abilityTag: 'song' }, 'oncePerBattle', [{ type: 'refundAP', amount: 2 }])] });
  make('dockside_arbalest', { base: 'crossbow', tier: 3, name: 'Dockside Arbalest',
    lore: 'Taken from a Syndicate ledger that does not list it.',
    effect: 'You begin each battle with Empowered: your first damaging skill deals 30% more.',
    triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'empowered', turns: 1 }])] });
  make('cerecloth_of_applecourt', { base: 'chain_hauberk', tier: 3, name: 'Cerecloth of Applecourt',
    lore: "Cut from the lord's own shroud. It would not let him go, and now it will not let you.",
    effect: 'Once a battle, a blow that would kill you leaves you on 1 HP instead.',
    triggers: [T('onLethalDamage', null, 'oncePerBattle', [{ type: 'preventDeath', keepHp: 1 }])] });
  make('bone_splitter', { base: 'maul', tier: 4, name: 'Bone Splitter',
    lore: "The Quarry King's maul. Every grip-wrap is a rib.",
    effect: 'A kill leaves you Empowered: your next damaging skill deals 30% more, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'applyStatus', target: 'self', status: 'empowered', turns: 1 }])] });
  make('oathbreaker', { base: 'iron_sword', tier: 4, name: 'Oathbreaker',
    lore: 'It was cut from the Oathstone before the names were. It has no scruples about the wounded.',
    effect: 'A hit on a target below 40% health deals 4 more, ignoring armor, once a turn.',
    triggers: [T('onHit', { subjectHpBelowPct: 40 }, 'oncePerTurn', [{ type: 'damage', target: 'victim', amount: 4, direct: true }])] });
  make('crown_of_the_old_king', { base: 'plate_helm', tier: 4, name: 'Crown of the Old King',
    lore: 'The dead lord wore it with his bones. It asks for quiet, and gets it.',
    effect: 'When you Guard, every enemy next to you is staggered.',
    triggers: [T('onGuard', null, null, [{ type: 'stagger', target: 'enemiesWithin', radius: 1, amount: 20 }])] });
  make('the_master_batch', { base: 'staff_storm', tier: 4, name: 'The Master Batch',
    lore: 'Made from the vat that went wrong, and still going.',
    effect: 'When you kill, every enemy within 2 hexes takes 4, ignoring armor, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'damage', target: 'enemiesWithin', radius: 2, amount: 4, direct: true }])] });
  make('right_of_the_pit', { base: 'greatsword', tier: 5, name: 'Right of the Pit',
    lore: 'Champions earned it by standing. It goes to whoever is left.',
    effect: 'Your first hit each turn knocks the target back a hex.',
    triggers: [T('onHit', null, 'oncePerTurn', [{ type: 'push', target: 'victim', hexes: 1 }])] });
  make('hushbell', { equiv: 5, name: 'Hushbell',
    lore: 'The bell that hung in the undercity, hung so that it could never be rung.',
    effect: 'At the start of battle, every enemy is Silenced for a turn.',
    acc: { res: 5, triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'allEnemies', status: 'silence', turns: 1 }])] } });
  make('the_first_ward', { base: 'spellbook', tier: 5, name: 'The First Ward',
    lore: 'Written by the first ward-keeper. Its first page is a refusal.',
    effect: 'Once a battle, the first hit of 10 or more you take is halved.',
    triggers: [T('onDamaged', { damageAtLeast: 10 }, 'oncePerBattle', [{ type: 'modifyDamage', mult: 0.5 }])] });

  // ------------------------------------------------------------------ faction ranks and a job
  make('bannerets_rampart', { base: 'tower_shield', tier: 4, name: "Banneret's Rampart",
    lore: 'Voss handed it over in the yard without a speech. The strap is old and the paint is new.',
    effect: 'When you Guard, you also take half the damage dealt to the allies next to you.',
    triggers: [T('onGuard', null, null, [{ type: 'applyStatus', target: 'self', status: 'intercept', turns: 1 }])] });
  make('stewards_seal', { equiv: 5, name: "Steward's Seal",
    lore: 'The Steward\'s order, in brass: stand where you are told, and go when it is said.',
    effect: 'At the start of battle, you and your allies gain Haste for a turn.',
    acc: { armor: 4, res: 4, triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'haste', turns: 1 }, { type: 'applyStatus', target: ALL, status: 'haste', turns: 1 }])] } });
  make('widows_needle', { base: 'steel_dagger', tier: 4, name: "Widow's Needle",
    lore: 'Syndicate steel that never took a name, only a debt.',
    effect: 'A hit from a flank makes the target bleed (3 a turn for 2 turns), once a turn.',
    triggers: [T('onHit', { isFlanking: true }, 'oncePerTurn', [{ type: 'applyStatus', target: 'victim', status: 'bleed', payload: [2, 3] }])] });
  make('ledger_hood', { base: 'silk_hood', tier: 5, name: 'Ledger-Hood',
    lore: 'A counting-house hood with lenses sewn in. It never lets a number go.',
    effect: 'The first target you hit each turn is Marked and takes 25% more damage for a turn.',
    triggers: [T('onHit', null, 'oncePerTurn', [{ type: 'applyStatus', target: 'victim', status: 'marked', turns: 1 }])] });
  make('inquisitors_rod', { base: 'staff_holy', tier: 4, name: "Inquisitor's Rod",
    lore: 'Chalk on one end and a bell on the other. The bell is for what is not on the list.',
    effect: 'Your first hit each turn strips one blessing or ward from the target.',
    triggers: [T('onHit', null, 'oncePerTurn', [{ type: 'stripBuffs', target: 'victim', count: 1 }])] });
  make('robe_of_the_quiet_hour', { base: 'mystic_robe', tier: 5, name: 'Robe of the Quiet Hour',
    lore: 'Worn after the lamps go out, by someone who did not let anyone see.',
    effect: 'At the start of each of your turns, one bad status is cleared.',
    triggers: [T('onTurnStart', null, null, [{ type: 'cleanse', target: 'self', count: 1 }])] });
  make('pike_of_the_old_line', { base: 'spear', tier: 4, name: 'Pike of the Old Line',
    lore: 'Sergeant Rook counts it among the men.',
    effect: 'If you end a turn without moving, the first enemy that moves within 2 hexes takes 5, ignoring armor.',
    triggers: [T('onTurnEnd', { selfHasMoved: false }, null, [{ type: 'armInterrupt', on: 'onEnemyMoveNear', if: { withinHexes: 2 }, label: 'Pike set',
      effects: [{ type: 'damage', target: 'subject', amount: 5, direct: true }] }])] });
  make('the_red_standard', { base: 'halberd', tier: 5, name: 'The Red Standard',
    lore: "A strip of old red cloth on a halberd shaft: a company's last colours.",
    effect: 'When you kill, allies within 2 hexes recover 4 HP, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'heal', target: 'alliesWithin', radius: 2, amount: 4 }])] });
  make('hearthwardens_lamp', { base: 'holy_relic', tier: 4, name: "Hearthwarden's Lamp",
    lore: 'The lamp from the Priory door. Brother Teodor has never once locked it.',
    effect: 'At the start of battle, you and your allies gain Regen: 2 HP for 2 turns.',
    triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'regen', payload: [2, 2] }, { type: 'applyStatus', target: ALL, status: 'regen', payload: [2, 2] }])] });

  // ------------------------------------------------------------------ capitals taken, and the plotters' leaders (Phase 4d, conquest.js)
  // A capital's piece goes to the player who fought at its last stand (on either side) or ordered the attack; a leader's piece is the
  // first clear of their stronghold.
  make('keep_wardens_plate', { base: 'plate_armor', tier: 5, name: "Keep-Warden's Plate",
    lore: 'Worn on the walls of Crown Keep by the man who held the gate. The dents are his; the oath stamped inside is the King\'s.',
    effect: 'You begin each battle Steeled. When you Guard, you also take half the damage dealt to the allies next to you.',
    triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'steeled', turns: 1 }]), T('onGuard', null, null, [{ type: 'applyStatus', target: 'self', status: 'intercept', turns: 1 }])] });
  make('gildhaven_key', { equiv: 5, name: 'The Gildhaven Key',
    lore: 'The key to the deepest vault in Gildhaven. Nobody remembers what was kept there; everybody remembers who held it.',
    effect: 'A kill gives back 1 AP, once a turn.',
    acc: { crit: 6, statMods: { spd: 1 }, triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'refundAP', amount: 1 }])] } });
  make('voldun_canon', { base: 'staff_arcane', tier: 5, name: "The Vol'Dun Canon",
    lore: "The staff the Synod's readers held while the rules of magic were read aloud. It has heard every one of them.",
    effect: 'Your first spell hit each turn Marks the target (it takes 25% more damage for a turn) and slows it.',
    triggers: [T('onHit', { abilityTag: 'spell' }, 'oncePerTurn', [{ type: 'applyStatus', target: 'victim', status: 'marked', turns: 1 }, { type: 'applyStatus', target: 'victim', status: 'slow', turns: 1 }])] });
  make('outlaws_bell', { equiv: 5, name: "Outlaw's Rest Bell",
    lore: 'The bell over the gate at Outlaw\'s Rest, rung for every rider who came home. It is small enough to carry, and it still rings.',
    effect: 'The first time you drop to half health in a battle, you and your allies gain Haste for a turn.',
    acc: { statMods: { hp: 6, mv: 1 }, triggers: [T('onBloodied', null, 'oncePerBattle', [{ type: 'applyStatus', target: 'self', status: 'haste', turns: 1 }, { type: 'applyStatus', target: ALL, status: 'haste', turns: 1 }])] } });
  make('priory_hearthstone', { equiv: 5, name: 'The Priory Hearthstone',
    lore: 'A stone from the Priory hearth, still warm. Whoever took the Priory took this too, and it does not seem to mind who holds it.',
    effect: 'The first time you drop to half health in a battle, allies within 2 hexes recover 6 HP.',
    acc: { res: 6, statMods: { hp: 8 }, triggers: [T('onBloodied', null, 'oncePerBattle', [{ type: 'heal', target: 'alliesWithin', radius: 2, amount: 6 }])] } });
  make('marshals_edge', { base: 'iron_sword', tier: 5, name: "The Marshal's Edge",
    lore: 'Lord Marshal Voss carried it for the old oath, and drew it last for the old oath too.',
    effect: 'A kill gives you Haste for a turn, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'applyStatus', target: 'self', status: 'haste', turns: 1 }])] });
  make('cranes_tally', { equiv: 5, name: "Crane's Tally",
    lore: "Factor Crane's counting-beads, one for every debt still owed. Several of the beads are new.",
    effect: 'The first enemy you hit each battle is Marked for 2 turns.',
    acc: { crit: 4, statMods: { spd: 1 }, triggers: [T('onHit', null, 'oncePerBattle', [{ type: 'applyStatus', target: 'victim', status: 'marked', turns: 2 }])] } });
  make('ilvanes_circlet', { equiv: 5, name: "Ilvane's Circlet",
    lore: 'A plain silver band the Archon wore under her hood. The Inner Circle took its name from it.',
    effect: 'You begin each battle with a ward of 6.',
    acc: { res: 6, statMods: { mana: 4 }, triggers: [T('onBattleStart', null, null, [{ type: 'shield', target: 'self', amount: 6 }])] } });
  make('old_standards_horn', { equiv: 5, name: "Old Standard's Horn",
    lore: 'A cracked hunting horn that called the Banner home. Captain Old Standard blew it once more, at the end.',
    effect: 'The first time you drop to half health in a battle, your allies gain Haste for a turn.',
    acc: { statMods: { hp: 6 }, triggers: [T('onBloodied', null, 'oncePerBattle', [{ type: 'applyStatus', target: ALL, status: 'haste', turns: 1 }])] } });

  // ------------------------------------------------------------------ the realm, and places worth the walk
  make('the_last_word', { base: 'staff_arcane', tier: 5, name: 'The Last Word',
    lore: 'The last thing said in the room is the one that counts.',
    effect: 'The first spell each battle costs 1 less AP.',
    triggers: [T('onAbilityUsed', { abilityTag: 'spell' }, 'oncePerBattle', [{ type: 'refundAP', amount: 1 }])] });
  make('wayfinders_compass', { equiv: 3, name: "Wayfinder's Compass",
    lore: 'Its needle points at the road. Not north. The road.',
    effect: 'Lets you climb one hex higher and move one hex farther.',
    acc: { statMods: { mv: 1, jump: 1 } } });
  make('wolfmothers_fang', { base: 'javelin', tier: 3, name: "Wolfmother's Fang",
    lore: 'Taken from a den by someone who asked first.',
    effect: 'A kill speeds up your next turn, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'gainMeter', target: 'self', amount: 20 }])] });
  make('fen_kings_hood', { base: 'chain_coif', tier: 3, name: "Fen King's Hood",
    lore: 'Woven reed and tarred rope. The crown only looked ridiculous.',
    effect: 'You begin each battle Steeled: you take 30% less damage for a turn.',
    add: { elemRes: { nature: 20 } },
    triggers: [T('onBattleStart', null, null, [{ type: 'applyStatus', target: 'self', status: 'steeled', turns: 1 }])] });
  make('thornmail', { base: 'plate_armor', tier: 4, name: 'Thornmail',
    lore: 'Bark-plated steel. Whoever grabs it regrets it, in a small way, a lot.',
    effect: 'Every melee hit you take costs the attacker 3, ignoring armor.',
    triggers: [T('onDamaged', { withinHexes: 1, abilityTag: 'melee' }, null, [{ type: 'damage', target: 'attacker', amount: 3, direct: true }])] });
  make('emberwick', { base: 'wand_fire', tier: 3, name: 'Emberwick',
    lore: "Its flame has burned since the chapel's last candle.",
    effect: 'A fire hit sets the target burning (2 a turn for 2 turns), once a turn.',
    triggers: [T('onHit', { abilityTag: 'fire' }, 'oncePerTurn', [{ type: 'applyStatus', target: 'victim', status: 'burn', payload: [2, 2] }])] });
  make('runefall_totem', { base: 'warding_totem', tier: 4, name: 'Runefall Totem',
    lore: 'A runestone wedged in a stone fist. It holds when the owner does not.',
    effect: 'The first time you drop to half health in a battle, a ward of 8 rises around you.',
    triggers: [T('onBloodied', null, 'oncePerBattle', [{ type: 'shield', target: 'self', amount: 8 }])] });

  // Uniques never show in the skirmish lists (the stash and the shops use item ids directly).
  const LO = window.GAME_LOADOUT;
  if (LO && LO.itemsFor && !LO._uniquesWrapped) { LO._uniquesWrapped = true; const f = LO.itemsFor; LO.itemsFor = function () { return f.apply(this, arguments).filter(id => !(G[id] && G[id].unique)); }; }

  // ---- where each one is found (campaign hooks wait for GAME_CAMPAIGN) ----
  if (window.GAME_LOADOUT && window.GAME_LOADOUT.registerAttacks) window.GAME_LOADOUT.registerAttacks();   // unique weapons get their Attack ability too

  function hooks() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE; if (!C || !C.applyEncounterResult || !C.takeLoreNews || !S || !S.promote || !C.lore) return false; if (C.UNIQUE_AWARDS) return true;
    const first = d => st => { const s = st.world.dungeons && st.world.dungeons[d]; return !!(s && s.clears > 0); };
    const rank = (f, n) => st => { const r = S.getRank(st, f); return !!(r && r.rank >= n); };
    const seen = p => st => !!(st.world.nodes && st.world.nodes[p] && st.world.nodes[p].visited);
    const cap = f => st => !!(st.world.flags && st.world.flags['capgear_' + f]);
    C.UNIQUE_AWARDS = {
      rat_kings_tooth: first('rat_run_warren'), tollkeepers_cudgel: first('old_toll_cellars'), wellwater_charm: first('thistledown_well'),
      rimeheart: first('frozen_falls_cave'), bog_priests_censer: first('drowned_idol_depths'), cantors_lute: first('sunken_cloister_crypt'),
      dockside_arbalest: first('silt_wharf_undercroft'), cerecloth_of_applecourt: first('applecourt_cellars'), bone_splitter: first('skull_quarry_pits'),
      oathbreaker: first('oathstone_crypt'), crown_of_the_old_king: first('kings_barrow_depths'), the_master_batch: first('bubbling_vats_undercellar'),
      right_of_the_pit: first('bonehall_pit'), the_first_ward: first('fading_wards_vault'), hushbell: first('voldun_undercity'),
      bannerets_rampart: rank('crown', 3), stewards_seal: rank('crown', 4), widows_needle: rank('syndicate', 3), ledger_hood: rank('syndicate', 4),
      inquisitors_rod: rank('synod', 3), robe_of_the_quiet_hour: rank('synod', 4), pike_of_the_old_line: rank('broken_banner', 3), the_red_standard: rank('broken_banner', 4),
      hearthwardens_lamp: st => !!(C.jobDone && C.jobDone(st, 'hw_q4')),
      the_last_word: st => !!st.world.realm,
      wayfinders_compass: seen('lantern_point'), wolfmothers_fang: seen('wolfmothers_den'), fen_kings_hood: seen('sinkhole_shrine'),
      thornmail: seen('reliquary_hill'), emberwick: seen('brimstone_chapel'), runefall_totem: seen('runefall'),
      // 4d: capitals (a flag set by conquest.js when one falls with the player there) and the plotters' strongholds
      keep_wardens_plate: cap('crown'), gildhaven_key: cap('syndicate'), voldun_canon: cap('synod'), outlaws_bell: cap('broken_banner'), priory_hearthstone: cap('hearthwatch'),
      marshals_edge: first('oath_vault'), cranes_tally: first('second_counting_house'), ilvanes_circlet: first('sealed_scriptorium'), old_standards_horn: first('last_camp')
    };
    // what the player is told when each one turns up (writing pass 4): who gives it, or where it was, in a line or two
    C.UNIQUE_FOUND = {
      rat_kings_tooth: "The Warren's king is dead. You pried the tooth from his grin yourself, and the runners by the door suddenly remember errands.",
      tollkeepers_cudgel: "The last tollkeeper's club was under the cellar stairs. Nobody left alive has a claim on it.",
      wellwater_charm: "At the bottom of Thistledown's well lay a pebble, damp as the day it was dropped. The well does not object to your taking it.",
      rimeheart: "The cave gives up a staff with ice at its core. The cold stays with you long after you leave.",
      bog_priests_censer: "In the idol's depths, a censer that still smells of reeds. Whoever burned it last was expecting a sick person to be carried in.",
      cantors_lute: "A lute in the cloister crypt, still in tune. Somebody was in the middle of a hymn.",
      dockside_arbalest: "Under the wharf, a crossbow that appears in no ledger. The Syndicate will not ask where it went, and that is how you know it mattered.",
      cerecloth_of_applecourt: "Applecourt's cellars give you the lord's own shroud, cut and stitched into a hauberk. It does not want to be put down.",
      bone_splitter: "The Quarry King's maul. You count the ribs in the grip-wrap and stop at eleven.",
      oathbreaker: "The Oathstone's crypt kept one blade without a name carved on it. It comes out of the stone willingly.",
      crown_of_the_old_king: "The Old King's crown, taken from the Old King. The barrow goes quiet behind you, as if it had been asked to.",
      the_master_batch: "Down in the vats, a staff made from the batch that went wrong. It is still going.",
      right_of_the_pit: "The Bonehall pit is yours now. The greatsword was left standing in the sand, for whoever was left.",
      hushbell: "A bell hangs in the Undercity, made so it could never be rung. You take it down as quietly as you can, which is very.",
      the_first_ward: "In the vault of the fading wards, a book whose first page refuses to be read. It lets you carry it anyway.",
      bannerets_rampart: "Voss hands you a shield in the yard and makes no speech. The paint is fresh. The strap is not.",
      stewards_seal: "Harrow's seal, in brass. A Hand is expected to carry it, and to go where it is told.",
      widows_needle: "A Syndicate dagger with no name on it, only a debt. Someone has already written the debt in your column.",
      ledger_hood: "A Partner's hood, with lenses sewn in. It looks at every number twice, and now so will you.",
      inquisitors_rod: "Warden Vell puts the rod in your hand: chalk on one end, a bell on the other. \"The bell is for what is not on the list,\" she says.",
      robe_of_the_quiet_hour: "A robe is left on your bed in the chantry. No note. You know whose hour it was made for.",
      pike_of_the_old_line: "Sergeant Rook gives you the pike without looking at you. \"Count it among the men,\" he says, and goes off to count something else.",
      the_red_standard: "Old Standard cuts a strip from the old colours and ties it to a halberd shaft himself. \"A company's last,\" he says. \"Don't lose it.\"",
      hearthwardens_lamp: "Brother Teodor lifts the lamp from the Priory door and puts it in your hands. The door stays open behind him.",
      the_last_word: "A clerk delivers a staff, and a note with one line on it: the last thing said in the room is the one that counts.",
      wayfinders_compass: "At Lantern Point, a compass whose needle ignores north. It points at the road. You decide to trust it.",
      wolfmothers_fang: "In the wolf-mother's den, a fang laid on a flat stone. You asked first, and the den let you take it.",
      fen_kings_hood: "The sinkhole shrine's king wore this and looked ridiculous. You put it on and do not.",
      thornmail: "On Reliquary Hill, bark-plated steel. It is polite until somebody grabs it.",
      emberwick: "The last candle in the Brimstone Chapel still burns. The wand keeps its flame.",
      runefall_totem: "At Runefall, a runestone wedged in a stone fist. It holds, whether you do or not.",
      keep_wardens_plate: "In the gatehouse at Crown Keep, the Keep-Warden's plate hangs on its stand. Nobody stops you taking it down.",
      gildhaven_key: "A clerk at Gildhaven hands you the key to the deepest vault without being asked. He would rather it was your problem.",
      voldun_canon: "The readers have fled Vol'Dun. Their staff is still on the lectern, beside the page they stopped at.",
      outlaws_bell: "You cut the bell down from the gate at Outlaw's Rest. It rings once on the way down, for whoever is still riding.",
      priory_hearthstone: "In the Priory, the fire has gone out, but one stone of the hearth is still warm. You take it with you.",
      marshals_edge: "Voss's sword lies where he fell in the Oath Vault. It comes up clean, as if it had been waiting.",
      cranes_tally: "Crane's counting-beads are still on his desk in the Second Counting-House, every debt in order. You take the lot.",
      ilvanes_circlet: "The Archon's silver circlet lies on the scriptorium floor. The Inner Circle will have to find another name.",
      old_standards_horn: "Old Standard's horn hangs from a tent-pole in the Last Camp. Nobody is left to blow it but you."
    };
    // Gives every unique whose condition is now true and that this save has not had. Returns the ids given.
    C.checkUniques = function (st) {
      const out = []; if (!st || !st.world || !st.inventory) return out;
      const fl = st.world.flags = st.world.flags || {};
      for (const id of Object.keys(C.UNIQUE_AWARDS)) {
        if (fl['uq_' + id] || !G[id]) continue; let ok = false; try { ok = !!C.UNIQUE_AWARDS[id](st); } catch (e) { ok = false; }
        if (!ok) continue;
        fl['uq_' + id] = Math.max(1, st.world.day); st.inventory.items[id] = (st.inventory.items[id] || 0) + 1; out.push(id);
        (st.world.uniqueNews = st.world.uniqueNews || []).push(id);
      }
      return out;
    };
    const ae0 = C.applyEncounterResult;
    C.applyEncounterResult = function (st) {
      const had = k => k.indexOf('uq_') === 0, before = new Set(Object.keys((st && st.world && st.world.flags) || {}).filter(had));
      const out = ae0.apply(this, arguments); C.checkUniques(st);
      const got = Object.keys((st && st.world && st.world.flags) || {}).filter(k => had(k) && !before.has(k)).map(k => k.slice(3));
      if (out && got.length) out.uniques = got; return out;
    };
    const lo0 = C.lore; C.lore = function () { const r = lo0.apply(this, arguments); C.checkUniques(arguments[0]); return r; };
    const pr0 = S.promote; S.promote = function (st) { const r = pr0.apply(this, arguments); C.checkUniques(st); return r; };
    const tn0 = C.takeLoreNews;
    C.takeLoreNews = function (st) {
      const out = tn0.apply(this, arguments), q = st.world.uniqueNews || []; st.world.uniqueNews = [];
      return out.concat(q.map(id => ({ kind: 'unique', id, text: (C.UNIQUE_FOUND[id] ? C.UNIQUE_FOUND[id] + ' ' : '') + 'A rare find: ' + G[id].name + '.' })));
    };
    return true;
  }
  if (!hooks() && typeof setTimeout === 'function') { let n = 0; (function wait() { if (hooks()) return; if (++n < 400) setTimeout(wait, 25); })(); }
})();
