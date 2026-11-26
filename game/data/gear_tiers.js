/* Gear tiers (design/gear_tiers.md). Seven material tiers generated from the tier 1 items in gear.js, no random affixes.
   - Tier 1 is gear.js. Tiers 2 to 7 get the id t<N>_<base> (t2_iron_sword), the material word swapped into the name, whole-number stat steps and a price.
   - Weapons: strike power steps by weapon (+3 melee two-handers, +2 one-handers and ranged two-handers, +1 light weapons, wands, staves, lute).
   - Armor, shields and helms: armor or resistance +1 every tier on the main stat, the other stat +1 at tiers 3, 5 and 7. HP and mana on armor and shields use
     the tables below (as in Final Fantasy Tactics). This file also sets those tier 1 values on the gear.js items.
   - Accessories do not follow the ladder: grades at tiers 1, 3, 5 and 7 (Fine, Greater, Grand), numbers scaled x1.25 / 1.5 / 1.75. Faction tokens are not tiered.
   - GAME_DATA.gearTiers: bands, tierForLevel, tierItem(id, tier), baseOf(id), shopCap. GAME_LOADOUT.tierOf(id).
   - Campaign hooks (shop stock by party level and settlement, road traders, reward items) are at the bottom and wait for GAME_CAMPAIGN.
   Numbers are a first pass: tune in T below. */
