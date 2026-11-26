/* Ability definitions. Every ability referenced by classes.js must exist here.
   Short keys:
     n        name
     c        action-point cost
     m        mana cost (tune per ability; 2 per AP was the old global rule). Basic weapon Attacks cost no mana.
     r        range in hexes (omit for self-only)
     k        kind: 'dmg' | 'heal' | 'buff' | 'debuff' | 'self' | 'summon' | 'move'
     p        base power (damage or healing)
     ct       cast time % of a turn (0 = instant; 20, 40, 60, 80)
     fx       status payload { shield, intercept, deathSave, thorns, zoc, siege, steeled, farsight, poison, bleed, burn, regen, slow, haste, wither, pin, taunt, vanish, stun, silence, root, blind, marked, charm, confused, dontAct }
     area     shape of the effect: 'splash' | 'ring' | 'line' | 'cone' | 'star' | 'wall' | 'arc' | 'chain' (see data/shapes.js)
     radius   (splash, ring) size in hexes, default 1
     len      (line, cone, star) length in hexes; line and cone default to the range
     self     1 = the shape is centred on the caster, no aiming needed (tap yourself to cast)
     Ground-aimed shapes (everything except chain) can be aimed at any tile in range, empty ground included, with a footprint preview.
     k        'trap' places a hidden hex trap on an empty tile in range (area/radius = what it hits when sprung, p/fx = damage and statuses, persist 1 = the hazard stays and hits every foe that steps on it; otherwise it is consumed when sprung. Each caster has one of each trap down: a new cast replaces the old). Only the owner's team sees it; the first foe to enter the tile springs it.
     flank    1 = 1.5x when ally opposite target (2x from vanish)
     ignore   1 = bypasses Guard, Shield, and Guard counters
     stagger  turn-meter pushback (cancels charge and active casts)
     drain    1 = heals attacker for damage dealt
     cd       cooldown in own turns
     charge   bonus AP banked for next turn
     mv       dash steps (for k:'move')
     hpCostPct fraction of current HP sacrificed on cast (rounded down, never lethal)
     bloodied  { p, drainMult } bonus when caster HP <= 50% maxHp
     p        for PHYSICAL damage skills this is the BONUS added to the equipped weapon's strike (weapon power x weaponMod by AP cost + p, see combatRules.loadout); for spells and heals it is the full power
     m        mana cost (default AP cost x combatRules.loadout.mana.costPerAP)
     wm       override the weapon-power multiplier for this physical skill (default by AP cost: 1AP 0.5, 2AP 1, 3AP 1.25)
     wn       1 = needs no particular weapon (otherwise ranged physical skills need a ranged weapon)
     tags     labels used by triggers and statuses (see combatRules.keywords.tags); Silence blocks 'spell'
     triggers [{ on, if, limit, effects }] that fire when THIS ability causes the event (see combatRules.keywords)
     summonId  class id spawned by a k:'summon' ability (default 'skeleton')
     minR      minimum range: targets closer than this cannot be chosen
     echo      { p?, shield? } bonus when the caster already used a DIFFERENT ability this turn
     spendCharge { dmgPer?, shieldPer?, healPer? } consumes ALL banked Charge for a bonus per point (bonus AP not yet spent is lost)
     bonusVsStatus { status: n } +power when the target has that status
     bonusIfVanished n  +power when the caster attacks from Vanish
     cleanse   n  removes up to n negative statuses from each ally the ability affects
     consumeShield n  (heals) spends up to n of the caster's own shield to add that much to the heal
     drainShield  1 = damage dealt becomes shield for the caster (bloodied.drainMult scales it)
     needsBloodied 1 = usable only while the caster is Bloodied
     rootedAim n  +power if the caster has not moved this turn
     highGroundBonus n  +power if the caster stands higher than the target
     heightBonus n  +power per height level the caster stands above the target
     climbBonus n  (dash) extra climb allowed for this dash
     revealsHidden 1 = can target Vanished units
     needsPet 1 = usable only while you have a living summon (Warder)
     petStrike { p, teleport? } your summon also strikes the primary target (teleport: leaps adjacent first)
     bonusIfPetAdjacent n  +power if your summon is adjacent to the target
     swapPet 1 = swap places with your summon (k:'self')
     swap 1 = swap places with the targeted ally
     refundAP n  gives back n AP when used
     drainAlly f  heals your most wounded ally within 3 for f x damage dealt
     bonusPerNegative n  +power per negative status on the target
     selfHealIfNegative n  heals the caster n if the target had a negative status
     transferStatus 1  moves one negative status from the targeted ally to the nearest enemy
     exorcism { perStatus, radius }  cleanses all negatives from allies in radius, then +perStatus power per status removed
     bankIfEmpty n  (heal/buff with spendCharge) banks n Charge when none was spent
     perDistinct { per, max }  +per power for each OTHER different ability used this turn
     swapMeter 1 = swap turn meter with the target
     bonusFromOwnShield n  +1 power per n Shield the caster holds
     bonusPerShieldedAlly n  +n power for each OTHER ally that has Shield
     bonusIfMoved n  +power if the caster has moved this turn
     lowHpBonus { pct, p }  (heals) +p healing on a target below pct of max HP
     detonateRegen f  (heals) also heals f x the target's remaining Regeneration and ends it
     randomFx  [fx, ...]  one entry is picked at random per cast and applied to every target (Fickle Refrain)
     spendVerse { per }  Bard: adds per x banked verses to power, then clears them (each 'song' skill used banks one)
     aiBonus   n  flat bonus the enemy AI adds when scoring this skill (tuning knob)
     (status) empowered: the holder's next damaging ability deals x1.3, then the status is consumed
     desc     player-facing tooltip description */
