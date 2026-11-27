/* Loot and shops (design/loot_and_shops.md).
   - Shops: every shop is filled to a size by settlement type (village 8, town 9, market 10, capital 12), keeping its written stock as the core.
     Each region has favoured items (weight 4 against 1), never an exclusive list. The fill is seeded by the place's id, so a place keeps its character.
     Eight items that no shop sold are stocked by named specialist places (L.specialty); the Gloom pair at Low Docks only at Friendly standing with the Syndicate.
   - Drops: after a won fight, one chance at one item a slain foe was wearing (even weights), plus a separate chance at a small purse of gold.
     Wild monsters, summons and the arena drop nothing. The roll is seeded by the fight, the day, the foes slain and the battle count, so a reload does not reroll it.
   - Result: C.applyEncounterResult returns { drops: [itemId], purse: gold } besides what it returned before. Everything is in GAME_CAMPAIGN.LOOT to tune. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE, D = window.GAME_DATA, LO = window.GAME_LOADOUT;
    if (!C || !S || !D || !C.STORY_WORLD || !C.GOLD || !C.applyEncounterResult || !C.encounterBuilds || !D.gearTiers || C.LOOT) return false;
    const G = D.gear, T = D.gearTiers;
    const L = C.LOOT = {
      mix: {
        village: { MainHand: 3, OffHand: 1, Head: 1, Body: 1, Accessory: 2 }, town: { MainHand: 3, OffHand: 2, Head: 1, Body: 1, Accessory: 2 },
        market: { MainHand: 4, OffHand: 2, Head: 1, Body: 1, Accessory: 2 }, hall: { MainHand: 4, OffHand: 2, Head: 2, Body: 1, Accessory: 2 },
        capital: { MainHand: 4, OffHand: 2, Head: 2, Body: 2, Accessory: 2 }
      },
      fixedShops: ['the_sandring'],                                                      // places that set their own stock (the arena stall) are never filled
      favourWeight: 4,                                                                    // a favoured item against 1 for any other
      favoured: {
        crownlands: 'iron_sword iron_mace longbow spear round_shield chain_hauberk chain_coif healer_locket',
        free_marches: 'iron_sword longbow javelin spear hand_crossbow round_shield traveler_boots swift_charm',
        dwarven_holds: 'maul greatsword halberd crossbow tower_shield plate_armor plate_helm knuckles vigor_ring ember_ward',
        iceflow: 'spear javelin longbow katana wand_cold frost_ward warding_amulet chain_hauberk round_shield',
        river_cities: 'steel_dagger hand_crossbow buckler swift_charm traveler_boots focus_charm mana_ring chain_coif lute',
        voldun: 'staff_holy staff_arcane staff_fire wand_holy wand_arcane wand_fire spellbook tome_focus holy_relic mystic_robe silk_hood sage_pendant mana_ring warding_amulet iron_mace',
        elven_realms: 'longbow katana wand_nature staff_nature warding_totem silk_hood mystic_robe traveler_boots swift_charm lute tome_focus',
        orc_lands: 'greatsword maul halberd knuckles wraps iron_mace plate_armor chain_hauberk tower_shield vigor_ring',
        goblin_fens: 'hand_crossbow steel_dagger javelin wand_nature wand_storm buckler healer_locket ember_ward storm_ward'
      },
      specialty: { frostgate: ['staff_cold'], koestielve: ['staff_cold'], bilgeport: ['wand_fire'], scriptorium_row: ['wand_arcane'], cogsmith_row: ['staff_storm'], slagmarket: ['claws'], toadstool_market: ['siphon_band'] },
      specialtyFriendly: { low_docks: ['wand_shadow', 'staff_shadow'] },                  // stocked only at Friendly or Allied standing (the place's existing shopFriendly list)
      drop: {
        ordinary: 0.30, leaderFell: 0.50, named: 1, floor: 0.35, boss: 1, bossRepeat: 0.5, replay: 0.5,   // chance of one item
        leaderAccessory: 0.25                                                             // when a leader fell and an item drops, the share that is an accessory instead
      },
      purse: {                                                                            // [chance, share of the standard pay for a fight at that level (C.goldFor)]
        ordinary: [0.35, 0.15], leaderFell: [0.60, 0.25], named: [1, 0.25], floor: [0.35, 0.15], boss: [1, 0.25], min: 5
      },
      signature: {                                                                        // foe class: extra items it can drop besides what it wears
        necro: ['staff_shadow', 'siphon_band'], shadowmage: ['staff_shadow'], shadowknight: ['siphon_band'], blood_knight: ['siphon_band']
      },
      iceFaction: 'ivory'                                                                 // any caster of this faction can drop the Frost Staff
    };
    const RARE = ['claws', 'wand_fire', 'wand_arcane', 'wand_shadow', 'staff_cold', 'staff_storm', 'staff_shadow', 'siphon_band'];
    const hsh = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const rng = seed => { let x = hsh(seed) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
    const baseItems = Object.keys(G).filter(i => !(G[i].tier > 1) && !G[i].unique && !G[i].token && G[i].price);
    const sellable = baseItems.filter(i => !RARE.includes(i));
    const favSets = {}; Object.keys(L.favoured).forEach(r => { favSets[r] = new Set(L.favoured[r].split(' ')); });
    const unknown = []; Object.values(L.favoured).forEach(s => s.split(' ').forEach(i => { if (!G[i]) unknown.push(i); })); if (unknown.length) throw new Error('loot: unknown favoured item ' + unknown.join(', '));

    // ---- shops: filled once, at load ----
    C.fillShop = function (id) {
      const n = C.NODES[id]; if (!n || !n.shop || n.arena || n.fixedShop || L.fixedShops.includes(id)) return null;
      const q = L.mix[n.type] || L.mix.village, fav = favSets[C.areaOf(id)] || new Set(), r = rng('shop|' + id), spec = (L.specialty[id] || []).filter(i => G[i]);
      const out = n.shop.slice(); spec.forEach(i => { if (!out.includes(i)) out.push(i); });
      const have = new Set(out);
      for (const slot of Object.keys(q)) {
        let cnt = out.filter(i => G[i] && G[i].slot === slot && !spec.includes(i)).length;
        while (cnt < q[slot]) {
          const pool = sellable.filter(i => G[i].slot === slot && !have.has(i)); if (!pool.length) break;
          const wts = pool.map(i => fav.has(i) ? L.favourWeight : 1), tot = wts.reduce((a, b) => a + b, 0); let x = r() * tot, k = 0; while (k < pool.length - 1 && x >= wts[k]) { x -= wts[k]; k++; }
          have.add(pool[k]); out.push(pool[k]); cnt++;
        }
      }
      n.shop = out; return out;
    };
    Object.keys(C.NODES).forEach(id => { if (C.NODES[id].shop && !C.NODES[id]._lootFilled) { C.fillShop(id); C.NODES[id]._lootFilled = true; } });
    Object.entries(L.specialtyFriendly).forEach(([id, items]) => { const n = C.NODES[id]; if (n && n.shop) n.shopFriendly = (n.shopFriendly || []).concat(items.filter(i => G[i] && !(n.shopFriendly || []).includes(i))); });

    // ---- drops ----
    const wearsGear = b => b && b.gear && Object.keys(b.gear).length && D.classes[b.primary] && D.classes[b.primary].selectable !== false && !D.classes[b.primary].monster;
    const canDrop = id => G[id] && !G[id].unique && !G[id].token && G[id].price;
    const isCaster = b => { const c = D.classes[b.primary] || {}; return c.role === 'caster' || c.role === 'healer' || b.primary === 'apprentice' || b.primary === 'shadowmage'; };
    function pickDrop(info, slain, leaderFell, r) {
      const band = T.tierForLevel(info.rec || 1);
      if (leaderFell && r() < L.drop.leaderAccessory) {
        const acc = sellable.filter(i => G[i].slot === 'Accessory'); if (acc.length) return T.tierItem(acc[Math.floor(r() * acc.length)], band);
      }
      const pool = [];
      slain.forEach(b => {
        const worn = Object.values(b.gear).filter(canDrop); worn.forEach(i => pool.push(i));
        const tier = Math.max(1, ...worn.map(i => T.tierOfItem(i)));
        (L.signature[b.primary] || []).forEach(i => { if (canDrop(i)) pool.push(T.tierItem(i, tier)); });
        if (isCaster(b) && b.faction === L.iceFaction && canDrop('staff_cold')) pool.push(T.tierItem('staff_cold', tier));
      });
      return pool.length ? pool[Math.floor(r() * pool.length)] : null;
    }
    { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
        const E = C.ENCOUNTERS[encId], won = !!(res && res.won), info = won && E && !E.arena ? C.encounterBuilds(encId, optionId) : null;
        const replay = !!(encId !== 'wander' && st.campaign && st.campaign.completed && st.campaign.completed.includes(encId));
        const dg = info && E.dungeon ? C.dungeonStatus(st, E.dungeon) : null, battles = (st.campaign && st.campaign.battles || []).length, day = st.world.day;
        const out = ae0.apply(this, arguments); if (!info || !out || !out.ok) return out;
        const killed = new Set((res.kills || []).filter(k => k.victimTeam === 'E').map(k => String(k.victim)));
        const slain = info.builds.filter(b => killed.has(String(b.id)) && wearsGear(b)); if (!slain.length) return out;
        const lead = info.objective && info.objective.type === 'leader' ? info.builds[info.objective.leader || 0] : null, leaderFell = !!(lead && killed.has(String(lead.id)));
        const named = slain.some(b => C.NAMED && C.NAMED[b.name]);
        let cd = L.drop.ordinary, cp = L.purse.ordinary;
        if (E.dungeon) { const boss = dg && E.floor === dg.floors; if (boss) { cd = dg.clears > 0 ? L.drop.bossRepeat : L.drop.boss; cp = L.purse.boss; } else { cd = L.drop.floor; cp = L.purse.floor; } }
        else if (named) { cd = L.drop.named; cp = L.purse.named; } else if (leaderFell) { cd = L.drop.leaderFell; cp = L.purse.leaderFell; }
        if (replay) cd *= L.drop.replay;
        const r = rng('loot|' + encId + '|' + day + '|' + slain.map(b => b.id).join(',') + '|' + battles), rollDrop = r(), rollPurse = r();
        if (rollDrop < cd) { const id = pickDrop(info, slain, leaderFell, r); if (id && G[id]) { st.inventory.items[id] = (st.inventory.items[id] || 0) + 1; out.drops = [id]; } }
        if (rollPurse < cp[0]) { const g = Math.max(L.purse.min, Math.round(C.goldFor(info.rec || 1) * cp[1] * (replay ? L.drop.replay : 1))); st.inventory.gold += g; out.purse = g; }
        return out; }; }
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