(function () {
  const D = window.GAME_DATA, G = D && D.gear; if (!G || D.gearTiers) return;
  const T = D.gearTiers = {
    names: {
      metal: ['Iron', 'Steel', 'Silversteel', 'Mithril', 'Adamant', 'Dragonsteel', 'Starforged'],
      cloth: ['Linen', 'Wool', 'Silk', 'Moonsilk', 'Spidersilk', 'Aetherweave', 'Starweave'],
      wood:  ['Ash', 'Oak', 'Yew', 'Ironwood', 'Ebon', 'Heartwood', 'Worldwood']
    },
    grades: { 1: '', 3: 'Fine', 5: 'Greater', 7: 'Grand' },                 // accessories
    gradeMult: { 1: 1, 3: 1.25, 5: 1.5, 7: 1.75 },
    bands: [1, 8, 15, 22, 29, 37, 45],                                        // first enemy level of each tier (7 to 8 levels wide; the level cap is 50)
    price: [1, 1.6, 2.4, 3.4, 4.6, 6, 8],
    // strike steps per tier by weapon family (default 1)
    pStep: { sword: 2, mace: 2, javelin: 2, greatsword: 3, katana: 3, maul: 3, polearm: 3, spear: 3, bow: 2, crossbow: 2, wand: 2, staff: 3 },
    spellStep: { wand: 3, staff: 5 },                                         // spell power points gained per tier on wands and staves
    // armor tables: main = the stat that steps every tier; hp / mana = [tier 1 value, step]; step is a number per tier, or 'odd' (+1 at tiers 3, 5, 7)
    armor: {
      plate_armor:   { main: 'armor', hp: [4, 4] },
      plate_helm:    { main: 'armor', hp: [2, 2] },
      chain_hauberk: { main: 'armor', hp: [3, 3], mana: [2, 'odd'] },
      chain_coif:    { main: 'armor', hp: [2, 1], mana: [1, 0] },
      mystic_robe:   { main: 'res',   hp: [2, 1], mana: [4, 1] },
      silk_hood:     { main: 'res',   hp: [1, 'odd'], mana: [2, 1] }
    },
    off: {                                                                    // off hand: each stat [step]; HP and mana as armor
      buckler:      { main: 'armor', hp: [3, 1] },
      round_shield: { main: 'armor', hp: [4, 1] },
      tower_shield: { main: 'armor', hp: [6, 1] },
      warding_totem:{ main: 'res', healPow: 'odd' },
      spellbook:    { spellPow: 'odd', mana: [4, 'odd'] },
      tome_focus:   { mana: [8, 'odd'] },
      holy_relic:   { healPow: 'odd', mana: [2, 'odd'] }
    },
    shopCap: { village: 2, town: 3, market: 4, hall: 4, capital: 7 }          // highest tier a settlement of that type stocks (default 2)
  };
  const odd = k => Math.floor(k / 2), stepOf = (s, k) => s === 'odd' ? odd(k) : (s || 0) * k;
  const clone = o => JSON.parse(JSON.stringify(o));
  const baseIds = Object.keys(G);
  const isAcc = it => it.slot === 'Accessory' && !it.token;
  const family = it => it.weapon ? (['bow', 'crossbow', 'staff', 'instrument', 'wand'].includes(it.weapon.family) ? 'wood' : 'metal')
    : it.slot === 'OffHand' ? (it.offType === 'book' ? 'cloth' : it.offType === 'relic' && it.res ? 'wood' : 'metal') : it.weight === 'light' ? 'cloth' : 'metal';
  const add = (o, k, n) => { if (n) o[k] = (o[k] || 0) + n; };
  const sm = (it, k, v) => { it.statMods = Object.assign({}, it.statMods); it.statMods[k] = v; };

  // the item at tier t (a fresh object). t is 1 to 7; accessories use the grade tiers.
  function scaled(id, t) {
    const b = G[id], it = clone(b), k = t - 1, o = odd(k); it.base = id; it.tier = t; delete it.price;
    if (b.weapon) {
      const w = it.weapon, f = w.family;
      w.p = b.weapon.p + (T.pStep[f] !== undefined ? T.pStep[f] : 1) * k;
      if (w.ignoreArmor) w.ignoreArmor += k;
      if (T.spellStep[f]) add(it, 'spellPow', T.spellStep[f] * k); else if (f === 'instrument') add(it, 'healPow', k);
    } else if (T.armor[id] || T.off[id]) {
      const R = T.armor[id] || T.off[id];
      if (R.main) { const other = R.main === 'armor' ? 'res' : 'armor'; add(it, R.main, k); if (T.armor[id]) add(it, other, o); }
      if (R.hp) sm(it, 'hp', R.hp[0] + stepOf(R.hp[1], k));
      if (R.mana) sm(it, 'mana', R.mana[0] + stepOf(R.mana[1], k));
      if (R.healPow) add(it, 'healPow', stepOf(R.healPow, k));
      if (R.spellPow) add(it, 'spellPow', stepOf(R.spellPow, k));
      if (T.armor[id]) { if (b.spellPow) add(it, 'spellPow', o); }
    } else if (isAcc(b)) {
      const f = T.gradeMult[t], r = v => Math.round(v * f);
      ['armor', 'res', 'crit', 'spellPow', 'healPow'].forEach(x => { if (it[x]) it[x] = r(it[x]); });
      for (const e in it.elemRes || {}) it.elemRes[e] = r(it.elemRes[e]);
      for (const s in it.statMods || {}) if (s === 'hp' || s === 'mana') it.statMods[s] = r(it.statMods[s]);
    }
    return it;
  }
  const bonus = it => {
    const p = [], s = it.statMods || {};
    if (it.armor) p.push('+' + it.armor + '% armor'); if (it.res) p.push('+' + it.res + '% resistance');
    if (it.spellPow) p.push('+' + it.spellPow + '% spell power'); if (it.healPow) p.push('+' + it.healPow + '% heal power');
    if (s.hp) p.push((s.hp > 0 ? '+' : '') + s.hp + ' HP'); if (s.mana) p.push('+' + s.mana + ' mana'); if (s.manaRegen) p.push('+' + s.manaRegen + ' mana regeneration');
    if (s.spd) p.push((s.spd > 0 ? '+' : '') + s.spd + ' Speed'); return p.join(', ');
  };
  function describe(it, b) {
    if (it.weapon) {                                     // keep the flavour text, refresh the numbers
      const w = it.weapon; let d = b.desc.replace(/Attack: \d+ damage/, 'Attack: ' + w.p + ' damage');
      if (w.ignoreArmor) d = d.replace(/ignores \d+% of armor/, 'ignores ' + w.ignoreArmor + '% of armor');
      if (it.spellPow) d = d.replace(/\+\d+% spell power/, '+' + it.spellPow + '% spell power');
      if (it.healPow) d = d.replace(/\+\d+% heal power/, '+' + it.healPow + '% heal power');
      return d;
    }
    if (it.offType === 'shield') return (it.costMods && it.costMods.guard ? 'Small shield: lets you Guard, Guard costs 1 less, ' : 'Lets you Guard. ') + bonus(it) + '.';
    if (it.slot === 'Head' || it.slot === 'Body') return { heavy: 'Heavy. ', medium: 'Medium. ', light: 'Light. ' }[it.weight] + bonus(it) + '.';
    if (it.slot === 'OffHand') return bonus(it) + '.';
    return it.desc;
  }
  const nameOf = (b, t) => {
    if (b.tier > 1 || t === 1) return b.name;
    const fam = T.names[family(b)] || T.names.metal, word = fam[t - 1];
    if (isAcc(b)) return T.grades[t] + ' ' + b.name;
    const first = b.name.split(' ')[0]; if (T.names.metal.includes(first) || T.names.cloth.includes(first) || T.names.wood.includes(first)) return word + ' ' + b.name.slice(first.length + 1);
    return word + ' ' + b.name;
  };
  const priceOf = (b, t) => Math.round(b.price * T.price[t - 1] / 5) * 5;

  // ---- build: tier 1 values on the gear.js items, then tiers 2 to 7 ----
  const made = {};
  baseIds.forEach(id => { const b = G[id]; if (b.token || !(b.weapon || T.armor[id] || T.off[id] || isAcc(b))) return; b.tier = 1; b.base = id;
    if (T.armor[id] || T.off[id]) { const s1 = scaled(id, 1); ['armor', 'res', 'spellPow', 'healPow', 'statMods'].forEach(x => { if (s1[x] !== undefined) b[x] = s1[x]; }); }
    b.desc = describe(b, Object.assign({}, b)); made[id] = true; });
  baseIds.forEach(id => { if (!made[id]) return; const b = G[id];
    for (let t = 2; t <= 7; t++) {
      if (isAcc(b) && !T.grades[t]) continue;
      const it = scaled(id, t); it.name = nameOf(b, t); it.price = priceOf(b, t); it.desc = describe(it, b); G['t' + t + '_' + id] = it;
    }
  });
  // accessory descriptions: swap each number in the base text for the scaled one
  Object.keys(G).forEach(id => { const it = G[id]; if (!(it.tier > 1 && isAcc(it))) return; const b = G[it.base]; let d = b.desc;
    if (it.statMods && it.statMods.hp !== undefined && b.statMods) d = d.replace(/\+\d+ max HP/, '+' + it.statMods.hp + ' max HP');
    if (it.statMods && it.statMods.mana !== undefined && b.statMods && b.statMods.mana) d = d.replace(/\+\d+ mana(?! reg)/, '+' + it.statMods.mana + ' mana');
    if (it.crit) d = d.replace(/\+\d+% crit/, '+' + it.crit + '% crit'); if (it.spellPow) d = d.replace(/\+\d+% spell/, '+' + it.spellPow + '% spell'); if (it.healPow) d = d.replace(/\+\d+% heal/, '+' + it.healPow + '% heal');
    if (it.armor) d = d.replace(/\+\d+% armor/, '+' + it.armor + '% armor'); if (it.res) d = d.replace(/\+\d+% resistance(?! to)/, '+' + it.res + '% resistance');
    for (const e in it.elemRes || {}) d = d.replace(/\+\d+% resistance to/, '+' + it.elemRes[e] + '% resistance to'); it.desc = d; });

  // every tiered weapon needs its Attack ability (loadout.js registered only the tier 1 weapons when it loaded)
  if (window.GAME_LOADOUT && window.GAME_LOADOUT.registerAttacks) window.GAME_LOADOUT.registerAttacks();

  // ---- helpers ----
  T.baseOf = id => (G[id] && G[id].base) || id;
  T.tierForLevel = lv => { let t = 1; T.bands.forEach((b, i) => { if (lv >= b) t = i + 1; }); return t; };
  T.tierOfItem = id => (G[id] && G[id].tier) || 1;
  T.tierItem = function (id, t) {
    const b = T.baseOf(id), it = G[b]; if (!it || it.token || !it.tier) return id; t = Math.max(1, Math.min(7, t));
    if (isAcc(it)) { let g = 1; [3, 5, 7].forEach(x => { if (t >= x) g = x; }); t = g; }
    const out = t === 1 ? b : 't' + t + '_' + b; return G[out] ? out : id;
  };
  T.tierGear = (gear, t) => { const o = {}; for (const sl in gear || {}) o[sl] = T.tierItem(gear[sl], t); return o; };
  const LO = window.GAME_LOADOUT;
  if (LO) {
    LO.tierOf = T.tierOfItem;
    // lists that offer every item of a slot (the skirmish builder) show tier 1 only; the stash and shops use ids directly
    if (LO.itemsFor && !LO._tiersWrapped) { LO._tiersWrapped = true; const f = LO.itemsFor; LO.itemsFor = function () { return f.apply(this, arguments).filter(id => !(G[id].tier > 1)); }; }
  }

  // ---- campaign hooks: shops, road traders, rewards ----
  function hooks() {
    const C = window.GAME_CAMPAIGN; if (!C || !C.nodeServices || C.GEAR_TIERS) return false; C.GEAR_TIERS = true;
    const hsh = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const topLevel = st => Math.max(1, ...(st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1));
    // the top tier a shop stocks: the party's level band, capped by the size of the settlement, one more at Friendly or Allied standing
    C.shopTier = function (st, nodeId, standing) {
      const n = C.NODES[nodeId] || {}, cap = T.shopCap[n.type] || 2, t = Math.min(T.tierForLevel(topLevel(st)), cap) + (standing === 'friendly' || standing === 'allied' ? 1 : 0);
      return Math.max(1, Math.min(7, t));
    };
    // each item in a stock is sold at the top tier or one below
    C.promoteStock = (stock, top, seed) => stock.map(id => T.tierItem(id, top - (hsh(seed + '|' + id) % 2 ? 1 : 0)));
    const ns = C.nodeServices;
    C.nodeServices = function (st, id) {
      const sv = ns.apply(this, arguments); if (sv && sv.shop) { const top = C.shopTier(st, id, sv.tier); sv.shop.stock = C.promoteStock(sv.shop.stock, top, id + '|' + Math.floor(st.world.day / 4)); sv.shop.topTier = top; }
      return sv;
    };
    // reward items take the tier of the fight's level band; a dungeon's last floor is one above
    C.rewardTier = function (encId, lv) {
      let t = T.tierForLevel(lv || 1); const m = /^(dg_.+)_(\d+)$/.exec(encId || '');
      if (m) { const last = Math.max(...Object.keys(C.ENCOUNTERS).map(k => { const x = new RegExp('^' + m[1] + '_(\\d+)$').exec(k); return x ? +x[1] : 0; })); if (+m[2] === last && t > 1) t = Math.min(7, t + 1); }
      return t;
    };
    return true;
  }
  if (!hooks() && typeof setTimeout === 'function') { let n = 0; (function wait() { if (hooks()) return; if (++n < 400) setTimeout(wait, 25); })(); }
})();
