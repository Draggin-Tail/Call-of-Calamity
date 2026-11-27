/* Factions. Names and races come from the design notes (design/world_and_races.md); the relations are a first proposal to tune.
   id: { name, race, desc, region, active, color, relations: { otherId: -1..1 } }

   RELATIONS: how another faction's standing moves when YOUR standing with this faction changes. Helping `crown` by +100 moves a faction with
   relation +0.5 by +25 (x the ripple factor in GAME_SAVE.RULES) and one with -0.5 by -25. Relations are directed (a -> b can differ from b -> a)
   but most pairs are written symmetrically with PAIRS below, then adjusted. They are the STARTING relations: a save can override any pair
   (state.factions.relationOverrides) so internal struggles can turn allies into rivals, and back, as the story moves.

   Factions with active:false are in the world but not part of the first slice (their regions and content come later). */
(function () {
  const F = {
    // ---- Humans ----
    crown:      { name: 'Royalist Crown',        race: 'human',     region: 'crownlands',   color: '#c9a227', desc: 'Feudal order. Loyal knights and lords holding the old kingdom together.' },
    syndicate:  { name: 'Mercantile Syndicate',  race: 'human',     region: 'river_cities', color: '#3c9d6b', desc: 'Trade guilds that buy influence. Wealthy, connected and often corrupt.' },
    synod:      { name: 'Ascendant Synod',       race: 'human',     region: 'voldun',       color: '#7a5cc4', desc: 'Arcane inquisitors who police magic and punish heresy.' },
    // ---- Elves ----
    ivory:      { name: 'The Ivory Spire',       race: 'high_elf',  region: 'iceflow', color: '#cfd8e6', desc: 'Arcane aristocrats of the Silverdeep, struggling with fading magical wards.', active: false },
    canopy:     { name: 'Canopy Wardens',        race: 'wood_elf',  region: 'elven_realms', color: '#4f9a3c', desc: 'Guerilla rangers defending the ancient forests from encroachment.' },
    // ---- Dark Elves ----
    matriarchy: { name: 'Obsidian Matriarchy',   race: 'dark_elf',  region: 'dark_dominion', color: '#5b3b6e', desc: 'The ruling matriarchs of the underground cities.', active: false },
    cabal:      { name: 'Veiled Cabal',          race: 'dark_elf',  region: 'dark_dominion', color: '#3a2b55', desc: 'Schemers who trade in secrets and poison.', active: false },
    envoys:     { name: 'Surface Envoys',        race: 'dark_elf',  region: 'dark_dominion', color: '#8a6aa8', desc: 'Dark elves who live among the surface races as diplomats and merchants.', active: false },
    // ---- Dwarves ----
    ironbound:  { name: 'Ironbound Holds',       race: 'dwarf',     region: 'dwarven_holds', color: '#b5651d', desc: 'Oath-bound traditionalist clans guarding the old holds.' },
    anvil:      { name: 'Guild of the Gilded Anvil', race: 'dwarf', region: 'dwarven_holds', color: '#d9a441', desc: 'Mercenary engineers who sell their skills and their machines.' },
    // ---- Orcs ----
    blood_iron: { name: 'Blood-Iron Legion',     race: 'orc',       region: 'orc_lands', color: '#a83232', desc: 'Conquering war host, forged for expansion.', active: false },
    ash_speakers: { name: 'Ash-Speaker Clans',   race: 'orc',       region: 'orc_lands', color: '#8a6d5a', desc: 'Shamanistic traditionalists who speak with the ashes of the dead.', active: false },
    // ---- Goblins ----
    bilge_rats: { name: 'Bilge-Rat Cartel',      race: 'goblin',    region: 'goblin_fens',  color: '#9aa63a', desc: 'Alchemists and bombers who run the fens\' trade.', active: false },
    mire_born:  { name: 'Mire-Born Tribes',      race: 'goblin',    region: 'goblin_fens',  color: '#5f7a3a', desc: 'Scrappy swamp survivors and trackers.', active: false },
    // ---- Cosmic (late game) ----
    seraphic:   { name: 'Seraphic Host',         race: 'angelic',   region: 'beyond',       color: '#f2e6a0', desc: 'Frontline crusaders of the Celestial Wardens.', active: false },
    dawn:       { name: 'Choir of Dawn',         race: 'angelic',   region: 'beyond',       color: '#f7f0d0', desc: 'Healers and guides of the Celestial Wardens.', active: false },
    vigilant:   { name: 'Vigilant Wardens',      race: 'angelic',   region: 'beyond',       color: '#c8d4e8', desc: 'Cautious rift-guardians.', active: false },
    cinder:     { name: 'Cinder-Crown Legions',  race: 'infernal',  region: 'beyond',       color: '#d9531e', desc: 'Conquering warlords of the Harbingers.', active: false },
    whisper:    { name: 'Whisper-Pact Syndicate', race: 'infernal', region: 'beyond',       color: '#8c2f5b', desc: 'Mortal tempters.', active: false },
    reavers:    { name: 'Ashen Reavers',         race: 'infernal',  region: 'beyond',       color: '#4a2a2a', desc: 'Pure destroyers.', active: false },
    // ---- Human minor factions (inactive until the rank and goodwill systems are built) ----
    broken_banner: { name: 'Broken Banner',       race: 'human',     region: null,           color: '#a3472f', desc: 'Deserters, runaways and free riders who answer to no crown. A fire, a blade and a hard bargain.', active: false },
    hearthwatch:   { name: 'Hearthwatch',         race: 'human',     region: null,           color: '#d9b45a', desc: 'Neutral keepers of chapels and hearths. They shelter, heal and ask nothing, and they remember who was kind.', active: false },
    // ---- Not a faction anyone joins: raiders and beasts ----
    outlaws:    { name: 'Outlaws and Raiders',   race: null,        region: null,           color: '#777777', desc: 'Bandits, deserters and raiders. Everyone has a reason to fight them.' }
  };

  // Symmetric pairs: [a, b, value]. Positive = their fortunes rise together, negative = rivals.
  const PAIRS = [
    // human internal struggle: order against trade against inquisition
    ['crown', 'syndicate', -0.3], ['crown', 'synod', 0.2], ['syndicate', 'synod', -0.4],
    ['crown', 'broken_banner', -0.6], ['syndicate', 'broken_banner', -0.1], ['synod', 'broken_banner', -0.4], ['synod', 'hearthwatch', -0.2], ['hearthwatch', 'broken_banner', 0.1],
    // dwarves: traditionalists against engineers, and how each sits with the humans
    ['ironbound', 'anvil', -0.5], ['ironbound', 'crown', 0.3], ['ironbound', 'syndicate', -0.2], ['ironbound', 'synod', -0.2],
    ['anvil', 'syndicate', 0.5], ['anvil', 'crown', 0.1],
    // elves
    ['canopy', 'crown', -0.6], ['canopy', 'syndicate', -0.4], ['canopy', 'synod', -0.2], ['canopy', 'ivory', -0.2],
    ['ivory', 'synod', -0.3], ['ivory', 'crown', 0.2], ['ironbound', 'ivory', 0.1], ['ironbound', 'canopy', 0.1], ['anvil', 'canopy', -0.2],
    // dark elves
    ['matriarchy', 'cabal', -0.5], ['matriarchy', 'envoys', 0.2], ['cabal', 'envoys', -0.2],
    ['canopy', 'matriarchy', -0.6], ['canopy', 'cabal', -0.5], ['ivory', 'matriarchy', -0.5], ['crown', 'matriarchy', -0.4], ['ironbound', 'matriarchy', -0.5],
    ['syndicate', 'cabal', 0.2], ['syndicate', 'envoys', 0.4], ['crown', 'envoys', 0.1],
    // orcs
    ['blood_iron', 'ash_speakers', -0.5], ['blood_iron', 'crown', -0.5], ['blood_iron', 'ironbound', -0.4], ['blood_iron', 'syndicate', 0.1],
    ['ash_speakers', 'canopy', 0.1], ['ash_speakers', 'crown', -0.2],
    // goblins
    ['bilge_rats', 'mire_born', -0.4], ['bilge_rats', 'anvil', 0.3], ['bilge_rats', 'syndicate', 0.3], ['bilge_rats', 'crown', -0.3],
    ['mire_born', 'canopy', 0.1], ['mire_born', 'blood_iron', -0.2],
    // cosmic
    ['seraphic', 'dawn', 0.5], ['seraphic', 'vigilant', 0.2], ['dawn', 'vigilant', 0.3], ['cinder', 'whisper', 0.2], ['cinder', 'reavers', 0.1], ['whisper', 'reavers', -0.3],
    ['seraphic', 'cinder', -0.8], ['seraphic', 'whisper', -0.6], ['seraphic', 'reavers', -0.8], ['dawn', 'cinder', -0.6], ['dawn', 'whisper', -0.8], ['dawn', 'reavers', -0.8],
    ['vigilant', 'cinder', -0.5], ['vigilant', 'whisper', -0.5], ['vigilant', 'reavers', -0.7]
  ];
  for (const id of Object.keys(F)) { F[id].relations = {}; F[id].active = F[id].active !== false; }
  for (const [a, b, v] of PAIRS) { F[a].relations[b] = v; F[b].relations[a] = v; }
  // Outlaws are everyone's enemy: hurting them helps the law-keepers a little (relations are how THEIR standing moves with the outlaws').
  // Directed: killing outlaws raises these factions; nothing the outlaws do moves with their fortunes.
  Object.assign(F.outlaws.relations, { crown: -0.8, syndicate: -0.3, synod: -0.5, ironbound: -0.5, anvil: -0.2, canopy: -0.2 });

  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.factions = F;

  // Extra rule files that sit on top of the campaign (data/intrigue.js: the Succession Moot and the cast). They are loaded from here so the
  // page needs no new <script> tag; each one waits until GAME_CAMPAIGN exists before it runs. Skipped outside a browser (tests load them directly).
  try {
    const me = typeof document !== 'undefined' && document.currentScript;
    if (me && me.src && document.createElement) ['intrigue.js', 'intrigue_cast.js', 'faction_work.js', 'faction_climax.js', 'story_world.js', 'faction_quests.js', 'relations.js', 'roads.js', 'gear_tiers.js', 'uniques.js', 'enemy_kits.js', 'gold_economy.js', 'loot.js', 'arena.js', 'arena_uniques.js', '../story_screens.js'].forEach(f => { const s = document.createElement('script'); s.src = me.src.replace(/factions\.js([?#].*)?$/, f); (document.head || document.documentElement).appendChild(s); });
  } catch (e) { /* no DOM: nothing to load */ }
})();
