/* Races. Source: design/world_and_races.md (the user's notes). Any race can be any class; a race adds a small trait set.
   id: { name, desc, active, factions: [ids], home: nodeId, trait: 'text', statMods: { hp, spd, mv, jump }, armor %, rangedReduce %, jpRate,
         pushImmune, names: [default recruit names] }

   DATA ONLY for now: the stat / resistance / immunity effects are applied by the engines in a later step (race plumbing in both game and sim),
   and race bonuses will get their own sim run. Keep them small (the same lever size as HP, about +/-10%).
   Races marked active:false are in the world but not selectable in the first slice (Humans, Dwarves and Wood Elves are the slice starts). */
window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.races = {
  human: {
    name: 'Human', active: true, factions: ['crown', 'syndicate', 'synod'], home: 'crown_keep',
    desc: 'Politically divided between the Royalist Crown, the Mercantile Syndicate and the Ascendant Synod.',
    trait: 'Fast JP gain and balanced stats.', statMods: {}, jpRate: 1.25,
    names: ['Aldric', 'Mira', 'Joss', 'Edda', 'Corin']
  },
  dwarf: {
    name: 'Dwarf', active: true, factions: ['ironbound', 'anvil'], home: 'deepdelve',
    desc: 'Oath-bound clans split between the Ironbound Holds and the Guild of the Gilded Anvil.',
    trait: 'High HP and defense, and knockback immunity.', statMods: { hp: 4 }, armor: 3, pushImmune: true, jpRate: 1,
    names: ['Borin', 'Hilda', 'Thrain', 'Dagna', 'Brokk']
  },
  wood_elf: {
    name: 'Wood Elf', active: true, factions: ['canopy'], home: 'sylvan_watch',
    desc: 'Guerilla rangers of the Canopy Wardens, defending the ancient forests.',
    trait: 'High mobility, and reduced damage from ranged attacks.', statMods: { mv: 1, jump: 1 }, rangedReduce: 10, jpRate: 1,
    names: ['Sylwen', 'Faelar', 'Ithil', 'Mirel', 'Taeris']
  },
  high_elf: { name: 'High Elf', active: false, factions: ['ivory'], home: null, desc: 'Arcane aristocrats of the Ivory Spire.', trait: 'High MP and magic attack.', statMods: {}, jpRate: 1, names: [] },
  dark_elf: { name: 'Dark Elf', active: false, factions: ['matriarchy', 'cabal', 'envoys'], home: null, desc: 'Subterranean schemers.', trait: 'Flanking damage, and dark and poison resistance.', statMods: {}, jpRate: 1, names: [] },
  orc: { name: 'Orc', active: false, factions: ['blood_iron', 'ash_speakers'], home: null, desc: 'Martial tribes.', trait: 'High physical attack and low-HP rage bonuses.', statMods: {}, jpRate: 1, names: [] },
  goblin: { name: 'Goblin', active: false, factions: ['bilge_rats', 'mire_born'], home: null, desc: 'Scrappy survivors of the fens.', trait: 'Extended item and trap range, and swamp mobility.', statMods: {}, jpRate: 1, names: [] }
};
