/* Game state and saving for the campaign. Pure logic (no screens): the state object, save slots, export / import, faction standing and rank rules,
   and applying a battle result. The menus (step 5) will sit on top of window.GAME_SAVE.
   Load after combatRules, classes, abilities, passives, gear and loadout. Races and factions data are optional here: if GAME_DATA.races /
   GAME_DATA.factions are missing the rules still run (faction ripple needs GAME_DATA.factions[id].relations = { otherId: -1..1 }).

   STATE SHAPE (version 1)
   { v, meta{ name, slot, created, updated, playtimeNote },
     player{ name, race },
     roster[ { id, name, race, primary, secondary, passives[], gear{slot:item}, level, xp, jp, unlocked[classIds] } ],
     party[ unit ids in battle order ],
     inventory{ gold, items{ itemId: count } },
     factions{ standing{ id: -1000..1000 }, ranks{ id: { rank, dormant, trust, since } } (one at most), history[ { day, faction, delta, reason } ] },
     world{ day, calamity, location, nodes{ nodeId: { owner, discovered } }, flags{} },
     campaign{ completed[], battles[ { day, node, won, turns, kills } ] },
     settings{}, nextId }
   The numbers in RULES are first guesses and meant to be tuned. */
(function () {
  const G = () => window.GAME_DATA;
  const LO = () => window.GAME_LOADOUT;
  const S = {};
  S.VERSION = 1;
  S.SLOTS = ['1', '2', '3', 'auto'];
  const KEY = 'coc_save_', META_KEY = 'coc_saves_meta';

  // ---- tunable rules ----
  S.RULES = {
    standingMin: -1000, standingMax: 1000,
    tiers: [                                   // four-step ladder, numbers shown to the player
      { id: 'hostile', name: 'Hostile', min: -1000 },
      { id: 'neutral', name: 'Neutral', min: -250 },
      { id: 'friendly', name: 'Friendly', min: 250 },
      { id: 'allied', name: 'Allied', min: 600 }
    ],
    killPenalty: 5,                            // standing lost with a faction per member killed
    rippleFactor: 0.5,                         // share of a change passed to related factions (relation -1..1)
    leavePenalty: 60,                          // standing lost with the faction you leave
    historyCap: 200, battleCap: 200,
    startGold: 100,
    shop: { sellFraction: 0.5 },
    partySize: 3, rosterCap: 14, recruitCost: 100,   // battle party size (the maps have 3 spawn tiles per side), roster limit, gold per recruit (+20 per level)               // items sell back at this share of their price
    fightTiers: [[1, 3], [11, 4], [21, 5], [31, 6]],   // [leader level, fight size]: the most units either side fields in a fight (design/party_slots_and_recruiting.md)
    catchUp: { perLevel: 0.10, max: 1.0 },     // units below the leader's level earn this much more XP and JP per level of gap (up to +100%); it fades as they close the gap
    bench: { rate: 0.35 },                     // roster units not in the party (and not away) earn this share of the average fielded unit's XP and JP from each battle
    dispatch: { maxOut: 3, xpBase: 30, xpPerLevel: 12, jpBase: 100, goldShare: 0.5,   // a dispatch pays like a notch below a fight at the leader's level, times the kind's size
      kinds: { patrol: { name: 'Patrol', days: 3, mult: 0.75, desc: 'A short walk of the nearby roads.' },
               escort: { name: 'Escort', days: 6, mult: 1.8, desc: 'Seeing a caravan to the next town and back.' },
               expedition: { name: 'Expedition', days: 10, mult: 3.5, desc: 'A long job far afield. They are gone a while.' } } },
    mapSpawnCap: 6,                            // the most any fight uses; each map then limits it to its own spawn tiles (C.partyLimit, C.mapCap)
    jp: {                                      // job points: earned in battle into the pool of the unit's current class
      perAbility: 6,                           // each ability used (basic Attack, Move and Guard excluded)
      perHelp: 4,                              // each ability cast on an ally
      perKill: 15,
      winBonus: 40,                            // every party member on a win
      koWinFraction: 0.5,                      // knocked-out members get this share of the win bonus (no permadeath, no penalty)
      repeatFraction: 0.5                      // replaying a completed encounter pays this share
    },
    xp: { perKill: 8 },                        // extra XP per kill on top of the encounter's XP (which every party member gets on a win)
    skill: { base: 100, step: 50, tierMult: { 1: 1, 2: 1, 3: 1.25 }, scale: 0.7 }   // skill 1 of a class is free; skill n costs (base + step*(n-2)) x tier multiplier
  };

  // ---- safe storage: localStorage can be missing, blocked or full, so every access is guarded and falls back to memory ----
  const mem = {};
  let store = null, storageOk = null;
  function backend() {
    if (store) return store;
    try {
      const ls = window.localStorage; ls.setItem('__coc_t', '1'); ls.removeItem('__coc_t');
      store = ls; storageOk = true;
    } catch (e) {
      store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
      storageOk = false;
    }
    return store;
  }
  S.storageOk = () => { backend(); return storageOk; };
  S._resetBackend = () => { store = null; storageOk = null; };
  const rd = k => { try { return backend().getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { backend().setItem(k, v); return { ok: true }; } catch (e) { return { ok: false, error: 'Storage failed: ' + (e && e.message || e) }; } };
  const rm = k => { try { backend().removeItem(k); } catch (e) { /* ignore */ } };

  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(+n) ? +n : 0)));

  // ---- units and builds ----
  const entryClasses = () => Object.keys(G().classes).filter(id => G().classes[id].selectable !== false && G().classes[id].tier === 1);
  S.entryClasses = entryClasses;
  S.makeUnit = function (st, o) {
    const cls = G().classes[o.primary];
    if (!cls || cls.selectable === false) throw new Error('Unknown or unselectable class: ' + o.primary);
    const id = 'u' + (st.nextId++);
    const passives = (o.passives || []).filter(p => G().passives[p]);
    return {
      id, name: o.name || cls.name, race: o.race || (st.player && st.player.race) || null,
      primary: o.primary, secondary: o.secondary || null, passives,
      gear: o.gear ? clone(o.gear) : LO().defaultGear(o.primary),
      level: LO().levelForXp(o.xp !== undefined ? o.xp : LO().xpForLevel(o.level || 1)), xp: o.xp !== undefined ? o.xp : LO().xpForLevel(o.level || 1),
      jp: Object.assign({}, o.jp || {}),                        // JP pool per class: { classId: n }
      learned: clone(o.learned || {}),                          // skills bought with JP per class (the first skill of every class is free)
      passivesKnown: Array.from(new Set([...(o.passivesKnown || []), ...passives])),
      unlocked: Array.from(new Set([...(o.unlocked || entryClasses()), o.primary]))
    };
  };
  // What the battle engine takes (Battle.start playerBuilds). Gear is cleaned to what the class may legally equip.
  S.toBuild = function (u, faction) {
    return { id: u.id, name: u.name, race: u.race || null, level: u.level || 1, faction: faction || (u.faction || 'player'), primary: u.primary, secondary: u.secondary || null,
      passives: (u.passives || []).slice(), gear: LO().cleanGear(u.primary, u.gear || {}, u.passives || []),
      skills: S.knownSkills(u, u.primary), secSkills: u.secondary ? S.knownSkills(u, u.secondary) : [] };   // only learned skills are usable in battle
  };
  S.partyBuilds = st => st.party.map(id => st.roster.find(u => u.id === id)).filter(Boolean).map(u => S.toBuild(u));

  // ---- new game ----
  // opts: { name, race, slot, recruits: [{ name, primary }], gold, location, standing: {faction: n}, day }
  S.newGame = function (opts) {
    opts = opts || {};
    const now = Date.now();
    const st = {
      v: S.VERSION,
      meta: { name: opts.name || 'New game', slot: opts.slot || null, created: now, updated: now },
      player: { name: opts.name || 'Hero', race: opts.race || null },
      roster: [], party: [],
      inventory: { gold: opts.gold !== undefined ? opts.gold : S.RULES.startGold, items: {} },
      factions: { standing: Object.assign({}, opts.standing || {}), history: [], relationOverrides: {}, ranks: {}, declined: {}, goodwill: 15 },
      world: { day: 0, calamity: 0, location: opts.location || null, nodes: {}, flags: {} },
      campaign: { completed: [], battles: [] },
      settings: {}, nextId: 1
    };
    const rec = opts.recruits || ['squire', 'scout', 'acolyte'].map(p => ({ primary: p }));
    rec.forEach(r => { const u = S.makeUnit(st, r); st.roster.push(u); st.party.push(u.id); });
    if (opts.day) st.world.day = opts.day;
    return st;
  };

  // ---- validation and repair ----
  // repair() fixes what can be fixed (drops unknown passives and gear, clamps numbers); validate() reports what is still wrong.
  S.repair = function (state) {
    const fixes = [], st = clone(state), D = G();
    st.inventory = isObj(st.inventory) ? st.inventory : { gold: 0, items: {} };
    st.inventory.gold = int(st.inventory.gold, 0, 1e9); st.inventory.items = isObj(st.inventory.items) ? st.inventory.items : {};
    for (const k of Object.keys(st.inventory.items)) { const n = int(st.inventory.items[k], 0, 9999); if (!n || (D.gear && !D.gear[k])) { if (n) fixes.push('Removed unknown item ' + k); delete st.inventory.items[k]; } else st.inventory.items[k] = n; }
    st.roster = Array.isArray(st.roster) ? st.roster : [];
    const seen = new Set();
    st.roster = st.roster.filter(u => {
      if (!isObj(u) || !u.id || seen.has(u.id)) { fixes.push('Dropped a duplicate or malformed unit'); return false; }
      if (!D.classes[u.primary] || D.classes[u.primary].selectable === false) { fixes.push('Dropped unit ' + u.id + ' with unknown class ' + u.primary); return false; }
      seen.add(u.id); return true;
    });
    st.roster.forEach(u => {
      u.name = String(u.name || D.classes[u.primary].name);
      if (u.secondary && (!D.classes[u.secondary] || D.classes[u.secondary].selectable === false || u.secondary === u.primary)) { fixes.push(u.name + ': removed invalid secondary'); u.secondary = null; }
      u.secondary = u.secondary || null;
      const p0 = Array.isArray(u.passives) ? u.passives : [];
      u.passives = p0.filter((p, i) => D.passives[p] && p0.indexOf(p) === i).slice(0, D.combatRules.build.passiveSlots);
      if (u.passives.length !== p0.length) fixes.push(u.name + ': removed invalid passives');
      const g0 = isObj(u.gear) ? u.gear : {};
      u.gear = LO().cleanGear(u.primary, g0, u.passives);
      if (Object.keys(u.gear).length !== Object.keys(g0).filter(k => g0[k]).length) fixes.push(u.name + ': removed gear this class cannot use');
      u.xp = int(u.xp, 0, 1e9); u.level = LO().levelForXp(u.xp);                      // level always follows total XP
      const jp0 = isObj(u.jp) ? u.jp : {}; u.jp = {};                                   // an old single number becomes an empty set of pools
      for (const c of Object.keys(jp0)) if (D.classes[c] && D.classes[c].selectable !== false) u.jp[c] = int(jp0[c], 0, 1e9);
      const lr0 = isObj(u.learned) ? u.learned : {}; u.learned = {};
      for (const c of Object.keys(lr0)) if (D.classes[c] && D.classes[c].selectable !== false && Array.isArray(lr0[c])) u.learned[c] = Array.from(new Set(lr0[c].filter(a => D.classes[c].ab.includes(a))));
      u.passivesKnown = Array.from(new Set([...(Array.isArray(u.passivesKnown) ? u.passivesKnown : []), ...u.passives].filter(p => D.passives[p])));
      u.unlocked = Array.from(new Set([...entryClasses(), ...(Array.isArray(u.unlocked) ? u.unlocked : []).filter(c => D.classes[c] && D.classes[c].selectable !== false), u.primary]));
      S.refreshUnlocks(u);
    });
    st.party = (Array.isArray(st.party) ? st.party : []).filter((id, i, a) => seen.has(id) && a.indexOf(id) === i);
    { const ds0 = isObj(st.dispatch) && Array.isArray(st.dispatch.out) ? st.dispatch.out : [], KD = S.RULES.dispatch.kinds, taken = new Set();
      st.dispatch = { out: ds0.filter(e => isObj(e) && seen.has(e.unit) && KD[e.kind] && !taken.has(e.unit) && taken.add(e.unit)).slice(0, S.RULES.dispatch.maxOut).map(e => ({ unit: e.unit, kind: e.kind, start: int(e.start, 0, 1e6), end: int(e.end, 0, 1e6),
        reward: { xp: int((e.reward || {}).xp || 0, 0, 1e6), jp: int((e.reward || {}).jp || 0, 0, 1e6), gold: int((e.reward || {}).gold || 0, 0, 1e6) } })) };
      st.party = st.party.filter(id => !taken.has(id)); }
    st.factions = isObj(st.factions) ? st.factions : { standing: {}, history: [] };
    st.factions.standing = isObj(st.factions.standing) ? st.factions.standing : {};
    for (const f of Object.keys(st.factions.standing)) st.factions.standing[f] = int(st.factions.standing[f], S.RULES.standingMin, S.RULES.standingMax);
    st.factions.history = Array.isArray(st.factions.history) ? st.factions.history.slice(-S.RULES.historyCap) : [];
    // The old allegiance oath is folded into the rank (your rank is your allegiance); it never gave more than a tavern line, so it is simply dropped.
    if (st.factions.allegiance) fixes.push('Dropped the old allegiance oath (' + st.factions.allegiance + '): your rank is your allegiance now');
    delete st.factions.allegiance; delete st.factions.lastSwitchDay;
    if (!isObj(st.factions.relationOverrides)) st.factions.relationOverrides = {};
    if (!isObj(st.factions.ranks)) st.factions.ranks = {};
    for (const f of Object.keys(st.factions.ranks)) { const r = st.factions.ranks[f], lad = S.RANK && S.RANK.ladders[f];
      if (!lad || !isObj(r)) { delete st.factions.ranks[f]; continue; }
      st.factions.ranks[f] = { rank: int(r.rank, 1, 4), dormant: !!r.dormant, trust: int(r.trust || 0, 0, 99), since: int(r.since || 0, 0, 1e6), wasSecret: !!r.secret }; }
    // One faction at a time (node ownership phase 2): an old save with several ranks keeps its highest public one (ties: the one held longest).
    { const ks = Object.keys(st.factions.ranks);
      if (ks.length > 1) { const R0 = st.factions.ranks, pick = ks.slice().sort((a, b) => (R0[a].wasSecret - R0[b].wasSecret) || (R0[b].rank - R0[a].rank) || (R0[a].since - R0[b].since))[0];
        ks.filter(f => f !== pick).forEach(f => { delete R0[f]; st.factions.history.push({ day: st.world && st.world.day || 0, faction: f, delta: 0, reason: 'you gave up this rank: you serve one faction at a time now' }); fixes.push('Kept one rank (' + pick + '), dropped ' + f); }); }
      for (const f of Object.keys(st.factions.ranks)) delete st.factions.ranks[f].wasSecret; }
    if (!isObj(st.factions.declined)) st.factions.declined = {};
    st.factions.goodwill = Math.max(15, Math.min(100, +st.factions.goodwill || 15));
    for (const k of Object.keys(st.factions.relationOverrides)) { const v = st.factions.relationOverrides[k]; if (typeof v !== 'number' || !isFinite(v) || !/^[a-z_]+>[a-z_]+$/.test(k)) delete st.factions.relationOverrides[k]; else st.factions.relationOverrides[k] = Math.max(-1, Math.min(1, v)); }
    st.world = isObj(st.world) ? st.world : {}; st.world.day = int(st.world.day, 0, 1e6); st.world.calamity = int(st.world.calamity, 0, 1e6);
    delete st.world.secret;   // double lives were cut (node ownership phase 2)
    st.world.nodes = isObj(st.world.nodes) ? st.world.nodes : {}; st.world.flags = isObj(st.world.flags) ? st.world.flags : {}; st.world.location = st.world.location || null;
    st.campaign = isObj(st.campaign) ? st.campaign : {}; st.campaign.completed = Array.isArray(st.campaign.completed) ? st.campaign.completed : [];
    st.campaign.battles = Array.isArray(st.campaign.battles) ? st.campaign.battles.slice(-S.RULES.battleCap) : [];
    st.meta = isObj(st.meta) ? st.meta : { name: 'Recovered game', created: Date.now(), updated: Date.now() };
    st.player = isObj(st.player) ? st.player : { name: 'Hero', race: null };
    st.settings = isObj(st.settings) ? st.settings : {};
    let maxN = 0; st.roster.forEach(u => { const m = /^u(\d+)$/.exec(u.id); if (m) maxN = Math.max(maxN, +m[1]); });
    st.nextId = Math.max(int(st.nextId || 1, 1, 1e9), maxN + 1);
    st.v = S.VERSION;
    return { state: st, fixes };
  };
  S.validate = function (st) {
    const errs = [];
    if (!isObj(st)) return ['Save is not an object'];
    if (st.v !== S.VERSION) errs.push('Unsupported version ' + st.v);
    ['meta', 'player', 'inventory', 'factions', 'world', 'campaign'].forEach(k => { if (!isObj(st[k])) errs.push('Missing ' + k); });
    if (!Array.isArray(st.roster) || !st.roster.length) errs.push('Roster is empty');
    if (!Array.isArray(st.party) || !st.party.length) errs.push('Party is empty');
    return errs;
  };

  // ---- versions: each entry upgrades a save from version n to n+1 ----
  const MIGRATIONS = {};     // e.g. MIGRATIONS[1] = st => { ...; st.v = 2; return st; }
  S._migrations = MIGRATIONS;
  function migrate(st) {
    if (!isObj(st)) return { error: 'Save is not valid JSON data' };
    let v = st.v === undefined ? 1 : st.v;
    if (typeof v !== 'number' || v < 1) return { error: 'Save has no valid version' };
    if (v > S.VERSION) return { error: 'This save is from a newer version of the game (v' + v + ')' };
    while (v < S.VERSION) { if (!MIGRATIONS[v]) return { error: 'No upgrade path from save version ' + v }; st = MIGRATIONS[v](st); v = st.v; }
    return { state: st };
  }

  // ---- slots ----
  const envelope = st => { const data = JSON.stringify(st); return JSON.stringify({ v: S.VERSION, h: hash(data), data }); };
  function readEnvelope(text) {
    let env; try { env = JSON.parse(text); } catch (e) { return { error: 'Save file is not readable' }; }
    if (!isObj(env) || typeof env.data !== 'string') return { error: 'Save file is not in the expected format' };
    const bad = hash(env.data) !== env.h;
    let st; try { st = JSON.parse(env.data); } catch (e) { return { error: 'Save data is damaged' }; }
    const m = migrate(st); if (m.error) return { error: m.error };
    const r = S.repair(m.state), errs = S.validate(r.state);
    if (errs.length) return { error: 'Save is invalid: ' + errs.join('; ') };
    return { state: r.state, fixes: r.fixes, checksumBad: bad };
  }
  S.saveSlot = function (slot, st) {
    if (!S.SLOTS.includes(String(slot))) return { ok: false, error: 'Unknown slot ' + slot };
    const copy = clone(st); copy.meta.updated = Date.now(); copy.meta.slot = String(slot);
    const w = wr(KEY + slot, envelope(copy)); if (!w.ok) return w;
    const idx = metaIndex(); idx[slot] = summary(copy); wr(META_KEY, JSON.stringify(idx));
    st.meta.updated = copy.meta.updated; st.meta.slot = copy.meta.slot;
    return { ok: true };
  };
  S.loadSlot = function (slot) {
    const t = rd(KEY + slot); if (t === null) return { ok: false, error: 'Slot ' + slot + ' is empty' };
    const r = readEnvelope(t); if (r.error) return { ok: false, error: r.error };
    return { ok: true, state: r.state, fixes: r.fixes, checksumBad: r.checksumBad };
  };
  S.deleteSlot = function (slot) { rm(KEY + slot); const idx = metaIndex(); delete idx[slot]; wr(META_KEY, JSON.stringify(idx)); return { ok: true }; };
  const summary = st => ({ name: st.meta.name, race: st.player.race, day: st.world.day, party: st.party.length, updated: st.meta.updated, allegiance: S.sworn ? S.sworn(st) : null });
  function metaIndex() { try { const m = JSON.parse(rd(META_KEY) || '{}'); return isObj(m) ? m : {}; } catch (e) { return {}; } }
  // One entry per slot for the load screen: null when empty, { error } when unreadable, otherwise a short summary.
  S.listSlots = function () {
    return S.SLOTS.map(slot => {
      const t = rd(KEY + slot); if (t === null) return { slot, empty: true };
      const r = readEnvelope(t); if (r.error) return { slot, error: r.error };
      return Object.assign({ slot, empty: false }, summary(r.state), r.checksumBad ? { warning: 'Checksum mismatch' } : {});
    });
  };

  // ---- export / import (a save file the player can keep) ----
  S.exportString = st => envelope(Object.assign(clone(st), {}));
  S.importString = function (text) {
    const r = readEnvelope(String(text || '')); if (r.error) return { ok: false, error: r.error };
    return { ok: true, state: r.state, fixes: r.fixes, checksumBad: r.checksumBad };
  };
  S.download = function (st, filename) {                  // browser only: hands the player a file
    const blob = new Blob([S.exportString(st)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename || ('call-of-calamity-' + (st.meta && st.meta.name || 'save').replace(/[^a-z0-9]+/gi, '-') + '.json');
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  // ---- factions: standing, tiers ----
  S.getStanding = (st, f) => st.factions.standing[f] || 0;
  S.tierOf = function (n) { let t = S.RULES.tiers[0]; for (const x of S.RULES.tiers) if (n >= x.min) t = x; return t; };
  S.tierIndex = id => S.RULES.tiers.findIndex(t => t.id === id);
  S.standingTier = (st, f) => S.tierOf(S.getStanding(st, f));
  // Relations: base value from GAME_DATA.factions[a].relations[b], overridden per save so alliances can sour and rivals can reconcile.
  // Directed: getRelation(st, a, b) is how b's standing moves when a's changes. Pass {both:true} to setRelation for a symmetric change.
  S.getRelation = function (st, a, b) {
    const ov = st && st.factions && st.factions.relationOverrides, k = a + '>' + b;
    if (ov && typeof ov[k] === 'number') return ov[k];
    const F = G().factions || {}; return (F[a] && F[a].relations && F[a].relations[b]) || 0;
  };
  S.setRelation = function (st, a, b, v, opts) {
    st.factions.relationOverrides = st.factions.relationOverrides || {}; v = Math.max(-1, Math.min(1, +v || 0));
    st.factions.relationOverrides[a + '>' + b] = v; if (opts && opts.both) st.factions.relationOverrides[b + '>' + a] = v;
    return v;
  };
  S.shiftRelation = (st, a, b, d, opts) => S.setRelation(st, a, b, S.getRelation(st, a, b) + d, opts);
  // Change standing and pass part of it to related factions (allies up, rivals down). Returns every change that was applied.
  S.changeStanding = function (st, f, delta, opts) {
    opts = opts || {}; const R = S.RULES, out = [], F = G().factions || {};
    const apply = (id, d, why, via) => {
      if (!d) return; const prev = S.getStanding(st, id), next = int(prev + d, R.standingMin, R.standingMax);
      st.factions.standing[id] = next; const real = next - prev; if (!real) return;
      st.factions.history.push({ day: st.world.day, faction: id, delta: real, reason: why }); out.push({ faction: id, delta: real, from: prev, to: next, tierChange: S.tierOf(prev).id !== S.tierOf(next).id, via: via || null }); if (!via) { st.factions.met = st.factions.met || {}; st.factions.met[id] = 1; }
    };
    apply(f, Math.round(delta), opts.reason || 'change');
    if (opts.ripple !== false && F[f]) {
      for (const g of Object.keys(F)) { const rel = g !== f ? S.getRelation(st, f, g) : 0; if (rel) apply(g, Math.round(delta * rel * R.rippleFactor), (opts.reason || 'change') + ' (via ' + f + ')', f); }
    }
    if (st.factions.history.length > R.historyCap) st.factions.history = st.factions.history.slice(-R.historyCap);
    return out;
  };
  // A faction is 'met' once the player has dealt with it directly (a choice, a fight, a job) or walked into its land. Only met factions show up in change lists; ripple effects on the rest still happen quietly.
  S.isMet = (st, f) => !!((st.factions.met || {})[f] || (st.factions.ranks || {})[f]);
  S.markMet = (st, f) => { if (f) (st.factions.met = st.factions.met || {})[f] = 1; };
  // Net the changes per faction (a +1 and a -10 become one -9), drop zeros, and hide ripples on factions the player has not met.
  S.visibleChanges = function (st, changes) {
    const by = {}, order = []; (changes || []).forEach(c => { if (!c || !c.delta) return; const k = c.faction; if (!by[k]) { by[k] = { faction: k, delta: 0, from: c.from, to: c.to, direct: false }; order.push(k); } by[k].delta += c.delta; by[k].to = c.to; if (!c.via) by[k].direct = true; });
    return order.map(k => by[k]).filter(c => c.delta && (c.direct || S.isMet(st, c.faction)));
  };

  // ---- progression: skills, mastery, class unlocks, passives, JP ----
  // JP is kept per class. A unit spends it only while that class is its primary. The first skill of every class is free, the rest are bought
  // in list order cost-wise; a class is mastered when every skill is known, and mastering classes unlocks the classes that require them
  // (data/classes.js `requires`). Learned skills and passives are kept for good.
  const round5 = n => Math.round(n / 5) * 5;
  const unitOf = (st, id) => st.roster.find(u => u.id === id);
  S.skillCost = function (classId, abilityId) {
    const c = G().classes[classId]; if (!c) return null; const i = c.ab.indexOf(abilityId); if (i < 0) return null;
    if (i === 0) return 0; const A = G().abilities[abilityId], raw = (A && A.jp) ? A.jp : (S.RULES.skill.base + S.RULES.skill.step * (i - 1)) * (S.RULES.skill.tierMult[c.tier] || 1);
    return round5(raw * (S.RULES.skill.scale || 1));   // scale keeps unlock times in step with the enemy class gates (design/jp_costs.md)
  };
  S.classCost = classId => G().classes[classId].ab.reduce((n, a) => n + S.skillCost(classId, a), 0);
  S.jpOf = (u, classId) => (u.jp && u.jp[classId]) || 0;
  S.knownSkills = function (u, classId) {
    const c = G().classes[classId]; if (!c) return [];
    const have = new Set([c.ab[0], ...((u.learned && u.learned[classId]) || [])]); return c.ab.filter(a => have.has(a));
  };
  S.isMastered = (u, classId) => !!G().classes[classId] && S.knownSkills(u, classId).length === G().classes[classId].ab.length;
  S.masteredClasses = u => Object.keys(G().classes).filter(c => G().classes[c].selectable !== false && S.isMastered(u, c));
  // Unlock every class whose requirements the unit has mastered. Returns the newly unlocked class ids.
  S.refreshUnlocks = function (u) {
    const C = G().classes, added = []; let grew = true;
    while (grew) { grew = false; for (const id of Object.keys(C)) { const c = C[id]; if (c.selectable === false || u.unlocked.includes(id) || !(c.requires || []).length) continue; if (c.requires.every(r => S.isMastered(u, r))) { u.unlocked.push(id); added.push(id); grew = true; } } }
    return added;
  };
  // What a unit could do next with its current class: skills to buy, passives to buy.
  S.learnable = function (u) {
    const cls = u.primary, c = G().classes[cls], P = G().passives, L = (G().passiveLists || {})[cls] || [], pool = S.jpOf(u, cls), known = new Set(S.knownSkills(u, cls));
    return { classId: cls, pool,
      skills: c.ab.filter(a => !known.has(a)).map(a => ({ id: a, cost: S.skillCost(cls, a), affordable: pool >= S.skillCost(cls, a) })),
      passives: L.filter(p => !u.passivesKnown.includes(p)).map(p => ({ id: p, cost: P[p].jp, affordable: pool >= P[p].jp })) };
  };
  S.learnSkill = function (st, unitId, abilityId) {
    const u = unitOf(st, unitId); if (!u) return { ok: false, reason: 'No such unit' };
    const cls = u.primary, cost = S.skillCost(cls, abilityId);
    if (cost === null) return { ok: false, reason: 'That skill does not belong to ' + G().classes[cls].name };
    if (S.knownSkills(u, cls).includes(abilityId)) return { ok: false, reason: 'Already learned' };
    if (S.jpOf(u, cls) < cost) return { ok: false, reason: 'Needs ' + cost + ' JP (has ' + S.jpOf(u, cls) + ')' };
    u.jp[cls] = S.jpOf(u, cls) - cost; (u.learned[cls] = u.learned[cls] || []).push(abilityId);
    const wasMastered = S.knownSkills(u, cls).length === G().classes[cls].ab.length;
    return { ok: true, cost, mastered: wasMastered, unlocked: S.refreshUnlocks(u) };
  };
  S.learnPassive = function (st, unitId, passiveId) {
    const u = unitOf(st, unitId), P = G().passives[passiveId]; if (!u) return { ok: false, reason: 'No such unit' };
    if (!P || !P.teacher) return { ok: false, reason: 'That passive cannot be learned' };
    if (u.passivesKnown.includes(passiveId)) return { ok: false, reason: 'Already learned' };
    if (u.primary !== P.teacher) return { ok: false, reason: 'Learn it as a ' + G().classes[P.teacher].name };
    if (S.jpOf(u, P.teacher) < P.jp) return { ok: false, reason: 'Needs ' + P.jp + ' JP (has ' + S.jpOf(u, P.teacher) + ')' };
    u.jp[P.teacher] = S.jpOf(u, P.teacher) - P.jp; u.passivesKnown.push(passiveId);
    return { ok: true, cost: P.jp };
  };
  // Equip up to the passive slots from learned passives (the same passive twice is refused).
  S.setPassives = function (st, unitId, ids) {
    const u = unitOf(st, unitId); if (!u) return { ok: false, reason: 'No such unit' };
    ids = (ids || []).filter(Boolean);
    if (ids.length > G().combatRules.build.passiveSlots) return { ok: false, reason: 'Only ' + G().combatRules.build.passiveSlots + ' passive slots' };
    if (new Set(ids).size !== ids.length) return { ok: false, reason: 'Pick two different passives' };
    const bad = ids.find(p => !u.passivesKnown.includes(p)); if (bad) return { ok: false, reason: 'Not learned yet: ' + bad };
    u.passives = ids.slice(); const kept = LO().cleanGear(u.primary, u.gear, u.passives); const back = stashRemoved(st, u.gear, kept); u.gear = kept; return { ok: true, returned: back };
  };
  // Gear a unit can no longer wear goes back to the stash instead of vanishing. Default class gear is handed out for free, so only items the
  // stash would not otherwise be able to account for are returned too (a spare copy is harmless: it can be sold for half).
  function stashRemoved(st, oldGear, newGear) {
    const back = [];
    for (const [slot, id] of Object.entries(oldGear || {})) if (id && newGear[slot] !== id) { st.inventory.items[id] = (st.inventory.items[id] || 0) + 1; back.push(id); }
    return back;
  }
  // ---- roster ----
  // Choose who fights (1 to partySize roster members, in order).
  // Fight size: the most units either side may field. It follows the leader's level (the first roster unit) and is capped by what the maps can hold.
  S.leaderLevel = st => (st.roster[0] && st.roster[0].level) || 1;
  S.fightTier = st => { const lv = S.leaderLevel(st); let n = S.RULES.fightTiers[0][1]; for (const [from, size] of S.RULES.fightTiers) if (lv >= from) n = size; return n; };
  S.partySize = st => Math.min(S.fightTier(st), S.RULES.mapSpawnCap);
  S.setParty = function (st, ids) {
    ids = Array.from(new Set(ids || [])); const max = S.partySize(st);
    if (!ids.length || ids.length > max) return { ok: false, reason: 'Pick 1 to ' + max + ' units' };
    if (ids.some(id => !unitOf(st, id))) return { ok: false, reason: 'Unknown unit' };
    if (ids.some(id => S.isAway(st, id))) return { ok: false, reason: 'Someone you picked is away' };
    st.party = ids.slice(); return { ok: true };
  };
  // Hire a new level 1 recruit of an entry class. It is blank, so the player builds it as they like, and catches up through fights, the bench and dispatch.
  // The cost is flat. Its race is the race of the place it is hired at (opts.race, set by the node); standing only decides whether the place is open.
  S.recruitCost = st => S.RULES.recruitCost;
  S.recruitLevel = st => 1;
  S.recruit = function (st, classId, opts) {
    opts = opts || {}; const R = S.RULES, mult = opts.mult === undefined ? 1 : opts.mult;
    if (st.roster.length >= R.rosterCap) return { ok: false, reason: 'Your roster is full (' + R.rosterCap + ')' };
    if (!entryClasses().includes(classId)) return { ok: false, reason: 'Recruits start as an entry class' };
    const cost = Math.round(S.recruitCost(st) * mult); if (st.inventory.gold < cost) return { ok: false, reason: 'Needs ' + cost + ' gold (has ' + st.inventory.gold + ')' };
    const race = opts.race || st.player.race, names = ((G().races[race] || {}).names || []).concat(['Recruit']);
    const taken = new Set(st.roster.map(u => u.name)); let name = opts.name || names.find(n => !taken.has(n)); if (!name) { let i = 2; while (taken.has('Recruit ' + i)) i++; name = 'Recruit ' + i; }
    st.inventory.gold -= cost;
    const u = S.makeUnit(st, { primary: classId, name, race, level: S.recruitLevel(st) }); st.roster.push(u); return { ok: true, cost, unit: u };
  };

  // ---- shop and equipment ----
  S.priceOf = (itemId, mult) => { const it = G().gear[itemId]; return it && it.price ? Math.round(it.price * (mult === undefined ? 1 : mult)) : null; };
  S.sellValue = itemId => { const it = G().gear[itemId]; return it && it.price ? Math.floor(it.price * S.RULES.shop.sellFraction) : null; };
  // Buy one item. opts: { stock: [itemIds on sale], mult: price multiplier from standing }
  S.buy = function (st, itemId, opts) {
    opts = opts || {}; const price = S.priceOf(itemId, opts.mult);
    if (price === null) return { ok: false, reason: 'Not for sale' };
    if (opts.stock && !opts.stock.includes(itemId)) return { ok: false, reason: 'Not sold here' };
    if (st.inventory.gold < price) return { ok: false, reason: 'Needs ' + price + ' gold (has ' + st.inventory.gold + ')' };
    st.inventory.gold -= price; st.inventory.items[itemId] = (st.inventory.items[itemId] || 0) + 1; return { ok: true, cost: price };
  };
  S.sell = function (st, itemId) {
    const v = S.sellValue(itemId);
    if (v === null) return { ok: false, reason: 'Cannot be sold' };
    if (!st.inventory.items[itemId]) return { ok: false, reason: 'You do not have one in the stash' };
    st.inventory.items[itemId]--; if (!st.inventory.items[itemId]) delete st.inventory.items[itemId]; st.inventory.gold += v; return { ok: true, gold: v };
  };
  // Put a stash item on a unit (the old item goes back to the stash). The class must be able to wear it; two-handers clear the off hand.
  S.equip = function (st, unitId, itemId) {
    const u = unitOf(st, unitId), it = G().gear[itemId]; if (!u) return { ok: false, reason: 'No such unit' }; if (!it) return { ok: false, reason: 'Unknown item' };
    if (!st.inventory.items[itemId]) return { ok: false, reason: 'You do not have one in the stash' };
    if (u.gear[it.slot] === itemId) return { ok: false, reason: 'Already wearing it' };
    const next = Object.assign({}, u.gear, { [it.slot]: itemId }), clean = LO().cleanGear(u.primary, next, u.passives);
    if (clean[it.slot] !== itemId) return { ok: false, reason: G().classes[u.primary].name + ' cannot use ' + it.name };
    const back = stashRemoved(st, u.gear, clean); st.inventory.items[itemId]--; if (!st.inventory.items[itemId]) delete st.inventory.items[itemId];
    u.gear = clean; return { ok: true, returned: back };
  };
  S.unequip = function (st, unitId, slot) {
    const u = unitOf(st, unitId); if (!u) return { ok: false, reason: 'No such unit' };
    if (!u.gear[slot]) return { ok: false, reason: 'Nothing in that slot' };
    const id = u.gear[slot]; delete u.gear[slot]; st.inventory.items[id] = (st.inventory.items[id] || 0) + 1; return { ok: true, item: id };
  };

  // Change primary and secondary class (both must be unlocked). Gear the new class cannot use is removed and empty main hands get the class default.
  S.setClass = function (st, unitId, primary, secondary) {
    const u = unitOf(st, unitId), C = G().classes; if (!u) return { ok: false, reason: 'No such unit' };
    if (!C[primary] || C[primary].selectable === false || !u.unlocked.includes(primary)) return { ok: false, reason: 'Class not unlocked' };
    if (secondary && (!C[secondary] || C[secondary].selectable === false || !u.unlocked.includes(secondary) || secondary === primary)) return { ok: false, reason: 'Secondary not available' };
    u.primary = primary; u.secondary = secondary || null;
    // Gear the new class cannot wear goes back to the stash (no free items are created). An empty main hand is filled with the best legal weapon in the stash.
    const old = u.gear || {}; u.gear = LO().cleanGear(primary, old, u.passives); const back = stashRemoved(st, old, u.gear); let auto = null;
    if (!u.gear.MainHand) {
      const cand = Object.keys(st.inventory.items).filter(i => G().gear[i] && G().gear[i].slot === 'MainHand').sort((a, b) => (G().gear[b].price || 0) - (G().gear[a].price || 0));
      for (const id of cand) if (S.equip(st, unitId, id).ok) { auto = id; break; }
    }
    return { ok: true, returned: back, equipped: auto, needsWeapon: !u.gear.MainHand };
  };
  // XP: the encounter pays every party member (knocked out or not) on a win; kills add a little. Fights above the unit's level pay more, far below pay less.
  S.xpFor = function (u, base, rec) {
    const A = G().combatRules.level.xpAdjust, f = rec ? Math.max(A.min, Math.min(A.max, 1 + A.perLevel * (rec - u.level))) : 1;
    return Math.round(base * f);
  };
  // A party member can never pass the leader (roster[0]): XP stops at the top of the leader's level. Pass st so the cap applies.
  S.addXP = function (u, xp, st) {
    const from = u.level; let total = Math.max(0, u.xp + Math.round(xp));
    const lead = st && st.roster && st.roster[0];
    if (lead && lead !== u) { const top = LO().xpForLevel((lead.level || 1) + 1) - 1; if (lead.level < G().combatRules.level.cap && total > top) total = Math.max(u.xp, top); }
    const gained = total - u.xp; u.xp = total; u.level = LO().levelForXp(u.xp);
    return { unit: u.id, gained, from, to: u.level, levelUps: u.level - from, capped: !!(lead && lead !== u && u.level >= lead.level) };
  };
  // Catch-up: a unit below the leader's level earns more XP and JP, fading to nothing as the gap closes (design/party_slots_and_recruiting.md).
  S.catchUp = function (st, u) { const gap = Math.max(0, S.leaderLevel(st) - u.level), C = S.RULES.catchUp; return 1 + Math.min(C.max, C.perLevel * gap); };
  const jpRateOf = u => (G().races && u.race && G().races[u.race] && G().races[u.race].jpRate) || 1;
  // JP from a battle result (per-unit tallies in res.unitStats). Goes into each unit's current primary class pool; race jpRate applies.
  S.awardJP = function (st, res, opts) {
    opts = opts || {}; const R = S.RULES.jp, out = [], frac = opts.fraction === undefined ? 1 : opts.fraction; let sum = 0;
    for (const id of st.party) {
      const u = unitOf(st, id); if (!u) continue;
      const s = (res.unitStats && res.unitStats[id]) || { uses: 0, helps: 0, kills: 0, alive: !(res.fallen || []).some(f => f.id === id) };
      const raw = s.uses * R.perAbility + s.helps * R.perHelp + s.kills * R.perKill + (res.won ? R.winBonus * (s.alive ? 1 : R.koWinFraction) : 0) + (res.won && opts.flat ? opts.flat : 0);
      const jp = Math.round(raw * jpRateOf(u) * frac * S.catchUp(st, u)); sum += raw * frac;
      u.jp[u.primary] = S.jpOf(u, u.primary) + jp; out.push({ unit: id, class: u.primary, jp });
    }
    out.avgRaw = out.length ? sum / out.length : 0;   // the average fielded unit's JP before race and catch-up: what the bench shares
    return out;
  };
  // The bench: roster units that did not fight (and are not away) earn a share of the average fielded unit's XP (wins only) and JP into their current main class.
  S.awardBench = function (st, base) {
    const out = [], B = S.RULES.bench;
    for (const u of st.roster) {
      if (st.party.includes(u.id) || S.isAway(st, u.id)) continue;
      const c = S.catchUp(st, u), jp = Math.round(base.jp * B.rate * jpRateOf(u) * c), a = base.xp ? S.addXP(u, base.xp * B.rate * c, st) : null;
      u.jp[u.primary] = S.jpOf(u, u.primary) + jp; out.push({ unit: u.id, class: u.primary, jp, xp: a ? a.gained : 0, levelUps: a ? a.levelUps : 0 });
    }
    return out;
  };

  // ---- dispatch: send a unit out for a few days of the world clock for XP, JP and gold (design/party_slots_and_recruiting.md) ----
  // st.dispatch = { out: [{ unit, kind, start, end, reward: { xp, jp, gold } }] }. The reward is fixed when they leave; it is paid when they are collected.
  S.dispatchState = st => (st.dispatch && Array.isArray(st.dispatch.out)) ? st.dispatch : (st.dispatch = { out: [] });
  S.isAway = (st, id) => S.dispatchState(st).out.some(e => e.unit === id);
  S.dispatchReady = st => S.dispatchState(st).out.filter(e => e.end <= st.world.day);
  S.dispatchReward = function (st, u, kindId) {
    const D = S.RULES.dispatch, K = D.kinds[kindId], L = S.leaderLevel(st), c = S.catchUp(st, u), CAMP = window.GAME_CAMPAIGN;
    const fight = CAMP && CAMP.goldFor ? CAMP.goldFor(L) : 10 + 5 * L;
    return { xp: Math.round((D.xpBase + D.xpPerLevel * L) * K.mult * c), jp: Math.round(D.jpBase * K.mult * c * jpRateOf(u)), gold: Math.round(fight * D.goldShare * K.mult / 5) * 5 };
  };
  S.dispatchSend = function (st, unitId, kindId) {
    const D = S.RULES.dispatch, K = D.kinds[kindId], u = unitOf(st, unitId), ds = S.dispatchState(st);
    if (!u) return { ok: false, reason: 'No such unit' }; if (!K) return { ok: false, reason: 'No such errand' };
    if (u === st.roster[0]) return { ok: false, reason: u.name + ' leads the party and cannot be sent away' };
    if (S.isAway(st, unitId)) return { ok: false, reason: u.name + ' is already away' };
    if (ds.out.length >= D.maxOut) return { ok: false, reason: 'You can have ' + D.maxOut + ' people away at a time' };
    const left = st.party.filter(id => id !== unitId), home = st.roster.filter(x => x.id !== unitId && !S.isAway(st, x.id)); if (!home.length) return { ok: false, reason: 'Someone has to stay home' };
    st.party = left.length ? left : [home[0].id]; const e = { unit: unitId, kind: kindId, start: st.world.day, end: st.world.day + K.days, reward: S.dispatchReward(st, u, kindId) }; ds.out.push(e);
    return { ok: true, entry: e };
  };
  // Pay everyone whose time is up: XP, JP into their current main class, gold. Returns what each earned.
  S.dispatchCollect = function (st) {
    const ds = S.dispatchState(st), done = [];
    for (const e of S.dispatchReady(st)) {
      const u = unitOf(st, e.unit); ds.out = ds.out.filter(x => x !== e); if (!u) continue;
      const a = S.addXP(u, e.reward.xp, st); u.jp[u.primary] = S.jpOf(u, u.primary) + e.reward.jp; st.inventory.gold += e.reward.gold;
      done.push({ unit: u.id, name: u.name, kind: e.kind, xp: e.reward.xp, jp: e.reward.jp, gold: e.reward.gold, levelUps: a.levelUps });
    }
    return done;
  };
  // True when a unit has nothing left to buy with JP in its current class: every skill learned and every passive that class teaches known.
  S.nothingLeft = function (u) {
    const cls = u.primary, L = (G().passiveLists || {})[cls] || [];
    return S.isMastered(u, cls) && L.every(p => (u.passivesKnown || []).includes(p));
  };

  // ---- world clock and battle results ----
  S.advanceDay = function (st, n) { st.world.day += Math.max(0, n === undefined ? 1 : n); return st.world.day; };
  // Fold a Battle.start() result into the state: faction kills lower standing (and ripple), the battle is logged, time passes.
  // opts: { node, days, gold, xp }   No permadeath: fallen units are back on their feet after the fight.
  S.applyBattleResult = function (st, res, opts) {
    opts = opts || {}; const R = S.RULES, changes = [], xpAwards = []; let benchXp = 0;
    const replay = !!(opts.node && st.campaign.completed.includes(opts.node)), jpAwards = S.awardJP(st, res, { fraction: replay ? R.jp.repeatFraction : 1, flat: opts.jp });
    for (const [f, n] of Object.entries(res.factionKills || {})) if (f !== 'wild') changes.push(...S.changeStanding(st, f, -R.killPenalty * n, { reason: 'killed ' + n + ' member' + (n > 1 ? 's' : '') }));
    if (res.won) {
      if (opts.gold) st.inventory.gold += opts.gold;
      if (opts.xp || Object.keys(res.unitStats || {}).length) { let sum = 0, n = 0; st.party.slice().sort((a, b) => st.roster.findIndex(x => x.id === a) - st.roster.findIndex(x => x.id === b)).forEach(id => { const u = st.roster.find(x => x.id === id); if (!u) return; const k = ((res.unitStats || {})[id] || {}).kills || 0, base = S.xpFor(u, opts.xp || 0, opts.rec) + k * R.xp.perKill; sum += base; n++; xpAwards.push(S.addXP(u, base * S.catchUp(st, u), st)); } ); benchXp = n ? sum / n : 0; }
      if (opts.node && !st.campaign.completed.includes(opts.node)) st.campaign.completed.push(opts.node);
    }
    st.campaign.battles.push({ day: st.world.day, node: opts.node || null, won: !!res.won, turns: res.turns, kills: (res.kills || []).filter(k => k.victimTeam === 'E').length });
    if (st.campaign.battles.length > R.battleCap) st.campaign.battles = st.campaign.battles.slice(-R.battleCap);
    S.advanceDay(st, opts.days === undefined ? 1 : opts.days);
    const benchAwards = S.awardBench(st, { jp: jpAwards.avgRaw || 0, xp: benchXp });
    return { standingChanges: changes, jpAwards, xpAwards, benchAwards };
  };


  // ---- faction ranks, Hearthwatch goodwill (design/human_factions.md, design/node_ownership_and_land.md section 9) ----
  // One faction at a time: st.factions.ranks holds at most one { rank 1-4, dormant, trust, since }. The Hearthwatch has no rank (goodwill only)
  // and sits outside the limit. st.factions.goodwill = Hearthwatch meter; st.factions.declined[f] = day an invitation was refused.
  // Nothing here is ever game over: every cost is standing, rank, gold or a flag.
  S.RANK = {
    factions: ['crown', 'syndicate', 'synod', 'broken_banner'],          // Hearthwatch has no rank (goodwill only)
    ladders: {
      crown: ['Sworn Sword', 'Knight', 'Banneret', "Lord's Hand"],
      syndicate: ['Runner', 'Agent', 'Factor', 'Partner'],
      synod: ['Novice', 'Warden', 'Inquisitor', 'Adept of the Inner Circle'],
      broken_banner: ['Cutpurse', 'Rider', 'Captain', 'Banner-Bearer']
    },
    standingNeeded: [250, 400, 600, 800],       // standing to be offered rank 1..4
    maxRanks: 1, inviteCooldownDays: 30,
    uneasyDrain: 0.25,                          // serving one faction costs this share (extra) with an Uneasy rival
    leaveFactor: 1,                             // x RULES.leavePenalty when you walk away cleanly
    outcastCost: 40,                            // standing lost with the Crown when the Broken Banner takes in an outcast
    rivalPrice: { uneasy: 1.2, opposed: 1.4 }   // what a rival faction's shops charge you while you hold a rank (Opposed recruiters also refuse you)
  };
  // Rivalry table (agreed). One line per pair; ratings can be changed by world events later.
  S.RIVALRY = { 'crown|syndicate': 'uneasy', 'crown|synod': 'uneasy', 'crown|broken_banner': 'opposed', 'syndicate|synod': 'opposed', 'syndicate|broken_banner': 'open',
    'synod|broken_banner': 'opposed', 'crown|hearthwatch': 'open', 'syndicate|hearthwatch': 'open', 'synod|hearthwatch': 'uneasy', 'broken_banner|hearthwatch': 'open' };
  { const n = {}; for (const k of Object.keys(S.RIVALRY)) n[k.split('|').sort().join('|')] = S.RIVALRY[k]; S.RIVALRY = n; }   // keys sorted so order never matters
  S.rivalry = function (a, b, st) {
    const k = [a, b].sort().join('|'), ov = st && st.factions && st.factions.rivalryOverrides && st.factions.rivalryOverrides[k];
    return ov || S.RIVALRY[k] || 'open';
  };
  S.GOODWILL = { min: 15, max: 100, tiers: [{ id: 'wary', name: 'Wary', min: 15 }, { id: 'kindly', name: 'Kindly', min: 30 }, { id: 'trusted', name: 'Trusted', min: 60 }], discount: 0.9 };

  const rk = (st, f) => (st.factions.ranks || {})[f] || null;
  S.getRank = (st, f) => { const r = rk(st, f); return r ? { faction: f, rank: r.rank, title: S.RANK.ladders[f][r.rank - 1], dormant: !!r.dormant, trust: r.trust || 0 } : null; };
  S.listRanks = st => Object.keys(st.factions.ranks || {}).map(f => S.getRank(st, f));
  S.sworn = st => Object.keys(st.factions.ranks || {})[0] || null;     // the one faction you hold a rank in, or null
  // What a faction's shops and recruiters make of you: 1 (no rival), or the Uneasy / Opposed markup while you serve its rival. The Hearthwatch never marks you up.
  S.rivalStance = function (st, f) {
    const mine = S.sworn(st); if (!mine || !f || f === mine || f === 'hearthwatch' || !S.RANK.factions.includes(f)) return { rating: 'open', priceMult: 1, recruit: true };
    const rating = S.rivalry(mine, f, st); return { rating, priceMult: S.RANK.rivalPrice[rating] || 1, recruit: rating !== 'opposed' };
  };

  // Can the player take rank 1 in f?  Returns { ok, reason, leaves }. Holding another rank is not a block for an offer: accepting means leaving it (S.joinRank with leave).
  S.canJoin = function (st, f, opts) {
    opts = opts || {}; const R = S.RANK, cur = S.sworn(st);
    if (!R.factions.includes(f)) return { ok: false, reason: 'No ranks in ' + f };
    if (rk(st, f)) return { ok: false, reason: 'Already a member' };
    if (!opts.force && !opts.outcast && S.getStanding(st, f) < R.standingNeeded[0]) return { ok: false, reason: 'Needs Friendly standing' };
    if (cur && !opts.leave) return { ok: false, leaves: cur, reason: 'You serve the ' + ((G().factions || {})[cur] || { name: cur }).name + ': leave them first' };
    return { ok: true, leaves: cur || null };
  };
  S.joinRank = function (st, f, opts) {
    opts = opts || {}; const chk = S.canJoin(st, f, opts); if (!chk.ok) return chk;
    const changes = [];
    if (chk.leaves) { const l = S.leaveRank(st, chk.leaves, { betrayal: !!opts.betrayal }); changes.push(...(l.changes || [])); }
    st.factions.ranks = st.factions.ranks || {};
    st.factions.ranks[f] = { rank: 1, dormant: false, trust: 0, since: st.world.day };
    if (opts.outcast && f === 'broken_banner') changes.push(...S.changeStanding(st, 'crown', -S.RANK.outcastCost, { reason: 'joined the Broken Banner', ripple: false }));
    return { ok: true, rank: S.getRank(st, f), left: chk.leaves || null, changes };
  };
  S.promote = function (st, f, opts) {
    opts = opts || {}; const r = rk(st, f); if (!r) return { ok: false, reason: 'Not a member' };
    if (r.rank >= 4) return { ok: false, reason: 'Already at the top rank' };
    if (r.dormant) return { ok: false, reason: 'Rank is dormant' };
    if (!opts.force && S.getStanding(st, f) < S.RANK.standingNeeded[r.rank]) return { ok: false, reason: 'Needs ' + S.RANK.standingNeeded[r.rank] + ' standing' };
    r.rank++; return { ok: true, rank: S.getRank(st, f) };
  };
  S.setDormant = function (st, f, on) { const r = rk(st, f); if (!r) return { ok: false, reason: 'Not a member' }; r.dormant = !!on; return { ok: true }; };
  // Leaving costs standing (betraying costs more). Coming back later starts you at rank 1 again.
  S.leaveRank = function (st, f, opts) {
    opts = opts || {}; const r = rk(st, f); if (!r) return { ok: false, reason: 'Not a member' };
    delete st.factions.ranks[f];
    const changes = S.changeStanding(st, f, -Math.round(S.RULES.leavePenalty * (opts.betrayal ? 3 : S.RANK.leaveFactor)), { reason: 'left the ranks', ripple: false });
    return { ok: true, changes };
  };
  // Work done for a faction: standing rises, and an Uneasy rival slowly pays for it (nobody turns hostile from this alone).
  S.serve = function (st, f, amount, opts) {
    opts = opts || {}; const out = S.changeStanding(st, f, amount, { reason: opts.reason || 'served', ripple: opts.ripple });
    if (amount > 0) for (const g of S.RANK.factions) if (g !== f && S.rivalry(f, g, st) === 'uneasy') out.push(...S.changeStanding(st, g, -Math.max(1, Math.round(amount * S.RANK.uneasyDrain)), { reason: 'serving ' + f, ripple: false }));
    return out;
  };
  // Offers the player can accept or refuse: join (Friendly standing) or promotion. Refused offers rest for a while.
  // A join offer from another faction while you hold a rank carries `leaves`: taking it means leaving your faction.
  S.invitations = function (st) {
    const out = [], R = S.RANK, dec = st.factions.declined || {};
    for (const f of R.factions) {
      if (dec[f] !== undefined && st.world.day - dec[f] < R.inviteCooldownDays) continue;
      const r = rk(st, f), stand = S.getStanding(st, f);
      if (!r) { const c = S.canJoin(st, f, { leave: true }); if (c.ok) out.push({ faction: f, kind: 'join', title: R.ladders[f][0], leaves: c.leaves || null }); }
      else if (!r.dormant && r.rank < 4 && stand >= R.standingNeeded[r.rank]) out.push({ faction: f, kind: 'promote', title: R.ladders[f][r.rank] });
    }
    return out;
  };
  S.declineInvitation = function (st, f) { st.factions.declined = st.factions.declined || {}; st.factions.declined[f] = st.world.day; return { ok: true }; };
  // Fallback: the Broken Banner takes in anyone with nowhere else to go, at a rank-1 cost with the Crown.
  S.outcastJoin = function (st) { return S.joinRank(st, 'broken_banner', { outcast: true }); };
  // Hearthwatch chapel: free healing. A rebuild point, not a power-up.
  S.sanctuary = function (st) { return { ok: true, healed: true, goodwill: S.goodwillTier(st) }; };

  // ---- Hearthwatch goodwill: lighter meter, hard to push below the floor, always a way back ----
  S.getGoodwill = st => Math.max(S.GOODWILL.min, Math.min(S.GOODWILL.max, Math.round(st.factions.goodwill === undefined ? S.GOODWILL.min : st.factions.goodwill)));
  S.goodwillTier = function (st) { const v = S.getGoodwill(st); let t = S.GOODWILL.tiers[0]; for (const x of S.GOODWILL.tiers) if (v >= x.min) t = x; return t; };
  S.changeGoodwill = function (st, d, why) { const prev = S.getGoodwill(st); st.factions.goodwill = Math.max(S.GOODWILL.min, Math.min(S.GOODWILL.max, prev + d)); st.factions.history.push({ day: st.world.day, faction: 'hearthwatch', delta: S.getGoodwill(st) - prev, reason: why || 'goodwill' }); return S.getGoodwill(st); };
  S.hearthPriceMult = st => S.goodwillTier(st).id === 'trusted' ? S.GOODWILL.discount : 1;


  window.GAME_SAVE = S;
})();