window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.abilities = {
  // ---- Tier 1: Entry Class Abilities ----
  slash:        { n: 'Slash',           c: 2, m: 4, r: 1, k: 'dmg',    p: 2,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'A solid melee sword strike.' },
  brace:        { n: 'Stand Fast',      c: 1, m: 2,       k: 'self',         ct: 0, fx: { standfast: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Plant your feet: +20% armor for 2 turns.' },
  rally:        { n: 'Rally',           c: 2, m: 4, r: 2, k: 'buff',         ct: 0, fx: { haste: 2 }, tags: ['buff', 'physical'], desc: 'Inspire an ally with +3 Speed for 2 turns.' },
  stone_toss:   { n: 'Stone Toss',      c: 1, m: 2, r: 3, k: 'dmg',    p: 0,  ct: 0, stagger: 10, tags: ['damage', 'ranged', 'physical', 'stagger'], desc: 'Hurl a stone at close range, dealing 2 damage and 10 stagger.' },

  quickstep:    { n: 'Quickstep',       c: 1, m: 2,       k: 'move',         ct: 0, mv: 2, tags: ['dash', 'physical'], desc: 'Dart up to 2 hexes across the battlefield.' },
  shortbow:     { n: 'Leg Shot',        c: 2, m: 4, r: 4, k: 'dmg',    p: 0,  ct: 0, fx: { slow: 1 }, tags: ['damage', 'ranged', 'physical'], desc: 'An arrow at the legs, up to 4 hexes: weapon damage and Slow (1t).' },
  expose:       { n: 'Expose',          c: 1, m: 2, r: 4, k: 'dmg',    p: 0,  ct: 0, stagger: 10, tags: ['damage', 'ranged', 'physical', 'stagger'], desc: 'Disruptive shot dealing 2 damage and 10 stagger.' },
  pocket_sand:  { n: 'Pocket Sand',     c: 1, m: 2, r: 1, k: 'debuff', p: 0,  ct: 0, fx: { slow: 2, wither: 1 }, tags: ['debuff', 'melee', 'physical'], desc: 'Blind an adjacent foe with Slow (2t) and Wither (1t).' },

  staff_tap:    { n: 'Staff Tap',       c: 1, m: 2, r: 1, k: 'dmg',    p: 1,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'A light, quick blow with your weapon.' },
  salve:        { n: 'Salve',           c: 2, m: 9, r: 2, k: 'heal',   p: 9,  ct: 0, cd: 2, tags: ['heal', 'nature', 'spell'], desc: 'Apply soothing herbs to restore 9 HP.' },
  ward_light:   { n: 'Celestial Elixir',c: 2, m: 7, r: 2, k: 'buff',         ct: 0, fx: { regen: [3, 3] }, cd: 2, tags: ['buff', 'holy', 'spell'], desc: 'A soothing draught: the target regains 3 HP at the start of each of its next 3 turns.' },
  chant: {"n":"Bless","c":2,"m":7,"r":2,"k":"buff","ct":0,"fx":{"clarity":3},"tags":["buff","holy","spell"],"desc":"A small blessing: an ally gains Clarity (+3 mana per turn, 3 turns)."},
  spark:        { n: 'Spark',           c: 1, m: 4, r: 3, k: 'dmg',    p: 4,  ct: 0, tags: ['damage', 'ranged', 'lightning', 'arcane', 'spell'], desc: 'Snap a bolt of raw mana for 4 damage.' },
  ember:        { n: 'Ember',           c: 2, m: 7, r: 3, k: 'dmg',    p: 5,  ct: 0, fx: { burn: [2, 2] }, tags: ['damage', 'ranged', 'fire', 'spell'], desc: 'Sear a foe for 5 damage plus 2 Burn/turn for 2 turns (ignores shield).' },
  chill: {"n":"Chill","c":2,"m":7,"r":3,"k":"dmg","p":4,"ct":0,"fx":{"chill":2},"tags":["damage","ranged","frost","spell"],"desc":"Freeze a target for 4 damage and a Chill stack (-2 Speed, stacks)."},
  spirit_spark: { n: 'Spirit Spark',    c: 1, m: 0, r: 2, k: 'dmg',    p: 4,  ct: 0, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'gainMana', target: 'self', amount: 2 }] }], tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'A small spark of spirit for 4 damage that returns 2 mana to you.' },
  mark_prey:    { n: 'Mark Prey',       c: 1, m: 2, r: 3, k: 'debuff', p: 0,  ct: 0, fx: { quarry: 2 }, cd: 3, markQuarry: 2, tags: ['debuff', 'ranged', 'physical'], desc: 'Mark your Quarry (one at a time, 2 turns): you deal +25% to it, it cannot hide from you, and killing it refunds 1 AP.' },
  quick_cast:   { n: 'Quick Cast',      c: 0, free: true, m: 0, k: 'self', ct: 0, cd: 3, fx: { quickcast: 1 }, tags: ['self', 'arcane', 'spell'], desc: 'Free action. Your next spell this turn costs 1 less AP (never below 1).' },
  focus:        { n: 'Focus',           c: 1, m: 4,       k: 'self',         ct: 0, fx: { haste: 2 }, tags: ['self', 'arcane', 'spell'], desc: 'Sharpen your mind for +3 Speed for 2 turns.' },

  // ---- Tier 2: Tanks ----
  // Warrior (6)
  pommel: {"n":"Sundering Strike","c":1,"m":2,"r":1,"k":"dmg","p":1,"ct":0,"tags":["damage","melee","physical","stagger"],"desc":"Fast 1-AP strike that cracks armor: 5 damage and Exposed (-10% armor per stack, up to 4 stacks, 3 turns).","fx":{"exposed":3}},
  cleave:       { n: 'Cleave',          c: 2, m: 4, r: 1, k: 'dmg',    p: 3,  ct: 0, area: 'arc', tags: ['damage', 'melee', 'area', 'physical'], desc: 'Sweep your blade across all enemies in a front arc.' },
  bash:         { n: 'Shield Bash',     c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, stagger: 20, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Slam a foe for 6 damage and 20 stagger, interrupting casts.' },
  taunt: {"n":"Armor Break","c":2,"m":4,"r":1,"k":"dmg","p":3,"ct":0,"fx":{"exposed":3},"tags":["damage","melee","physical"],"desc":"Smash through the guard for heavy damage and an Exposed stack (-10% armor, 3 turns).","cd":2},
  riposte:      { n: 'Riposte',         c: 1, m: 2,       k: 'self',         ct: 0, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'armInterrupt', label: 'riposte', on: 'onDamaged', if: { withinHexes: 1, subjectIsEnemy: true }, expires: 'ownTurnStart', effects: [{ type: 'damage', target: 'subject', amount: 8 }] }] }], tags: ['self', 'physical'], desc: 'Until your next turn, the first enemy that hits you in melee takes 8 damage.' },
  execute: {"n":"Execute","c":3,"m":6,"r":1,"k":"dmg","p":3,"ct":0,"ignore":1,"cd":2,"tags":["damage","melee","physical","pierce"],"desc":"Heavy armor-piercing finisher that ignores Guard and Shield; +2 damage per Exposed stack on the target.","bonusPerStack":{"exposed":2}},
  // Sentinel (6)
  rebuke:       { n: 'Rebuke',          c: 2, m: 4, r: 1, k: 'dmg',    p: 2,  ct: 0, stagger: 20, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Punishing strike dealing 6 damage and 20 stagger.' },
  aegis:        { n: 'Aegis',           c: 2, m: 7, r: 2, k: 'buff',         ct: 0, fx: { shield: 9 }, tags: ['buff', 'holy', 'spell'], desc: 'Project a +9 arcane-divine barrier onto an ally.' },
  sanctuary: {"n":"Sanctuary","c":3,"m":11,"r":2,"k":"buff","ct":0,"area":"splash","fx":{"shield":6,"warded":2},"tags":["buff","area","holy","spell"],"desc":"Grant +6 shield to target ally and adjacent teammates, and Warded (+30% spell resistance, 2t)."},
  spellstrike:  { n: 'Spellstrike',     c: 2, m: 7, r: 2, k: 'dmg',    p: 12, ct: 0, area: 'line', len: 2, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'Channel radiant force through your blade up to 2 hexes away. Hits everything in a straight line.' },
  vigilant:     { n: 'Vigilant Ward',   c: 1, m: 2,       k: 'self',         ct: 0, fx: { taunt: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Draw enemy aggro for 2 turns.' },
  judgment:     { n: 'Radiant Verdict',        c: 3, m: 11, r: 2, k: 'dmg',    p: 12, ct: 20, bonusPerShieldedAlly: 2, cd: 2, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'Telegraphed radiant strike dealing 12 damage at mid-range, +2 for each shielded ally.' },

  // Bulwark (6)
  slam:         { n: 'Shield Slam',     c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, stagger: 25, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Crush a foe for 7 damage and 25 stagger.' },
  fortify:      { n: 'Fortify',         c: 1, m: 2,       k: 'self',         ct: 0, fx: { shield: 9, unmovable: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Lock your tower shield: +9 barrier and Immovable (2t), so you cannot be pushed or pulled.' },
  rampart_strike:{ n: 'Rampart Strike', c: 2, m: 4, r: 1, k: 'dmg',    p: 3, ct: 0, bonusFromOwnShield: 2, tags: ['damage', 'melee', 'physical'], desc: 'A shield-backed blow: 10 damage, +1 for every 2 shield you hold.' },
  hold:         { n: 'Hold the Line',   c: 2, m: 4, r: 2, k: 'debuff', p: 0,  ct: 0, fx: { taunt: 2 }, tags: ['debuff', 'ranged', 'physical'], desc: 'Taunt a foe for 2 turns.' },
  phalanx:      { n: 'Phalanx Wall',    c: 2, m: 4, r: 2, k: 'buff',         ct: 0, area: 'splash', fx: { shield: 5, unmovable: 2 }, cd: 2, tags: ['buff', 'area', 'physical'], desc: 'Form a shield wall granting +5 barrier and Immovable (2t) to clustered allies.' },
  crushing:     { n: 'Crushing Blow',   c: 3, m: 6, r: 1, k: 'dmg',    p: 5, ct: 0, fx: { wither: 2 }, bonusFromOwnShield: 3, cd: 2, tags: ['damage', 'melee', 'physical'], desc: 'Overhead maul smash dealing 13 damage and Wither (2t), +1 damage per 3 shield you hold.' },

  // ---- Tier 2: Melee ----
  // Berserker (6 - Health-as-a-Resource, Bleeds, Bloodied <50% HP)
  axe: {"n":"Axe Chop","c":2,"m":4,"r":1,"k":"dmg","p":0,"ct":0,"tags":["damage","melee","physical"],"desc":"Reliable axe chop. Pain Is Power: every attack deals +2 damage per debuff on you."},
  reckless: {"n":"Reckless Swing","c":2,"m":4,"r":1,"k":"dmg","p":6,"ct":0,"tags":["damage","melee","physical"],"desc":"A wild 13-power blow that leaves you Exposed (-10% armor, 3 turns).","selfFx":{"exposed":3}},
  rending:      { n: 'Rending Cleave',  c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, area: 'arc', fx: { bleed: [3, 3] }, tags: ['damage', 'melee', 'area', 'physical', 'bleed'], desc: 'Arc slash inflicting 3 Bleed/turn for 3 turns.' },
  bloodlust:    { n: 'Blood Rush',      c: 1, m: 2,       k: 'self',         ct: 0, hpCostPct: 0.12, fx: { haste: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Sacrifice 12% current HP for +3 Speed for 2 turns.' },
  hemorrhage: {"n":"Hemorrhage","c":3,"m":6,"r":1,"k":"dmg","p":0,"ct":0,"fx":{"bleed":[2,4]},"cd":2,"tags":["damage","melee","physical","bleed"],"desc":"Deep wound dealing 9 damage + 4 Bleed/turn (2t). Bleeds stack."},
  exsanguinate: {"n":"Exsanguinate","c":3,"m":6,"r":1,"k":"dmg","p":0,"ct":0,"drain":0.5,"cd":2,"tags":["damage","melee","physical","drain"],"desc":"Heals 50% of the damage dealt, plus 25% for each debuff on you.","drainPerDebuff":0.25},
  // Rogue (6)
  jab:          { n: 'Jab',             c: 1, m: 2, r: 1, k: 'dmg',    p: 1,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'Quick 1-AP dagger thrust.' },
  backstab:     { n: 'Backstab',        c: 2, m: 4, r: 1, k: 'dmg',    p: 4,  ct: 0, flank: 1, tags: ['damage', 'melee', 'physical'], desc: '9 damage; 1.5x when flanked with an ally, 2x from Vanish.' },
  poison:       { n: 'Poison Blade',    c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, fx: { poison: [3, 3] }, tags: ['damage', 'melee', 'physical', 'poison'], desc: '4 damage plus 3 Poison/turn for 3 turns.' },
  vanish:       { n: 'Vanish',          c: 2, m: 4,       k: 'self',         ct: 0, fx: { vanish: 1 }, cd: 3, tags: ['self', 'physical'], desc: 'Enter stealth until your next offensive action.' },
  slip:         { n: 'Slip',            c: 1, m: 2,       k: 'move',         ct: 0, mv: 2, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'applyStatus', target: 'self', status: 'vanish', turns: 1 }] }], tags: ['dash', 'physical'], desc: 'Weave through combat up to 2 hexes and slip out of sight (Vanish).' },
  fan_knives:   { n: 'Fan of Knives',   c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, fx: { poison: [2, 2] }, cd: 2, area: 'cone', len: 2, tags: ['damage', 'melee', 'area', 'physical', 'poison'], desc: 'Fan poisoned blades across a cone 2 deep in front of you.' },

  // Monk (6)
  palm: {"n":"Pressure Point","c":1,"m":2,"r":1,"k":"dmg","p":0.5,"ct":0,"tags":["damage","melee","physical"],"desc":"Fast 1-AP strike at a nerve: the target is Fatigued (1 fewer AP on its next turn).","fx":{"fatigue":1}},
  force_palm:   { n: 'Force Palm',      c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, stagger: 15, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Focused chi strike dealing 8 damage and 15 stagger.' },
  chi_wave:     { n: 'Chi Wave',        c: 2, m: 4, r: 3, k: 'dmg',    p: 0,  ct: 0, area: 'line', len: 3, tags: ['damage', 'ranged', 'physical'], desc: 'Project a wave of ki up to 3 hexes for 5 damage. Hits everything in a straight line.', wn: 1 },
  chakra: {"n":"Blur","c":1,"m":2,"k":"self","ct":0,"cd":3,"tags":["self","physical"],"desc":"Move like smoke: the next hit against you misses (until your next turn).","fx":{"evasion":2}},
  flurry:       { n: 'Flurry',          c: 3, m: 6, r: 1, k: 'dmg',    p: 4, ct: 0, flank: 1, bonusIfMoved: 4, tags: ['damage', 'melee', 'physical'], desc: 'Unleash rapid strikes for 13 damage (1.5x when flanked); +4 if you moved this turn.' },
  wind_step:    { n: 'Wind Step',       c: 1, m: 2,       k: 'move',         ct: 0, mv: 2, cd: 1, tags: ['dash', 'physical'], desc: 'Dash 2 hexes to set up flanking angles.' },

  // ---- Tier 2: Ranged ----
  // Archer (6)
  quick:        { n: 'Quick Shot',      c: 1, m: 2, r: 4, k: 'dmg',    p: 0,  ct: 0, tags: ['damage', 'ranged', 'physical'], desc: 'Rapid 1-AP bow shot up to 4 hexes.' },
  shoot:        { n: 'Aimed Shot',      c: 2, m: 4, r: 5, k: 'dmg',    p: 1,  ct: 0, rootedAim: 3, tags: ['damage', 'ranged', 'physical'], desc: 'A steadied longbow shot up to 5 hexes (weapon strike +1), +3 if you have not moved this turn.' },
  pin_shot:     { n: 'Pinning Shot',    c: 2, m: 4, r: 5, k: 'dmg',    p: 0,  ct: 0, fx: { slow: 2 }, tags: ['damage', 'ranged', 'physical'], desc: 'Hamstring arrow dealing 5 damage and Slow (2t).' },
  volley:       { n: 'Volley',          c: 3, m: 6, r: 5, k: 'dmg',    p: 0,  ct: 40, area: 'splash', tags: ['damage', 'ranged', 'area', 'physical'], desc: 'Arcing rain of arrows hitting target and adjacent hexes.' },
  longshot:     { n: 'Longshot',        c: 2, m: 4, r: 6, k: 'dmg',    p: 2,  ct: 20, tags: ['damage', 'ranged', 'physical'], desc: 'Drawn precision arrow reaching 6 hexes for 9 damage.' },
  arrow_storm:  { n: 'Arrow Storm',     c: 4, m: 8, r: 5, k: 'dmg',    p: 0, ct: 40, area: 'splash', radius: 2, cd: 3, tags: ['damage', 'ranged', 'area', 'physical'], desc: 'Full-turn sky-darkening barrage blanketing a wide area (radius 2) for 9 damage.' },

  // Marksman (6)
  snap_shot:    { n: 'Snap Shot',       c: 1, m: 2, r: 4, k: 'dmg',    p: 0.5,  ct: 0, stagger: 10, tags: ['damage', 'ranged', 'physical', 'stagger'], desc: 'Quick 1-AP crossbow shot that jolts the target (10 stagger), breaking a spell being cast.' },
  pierce_shot:  { n: 'Piercing Bolt',   c: 2, m: 4, r: 5, k: 'dmg',    p: 1,  ct: 0, ignore: 1, cd: 2, area: 'line', len: 4, tags: ['damage', 'ranged', 'physical', 'pierce'], desc: 'Heavy bolt that ignores Guard and Shield. Pierces: hits everything in a straight line.' },
  cripple_shot: { n: 'Crippling Shot',  c: 2, m: 4, r: 5, k: 'dmg',    p: 0,  ct: 0, fx: { slow: 2, wither: 1 }, tags: ['damage', 'ranged', 'physical'], desc: '6 damage plus Slow (2t) and Wither (1t).' },
  snipe:        { n: 'Snipe',           c: 3, m: 6, r: 6, k: 'dmg',    p: 4, ct: 40, rootedAim: 3, tags: ['damage', 'ranged', 'physical'], desc: 'Aimed range-6 headshot (weapon strike +4), +3 if you have not moved this turn.' },
  steady_aim:   { n: 'Steady Aim',      c: 1, m: 2,       k: 'self',         ct: 0, fx: { haste: 2 }, cd: 4, tags: ['self', 'physical'], desc: 'Control your breathing for +3 Speed for 2 turns.' },
  explosive:    { n: 'Explosive Bolt',  c: 3, m: 6, r: 5, k: 'dmg',    p: 0, ct: 0, area: 'splash', stagger: 15, cd: 2, tags: ['damage', 'ranged', 'area', 'physical', 'stagger'], desc: 'Alchemical bolt dealing 10 splash damage and 15 stagger.' },

  // Tracker (6)
  stalk:        { n: 'Stalk',           c: 1, m: 2,       k: 'move',         ct: 0, mv: 2, tags: ['dash', 'physical'], desc: 'Slip 2 hexes through brush and elevation.' },
  hunt_shot:    { n: 'Hunter Shot',     c: 2, m: 4, r: 4, k: 'dmg',    p: 0,  ct: 0, flank: 1, bonusVsStatus: { marked: 3 }, tags: ['damage', 'ranged', 'physical'], desc: 'Coordinated shot for 7 damage (1.5x when flanked); +3 against marked prey.' },
  viper:        { n: 'Viper Arrow',     c: 2, m: 4, r: 4, k: 'dmg',    p: 0,  ct: 0, fx: { poison: [2, 3] }, tags: ['damage', 'ranged', 'physical', 'poison'], desc: '4 damage plus 3 Poison/turn for 2 turns.' },
  trap:         { n: 'Snare Trap',      c: 2, m: 4, r: 3, k: 'trap',   p: 4,  ct: 0, fx: { pin: 2 }, cd: 2, area: 'splash', radius: 1, tags: ['debuff', 'ranged', 'physical', 'area'], desc: 'Hide a trap on an empty tile in range. The first foe to step on it springs it: 4 damage and Pin (2t) to every foe within 1 tile. One at a time: a new cast replaces the old. Enemies cannot see it.' },
  caltrops:     { n: 'Caltrops',        c: 2, m: 4, r: 3, k: 'trap',   p: 3,  ct: 0, fx: { slow: 2 }, cd: 2, area: 'wall', persist: 1, tags: ['damage', 'ranged', 'area', 'physical'], desc: 'Hide a 3-tile wall of spikes. Foes already there and every foe that steps on it takes 3 damage and Slow (2t). It stays until you cast it again. Enemies cannot see it.' },
  pred_mark: {"n":"Quarry","c":1,"m":2,"r":4,"k":"debuff","p":0,"ct":0,"fx":{"quarry":3},"cd":2,"tags":["debuff","ranged","physical"],"desc":"Mark your Quarry (one at a time, 3 turns): you deal +25% to it, it cannot hide from you, your traps hit it twice as hard, and killing it refunds 1 AP.","markQuarry":3},
  // ---- Tier 2: Healers ----
  // Cleric (6)
  mend:         { n: 'Mend',            c: 1, m: 4, r: 3, k: 'heal',   p: 5,  ct: 0, tags: ['heal', 'holy', 'spell'], desc: 'Fast 1-AP prayer restoring 5 HP.' },
  heal:         { n: 'Heal',            c: 3, m: 11, r: 3, k: 'heal',   p: 18, ct: 40, tags: ['heal', 'holy', 'spell'], desc: 'Major restoration healing 18 HP.' },
  smite:        { n: 'Smite',           c: 2, m: 7, r: 3, k: 'dmg',    p: 8,  ct: 0, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'Call down radiant light for 8 damage.' },
  pray:         { n: 'Pray',            c: 1, m: 4,       k: 'self',         ct: 0, charge: 1, tags: ['self', 'holy', 'spell'], desc: 'Bank +1 bonus AP for your next turn.' },
  holy_nova:    { n: 'Holy Nova',       c: 3, m: 11, r: 2, k: 'dmg',    p: 9,  ct: 20, cd: 2, area: 'ring', self: 1, radius: 2, tags: ['damage', 'ranged', 'area', 'holy', 'spell'], desc: 'Radiant pulse: 9 damage to every enemy within 2 of you.' },

  // Druid (6 - Heal-Over-Time Regen & Nature Control)
  rejuv:        { n: 'Rejuvenate',      c: 2, m: 7, r: 3, k: 'buff',         ct: 0, fx: { regen: [3, 4] }, tags: ['buff', 'nature', 'spell'], desc: 'Grant 4 HP regeneration per turn for 3 turns (12 total).' },
  wild_growth:  { n: 'Wild Growth',     c: 3, m: 11, r: 3, k: 'buff',         ct: 0, area: 'splash', fx: { regen: [2, 4] }, cd: 2, tags: ['buff', 'area', 'nature', 'spell'], desc: 'Grant 4 HP/turn Regen (2t) to target and adjacent allies.' },
  thorns:       { n: 'Briar Thorns',    c: 2, m: 7, r: 3, k: 'buff',         ct: 0, fx: { thorns: 2, regen: [2, 2] }, tags: ['buff', 'nature', 'spell'], desc: 'A living coat of briars: an ally gains Thorns (2t) and Regen 2/turn (2t).' },
  entangle:     { n: 'Entangle',        c: 2, m: 7, r: 3, k: 'debuff', p: 0,  ct: 20, fx: { root: 1, slow: 2 }, tags: ['debuff', 'ranged', 'nature', 'spell'], desc: 'Grasping roots Root (1t) and Slow (2t) a foe.' },
  bloom:        { n: 'Bloom',          c: 2, m: 7, r: 3, k: 'heal',   p: 4,  ct: 0, area: 'splash', detonateRegen: 1, cd: 2, tags: ['heal', 'area', 'nature', 'spell'], desc: 'A burst of growth heals the target and adjacent allies for 4, and each instantly collects all of its own remaining Regeneration.' },
  overgrowth:   { n: 'Overgrowth',      c: 3, m: 11, r: 3, k: 'dmg',    p: 10,  ct: 20, area: 'splash', fx: { pin: 1 }, cd: 3, tags: ['damage', 'ranged', 'area', 'nature', 'spell'], desc: 'Erupting vines deal 8 splash damage and Pin (1t).' },

  // Shaman (6)
  spirit_mend:  { n: 'Spirit Mend',     c: 2, m: 7, r: 3, k: 'heal',   p: 8,  ct: 0, tags: ['heal', 'nature', 'spell'], desc: 'Instant ancestral surge restoring 9 HP.' },
  warding_chant: {"n":"Warding Chant","c":1,"m":4,"r":3,"k":"buff","ct":0,"fx":{"shield":4,"warded":2},"cd":1,"tags":["buff","nature","spell"],"desc":"A quick chant that wraps an ally in +4 shield and Warded (+30% spell resistance, 2t)."},
  plague:       { n: 'Spirit Plague',   c: 3, m: 11, r: 3, k: 'dmg',    p: 7,  ct: 40, area: 'chain', fx: { poison: [2, 3] }, tags: ['damage', 'ranged', 'area', 'nature', 'spell', 'poison'], desc: '7 chain damage plus 3 Poison/turn (2t) across nearby foes.' },
  totem:        { n: 'Ward Totem',      c: 2, m: 7, r: 2, k: 'buff',         ct: 0, area: 'splash', fx: { shield: 6 }, tags: ['buff', 'area', 'nature', 'spell'], desc: 'Plant a protective totem granting +6 splash shield.' },
  chain_heal:   { n: 'Chain Heal',      c: 3, m: 11, r: 3, k: 'heal',   p: 9,  ct: 0, area: 'splash', cd: 3, tags: ['heal', 'area', 'nature', 'spell'], desc: 'Restore 9 HP to target ally and adjacent teammates.' },
  earth_shock:  { n: 'Earth Shock',     c: 2, m: 7, r: 3, k: 'dmg',    p: 6,  ct: 0, stagger: 15, cd: 1, tags: ['damage', 'ranged', 'nature', 'spell', 'stagger'], desc: 'Instant seismic jolt dealing 7 damage and 15 stagger.' },

  // ---- Tier 2: Casters & Support ----
  // Wizard (6)
  fire: {"n":"Firebolt","c":2,"m":7,"r":4,"k":"dmg","p":8,"ct":0,"tags":["damage","ranged","fire","spell"],"desc":"Focused flame bolt: 8 damage and Burn (2/turn, 3 turns, stacks). Widen splashes; Twin casts it again for 40% damage and a second Burn.","fx":{"burn":[3,2]},"widenSplash":1,"twin":"repeat"},
  frost:        { n: 'Frost',           c: 1, m: 4, r: 3, k: 'dmg',    p: 4,  ct: 0, fx: { slow: 2 }, tags: ['damage', 'ranged', 'frost', 'spell'], desc: 'Fast 1-AP ice shard dealing 4 damage and Slow (2t).' },
  bolt: {"n":"Lightning","c":2,"m":8,"r":4,"k":"dmg","p":8,"ct":40,"area":"line","tags":["damage","ranged","area","lightning","spell"],"desc":"A piercing bolt along a 4-hex line, 8 damage to everything in it. Widen: a cone. Reach: longer. Twin: every enemy hit chains to the nearest other enemy for 60%.","len":4,"widen":{"area":"cone","len":4},"twin":"chain"},
  blast:        { n: 'Arcane Blast',    c: 4, m: 14, r: 4, k: 'dmg',    p: 22, ct: 80, ignore: 1, area: 'line', len: 4, tags: ['damage', 'ranged', 'arcane', 'spell', 'pierce'], desc: 'Full-turn cataclysmic beam dealing 22 damage, ignoring Guard/Shield. A beam: hits everything in a straight line.' },
  mana:         { n: 'Focus Mana',      c: 1, m: 4,       k: 'self',         ct: 0, charge: 1, tags: ['self', 'arcane', 'spell'], desc: 'Bank +1 bonus AP for your next turn.' },
  meteor:       { n: 'Meteor',          c: 4, m: 14, r: 4, k: 'dmg',    p: 14, ct: 60, area: 'splash', cd: 3, tags: ['damage', 'ranged', 'area', 'fire', 'spell'], desc: 'Call down a blazing meteor for 14 splash damage.' },

  // Necromancer (6)
  drain:        { n: 'Drain Life',      c: 2, m: 7, r: 3, k: 'dmg',    p: 8,  ct: 0, drain: 1, tags: ['damage', 'ranged', 'shadow', 'spell', 'drain'], desc: 'Siphon 8 damage and heal yourself for the amount dealt.' },
  blight:       { n: 'Blight',          c: 4, m: 14, r: 3, k: 'dmg',    p: 4,  ct: 60, area: 'splash', fx: { poison: [3, 4] }, tags: ['damage', 'ranged', 'area', 'shadow', 'spell', 'poison'], desc: '4 splash damage plus 4 Poison/turn for 3 turns.' },
  skel:         { n: 'Raise Skeleton',  c: 3, m: 11,       k: 'summon',       ct: 40, tags: ['summon', 'shadow', 'spell'], desc: 'Raise an undead skeleton warrior adjacent to you.' },
  curse: {"n":"Curse","c":2,"m":7,"r":3,"k":"debuff","p":0,"ct":0,"fx":{"wither":2,"grievous":2},"tags":["debuff","ranged","shadow","spell"],"desc":"Hex a foe with Wither (2t) and Grievous (healing halved, 2t)."},
  dark_pact:    { n: 'Dark Pact',       c: 1, m: 4,       k: 'self',         ct: 0, hpCostPct: 0.15, charge: 2, cd: 2, tags: ['self', 'shadow', 'spell'], desc: 'Sacrifice 15% current HP to bank +2 AP for next turn.' },
  soul_rend:    { n: 'Soul Rend',       c: 2, m: 7, r: 3, k: 'dmg',    p: 8,  ct: 0, ignore: 1, cd: 1, tags: ['damage', 'ranged', 'shadow', 'spell', 'pierce'], desc: 'Instant shadow bolt dealing 8 guard-piercing damage.' },

  // Enchanter (6)
  mind_spike:   { n: 'Mind Spike',      c: 2, m: 7, r: 3, k: 'dmg',    p: 10,  ct: 0, stagger: 10, tags: ['damage', 'ranged', 'mind', 'spell', 'stagger'], desc: 'Psychic lance dealing 9 damage and 10 stagger.' },
  lethargy:     { n: 'Lethargy',        c: 2, m: 7, r: 3, k: 'debuff', p: 0,  ct: 0, area: 'splash', fx: { slow: 2, wither: 1 }, tags: ['debuff', 'ranged', 'area', 'mind', 'spell'], desc: 'Inflict Slow (2t) and Wither (1t) in an area.' },
  clarity: {"n":"Clarity","c":2,"m":7,"r":3,"k":"buff","ct":0,"fx":{"clarity":3},"tags":["buff","mind","spell"],"desc":"Clear an ally's mind: +3 mana at the start of each of its turns for 3 turns."},
  stasis:       { n: 'Stasis',          c: 3, m: 11, r: 3, k: 'dmg',    p: 7,  ct: 20, fx: { pin: 1, wither: 1 }, stagger: 25, tags: ['damage', 'ranged', 'mind', 'spell', 'stagger'], desc: '6 damage, 25 stagger, Pin (1t), and Wither (1t).' },
  psychic_lash: { n: 'Psychic Lash',    c: 1, m: 4, r: 3, k: 'dmg',    p: 5,  ct: 0, fx: { slow: 1 }, tags: ['damage', 'ranged', 'mind', 'spell'], desc: 'Fast 1-AP mental jab for 5 damage that leaves the target sluggish: Slow (1t).' },
  confusion:    { n: 'Mass Confusion',  c: 4, m: 14, r: 3, k: 'dmg',    p: 9,  ct: 40, area: 'splash', fx: { wither: 2, slow: 2 }, stagger: 15, cd: 3, tags: ['damage', 'ranged', 'area', 'mind', 'spell', 'stagger'], desc: '8 splash damage, 15 stagger, Wither (2t), and Slow (2t).' },

  // Bard (6)
  ballad:       { n: 'Soothing Ballad', c: 2, m: 7, k: 'heal',   p: 5,  ct: 0, area: 'all', self: 1, cd: 1, tags: ['heal', 'area', 'song', 'spell'], desc: 'Restore 5 HP to every ally on the battlefield.' },
  anthem:       { n: 'War Anthem',      c: 2, m: 7, k: 'buff',         ct: 0, area: 'all', self: 1, fx: { haste: 2 }, cd: 3, tags: ['buff', 'area', 'song', 'spell'], desc: 'Every ally on the battlefield gains +3 Speed for 2 turns.' },
  discord:      { n: 'Discord',         c: 2, m: 7, r: 3, k: 'dmg',    p: 7,  ct: 0, stagger: 15, tags: ['damage', 'ranged', 'song', 'spell', 'stagger'], desc: 'Dissonant chord dealing 7 damage and 15 stagger.' },
  dirge:        { n: 'Dirge',           c: 2, m: 7, k: 'debuff', p: 0,  ct: 20, area: 'all', self: 1, fx: { wither: 2 }, cd: 3, tags: ['debuff', 'area', 'song', 'spell'], desc: 'A haunting song: every enemy on the battlefield is Withered (-30% damage, 2t).' },
  crescendo:    { n: 'Crescendo',       c: 3, m: 11, k: 'dmg',    p: 3,  ct: 0, area: 'all', self: 1, spendVerse: { per: 2 }, cd: 2, tags: ['damage', 'area', 'song', 'spell'], desc: 'Release every verse you have banked (each song you play banks one, up to 6): 3 damage +2 per verse to every enemy on the battlefield.' },

  // Tier-2 gap fillers after the shield rework
  radiant_surge:{ n: 'Radiant Surge',   c: 2, m: 7, r: 3, k: 'heal',   p: 12, ct: 0, lowHpBonus: { pct: 0.4, p: 8 }, cd: 2, tags: ['heal', 'holy', 'spell'], desc: 'Focused burst of light restoring 12 HP, +8 if the target is below 40% HP.' },
  encore:       { n: 'Encore',          c: 1, m: 4, r: 3, k: 'buff',         ct: 0, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'reduceCooldown', target: 'target', amount: 1 }] }], tags: ['buff', 'song', 'spell'], desc: "Play an ally's skills again: reduce all of the ally's cooldowns by 1." },

  // ---- Tier 3 hybrids, batch 1 (spec: design/tier3_classes_spec_v2.md) ----
  // Shadowknight (Dread)
  dark_grip:    { n: 'Dark Grip',       c: 2, m: 7, r: 4, k: 'dmg',    p: 4,  ct: 0, fx: { slow: 2 }, cd: 2, triggers: [{ on: 'onHit', effects: [{ type: 'pull', target: 'victim', hexes: 2 }] }], tags: ['damage', 'ranged', 'shadow', 'spell', 'debuff'], desc: 'Deals 4 damage, pulls the target 2 hexes toward you and inflicts Slow (2t).' },
  // Necromancer summons: one pet at a time (a new one replaces the old). Skeleton = melee damage, Bone Golem = tank, Bone Archer = ranged damage.
  raise_golem:  { n: 'Raise Bone Golem', c: 3, m: 11,      k: 'summon',       ct: 40, summonId: 'bone_golem', jp: 400, tags: ['summon', 'shadow', 'spell'], desc: 'Raise a hulking Bone Golem: slow, sturdy, taunts and shields itself. Replaces any other summon.' },
  raise_archer: { n: 'Raise Skeleton Archer', c: 3, m: 11,     k: 'summon',       ct: 40, summonId: 'skeleton_archer', spot: 'back', jp: 400, tags: ['summon', 'shadow', 'spell'], desc: 'Raise a Skeleton Archer behind you: fragile, but shoots from range 4. Replaces any other summon.' },
  golem_slam:   { n: 'Golem Slam',      c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, wm: 0.8, stagger: 10, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Heavy bone fist: damage and 10 stagger.' },
  grave_bulwark:{ n: 'Grave Bulwark',   c: 1, m: 4,       k: 'self',         ct: 0, cd: 2, fx: { shield: 6, taunt: 2 }, tags: ['self', 'shadow'], desc: 'Shield 6 and Taunt (2t): foes must attack the Golem.' },
  bone_arrow:   { n: 'Bone Arrow',      c: 2, m: 4, r: 4, k: 'dmg',    p: 0,  ct: 0, wm: 0.7, wn: 1, tags: ['damage', 'ranged', 'physical'], desc: 'Arrow of splintered bone from range 4.' },
  call_wraith:  { n: 'Call Dread Wraith', c: 3, m: 11,     k: 'summon',       ct: 40, cd: 3, summonId: 'dread_wraith', tags: ['summon', 'shadow', 'spell'], desc: 'Summon a fast spectral Wraith whose touch poisons. It feeds Harm Touch.' },
  clinging_dark:{ n: 'Clinging Darkness', c: 2, m: 7, r: 3, k: 'dmg',  p: 4,  ct: 0, fx: { poison: [3, 3], pin: 1 }, tags: ['damage', 'ranged', 'shadow', 'spell', 'poison'], desc: '4 damage, 3 Poison/turn (3t) and Pin (1t).' },
  dread_gaze:   { n: 'Dread Gaze',      c: 2, m: 7, r: 3, k: 'debuff', p: 0,  ct: 0, fx: { confused: 1 }, cd: 3, tags: ['debuff', 'ranged', 'mind', 'shadow', 'spell'], desc: 'Terrify a foe: it attacks the nearest unit of either side for 1 turn.' },
  harm_touch:   { n: 'Harm Touch',      c: 3, m: 11, r: 1, k: 'dmg',    p: 10, ct: 20, ignore: 1, cd: 3, triggers: [{ on: 'onHit', effects: [{ type: 'detonateDots', target: 'victim' }] }], tags: ['damage', 'melee', 'shadow', 'spell', 'pierce'], desc: '10 piercing damage, then detonates all remaining poison and bleed on the target at once.' },
  // Shadowmage (Umbra)
  arcane_shiv:  { n: 'Arcane Shiv',     c: 1, m: 4, r: 1, k: 'dmg',    p: 5,  ct: 0, triggers: [{ on: 'onHit', effects: [{ type: 'gainCharge', target: 'self', amount: 1 }] }], tags: ['damage', 'melee', 'arcane', 'spell'], desc: 'Quick spellblade stab dealing 4 damage and banking +1 Charge.' },
  rift_step:    { n: 'Rift Step',       c: 1, m: 4,       k: 'move',         ct: 0, mv: 2, cd: 1, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'gainCharge', target: 'self', amount: 1 }] }], tags: ['dash', 'arcane', 'spell'], desc: 'Dash up to 2 hexes and bank +1 Charge.' },
  blink_strike: { n: 'Blink Strike',    c: 2, m: 7, r: 4, k: 'dmg',    p: 7,  ct: 0, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'towardTarget', target: 'self' }] }], tags: ['damage', 'melee', 'arcane', 'spell'], desc: 'Blink next to a foe up to 4 hexes away and strike for 7.' },
  umbral_ambush:{ n: 'Umbral Ambush',   c: 2, m: 7, r: 1, k: 'dmg',    p: 10,  ct: 0, flank: 1, spendCharge: { dmgPer: 3 }, tags: ['damage', 'melee', 'shadow', 'spell'], desc: 'Flank strike; spends all banked Charge for +3 damage each.' },
  void_lance:   { n: 'Void Lance',      c: 3, m: 11, r: 3, k: 'dmg',    p: 11, ct: 20, cd: 2, spendCharge: { dmgPer: 4 }, area: 'line', len: 3, tags: ['damage', 'ranged', 'shadow', 'spell'], desc: 'Focused shadow bolt; spends all banked Charge for +4 damage each. Hits everything in a straight line.' },
  // Warlord (Banner)
  command_strike: {"n":"Command Strike","c":1,"m":2,"r":1,"k":"dmg","p":1.5,"ct":0,"triggers":[{"on":"onAbilityUsed","effects":[{"type":"applyStatus","target":"alliesWithin","radius":1,"status":"orders","turns":1}]}],"tags":["damage","melee","physical"],"desc":"Quick pommel thrust and a shouted order: allies adjacent to you gain Orders (+1 AP on their next turn).","cd":2},
  banner_slam:  { n: 'Banner Slam',     c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, echo: { p: 4 }, tags: ['damage', 'melee', 'physical'], desc: 'Banner-pole blow for 8. Echo: +4 damage if you already used another ability this turn.' },
  rally_point:  { n: 'Rally Point',     c: 2, m: 4, r: 3, k: 'buff',         ct: 0, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'pull', target: 'target', hexes: 2 }] }], tags: ['buff', 'physical'], desc: 'Pull an ally 2 hexes toward you.' },
  overrun:      { n: 'Overrun',         c: 3, m: 6, r: 1, k: 'dmg',    p: 2, ct: 0, cd: 2, echo: { p: 4 }, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], tags: ['damage', 'melee', 'physical'], desc: 'Shoulder charge for 11 and 1-hex knockback. Echo: +4 if you already used another ability this turn.' },
  // Assassin (Lethality)
  hidden_blade: { n: 'Hidden Blade',    c: 1, m: 2, r: 1, k: 'dmg',    p: 2,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'Fast concealed dagger stab.' },
  shadowstep:   { n: 'Shadowstep Strike', c: 2, m: 4, r: 3, k: 'dmg',  p: 2,  ct: 0, cd: 2, bonusVsStatus: { poison: 3 }, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'behindTarget', target: 'self' }] }], tags: ['damage', 'melee', 'shadow', 'physical'], desc: 'Teleport behind the target and strike for 8 (+3 if Poisoned).' },
  eviscerate:   { n: 'Eviscerate',      c: 2, m: 4, r: 1, k: 'dmg',    p: 3,  ct: 0, flank: 1, triggers: [{ on: 'onHit', effects: [{ type: 'teleport', mode: 'awayFromTarget', target: 'self', hexes: 1 }] }, { on: 'onKill', if: { abilityId: 'eviscerate' }, effects: [{ type: 'applyStatus', status: 'vanish', turns: 1, target: 'self' }] }], tags: ['damage', 'melee', 'physical'], desc: '1.5x flank / 2x vanish, then steps 1 hex back. A kill re-enters Vanish.' },
  garrote: {"n":"Garrote","c":2,"m":4,"r":1,"k":"dmg","p":2,"ct":0,"cd":3,"triggers":[{"on":"onHit","if":{"isFlanking":true},"effects":[{"type":"applyStatus","status":"dontAct","turns":1,"target":"victim"}]}],"tags":["damage","melee","physical"],"desc":"5 damage and Grievous (healing halved, 2t). When flanking, the target can move but cannot act next turn.","fx":{"grievous":2}},
  smoke_bomb:   { n: 'Smoke Bomb',      c: 2, m: 4, r: 1, k: 'debuff', p: 0,  ct: 0, area: 'splash', fx: { blind: 2 }, cd: 3, tags: ['debuff', 'area', 'melee', 'physical'], desc: 'Choke foes around the target hex with smoke: Blind (2t, -2 range).' },
  headshot:     { n: 'Headshot',        c: 3, m: 6, r: 5, minR: 2, k: 'dmg', p: 3, ct: 20, ignore: 1, cd: 2, bonusIfVanished: 8, tags: ['damage', 'ranged', 'physical', 'pierce'], desc: 'Piercing long-range shot (min range 2). +8 damage if fired from Vanish.', wn: 1 },
  // Songweaver (Symphony)
  motif:        { n: 'Motif',           c: 1, m: 4, r: 3, k: 'dmg',    p: 3,  ct: 0, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'gainMana', target: 'alliesWithin', radius: 2, amount: 2 }] }], tags: ['damage', 'ranged', 'song', 'spell'], desc: 'A sharp sonic phrase for 3 damage, with a refrain that restores 2 mana to allies within 2 hexes.' },
  cleansing_verse:{ n: 'Cleansing Verse', c: 2, m: 7, r: 3, k: 'buff',       ct: 0, area: 'splash', cleanse: 1, tags: ['buff', 'area', 'song', 'spell'], desc: 'Cleanse 1 negative status from the target and adjacent allies.' },
  counterpoint: {"n":"Serenade","c":2,"m":7,"r":3,"k":"buff","ct":0,"tags":["buff","song","spell","area"],"desc":"A calming song: target ally and adjacent teammates gain Clarity (+3 mana per turn, 3 turns).","area":"splash","radius":1,"fx":{"clarity":3}},
  charm_song:   { n: 'Charm Song',      c: 3, m: 11, r: 3, k: 'debuff',       ct: 20, fx: { charm: 1 }, cd: 3, tags: ['debuff', 'ranged', 'song', 'mind', 'spell'], desc: 'The foe fights for your side during its next turn.' },
  // Spellbow (Arcanery)
  chrono_arrow: { n: 'Chrono Arrow',    c: 1, m: 4, r: 4, k: 'dmg',    p: 2,  ct: 0, triggers: [{ on: 'onHit', effects: [{ type: 'stealMeter', target: 'victim', amount: 10 }] }], tags: ['damage', 'ranged', 'arcane', 'spell'], desc: '3 damage and steals 10 turn meter.' },
  quicken:      { n: 'Quicken',         c: 2, m: 7, r: 3, k: 'buff',         ct: 0, cd: 3, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'gainMeter', target: 'target', amount: 20 }] }], tags: ['buff', 'arcane', 'mind', 'spell'], desc: 'An ally gains 20 turn meter and acts sooner.' },
  flicker_shot: { n: 'Flicker Shot',    c: 2, m: 7, r: 4, k: 'dmg',    p: 5,  ct: 0, triggers: [{ on: 'onHit', effects: [{ type: 'teleport', mode: 'awayFromTarget', target: 'self', hexes: 2 }] }], tags: ['damage', 'ranged', 'arcane', 'spell'], desc: 'Shoot for 7, then blink up to 2 hexes away from the target.' },

  // ---- Tier 3 hybrids, batch 2 (spec: design/tier3_classes_spec_v2.md) ----
  // Paladin (Chivalry)
  holy_strike: {"n":"Holy Strike","c":1,"m":2,"r":1,"k":"dmg","p":0.5,"ct":0,"tags":["damage","melee","holy","physical"],"desc":"Fast mace strike. +3 damage against a Judged target.","bonusVsStatus":{"judged":3}},
  guardian_oath: {"n":"Guardian Oath","c":2,"m":7,"r":2,"k":"heal","p":3,"ct":0,"selfFx":{"intercept":2},"cd":2,"tags":["heal","holy","spell"],"desc":"An ally recovers 3 HP. For 2 turns you take half of the damage dealt to allies adjacent to you, and it is written into your Ledger."},
  lay_on_hands: {"n":"Lay on Hands","c":2,"m":7,"r":2,"k":"heal","p":4,"ct":0,"cd":2,"tags":["heal","holy","spell"],"desc":"Heal 4, plus everything in your Martyr's Ledger (damage you intercepted for allies, up to 20), which it empties.","ledgerHeal":1},
  purifying_light:{ n: 'Purifying Light', c: 2, m: 7, r: 2, k: 'buff',       ct: 0, cleanse: 2, tags: ['buff', 'holy', 'spell'], desc: 'Remove up to 2 negative statuses from an ally.' },
  divine_interv:{ n: 'Divine Intervention', c: 3, m: 11, r: 3, k: 'buff',     ct: 0, fx: { deathSave: 14 }, cd: 3, tags: ['buff', 'holy', 'spell'], desc: "Death Ward: the ally's next lethal hit leaves them on 14 HP instead (once)." },
  consecrate: {"n":"Consecrate","c":3,"m":11,"r":1,"k":"dmg","p":10,"ct":20,"cd":2,"area":"ring","self":1,"radius":1,"tags":["damage","melee","area","holy","spell"],"desc":"Holy blast: 10 damage to every adjacent enemy. Judged enemies in the ring are Pinned (1t).","fxVsStatus":{"judged":{"pin":1}}},
  // Blood Knight (Crimson)
  crimson_aegis:{ n: 'Siphon Strength', c: 1, m: 2,       k: 'self',         ct: 0, hpCostPct: 0.15, fx: { empowered: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Sacrifice 15% current HP: your next damaging skill deals +30%.' },
  sanguine_lance:{ n: 'Sanguine Lance', c: 2, m: 4, r: 2, k: 'dmg',    p: 1,  ct: 0, ignore: 1, bloodied: { p: 2 }, area: 'line', len: 2, tags: ['damage', 'melee', 'physical', 'pierce'], desc: 'Guard-piercing blood spear (+3 power when Bloodied). Hits everything in a straight line.' },
  crimson_tithe:{ n: 'Crimson Tithe',   c: 2, m: 4, r: 1, k: 'dmg',    p: 3,  ct: 0, needsBloodied: 1, drain: 1, cd: 2, tags: ['damage', 'melee', 'physical', 'drain'], desc: 'Only while Bloodied: a hungry strike that heals you for all the damage it deals.' },
  bloodbath:    { n: 'Bloodbath',       c: 3, m: 6, r: 1, k: 'dmg',    p: 0,  ct: 0, cd: 3, triggers: [{ on: 'onHit', effects: [{ type: 'heal', target: 'self', amount: 2 }] }], area: 'ring', self: 1, radius: 1, tags: ['damage', 'melee', 'area', 'physical'], desc: 'Frenzy around you: 7 damage to every adjacent enemy; you recover 2 HP per enemy hit.' },
  last_stand:   { n: 'Last Stand',      c: 1, m: 2,       k: 'self',         ct: 0, needsBloodied: 1, fx: { steeled: 2 }, cd: 3, tags: ['self', 'physical'], desc: 'Only while Bloodied: take 30% less damage for 2 turns.' },
  // Warden (Grove)
  knotted_fist: { n: 'Knotted Fist',    c: 1, m: 2, r: 1, k: 'dmg',    p: 0.5,  ct: 0, bonusVsStatus: { root: 3 }, tags: ['damage', 'melee', 'nature', 'physical'], desc: '4 damage, +3 against a Rooted target.' },
  rootbind:     { n: 'Rootbind',        c: 2, m: 7, r: 2, k: 'dmg',    p: 6,  ct: 0, fx: { root: 2 }, cd: 1, tags: ['damage', 'melee', 'nature', 'spell', 'debuff'], desc: '6 damage and Root (2t): cannot move, dash or be pushed or pulled.' },
  barkskin:     { n: 'Barkskin',        c: 1, m: 2,       k: 'self',         ct: 0, fx: { shield: 9, thorns: 2, zoc: 2 }, cd: 2, tags: ['self', 'nature'], desc: 'Skin like bark: +9 shield, Thorns (2t) and Zone of Control (2t).' },
  snaring_thicket:{ n: 'Snaring Thicket', c: 2, m: 7,     k: 'self',         ct: 0, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'armInterrupt', label: 'thicket', on: 'onEnemyMoveNear', if: { withinHexes: 2, subjectIsEnemy: true }, expires: 'ownTurnStart', effects: [{ type: 'damage', target: 'subject', amount: 6 }, { type: 'applyStatus', target: 'subject', status: 'root', turns: 1 }] }] }], tags: ['self', 'nature', 'spell'], desc: 'Arm a trap until your next turn: the first enemy to move within 2 hexes takes 6 damage and is Rooted.' },
  living_wall:  { n: 'Living Wall',     c: 2, m: 7, r: 2, k: 'buff',         ct: 0, fx: { shield: 8, zoc: 2 }, tags: ['buff', 'nature', 'spell'], desc: 'Ally gains +8 shield and Zone of Control (2t).' },
  earthshaker:  { n: 'Earthshaker',     c: 3, m: 6, r: 1, k: 'dmg',    p: 2,  ct: 0, cd: 2, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], area: 'ring', self: 1, radius: 1, tags: ['damage', 'melee', 'area', 'nature', 'physical'], desc: 'Slam the ground: 8 damage and a 1-hex knockback to every enemy around you.' },
  // Siegebreaker (Ballistics)
  buckler_bolt: { n: 'Buckler Bolt',    c: 1, m: 2, r: 4, k: 'dmg',    p: 0.5,  ct: 0, rootedAim: 2, tags: ['damage', 'ranged', 'physical'], desc: 'Quick bolt for 4; +2 if you did not move this turn.' },
  dig_in:       { n: 'Dig In',          c: 1, m: 2,       k: 'self',         ct: 0, fx: { standfast: 2, siege: 2 }, cd: 2, tags: ['self', 'physical'], desc: 'Siege stance (2t): +1 range and +20% armor, but you cannot move.' },
  breaching_shot:{ n: 'Breaching Shot', c: 2, m: 4, r: 5, k: 'dmg',    p: 0,  ct: 0, multVsStatus: { shield: 2 }, area: 'line', len: 4, tags: ['damage', 'ranged', 'physical'], desc: 'Double damage against a shielded target. Hits everything in a straight line.' },
  point_blank:  { n: 'Point Blank',     c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, cd: 3, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 2 }] }], tags: ['damage', 'melee', 'physical'], desc: '8 damage and 2-hex knockback.' },
  counter_battery:{ n: 'Counter-Battery', c: 2, m: 4, r: 5, k: 'dmg',  p: 0,  ct: 0, stagger: 30, tags: ['damage', 'ranged', 'physical', 'stagger'], desc: '7 damage and 30 stagger: cancels casts.' },
  bombardment:  { n: 'Bombardment',     c: 3, m: 6, r: 6, minR: 2, k: 'dmg', p: 3, ct: 40, area: 'splash', stagger: 15, cd: 2, tags: ['damage', 'ranged', 'area', 'physical', 'stagger'], desc: 'Mortar (min range 2): 14 splash damage and 15 stagger.' },
  // Zen Archer (Zenith)
  lofty_focus:  { n: 'Lofty Focus',     c: 1, m: 2,       k: 'self',         ct: 0, fx: { farsight: 2 }, cd: 2, tags: ['self'], desc: 'Farsight (2t): +1 range on ranged skills and +1 climb.' },
  wind_vault:   { n: 'Wind Vault',      c: 1, m: 2,       k: 'move',         ct: 0, mv: 2, climbBonus: 2, cd: 2, tags: ['dash', 'physical'], desc: 'Dash up to 2 hexes, climbing up to 2 levels more than usual.' },
  gale_shot:    { n: 'Gale Shot',       c: 2, m: 4, r: 5, k: 'dmg',    p: 1,  ct: 0, highGroundBonus: 3, tags: ['damage', 'ranged', 'physical'], desc: '8 damage, +3 when you stand higher than the target.' },
  flying_kick:  { n: 'Flying Kick',     c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, stagger: 15, cd: 2, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }, { on: 'onHit', effects: [{ type: 'teleport', mode: 'awayFromTarget', target: 'self', hexes: 1 }] }], tags: ['damage', 'melee', 'physical', 'stagger'], desc: '8 damage, 15 stagger, knock the foe back 1 and step back 1.' },
  heavens_descent:{ n: "Heaven's Descent", c: 3, m: 6, r: 3, k: 'dmg', p: 1, ct: 0, heightBonus: 2, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'towardTarget', target: 'self' }] }], tags: ['damage', 'melee', 'physical'], desc: 'Leap next to a foe within 3 and strike for 10, +2 for every height level you land above it.' },
  stillness_shot:{ n: 'Stillness Shot', c: 3, m: 6, r: 6, minR: 2, k: 'dmg', p: 4, ct: 40, rootedAim: 2, highGroundBonus: 3, cd: 2, tags: ['damage', 'ranged', 'physical'], desc: 'Min range 2. +2 if you did not move, +3 if you stand higher.' },
  // Ranger (Wilds)
  cancel_magic: { n: 'Cancel Magic',    c: 1, m: 4, r: 3, k: 'debuff', p: 0,  ct: 0, cd: 2, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'stripBuffs', target: 'target', count: 1 }] }], tags: ['debuff', 'ranged', 'nature', 'spell'], desc: 'Strip 1 positive status (shield, haste, regen...) from a foe.' },
  silencing_arrow:{ n: 'Silencing Arrow', c: 2, m: 4, r: 5, k: 'dmg',   p: 0,  ct: 0, fx: { silence: 2 }, cd: 2, tags: ['damage', 'ranged', 'physical', 'debuff'], desc: '5 damage and Silence (2t): no spells.' },
  flush_out:    { n: 'Flush Out',       c: 1, m: 2, r: 5, k: 'dmg',    p: 0,  ct: 0, revealsHidden: 1, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'stripBuffs', target: 'target', statuses: ['vanish'] }] }], tags: ['damage', 'ranged', 'physical'], desc: 'Can target Vanished foes: 2 damage and ends their Vanish.' },
  call_of_flame:{ n: 'Call of Flame',   c: 2, m: 7, r: 4, k: 'dmg',    p: 6,  ct: 0, fx: { burn: [3, 3] }, tags: ['damage', 'ranged', 'fire', 'spell'], desc: '6 damage and Burn 3/turn for 3 turns (ignores shield).' },
  hawkeye_shot: { n: 'Hawkeye Shot',    c: 2, m: 4, r: 6, k: 'dmg',    p: 0,  ct: 20, rootedAim: 3, tags: ['damage', 'ranged', 'physical'], desc: 'Longbow shot: 8 damage, +4 if you did not move this turn.' },
  hail_of_thorns:{ n: 'Hail of Thorns', c: 3, m: 6, r: 5, k: 'dmg',    p: 0,  ct: 20, area: 'splash', fx: { bleed: [2, 3] }, cd: 2, tags: ['damage', 'ranged', 'area', 'nature', 'bleed'], desc: '8 splash damage and Bleed 3/turn for 2 turns.' },


  // ---- Tier 3 hybrids, batch 3 ----
  // Beastlord (Feral): fights alongside a Spirit Warder
  call_warder:  { n: 'Call Warder',     c: 2, m: 7,       k: 'summon',       ct: 20, cd: 3, summonId: 'spirit_warder', tags: ['summon', 'nature', 'spell'], desc: 'Summon a Spirit Warder, a quick flanking companion. Replaces any previous Warder.' },
  sic_em:       { n: "Sic 'Em",         c: 1, m: 2, r: 4, k: 'dmg',    p: 0,  ct: 0, needsPet: 1, petStrike: { p: 6, teleport: 1 }, cd: 2, tags: ['damage', 'ranged', 'physical', 'pet'], desc: 'Your Warder leaps adjacent to the target and bites for 6.' },
  feral_rend:   { n: 'Feral Rend',      c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, flank: 1, bonusIfPetAdjacent: 3, tags: ['damage', 'melee', 'physical', 'pet'], desc: 'Flank strike; +4 if your Warder is adjacent to the target.' },
  tag_out:      { n: 'Tag Out',         c: 1, m: 2,       k: 'self',         ct: 0, needsPet: 1, swapPet: 1, cd: 1, tags: ['self', 'physical', 'pet'], desc: 'Swap places with your Warder.' },
  rampage_order:{ n: 'Rampage Order',   c: 3, m: 6, r: 1, k: 'dmg',    p: 1, ct: 0, needsPet: 1, petStrike: { p: 6 }, cd: 2, tags: ['damage', 'melee', 'physical', 'pet'], desc: 'You strike (weapon strike +1) and your Warder strikes the same target for 7.' },
  cannibalize:  { n: 'Cannibalize',     c: 1, m: 2,       k: 'self',         ct: 0, hpCostPct: 0.20, refundAP: 2, cd: 3, tags: ['self', 'physical'], desc: 'Sacrifice 20% of current HP to regain 2 AP (net +1).' },
  // Ascetic (Spirit): moves and shields allies with spirit
  soul_palm:    { n: 'Soul Palm',       c: 1, m: 2, r: 1, k: 'dmg',    p: 2,  ct: 0, triggers: [{ on: 'onHit', effects: [{ type: 'heal', target: 'alliesWithin', radius: 1, amount: 3 }] }], tags: ['damage', 'melee', 'physical', 'spirit'], desc: 'Palm strike; allies adjacent to you recover 3 HP.' },
  spirit_swap:  { n: 'Spirit Swap',     c: 1, m: 4, r: 4, k: 'buff',         ct: 0, swap: 1, cd: 1, tags: ['buff', 'spirit', 'spell'], desc: 'Swap places with an ally within 4.' },
  spirit_tithe: { n: 'Spirit Tithe',    c: 2, m: 4, r: 1, k: 'dmg',    p: 2,  ct: 0, drainAlly: 0.5, tags: ['damage', 'melee', 'physical', 'spirit', 'drain'], desc: 'Strike for 8; half the damage heals your most wounded ally within 3.' },
  spirit_veil:  { n: 'Spirit Veil',     c: 2, m: 7, r: 3, k: 'buff',         ct: 0, fx: { vanish: 1 }, cd: 3, tags: ['buff', 'spirit', 'spell'], desc: 'Hide an ally from sight until it attacks.' },
  dragon_palm:  { n: 'Dragon Palm',     c: 3, m: 6, r: 1, k: 'dmg',    p: 3, ct: 0, bonusPerNegative: 2, cd: 2, tags: ['damage', 'melee', 'physical', 'spirit'], desc: 'Heavy palm; +2 damage per negative status on the target.' },
  // Inquisitor (Penance): moves afflictions from allies onto enemies
  lash_penance: { n: 'Lash of Penance', c: 1, m: 4, r: 3, k: 'dmg',    p: 3,  ct: 0, selfHealIfNegative: 2, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'Holy lash; you recover 2 HP if the target had a negative status.' },
  absolve:      { n: 'Absolve',         c: 1, m: 4, r: 3, k: 'buff',         ct: 0, transferStatus: 1, tags: ['buff', 'holy', 'spell'], desc: 'Move one negative status from an ally onto the nearest enemy within 3 of that ally.' },
  blood_offering:{ n: 'Blood Offering', c: 1, m: 4, r: 3, k: 'heal',   p: 9,  ct: 0, hpCostPct: 0.2, tags: ['heal', 'holy', 'spell'], desc: 'Sacrifice 20% of your current HP to heal an ally for 9.' },
  heretics_brand:{ n: "Heretic's Brand", c: 2, m: 7, r: 3, k: 'dmg',   p: 4,  ct: 0, fx: { poison: [3, 3], wither: 2 }, tags: ['damage', 'ranged', 'holy', 'spell', 'poison'], desc: '4 damage, 3 Poison/turn (3t) and Wither (2t).' },
  exorcism:     { n: 'Exorcism',        c: 3, m: 11, r: 3, k: 'dmg',    p: 5,  ct: 20, exorcism: { perStatus: 3, radius: 2 }, cd: 2, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'Cleanse all negative statuses from allies within 2, then blast for 5 +3 per status removed.' },
  // Stormcaller (Tempest): Charge feeds healing as well as damage
  static_field: { n: 'Static Field',    c: 2, m: 7, r: 2, k: 'dmg',    p: 4,  ct: 0, area: 'splash', stagger: 10, tags: ['damage', 'ranged', 'area', 'lightning', 'spell', 'stagger'], desc: 'Crackling field: 4 damage to the area and 10 stagger.' },
  thunder_mend: { n: 'Thunder Mend',    c: 2, m: 7, r: 3, k: 'heal',   p: 6,  ct: 0, spendCharge: { healPer: 3 }, bankIfEmpty: 1, tags: ['heal', 'lightning', 'spell'], desc: 'Heal 6; spends all Charge for +3 each. With no Charge it banks 1.' },
  charged_ward: { n: 'Static Discharge', c: 2, m: 7, r: 4, k: 'dmg',   p: 5,  ct: 0, spendCharge: { dmgPer: 3 }, tags: ['damage', 'ranged', 'lightning', 'spell'], desc: 'Loose the stored storm: 5 damage, +3 for each Charge spent.' },
  squall:       { n: 'Squall',          c: 2, m: 7, r: 3, k: 'dmg',    p: 5,  ct: 0, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], area: 'cone', len: 3, tags: ['damage', 'ranged', 'area', 'lightning', 'spell'], desc: 'Gust of storm: 5 damage and a 1-hex push to every foe in a cone 3 deep.' },
  tempest_surge:{ n: 'Tempest Surge',   c: 4, m: 14, r: 4, k: 'dmg',    p: 16, ct: 60, spendCharge: { dmgPer: 4 }, cd: 3, area: 'star', len: 2, tags: ['damage', 'ranged', 'area', 'lightning', 'spell'], desc: 'Devastating storm forking along every axis in a star: 16 damage; spends all Charge for +4 each.' },
  // Deferred batch-1 skills
  press_attack: { n: 'Press the Attack', c: 2, m: 4, r: 3, k: 'buff',         ct: 0, fx: { empowered: 1 }, cd: 2, tags: ['buff', 'song', 'physical'], desc: "The ally's next damaging ability deals +30% damage." },
  grand_finale: { n: 'Grand Finale',    c: 3, m: 11, r: 3, k: 'dmg',    p: 6,  ct: 20, area: 'splash', perDistinct: { per: 3, max: 12 }, cd: 2, tags: ['damage', 'ranged', 'area', 'song', 'spell'], desc: 'Crashing finale: 6 damage to the area, +3 per different ability used this turn (max +12).' },
  mesmerize:    { n: 'Mesmerizing Shot', c: 3, m: 11, r: 4, k: 'debuff', p: 0,  ct: 20, fx: { mez: 2 }, cd: 4, tags: ['debuff', 'ranged', 'arcane', 'spell'], desc: 'The target loses its turn until it takes damage.' },
  temporal_swap:{ n: 'Temporal Swap',   c: 2, m: 7, r: 4, k: 'debuff', p: 0,  ct: 0, swapMeter: 1, cd: 4, tags: ['debuff', 'ranged', 'arcane', 'spell'], desc: 'Swap your turn meter with an enemy.' },


  // Tier-3 sixth abilities (uniform six-skill menus)
  soul_leech:   { n: 'Soul Leech',      c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, drain: 0.4, drainIfPulled: 1, bonusVsStatus: { poison: 3 }, tags: ['damage', 'melee', 'shadow', 'drain'], desc: 'Siphon damage into your own health: 40% normally, full lifesteal on a target you pulled this turn (+3 damage against a poisoned target).' },
  rift_pulse:   { n: 'Rift Pulse',      c: 2, m: 7, r: 2, k: 'dmg',    p: 6,  ct: 0, area: 'splash', spendCharge: { dmgPer: 2 }, cd: 1, tags: ['damage', 'ranged', 'area', 'arcane', 'spell'], desc: 'Burst of unstable energy to the area; spends all banked Charge for +2 damage each.' },
  decisive_blow:{ n: 'Decisive Blow',   c: 3, m: 6, r: 1, k: 'dmg',    p: 0,  ct: 0, echo: { p: 6 }, stagger: 15, cd: 2, tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Heavy command strike: 8 damage and 15 stagger. Echo: +6 damage.' },
  transference: { n: 'Transference',    c: 3, m: 6, r: 1, k: 'dmg',    p: 2,  ct: 0, drainAlly: 1, cd: 2, tags: ['damage', 'melee', 'physical', 'spirit', 'drain'], desc: 'Strike for 9; all damage dealt heals your most wounded ally within 3.' },
  scourge:      { n: 'Scourge',         c: 2, m: 7, r: 3, k: 'dmg',    p: 5,  ct: 0, fx: { bleed: [2, 3] }, tags: ['damage', 'ranged', 'holy', 'spell', 'bleed'], desc: 'Lash for 6 damage and 3 Bleed/turn (2t).' },
  gather_storm: { n: 'Gather Storm',    c: 1, m: 4,       k: 'self',         ct: 0, charge: 2, cd: 2, tags: ['self', 'lightning', 'spell'], desc: 'Draw in static: bank 2 bonus AP of Charge for your next turn.' },
  resonance:    { n: 'Resonance',       c: 2, m: 7, r: 3, k: 'dmg',    p: 5,  ct: 0, area: 'splash', echo: { p: 4 }, cd: 1, tags: ['damage', 'ranged', 'area', 'song', 'spell'], desc: 'Ringing pulse to the area for 5 damage. Echo: +4 damage.' },
  delay_shot:   { n: 'Delay Shot',      c: 2, m: 4, r: 5, k: 'dmg',    p: 0,  ct: 0, stagger: 15, tags: ['damage', 'ranged', 'arcane', 'stagger'], desc: 'Temporal arrow: weapon strike and 20 stagger, breaking casts and pushing back the turn meter.' },
  crimson_reaping:{ n: 'Crimson Reaping', c: 3, m: 6, r: 1, k: 'dmg',  p: 2,  ct: 0, area: 'arc', cd: 3, bloodied: { p: 2 }, tags: ['damage', 'melee', 'area', 'physical'], desc: 'Sweep the weapon through an arc: +2 damage, and +2 more when you are Bloodied.' },

  // ---- Summon / Shared ----
  spirit_bite:  { n: 'Spirit Bite',     c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, flank: 1, tags: ['damage', 'melee', 'physical', 'nature'], desc: 'Agile bite: 6 damage, flanking bonus.' },
  wraith_touch: { n: 'Wraith Touch',    c: 2, m: 4, r: 1, k: 'dmg',    p: 0.5,  ct: 0, fx: { poison: [2, 2] }, tags: ['damage', 'melee', 'shadow', 'poison'], desc: 'Spectral touch: 4 damage and 2 Poison/turn (2t).', wm: 0.5 },
  claw:         { n: 'Rusted Claw',     c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'Undead melee swipe for 6 damage.' },
  // ---- Monsters (non-humanoid creatures; see design/monsters.md) ----
  m_fang:       { n: 'Rending Fangs',   c: 2, m: 4, r: 1, k: 'dmg',    p: 0,  ct: 0, fx: { bleed: [2, 2] }, tags: ['damage', 'melee', 'physical', 'bleed'], desc: 'Bite for 6 damage and 2 Bleed/turn for 2 turns.' },
  m_maul:       { n: 'Maul',            c: 2, m: 4, r: 1, k: 'dmg',    p: 4,  ct: 0, tags: ['damage', 'melee', 'physical'], desc: 'Crushing blow: 10 damage.' },
  m_swipe:      { n: 'Raking Swipe',    c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, area: 'arc', tags: ['damage', 'melee', 'area', 'physical'], desc: 'Sweeping claws across an arc of foes.' },
  m_howl:       { n: 'Hunting Howl',    c: 1, m: 2,       k: 'self',         ct: 0, cd: 3, fx: { haste: 2 }, tags: ['self', 'physical'], desc: 'Howl that quickens the beast for 2 turns.' },
  m_spit:       { n: 'Venom Spit',      c: 2, m: 4, r: 3, k: 'dmg',    p: 2,  ct: 0, fx: { poison: [2, 3] }, tags: ['damage', 'ranged', 'nature', 'poison'], desc: 'Spit venom: 2 damage and 2 Poison/turn for 3 turns.' },
  m_web:        { n: 'Web Shot',        c: 1, m: 2, r: 3, k: 'debuff', p: 0,  ct: 0, cd: 2, fx: { slow: 2, root: 1 }, tags: ['debuff', 'ranged', 'physical'], desc: 'Bind a foe in webbing: Slow (2t) and Root (1t).' },
  m_rot_claw:   { n: 'Rotting Claw',    c: 2, m: 4, r: 1, k: 'dmg',    p: 1,  ct: 0, fx: { poison: [2, 3] }, tags: ['damage', 'melee', 'shadow', 'poison'], desc: 'Grave-filth claw: damage and 2 Poison/turn for 3 turns.' },
  m_wail:       { n: 'Keening Wail',    c: 2, m: 7, r: 3, k: 'debuff', p: 0,  ct: 0, cd: 2, fx: { silence: 2, wither: 1 }, tags: ['debuff', 'ranged', 'shadow', 'spell'], desc: 'A wail that Silences (2t) and Withers (1t) a foe.' },
  m_drain:      { n: 'Soul Drain',      c: 2, m: 7, r: 2, k: 'dmg',    p: 3,  ct: 0, drain: 0.5, tags: ['damage', 'ranged', 'shadow', 'spell', 'drain'], desc: 'Draw life from a foe; heals half the damage.' },
  m_bone_hurl:  { n: 'Bone Shard',      c: 2, m: 4, r: 4, k: 'dmg',    p: 3,  ct: 0, tags: ['damage', 'ranged', 'physical'], desc: 'Hurl a splinter of bone from range.' },
  m_ember:      { n: 'Scorching Touch', c: 2, m: 7, r: 1, k: 'dmg',    p: 2,  ct: 0, fx: { burn: [2, 2] }, tags: ['damage', 'melee', 'fire', 'spell'], desc: 'Searing touch with 2 Burn/turn for 2 turns.' },
  m_flame_burst:{ n: 'Flame Burst',     c: 3, m: 11, r: 3, k: 'dmg',    p: 6,  ct: 0, cd: 2, area: 'splash', fx: { burn: [2, 2] }, tags: ['damage', 'ranged', 'area', 'fire', 'spell'], desc: 'Burst of flame on a hex and its neighbours.' },
  m_slam:       { n: 'Stone Slam',      c: 3, m: 6, r: 1, k: 'dmg',    p: 8,  ct: 0, cd: 1, tags: ['damage', 'melee', 'physical'], desc: 'Heavy slam: 14 damage.' },
  m_harden:     { n: 'Harden',          c: 1, m: 2,       k: 'self',         ct: 0, cd: 3, fx: { shield: 12 }, tags: ['self', 'physical'], desc: 'Stone thickens: +12 barrier.' },
  m_spark:      { n: 'Arc Lightning',   c: 2, m: 7, r: 3, k: 'dmg',    p: 5,  ct: 0, area: 'line', len: 3, tags: ['damage', 'ranged', 'lightning', 'spell'], desc: 'Lightning that hits everything in a line.' },
  m_frost_breath:{ n: 'Frost Breath',   c: 3, m: 11, r: 2, k: 'dmg',    p: 5,  ct: 0, cd: 2, area: 'cone', len: 2, fx: { slow: 1 }, tags: ['damage', 'ranged', 'area', 'frost', 'spell'], desc: 'Cone of freezing breath; Slows.' },
  m_fire_breath:{ n: 'Fire Breath',     c: 3, m: 11, r: 3, k: 'dmg',    p: 8,  ct: 0, cd: 2, area: 'cone', len: 3, fx: { burn: [2, 2] }, tags: ['damage', 'ranged', 'area', 'fire', 'spell'], desc: 'Cone of dragonfire with 2 Burn/turn.' },
  m_tail:       { n: 'Tail Sweep',      c: 2, m: 4, r: 1, k: 'dmg',    p: 2,  ct: 0, cd: 1, area: 'ring', self: 1, radius: 1, tags: ['damage', 'melee', 'area', 'physical'], desc: 'Lash every adjacent foe.' },
  m_gaze:       { n: 'Dread Gaze',      c: 2, m: 7, r: 3, k: 'debuff', p: 0,  ct: 0, cd: 2, fx: { slow: 2, wither: 2 }, tags: ['debuff', 'ranged', 'mind', 'spell'], desc: 'A gaze that Slows and Withers (2t).' },
  m_regrow:     { n: 'Regrowth',        c: 1, m: 2,       k: 'self',         ct: 0, cd: 3, fx: { regen: [3, 3] }, tags: ['self', 'nature'], desc: 'Flesh knits: 3 HP/turn for 3 turns.' },
  // ---- New skills (two per class). jp = learning cost override; see design/new_skills_draft.md ----
  // Tier 1
  shield_bash:  { n: 'Shield Bash',     c: 2, m: 4, r: 1, k: 'dmg',    p: 4,  ct: 0, stagger: 15, jp: 175, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], tags: ['damage', 'melee', 'physical', 'stagger'], desc: 'Slam your shield into a foe: damage, a 1-hex shove and 15 stagger.' },
  second_wind:  { n: 'Second Wind',     c: 1, m: 2,       k: 'heal',   p: 10,  ct: 0, cd: 2, cleanse: 1, jp: 100, tags: ['heal', 'physical'], desc: 'Catch your breath: heal 10 and cleanse 1 negative status from yourself.' },
  hit_and_fade: { n: 'Hit and Fade',    c: 2, m: 4, r: 1, k: 'dmg',    p: 3,  ct: 0, jp: 175, triggers: [{ on: 'onHit', effects: [{ type: 'teleport', mode: 'awayFromTarget', target: 'self', hexes: 2 }] }], tags: ['damage', 'melee', 'physical'], desc: 'Strike, then leap up to 2 hexes away from the target.' },
  lookout:      { n: 'Lookout',         c: 1, m: 2,       k: 'self',   ct: 0, fx: { farsight: 2 }, jp: 100, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'stripBuffs', target: 'enemiesWithin', radius: 6, statuses: ['vanish'] }] }], tags: ['self', 'physical'], desc: 'Climb for a view: Farsight (2t) and every hidden foe within 6 hexes is revealed.' },
  radiant_bolt: { n: 'Radiant Bolt',    c: 2, m: 6, r: 3, k: 'dmg',    p: 8,  ct: 0, jp: 175, tags: ['damage', 'ranged', 'holy', 'spell'], desc: 'A plain bolt of light for 8 damage. The Acolyte\'s only real attack spell.' },
  soothing_circle:{ n: 'Soothing Circle', c: 2, m: 7, k: 'buff',       ct: 0, area: 'ring', self: 1, radius: 2, fx: { regen: [2, 3] }, cd: 3, selfFx: { regen: [2, 3] }, aiBonus: 3, jp: 175, tags: ['buff', 'area', 'holy', 'spell'], desc: 'A calm ring (radius 2): allies inside gain Regen (2 HP/turn, 3 turns).' },
  frost_nova:   { n: 'Frost Nova',      c: 2, m: 7, k: 'dmg',    p: 3,  ct: 0, area: 'ring', self: 1, radius: 1, fx: { slow: 1 }, cd: 2, aiBonus: 3, jp: 100, tags: ['damage', 'area', 'arcane', 'spell', 'debuff'], desc: 'A burst of cold around you: 3 damage and Slow (1t) to everything adjacent.' },
  flash_step:   { n: 'Flash Step',      c: 1, m: 4,       k: 'self',   ct: 0, cd: 3, jp: 175, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'awayFromTarget', anchor: 'nearestEnemy', target: 'self', hexes: 3 }] }], tags: ['self', 'arcane', 'spell', 'dash'], desc: 'Teleport up to 3 hexes away from the nearest enemy.' },
  // Tier 2
  shield_charge:{ n: 'Shield Charge',   c: 2, m: 4, r: 2, k: 'dmg',    p: 2,  ct: 0, stagger: 0, jp: 250, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'towardTarget', target: 'self', hexes: 2 }] }], tags: ['damage', 'melee', 'physical'], desc: 'Rush up to 2 hexes at a foe and strike it.' },
  war_cry:      { n: 'War Cry',         c: 2, m: 4, k: 'dmg',    p: 1,  ct: 0, area: 'ring', self: 1, radius: 2, fx: { wither: 1 }, cd: 4, jp: 400, tags: ['damage', 'area', 'physical', 'debuff'], desc: 'A roar that carries 2 hexes: foes in the ring are Withered (-30% damage, 1t).' },
  aegis_pulse:  { n: 'Aegis Pulse',     c: 2, m: 7, k: 'buff',       ct: 0, area: 'ring', self: 1, radius: 1, fx: { shield: 4 }, cd: 2, selfFx: { shield: 4 }, aiBonus: 4, jp: 150, tags: ['buff', 'area', 'holy', 'spell'], desc: 'Adjacent allies gain +4 shield.' },
  retribution_ward:{ n: 'Retribution Ward', c: 2, m: 7, r: 3, k: 'buff', ct: 0, fx: { thorns: 2, shield: 3 }, cd: 2, jp: 250, tags: ['buff', 'holy', 'spell'], desc: 'An ally gains Thorns (2t) and +3 shield: attackers are punished.' },
  battering_charge:{ n: 'Battering Charge', c: 3, m: 6, r: 1, k: 'dmg', p: 3, ct: 0, area: 'line', len: 3, cd: 3, aiBonus: 3, jp: 400, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], tags: ['damage', 'melee', 'area', 'physical'], desc: 'Drive a line of 3 hexes in front of you: everything is struck and shoved 1 hex.' },
  bastion_call: { n: 'Bastion Call',    c: 1, m: 2, r: 3, k: 'buff',         ct: 0, fx: { shield: 3 }, cd: 2, jp: 150, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'pull', target: 'target', hexes: 3 }] }], tags: ['buff', 'physical'], desc: 'Haul an ally in toward you (up to 3 hexes) and give them 3 shield.' },
  venom_coat:   { n: 'Venom Coat',      c: 1, m: 2,       k: 'self',   ct: 0, cd: 3, jp: 150, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'armInterrupt', on: 'onHit', label: 'Venom Coat', expires: 'ownTurnStart', effects: [{ type: 'applyStatus', target: 'victim', status: 'poison', payload: [2, 3] }] }] }], tags: ['self', 'physical', 'poison'], desc: 'Your next hit poisons (3 Poison/turn, 2 turns).' },
  cheap_shot: {"n":"Cheap Shot","c":2,"m":4,"r":1,"k":"dmg","p":3,"ct":0,"cd":3,"jp":400,"triggers":[{"on":"onHit","if":{"isFlanking":true},"effects":[{"type":"applyStatus","target":"victim","status":"stun","turns":1}]}],"tags":["damage","melee","physical"],"desc":"A dirty strike that Disarms the victim (no weapon skills, 1t). If you are flanking or came from stealth, the victim is also Stunned (1t).","fx":{"disarm":1}},
  whirlwind_kick:{ n: 'Whirlwind Kick', c: 3, m: 6, k: 'dmg',    p: 6,  ct: 0, area: 'ring', self: 1, radius: 1, jp: 250, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], tags: ['damage', 'melee', 'area', 'physical'], desc: 'Spin and strike everything adjacent, knocking each foe back 1 hex.' },
  tiger_pounce: { n: 'Tiger Pounce',    c: 2, m: 4, r: 1, k: 'dmg',    p: 2,  ct: 0, cd: 1, jp: 150, bonusIfMoved: 4, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'applyStatus', target: 'self', status: 'evasion', payload: 2 }] }], tags: ['damage', 'melee', 'physical'], desc: 'Pounce on an adjacent foe; +4 damage if you moved this turn. Your next incoming hit misses.' },
  death_defiance:{ n: 'Death Defiance', c: 1, m: 2,       k: 'self',   ct: 0, fx: { deathSave: 6 }, hpCostPct: 0.25, cd: 4, jp: 400, tags: ['self', 'physical'], desc: 'Pay 25% of your current HP: the next lethal hit leaves you on 6 HP instead (once).' },
  reaving_charge:{ n: 'Reaving Charge', c: 2, m: 4, r: 3, k: 'dmg',    p: 3,  ct: 0, fx: { bleed: [1, 2] }, jp: 250, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'towardTarget', target: 'self', hexes: 3 }] }], tags: ['damage', 'melee', 'physical', 'bleed'], desc: 'Charge up to 3 hexes, hit hard and leave a Bleed (2/turn, 1 turn).' },
  signal_arrow: {"n":"Signal Arrow","c":1,"m":2,"r":6,"k":"dmg","p":0,"ct":0,"revealsHidden":1,"cd":3,"jp":100,"triggers":[{"on":"onAbilityUsed","effects":[{"type":"stripBuffs","target":"target","statuses":["vanish"]}]}],"tags":["damage","ranged","physical"],"desc":"A flare-tipped arrow: the target is revealed even if hidden (1t)."},
  covering_fire:{ n: 'Covering Fire',   c: 2, m: 4, r: 5, k: 'dmg',    p: 2,  ct: 0, area: 'wall', fx: { slow: 1 }, cd: 3, jp: 250, tags: ['damage', 'ranged', 'area', 'physical'], desc: 'Rake a 3-hex wall with arrows: foes in it take damage and are Slowed (1t).' },
  disrupting_round:{ n: 'Disrupting Round', c: 2, m: 4, r: 5, k: 'dmg', p: 1, ct: 0, stagger: 25, cd: 2, jp: 250, tags: ['damage', 'ranged', 'physical', 'stagger'], desc: 'A rattling shot: 25 stagger, breaking any cast in progress.' },
  fall_back:    { n: 'Fall Back',       c: 1, m: 2,       k: 'self',   ct: 0, cd: 3, jp: 150, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'awayFromTarget', anchor: 'nearestEnemy', target: 'self', hexes: 2 }] }], tags: ['self', 'physical', 'dash'], desc: 'Scramble up to 2 hexes away from the nearest enemy.' },
  net_cast:     { n: 'Net Cast',        c: 2, m: 4, r: 3, k: 'debuff',       ct: 0, area: 'splash', radius: 1, fx: { root: 1 }, cd: 3, jp: 250, tags: ['debuff', 'ranged', 'area', 'physical'], desc: 'Hurl a weighted net: foes in a 1-hex burst are Rooted (1t).' },
  tripwire:     { n: 'Tripwire',        c: 2, m: 4, r: 4, k: 'trap',   p: 2,  ct: 0, area: 'line', len: 3, persist: 1, fx: { slow: 1 }, cd: 3, jp: 400, tags: ['damage', 'ranged', 'area', 'physical'], desc: 'Hide a 3-hex line of wire. Every foe that crosses it takes 2 damage and Slow (1t). It stays until recast.' },
  mercy:        { n: 'Mercy',           c: 1, m: 4, r: 3, k: 'heal',   p: 5,  ct: 0, cleanse: 2, jp: 100, tags: ['heal', 'holy', 'spell'], desc: 'Heal 5 and cleanse up to 2 negative statuses from an ally.' },
  circle_mending:{ n: 'Circle of Mending', c: 3, m: 11, k: 'heal', p: 8,  ct: 0, area: 'ring', self: 1, radius: 2, cd: 3, aiBonus: 4, jp: 400, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'heal', target: 'self', amount: 8 }] }], tags: ['heal', 'area', 'holy', 'spell'], desc: 'A wide healing ring (radius 2): every ally inside, you included, recovers 8.' },
  pass_no_trace:{ n: 'Pass Without Trace', c: 2, m: 7, r: 3, k: 'buff',    ct: 0, fx: { vanish: 1 }, cd: 3, jp: 250, tags: ['buff', 'nature', 'spell'], desc: 'The forest hides an ally: Vanished until they attack.' },
  thorn_whip:   { n: 'Thorn Whip',      c: 2, m: 7, r: 3, k: 'dmg',    p: 6,  ct: 0, area: 'line', len: 3, bonusVsStatus: { root: 3, pin: 3 }, jp: 150, tags: ['damage', 'ranged', 'area', 'nature', 'spell'], desc: 'Lash a line of thorns up to 3 hexes for 6 damage to everything in it, +3 against a Rooted or Pinned target.' },
  spirit_recall:{ n: 'Spirit Recall',   c: 1, m: 4, r: 4, k: 'buff',         ct: 0, cd: 3, jp: 100, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'pull', target: 'target', hexes: 3 }] }], tags: ['buff', 'spirit', 'spell'], desc: 'Call an ally back: they are pulled up to 3 hexes toward you.' },
  ward_breaker: { n: 'Ward Breaker',    c: 1, m: 4, r: 3, k: 'debuff',       ct: 0, cd: 2, jp: 250, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'stripBuffs', target: 'target', count: 2 }] }], tags: ['debuff', 'spirit', 'spell'], desc: 'Strip up to 2 positive statuses from an enemy.' },
  arcane_ward:  { n: 'Harvest',         c: 1, m: 0,       k: 'self',   ct: 0, cd: 3, jp: 100, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'gainMana', target: 'self', amount: 8 }] }], tags: ['self', 'arcane', 'spell'], desc: 'Draw power from the world around you: restore 8 mana.' },
  gravity_well: {"n":"Gravity Well","c":3,"m":11,"r":4,"k":"dmg","p":3,"ct":40,"area":"splash","radius":2,"cd":2,"jp":500,"triggers":[{"on":"onHit","effects":[{"type":"pull","target":"victim","hexes":2,"from":"aim"}]}],"tags":["damage","ranged","area","arcane","spell","debuff"],"desc":"A heavy cast: 3 damage in a 2-hex burst and every foe is dragged up to 2 hexes toward the centre, stopping against whoever is already there. Widen: bigger burst. Twin: pulls a second time.","widen":{"radius":3},"twin":"pull2"},
  mirror_ward: {"n":"Exhaust","c":1,"m":4,"r":3,"k":"debuff","ct":0,"fx":{"fatigue":1},"cd":2,"jp":100,"tags":["debuff","mind","spell"],"desc":"Drain a foe: it is Fatigued (1 fewer AP on its next turn)."},
  mind_fog:     { n: 'Mind Fog',        c: 2, m: 7, r: 3, k: 'debuff',       ct: 0, area: 'splash', fx: { fatigue: 1, slow: 1 }, cd: 3, aiBonus: 3, jp: 250, tags: ['debuff', 'area', 'mind', 'spell'], desc: 'A drowsing fog over a burst: foes are Fatigued (1 fewer AP next turn) and Slowed (1t).' },
  war_drums:    { n: 'War Drums',       c: 2, m: 7, k: 'buff',         ct: 0, area: 'all', self: 1, fx: { empowered: 2, haste: 1 }, cd: 3, jp: 400, tags: ['buff', 'area', 'song', 'spell'], desc: 'A pounding rhythm: every ally on the battlefield is Empowered (next hit +30%) and Hasted (1t).' },
  fickle_song:  { n: 'Fickle Refrain',  c: 3, m: 11, k: 'debuff',      ct: 0, area: 'all', self: 1, randomFx: [{ slow: 2 }, { wither: 2 }, { blind: 2 }, { silence: 1 }, { root: 1 }], cd: 3, aiBonus: 4, jp: 400, tags: ['debuff', 'area', 'song', 'spell'], desc: 'A tune that never repeats: every enemy on the battlefield suffers the same random effect: Slow (2t), Wither (2t), Blind (2t), Silence (1t) or Root (1t).' },
  // Tier 3
  dread_aura: {"n":"Dread Aura","c":2,"m":7,"k":"dmg","p":1,"ct":0,"area":"ring","self":1,"radius":2,"fx":{"fear":1},"cd":3,"jp":250,"tags":["damage","area","shadow","spell","debuff"],"desc":"Dread rolls out 2 hexes: foes take a little damage and are Feared (1t): they run from you and cannot act."},
  dragging_dark:{ n: 'Dragging Dark',   c: 3, m: 11, r: 4, k: 'dmg',   p: 3,  ct: 0, area: 'line', len: 4, cd: 3, aiBonus: 3, jp: 250, triggers: [{ on: 'onHit', effects: [{ type: 'pull', target: 'victim', hexes: 1 }] }], tags: ['damage', 'ranged', 'area', 'shadow', 'spell'], desc: 'A tide of shadow down a 4-hex line: each foe takes damage and is dragged 1 hex toward you.' },
  phase_cloak:  { n: 'Phase Cloak',     c: 1, m: 4,       k: 'self',   ct: 0, fx: { vanish: 1 }, charge: 1, cd: 3, jp: 150, tags: ['self', 'shadow', 'spell'], desc: 'Slip out of sight (Vanish) and bank +1 Charge.' },
  umbral_sweep: { n: 'Umbral Sweep',    c: 3, m: 11, r: 1, k: 'dmg',   p: 6,  ct: 0, area: 'arc', jp: 500, triggers: [{ on: 'onHit', effects: [{ type: 'gainCharge', target: 'self', amount: 1 }] }], tags: ['damage', 'melee', 'area', 'shadow', 'spell'], desc: 'A sweeping arc of shadow. You gain +1 Charge for every foe it hits.' },
  crushing_standard:{ n: 'Crushing Standard', c: 2, m: 4, r: 1, k: 'dmg', p: 5, ct: 0, area: 'arc', echo: { p: 2 }, jp: 325, triggers: [{ on: 'onAbilityUsed', if: { distinctAbilitiesThisTurn: 2 }, effects: [{ type: 'heal', target: 'alliesWithin', radius: 1, amount: 4 }] }], tags: ['damage', 'melee', 'area', 'physical'], desc: 'Swing the banner in an arc. Echo: if you used another skill this turn, +2 damage and adjacent allies recover 4 HP.' },
  inspire:      { n: 'Inspire',         c: 3, m: 11, k: 'buff',        ct: 0, area: 'ring', self: 1, radius: 2, fx: { empowered: 2 }, cd: 2, selfFx: { empowered: 2 }, jp: 500, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'heal', target: 'alliesWithin', radius: 2, amount: 4 }, { type: 'heal', target: 'self', amount: 4 }] }], tags: ['buff', 'area', 'song', 'spell'], desc: 'A rallying cry (radius 2): allies in range are Empowered (+30% next hit) and recover 4 HP.' },
  shadow_veil:  { n: 'Shadow Veil',     c: 2, m: 7, k: 'buff',         ct: 0, area: 'ring', self: 1, radius: 1, fx: { vanish: 1 }, cd: 4, selfFx: { vanish: 1 }, jp: 500, tags: ['buff', 'area', 'shadow', 'spell'], desc: 'Darkness wraps adjacent allies, hiding them until they attack.' },
  throwing_knives:{ n: 'Throwing Knives', c: 1, m: 2, r: 3, k: 'dmg',   p: 0,  ct: 0, fx: { bleed: [2, 2] }, wn: 1, jp: 100, tags: ['damage', 'ranged', 'physical', 'bleed'], desc: 'A quick knife: light damage and a Bleed (2/turn, 2 turns).' },
  harmony:      { n: 'Harmony',         c: 3, m: 11, r: 3, k: 'heal',   p: 7,  ct: 0, area: 'splash', radius: 2, cd: 3, jp: 500, triggers: [{ on: 'onHeal', effects: [{ type: 'gainMana', target: 'subject', amount: 3 }] }], tags: ['heal', 'area', 'song', 'spell'], desc: 'A chord that mends a wide area (radius 2): allies recover 7 HP and 3 mana.' },
  discordant_chord:{ n: 'Discordant Chord', c: 2, m: 7, k: 'dmg',  p: 6,  ct: 0, area: 'cone', self: 1, len: 3, fx: { silence: 1 }, cd: 2, aiBonus: 2, jp: 325, tags: ['damage', 'area', 'song', 'spell', 'debuff'], desc: 'A jarring blast in a 3-hex cone: damage and Silence (1t).' },
  blink_back:   { n: 'Blink Back',      c: 1, m: 4,       k: 'self',   ct: 0, cd: 3, jp: 325, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'awayFromTarget', anchor: 'nearestEnemy', target: 'self', hexes: 3 }] }], tags: ['self', 'arcane', 'spell', 'dash'], desc: 'Blink up to 3 hexes away from the nearest enemy.' },
  chrono_snare: { n: 'Chrono Snare',    c: 2, m: 7, r: 4, k: 'debuff',       ct: 0, area: 'splash', radius: 1, fx: { slow: 2 }, stagger: 15, cd: 3, jp: 325, tags: ['debuff', 'area', 'arcane', 'spell'], desc: 'Time clots in a 1-hex burst: foes are Slowed (2t) and lose 15 turn meter.' },
  smite_evil: {"n":"Smite Evil","c":3,"m":11,"r":1,"k":"dmg","p":9,"ct":0,"bonusPerNegative":4,"jp":325,"tags":["damage","melee","holy","spell"],"desc":"A heavy holy blow: +4 damage per negative status, and +8 more against a Judged target, which consumes the mark.","bonusVsStatus":{"judged":8},"consumeStatus":"judged"},
  aura_courage: { n: 'Aura of Courage', c: 2, m: 7, k: 'buff',         ct: 0, area: 'ring', self: 1, radius: 2, fx: { steeled: 2 }, cleanse: 1, cd: 3, selfFx: { steeled: 2 }, jp: 200, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'cleanse', target: 'self', count: 1 }] }], tags: ['buff', 'area', 'holy', 'spell'], desc: 'Allies in the ring (radius 2) shake off 1 negative status and are Steeled (-30% damage taken, 2t).' },
  crimson_chain:{ n: 'Crimson Chain',   c: 2, m: 4, r: 2, k: 'dmg',    p: 1,  ct: 0, fx: { bleed: [1, 2] }, cd: 4, jp: 325, triggers: [{ on: 'onHit', effects: [{ type: 'pull', target: 'victim', hexes: 1 }] }], tags: ['damage', 'melee', 'physical', 'bleed'], desc: 'A barbed chain (range 2): damage, a Bleed (2/turn, 1 turn) and a 1-hex yank toward you.' },
  sanguine_ward: {"n":"Blood Link","c":1,"m":2,"r":3,"k":"buff","ct":0,"fx":{"bloodthirst":2},"hpCostPct":0.15,"cd":2,"jp":200,"tags":["buff","physical"],"desc":"Pay 15% of your HP: an ally heals for 25% of the damage it deals for 2 turns."},
  vine_lash:    { n: 'Vine Lash',       c: 2, m: 7, r: 3, k: 'dmg',    p: 3,  ct: 0, fx: { root: 1 }, cd: 2, jp: 325, triggers: [{ on: 'onHit', effects: [{ type: 'pull', target: 'victim', hexes: 2 }] }], tags: ['damage', 'ranged', 'nature', 'spell'], desc: 'A thorned vine hauls a foe 2 hexes toward you and Roots it (1t).' },
  briar_bloom:  { n: 'Briar Bloom',     c: 3, m: 11, r: 3, k: 'trap',  p: 3,  ct: 0, area: 'star', len: 1, persist: 1, fx: { slow: 1 }, cd: 3, jp: 500, tags: ['damage', 'ranged', 'area', 'nature', 'spell'], desc: 'A hidden bed of thorns in a star (7 hexes). Anyone who steps in takes 3 damage and Slow (1t). It stays until recast.' },
  smoke_shell:  { n: 'Smoke Shell',     c: 2, m: 4, r: 5, k: 'debuff',       ct: 0, area: 'splash', radius: 2, fx: { blind: 1 }, cd: 3, aiBonus: 3, jp: 325, tags: ['debuff', 'ranged', 'area', 'physical'], desc: 'A smoke round bursts over 2 hexes: foes are Blinded (1t, -2 range).' },
  reload:       { n: 'Reload',          c: 1, m: 2,       k: 'self',   ct: 0, cd: 4, jp: 200, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'reduceCooldown', target: 'self', amount: 1 }] }], tags: ['self', 'physical'], desc: 'Take a breath: every one of your cooldowns drops by 1.' },
  skyward_leap: { n: 'Skyward Leap',    c: 1, m: 2,       k: 'move',   ct: 0, mv: 3, climbBonus: 3, cd: 2, jp: 200, tags: ['dash', 'physical'], desc: 'Spring up to 3 hexes, climbing 3 extra levels.' },
  cloud_step_shot:{ n: 'Cloud Step Shot', c: 2, m: 4, r: 5, k: 'dmg',  p: 3,  ct: 0, heightBonus: 2, cd: 2, jp: 325, triggers: [{ on: 'onHit', effects: [{ type: 'teleport', mode: 'awayFromTarget', target: 'self', hexes: 1 }] }], tags: ['damage', 'ranged', 'physical'], desc: 'A shot from above: +2 damage per level of height advantage, then step 1 hex away.' },
  camouflage:   { n: 'Camouflage',      c: 1, m: 2,       k: 'self',   ct: 0, fx: { vanish: 2 }, cd: 4, aiBonus: 3, jp: 200, tags: ['self', 'nature', 'physical'], desc: 'Melt into cover: Vanished until you attack.' },
  hunters_insight:{ n: "Hunter's Insight", c: 1, m: 2, r: 4, k: 'buff',    ct: 0, fx: { farsight: 2 }, cd: 3, jp: 325, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'stripBuffs', target: 'enemiesWithin', radius: 6, statuses: ['vanish'] }] }], tags: ['buff', 'nature', 'physical'], desc: 'Share your eye for tracks: an ally gains Farsight (2t) and hidden foes within 6 hexes are revealed.' },
  bestial_bond: { n: 'Bestial Bond',    c: 2, m: 4,       k: 'self',   ct: 0, cd: 3, jp: 325, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'heal', target: 'self', amount: 8 }, { type: 'heal', target: 'pet', amount: 8 }] }], tags: ['self', 'nature', 'spirit', 'pet'], desc: 'Share vitality with your Warder: you and it each recover 8.' },
  savage_pounce:{ n: 'Savage Pounce',   c: 2, m: 4, r: 4, k: 'dmg',    p: 5,  ct: 0, needsPet: 1, petStrike: { p: 4, teleport: 1 }, cd: 2, jp: 500, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'teleport', mode: 'towardTarget', target: 'self', hexes: 4 }] }], tags: ['damage', 'melee', 'physical', 'pet'], desc: 'Leap up to 4 hexes and strike; your Warder pounces in and bites for 4 too.' },
  serene_strike:{ n: 'Serene Strike',   c: 2, m: 4, r: 1, k: 'dmg',    p: 5,  ct: 0, jp: 325, triggers: [{ on: 'onHit', effects: [{ type: 'heal', target: 'woundedAlly', radius: 3, amount: 4 }] }], tags: ['damage', 'melee', 'physical', 'spirit'], desc: 'A calm, measured blow; the most wounded ally within 3 recovers 4.' },
  spirit_ward:  { n: 'Spirit Ward',     c: 1, m: 2,       k: 'heal',   p: 7,  ct: 0, cleanse: 1, cd: 2, jp: 200, tags: ['heal', 'spirit', 'physical'], desc: 'Recover 7 HP and cleanse 1 negative status from yourself.' },
  brand_penance:{ n: 'Brand of Penance', c: 2, m: 7, r: 3, k: 'debuff',      ct: 0, fx: { marked: 3 }, cd: 2, aiBonus: 6, jp: 325, tags: ['debuff', 'holy', 'spell'], desc: 'Burn a brand into a foe: Marked (3t), taking 25% more damage from everyone.' },
  cleansing_fire:{ n: 'Cleansing Fire', c: 3, m: 11, r: 4, k: 'dmg',   p: 8,  ct: 0, area: 'splash', radius: 1, fx: { burn: [2, 2] }, cd: 3, jp: 500, triggers: [{ on: 'onAbilityUsed', effects: [{ type: 'cleanse', target: 'alliesWithin', radius: 2, count: 1 }] }], tags: ['damage', 'ranged', 'area', 'holy', 'fire', 'spell'], desc: 'Holy flame bursts on foes (Burn 2/turn, 2 turns); allies within 2 of you are cleansed of 1 negative status.' },
  thunderclap:  { n: 'Thunderclap',     c: 2, m: 7, k: 'dmg',    p: 1,  ct: 0, area: 'ring', self: 1, radius: 2, stagger: 10, cd: 3, aiBonus: 3, jp: 325, triggers: [{ on: 'onHit', effects: [{ type: 'push', target: 'victim', hexes: 1 }] }], tags: ['damage', 'area', 'lightning', 'spell', 'stagger'], desc: 'A shockwave out to 2 hexes: foes are pushed 1 hex and lose 10 turn meter.' },
  storm_tap:    { n: 'Storm Tap',       c: 1, m: 4,       k: 'self',   ct: 0, charge: 1, cd: 2, jp: 200, tags: ['self', 'lightning', 'spell'], desc: 'Draw a spark of the storm: +1 Charge.' },
  reckless_stance: {"n":"Reckless Stance","c":1,"m":2,"k":"self","ct":0,"fx":{"reckless":2},"cd":3,"jp":200,"tags":["self","physical"],"desc":"Throw defence aside: deal 40% more damage and take 30% more for 2 turns. Counts as a debuff for Pain Is Power."},
  throw_caution: {"n":"Throw Caution","c":1,"m":2,"k":"self","ct":0,"fx":{"exposed":3,"empowered":2},"cd":2,"jp":300,"tags":["self","physical"],"desc":"Drop your guard for power: your next damaging skill deals +30%, but you are Exposed (-10% armor, 3 turns)."},
  ice_blast: {"n":"Ice Blast","c":2,"m":7,"r":4,"k":"dmg","p":7,"ct":0,"fx":{"chill":2},"widenSplash":1,"twin":"repeat","jp":250,"tags":["damage","ranged","frost","spell"],"desc":"A shard of ice: 7 damage and a Chill stack (-2 Speed each, 3 stacks pins). Widen splashes; Twin casts it again for 40% damage and a second Chill."},
  widen: {"n":"Widen","c":1,"m":0,"k":"self","ct":0,"cd":2,"fx":{"widen":1},"jp":200,"tags":["self","arcane"],"desc":"Metamagic: your next spell this turn has a wider area (Firebolt and Ice Blast splash, Lightning becomes a cone, Gravity Well grows)."},
  reach: {"n":"Reach","c":1,"m":0,"k":"self","ct":0,"cd":2,"fx":{"reach":1},"jp":200,"tags":["self","arcane"],"desc":"Metamagic: your next spell this turn gets +2 range."},
  twin: {"n":"Twin","c":1,"m":0,"k":"self","ct":0,"cd":2,"fx":{"twin":1},"jp":200,"tags":["self","arcane"],"desc":"Metamagic: your next spell this turn repeats (Firebolt and Ice Blast again for 40% with the full status, Lightning chains, Gravity Well pulls twice). No extra mana."},
  overwatch: {"n":"Overwatch","c":1,"m":2,"k":"self","ct":0,"cd":2,"jp":150,"triggers":[{"on":"onAbilityUsed","effects":[{"type":"armInterrupt","label":"overwatch","on":"onEnemyMoveNear","if":{"withinHexes":5,"subjectIsEnemy":true},"expires":"ownTurnStart","effects":[{"type":"damage","target":"subject","amount":8}]}]}],"tags":["self","ranged","physical"],"desc":"Until your next turn, the first enemy to move within 5 hexes takes 8 damage from a free shot."},
  condemn: {"n":"Condemn","c":1,"m":4,"r":3,"k":"dmg","p":2,"ct":0,"fx":{"judged":3},"cd":1,"jp":300,"tags":["damage","ranged","holy","spell"],"desc":"The only Judge: a holy bolt for a little damage that Judges the target (3 turns). Judged enemies take +2 holy damage from every hit."},
  zealous_charge: {"n":"Zealous Charge","c":2,"m":4,"r":4,"k":"dmg","p":2,"ct":0,"bonusVsStatus":{"judged":3},"jp":350,"triggers":[{"on":"onAbilityUsed","effects":[{"type":"teleport","mode":"towardTarget","target":"self","hexes":3}]}],"tags":["damage","melee","holy","physical"],"desc":"Rush up to 3 hexes at a foe and strike it (cd 2). +3 damage against a Judged target.","cd":2},
  righteous_wrath: {"n":"Righteous Wrath","c":1,"m":2,"k":"self","ct":0,"fx":{"wrath":2},"cd":2,"jp":300,"tags":["self","holy","spell"],"desc":"For 2 turns, a Judged enemy that hits you takes 4 holy damage."},
};
