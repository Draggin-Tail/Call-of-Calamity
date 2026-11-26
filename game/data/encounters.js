/* Encounters, choices, foe sets, patrols, starts, events, zones and dungeons.
   Part of the campaign data, split out of campaign.js. Load order: regions, places, roads_gen, encounters, campaign.
   Each part adds to a shared object; campaign.js loads last and publishes it as window.GAME_CAMPAIGN. */
(function () {
  const P = window.__CAMPAIGN_PARTS, C = P.C, nodeState = P.nodeState;
  const G = () => window.GAME_DATA, S = () => window.GAME_SAVE, LO = () => window.GAME_LOADOUT;
  C.ENCOUNTERS = {
    bandit_ford: { name: 'Bandit Ford', map: 'bandit_ford', rec: 2, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Ford Archer' }, { primary: 'apprentice', name: 'Hedge Mage' }],
      reward: { xp: 70, gold: 60 } },
    iceflow_ambush: { name: 'Iceflow Ambush', map: 'iceflow_ambush', rec: 3, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'rogue', name: 'Road Knife' }, { primary: 'scout', name: 'Snow Archer' }, { primary: 'squire', name: 'Brigand' }],
      objective: { type: 'survive', turns: 5 },
      reward: { xp: 90, gold: 50, items: { vigor_ring: 1 } } },
    marches_defence: { name: 'Raiders at the Marches', map: 'marches_defence', rec: 5, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Raider Captain' }, { primary: 'archer', name: 'Raider Bowman' }, { primary: 'rogue', name: 'Raider Knife' }],
      objective: { type: 'hold', zone: 'centre', size: 2, turns: 3, limit: 10, label: 'Hold the gate' },
      reward: { xp: 120, gold: 90 } },
    felled_grove: { name: 'Felled Grove', map: 'felled_grove', rec: 6, once: true,
      options: [
        { id: 'help_crown', label: 'Escort the loggers (fight the Wardens)', enemyFaction: 'canopy', standing: { crown: 40, canopy: -20 },
          enemies: [{ primary: 'tracker', name: 'Warden Tracker' }, { primary: 'druid', name: 'Warden Druid' }, { primary: 'scout', name: 'Warden Scout' }], reward: { xp: 130, gold: 80 } },
        { id: 'help_wardens', label: 'Stop the loggers (fight the Crown)', enemyFaction: 'crown', standing: { canopy: 40, crown: -20 },
          enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }], reward: { xp: 130, gold: 40, items: { traveler_boots: 1 } } }
      ] },
    vane_smugglers: { name: 'Port Vane Smugglers', map: 'vane_smugglers', rec: 5, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'rogue', name: 'Cutpurse' }, { primary: 'rogue', name: 'Knife Hand' }, { primary: 'shaman', name: 'Hex Dealer' }],
      objective: { type: 'leader', leader: 2 },
      reward: { xp: 120, gold: 100 } },
    forge_trial: { name: 'Forge Trial', map: 'forge_trial', rec: 7, enemyFaction: 'anvil', once: true,
      enemies: [{ primary: 'bulwark', name: 'Guild Shieldhand' }, { primary: 'marksman', name: 'Guild Sapper' }, { primary: 'cleric', name: 'Guild Medic' }],
      objective: { type: 'reach', zone: 'centre', size: 1, limit: 10, label: 'Reach the forge crown' },
      reward: { xp: 140, gold: 70, items: { crossbow: 1 } } }
  };

  C.CHOICES = {
    mine_collapse: { text: 'Rubble blocks the collapsed gallery. Somewhere behind it are six miners nobody expects to see again.\n\nIronbound clansmen stand with lamps and want it sealed today, as a grave, with the old words said over it. The Anvil Guild\'s engineers have brought picks, and point out that the richest seam in Deepdelve runs right through it.',
      options: [
        { id: 'seal', label: 'Help the clans seal it as a grave', hint: 'The Ironbound will remember. The Guild loses its seam.', standing: { ironbound: 60, anvil: -30 }, flag: 'gallery_sealed' },
        { id: 'dig', label: 'Help the engineers dig through', hint: 'Guild coin, and a share. The clans will call it grave-robbing.', standing: { anvil: 60, ironbound: -40 }, gold: 80, flag: 'gallery_dug', relations: [['ironbound', 'anvil', -0.15, true]] },
        { id: 'leave', label: 'Leave them to argue', hint: 'Neither side thanks you.', flag: 'gallery_ignored' }
      ] }
  };

  // More story fights, one or two per region, at rising levels. All are once-only; the road itself adds random ones (see rollWander).
  Object.assign(C.ENCOUNTERS, {
    heartwood_poachers: { name: 'Heartwood Poachers', map: 'heartwood_poachers', rec: 2, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'scout', name: 'Snare Setter' }, { primary: 'rogue', name: 'Skinner' }],
      reward: { xp: 70, gold: 50 } },
    hollow_deep: { name: 'Hollow Deep', map: 'hollow_deep', rec: 3, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Delve Chief' }, { primary: 'rogue', name: 'Tunnel Rat' }, { primary: 'acolyte', name: 'Delve Witch' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 85, gold: 60, items: { chain_coif: 1 } } },
    thornfield_camp: { name: 'Thornfield Raider Camp', map: 'thornfield_camp', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'squire', name: 'Raider' }, { primary: 'archer', name: 'Raider Bowman' }, { primary: 'rogue', name: 'Raider Knife' }],
      objective: { type: 'reach', zone: 'enemy_camp', limit: 9, label: 'Storm the camp' },
      reward: { xp: 100, gold: 70 } },
    river_watch: { name: 'River Watch Standoff', map: 'river_watch', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'warrior', name: 'Mutiny Sergeant' }, { primary: 'archer', name: 'Watch Bowman' }, { primary: 'squire', name: 'Mutineer' }],
      objective: { type: 'survive', turns: 4 },
      reward: { xp: 105, gold: 60 } },
    mosswood_camp: { name: 'Mosswood Camp', map: 'mosswood_camp', rec: 4, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'tracker', name: 'Poacher Captain' }, { primary: 'rogue', name: 'Fence' }, { primary: 'scout', name: 'Lookout' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 110, gold: 80, items: { longbow: 1 } } },
    ashen_obelisk: { name: 'Ashen Obelisk', map: 'ashen_obelisk', rec: 8, enemyFaction: 'outlaws', once: true,
      enemies: [{ primary: 'wizard', name: 'Renegade Adept' }, { primary: 'cleric', name: 'Fallen Warden' }, { primary: 'rogue', name: 'Obelisk Cutthroat' }],
      objective: { type: 'leader', leader: 0 },
      reward: { xp: 160, gold: 110, items: { staff_arcane: 1 } } }
  });

  // Road events: a short scene with options, met while travelling (never a repeat of the last one). once: true = can only ever happen once.
  // Option fields: standing, gold (negative = you pay), items, flag, relations, reveal (learn the roads nearby), fight (it becomes a battle).
  Object.assign(C.CHOICES, {
    old_milestone: { text: 'A Syndicate caravan has lost a wheel and jammed the whole junction. Its factor wants it moving before dark.\n\nA Crown tax-man has planted himself in front of the lead wagon. Its seals are "irregular", he says, and he means to impound the lot. Both of them look at you as if you might settle it.',
      options: [
        { id: 'help_factor', label: 'Help the factor get it moving', hint: 'The Syndicate pays and remembers. The tax-man will report you.', standing: { syndicate: 40, crown: -20 }, gold: 40 },
        { id: 'help_taxman', label: 'Stand with the tax-man', hint: 'The Crown will note it. The factor writes your name down.', standing: { crown: 40, syndicate: -20 } },
        { id: 'leave', label: 'Walk around them', hint: 'Nobody thanks you. Nobody blames you.' }
      ] },
    whispering_glade: { text: 'Wardens have caught a human surveyor with a chain and a map of their shrine. He is very frightened.\n\n"The Crown only wants to know where not to cut," he says. The Wardens have heard that before, from the men who came back with axes.',
      options: [
        { id: 'vouch', label: 'Vouch for him', hint: 'The Crown will be grateful. The Wardens will not forget it.', standing: { crown: 30, canopy: -30 } },
        { id: 'hand_over', label: 'Let the Wardens have him', hint: 'The Canopy approves. The Crown loses a man and blames you.', standing: { canopy: 40, crown: -20 } },
        { id: 'quiet', label: 'Pay for his release, quietly (50 gold)', hint: 'Nobody is pleased, and nobody is angry.', gold: -50, standing: { canopy: 10, crown: 10 } }
      ] },
    road_hurt_trader: { road: true, text: 'A merchant sits against a broken wheel with his goods scattered across the road. There is blood on his sleeve. His hired guards ran at the first arrow and took the horse.\n\n"The Syndicate will make it good," he says faintly. "Probably."',
      options: [
        { id: 'help', label: 'Bind him up and mend the wheel (30 gold of supplies)', hint: 'Costs you supplies. Syndicate traders hear of kindness.', gold: -30, standing: { syndicate: 15 } },
        { id: 'rob', label: 'Go through the cart while he watches', hint: 'Easy coin. The Syndicate looks after its own.', gold: 45, standing: { syndicate: -20 } },
        { id: 'leave', label: 'Walk on' }
      ] },
    road_toll: { road: true, regions: ['crownlands', 'free_marches', 'iceflow'], text: 'A lone Crown tax-collector has strung a rope across the road and set a stool beside it. He has a ledger, a seal and a very tired horse.\n\n"Road toll," he says. "It keeps the bridges up. Some of them."',
      options: [
        { id: 'pay', label: 'Pay the toll (40 gold)', hint: 'The Crown counts it in your favour.', gold: -40, standing: { crown: 10 } },
        { id: 'argue', label: 'Argue that the toll is not lawful here', hint: 'He lets you through, and writes your name down.', standing: { crown: -5 } },
        { id: 'fight', label: 'Cut the rope and see who follows', hint: 'A fight, and the Crown hears of it.', standing: { crown: -15 }, fight: true }
      ] },
    road_pilgrim: { road: true, regions: ['voldun', 'crownlands'], text: 'A Synod pilgrim sits on a milestone with an empty water-skin and a blistered foot. She lost the road two days ago and has been praying about it since.\n\n"I would take an escort to the next village," she says, "or a direction, or a miracle. Whichever you have."',
      options: [
        { id: 'escort', label: 'Walk her to the village', hint: 'A day out of your way. The Synod hears of it.', standing: { synod: 25 } },
        { id: 'water', label: 'Give her water and point the way (10 gold)', hint: 'A small kindness, quickly done.', gold: -10, standing: { synod: 10 } },
        { id: 'leave', label: 'Wish her luck and go on', hint: 'She will be all right. Probably.' }
      ] },
    road_hunter: { road: true, regions: ['elven_realms'], text: 'A Warden hunter is caught in a poacher\'s snare, bleeding from the leg. She has cut herself half free.\n\n"Human snares, on our side of the stones," she says through her teeth. "Someone has to tell the watch."',
      options: [
        { id: 'help', label: 'Bind the wound and carry her word', hint: 'The Wardens will hear you helped.', standing: { canopy: 25 } },
        { id: 'pay', label: 'Help her, for a price (66 gold)', hint: 'She pays, and remembers that you asked.', gold: 30, standing: { canopy: -10 } },
        { id: 'leave', label: 'Leave her to it', hint: 'Not your quarrel. Not yet.' }
      ] },
    road_prospector: { road: true, regions: ['dwarven_holds', 'iceflow'], text: 'A prospector pushes a cart of odd blue ore that glows faintly under its tarp. He keeps looking over his shoulder.\n\n"A share if you see me to market," he says. "The Guild wants it. The clans say it should stay in the mountain."',
      options: [
        { id: 'guard', label: 'Guard him to market', hint: 'Coin for you. The clans like it kept honest.', gold: 40, standing: { ironbound: 10 } },
        { id: 'buy', label: 'Buy a sample for the Guild (25 gold)', hint: 'The Anvil Guild pays attention to people who bring it samples.', gold: -25, standing: { anvil: 10 } },
        { id: 'leave', label: 'Decline', hint: 'His trouble stays his.' }
      ] },
    road_rumour: { road: true, text: 'A peddler at a roadside fire is roasting something that might have been a rabbit. He says he knows every path within three days of here.\n\n"Every path," he says. "For a price. For nothing, I know one."',
      options: [
        { id: 'buy', label: 'Pay for the paths (30 gold)', hint: 'Several places go on your map.', gold: -30, reveal: true },
        { id: 'listen', label: 'Sit and listen for free', hint: 'He lets one thing slip. Only one.', revealNear: 1 },
        { id: 'leave', label: 'No thanks' }
      ] },
    road_deserters: { road: true, text: 'Five armed men step out of the trees and spread across the road. Their coats used to be uniforms.\n\n"Safe passage," their leader says, "for a small fee. It is a dangerous road. We should know."',
      options: [
        { id: 'pay', label: 'Pay them (50 gold)', hint: 'It costs you, and nobody gets hurt.', gold: -50 },
        { id: 'fight', label: 'Refuse', hint: 'A fight.', fight: true },
        { id: 'intimidate', label: 'Stare them down (needs a full party of three)', hint: 'With three of you, they may think better of it.', stare: true }
      ] },
    road_shrine: { road: true, once: true, text: 'A roadside shrine has gone to moss. Nobody has tended it in years, but people still leave coins, and the bowl is full.\n\nA crow on the roof watches you look at it.',
      options: [
        { id: 'take', label: 'Take the coins', hint: 'Easy coin. The pious notice that kind of thing.', gold: 35, standing: { synod: -10, canopy: -10 } },
        { id: 'tend', label: 'Sweep it clean and leave a coin (10 gold)', hint: 'The Synod and the Wardens both like a shrine kept.', gold: -10, standing: { synod: 10, canopy: 10 } },
        { id: 'leave', label: 'Leave it be' }
      ] }
  });

  // Enemy parties met on the road. Level is set by the party; minLv/maxLv pick what fits, regions: null = anywhere.
  C.FOE_SETS = [
    { id: 'bandits', name: 'Road bandits', faction: 'outlaws', minLv: 1, maxLv: 7, regions: null,
      enemies: [{ primary: 'rogue', name: 'Highwayman' }, { primary: 'scout', name: 'Bandit Archer' }, { primary: 'squire', name: 'Cutthroat' }] },
    { id: 'deserters', name: 'Deserters', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['crownlands', 'free_marches', 'river_cities', 'iceflow'],
      enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Deserter Bowman' }] },
    { id: 'hedge', name: 'Hedge mages', faction: 'outlaws', minLv: 2, maxLv: 8, regions: null,
      enemies: [{ primary: 'apprentice', name: 'Hedge Mage' }, { primary: 'apprentice', name: 'Hedge Mage' }, { primary: 'acolyte', name: 'Hedge Priest' }] },
    { id: 'poachers', name: 'Poachers', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['elven_realms', 'free_marches', 'river_cities'],
      enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'scout', name: 'Poacher' }, { primary: 'rogue', name: 'Skinner' }] },
    { id: 'scavengers', name: 'Delve scavengers', faction: 'outlaws', minLv: 1, maxLv: 8, regions: ['dwarven_holds', 'iceflow'],
      enemies: [{ primary: 'squire', name: 'Scavenger' }, { primary: 'scout', name: 'Scavenger Slinger' }, { primary: 'apprentice', name: 'Tinker' }] },
    { id: 'smugglers', name: 'Smugglers', faction: 'outlaws', minLv: 3, maxLv: 10, regions: ['river_cities', 'elven_realms'],
      enemies: [{ primary: 'rogue', name: 'Smuggler' }, { primary: 'archer', name: 'Dock Sniper' }, { primary: 'shaman', name: 'Fence' }] },
    { id: 'brigands', name: 'Brigand band', faction: 'outlaws', minLv: 5, maxLv: 50, regions: null,
      enemies: [{ primary: 'warrior', name: 'Brigand Chief' }, { primary: 'archer', name: 'Brigand Bowman' }, { primary: 'rogue', name: 'Brigand Knife' }] },
    { id: 'cultists', name: 'Cultists', faction: 'outlaws', minLv: 4, maxLv: 50, regions: ['voldun', 'crownlands'],
      enemies: [{ primary: 'wizard', name: 'Cult Adept' }, { primary: 'cleric', name: 'Cult Preacher' }, { primary: 'acolyte', name: 'Cult Initiate' }] },
    { id: 'mercs', name: 'Sellsword company', faction: 'outlaws', minLv: 7, maxLv: 50, regions: null,
      enemies: [{ primary: 'bulwark', name: 'Sellsword Shield' }, { primary: 'marksman', name: 'Sellsword Gun' }, { primary: 'warrior', name: 'Sellsword Captain' }] }
  ];

  // Monsters (non-humanoid). faction 'wild'; zones = the wild places where they den (picked far more often there); anywhere else they are rare.
  // `lore` ties a set to the bestiary (C.BEASTS below). Humans' attitudes to them (hunt, tame, worship) are in C.MONSTER_FACTIONS.
  Object.assign(C, { MONSTER_SETS: [
    { id: 'm_wolves', name: 'Dire wolf pack', faction: 'wild', monster: true, minLv: 1, maxLv: 7, regions: null, zones: ['elk_meadow', 'dewfall_glade', 'greycrown_peak', 'mist_trail', 'reed_marsh', 'elderwood', 'lowmeadows', 'greatwood', 'brazier_peak', 'giants_tooth', 'frostmarch', 'golden_reach', 'ashfall_reach', 'obsidian_terraces', 'muster_field', 'hollow_fields', 'hungry_mile', 'long_stair', 'molten_run', 'gallows_hill', 'last_cairn', 'warbanner_hill', 'cooling_fields', 'ash_stair', 'signal_tower', 'beacon_hill', 'snowmelt_tarn', 'glass_hollow'],
      enemies: [{ primary: 'dire_wolf', name: 'Dire Wolf' }, { primary: 'dire_wolf', name: 'Dire Wolf' }, { primary: 'dire_wolf', name: 'Pack Leader' }] },
    { id: 'm_bear', name: 'Cave bear', faction: 'wild', monster: true, minLv: 3, maxLv: 10, regions: null, zones: ['dewfall_glade', 'snowmelt_tarn', 'greycrown_peak', 'elk_meadow', 'elderwood', 'lowmeadows', 'greatwood', 'giants_tooth', 'frostmarch', 'golden_reach'],
      enemies: [{ primary: 'cave_bear', name: 'Cave Bear' }, { primary: 'dire_wolf', name: 'Hungry Wolf' }] },
    { id: 'm_spiders', name: 'Webspinners', faction: 'wild', monster: true, minLv: 2, maxLv: 9, regions: null, zones: ['glass_hollow', 'mist_trail', 'leech_ford', 'elderwood', 'greatwood', 'mirefen', 'saltmere', 'fogwater', 'quicklime_pits', 'rotwood', 'the_sump', 'bone_bridge', 'pyre_field', 'vent_of_the_dead', 'bargemans_cairn', 'ember_gallery', 'sulphur_springs'],
      enemies: [{ primary: 'giant_spider', name: 'Giant Spider' }, { primary: 'giant_spider', name: 'Giant Spider' }] },
    { id: 'm_ghouls', name: 'Ghoul pack', faction: 'wild', monster: true, minLv: 3, maxLv: 11, regions: null, zones: ['gallows_hill', 'bone_bridge', 'last_cairn', 'warbanner_hill', 'muster_field', 'hollow_fields', 'hungry_mile', 'quicklime_pits', 'the_sump', 'pyre_field', 'bargemans_cairn'],
      enemies: [{ primary: 'ghoul', name: 'Ghoul' }, { primary: 'ghoul', name: 'Ghoul' }, { primary: 'bone_archer', name: 'Grave Archer' }] },
    { id: 'm_restless', name: 'Restless dead', faction: 'wild', monster: true, minLv: 5, maxLv: 16, regions: null, zones: ['last_cairn', 'pyre_field', 'vent_of_the_dead', 'bone_bridge', 'bargemans_cairn', 'lowmeadows', 'saltmere', 'fogwater', 'muster_field', 'hollow_fields', 'hungry_mile', 'quicklime_pits', 'rotwood', 'gallows_hill', 'warbanner_hill', 'leech_ford', 'mist_trail'],
      enemies: [{ primary: 'banshee', name: 'Banshee' }, { primary: 'bone_archer', name: 'Barrow Archer' }, { primary: 'ghoul', name: 'Barrow Ghoul' }] },
    { id: 'm_embers', name: 'Embers loose', faction: 'wild', monster: true, minLv: 4, maxLv: 14, regions: null, zones: ['ember_gallery', 'vent_of_the_dead', 'cooling_fields', 'sulphur_springs', 'ash_stair', 'ashfall_reach', 'molten_run'],
      enemies: [{ primary: 'fire_elemental', name: 'Ember Elemental' }, { primary: 'fire_elemental', name: 'Ember Elemental' }] },
    { id: 'm_storm', name: 'Storm-spirits', faction: 'wild', monster: true, minLv: 5, maxLv: 14, regions: null, zones: ['signal_tower', 'beacon_hill', 'greycrown_peak', 'brazier_peak', 'giants_tooth', 'frostmarch', 'long_stair'],
      enemies: [{ primary: 'storm_elemental', name: 'Storm Elemental' }, { primary: 'storm_elemental', name: 'Storm Elemental' }] },
    { id: 'm_golem', name: 'Waking guardian', faction: 'wild', monster: true, minLv: 6, maxLv: 50, regions: null, zones: ['ember_gallery', 'signal_tower', 'ash_stair', 'warbanner_hill', 'brazier_peak', 'giants_tooth', 'obsidian_terraces', 'long_stair', 'beacon_hill', 'elk_meadow'],
      enemies: [{ primary: 'stone_golem', name: 'Stone Guardian' }] },
    { id: 'm_drake', name: 'Drake hunting', faction: 'wild', monster: true, minLv: 8, maxLv: 50, regions: null, zones: ['ash_stair', 'vent_of_the_dead', 'cooling_fields', 'greycrown_peak', 'reed_marsh', 'brazier_peak', 'frostmarch', 'ashfall_reach', 'obsidian_terraces', 'molten_run', 'last_cairn', 'sulphur_springs', 'snowmelt_tarn'],
      enemies: [{ primary: 'drake_whelp', name: 'Ash Drake' }, { primary: 'drake_whelp', name: 'Ash Drake' }] },
    { id: 'm_basilisk', name: 'Basilisk', faction: 'wild', monster: true, minLv: 6, maxLv: 50, regions: null, zones: ['sulphur_springs', 'glass_hollow', 'leech_ford', 'reed_marsh', 'mirefen', 'obsidian_terraces', 'saltmere', 'cooling_fields'],
      enemies: [{ primary: 'basilisk', name: 'Basilisk' }, { primary: 'giant_spider', name: 'Stone-fed Spider' }] },
    { id: 'm_horror', name: 'Something from below', faction: 'wild', monster: true, minLv: 8, maxLv: 50, regions: null, zones: ['mist_trail', 'bone_bridge', 'glass_hollow', 'elderwood', 'greatwood', 'mirefen', 'fogwater', 'quicklime_pits', 'rotwood', 'the_sump', 'bargemans_cairn', 'dewfall_glade'],
      enemies: [{ primary: 'maw_horror', name: 'Maw Horror' }, { primary: 'ghoul', name: 'Thrall' }] }
  ] });
  // Patrols: who answers for the roads, by faction. They fight you only if you are Hostile to them.
  C.PATROLS = {
    crown: { name: 'Crown patrol', enemies: [{ primary: 'warrior', name: 'Crown Guard' }, { primary: 'archer', name: 'Crown Bowman' }, { primary: 'squire', name: 'Crown Recruit' }] },
    syndicate: { name: 'Syndicate enforcers', enemies: [{ primary: 'rogue', name: 'Enforcer' }, { primary: 'marksman', name: 'Counting-House Gun' }, { primary: 'rogue', name: 'Enforcer' }] },
    synod: { name: 'Synod watch', enemies: [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Synod Novice' }] },
    ironbound: { name: 'Ironbound wardens', enemies: [{ primary: 'bulwark', name: 'Hold Shield' }, { primary: 'warrior', name: 'Hold Axe' }, { primary: 'archer', name: 'Hold Crossbow' }] },
    anvil: { name: 'Guild sappers', enemies: [{ primary: 'marksman', name: 'Guild Sapper' }, { primary: 'bulwark', name: 'Guild Shieldhand' }, { primary: 'cleric', name: 'Guild Medic' }] },
    canopy: { name: 'Warden rangers', enemies: [{ primary: 'tracker', name: 'Warden Tracker' }, { primary: 'druid', name: 'Warden Druid' }, { primary: 'scout', name: 'Warden Scout' }] }
  };

  // Where each race starts. Everyone begins neutral (allegiance null) with a different standing, region and opening.
  // Points of interest: one-off scenes that reward curiosity (and sometimes bite back).
  Object.assign(C.CHOICES, {
    hermits_rime: { text: 'An old woman in a hut of furs and ice offers you a seat by her fire. She has lived here forty winters and knows every path the snow leaves open.\n\n"A gift buys a story," she says. "Food buys a friend."',
      options: [{ id: 'pay', label: 'Pay for her paths (25 gold)', hint: 'Places go on your map.', gold: -25, reveal: true }, { id: 'share', label: 'Share your rations with her', hint: 'The Wardens hear of the kindness.', standing: { canopy: 15 } }, { id: 'leave', label: 'Move on' }] },
    moonwell: { text: 'The moonwell is perfectly still and full of silver light, even at noon. Coins glint on the bottom, some of them older than the realm.\n\nThe Wardens say every coin is a promise someone made here.',
      options: [{ id: 'offer', label: 'Make an offering (30 gold)', hint: 'The Canopy honours it.', gold: -30, standing: { canopy: 25 } }, { id: 'take', label: 'Fish out the coins', hint: 'Coin for you. The Wardens call it theft from the dead.', gold: 30, standing: { canopy: -20 } }, { id: 'leave', label: 'Leave it be' }] },
    highspire_rest: { text: 'You climb to the cairn-shrine at the top of the spire. From here you can see half the forest, and the smoke of every village in it.\n\nTravellers add a stone for the ones who did not make it home.',
      options: [{ id: 'look', label: 'Study the land below', hint: 'Nearby places go on your map.', reveal: true }, { id: 'stone', label: 'Add a stone for someone', hint: 'The Wardens notice the old courtesy.', standing: { canopy: 10 } }] },
    tidemother_shrine: { text: 'Shell steps lead down into green water. Fishermen of every people leave something here before a voyage: a coin, a hook, a lock of hair.\n\nThe old offerings lie under the water, out of reach of anyone sensible.',
      options: [{ id: 'offer', label: 'Offer a coin before your road (15 gold)', hint: 'The Wardens and the port\'s traders both approve.', gold: -15, standing: { canopy: 10, syndicate: 10 } }, { id: 'dive', label: 'Dive for the old offerings', hint: 'Coin for you. The Wardens will not like it.', gold: 35, standing: { canopy: -15 } }, { id: 'leave', label: 'Leave' }] },
    carrow_tower: { text: 'Someone has been digging in the cellar of the ruined tower, and left in a hurry. A crate of Crown tax-stamps lies open beside the hole, enough to forge a year of tolls.\n\nWhoever it was will be back for them.',
      options: [{ id: 'loot', label: 'Take what they left', hint: 'Coin for you. The Crown would call it forgery.', gold: 45, standing: { crown: -15 } }, { id: 'report', label: 'Carry the stamps to the Crown', hint: 'The Crown will be grateful, and curious.', standing: { crown: 25 } }, { id: 'leave', label: 'Walk on' }] },
    widows_barrow: { text: 'Rain has broken open the old mound, and grave goods show through the turf: a torque, a cup, a sword gone green.\n\nThe villagers say the widow buried here still sits up at night, waiting for someone who never came back from the war.',
      options: [{ id: 'dig', label: 'Dig out the grave goods', hint: 'Good coin. The Crown hangs grave-robbers, when it catches them.', gold: 60, standing: { crown: -10 } }, { id: 'rest', label: 'Close the mound and say a word for her', hint: 'The Crown likes its old graves kept.', standing: { crown: 10 } }] },
    mooncircle: { text: 'The standing stones are cold even at noon. Inside them, something has pressed a perfect ring of bare earth into the grass, as if a great weight sat there overnight.\n\nNothing grows in the ring. Nothing is sleeping in it now, either.',
      options: [{ id: 'rest', label: 'Rest inside the ring', hint: 'The Wardens say the stones remember who trusts them.', standing: { canopy: 10 } }, { id: 'map', label: 'Study the carvings', hint: 'Old paths go on your map.', reveal: true }, { id: 'leave', label: 'Leave' }] },
    sentinel_ring: { text: 'Seven stones in a ring, each carved with a single open eye. The carvings are older than the forest.\n\nYou are quite sure the stones are watching back.',
      options: [{ id: 'touch', label: 'Touch the stones', hint: 'Something shows you the land around.', reveal: true }, { id: 'leave', label: 'Leave without touching them' }] },
    outlaws_rest: { text: 'A hollow oak, big enough to stable horses, with a smoke-hole and fresh tracks all round it. A scrap of faded red cloth is nailed over the entrance.\n\nSomebody is watching you from the dark inside. Several somebodies.',
      options: [{ id: 'bribe', label: 'Leave a gift at the door (40 gold)', hint: 'Whoever lives here may show you their roads.', gold: -40, reveal: true }, { id: 'raid', label: 'Raid the camp', hint: 'A fight with whoever is inside.', fight: true }, { id: 'leave', label: 'Back away slowly' }] },
    glasswood_spires: { text: 'The pale trunks ring like glass bells in the wind. Travellers come to hear them and drop coins without noticing, and the roots are full of them.',
      options: [{ id: 'gather', label: 'Gather the dropped coins', hint: 'Some coin.', gold: 35 }, { id: 'listen', label: 'Stand and listen to the trees', hint: 'The Wardens say the spires sing for those who stop.', standing: { canopy: 10 } }] },
    deeproot_mines: { text: 'A cave-in has blocked the lower shaft. The foreman is a clansman with a cut over one eye.\n\n"I need strong backs to dig," he says, "or sharp eyes to tell the Guild what this will cost them. The Guild pays better. The clans remember longer."',
      options: [{ id: 'dig', label: 'Help the clansmen dig', hint: 'A little coin. The Ironbound remember.', gold: 25, standing: { ironbound: 15 } }, { id: 'survey', label: 'Survey the damage for the Guild', hint: 'Better coin. The clans will call it counting the dead.', gold: 40, standing: { anvil: 15, ironbound: -10 } }, { id: 'leave', label: 'Leave them to it' }] },
    runefall: { text: 'Scribes hang on ropes down the cliff face, copying runes cut there before the holds were built. A young one swings over to you.\n\n"I can read you the oldest lines," she says. "For a fee. They are mostly directions."',
      options: [{ id: 'read', label: 'Pay her to read them (30 gold)', hint: 'Old paths go on your map.', gold: -30, reveal: true }, { id: 'help', label: 'Help hold the ropes', hint: 'The clans notice who does the dull work.', standing: { ironbound: 15 } }, { id: 'leave', label: 'Move on' }] },
    wolfmothers_den: { text: 'Pup bones lie scattered at the mouth of the den, and fresh tracks lead inside, big ones.\n\nA low growl rolls out of the dark. It is not a warning. It is a question.',
      options: [{ id: 'enter', label: 'Go in', hint: 'A fight.', fight: true }, { id: 'meat', label: 'Leave meat at the entrance (15 gold)', hint: 'The wolves let you pass.', gold: -15 }, { id: 'leave', label: 'Walk away slowly' }] },
    whitestone_abbey: { text: 'Whitestone Abbey is a Hearthwatch house, all bread-smell and old blankets. But the Synod keeps a scriptorium in the east wing, and its clerk-brother greets you by name before you have given it.\n\n"We keep copies of everything," he says. "Including, it seems, you."',
      options: [{ id: 'donate', label: 'Donate to the scriptorium (40 gold)', hint: 'The Synod remembers its friends.', gold: -40, standing: { synod: 30 } }, { id: 'ask', label: 'Ask what they have written about the roads', hint: 'Some places go on your map. The Synod does not like being asked.', standing: { synod: -5 }, reveal: true }, { id: 'leave', label: 'Decline politely' }] },
    drowned_chapel: { text: 'The chapel is half sunk in the marsh. The Hearthwatch keep a lamp lit in the dry half, for anyone lost on the causeway. The bell still hangs in the drowned tower.\n\nSomething has been dragging marsh gas up out of the crypt, and the lamp-keeper will not go down there any more.',
      options: [{ id: 'salvage', label: 'Strip the bell fittings', hint: 'Good brass. The Hearthwatch will not thank you.', gold: 55 }, { id: 'crypt', label: 'Go down into the crypt', hint: 'A fight in the dark.', fight: true }, { id: 'leave', label: 'Leave it' }] },
    reliquary_hill: { text: 'Tombs are cut into the hillside, each with a saint\'s name over the door and a queue of pilgrims in front of it. The doors are locked, but the locks are older than the Synod.',
      options: [{ id: 'pray', label: 'Pray with the pilgrims', hint: 'The Synod sees who kneels.', standing: { synod: 20 } }, { id: 'steal', label: 'Pick a lock when no one is looking', hint: 'Saints are buried with gold. The Synod would never forgive it.', gold: 70, standing: { synod: -40 } }, { id: 'leave', label: 'Leave' }] },
    vent_hollow: { text: 'Steam hisses from a crack in the earth. The yellow rock around it glitters with crystal, and a little further in there are bones, picked clean.',
      options: [{ id: 'mine', label: 'Scrape off the crystals', hint: 'Some coin. You do not look at the bones.', gold: 45 }, { id: 'probe', label: 'Climb down to see what ate them', hint: 'A fight.', fight: true }, { id: 'leave', label: 'Keep well clear' }] },
    sinkhole_shrine: { text: 'A little shrine sits on the rim of a sinkhole. Pilgrims drop offerings in. Nothing ever comes back out.\n\nBut if you lean over and listen, something down there is moving.',
      options: [{ id: 'offer', label: 'Drop in a coin (15 gold)', hint: 'The Synod approves of offerings.', gold: -15, standing: { synod: 10 } }, { id: 'rope', label: 'Lower a rope and fish for offerings', hint: 'Coin, if the something lets you.', gold: 40 }, { id: 'leave', label: 'Leave' }] }
  });

  C.STARTS = {
    human: { location: 'kingsway_cross', crossroads: true, discovered: ['kingsway_cross'],
      standing: { crown: 0, syndicate: 0, synod: 0 }, recruits: [{ primary: 'squire' }, { primary: 'scout' }, { primary: 'acolyte' }],
      opening: 'Kingsway Cross: three roads, one well, and a toll-clerk counting your boots.\n\nThe old king has been dead for years and nobody sits his throne. The lords call the wait "the Interval" and change the subject. In the meantime three powers hold the realm together, each in its own way: the Crown with soldiers and law, the Syndicate with coin and debt, the Synod with prayer and its long memory. Out at the edges, the Broken Banner rides and the Hearthwatch keeps its doors open.\n\nYou have a sword, two companions and no master. Every one of them would like to be your master. Walk the roads, listen, and choose when you are ready.' },
    dwarf: { location: 'deepdelve', discovered: ['deepdelve', 'ironforge', 'mine_collapse', 'koestielve'],
      standing: { ironbound: 300, anvil: -50, crown: 100, syndicate: -100 }, recruits: [{ primary: 'squire' }, { primary: 'acolyte' }, { primary: 'scout' }],
      opening: 'The holds are quiet and the Guild is loud.\n\nA gallery has collapsed under Deepdelve with miners still inside it. The Ironbound clans want it sealed as a grave, the Anvil Guild wants the ore behind it, and both are watching to see which way you step.' },
    wood_elf: { location: 'sylvan_watch', discovered: ['sylvan_watch', 'felled_grove', 'heartwood_trail'],
      standing: { canopy: 300, crown: -300, syndicate: -100 }, recruits: [{ primary: 'scout' }, { primary: 'scout' }, { primary: 'apprentice' }],
      opening: 'Axes are ringing in the old forest.\n\nHuman loggers have come past the marker stones. The Wardens of the Canopy want them gone, by whatever means it takes. To the south, the Cartel’s harbours in the fens offer allies who ask no questions, and trade that never quite says what it carries.' }
  };

  // Time-driven world events. They fire when the day passes `day` (once). Telegraphed first, then they land.
  // ---- scenes and fights for the opening jobs (only open while their job is active) ----
  C.ENCOUNTERS.tithe_raiders = { name: 'The Tithe Barn', map: 'tithe_raiders', rec: 2, enemyFaction: 'outlaws', once: true, job: 'toll_road', winFlag: 'job_toll_won',
    enemies: [{ primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Barn Archer' }, { primary: 'squire', name: 'Deserter' }], reward: { xp: 60, gold: 30 } };
  C.NODES.tithe_barn.encounter = 'tithe_raiders';
  Object.assign(C.CHOICES, {
    pennant_debt: { job: 'pennant_debt', text: 'The farmer meets you at the gate with his hat in his hands. His name is Ebb Thatcher. He borrowed for seed in the spring, the rain never came, and the Syndicate wants its 95 gold.\n\n"Take the grain and we do not eat this winter," he says. "Take the pledge and they own the farm by spring. I know how it works. I signed it."\n\nHis children are watching from the doorway.',
      options: [
        { id: 'collect', label: 'Collect it: the grain now, and a pledge on the farm', hint: 'The Syndicate will be very pleased. The family will not eat well.', standing: { syndicate: 40, crown: -10 }, gold: 40, flag: 'debt_collected', jobFlag: 'job_debt_settled' },
        { id: 'pay', label: 'Pay the 95 gold yourself', hint: 'The debt is settled, the factor is mildly pleased, and you are poorer.', standing: { syndicate: 15 }, gold: -95, flag: 'debt_paid', jobFlag: 'job_debt_settled' },
        { id: 'forgive', label: 'Tell the factor it cannot be collected', hint: 'The family keeps its grain. The Syndicate does not like being told no.', standing: { syndicate: -25 }, flag: 'debt_forgiven', jobFlag: 'job_debt_settled' }
      ] },
    sealed_letter: { job: 'sealed_letter', text: 'A Synod clerk at Orchard Row holds out an ink-stained hand for the pilgrim\'s letter. He does not look up from his ledger.\n\nYou notice the seal: warm wax, a little crooked, as if somebody opened it and sealed it again in a hurry. The pilgrim told you not to be curious. She did not say why.',
      options: [
        { id: 'deliver', label: 'Hand it over unopened', hint: 'The Synod values people who do as they are asked.', standing: { synod: 40 }, flag: 'letter_delivered', jobFlag: 'job_letter_done' },
        { id: 'read', label: 'Read it first, then hand it over', hint: 'You will know what it says. The clerk may notice the seal.', standing: { synod: 10 }, flag: 'letter_read', jobFlag: 'job_letter_done' },
        { id: 'burn', label: 'Burn it in the clerk\'s own candle', hint: 'Whatever it said, nobody reads it now. The Synod will be furious.', standing: { synod: -30 }, flag: 'letter_burned', jobFlag: 'job_letter_done' }
      ] },
    hedge_mage: { job: 'hedge_mage', text: 'The healer at Pale Vigil is a plain woman called Hilde, with ink on her fingers and a kettle always on. She has cured half the village of the winter cough with herbs and something else, something warm that comes out of her hands.\n\nShe has no licence and cannot cast a ward to save herself. She knows exactly why the chantry sent you.\n\n"I could run," she says. "I am tired of running. Do what you came to do."',
      options: [
        { id: 'hand', label: 'Tell the chantry where she is', hint: 'The Synod pays well and trusts you more. She will be registered, or worse.', standing: { synod: 50 }, gold: 60, flag: 'mage_handed', jobFlag: 'job_mage_done' },
        { id: 'hide', label: 'Tell them she was gone when you arrived', hint: 'She is safe. If the Synod learns the truth, so are you not.', standing: { synod: -35 }, flag: 'mage_hidden', jobFlag: 'job_mage_done' },
        { id: 'warn', label: 'Warn her first, then report the truth', hint: 'She gets a head start. The Synod gets its report.', standing: { synod: 10 }, flag: 'mage_warned', jobFlag: 'job_mage_done' }
      ] }
  });
  C.NODES.pennant_green.choice = 'pennant_debt'; C.NODES.orchard_row.choice = 'sealed_letter'; C.NODES.pale_vigil.choice = 'hedge_mage';

  C.EVENTS = [
    { id: 'marches_warning', day: 12, text: 'Scouts report raiders massing near the Free Marches. An attack is expected within two weeks.',
      effect: st => { st.world.flags.marches_warned = true; } },
    { id: 'marches_attack', day: 24, text: 'Raiders have overrun the Free Marches.',
      effect: st => { if (!st.world.flags.marches_defended) { const n = nodeState(st, 'free_marches'); n.owner = 'outlaws'; n.besieged = true; st.world.flags.marches_lost = true; } } },
    { id: 'human_split', day: 40, text: 'The Syndicate has bought up a great lord\'s debts and called them in. The lords call it betrayal; the Syndicate calls it bookkeeping. Either way, the Crown and the Syndicate are now openly at odds, and anyone who serves both will feel it.',
      effect: st => { S().shiftRelation(st, 'crown', 'syndicate', -0.3, { both: true }); st.world.flags.crown_syndicate_feud = true; } },
    { id: 'synod_crackdown', day: 56, text: 'The Synod has declared the Syndicate\'s hired mages heretics and sent inquisitors to the River Cities. The Syndicate is furious. The Crown, which owes the Syndicate a great deal, is quietly pleased.',
      effect: st => { S().shiftRelation(st, 'synod', 'syndicate', -0.2, { both: true }); S().shiftRelation(st, 'synod', 'crown', 0.15, { both: true }); } }
  ];

  // ---- Zones: the wild places where random trouble lives. Ordinary roads are quiet; a zone rolls on arrival. ----
  const ZONES = { glass_hollow: 2, dewfall_glade: 1, gallows_hill: 3, ember_gallery: 2, snowmelt_tarn: 2, elk_meadow: 1, last_cairn: 2, beacon_hill: 1, signal_tower: 2, greycrown_peak: 2,
    bargemans_cairn: 2, warbanner_hill: 3, vent_of_the_dead: 3, ash_stair: 3, cooling_fields: 3, pyre_field: 2, sulphur_springs: 2, bone_bridge: 2, mist_trail: 2, leech_ford: 2 };
  Object.entries(ZONES).forEach(([id, d]) => { const n = C.NODES[id]; if (!n) throw new Error('ZONES: unknown ' + id); n.type = 'zone'; n.danger = d; });

  // ---- Dungeons: a node you enter for a chain of fights. Some refill after a while (a den, a barrow), some clear for good (a story ruin).
  // Leaf nodes hanging off one parent place, so they never cut the road network. `hidden` ones are not on the map until revealed (rumours, quests, or visiting the parent at the right level).
  // Every dungeon floor has its own map (dgm_<dungeon>_<floor>, built by tools/dungeon_maps.py in data/maps.js).
  const U = s => { const [primary, name] = s.split(':'); return { primary, name }; };
  const FL = (name, ...u) => ({ name, enemies: u.map(U) });
  const BOSS = (name, ...u) => ({ name, enemies: u.map(U), boss: true });
  C.DUNGEONS = {
    rat_run_warren: { name: 'Rat Run Warren', parent: 'rat_run', pos: [0.9466, 0.727], tier: 1, rec: 3, respawn: 7, hidden: false,
      desc: 'A smugglers\' warren under the reeds. The Cartel keeps digging new tunnels.', why: 'The Cartel keeps digging, and the runners keep coming back.',
      first: { gold: 60, items: { chain_coif: 1 } },
      floors: [FL('Tunnel mouth', 'squire:Rat Runner', 'scout:Dart Slinger', 'scout:Dart Slinger'), FL('The sorting room', 'rogue:Warren Knife', 'rogue:Warren Knife', 'apprentice:Fuse Boy'), BOSS('The Rat King\'s den', 'warrior:Warren Boss', 'rogue:Warren Knife', 'archer:Crossbow Rat')] },
    old_toll_cellars: { name: 'Old Toll Cellars', parent: 'old_toll', pos: [0.4115, 0.6362], tier: 1, rec: 3, respawn: 8, hidden: false,
      desc: 'Cellars under the ruined toll house, where the last keeper\'s strongbox is said to lie.', why: 'Every gang in the district wants the strongbox, so new ones keep moving in.',
      first: { gold: 80, items: { traveler_boots: 1 } },
      floors: [FL('The stair', 'squire:Toll Thug', 'scout:Rooftop Archer', 'squire:Toll Thug'), FL('The tally room', 'rogue:Cellar Knife', 'shaman:Fence', 'rogue:Cellar Knife'), BOSS('The strongbox vault', 'warrior:Toll Reaver', 'archer:Vault Bowman', 'rogue:Lockpick')] },
    thistledown_well: { name: 'The Old Well', parent: 'thistledown', pos: [0.359, 0.4439], tier: 1, rec: 2, respawn: 7, hidden: true, reveal: { auto: true, minLevel: 1 },
      desc: 'A very old well that goes down much further than a well should.', why: 'Something below keeps breeding, and the charcoal burners keep it at bay.',
      first: { gold: 40, items: { mana_ring: 1 } },
      floors: [FL('Down the shaft', 'scout:Cave Rat', 'scout:Cave Rat', 'squire:Rat Swarm'), FL('The flooded chamber', 'squire:Drowned Rat', 'giant_spider:Pale Spider', 'scout:Cave Rat'), BOSS('The wellhead', 'warrior:Great Rat', 'scout:Cave Rat', 'scout:Cave Rat')] },
    frozen_falls_cave: { name: 'Cave Behind the Falls', parent: 'frozen_falls', pos: [0.766, 0.2468], tier: 2, rec: 5, respawn: 12, hidden: false,
      desc: 'A cave behind a waterfall frozen mid-fall. Something blue moves inside.', why: 'The winter ice thaws and refreezes, and brings more up with it.',
      first: { gold: 140, items: { frost_ward: 1, warding_amulet: 1 } },
      floors: [FL('The ice shelf', 'cave_bear:Frost Bear', 'dire_wolf:Snow Wolf', 'dire_wolf:Snow Wolf'), FL('The blue gallery', 'shaman:Ice Wraith', 'berserker:Frost Troll', 'apprentice:Rime Wisp'), BOSS('The frozen throne', 'wizard:Rime Warden', 'berserker:Frost Troll', 'shaman:Ice Wraith')] },
    drowned_idol_depths: { name: 'Idol\'s Throat', parent: 'drowned_idol', pos: [0.8074, 0.946], tier: 2, rec: 5, respawn: 10, hidden: false,
      desc: 'The fen drains into a hole beneath the statue. Offerings go down. Things come up.', why: 'The fen keeps feeding it, and it keeps answering.',
      first: { gold: 120, items: { sage_pendant: 1 } },
      floors: [FL('The offering pool', 'acolyte:Mire Cultist', 'squire:Drowned Thrall', 'squire:Drowned Thrall'), FL('The silt stair', 'shaman:Bog Seer', 'rogue:Reed Knife', 'acolyte:Mire Cultist'), BOSS('The idol\'s heart', 'shaman:Idol Priest', 'squire:Drowned Thrall', 'necro:Fen Bonecaller')] },
    sunken_cloister_crypt: { name: 'The Singing Crypt', parent: 'sunken_cloister', pos: [0.826, 0.6072], tier: 2, rec: 6, respawn: 14, hidden: true, reveal: { auto: true, minLevel: 4 },
      desc: 'Beneath the slipped cloister, a choir that never finished its last hymn.', why: 'The song calls the restless up again, however often they are put down.',
      first: { gold: 160, items: { warding_amulet: 1 } },
      floors: [FL('The nave', 'necro:Choir Shade', 'acolyte:Penitent Ghost', 'squire:Hollow Monk'), FL('The cantor\'s gallery', 'wizard:Whisper Cantor', 'necro:Choir Shade', 'acolyte:Penitent Ghost'), BOSS('The last hymn', 'cleric:Choirmaster', 'necro:Choir Shade', 'wizard:Whisper Cantor')] },
    silt_wharf_undercroft: { name: 'Silt Wharf Undercroft', parent: 'silt_wharf', pos: [0.5342, 0.5509], tier: 2, rec: 6, respawn: 12, hidden: true, reveal: { auto: true, minLevel: 4 },
      desc: 'A drowned warehouse under the wharf, where cargo is moved that no ledger lists.', why: 'The Syndicate never admits to it, so someone always moves in to take over the trade.',
      first: { gold: 200, items: { swift_charm: 1 } },
      floors: [FL('The loading dock', 'rogue:Dock Knife', 'archer:Dock Sniper', 'squire:Stevedore'), FL('The sunk cellar', 'marksman:Counting-House Gun', 'rogue:Dock Knife', 'shaman:Fence'), BOSS('The sub-ledger', 'warlord:Wharf Master', 'marksman:Counting-House Gun', 'rogue:Dock Knife')] },
    applecourt_cellars: { name: 'Applecourt Cellars', parent: 'applecourt', pos: [0.5703, 0.2588], tier: 2, rec: 6, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The manor\'s lord has not been seen in months. The cellars go further than the manor does.', why: 'What lived here is put down for good, if you finish it.',
      first: { gold: 150, items: { healer_locket: 1 } },
      floors: [FL('The orchard cellar', 'squire:Hollow Footman', 'scout:Cider-Soaked Ghost', 'acolyte:Chapel Shade'), FL('The wine vault', 'necro:Cellar Whisper', 'squire:Hollow Footman', 'squire:Hollow Footman'), BOSS('The lord\'s chamber', 'necro:The Lord of Applecourt', 'acolyte:Chapel Shade', 'squire:Hollow Footman')] },
    skull_quarry_pits: { name: 'Skull Quarry Pits', parent: 'skull_quarry', pos: [0.6086, 0.827], tier: 3, rec: 9, respawn: 10, hidden: false,
      desc: 'Deep in the quarry the orcs dig for something under the bones. Something digs back.', why: 'The quarry is an old battlefield. There is always more under it.',
      first: { gold: 320, items: { plate_armor: 1 } },
      floors: [FL('The bone terraces', 'berserker:Quarry Brute', 'necro:Bone Caller', 'berserker:Quarry Brute'), FL('The ossuary', 'banshee:Marrow Wail', 'ghoul:Quarry Ghoul', 'ghoul:Quarry Ghoul'), FL('The deep seam', 'siegebreaker:Bone Colossus Spawn', 'necro:Bone Caller', 'shadowknight:Grave Guard'), BOSS('The heart of the quarry', 'siegebreaker:The Bone Colossus', 'necro:Bone Caller', 'wizard:Marrow Mage')] },
    oathstone_crypt: { name: 'The Oathbreakers\' Crypt', parent: 'oathstone', pos: [0.6977, 0.1722], tier: 3, rec: 8, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'Broken oaths are chiselled off the Oathstone. The names are kept below.', why: 'The dead here are bound by their own words. Free them and they stay free.',
      first: { gold: 280, items: { tower_shield: 1 } },
      floors: [FL('The unsworn hall', 'warrior:Oathless Shade', 'bulwark:Hold Shield Shade', 'archer:Bowman Shade'), FL('The chisel chamber', 'berserker:Broken Axe', 'cleric:Last Confessor', 'warrior:Oathless Shade'), FL('The names', 'bulwark:Hold Shield Shade', 'wizard:Rune Shade', 'cleric:Last Confessor'), BOSS('The first oath', 'warlord:The Oathless King', 'bulwark:Hold Shield Shade', 'warrior:Oathless Shade')] },
    kings_barrow_depths: { name: 'The King\'s Barrow', parent: 'kings_barrow', pos: [0.566, 0.3899], tier: 3, rec: 8, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The old king\'s tomb, sealed, and guarded by nobles who do not say what for.', why: 'It is sealed once and for all, whatever is found.',
      first: { gold: 300, items: { siphon_band: 1 } },
      floors: [FL('The sealed door', 'warrior:Tomb Guard', 'archer:Tomb Archer', 'bulwark:Tomb Shieldwall'), FL('The hall of banners', 'wizard:Barrow Wight', 'ghoul:Grave Ghoul', 'ghoul:Grave Ghoul'), FL('The long gallery', 'shadowknight:Barrow Knight', 'warrior:Tomb Guard', 'archer:Tomb Archer'), BOSS('The old king', 'barrow_king:The Old King', 'shadowknight:Barrow Knight', 'bone_archer:Barrow Archer')] },
    bubbling_vats_undercellar: { name: 'The Vats Undercellar', parent: 'bubbling_vats', pos: [0.9555, 0.821], tier: 3, rec: 9, respawn: 12, faction: 'bilge_rats', hidden: true, reveal: { auto: true, minLevel: 7 },
      desc: 'Where the Cartel keeps the experiments that did not work.', why: 'The Cartel never throws a failed batch away. It sends it downstairs.',
      first: { gold: 340, items: { staff_storm: 1 } },
      floors: [FL('The tanks', 'wizard:Vat Alchemist', 'rogue:Fuse Runner', 'apprentice:Bomb Boy'), FL('The cold store', 'stormcaller:Cell Tender', 'wizard:Vat Alchemist', 'rogue:Fuse Runner'), FL('The sump', 'berserker:Failed Batch', 'berserker:Failed Batch', 'wizard:Vat Alchemist'), BOSS('The master batch', 'stormcaller:The Chief Alchemist', 'berserker:Failed Batch', 'wizard:Vat Alchemist')] },
    bonehall_pit: { name: 'The Bonehall Pit', parent: 'bonehall', pos: [0.3972, 0.793], tier: 4, rec: 12, respawn: 14, hidden: true, reveal: { auto: true, minLevel: 10 },
      desc: 'Under the feast hall of ribs, the Legion\'s champions fight for the right to lead.', why: 'The Legion always has more challengers than it has hall.',
      first: { gold: 600, items: { greatsword: 1, plate_helm: 1 } },
      floors: [FL('The challengers\' gate', 'berserker:Pit Brawler', 'blood_knight:Legion Challenger', 'archer:Spear Thrower'), FL('The blood sand', 'blood_knight:Legion Challenger', 'berserker:Pit Brawler', 'shaman:War Priest'), FL('The champions\' row', 'warlord:Pit Champion', 'blood_knight:Legion Challenger', 'siegebreaker:Wall Breaker'), BOSS('The throne of ribs', 'warlord:The Pit Warlord', 'blood_knight:Legion Challenger', 'siegebreaker:Wall Breaker')] },
    fading_wards_vault: { name: 'The Fading Wards Vault', parent: 'fading_wards', pos: [0.8069, 0.35], tier: 4, rec: 12, respawn: null, hidden: true, reveal: { auto: false },
      desc: 'The rune-pillars are failing, and what they held back is stirring below.', why: 'It was sealed once. It will not be sealed again.',
      first: { gold: 650, items: { staff_arcane: 1, warding_amulet: 1 } },
      floors: [FL('The dark pillars', 'wizard:Ward Husk', 'enchanter:Rune Thief', 'wizard:Ward Husk'), FL('The silent ring', 'storm_elemental:Storm Shade', 'enchanter:Rune Thief', 'storm_elemental:Storm Shade'), FL('The sealed stair', 'stone_golem:Ward Guardian', 'wizard:Ward Husk', 'spellbow:Star Hunter'), BOSS('The first ward', 'wizard:The Ward-Eater', 'shadowmage:Veil Walker', 'enchanter:Rune Thief')] }
  };
  Object.entries(C.DUNGEONS).forEach(([id, d]) => {
    const par = C.NODES[d.parent]; if (!par) throw new Error('DUNGEONS: unknown parent ' + d.parent);
    C.NODES[id] = { name: d.name, region: par.region, type: 'dungeon', pos: (C.MAP_POS[id] || d.pos).slice(), desc: d.desc, dungeon: id, hidden: !!d.hidden, links: {} };
    C.NODES[id].links[d.parent] = 1; par.links[id] = 1; C.EDGES.push([d.parent, id, 1]);
    d.floors.forEach((f, i) => {
      const last = i === d.floors.length - 1, rec = d.rec + (f.boss ? 1 : 0);
      C.ENCOUNTERS['dg_' + id + '_' + (i + 1)] = { name: d.name + ': ' + f.name, map: 'dgm_' + id + '_' + (i + 1), rec, enemyFaction: d.faction || 'wild', enemies: f.enemies.map(e => Object.assign({}, e)),
        objective: f.boss ? { type: 'leader', leader: 0 } : null, once: false, dungeon: id, floor: i + 1, baseReward: { xp: Math.round((30 + 12 * rec) * (f.boss ? 1.8 : 1)), gold: Math.round((10 + 5 * rec) * (f.boss ? 2 : 1)) },
        reward: { xp: 0, gold: 0 } };
    });
  });

})();
