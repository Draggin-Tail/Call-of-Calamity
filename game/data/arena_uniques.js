/* The seven Sandring uniques (design/arena.md). Arena-only: not sold, found once per save, from the first time the condition is true.
   Added to GAME_DATA.gear / D.uniques and to GAME_CAMPAIGN.UNIQUE_AWARDS, so uniques.js hands them out and reports them as "A rare find".
   Loaded after uniques.js and arena.js. Effects use the plain trigger vocabulary (combatRules.keywords). */
(function () {
  const D = window.GAME_DATA, G = D && D.gear; if (!G || !D.uniques || D.arenaUniques) return; D.arenaUniques = 1;
  const clone = o => JSON.parse(JSON.stringify(o)), U = D.uniques;
  const T = (on, ifc, limit, effects) => { const o = { on, effects }; if (ifc) o.if = ifc; if (limit) o.limit = limit; return o; };
  const bonus = it => { const p = [], s = it.statMods || {}; if (it.armor) p.push('+' + it.armor + '% armor'); if (it.res) p.push('+' + it.res + '% resistance'); if (it.spellPow) p.push('+' + it.spellPow + '% spell power'); if (it.crit) p.push('+' + it.crit + '% crit chance'); if (s.hp) p.push('+' + s.hp + ' HP'); if (s.mana) p.push('+' + s.mana + ' mana'); if (s.spd) p.push('+' + s.spd + ' Speed'); return p.join(', '); };
  function make(id, s) {
    let it;
    if (s.acc) it = Object.assign({ slot: 'Accessory' }, clone(s.acc));
    else { const src = s.tier === 1 ? G[s.base] : G['t' + s.tier + '_' + s.base]; if (!src) { console.warn('arena uniques: no source for ' + id); return; } it = clone(src); delete it.base; delete it.tier; delete it.price; for (const k in (s.add || {})) if (k !== 'statMods') it[k] = (it[k] || 0) + s.add[k]; if (s.add && s.add.statMods) { it.statMods = Object.assign({}, it.statMods); for (const k in s.add.statMods) it.statMods[k] = (it.statMods[k] || 0) + s.add.statMods[k]; } }
    it.name = s.name; it.unique = 1; it.equiv = s.equiv || s.tier; it.lore = s.lore; it.effect = s.effect; it.triggers = s.triggers;
    const w = it.weapon, b = bonus(it);
    it.desc = s.lore + ' ' + s.effect + (w ? ' Attack: ' + w.p + ' damage' + (w.r > 1 ? ', range ' + w.r : '') + '.' : '') + (b ? ' ' + b + '.' : '');
    G[id] = it; U[id] = it;
  }
  make('pitfighters_wraps', { base: 'wraps', tier: 2, name: "Pitfighter's Wraps", lore: 'Sweat-black linen from the Pit. The Sandmaster pays for these in blood and keeps the wearer.',
    effect: 'A hit on a target below half health deals 2 more damage, once a turn.',
    triggers: [T('onHit', { subjectHpBelowPct: 50 }, 'oncePerTurn', [{ type: 'damage', target: 'victim', amount: 2 }])] });
  make('dust_devil', { base: 'katana', tier: 3, name: 'Dust-Devil', lore: 'A thin blade that won the Sand ring more than once. Nobody remembers who owned it first.',
    effect: 'A kill grants haste for 1 turn, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'applyStatus', target: 'self', status: 'haste', turns: 1 }])] });
  make('crowds_favourite', { base: 'chain_hauberk', tier: 4, name: "Crowd's Favourite", lore: 'Gilded rings sewn in for the cheering. They turn a blade as well as plain ones.',
    effect: 'A ward of 6 rises around you at the start of each battle.', add: { statMods: { hp: 4 } },
    triggers: [T('onBattleStart', null, null, [{ type: 'shield', target: 'self', amount: 6 }])] });
  make('the_last_bell', { base: 'longbow', tier: 5, name: 'The Last Bell', lore: 'The Gate ring rings a bell for the final bout. This bow was drawn when it stopped.',
    effect: 'A hit from higher ground deals 3 more damage, once a turn.',
    triggers: [T('onHit', { heightAdvantage: true }, 'oncePerTurn', [{ type: 'damage', target: 'victim', amount: 3 }])] });
  make('laurel_of_the_sandring', { equiv: 4, name: 'Laurel of the Sandring', lore: 'Dry leaves on a brass band, handed to the Tourney champion.',
    effect: 'A kill heals every ally for 3, once a turn.',
    acc: { statMods: { hp: 6 }, triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'heal', target: 'allAllies', amount: 3 }])] } });
  make('ledger_of_bouts', { base: 'spellbook', tier: 4, name: 'Ledger of Bouts', lore: "The House Champion's own book of wins, rival names inked out one by one.",
    effect: 'A kill cuts the cooldown of all your abilities by 1, once a turn.',
    triggers: [T('onKill', null, 'oncePerTurn', [{ type: 'reduceCooldown', target: 'self', amount: 1 }])] });
  make('gamblers_die', { equiv: 3, name: "Gambler's Die", lore: 'Bone, worn smooth. Ten winning bets and the house lets you keep it.',
    effect: 'Lucky: +6% crit chance and +1 Speed.', acc: { crit: 6, statMods: { spd: 1 } } });

  function hooks() {
    const C = window.GAME_CAMPAIGN; if (!C || !C.UNIQUE_AWARDS || !C.arenaState) return false;
    const won = (st, id) => !!(st.campaign && st.campaign.completed && st.campaign.completed.includes(id)), A = st => C.arenaState(st) || {};
    Object.assign(C.UNIQUE_AWARDS, {
      pitfighters_wraps: st => won(st, 'arena_pit_3'), dust_devil: st => won(st, 'arena_sand_3'), crowds_favourite: st => won(st, 'arena_gold_3'), the_last_bell: st => won(st, 'arena_gate_3'),
      laurel_of_the_sandring: st => (A(st).titles || 0) >= 1, ledger_of_bouts: st => !!A(st).houseBeaten, gamblers_die: st => (A(st).wagersWon || 0) >= 10
    });
    if (window.GAME_LOADOUT && window.GAME_LOADOUT.registerAttacks) window.GAME_LOADOUT.registerAttacks();
    return true;
  }
  if (!hooks() && typeof setTimeout === 'function') { let n = 0; (function wait() { if (hooks()) return; if (++n < 400) setTimeout(wait, 25); })(); }
})();
