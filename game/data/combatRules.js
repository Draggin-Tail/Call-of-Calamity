/* Global combat constants, status definitions, terrain rules and the default battlefield.
   Values are copied from the prototype engine; entries marked (engine) are the ones the engine currently hard-codes. */
window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.combatRules = {
  grid: { width: 8, height: 8, layout: 'hex-odd-r' },

  turn: {                                  // (engine) nextTurn / endTurn / queue
    pointsPerTurn: 4,
    moveCost: 2,                           // flat, however many tiles
    meterThreshold: 100,                   // a unit acts when its meter reaches this
    startingMeter: 0,
    meterPenaltyPerPointSpent: 10,         // after a turn the meter resets to -(points spent) x this
    minSpeed: 3,                           // effective Speed never drops below this
    tiebreak: 'player-first',
    previewQueueLength: 9,                 // turn-order bar length
    previewRestingMeter: -20               // assumed meter for other units when projecting the queue
  },

  quarry: { damageMultiplier: 1.25 },      // Tracker: bonus damage the hunter deals to its Quarry (traps hit it twice as hard; a kill refunds 1 AP)
  forced: { fallBase: 3, fallStep: 1, collision: 3 },   // pushes and pulls: a fall costs 3 for the first level, +(3+1) for the second, +(3+2) for the third ...; a push stopped by a unit or rock costs 3
  ledger: { max: 20 },                     // Paladin: Martyr's Ledger, damage intercepted for allies, spent by Lay on Hands
  metamagic: { twinFraction: 0.4, chainFraction: 0.6, chainRange: 3, splashFraction: 0.6, splashRadius: 1 },   // Wizard: Twin's second cast (full status), Twin Lightning chain, Widen splash on single-target spells
  verse: { max: 6 },                       // Bard: songs banked for Crescendo (each song used adds one, up to this)
  charge: { max: 2, bonusPointsPerCharge: 1, spentLast: true, clearedBy: ['stagger'] },   // Wizard Charge
  cooldowns: { decrementAt: 'ownTurnEnd' },
  resourceCosts: {                         // HP-as-a-resource & low-HP threshold mechanics
    hpCostPctFloor: 'Math.floor(currentHp * pct) — never self-KOs when low on HP',
    bloodiedThreshold: 0.5                 // <= 50% maxHp triggers ability.bloodied bonuses
  },
  cast: {                                  // abilities with ct > 0: points are spent now, effect lands later
    allowedCt: [0, 20, 40, 60, 80], maxCt: 80, minThreshold: 10,
    // castMeter starts at 0 and gains the caster's effective Speed per tick; the cast resolves at
    // threshold = max(minThreshold, min(maxCt, ct) - castHaste)   (castHaste is a statMods stat, default 0)
    oneCastAtATime: true, cancelledBy: ['stagger'], resolvesBeforeTurnsOnTie: true,
    singleTarget: 'locks the target unit and follows it', area: 'locks the target tile'
  },                                              // e.g. Vanish cd:3
  summons: { maxPerOwner: 1, placement: 'adjacent', maxHeightStep: 1, initialMeter: 40, replaceOnRecast: true },

  // Levels (campaign only; the simulator and skirmish default to level 1). Per-level growth is piecewise: [[upToLevel, ratePerLevel], ...].
  // HP grows by a share of the unit's full max HP, power multiplies final damage and healing. Nothing else scales.
  level: {
    cap: 50,
    hp:    [[20, 0.03], [50, 0.01]],                   // +3% per level to level 20 (+57%), then +1% per level to 50 (+87%)
    power: [[20, 0.02], [50, 0.007]],                  // +2% per level to 20 (+38%), then +0.7% per level to 50 (+59%)
    xp: { base: 50, step: 15 },                        // XP to go from level L to L+1 = base + step x (L - 1)
    xpAdjust: { perLevel: 0.15, min: 0.25, max: 1.5 }  // XP x (1 + perLevel x (encounter level - unit level)), clamped
  },

  build: {                                 // character slots
    primarySlots: 1, secondarySlots: 1, passiveSlots: 2,
    equipmentSlots: ['MainHand', 'OffHand', 'Head', 'Body', 'Accessory'],
    secondaryCostPenalty: 0,               // extra cost for secondary-class skills (0 = full access at normal cost)
    minAbilityCost: 1, minMoveCost: 1, minGuardCost: 0
  },

  // Weapons, armor, crit and mana (data/loadout.js reads this; both the game and the simulator use it).
  loadout: {
    attackCost: 2,                         // a weapon's own c overrides (daggers and fists cost 1)
    weaponModByCost: { 1: 0.5, 2: 1, 3: 1.25, 4: 1.25 },   // physical skills hit for  weapon power x this + the skill's own p  (skill key wm overrides)
    refWeaponPower: 7,                     // the weapon power the skill p values were converted against
    unarmed: { name: 'Fists', p: 3, r: 1, c: 1, crit: 8 },  // no weapon equipped
    natural: { name: 'Natural weapons', p: 6, r: 1, c: 2, crit: 5 },   // summoned creatures
    critMultiplier: 1.5,
    critCap: 60,      // percent
    wardArmorScale: 0.1,                   // physical shields add this many shield points per point of armor % (spell wards use spell power instead)
    spellWeaponShare: 0.3,                 // spells, heals and spell wards add this share of the equipped weapon's strike (x the skill's cost multiplier)
    baseSpellCrit: 5,                      // percent, spells and spell weapons
    mitigationCap: 60,                     // armor and resistance never reduce more than this percent
    minHit: 1,                             // a hit that connects always does at least this much
    mana: {
      costPerAP: 2,                        // default mana cost = AP cost x this (skill key m overrides); Attack and Guard cost none
      pools: {                             // by class arch (classes.js)
        caster:  { max: 30, regen: 4 },
        hybrid:  { max: 24, regen: 3 },
        martial: { max: 18, regen: 2 }
      }
    }
  },

  damage: {                                // order applied in act()/hurt()
    order: ['flankOrAmbush', 'witherOnAttacker', 'guard', 'shield'],
    flankMultiplier: 1.5,                  // round up; needs an ally on the opposite side of the target
    ambushMultiplier: 2,                   // Backstab while vanished; replaces flank, never stacks
    witherMultiplier: 0.7,                 // applied to the withered attacker's damage; round
    guardMultiplier: 0.5,                  // round up
    pierceIgnores: ['guard', 'shield', 'counter'],   // abilities flagged ignore:1
    guardCounter: { classes: ['warrior'], damage: 4, range: 1, needsGuard: true },
    healCappedAtMissingHp: true
  },

  areaShapes: {
    // Ground-aimed: tap any tile in range (empty ground included); a preview shows the footprint, tap again to cast. Geometry lives in data/shapes.js.
    splash: { desc: 'every tile within radius (default 1) of the aimed tile', power: 'full' },
    ring:   { desc: 'every tile within radius of the centre, centre excluded; with self:1 it surrounds the caster', power: 'full' },
    line:   { desc: 'a straight line from the caster toward the aimed tile, len tiles, piercing everything on it', power: 'full' },
    cone:   { desc: 'a 60-degree wedge len tiles deep, opening away from the caster toward the aimed tile', power: 'full' },
    star:   { desc: 'the aimed tile plus len tiles along all six hex axes', power: 'full' },
    wall:   { desc: 'the aimed tile and the two tiles flanking it across the line of fire', power: 'full' },
    arc:    { desc: 'the aimed tile plus tiles adjacent to both attacker and aimed tile (melee sweeps)', power: 'full' },
    // Unit-based
    chain:  { desc: 'target plus the nearest other enemies near it', extraTargets: 2, radius: 2, extraPower: 5 }
  },


  targeting: {
    dmg: 'enemies, not vanished', debuff: 'enemies, not vanished',
    heal: 'allies below max HP', buff: 'allies including self',
    meleeRange: 1, meleeMaxHeightGap: 1
  },

  height: {
    maxLevel: 2,
    defaultClimb: 1,                       // class.jump overrides (Rogue 2)
    rangedReach: { levelsPerRange: 2 },    // range += Math.trunc((attackerHeight - targetHeight) / levelsPerRange)
    minRange: 1,
    rulesText: 'Each step can climb or drop at most 1 level (Rogue: 2). Melee cannot reach across a gap of 2+ levels. Ranged skills gain +1 range when attacking from 2 levels higher and lose 1 when attacking from 2 levels lower; a 1-level difference changes nothing. Height gives no damage bonus.'
  },

  movement: { passThroughAllies: true, enemiesBlock: true, endOnOccupiedTile: false,
              standardMoveOncePerTurn: true },   // Move command only; dash abilities (k:'move') ignore this

  statuses: {                              // keys match unit.st in the engine
    shield:  { label: 'Shield',  stacks: 'sum', decrement: null,       desc: 'Shield: absorbs damage before HP.' },
    poison:  { negative: true, label: 'Poison',  payload: '[turns, damage]', tick: 'ownTurnStart', desc: 'Poison: takes damage at the start of each of its turns.' },
    bleed:   { negative: true, label: 'Bleed',   payload: '[turns, damage]', tick: 'ownTurnStart', desc: 'Bleed: takes physical hemorrhage damage at the start of each turn.' },
    regen:   { label: 'Regen',   payload: '[turns, heal]',   tick: 'ownTurnStart', desc: 'Regen: restores HP at the start of each of its turns.' },
    slow:    { negative: true, label: 'Slow',    speedDelta: -3, decrement: 'ownTurnEnd', desc: 'Slow: -3 Speed, so it acts later.' },
    haste:   { label: 'Haste',   speedDelta: 3,  decrement: 'ownTurnEnd', desc: 'Haste: +3 Speed.' },
    wither:  { negative: true, label: 'Wither',  damageMultiplier: 0.7, decrement: 'ownTurnEnd', desc: 'Wither: deals 30% less damage.' },
    pin:     { negative: true, label: 'Pinned',  blocks: ['move', 'dash'], decrement: 'ownTurnEnd', desc: 'Pinned: cannot move on its next turn.' },
    taunt:   { label: 'Taunt',   decrement: 'ownTurnEnd', desc: 'Taunt: enemies prefer to attack this unit.' },
    vanish:  { label: 'Vanished', untargetable: true, clearedBy: 'offensiveAction', desc: 'Vanished: cannot be targeted until it attacks.' },
    charge:  { label: 'Charge',  storedOn: 'unit', desc: 'Charge: bonus points banked for its next turn.' },
    guard:   { label: 'Guarding', storedOn: 'unit', clearedAt: 'ownTurnStart', desc: 'Guarding: halves damage until its next turn.' },

    // ---- control & debuff statuses (rules are read by index.html and the simulator) ----
    stun:     { negative: true, label: 'Stunned',  skipsTurn: true, clearsOnApply: ['cast', 'charge'], decrement: 'ownTurnEnd',
                desc: 'Stunned: loses its next turn; any cast in progress and banked Charge are lost.' },
    silence:  { negative: true, label: 'Silenced', blocks: ['tag:spell'], decrement: 'ownTurnEnd',
                desc: 'Silenced: cannot use abilities tagged spell.' },
    root:     { negative: true, label: 'Rooted',   blocks: ['move', 'dash', 'forcedMove'], decrement: 'ownTurnEnd',
                desc: 'Rooted: cannot move and cannot be pushed or pulled.' },
    burn:     { negative: true, label: 'Burn',     payload: '[turns, damage]', tick: 'ownTurnStart', ignoresShield: true,
                desc: 'Burn: takes fire damage at the start of each of its turns; shields do not absorb it.' },
    blind:    { negative: true, label: 'Blind',    rangeDelta: -2, decrement: 'ownTurnEnd',
                desc: 'Blind: ranged attacks and spells lose 2 range (minimum 1).' },
    marked:   { negative: true, label: 'Marked',   damageTakenMultiplier: 1.25, ignoresVanish: true, decrement: 'ownTurnEnd',
                desc: 'Marked: takes 25% more damage and can be targeted even while vanished.' },
    charm:    { negative: true, label: 'Charmed',  switchesTeam: true, decrement: 'ownTurnEnd',
                desc: 'Charmed: fights for the other team during its own turns.' },
    empowered:{ label: 'Empowered', damageDealtMultiplier: 1.3, consumedOnAttack: true, decrement: 'ownTurnEnd',
                desc: 'Empowered: its next damaging ability deals +30% damage.' },
    unmovable:{ label: 'Immovable', blocks: ['forcedMove'], decrement: 'ownTurnEnd',
                desc: 'Immovable: cannot be pushed or pulled (it can still move on its own).' },
    mez:      { negative: true, label: 'Mesmerized', skipsTurn: true, clearsOnApply: ['cast', 'charge'], breaksOnDamage: true, decrement: 'ownTurnEnd',
                desc: 'Mesmerized: loses its turn, but any damage snaps it out of the trance.' },
    confused: { negative: true, label: 'Confused', aiRule: 'nearestAnyUnit', decrement: 'ownTurnEnd',
                desc: 'Confused: acts on its own, using a random attack, debuff, heal or buff on a random unit of either team in range.' },
    dontAct:  { negative: true, label: "Can't Act", blocks: ['ability', 'guard'], decrement: 'ownTurnEnd',
                desc: "Can't Act: may still move, but cannot use abilities or Guard." },

    // ---- Tier-3 batch 2 ----
    intercept: { label: 'Intercepting', redirectsAllyDamage: 0.5, decrement: 'ownTurnEnd',
                desc: 'Intercepting: takes half of the damage dealt to adjacent allies.' },
    deathSave: { label: 'Death Ward', desc: 'Death Ward: the next lethal hit leaves this unit on the stored HP instead (used once).' },   // value = HP restored, no timer
    thorns:    { label: 'Thorns', reflectDamage: 4, decrement: 'ownTurnEnd', desc: 'Thorns: adjacent attackers take 4 damage when they hit this unit.' },
    zoc:       { label: 'Zone of Control', zocRangePenalty: 1, decrement: 'ownTurnEnd', desc: 'Zone of Control: enemies that start a Move adjacent to this unit have 1 less Move range.' },
    siege:     { label: 'Sieged', rangeDelta: 1, blocks: ['move', 'dash'], decrement: 'ownTurnEnd', desc: 'Sieged: +1 range on ranged skills, but cannot move.' },
    standfast: { label: 'Stand Fast', armorBonus: 20, decrement: 'ownTurnEnd', desc: 'Stand Fast: +20% armor against physical hits.' },
    steeled:   { label: 'Steeled', damageTakenMultiplier: 0.7, decrement: 'ownTurnEnd', desc: 'Steeled: takes 30% less damage.' },
    farsight:  { label: 'Farsight', rangeDelta: 1, jumpDelta: 1, decrement: 'ownTurnEnd', desc: 'Farsight: +1 range on ranged skills and +1 climb.' },

    // ---- Class fantasy pass (2026-11-21) ----
    // stackable: N = max stacks (value is the timer; stacks live in unit.stk). atStacks: {stacks: {status: turns}} fires extra statuses.
    exposed:   { negative: true, label: 'Exposed', armorBonus: -10, stackable: 4, decrement: 'ownTurnEnd', desc: 'Exposed: -10% armor per stack (up to 4). Sunder stacks it.' },
    chill:     { negative: true, label: 'Chill', speedDelta: -2, stackable: 3, atStacks: { 3: { pin: 1 } }, decrement: 'ownTurnEnd', desc: 'Chill: -2 Speed per stack (up to 3). At 3 stacks the target is also pinned for a turn.' },
    reckless:  { label: 'Reckless', selfDebuff: true, damageDealtMultiplier: 1.4, damageTakenMultiplier: 1.3, decrement: 'ownTurnEnd', desc: 'Reckless: deals 40% more damage, takes 30% more.' },
    winded:    { negative: true, label: 'Winded', moveDelta: -1, decrement: 'ownTurnEnd', desc: 'Winded: -1 Move range.' },
    dazed:     { negative: true, label: 'Dazed', rangeDelta: -1, decrement: 'ownTurnEnd', desc: 'Dazed: ranged skills and spells lose 1 range.' },
    fear:      { negative: true, label: 'Fear', blocks: ['ability', 'guard', 'move', 'dash'], aiRule: 'flee', decrement: 'ownTurnEnd', desc: 'Fear: runs away from the caster at the start of its turn and cannot use abilities or Guard.' },
    grievous:  { negative: true, label: 'Grievous', healMultiplier: 0.5, decrement: 'ownTurnEnd', desc: 'Grievous: healing received is halved.' },
    disarm:    { negative: true, label: 'Disarmed', blocks: ['tag:physical'], decrement: 'ownTurnEnd', desc: 'Disarmed: cannot use weapon (physical) skills.' },
    fatigue:   { negative: true, label: 'Fatigue', apDelta: -1, decrement: 'ownTurnEnd', desc: 'Fatigue: 1 fewer action point on its next turn.' },
    orders:    { label: 'Orders', apDelta: 1, decrement: 'ownTurnEnd', desc: 'Orders: 1 extra action point on its next turn.' },
    warded:    { label: 'Warded', resBonus: 30, decrement: 'ownTurnEnd', desc: 'Warded: +30% resistance against spells.' },
    evasion:   { label: 'Evasion', decrement: 'ownTurnEnd', desc: 'Evasion: the next hit against it misses (used once).' },
    overwatch: { label: 'Overwatch', decrement: 'ownTurnEnd', desc: 'Overwatch: takes a free shot at the first enemy that moves into its range.' },
    clarity:   { label: 'Clarity', manaRegen: 3, decrement: 'ownTurnEnd', desc: 'Clarity: +3 mana at the start of its turns.' },
    bloodthirst:{ label: 'Bloodthirst', lifesteal: 25, decrement: 'ownTurnEnd', desc: 'Bloodthirst: heals for 25% of the damage it deals.' },
    judged:    { negative: true, label: 'Judged', flatDamageTaken: 2, decrement: 'ownTurnEnd', desc: 'Judged: every hit against it deals +2 holy damage (ignores armor). Paladin skills punish it further; Smite Evil consumes the mark.' },
    wrath:     { label: 'Righteous Wrath', judgedReflect: 4, decrement: 'ownTurnEnd', desc: 'Righteous Wrath: a Judged enemy that hits this unit takes 4 holy damage.' },
    quarry:    { negative: true, label: 'Quarry', ignoresVanish: true, decrement: 'ownTurnEnd', desc: 'Quarry: hunted by a Tracker. It cannot hide from them, and they hit it harder.' },
    // Metamagic (Wizard): the next spell this turn is reshaped. Consumed by that spell, gone at end of turn.
    widen:     { label: 'Widen', decrement: 'ownTurnEnd', desc: 'Widen: the next spell has a wider area.' },
    reach:     { label: 'Reach', rangeDelta: 2, decrement: 'ownTurnEnd', desc: 'Reach: the next spell has +2 range.' },
    quickcast: { label: 'Quick Cast', decrement: 'ownTurnEnd', desc: 'Quick Cast: the next spell costs 1 less AP.' },
    twin:      { label: 'Twin', decrement: 'ownTurnEnd', desc: 'Twin: the next spell is cast twice, in the way that suits it.' }
  },

  // =====================================================================================
  // KEYWORDS  -  vocabulary for JSON-only editing. data/triggers.js runs these; both index.html and
  // the simulator share it, and it warns in the console about any word it does not know.
  //
  // A passive, gear item or ability may carry:
  //   triggers: [ { on: 'onDamaged', if: { selfHpBelowPct: 50 }, limit: 'oncePerTurn',
  //                 effects: [ { type: 'applyStatus', target: 'attacker', status: 'slow', turns: 1 } ] } ]
  // Passives and gear fire for the unit that wears them. An ability's triggers fire for the unit that used it,
  // and only for events caused by that ability.
  // =====================================================================================
  keywords: {
    triggers: {
      onBattleStart:     'once, when the battle begins (every unit)',
      onTurnStart:       'start of the unit\'s own turn, after poison/bleed/burn/regen tick',
      onTurnEnd:         'when the unit ends its turn (not when a stun makes it skip the turn)',
      onAbilityUsed:     'the unit uses any ability or dash (ctx: ability, target)',
      onCastStart:       'the unit begins a cast-time ability',
      onCastResolve:     'a cast-time ability lands',
      onCastInterrupted: 'the unit\'s cast is cancelled (stagger, stun)',
      onMove:            'after the unit finishes a move or dash',
      onEnemyMoveNear:   'an enemy moves; subject = the mover. Add if:{withinHexes:N} to set the radius',
      onGuard:           'the unit uses Guard',
      onHit:             'the unit dealt damage (ctx: victim, damage, ability) - after the hit',
      onDamaged:         'the unit is about to take damage (ctx: attacker, damage). modifyDamage works here',
      onLethalDamage:    'the unit is about to take damage that would kill it (ctx: attacker, damage). preventDeath works here; fires after onDamaged',
      onAllyDamaged:     'a different ally is about to take damage (ctx: victim, damage). modifyDamage works here',
      onHeal:            'the unit healed someone (ctx: target, amount, overflow)',
      onHealOverflow:    'the unit\'s heal was larger than the missing HP (ctx: target, overflow)',
      onKill:            'the unit killed something (ctx: victim)',
      onAnyDeath:        'any unit dies (ctx: victim)',
      onStatusApplied:   'a status was applied to the unit (ctx: status)',
      onStatusExpired:   'a status ran out on the unit (ctx: status)',
      onBloodied:        'the unit dropped to or below the bloodied HP threshold',
      onFlankCheck:      'while testing flank; effect {type:"flankHexes", value:"rear3"} also accepts the two rear-side hexes'
    },
    conditions: {      // everything in "if" must be true. No dice: the game is deterministic.
      selfHpBelowPct: 'owner HP % is below N',          selfHpAbovePct: 'owner HP % is above N',
      selfHasStatus: 'owner has status X',              selfLacksStatus: 'owner lacks status X',
      selfBloodied: 'true/false: owner is at or below the bloodied threshold',
      subjectHpBelowPct: 'the other unit in the event is below N% HP',
      subjectHasStatus: 'the other unit has status X', subjectLacksStatus: 'the other unit lacks status X',
      withinHexes: 'owner is within N hexes of the other unit in the event',
      subjectIsEnemy: 'true/false', subjectIsAlly: 'true/false',
      heightAdvantage: 'true/false: owner stands higher than the other unit',
      abilityTag: 'the ability in the event has tag X', abilityKind: 'dmg|heal|buff|debuff|self|move|summon',
      abilityId: 'the ability in the event is X',
      distinctAbilitiesThisTurn: 'owner has used at least N different abilities this turn',
      unspentAPAtLeast: 'owner has at least N points left',
      damageAtLeast: 'the damage in the event is at least N',
      isOwnTurn: 'true/false: it is currently the owner\'s turn',
      selfHasMoved: 'true/false: owner has moved (any move or dash) this turn',
      isFlanking: 'true/false: owner is flanking the other unit in the event',
      targetCountWithin: 'N, or {count, radius?, who?: enemy|ally}: at least that many units within radius (default 1 hex, enemies)'
    },
    limits: { oncePerTurn: 'per unit, resets when its turn starts', oncePerBattle: 'per unit, for the whole battle' },
    targets: {
      self: 'the owner', attacker: 'whoever dealt the damage', victim: 'whoever was hurt or killed', subject: 'the other unit in the event',
      target: 'the target of the ability or heal in the event', alliesWithin: 'other allies within radius N', enemiesWithin: 'enemies within radius N',
      allAllies: 'every other ally', allEnemies: 'every enemy'
    },
    amounts: { amount: 'base number', scaleBy: 'unspentAP | overflow | damage  (multiplies amount, or uses mult for overflow/damage)', mult: 'used with overflow/damage', max: 'cap' },
    effects: {
      damage:       '{amount|scaleBy, target, direct?, ignoreShield?}  direct = plain HP loss that triggers nothing',
      heal:         '{amount|scaleBy, target}',
      shield:       '{amount|scaleBy, max?, target}',
      applyStatus:  '{status, turns | payload:[turns,amount], target}',
      cleanse:      '{count, statuses?, target}  removes negative statuses',
      refundAP:     '{amount}  only while it is the owner\'s own turn',
      gainCharge:   '{amount, target}',
      gainMana:     '{amount, target}  restores mana (never above the pool)',
      gainLedger:   '{amount, target}  adds to the unit\'s Martyr\'s Ledger (Paladin; capped by combatRules.ledger.max)',
      reduceCooldown: '{ability?, amount, target}',
      modifyDamage: '{flat?, mult?}  changes the damage in an onDamaged / onAllyDamaged event',
      stagger:      '{amount, target}  pushes the target back on the turn meter and cancels its cast',
      cancelCast:   '{target}',
      push:         '{hexes, target, from?}  away from the owner (or from: attacker|subject). A drop costs fall damage (combatRules.forced); a push blocked by a unit or rock costs collision damage',
      pull:         '{hexes, target, from?}  toward the owner',
      armInterrupt: '{on, if?, effects, expires?}  arms a one-shot trigger that waits for its event (Overwatch)',
      flankHexes:   '{value:"rear3"}  only meaningful on onFlankCheck',
      stripBuffs:   '{count?, statuses?, target}  removes N positive statuses (shield, haste, regen, vanish...) from the target',
      detonateDots: '{mult?, statuses?, target}  consumes the target\'s remaining poison + bleed (override with statuses) and deals the total at once',
      gainMeter:    '{amount (negative allowed), target}  adds or removes turn meter; unlike stagger it keeps casts and Charge',
      stealMeter:   '{amount, target}  takes turn meter from the target and gives it to the owner',
      teleport:     '{mode: towardTarget|adjacentTarget|behindTarget|awayFromTarget, hexes?, anchor?: subject|attacker|victim, target?}  moves the unit (default: owner) onto an open hex around the anchor',
      preventDeath: '{keepHp?}  onLethalDamage only: the hit leaves the owner on keepHp (default 1). Pair with limit:"oncePerBattle"',
      summon:       '{unitId, count?, max?}  spawns that class id on an open hex next to the owner; replaces the owner\'s previous summon of the same id'
    },
    tags: ['melee', 'ranged', 'damage', 'heal', 'buff', 'debuff', 'self', 'dash', 'summon', 'pet', 'spirit', 'area', 'physical', 'spell',
           'fire', 'frost', 'lightning', 'arcane', 'holy', 'nature', 'shadow', 'mind', 'song', 'poison', 'bleed', 'stagger', 'pierce', 'drain']
  },

  ai: {                                    // (engine) aiStep / ai
    thinkDelayMs: 550, moveStepMs: 120, maxActionsPerTurn: 12,
    healBelowFraction: 0.5, poisonScoreBonus: 8, areaScoreBonus: 3,
    canHitScoreBonus: 100, heightScorePerLevel: 0.3
  },

  battlefield: {                           // likely moves to a maps file later
    heights: [
      [0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0],
      [0,0,0,1,0,0,0,0],
      [0,0,0,2,2,0,0,0],
      [0,1,1,2,1,0,0,0],
      [0,0,0,1,0,0,1,1],
      [0,0,0,0,0,0,1,2],
      [0,1,0,0,0,0,0,0]
    ],
    rocks: [],
    spawns: { P: [[3,6],[2,7],[4,7]], E: [[4,1],[2,0],[5,0]] },
    defaultParties: { P: ['warrior','archer','cleric'], E: ['warrior','wizard','necro'] }
  }
};
