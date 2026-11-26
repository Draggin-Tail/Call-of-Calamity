/* Gear. One item per slot: MainHand, OffHand, Head, Body, Accessory (combatRules.build.equipmentSlots).
   Shape: id: { name, slot, desc, ...effects }
   MAIN HAND items carry  weapon: { family, hands, p, r, c, crit, critFlank, ignoreArmor, spell, element, ranged }
     family       sword mace dagger wand handxbow javelin fist | greatsword katana maul bow crossbow staff polearm spear instrument
     hands        1 or 2. A two-handed weapon leaves the OffHand slot empty.
     p, r, c      power, range (hexes) and AP cost of the basic Attack this weapon gives (Attack costs 2 unless noted)
     crit         crit chance in percent points; critFlank = extra crit when flanking or ambushing from Vanish
     ignoreArmor  percent of the target's armor this weapon's hits ignore (blunt weapons)
     spell        1 = the Attack is a spell: reduced by Resistance instead of Armor, scaled by spell power
     element      fire frost lightning arcane holy shadow nature song (spell weapons)
     ranged       1 = counts as a ranged weapon (ranged weapon skills need one)
   OFF HAND items: shields (Guard needs one: guard:1), books, holy relics.
   ARMOR (Head, Body): weight heavy | medium | light with  armor  and  res  in percent (physical hits use Armor, spell hits use Resistance).
   Effect vocabulary shared with passives.js:
     statMods  { hp, spd, mv, jump, mana, manaRegen }
     costMods  { move, guard, <abilityId> }   point-cost deltas (floors are in combatRules.build)
     powerMods { <abilityId> | melee | ranged | unarmed | '*' }   flat power added to damaging abilities
     armor, res (percent), elemRes { element: percent }, spellPow, healPow, crit (percent points), guard:1 (lets the wearer Guard)
   Which classes can use which item is decided by the primary class (classes.js equip) and unlocked further by passives (passives.js unlocks).
   Numbers are a first pass: tune freely.
   Tiers 2 to 7 are generated from these items by data/gear_tiers.js (design/gear_tiers.md), which also sets the HP, mana and armor numbers of armor and shields and rewrites
   their descriptions. Two-handed melee weapons are about 50% stronger than one-handers on purpose (damage against a shield and Guard). */
