/* Playable and summoned classes.
   Keys:
   name       display name
   command    secondary-slot label
   g          glyph shown on board / portraits
   role       tank | melee | ranged | healer | caster | support | entry | summon
   requires   class ids that must be MASTERED (every skill learned) before this class can be learned: entry classes need none, Tier 2 needs 1-2 entry classes, Tier 3 needs 2 Tier 2 classes (each Tier 2 class is used by exactly 2 Tier 3 classes; see tests/t30.js)
   tier       1 = entry, 2 = tier 2, 3 = tier 3 (balance target: entry lowest, tier 3 highest)
   hp         base max HP
   spd        turn-meter gain per tick
   mv         hexes per standard Move (2 AP)
   jump       max terrain height delta per step
   guard      AP cost to Guard (0 = free, null = cannot Guard)
   ab         array of ability IDs from data/abilities.js
   arch       caster | hybrid | martial  (sets the mana pool: combatRules.loadout.mana.pools)
   equip      { weapons: [families], offhand: [shield|book|relic], armor: [heavy|medium|light] } what this class may equip as PRIMARY (passives can unlock more)
   gear       default loadout { MainHand, OffHand, Head, Body } (item ids from gear.js); the game's presets and the simulator's default build
   innate     passive ids this class always has when it is the PRIMARY (they do not use a passive slot)
   selectable true for player/sim roster, false for summons
   signature  brief tactical summary
*/
window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.classes = {
  // ---- TIER 1: ENTRY CLASSES (4 abilities each) ----
  squire: {
    name: 'Squire', command: 'Basics', g: 'Sq', role: 'entry', tier: 1,
    hp: 42, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['slash', 'brace', 'rally', 'stone_toss', 'shield_bash', 'second_wind'],
    arch: 'martial',
    equip: { weapons: ['sword', 'mace', 'spear'], offhand: ['shield'], armor: ['medium'] },
    gear: { MainHand: 'iron_sword', OffHand: 'round_shield', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Balanced frontline trainee with shield bracing, ally speed rallies, and ranged pebble staggers.'
  },
  scout: {
    name: 'Scout', command: 'Skirmish', g: 'Sc', role: 'entry', tier: 1,
    hp: 25, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['quickstep', 'shortbow', 'expose', 'pocket_sand', 'hit_and_fade', 'mark_prey'],
    arch: 'martial',
    equip: { weapons: ['dagger', 'bow', 'handxbow', 'javelin'], offhand: [], armor: ['medium', 'light'] },
    gear: { MainHand: 'longbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Agile flanker using 1-AP dashes, blind/wither sand, and bow staggers.'
  },
  acolyte: {
    name: 'Acolyte', command: 'Prayer', g: 'Ac', role: 'entry', tier: 1,
    hp: 31, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['spirit_spark', 'salve', 'ward_light', 'chant', 'radiant_bolt', 'soothing_circle'],
    arch: 'caster',
    equip: { weapons: ['mace', 'staff', 'wand'], offhand: ['relic', 'book'], armor: ['light'] },
    gear: { MainHand: 'iron_mace', OffHand: 'holy_relic', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Support initiate blending direct salves, light wards, and haste chants.'
  },
  apprentice: {
    name: 'Apprentice', command: 'Cantrips', g: 'Ap', role: 'entry', tier: 1,
    hp: 23, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['spark', 'ember', 'chill', 'quick_cast', 'frost_nova', 'flash_step'],
    arch: 'caster',
    equip: { weapons: ['wand', 'staff', 'dagger'], offhand: ['book'], armor: ['light'] },
    gear: { MainHand: 'wand_fire', OffHand: 'spellbook', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Fast-casting novice chaining cheap elemental sparks, burns, and self-haste.'
  },

  // ---- TIER 2: TANKS (6 abilities each) ----
  warrior: {
    name: 'Warrior', command: 'Warfare', g: 'Wa', role: 'tank', tier: 2, requires: ['squire'],
    hp: 46, spd: 8, mv: 3, jump: 1, guard: 0,
    ab: ['pommel', 'cleave', 'bash', 'taunt', 'riposte', 'execute', 'shield_charge', 'war_cry'],
    arch: 'martial',
    equip: { weapons: ['sword', 'mace', 'greatsword', 'maul', 'spear', 'polearm', 'javelin'], offhand: ['shield'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_sword', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Aggressive bruiser who punishes attackers: free Guard counters, Riposte, arc cleaves, and armor-piercing finishers.'
  },
  sentinel: {
    name: 'Sentinel', command: 'Aegis', g: 'Se', role: 'tank', tier: 2, requires: ['squire', 'acolyte'],
    hp: 42, spd: 7, mv: 3, jump: 1, guard: 1,
    ab: ['rebuke', 'aegis', 'sanctuary', 'spellstrike', 'vigilant', 'judgment', 'aegis_pulse', 'retribution_ward'],
    arch: 'hybrid',
    equip: { weapons: ['sword', 'mace', 'wand'], offhand: ['shield', 'relic'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_sword', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Arcane-divine ward-bearer: projects barriers over the whole party and turns a well-shielded team into a radiant verdict.'
  },
  bulwark: {
    name: 'Bulwark', command: 'Bastion', g: 'Bu', role: 'tank', tier: 2, requires: ['squire', 'acolyte'],
    hp: 48, spd: 8, mv: 2, jump: 1, guard: 1,
    ab: ['slam', 'fortify', 'rampart_strike', 'hold', 'phalanx', 'crushing', 'battering_charge', 'bastion_call'],
    arch: 'martial',
    equip: { weapons: ['sword', 'mace', 'maul', 'greatsword', 'javelin'], offhand: ['shield'], armor: ['heavy'] },
    gear: { MainHand: 'iron_mace', OffHand: 'tower_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Immovable juggernaut: cannot be pushed, holds chokepoints with shields and taunts, and hammers harder the more shield it carries.'
  },

  // ---- TIER 2: MELEE (6 abilities each) ----
  rogue: {
    name: 'Rogue', command: 'Subtlety', g: 'Ro', role: 'melee', tier: 2, requires: ['scout', 'apprentice'],
    hp: 28, spd: 11, mv: 4, jump: 2, guard: 1,
    ab: ['jab', 'backstab', 'poison', 'vanish', 'slip', 'fan_knives', 'venom_coat', 'cheap_shot'],
    arch: 'martial',
    equip: { weapons: ['dagger', 'handxbow'], offhand: ['shield'], armor: ['medium', 'light'] },
    gear: { MainHand: 'steel_dagger', OffHand: 'buckler', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Stealth assassin: slips out of sight after a dash, then ambushes flanked targets with lingering venom.'
  },
  monk: {
    name: 'Monk', command: 'Martial', g: 'Mo', role: 'melee', tier: 2, requires: ['scout', 'acolyte'],
    hp: 30, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['palm', 'force_palm', 'chi_wave', 'chakra', 'flurry', 'wind_step', 'whirlwind_kick', 'tiger_pounce'],
    arch: 'martial',
    equip: { weapons: ['fist', 'staff'], offhand: [], armor: ['medium', 'light'] },
    gear: { MainHand: 'wraps', Head: 'chain_coif', Body: 'chain_hauberk' },
    innate: ['martial_arts'],
    selectable: true,
    signature: 'Hit-and-run striker: stagger palms, ki lines, and a flurry that hits harder when you move first.'
  },
  berserker: {
    name: 'Berserker', command: 'Frenzy', g: 'Be', role: 'melee', tier: 2, requires: ['squire', 'scout'], painPower: 2,   // Pain Is Power: +2 damage per debuff on himself
    hp: 38, spd: 9, mv: 3, jump: 1, guard: null,
    ab: ['axe', 'reckless_stance', 'reckless', 'rending', 'hemorrhage', 'exsanguinate', 'throw_caution', 'reaving_charge'],
    arch: 'martial',
    equip: { weapons: ['sword', 'mace', 'greatsword', 'maul', 'polearm'], offhand: [], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'greatsword', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Cannot Guard. Burns current HP to inflict heavy bleeds, unlock <50% HP Bloodied bonuses, and lifesteal back.'
  },

  // ---- TIER 2: RANGED (6 abilities each) ----
  archer: {
    name: 'Archer', command: 'Archery', g: 'Ar', role: 'ranged', tier: 2, requires: ['scout'],
    hp: 26, spd: 10, mv: 3, jump: 1, guard: 1,
    ab: ['quick', 'shoot', 'pin_shot', 'volley', 'longshot', 'arrow_storm', 'signal_arrow', 'covering_fire'],
    arch: 'martial',
    equip: { weapons: ['bow', 'crossbow', 'handxbow', 'dagger'], offhand: [], armor: ['medium', 'light'] },
    gear: { MainHand: 'longbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Mobile bow-master of volume: cheap cadences, longshots, and barrages that blanket a wide area.'
  },
  marksman: {
    name: 'Marksman', command: 'Sharpshoot', g: 'Ma', role: 'ranged', tier: 2, requires: ['squire', 'scout'],
    hp: 26, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['snap_shot', 'pierce_shot', 'cripple_shot', 'snipe', 'steady_aim', 'explosive', 'disrupting_round', 'overwatch'],
    arch: 'martial',
    equip: { weapons: ['crossbow', 'handxbow', 'bow', 'dagger'], offhand: ['shield'], armor: ['medium', 'heavy'] },
    gear: { MainHand: 'crossbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Deployed sniper: armor-piercing bolts that pierce through lines, and aimed shots that reward standing still.'
  },
  tracker: {
    name: 'Tracker', command: 'Survival', g: 'Tr', role: 'ranged', tier: 2, requires: ['scout', 'apprentice'],
    hp: 29, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['stalk', 'hunt_shot', 'viper', 'trap', 'caltrops', 'pred_mark', 'net_cast', 'tripwire'],
    arch: 'martial',
    equip: { weapons: ['bow', 'javelin', 'spear', 'dagger', 'handxbow'], offhand: ['shield'], armor: ['medium', 'light'] },
    gear: { MainHand: 'longbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Hunter of marked prey: a hidden Snare Trap and lingering Caltrops control the ground, Predator Mark makes a target take and suffer more.'
  },

  // ---- TIER 2: HEALERS (6 abilities each) ----
  cleric: {
    name: 'Cleric', command: 'Devotion', g: 'Cl', role: 'healer', tier: 2, requires: ['acolyte'],
    hp: 30, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['mend', 'heal', 'smite', 'radiant_surge', 'pray', 'holy_nova', 'mercy', 'circle_mending'],
    arch: 'caster',
    equip: { weapons: ['mace', 'staff', 'wand'], offhand: ['shield', 'relic', 'book'], armor: ['medium', 'light'] },
    gear: { MainHand: 'iron_mace', OffHand: 'holy_relic', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Devout priest of burst restoration: big single-target heals, extra power on the near-dead, and radiant smites.'
  },
  druid: {
    name: 'Druid', command: 'Nature', g: 'Dr', role: 'healer', tier: 2, requires: ['scout', 'acolyte'],
    hp: 32, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['rejuv', 'wild_growth', 'thorns', 'entangle', 'bloom', 'overgrowth', 'pass_no_trace', 'thorn_whip'],
    arch: 'caster',
    equip: { weapons: ['staff', 'wand', 'mace'], offhand: ['book', 'relic'], armor: ['light', 'medium'] },
    gear: { MainHand: 'staff_nature', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Grove keeper of healing over time: stacks regeneration, then blooms it all at once, while rooting foes in thorns.'
  },
  shaman: {
    name: 'Shaman', command: 'Spirits', g: 'Sh', role: 'healer', tier: 2, requires: ['acolyte', 'apprentice'],
    hp: 32, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['spirit_mend', 'warding_chant', 'plague', 'totem', 'chain_heal', 'earth_shock', 'spirit_recall', 'ward_breaker'],
    arch: 'caster',
    equip: { weapons: ['staff', 'mace', 'wand'], offhand: ['relic', 'shield', 'book'], armor: ['light', 'medium'] },
    gear: { MainHand: 'wand_nature', OffHand: 'warding_totem', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Ancestral mystic of shields: wards and totems blanket allies, with chain heals and seismic shocks to back it up.'
  },

  // ---- TIER 2: CASTERS & SUPPORT (6 abilities each) ----
  wizard: {
    name: 'Wizard', command: 'Arcana', g: 'Wi', role: 'caster', tier: 2, requires: ['apprentice'],
    hp: 25, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['fire', 'ice_blast', 'bolt', 'gravity_well', 'widen', 'reach', 'twin', 'arcane_ward'],
    arch: 'caster',
    equip: { weapons: ['wand', 'staff', 'dagger'], offhand: ['book'], armor: ['light'] },
    gear: { MainHand: 'staff_storm', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Elemental evoker unleashing chained lightning and heavy channeled arcane/meteor finishers.'
  },
  necro: {
    name: 'Necromancer', command: 'Necromancy', g: 'Ne', role: 'caster', tier: 2, requires: ['acolyte', 'apprentice'],
    hp: 26, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['drain', 'blight', 'skel', 'curse', 'dark_pact', 'soul_rend', 'raise_golem', 'raise_archer'],
    arch: 'caster',
    equip: { weapons: ['wand', 'staff', 'dagger', 'polearm'], offhand: ['book'], armor: ['light'] },
    gear: { MainHand: 'wand_shadow', OffHand: 'spellbook', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Death weaver sacrificing life force via Dark Pact to raise skeletons, rot clusters, and drain HP.'
  },
  enchanter: {
    name: 'Enchanter', command: 'Chronomancy', g: 'En', role: 'caster', tier: 2, requires: ['squire', 'apprentice'],
    hp: 27, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['mind_spike', 'lethargy', 'clarity', 'stasis', 'psychic_lash', 'confusion', 'mirror_ward', 'mind_fog'],
    arch: 'caster',
    equip: { weapons: ['wand', 'staff', 'dagger'], offhand: ['book'], armor: ['light'] },
    gear: { MainHand: 'wand_arcane', OffHand: 'tome_focus', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Mind and time manipulator dominating action economy with staggers, slows, stasis, and ally haste.'
  },
  bard: {
    name: 'Bard', command: 'Performance', g: 'Ba', role: 'support', tier: 2, requires: ['squire', 'apprentice'],
    hp: 28, spd: 11, mv: 4, jump: 1, guard: 1,
    ab: ['ballad', 'anthem', 'discord', 'dirge', 'encore', 'crescendo', 'war_drums', 'fickle_song'],
    arch: 'hybrid',
    equip: { weapons: ['instrument', 'sword', 'dagger', 'handxbow', 'wand'], offhand: [], armor: ['light', 'medium'] },
    gear: { MainHand: 'lute', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Fast battle minstrel shaping tempo with area songs, tempo shields, and sonic interrupts.'
  },

  // ---- TIER 3: HYBRID MASTER CLASSES (batch 1) ----
  shadowknight: {
    name: 'Shadowknight', command: 'Dread', g: 'Dk', role: 'tank', tier: 3, requires: ['warrior', 'necro'],
    hp: 48, spd: 7, mv: 2, jump: 1, guard: 1,
    ab: ['dark_grip', 'call_wraith', 'clinging_dark', 'dread_gaze', 'soul_leech', 'harm_touch', 'dread_aura', 'dragging_dark'],
    arch: 'hybrid',
    equip: { weapons: ['sword', 'greatsword', 'mace', 'maul', 'polearm'], offhand: ['shield', 'book'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_sword', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Unholy plate reaver pulling foes into melee, rotting them, and detonating the rot with Harm Touch.'
  },
  shadowmage: {
    name: 'Shadowmage', command: 'Umbra', g: 'Sm', role: 'melee', tier: 3, requires: ['rogue', 'wizard'],
    hp: 31, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['arcane_shiv', 'rift_step', 'blink_strike', 'umbral_ambush', 'rift_pulse', 'void_lance', 'phase_cloak', 'umbral_sweep'],
    arch: 'hybrid',
    equip: { weapons: ['dagger', 'sword', 'wand'], offhand: ['book'], armor: ['medium', 'light'] },
    gear: { MainHand: 'steel_dagger', OffHand: 'spellbook', Head: 'silk_hood', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Arcane nightblade building Charge with stabs and dashes, then spending it all in one strike.'
  },
  warlord: {
    name: 'Warlord', command: 'Banner', g: 'Wl', role: 'tank', tier: 3, requires: ['sentinel', 'bard'],
    hp: 46, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['command_strike', 'banner_slam', 'press_attack', 'rally_point', 'decisive_blow', 'overrun', 'crushing_standard', 'inspire'],
    arch: 'hybrid',
    equip: { weapons: ['sword', 'greatsword', 'polearm', 'spear', 'mace'], offhand: ['shield'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_sword', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Banner commander chaining different commands each turn for echo bonuses and repositioning allies.'
  },
  assassin: {
    name: 'Assassin', command: 'Lethality', g: 'As', role: 'melee', tier: 3, requires: ['rogue', 'archer'],
    hp: 34, spd: 11, mv: 4, jump: 2, guard: 1,
    ab: ['hidden_blade', 'shadowstep', 'eviscerate', 'garrote', 'smoke_bomb', 'headshot', 'shadow_veil', 'throwing_knives'],
    arch: 'martial',
    equip: { weapons: ['dagger', 'sword', 'katana', 'handxbow', 'javelin'], offhand: [], armor: ['medium', 'light'] },
    gear: { MainHand: 'steel_dagger', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Stealth executioner: Shadowsteps behind poisoned targets, garrotes flanked foes, and snipes from Vanish.'
  },
  songweaver: {
    name: 'Songweaver', command: 'Symphony', g: 'So', role: 'support', tier: 3, requires: ['bard', 'enchanter'],
    hp: 30, spd: 11, mv: 4, jump: 1, guard: 1,
    ab: ['motif', 'cleansing_verse', 'counterpoint', 'resonance', 'charm_song', 'grand_finale', 'harmony', 'discordant_chord'],
    arch: 'hybrid',
    equip: { weapons: ['instrument', 'wand', 'dagger', 'sword'], offhand: [], armor: ['light', 'medium'] },
    gear: { MainHand: 'lute', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Virtuoso chaining songs into echo bonuses, cleansing allies, and charming enemies.'
  },
  spellbow: {
    name: 'Spellbow', command: 'Arcanery', g: 'Sp', role: 'ranged', tier: 3, requires: ['marksman', 'enchanter'],
    hp: 26, spd: 10, mv: 3, jump: 1, guard: 1,
    ab: ['chrono_arrow', 'quicken', 'flicker_shot', 'mesmerize', 'temporal_swap', 'delay_shot', 'blink_back', 'chrono_snare'],
    arch: 'hybrid',
    equip: { weapons: ['bow', 'crossbow', 'handxbow'], offhand: [], armor: ['light', 'medium'] },
    gear: { MainHand: 'longbow', Head: 'silk_hood', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Chrono-arcane marksman stealing enemy turn meter, quickening allies, and shooting then blinking away.'
  },

  // ---- TIER 3: HYBRID MASTER CLASSES (batch 2) ----
  paladin: {
    name: 'Paladin', command: 'Chivalry', g: 'Pa', role: 'tank', tier: 3, requires: ['sentinel', 'cleric'],
    hp: 44, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['holy_strike', 'condemn', 'zealous_charge', 'consecrate', 'righteous_wrath', 'smite_evil', 'aura_courage', 'divine_interv'],
    arch: 'hybrid',
    equip: { weapons: ['sword', 'mace', 'greatsword', 'polearm', 'maul', 'spear'], offhand: ['shield', 'relic'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_mace', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Armored holy avenger: Condemn Judges one foe, every ally then hits it harder, and Smite Evil cashes the mark in. Punishes Judged enemies, heals nothing.'
  },
  blood_knight: {
    name: 'Blood Knight', command: 'Crimson', g: 'Bk', role: 'tank', tier: 3, requires: ['warrior', 'berserker'],
    hp: 42, spd: 9, mv: 3, jump: 1, guard: null,
    ab: ['crimson_aegis', 'sanguine_lance', 'crimson_tithe', 'bloodbath', 'crimson_reaping', 'last_stand', 'death_defiance', 'sanguine_ward'],
    arch: 'martial',
    equip: { weapons: ['sword', 'greatsword', 'mace', 'maul'], offhand: [], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'greatsword', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Crimson juggernaut that pays HP for barriers, steals shield from its victims, and hardens when Bloodied.'
  },
  warden: {
    name: 'Warden', command: 'Grove', g: 'Wd', role: 'tank', tier: 3, requires: ['bulwark', 'druid'],
    hp: 50, spd: 8, mv: 2, jump: 1, guard: 1,
    ab: ['knotted_fist', 'rootbind', 'barkskin', 'snaring_thicket', 'living_wall', 'earthshaker', 'vine_lash', 'briar_bloom'],
    arch: 'hybrid',
    equip: { weapons: ['mace', 'maul', 'spear', 'polearm', 'staff'], offhand: ['shield'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'iron_mace', OffHand: 'round_shield', Head: 'plate_helm', Body: 'plate_armor' },
    selectable: true,
    signature: 'Living-bark colossus: no healing, only roots, thorns, zone control and knockback.'
  },
  siegebreaker: {
    name: 'Siegebreaker', command: 'Ballistics', g: 'Sg', role: 'tank', tier: 3, requires: ['bulwark', 'marksman'],
    hp: 40, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['buckler_bolt', 'dig_in', 'breaching_shot', 'point_blank', 'counter_battery', 'bombardment', 'smoke_shell', 'reload'],
    arch: 'martial',
    equip: { weapons: ['crossbow', 'handxbow', 'mace', 'maul'], offhand: ['shield'], armor: ['heavy', 'medium'] },
    gear: { MainHand: 'crossbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Armored artilleryman who digs into siege stance, breaks barriers, and shells from range.'
  },
  zen_archer: {
    name: 'Zen Archer', command: 'Zenith', g: 'Za', role: 'ranged', tier: 3, requires: ['monk', 'archer'],
    hp: 31, spd: 11, mv: 4, jump: 2, guard: 1,
    ab: ['lofty_focus', 'wind_vault', 'gale_shot', 'flying_kick', 'heavens_descent', 'stillness_shot', 'skyward_leap', 'cloud_step_shot'],
    arch: 'martial',
    equip: { weapons: ['bow', 'spear', 'fist', 'staff'], offhand: [], armor: ['light', 'medium'] },
    gear: { MainHand: 'longbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Acrobatic cliff-runner rewarded for height: climbs where others cannot, kicks foes off ledges, and drops from above.'
  },
  ranger: {
    name: 'Ranger', command: 'Wilds', g: 'Rn', role: 'ranged', tier: 3, requires: ['tracker', 'druid'],
    hp: 32, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['cancel_magic', 'silencing_arrow', 'flush_out', 'call_of_flame', 'hawkeye_shot', 'hail_of_thorns', 'camouflage', 'hunters_insight'],
    arch: 'hybrid',
    equip: { weapons: ['bow', 'crossbow', 'dagger', 'sword', 'spear', 'javelin'], offhand: [], armor: ['medium', 'light'] },
    gear: { MainHand: 'longbow', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Wildland counter-caster: strips buffs, silences, flushes out stealth, and burns or bleeds from range.'
  },

  // ---- TIER 3: HYBRID MASTER CLASSES (batch 3) ----
  beastlord: {
    name: 'Beastlord', command: 'Feral', g: 'Bl', role: 'melee', tier: 3, requires: ['berserker', 'tracker'],
    hp: 36, spd: 9, mv: 4, jump: 2, guard: null,
    ab: ['call_warder', 'sic_em', 'feral_rend', 'tag_out', 'rampage_order', 'cannibalize', 'bestial_bond', 'savage_pounce'],
    arch: 'martial',
    equip: { weapons: ['sword', 'mace', 'greatsword', 'fist', 'polearm'], offhand: [], armor: ['medium', 'heavy'] },
    gear: { MainHand: 'claws', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Feral hunter who fights beside a Spirit Warder, commanding it to leap, flank and strike in unison.'
  },
  ascetic: {
    name: 'Ascetic', command: 'Spirit', g: 'Ae', role: 'support', tier: 3, requires: ['monk', 'cleric'],
    hp: 38, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['soul_palm', 'spirit_swap', 'spirit_tithe', 'spirit_veil', 'transference', 'dragon_palm', 'serene_strike', 'spirit_ward'],
    arch: 'hybrid',
    equip: { weapons: ['fist', 'staff', 'spear', 'instrument'], offhand: ['relic'], armor: ['light', 'medium'] },
    gear: { MainHand: 'wraps', OffHand: 'warding_totem', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Spirit monk who swaps, hides and mends allies through palm strikes rather than healing spells.'
  },
  inquisitor: {
    name: 'Inquisitor', command: 'Penance', g: 'Iq', role: 'healer', tier: 3, requires: ['shaman', 'necro'],
    hp: 31, spd: 8, mv: 3, jump: 1, guard: 1,
    ab: ['lash_penance', 'absolve', 'blood_offering', 'heretics_brand', 'scourge', 'exorcism', 'brand_penance', 'cleansing_fire'],
    arch: 'hybrid',
    equip: { weapons: ['mace', 'sword', 'staff', 'wand'], offhand: ['shield', 'relic', 'book'], armor: ['medium', 'light'] },
    gear: { MainHand: 'iron_mace', OffHand: 'holy_relic', Head: 'chain_coif', Body: 'chain_hauberk' },
    selectable: true,
    signature: 'Zealot who lifts afflictions off allies, hurls them at enemies, and pays blood to heal.'
  },
  stormcaller: {
    name: 'Stormcaller', command: 'Tempest', g: 'St', role: 'caster', tier: 3, requires: ['shaman', 'wizard'],
    hp: 29, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['static_field', 'gather_storm', 'thunder_mend', 'charged_ward', 'squall', 'tempest_surge', 'thunderclap', 'storm_tap'],
    arch: 'caster',
    equip: { weapons: ['staff', 'wand', 'mace'], offhand: ['relic', 'book'], armor: ['light', 'medium'] },
    gear: { MainHand: 'staff_storm', Head: 'silk_hood', Body: 'mystic_robe' },
    selectable: true,
    signature: 'Storm shaman whose banked Charge feeds heals and wards as readily as the final thunderclap.'
  },

  // ---- SUMMONS ----
  spirit_warder: {
    name: 'Spirit Warder', command: 'Spirit', g: 'Wr', role: 'summon',
    hp: 18, spd: 11, mv: 4, jump: 2, guard: 1,
    ab: ['spirit_bite'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false,
    signature: 'Agile spirit companion of Beastlords; flanks and bites on command.'
  },
  dread_wraith: {
    name: 'Dread Wraith', command: 'Spectral', g: 'Dw', role: 'summon',
    hp: 14, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['wraith_touch'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false,
    signature: 'Spectral skirmisher summoned by Shadowknights; its poison feeds Harm Touch.'
  },
  skeleton: {
    name: 'Skeleton', command: 'Undead', g: 'Sk', role: 'summon',
    hp: 24, spd: 9, mv: 3, jump: 1, guard: 1,
    ab: ['claw'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false,
    signature: 'Risen undead minion summoned by Necromancers.'
  },
  bone_golem: {
    name: 'Bone Golem', command: 'Undead', g: 'Bg', role: 'summon',
    hp: 28, spd: 6, mv: 2, jump: 1, guard: 1,
    ab: ['golem_slam', 'grave_bulwark'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false,
    signature: 'Hulking tank summoned by Necromancers; taunts and soaks hits.'
  },
  skeleton_archer: {
    name: 'Skeleton Archer', command: 'Undead', g: 'Sa', role: 'summon',
    hp: 12, spd: 10, mv: 3, jump: 1, guard: 1,
    ab: ['bone_arrow'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false,
    signature: 'Ranged skeleton summoned by Necromancers; fragile, shoots from behind.'
  },
  dire_wolf: {
    name: 'Dire Wolf', command: 'Beast', g: 'Wf', role: 'melee',
    hp: 26, spd: 12, mv: 5, jump: 2, guard: 1,
    ab: ['m_fang','m_howl'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'beast',
    traits: { powerMods: { '*': 1 },},
    signature: 'Pack hunter that runs down the wounded.'
  },
  cave_bear: {
    name: 'Cave Bear', command: 'Beast', g: 'Cb', role: 'melee',
    hp: 64, spd: 7, mv: 3, jump: 1, guard: 1,
    ab: ['m_maul','m_swipe'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'beast',
    traits: { powerMods: { '*': 6 }, ap: 1, armor: 15 },
    signature: 'Slow, hard-hitting brute with a thick hide.'
  },
  giant_spider: {
    name: 'Giant Spider', command: 'Beast', g: 'Sp', role: 'melee',
    hp: 40, spd: 10, mv: 4, jump: 3, guard: 1,
    ab: ['m_spit','m_web','m_fang'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'beast',
    traits: { powerMods: { '*': 5 }, elemRes: { fire: -25 } },
    signature: 'Webs foes and poisons them from range.'
  },
  ghoul: {
    name: 'Ghoul', command: 'Undead', g: 'Gh', role: 'melee',
    hp: 38, spd: 9, mv: 4, jump: 2, guard: 1,
    ab: ['m_rot_claw','m_fang'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'undead',
    traits: { powerMods: { '*': 3 }, elemRes: { holy: -35, shadow: 40 } },
    signature: 'Carrion-eater that rots its prey.'
  },
  banshee: {
    name: 'Banshee', command: 'Spirit', g: 'Bn', role: 'melee',
    hp: 26, spd: 11, mv: 4, jump: 4, guard: 1,
    ab: ['m_wail','m_drain'],
    arch: 'caster',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'undead',
    traits: { powerMods: { '*': 3 }, armor: 45, elemRes: { holy: -30, arcane: -20, shadow: 40 } },
    signature: 'Spirit that shrugs off blades but fears light.'
  },
  bone_archer: {
    name: 'Bone Archer', command: 'Undead', g: 'Ba', role: 'melee',
    hp: 26, spd: 9, mv: 3, jump: 2, guard: 1,
    ab: ['m_bone_hurl','m_fang'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'undead',
    traits: { powerMods: { '*': 3 }, rangedReduce: 20, elemRes: { holy: -25, shadow: 40 } },
    signature: 'Risen archer rattling with old arrows.'
  },
  fire_elemental: {
    name: 'Fire Elemental', command: 'Elemental', g: 'Fe', role: 'melee',
    hp: 44, spd: 10, mv: 4, jump: 2, guard: 1,
    ab: ['m_ember','m_flame_burst'],
    arch: 'caster',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'elemental',
    traits: { powerMods: { '*': 6 }, elemRes: { fire: 70, frost: -40, nature: -10 } },
    signature: 'Living flame; water and frost scatter it.'
  },
  stone_golem: {
    name: 'Stone Golem', command: 'Construct', g: 'Sg', role: 'melee',
    hp: 100, spd: 5, mv: 2, jump: 1, guard: 1,
    ab: ['m_slam','m_harden'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'elemental',
    traits: { powerMods: { '*': 8 }, ap: 2, armor: 40, rangedReduce: 25, pushImmune: true, elemRes: { lightning: -30, arcane: -25 } },
    signature: 'Slow, nigh-unstoppable guardian of ruins.'
  },
  storm_elemental: {
    name: 'Storm Elemental', command: 'Elemental', g: 'Se', role: 'melee',
    hp: 34, spd: 12, mv: 4, jump: 4, guard: 1,
    ab: ['m_spark','m_howl'],
    arch: 'caster',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'elemental',
    traits: { powerMods: { '*': 4 }, elemRes: { lightning: 70, nature: -30, arcane: -15 } },
    signature: 'Crackling storm-spirit; hits lines of foes.'
  },
  drake_whelp: {
    name: 'Drake Whelp', command: 'Dragonkin', g: 'Dr', role: 'melee',
    hp: 55, spd: 10, mv: 4, jump: 5, guard: 1,
    ab: ['m_fire_breath','m_fang','m_tail'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'dragon',
    traits: { powerMods: { '*': 5 }, ap: 1, armor: 15, elemRes: { fire: 40, frost: -30 } },
    signature: 'Young drake; breath and bite.'
  },
  basilisk: {
    name: 'Basilisk', command: 'Horror', g: 'Bs', role: 'melee',
    hp: 58, spd: 7, mv: 3, jump: 2, guard: 1,
    ab: ['m_gaze','m_fang','m_spit'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'dragon',
    traits: { powerMods: { '*': 7 }, ap: 1, armor: 20, elemRes: { nature: 30, mind: 30 } },
    signature: 'Stone-eyed lurker whose gaze slows and withers.'
  },
  maw_horror: {
    name: 'Maw Horror', command: 'Horror', g: 'Mh', role: 'melee',
    hp: 55, spd: 8, mv: 3, jump: 2, guard: 1,
    ab: ['m_maul','m_gaze','m_regrow'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'dragon',
    traits: { powerMods: { '*': 4 }, ap: 1, elemRes: { mind: 60, holy: -20 } },
    signature: 'Gibbering thing from the deep places; regrows.'
  },
  elder_drake: {
    name: 'Elder Drake', command: 'Dragonkin', g: 'Ed', role: 'melee',
    hp: 200, spd: 8, mv: 4, jump: 5, guard: 2,
    ab: ['m_fire_breath','m_tail','m_maul','m_howl'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'dragon', boss: true,
    traits: { powerMods: { '*': 9 }, ap: 3, armor: 25, rangedReduce: 10, elemRes: { fire: 60, frost: -30, lightning: -10 } },
    signature: 'Ancient drake; a boss-grade terror.'
  },
  barrow_king: {
    name: 'Barrow King', command: 'Undead', g: 'Bk', role: 'melee',
    hp: 170, spd: 7, mv: 3, jump: 2, guard: 2,
    ab: ['m_rot_claw','m_drain','m_wail','m_slam'],
    arch: 'martial',
    equip: { weapons: [], offhand: [], armor: [] },
    selectable: false, monster: true, family: 'undead', boss: true,
    traits: { powerMods: { '*': 8 }, ap: 2, armor: 20, elemRes: { holy: -35, shadow: 60 } },
    signature: 'A crowned dead lord who will not stay buried.'
  }
};