window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.gear = {
  // ---------------- ONE-HANDED WEAPONS ----------------
  iron_sword:  { name: 'Iron Sword',   slot: 'MainHand', desc: 'Balanced blade. Attack: 8 damage, melee.',
                 weapon: { family: 'sword', hands: 1, p: 8, r: 1, c: 2, crit: 10 } },
  iron_mace:   { name: 'Iron Mace',    slot: 'MainHand', desc: 'Blunt: ignores 20% of armor. Attack: 8 damage, melee.',
                 weapon: { family: 'mace', hands: 1, p: 8, r: 1, c: 2, crit: 5, ignoreArmor: 20 } },
  steel_dagger:{ name: 'Iron Dagger', slot: 'MainHand', desc: 'Quick 1-AP stab, 20% crit (+40% when flanking or ambushing from Vanish). Attack: 4 damage.',
                 weapon: { family: 'dagger', hands: 1, p: 4, r: 1, c: 1, crit: 20, critFlank: 40 } },
  hand_crossbow:{ name: 'Hand Crossbow', slot: 'MainHand', desc: 'Compact ranged weapon. Attack: 5 damage, range 3.',
                 weapon: { family: 'handxbow', hands: 1, p: 8, r: 3, c: 2, crit: 10, ranged: 1 } },
  javelin:     { name: 'Javelin',      slot: 'MainHand', desc: 'Thrown spear. Attack: 6 damage, range 3.',
                 weapon: { family: 'javelin', hands: 1, p: 6, r: 3, c: 2, crit: 10, ranged: 1 } },
  wraps:       { name: 'Hand Wraps',   slot: 'MainHand', desc: 'Fist weapon: quick 1-AP strike, 12% crit. Attack: 3 damage.',
                 weapon: { family: 'fist', hands: 1, p: 3, r: 1, c: 1, crit: 12 } },
  knuckles:    { name: 'Iron Knuckles',slot: 'MainHand', desc: 'Fist weapon: 1-AP strike that ignores 10% of armor. Attack: 3 damage.',
                 weapon: { family: 'fist', hands: 1, p: 3, r: 1, c: 1, crit: 8, ignoreArmor: 10 } },
  claws:       { name: 'Claws',        slot: 'MainHand', desc: 'Fist weapon: 1-AP rake with 20% crit. Attack: 3 damage.',
                 weapon: { family: 'fist', hands: 1, p: 3, r: 1, c: 1, crit: 20 } },
  wand_fire:   { name: 'Ember Wand',   slot: 'MainHand', desc: 'Spell weapon, fire. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'fire' } },
  wand_cold:   { name: 'Frost Wand',   slot: 'MainHand', desc: 'Spell weapon, frost. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'frost' } },
  wand_storm:  { name: 'Storm Wand',   slot: 'MainHand', desc: 'Spell weapon, lightning. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'lightning' } },
  wand_arcane: { name: 'Arcane Wand',  slot: 'MainHand', desc: 'Spell weapon, arcane. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'arcane' } },
  wand_holy:   { name: 'Radiant Wand', slot: 'MainHand', desc: 'Spell weapon, holy. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'holy' } },
  wand_shadow: { name: 'Gloom Wand',   slot: 'MainHand', desc: 'Spell weapon, shadow. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'shadow' } },
  wand_nature: { name: 'Thorn Wand',   slot: 'MainHand', desc: 'Spell weapon, nature. Attack: 6 damage, range 3. +10% spell power.', spellPow: 10,
                 weapon: { family: 'wand', hands: 1, p: 6, r: 3, c: 2, crit: 10, spell: 1, element: 'nature' } },

  // ---------------- TWO-HANDED WEAPONS ----------------
  greatsword:  { name: 'Greatsword',   slot: 'MainHand', desc: 'Two-handed. Attack: 9 damage, melee.',
                 weapon: { family: 'greatsword', hands: 2, p: 12, r: 1, c: 2, crit: 10 } },
  katana:      { name: 'Katana',       slot: 'MainHand', desc: 'Two-handed, 20% crit. Attack: 8 damage, melee.',
                 weapon: { family: 'katana', hands: 2, p: 10, r: 1, c: 2, crit: 20 } },
  maul:        { name: 'Iron Maul',    slot: 'MainHand', desc: 'Two-handed blunt: ignores 30% of armor. Attack: 9 damage, melee.',
                 weapon: { family: 'maul', hands: 2, p: 11, r: 1, c: 2, crit: 5, ignoreArmor: 30 } },
  longbow:     { name: 'Longbow',      slot: 'MainHand', desc: 'Two-handed. Attack: 5 damage, range 5.',
                 weapon: { family: 'bow', hands: 2, p: 5, r: 5, c: 2, crit: 10, ranged: 1 } },
  crossbow:    { name: 'Crossbow',     slot: 'MainHand', desc: 'Two-handed bolt thrower: ignores 5% of armor. Attack: 5 damage, range 5.',
                 weapon: { family: 'crossbow', hands: 2, p: 5, r: 5, c: 2, crit: 5, ignoreArmor: 5, ranged: 1 } },
  halberd:     { name: 'Halberd',      slot: 'MainHand', desc: 'Two-handed polearm, reach 2. Attack: 8 damage.',
                 weapon: { family: 'polearm', hands: 2, p: 10, r: 2, c: 2, crit: 8 } },
  spear:       { name: 'Spear',        slot: 'MainHand', desc: 'Two-handed, reach 2. Attack: 7 damage.',
                 weapon: { family: 'spear', hands: 2, p: 9, r: 2, c: 2, crit: 10 } },
  lute:        { name: 'Lute',         slot: 'MainHand', desc: 'Two-handed instrument, song. Attack: 5 damage, range 2. +10% heal power.', healPow: 10,
                 weapon: { family: 'instrument', hands: 2, p: 5, r: 2, c: 2, crit: 10, spell: 1, element: 'song' } },
  staff_fire:  { name: 'Ember Staff',  slot: 'MainHand', desc: 'Two-handed spell weapon, fire. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'fire' } },
  staff_cold:  { name: 'Frost Staff',  slot: 'MainHand', desc: 'Two-handed spell weapon, frost. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'frost' } },
  staff_storm: { name: 'Storm Staff',  slot: 'MainHand', desc: 'Two-handed spell weapon, lightning. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'lightning' } },
  staff_arcane:{ name: 'Arcane Staff', slot: 'MainHand', desc: 'Two-handed spell weapon, arcane. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'arcane' } },
  staff_holy:  { name: 'Radiant Staff',slot: 'MainHand', desc: 'Two-handed spell weapon, holy. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'holy' } },
  staff_shadow:{ name: 'Gloom Staff',  slot: 'MainHand', desc: 'Two-handed spell weapon, shadow. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'shadow' } },
  staff_nature:{ name: 'Briar Staff',    slot: 'MainHand', desc: 'Two-handed spell weapon, nature. Attack: 8 damage, range 3. +15% spell power.', spellPow: 25,
                 weapon: { family: 'staff', hands: 2, p: 8, r: 3, c: 2, crit: 10, spell: 1, element: 'nature' } },

  // ---------------- OFF HANDS ----------------
  buckler:     { name: 'Buckler',      slot: 'OffHand', desc: 'Small shield: lets you Guard, Guard costs 1 less, +2% armor.', guard: 1, armor: 2, costMods: { guard: -1 }, offType: 'shield' },
  round_shield:{ name: 'Round Shield', slot: 'OffHand', desc: 'Lets you Guard. +5% armor.', guard: 1, armor: 5, offType: 'shield' },
  tower_shield:{ name: 'Tower Shield', slot: 'OffHand', desc: 'Lets you Guard. +8% armor, -1 Speed.', guard: 1, armor: 8, statMods: { spd: -1 }, offType: 'shield' },
  spellbook:   { name: 'Spellbook',    slot: 'OffHand', desc: '+10% spell power, +4 mana.', spellPow: 10, statMods: { mana: 4 }, offType: 'book' },
  tome_focus:  { name: 'Tome of Focus',slot: 'OffHand', desc: '+8 mana, +1 mana regeneration.', statMods: { mana: 8, manaRegen: 1 }, offType: 'book' },
  holy_relic:  { name: 'Holy Relic',   slot: 'OffHand', desc: '+15% heal power, +2 mana.', healPow: 15, statMods: { mana: 2 }, offType: 'relic' },
  warding_totem:{ name: 'Warding Totem', slot: 'OffHand', desc: '+10% resistance, +8% heal power.', res: 10, healPow: 8, offType: 'relic' },

  // ---------------- ARMOR ----------------
  // heavy: tanks (high armor, low resistance) / medium: melee and archers (balanced) / light: casters (high resistance, spell and mana bonuses)
  plate_helm:  { name: 'Plate Helm',   slot: 'Head', weight: 'heavy',  desc: 'Heavy. +11% armor, +3% resistance.', armor: 11, res: 3 },
  plate_armor: { name: 'Plate Armor',  slot: 'Body', weight: 'heavy',  desc: 'Heavy. +24% armor, +7% resistance.', armor: 24, res: 7 },
  chain_coif:  { name: 'Chain Coif',   slot: 'Head', weight: 'medium', desc: 'Medium. +8% armor, +6% resistance.', armor: 8, res: 6 },
  chain_hauberk:{ name: 'Chain Hauberk', slot: 'Body', weight: 'medium', desc: 'Medium. +12% armor, +9% resistance.', armor: 12, res: 9 },
  silk_hood:   { name: 'Linen Hood',    slot: 'Head', weight: 'light',  desc: 'Light. +2% armor, +14% resistance, +5% spell power, +2 mana.', armor: 2, res: 14, spellPow: 5, statMods: { mana: 2 } },
  mystic_robe: { name: 'Mystic Robe',  slot: 'Body', weight: 'light',  desc: 'Light. +3% armor, +21% resistance, +5% spell power, +2 mana.', armor: 3, res: 21, spellPow: 5, statMods: { mana: 2 } },

  // ---------------- ACCESSORIES ----------------
  swift_charm: { name: 'Swift Charm',  slot: 'Accessory', desc: '+1 Speed.', statMods: { spd: 1 } },
  traveler_boots:{ name: 'Traveler Boots', slot: 'Accessory', desc: '+1 move range.', statMods: { mv: 1 } },
  vigor_ring:  { name: 'Ring of Vigor',slot: 'Accessory', desc: '+5 max HP.', statMods: { hp: 5 } },
  mana_ring:   { name: 'Mana Ring',    slot: 'Accessory', desc: '+8 mana.', statMods: { mana: 8 } },
  siphon_band: { name: 'Siphon Band',  slot: 'Accessory', desc: '+1 mana regeneration.', statMods: { manaRegen: 1 } },
  focus_charm: { name: 'Focus Charm',  slot: 'Accessory', desc: '+6% crit chance.', crit: 6 },
  sage_pendant:{ name: 'Sage Pendant', slot: 'Accessory', desc: '+8% spell power.', spellPow: 8 },
  healer_locket:{ name: "Healer's Locket", slot: 'Accessory', desc: '+10% heal power.', healPow: 10 },
  warding_amulet:{ name: 'Warding Amulet', slot: 'Accessory', desc: '+6% armor, +6% resistance.', armor: 6, res: 6 },
  ember_ward:  { name: 'Ember Ward',   slot: 'Accessory', desc: '+25% resistance to fire.', elemRes: { fire: 25 } },
  frost_ward:  { name: 'Frost Ward',   slot: 'Accessory', desc: '+25% resistance to frost.', elemRes: { frost: 25 } },
  storm_ward:  { name: 'Storm Ward',   slot: 'Accessory', desc: '+25% resistance to lightning.', elemRes: { lightning: 25 } },
  // faction tokens, given at an induction (data/faction_quests.js). Not sold anywhere.
  keep_badge:  { name: 'Iron Badge of the Keep', slot: 'Accessory', desc: 'A Sworn Sword\'s badge. +4% armor, +3 max HP.', armor: 4, statMods: { hp: 3 }, token: 'crown' },
  runner_seal: { name: 'Runner\'s Seal', slot: 'Accessory', desc: 'A Syndicate runner\'s brass seal. +4% crit chance, +3 mana.', crit: 4, statMods: { mana: 3 }, token: 'syndicate' },
  ward_seal:   { name: 'Novice\'s Ward-Seal', slot: 'Accessory', desc: 'A Synod novice\'s wax seal. +5% resistance, +3% spell power.', res: 5, spellPow: 3, token: 'synod' },
  muster_coin: { name: 'Muster Coin', slot: 'Accessory', desc: 'An old army coin, the king\'s face worn smooth. +3 max HP, +3% crit chance.', crit: 3, statMods: { hp: 3 }, token: 'broken_banner' },
  candle_token:{ name: 'Candle-Token', slot: 'Accessory', desc: 'A Hearth-Friend\'s stub of candle. +6% heal power, +3% resistance.', healPow: 6, res: 3, token: 'hearthwatch' }
};

// ---- PRICES (gold). First-tier gear only for now; first pass, tune freely. Shops multiply these by faction standing (Friendly 0.9, Allied 0.8) and
// buy back at half price (GAME_SAVE.RULES.shop.sellFraction). Rough scale: a plain weapon about 60, a good one 100 to 120, armor 50 to 180, accessories 60 to 120.
(function () {
  const P = {
    iron_sword: 60, iron_mace: 60, steel_dagger: 50, hand_crossbow: 70, javelin: 55, wraps: 40, knuckles: 55, claws: 60,
    wand_fire: 80, wand_cold: 80, wand_storm: 80, wand_arcane: 80, wand_holy: 80, wand_shadow: 80, wand_nature: 80,
    greatsword: 130, katana: 130, maul: 130, longbow: 130, crossbow: 130, halberd: 120, spear: 100, lute: 90,
    staff_fire: 120, staff_cold: 120, staff_storm: 120, staff_arcane: 120, staff_holy: 120, staff_shadow: 120, staff_nature: 120,
    buckler: 50, round_shield: 75, tower_shield: 110, spellbook: 70, tome_focus: 110, holy_relic: 80, warding_totem: 90,
    chain_coif: 50, chain_hauberk: 90, silk_hood: 55, mystic_robe: 100, plate_helm: 90, plate_armor: 180,
    swift_charm: 120, traveler_boots: 100, vigor_ring: 80, mana_ring: 70, siphon_band: 90, focus_charm: 90, sage_pendant: 100, healer_locket: 90,
    warding_amulet: 110, ember_ward: 60, frost_ward: 60, storm_ward: 60
  };
  const G = window.GAME_DATA.gear;
  for (const id of Object.keys(P)) if (G[id]) G[id].price = P[id];
})();
