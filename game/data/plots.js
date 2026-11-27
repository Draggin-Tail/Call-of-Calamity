/* The realm's antagonists and beats (design/node_ownership_and_land.md, Phase 4c). Needs unification.js and policy.js.
   - Plotters: the factions 4a recorded (Moot: those whose seats voted against the winner; war: the wiped-out ones), plus Aldermere
     (Osric's loyalists) when Osric was not crowned. The main plotter is the one that held the most places before the union (at the start,
     if none held any). It has three cells and a hidden stronghold (a short dungeon); the lesser plotters have two cells (Aldermere one)
     and cannot rise on their own.
   - Cells sit inside ordinary places in the plotter's old land (picked by the world seed). Tavern rumours and the realm's "Hunt the
     plotters" contract find them; a found cell is a scene at its place, and a won fight clears it. Anyone can hunt them.
   - The clock: the main plotter rises when C.PLOT.rise days pass with none of its cells cleared (each clear starts the count again).
     Word on the roads warns first. Clearing all its cells shows its stronghold on the map.
   - Rising: the old faction comes back (no longer absorbed) under a rebel name, holds its stronghold (its capital) and its uncleared cells,
     and is at war with the realm; the 3c and 3d rules run the war. The stronghold is hidden ground, so no army can take it: clearing the
     dungeon ends the plot, or wipes the rebels out and returns their name to the realm. Nobody can join the rebels.
   - Beats: a shared core scene at each realm rank 1 to 4 (with a line per flavour), a flavoured scene at ranks 2 and 4, and a reveal for
     each plotter after its first cell falls.
   State: st.world.plot. Global data that follows the save in play (rebel names, the stronghold's capital mark, where each cell scene is,
   who speaks the core beats) is set by C.plotSync, run inside C.unionSync. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.UNION || !C.policy || !C.kindOk || !C.DUNGEONS || !C.MOVES || !C.CONTRACT_KINDS || !C.tavernVisit || !C.wipeOut || !C.relTick || !C.dungeonFight || !C.unionSync || C.PLOT) return false;
    const D = window.GAME_DATA, F = D.factions, ID = C.UNION.id;
    const HUMAN_WAR = ['crown', 'syndicate', 'synod', 'broken_banner'], ALL = HUMAN_WAR.concat(['aldermere']);
    const day = st => st.world.day, fl = st => st.world.flags;
    const hsh = s => { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
    const lvl = st => Math.max(1, ...st.roster.map(u => u.level || 1));
    const nm = id => String((C.NODES[id] || {}).name || id).replace(/^The /, 'the ');   // inside a sentence
    const E = (primary, name) => ({ primary, name });
    const gw = (st, d, why) => { if (S.changeGoodwill && d) S.changeGoodwill(st, d, why); };
    const realmRank = st => { const r = S.getRank(st, ID); return r ? r.rank : 0; };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const mid = s => String(s).replace(/^The /, 'the ');   // a place name inside a sentence

    const P = C.PLOT = {
      rise: 75, warn: 20,                    // days with no cell cleared before the main plotter rises; the warning comes this many days before
      cells: { main: 3, lesser: 2, aldermere: 1 },
      siteTypes: ['village', 'hamlet', 'town', 'market', 'poi'],
      rumour: 0.5,                           // share of tavern visits with a cell within reach that turn up word of it
      reward: { standing: 40, informer: 60 },
      by: {
        crown: { group: 'Old Oath loyalists', rebel: 'Old Oath', leader: 'Lord Marshal Voss', color: '#6b5a2a',
          squad: [E('warrior', 'Oathsworn Knight'), E('archer', 'Loyal Bowman'), E('cleric', 'Chaplain of the Old Oath')],
          cell: 'A cellar with fresh straw on the floor and old swords on the wall. The men down there still drink to a king who is dead.',
          cause: '"The Marshal never swore to you. He swore to a king, and there is no king in this realm worth the name."',
          stronghold: { id: 'oath_vault', name: 'The Oath Vault', parent: 'oath_cairn', from: 'kings_barrow_depths', floors: [1, 2, 4],
            desc: 'A vault under the oath-stones, where the old knights swore. Some of them never stopped.',
            fl: [['The swearing stair', E('warrior', 'Oathsworn Knight'), E('archer', 'Loyal Bowman'), E('squire', 'Sworn Squire')], ['The hall of names', E('bulwark', 'Oath Shieldwall'), E('cleric', 'Chaplain of the Old Oath'), E('archer', 'Loyal Bowman')]],
            boss: [E('warlord', 'Lord Marshal Voss'), E('warrior', 'Oathsworn Knight'), E('cleric', 'Chaplain of the Old Oath')] } },
        syndicate: { group: 'Ledger-Lords', rebel: 'Ledger-Lords', leader: 'Factor Crane', color: '#2f6b5f',
          squad: [E('assassin', 'Ledger Knife'), E('rogue', 'Debt Collector'), E('marksman', 'Hired Dead-Eye')],
          cell: 'A counting-room behind a shut shop. Two clerks, three ledgers, and more hired blades than a shop that sells nothing should need.',
          cause: '"The Factor keeps the Second Book. Half the lords who swore to you owe him their roofs. When he calls the debts in, see who stands with you."',
          stronghold: { id: 'second_counting_house', name: 'The Second Counting-House', parent: 'debtors_tower', from: 'silt_wharf_undercroft', floors: [1, 2, 3],
            desc: 'Under the debtors\' tower, a counting-house that was never on any map. The books down there are the ones that matter.',
            fl: [['The strongroom door', E('rogue', 'Debt Collector'), E('marksman', 'Hired Dead-Eye'), E('warrior', 'Vault Guard')], ['The long ledger', E('assassin', 'Ledger Knife'), E('enchanter', 'Seal-Keeper'), E('rogue', 'Debt Collector')]],
            boss: [E('warlord', 'Factor Crane'), E('assassin', 'Ledger Knife'), E('marksman', 'Hired Dead-Eye')] } },
        synod: { group: 'Inner Circle', rebel: 'Inner Circle', leader: 'Archon Ilvane', color: '#4b3f7a',
          squad: [E('wizard', 'Inner Circle Adept'), E('enchanter', 'Ward-Breaker'), E('cleric', 'Confessor')],
          cell: 'A locked room above a chandler\'s, warm in the dead of winter. The wards on the door are better than the Ascendancy\'s own.',
          cause: '"The Archon does not want your realm. She wants the Ward, and what sleeps under it. Your realm is in the way, that is all."',
          stronghold: { id: 'sealed_scriptorium', name: 'The Sealed Scriptorium', parent: 'blackstone_archive', from: 'sunken_cloister_crypt', floors: [1, 2, 3],
            desc: 'A scriptorium sealed when the Synod fell. The lamps are still lit.',
            fl: [['The warded door', E('enchanter', 'Ward-Breaker'), E('wizard', 'Inner Circle Adept'), E('apprentice', 'Ink-Bound')], ['The forbidden shelves', E('wizard', 'Inner Circle Adept'), E('stormcaller', 'Storm-Scribe'), E('cleric', 'Confessor')]],
            boss: [E('warlord', 'Archon Ilvane'), E('wizard', 'Inner Circle Adept'), E('enchanter', 'Ward-Breaker')] } },
        broken_banner: { group: 'Last Banner holdouts', rebel: 'Last Banner', leader: 'Captain Old Standard', color: '#7a3a26',
          squad: [E('warrior', 'Last Rider'), E('scout', 'Banner Outrider'), E('archer', 'Hedge Bowman')],
          cell: 'A barn with too many horses in it, and a fire nobody lit for warmth. They sing the old Banner songs, quietly.',
          cause: '"The Captain says a realm that hangs riders is the same realm that cast us off. He is not wrong, is he?"',
          stronghold: { id: 'last_camp', name: 'The Last Camp', parent: 'widows_barrow', from: 'applecourt_cellars', floors: [1, 2, 3],
            desc: 'A camp in the barrow-cuts, where the Banner hid once before. It is hiding there again.',
            fl: [['The picket line', E('scout', 'Banner Outrider'), E('archer', 'Hedge Bowman'), E('warrior', 'Last Rider')], ['The cut', E('berserker', 'Banner Wolf'), E('warrior', 'Last Rider'), E('scout', 'Banner Outrider')]],
            boss: [E('warlord', 'Captain Old Standard'), E('warrior', 'Last Rider'), E('archer', 'Hedge Bowman')] } },
        aldermere: { group: 'Aldermere loyalists', leader: 'Lord Osric', color: '#8c6a2f', sites: ['heralds_cross', 'applecourt', 'pennant_green', 'kingsway_cross'],
          squad: [E('warrior', 'Aldermere Levy'), E('archer', 'Levy Bowman'), E('rogue', 'Cloaked Knife')],
          cell: 'Men in plain cloaks and good Aldermere boots, in a back room with a map of the Crownlands pinned to the wall.',
          cause: '"Osric was robbed of a crown. His men mean to take it back, one village at a time. They are patient. Are you?"' }
      }
    };
    const SH = {}; HUMAN_WAR.forEach(f => { SH[P.by[f].stronghold.id] = f; });

    // ---- the strongholds: hidden dungeons, one per war faction (only the main plotter's is ever used) ----
    HUMAN_WAR.forEach(f => {
      const B = P.by[f], s = B.stronghold, par = C.NODES[s.parent]; if (!par || C.NODES[s.id]) return;
      const floors = s.fl.map(([name, ...en]) => ({ name, enemies: en })).concat([{ name: 'The last stand', enemies: s.boss, boss: true }]);
      C.DUNGEONS[s.id] = { name: s.name, parent: s.parent, pos: [+(par.pos[0] + 0.016).toFixed(4), +(par.pos[1] + 0.018).toFixed(4)], tier: 3, rec: 8, respawn: null, hidden: true, reveal: { auto: false },
        desc: s.desc, why: 'The plotters\' stronghold.', first: { gold: 400 }, floors, plot: f };
      const d = C.DUNGEONS[s.id];
      C.NODES[s.id] = { name: s.name, region: par.region, area: par.area, type: 'dungeon', pos: d.pos.slice(), desc: s.desc, dungeon: s.id, hidden: true, stronghold: f, links: {} };
      C.NODES[s.id].links[s.parent] = 1; par.links[s.id] = 1; if (C.EDGES) C.EDGES.push([s.parent, s.id, 1]);
      floors.forEach((fr, i) => {
        if (D.maps && D.maps['dgm_' + s.from + '_' + s.floors[i]]) D.maps['dgm_' + s.id + '_' + (i + 1)] = D.maps['dgm_' + s.from + '_' + s.floors[i]];   // the floors borrow an existing dungeon's maps
        const rec = d.rec + (fr.boss ? 1 : 0);
        C.ENCOUNTERS['dg_' + s.id + '_' + (i + 1)] = { name: s.name + ': ' + fr.name, map: 'dgm_' + s.id + '_' + (i + 1), rec, enemyFaction: 'outlaws', enemies: fr.enemies.map(e => Object.assign({}, e)),
          objective: fr.boss ? { type: 'leader', leader: 0 } : null, once: false, dungeon: s.id, floor: i + 1, baseReward: { xp: Math.round((30 + 12 * rec) * (fr.boss ? 1.8 : 1)), gold: Math.round((10 + 5 * rec) * (fr.boss ? 2 : 1)) }, reward: { xp: 0, gold: 0 } };
      });
    });
    // a stronghold is fought at the party's level
    { const df0 = C.dungeonFight; C.dungeonFight = function (st, id) {
        const d = C.DUNGEONS[id]; if (d && d.plot) { const lv = lvl(st); d.rec = Math.max(8, lv + 1); d.floors.forEach((fr, i) => { const e = C.ENCOUNTERS['dg_' + id + '_' + (i + 1)]; if (e) { e.rec = d.rec + (fr.boss ? 1 : 0); e.baseReward = { xp: Math.round((30 + 12 * e.rec) * (fr.boss ? 1.8 : 1)), gold: Math.round((10 + 5 * e.rec) * (fr.boss ? 2 : 1)) }; } }); }
        return df0.apply(this, arguments); }; }

    // ---- state ----
    const plot = st => (st && st.world && st.world.plot) || null;
    const live = st => { const p = plot(st); return !!p && !p.ended; };
    C.plot = plot;
    const cellsOf = (st, f) => (plot(st) ? plot(st).cells.filter(c => c.f === f) : []);
    const openCells = st => (plot(st) ? plot(st).cells.filter(c => !c.cleared && !c.rose) : []);
    const groupName = f => P.by[f].group;
    const rebelName = f => P.by[f].rebel;

    // ---- making the plot at the union ----
    function placesHeld(st) { const o = {}; Object.keys(C.NODES).forEach(id => { const f = C.ownerOf(st, id); if (HUMAN_WAR.includes(f)) o[f] = (o[f] || 0) + 1; }); return o; }
    const START = {}; Object.keys(C.NODES).forEach(id => { const f = C.defaultOwner(id); if (HUMAN_WAR.includes(f)) START[f] = (START[f] || 0) + 1; });
    function pickSites(st, f, n, used, seed) {
      const B = P.by[f], shParents = HUMAN_WAR.map(g => P.by[g].stronghold.parent);
      let pool = B.sites ? B.sites.filter(id => C.NODES[id]) : Object.keys(C.NODES).filter(id => { const x = C.NODES[id]; return x.region === 'human' && !x.hidden && P.siteTypes.includes(x.type) && C.defaultOwner(id) === f; });
      pool = pool.filter(id => !used.has(id) && !shParents.includes(id));
      const mine = pool.filter(id => C.ownerOf(st, id) === ID); if (mine.length >= n) pool = mine;   // inside the realm's own places when it can
      return pool.map(id => [hsh(seed + '|' + f + '|' + id), id]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
    }
    C.makePlot = function (st, held) {
      const u = C.union(st); if (!u || plot(st)) return plot(st);
      const plotters = (u.plotters || []).filter(f => HUMAN_WAR.includes(f));
      if (u.outcome !== 'osric' && F.aldermere) plotters.push('aldermere');
      held = held || {};
      const war = plotters.filter(f => HUMAN_WAR.includes(f));
      const main = war.slice().sort((a, b) => (held[b] || 0) - (held[a] || 0) || (START[b] || 0) - (START[a] || 0) || (a < b ? -1 : 1))[0] || null;
      const seed = st.world.rng || 0, used = new Set(), cells = []; let n = 0;
      plotters.forEach(f => { const k = f === main ? P.cells.main : f === 'aldermere' ? P.cells.aldermere : P.cells.lesser;
        pickSites(st, f, k, used, seed).forEach((at, slot) => { used.add(at); cells.push({ id: 'c' + (++n), f, at, slot, found: 0, cleared: 0 }); }); });
      st.world.plot = { day: day(st), main, plotters, cells, clock: day(st), warned: false, shown: 0, risen: 0, ended: 0, how: null, told: {} };
      C.plotSync(st); return st.world.plot;
    };
    { const un0 = C.unify; C.unify = function (st) {
        const held = placesHeld(st), r = un0.apply(this, arguments);
        if (r && r.ok !== false && C.union(st)) C.makePlot(st, held);
        return r; }; }

    // ---- global data for the save in play ----
    const NAME0 = {}, COLOR0 = {}; ALL.forEach(f => { if (F[f]) { NAME0[f] = F[f].name; COLOR0[f] = F[f].color; } });
    C.plotSync = function (st) {
      ALL.forEach(f => { if (F[f]) { F[f].name = NAME0[f]; F[f].color = COLOR0[f]; } });
      Object.keys(SH).forEach(id => { C.NODES[id].capital = null; });
      const p = plot(st);
      if (p && p.risen && !p.ended && p.main) { const f = p.main, B = P.by[f]; F[f].name = B.rebel; F[f].color = B.color; C.NODES[B.stronghold.id].capital = f; }
      CELL_MOVES.forEach(m => { m.at = 'crown_keep'; });   // a slot with no cell never trips
      if (p) p.cells.forEach(c => { const m = CELL_MOVES.find(x => x.f === c.f && x.slot === c.slot); if (m) m.at = c.at; });
      const fv = C.unionFlavour ? C.unionFlavour(st) : null;
      CORE_MOVES.forEach(m => { m.who = fv ? fv.who[1] : 'herald'; });
    };
    { const us0 = C.unionSync; C.unionSync = function (st) { const r = us0.apply(this, arguments); C.plotSync(st); return r; }; }

    // ---- finding cells ----
    function reachable(from, max) { const d = { [from]: 0 }, q = [from]; while (q.length) { const x = q.shift(); if (d[x] >= max) continue; Object.keys((C.NODES[x] || {}).links || {}).forEach(y => { if (d[y] === undefined) { d[y] = d[x] + 1; q.push(y); } }); } return d; }
    C.findCell = function (st, from, f) {
      const p = plot(st); if (!live(st)) return null; const d = reachable(from || st.world.location, 99);
      const c = openCells(st).filter(x => !x.found && (!f || x.f === f)).sort((a, b) => (d[a.at] === undefined ? 999 : d[a.at]) - (d[b.at] === undefined ? 999 : d[b.at]) || (a.id < b.id ? -1 : 1))[0];
      if (!c) return null; c.found = Math.max(1, day(st)); if (C.discover) C.discover(st, c.at);
      return c;
    };
    C.plotUnfound = st => (live(st) ? openCells(st).filter(c => !c.found).length : 0);
    // tavern talk: word of a cell within three roads
    { const tv0 = C.tavernVisit; C.tavernVisit = function (st, id) {
        const r = tv0.apply(this, arguments); if (!r || !r.ok || !live(st)) return r;
        const d = reachable(id, 3), near = openCells(st).filter(c => !c.found && d[c.at] !== undefined);
        if (!near.length || hsh('plot|' + id + '|' + day(st) + '|' + (st.world.tvCount || 0)) % 100 >= P.rumour * 100) return r;
        const c = C.findCell(st, id); if (!c) return r;
        st.world.tvPending = null;
        r.scene = { kind: 'rumour', title: 'A rumour', lines: [{ who: 'A drinker by the fire', text: 'Strangers have taken a room at ' + nm(c.at) + ', and they pay in old coin. ' + cap(groupName(c.f)) + ', if you ask me. Nobody asks me.' }], found: [nm(c.at)], narr: 'A cell of the ' + groupName(c.f) + ' at ' + nm(c.at) + '.' };
        return r; }; }
    // the realm's boards: "Hunt the plotters", while a cell is still unfound
    const scene = (label, id, how) => ({ id, label, cost: how.cost, effect: st => {
      if (how.cost) st.inventory.gold -= how.cost;
      if (how.serve) S.serve(st, ID, how.serve, { reason: 'hunted the plotters' });
      if (how.deed) C.deed(st, ID, how.deed[0], how.deed[1], { tag: how.deed[2] });
      const c = C.findCell(st, st.world.location);
      return (how.text || '') + (c ? ' The trail leads to ' + nm(c.at) + ': a cell of the ' + groupName(c.f) + '.' : ' The trail goes cold. Someone got there first.'); } });
    C.CONTRACT_KINDS.realm_cell = { faction: ID, name: 'Hunt the plotters', minRank: 0, targets: ['village', 'hamlet', 'town', 'market'], hops: 4, n: 1, owners: [ID],
      brief: t => 'Someone at ' + nm(t[0]) + ' knows where the plotters meet. Make them say it.',
      steps: t => [{ type: 'scene', at: t[0] }], reward: lv => ({ gold: 25 + 5 * lv, standing: 30 }),
      scene: { setup: 'The man the board named keeps a stall by the well. He has seen you coming for some time, and he is sweating.',
        options: [scene('Ask him plainly', 'ask', { serve: 5, deed: ['light', 1, 'honesty'], text: 'He talks, in the end. Plain questions are hard to dodge.' }),
          scene('Pay for the name (40 gold)', 'pay', { cost: 40, text: 'The coins vanish, and so does his nerve.' }),
          scene('Lean on him', 'lean', { serve: 10, deed: ['dark', 1, 'cruelty'], text: 'He talks fast once you have his arm behind his back.' })] } };
    { const ko0 = C.kindOk; C.kindOk = function (st, kind, board) { if (kind === 'realm_cell') return board === ID && C.plotUnfound(st) > 0; return ko0.apply(this, arguments); }; }
    // strongholds never turn up in tavern rumours; they are shown by the rules
    C.rumourSkip = (st, id) => !!(C.NODES[id] && C.NODES[id].stronghold);

    // ---- clearing a cell: a scene at its place, then a fight ----
    function cellFight(st, c) {
      const B = P.by[c.f], at = st.world.location, region = C.NODES[at].region, lv = lvl(st);
      const enc = { name: 'A cell of the ' + groupName(c.f), map: C.mapFor(st, region, at), rec: lv, enemyFaction: 'outlaws', enemies: B.squad.map(e => Object.assign({}, e)),
        objective: null, once: false, wander: true, plotCell: c.id, reward: { xp: 60 + 14 * lv, gold: 20 + 6 * lv } };
      st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text: 'They were waiting for you. Not long enough.' }; C.ENCOUNTERS.wander = enc;
      return { fight: 'plot_cell' };
    }
    const CELL_MOVES = [];
    ALL.forEach(f => { for (let slot = 0; slot < 3; slot++) {
      const m = { id: 'plot_cell_' + f + '_' + slot, who: 'informer', at: 'crown_keep', f, slot,
        trip: st => { const c = cellsOf(st, f).find(x => x.slot === slot); return live(st) && !!c && !!c.found && !c.cleared && !c.rose; },
        setup: 'The ' + P.by[f].group + ' keep a cell here.', lines: [],
        view: st => [P.by[f].cell, 'They will scatter if they hear you coming. They will be back if you leave them.'],
        options: [{ id: 'strike', label: 'Root them out', hint: 'A fight. The realm will thank you, and the plotters will lose ground.', go: st => cellFight(st, cellsOf(st, f).find(x => x.slot === slot)) },
          { id: 'later', label: 'Not yet', go: () => ({ text: 'You leave them to it, for now.', repeat: true }) }] };
      CELL_MOVES.push(m); C.MOVES.push(m); } });

    function clearCell(st, c) {
      const p = plot(st); c.cleared = Math.max(1, day(st)); S.serve(st, ID, P.reward.standing, { reason: 'rooted out a cell of the ' + groupName(c.f) });
      C.relNews(st, 'A cell of the ' + groupName(c.f) + ' at ' + nm(c.at) + ' has been rooted out.', 'plot');
      if (c.f === p.main && !p.risen) { p.clock = day(st); p.warned = false;
        if (!p.shown && cellsOf(st, p.main).every(x => x.cleared)) showStronghold(st, 'Their last cell gave up the rest: the ' + groupName(p.main) + ' are holed up in ' + mid(P.by[p.main].stronghold.name) + '.'); }
    }
    function showStronghold(st, text) { const p = plot(st), id = P.by[p.main].stronghold.id; if (p.shown) return; p.shown = Math.max(1, day(st)); C.reveal(st, id); C.relNews(st, text, 'plot'); }
    { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optId, res) {
        const e = C.ENCOUNTERS[encId], cellId = e && e.plotCell, dg = e && e.dungeon && SH[e.dungeon] ? e.dungeon : null;
        const out = ae0.apply(this, arguments), p = plot(st);
        if (cellId && p) { const c = p.cells.find(x => x.id === cellId), won = !!(res && res.won);
          if (c && won) { clearCell(st, c); if (out && typeof out === 'object') out.plotCell = { cleared: true, group: groupName(c.f) }; }
          else if (c) { const M = st.world.moves; if (M && M.fired) delete M.fired['plot_cell_' + c.f + '_' + c.slot]; } }   // a lost fight leaves the cell where it was
        if (dg && p && C.dungeonStatus(st, dg).cleared && SH[dg] === p.main && !p.ended) { const how = endPlot(st); if (out && typeof out === 'object') out.plotEnd = how; }
        return out; }; }

    // ---- the clock, the rising, the end ----
    function rise(st) {
      const p = plot(st), f = p.main, B = P.by[f], u = C.union(st), w = st.world, sh = B.stronghold.id;
      p.risen = Math.max(1, day(st));
      u.absorbed = u.absorbed.filter(x => x !== f); if (w.fallen) delete w.fallen[f];
      const took = [sh];
      (w.nodes[sh] = w.nodes[sh] || {}).owner = f; if (C.setGarrison) C.setGarrison(st, sh, 8);
      cellsOf(st, f).filter(c => !c.cleared).forEach(c => { c.rose = Math.max(1, day(st)); (w.nodes[c.at] = w.nodes[c.at] || {}).owner = f; if (C.setGarrison) C.setGarrison(st, c.at, C.garrisonBase(c.at) + 2); took.push(c.at); });
      if (C.reveal) C.reveal(st, sh); p.shown = p.shown || p.risen;
      const ss = C.supplyState(st); took.forEach(id => { delete ss.iso[id]; delete ss.cut[id]; });
      C.unionSync(st);
      S.setRelation(st, ID, f, -0.95, { both: true });
      const rs = C.relState(st), k = [f, ID].sort().join('|'); rs.wars[k] = { since: day(st), by: f }; delete rs.truce[k];
      st.factions.rivalryOverrides = st.factions.rivalryOverrides || {}; st.factions.rivalryOverrides[k] = 'opposed';
      const at = took.slice(1).map(nm);
      C.relNews(st, 'The ' + B.rebel + ' have risen. ' + B.leader + ' raises the old colours at ' + mid(B.stronghold.name) + (at.length ? ', and ' + (at.length > 1 ? at.slice(0, -1).join(', ') + ' and ' + at[at.length - 1] + ' go' : at[0] + ' goes') + ' with them' : '') + '. They are at war with the ' + F[ID].name + '.', 'war');
    }
    function endPlot(st) {
      const p = plot(st), f = p.main, B = P.by[f], u = C.union(st), sh = B.stronghold.id; let how;
      if (p.risen) {
        C.wipeOut(st, f, ID, true, sh);
        st.world.fallen[f].absorbed = true; if (!u.absorbed.includes(f)) u.absorbed.push(f);
        how = 'crushed'; C.relNews(st, 'The ' + B.rebel + ' are broken. ' + B.stronghold.name + ' is taken, and the old colours burn.', 'fallen');
      } else { how = 'foiled'; C.relNews(st, 'The ' + groupName(f) + ' will not rise. ' + B.stronghold.name + ' is taken, and their plot dies with it.', 'plot'); }
      cellsOf(st, f).forEach(c => { if (!c.cleared) c.cleared = Math.max(1, day(st)); });
      p.ended = Math.max(1, day(st)); p.how = how; C.unionSync(st);
      S.serve(st, ID, 80, { reason: how === 'crushed' ? 'broke the ' + B.rebel : 'ended the ' + groupName(f) + '\'s plot' });
      return how;
    }
    C.plotRise = rise; C.plotEnd = endPlot;
    C.plotDaysLeft = st => { const p = plot(st); return p && p.main && !p.risen && !p.ended ? Math.max(0, P.rise - (day(st) - p.clock)) : null; };
    { const rt0 = C.relTick; C.relTick = function (st) {
        const r = rt0.apply(this, arguments), p = plot(st);
        if (p && !p.ended && p.main && C.union(st)) {
          if (!p.risen) { const left = C.plotDaysLeft(st);
            if (left <= 0) rise(st);
            else if (left <= P.warn && !p.warned) { p.warned = true; C.relNews(st, 'Word on the roads: the ' + groupName(p.main) + ' are buying blades and horses. Something is coming, and soon.', 'plot'); } }
          else { const k = [p.main, ID].sort().join('|'), rs = C.relState(st); if (!C.fallen(st, p.main)) { if (S.getRelation(st, ID, p.main) > -0.8) S.setRelation(st, ID, p.main, -0.8, { both: true }); if (!rs.wars[k]) rs.wars[k] = { since: day(st), by: p.main }; } }   // rebels make no peace
        }
        return r; }; }
    { const cj0 = S.canJoin; S.canJoin = function (st, f) { const p = plot(st); if (p && p.risen && !p.ended && f === p.main) return { ok: false, reason: 'The ' + P.by[f].rebel + ' take no oaths from strangers' }; return cj0.apply(this, arguments); }; }

    // ---- the reveals: one per plotter, after its first cell falls ----
    ALL.forEach(f => { const B = P.by[f];
      C.MOVES.push({ id: 'plot_reveal_' + f, who: 'prisoner', at: null,
        trip: st => live(st) && cellsOf(st, f).some(c => c.cleared && !c.rose),
        setup: 'The last of the cell is on their knees in the straw, and talking. They want you to know who they are, and who they follow.',
        view: st => { const p = plot(st), main = p && p.main === f;
          return [B.cause, main ? '"There are more of us than you have found. And there is a place you will never find, where ' + B.leader + ' waits."' : '"We are not many. But we remember, and we can wait."']; },
        options: [{ id: 'hand', label: 'Hand them to the realm\'s justice', hint: 'The court will be pleased.', go: st => { S.serve(st, ID, 30, { reason: 'handed a plotter to justice' }); C.deed(st, ID, 'gray', 1, { tag: 'law' }); return { text: 'The wardens take them away. They do not look back.' }; } },
          { id: 'spare', label: 'Let them go, with a message for their leader', hint: 'Mercy. The court may not see it that way.', go: st => { C.deed(st, ID, 'light', 2, { tag: 'mercy' }); gw(st, 3, 'spared a plotter'); return { text: '"Tell ' + B.leader + ' the realm has room for him, if he wants it." They run.' }; } },
          { id: 'turn', label: 'Pay them for another name (' + P.reward.informer + ' gold)', hint: 'Another of their cells.', if: st => st.inventory.gold >= P.reward.informer && openCells(st).some(c => c.f === f && !c.found),
            go: st => { st.inventory.gold -= P.reward.informer; const c = C.findCell(st, st.world.location, f); C.deed(st, ID, 'gray', 1, { tag: 'cunning' }); return { text: c ? 'They take the coin and give you ' + nm(c.at) + '. They do not meet your eye.' : 'They take the coin and tell you nothing you can use.' }; } }] });
    });

    // ---- the beats ----
    const fvOf = st => C.unionFlavour(st) || {}, fk = st => { const u = C.union(st); return u ? u.flavour : null; };
    const CORE = [
      { r: 1, setup: 'Your first charge comes with the wax on its seal still soft.',
        lines: { crown: '"The court wants the roads kept and the oaths kept. Some of the old houses have not sworn yet, and some of them never will."',
          syndicate: '"The Concord wants the markets open and the books balanced. Somebody is moving money that is in no book at all. Follow it."',
          synod: '"The Ascendancy wants every spell written down. Somebody is keeping spells that are not. Find out who."',
          broken_banner: '"We fought for this. Now we have to keep it. The ones we beat have not forgotten, and they have friends in the villages."',
          hearthwatch: '"The Commonwealth wants the fighting over. The ones who lost do not. Keep your eyes open, and your door too."' },
        view: st => ['"Welcome to the ' + fvOf(st).name + '. Most of the realm is glad of the peace. Not all of it."', null, '"The losers have hardliners, and the hardliners have cellars. Every board in the realm will pay for news of them."'],
        options: [{ id: 'ask', label: 'Ask where to start', go: st => { S.serve(st, ID, 10, { reason: 'took the first charge' }); return { text: '"Taverns. Drunk men talk about their grievances. Sober men talk about their plans. Listen for the sober ones."' }; } },
          { id: 'peace', label: 'Say you will keep the peace, not hunt your neighbours', hint: 'Fair words. The court wanted keener ones.', go: st => { C.deed(st, ID, 'light', 1, { tag: 'mercy' }); return { text: '"Keep it, then. Just don\'t be surprised when it bites."' }; } }] },
      { r: 2, setup: 'Someone you once knew from the old days is waiting by the well, with a bundle under one arm: an old banner, folded small.',
        lines: { crown: 'The Throne\'s law says every old banner goes on the fire.', syndicate: 'The Concord pays a copper for every old banner handed in, and asks no questions.', synod: 'The Ascendancy wants every old banner written down, then burned.',
          broken_banner: 'The Banner Realm burned its own colours the day it won. It expects everyone else to do the same.', hearthwatch: 'The Commonwealth asked for the old banners to be given up. It never said what happens if they are not.' },
        view: st => ['"They are burning the old colours in the square. I can\'t burn this one. My brother died under it."', '"Let me keep it. I won\'t fly it. I just won\'t burn it."', null],
        options: [{ id: 'burn', label: 'Take it to the fire yourself', hint: 'The law, kept. Your old friend will not forgive it soon.', go: st => { S.serve(st, ID, 25, { reason: 'burned an old banner' }); C.deed(st, ID, 'gray', 1, { tag: 'law' }); return { text: 'It burns quickly. Old cloth always does.' }; } },
          { id: 'keep', label: 'Let them keep it', hint: 'A kindness. If the court hears of it, it will not be pleased.', go: st => { C.deed(st, ID, 'light', 2, { tag: 'mercy' }); gw(st, 2, 'let an old banner be'); return { text: '"Thank you." The bundle goes back under the arm, and stays there.' }; } },
          { id: 'report', label: 'Report them', hint: 'The court will reward it. Everyone at the well will know who did it.', go: st => { S.serve(st, ID, 35, { reason: 'reported an old banner' }); C.deed(st, ID, 'dark', 2, { public: true, tag: 'cruelty' }); return { text: 'The wardens come at dusk. The well is very quiet after that.' }; } }] },
      { r: 3, setup: 'The realm is sending its first envoy beyond the human lands, and the court wants a face it can trust riding beside it.',
        lines: { crown: 'An oath-scroll for the Ironbound Holds, sealed with the Throne\'s new seal. The dwarves are said to read every word twice.',
          syndicate: 'A trade mission to the Gilded Anvil, with a price list and a better one hidden under it.',
          synod: 'A warning for the elves: the wards along the border are failing, and the Ascendancy wants them to hear it first.',
          broken_banner: 'A raid on the orc border, the Banner\'s way of saying hello. The court calls it an envoy, with a straight face.',
          hearthwatch: 'A plea to the Mire-Born for peace, carried by a cart of bread and a very nervous clerk.' },
        view: st => [null, '"What they think of this realm, they will think of you. Try to be worth it."'],
        options: [{ id: 'plain', label: 'Speak plainly for the realm', hint: 'Honest. The court will like the result more than the method.', go: st => { S.serve(st, ID, 30, { reason: 'rode with the first envoy' }); C.deed(st, ID, 'light', 1, { tag: 'honesty' }); return { text: 'They do not like everything you say. They believe all of it.' }; } },
          { id: 'flatter', label: 'Say what they want to hear', hint: 'Smooth. Some of it will come back to the realm later.', go: st => { S.serve(st, ID, 30, { reason: 'rode with the first envoy' }); C.deed(st, ID, 'gray', 1, { tag: 'deceit' }); return { text: 'They smile a great deal. You wonder how much of it is meant.' }; } },
          { id: 'watch', label: 'Say little and watch the envoy', go: st => { S.serve(st, ID, 20, { reason: 'rode with the first envoy' }); return { text: 'You learn more about the realm\'s envoy than about the people you visited.' }; } }] },
      { r: 4, setup: 'You are called to a small room with one window. On the table is a map, and on the map a stain is spreading from the north.',
        lines: { crown: '"The Throne will hold if its oaths hold. Will yours?"', syndicate: '"Markets close when people are afraid. We cannot afford afraid."', synod: '"The Ward will not hold for ever. We have known that longer than anyone."',
          broken_banner: '"We have run from worse. We would rather not run again."', hearthwatch: '"Whoever comes through the door, we feed them first and ask questions after. That is the whole of it."' },
        view: st => { const u = C.union(st); return ['"The Calamity is moving again," says ' + (u ? u.ruler : 'the ruler') + '. "Every land will feel it. The question is whether this realm holds together when it does."', null]; },
        options: [{ id: 'hold', label: '"Hold the realm together, whatever it costs."', hint: 'The court will lean on you for it.', go: st => { S.serve(st, ID, 40, { reason: 'counselled the ruler' }); C.deed(st, ID, 'gray', 1, { tag: 'law' }); return { text: '"Whatever it costs," the ruler repeats, and writes something down.' }; } },
          { id: 'open', label: '"Open the gates to whoever runs from it."', hint: 'Mercy. Not everyone at court will thank you.', go: st => { S.serve(st, ID, 20, { reason: 'counselled the ruler' }); C.deed(st, ID, 'light', 2, { tag: 'mercy' }); gw(st, 3, 'spoke for the refugees'); return { text: 'The ruler looks at the map for a long time. "Then we will need more bread."' }; } },
          { id: 'wall', label: '"Arm the borders, and let the others fend for themselves."', hint: 'Hard. The court will like it more than the villages will.', go: st => { S.serve(st, ID, 40, { reason: 'counselled the ruler' }); C.deed(st, ID, 'dark', 1, { tag: 'cruelty' }); return { text: '"Hard counsel," says the ruler. "Hard times."' }; } }] }
    ];
    const CORE_MOVES = CORE.map(b => { const m = { id: 'realm_core_' + b.r, who: 'herald', at: null,
      trip: st => !!C.union(st) && realmRank(st) >= b.r,
      setup: b.setup, lines: [], view: st => b.view(st).map(x => x === null ? (b.lines[fk(st)] || '') : x).filter(Boolean), options: b.options }; C.MOVES.push(m); return m; });

    const serveGo = (n, why, deed, text, extra) => st => { if (n) S.serve(st, ID, n, { reason: why }); if (deed) C.deed(st, ID, deed[0], deed[1], { tag: deed[2], public: !!deed[3] }); if (extra) extra(st); return { text }; };
    const FLAVOUR = {
      crown: [
        { r: 2, who: 'voss', setup: 'Lord Marshal Voss is in the yard, watching new recruits fall over. He nods you over without looking away from them.',
          lines: ['"A deserter from the old wars came back last week. Wants to swear to the Throne. He ran once."', '"You have the rank to judge him now. So judge him."'],
          options: [{ id: 'take', label: 'Take his oath', hint: 'Mercy. Voss will remember who you trusted.', go: serveGo(15, 'judged a deserter', ['light', 2, 'mercy'], '"Then he is yours if he runs again," says Voss. He does not sound angry.') },
            { id: 'rope', label: 'Send him to the rope', hint: 'The old law. The yard goes very quiet.', go: serveGo(35, 'judged a deserter', ['dark', 2, 'law', true], 'Voss watches it done. "The law is the law," he says, mostly to himself.') },
            { id: 'border', label: 'Send him to the border garrison', hint: 'A middle road. Nobody is quite happy.', go: serveGo(25, 'judged a deserter', ['gray', 1, 'law'], '"A cold post for a cold man," says Voss. "Good."') }] },
        { r: 4, who: 'voss', setup: 'In the great hall, the Throne\'s sword lies on a cushion. It is a plain sword. Everyone in the room is looking at it anyway.',
          lines: ['"The realm needs someone to carry it at the head of the host," says Voss. "I am too old, and too well known. You are neither."'],
          options: [{ id: 'carry', label: 'Take up the sword', hint: 'The Throne\'s highest trust, and its heaviest.', go: serveGo(60, 'took up the Throne\'s sword', ['gray', 1, 'law'], 'The sword is lighter than it looks. The hall is not.') },
            { id: 'refuse', label: 'Ask that it go to someone who wants it', hint: 'Humble. The court will wonder why.', go: serveGo(10, 'declined the Throne\'s sword', ['light', 1, 'honesty'], 'Voss laughs, once. "That is exactly what someone who should carry it would say."') }] }],
      syndicate: [
        { r: 2, who: 'crane', setup: 'Factor Crane has a ledger open on a barrel in a warehouse that smells of pepper. He turns it round so you can read it.',
          lines: ['"Every village that borrowed through the war owes the Concord. This one owes more than it can pay. Collect it, forgive it, or find me a third way."'],
          options: [{ id: 'collect', label: 'Collect in full', hint: 'Good for the books. Bad for the village.', go: serveGo(35, 'collected a war debt', ['dark', 1, 'greed'], 'They pay. They will not forget who came for it.', st => { st.inventory.gold += 40; }) },
            { id: 'forgive', label: 'Forgive it', hint: 'The village will bless you. Crane will make a note.', go: serveGo(0, '', ['light', 2, 'mercy'], '"Generous," says Crane, and writes something in the margin.', st => gw(st, 3, 'forgave a war debt')) },
            { id: 'terms', label: 'Rewrite the terms over ten harvests', hint: 'Everyone gets something. Nobody gets enough.', go: serveGo(25, 'rewrote a war debt', ['gray', 1, 'cunning'], '"A third way," says Crane. "You may go far."') }] },
        { r: 4, who: 'crane', setup: 'The Partners meet at a round table with no head. There is an empty chair, and a pen laid on a book in front of it.',
          lines: ['"Sign as guarantor of the realm\'s debts," says Crane, "and your name is in the book. Not under it. In it."'],
          options: [{ id: 'sign', label: 'Sign the book', hint: 'A Partner\'s place, and every debt in the realm with your name on it.', go: serveGo(60, 'signed the Concord\'s book', ['gray', 1, 'greed'], 'The ink dries fast. It is that kind of ink.', st => { st.inventory.gold += 100; }) },
            { id: 'refuse', label: 'Leave the pen where it lies', hint: 'Free of the book. The Partners will wonder what you want instead.', go: serveGo(10, 'declined the Concord\'s book', ['light', 1, 'honesty'], '"Everyone has a price," says Crane. "We will find yours."') }] }],
      synod: [
        { r: 2, who: 'ilvane', setup: 'Archon Ilvane receives you in a cold room full of warm lamps. Three hedge-mages sit in chains along the wall.',
          lines: ['"The Ward needs feeding," she says. "One of them is dangerous. One of them is useful. One of them is only unlucky. You choose who goes down."'],
          options: [{ id: 'all', label: 'Send all three', hint: 'The law, to the letter. The Ward will be fed.', go: serveGo(40, 'judged the hedge-mages', ['dark', 2, 'law', true], 'Ilvane nods. "Thorough," she says. It is not a compliment, and it is not an insult.') },
            { id: 'one', label: 'Send the dangerous one', hint: 'Careful. The other two owe you their lives.', go: serveGo(25, 'judged the hedge-mages', ['gray', 1, 'law'], '"You see clearly," says Ilvane. "Most do not."') },
            { id: 'none', label: 'Send none of them', hint: 'Mercy, and a cost at court.', go: serveGo(0, '', ['light', 2, 'mercy'], 'Ilvane looks at you for a long moment. "The Ward will be fed," she says. "Just not today."', st => gw(st, 2, 'spared the hedge-mages')) }] },
        { r: 4, who: 'ilvane', setup: 'Ilvane takes you below Vol\'Dun, down a stair that was not there yesterday, to a door with no handle.',
          lines: ['"Behind this door is what the Ward is for. Few have seen it. Fewer have stayed sane. I would like you to be one of the keepers."'],
          options: [{ id: 'enter', label: 'Go through the door', hint: 'The Ascendancy\'s deepest secret, and its trust.', go: serveGo(60, 'became a keeper of the Ward', ['gray', 1, 'secrecy'], 'What you see, you will not write down. You understand why the Ward is fed.') },
            { id: 'refuse', label: 'Say some doors should stay shut', hint: 'Wise, perhaps. Ilvane will not ask twice.', go: serveGo(10, 'refused the Ward', ['light', 1, 'honesty'], '"Perhaps you are right," says Ilvane. "I hope so."') }] }],
      broken_banner: [
        { r: 2, who: 'old_standard', setup: 'Captain Old Standard is sitting at a campfire with a rider tied to the log beside him. The rider is very young.',
          lines: ['"Robbed a village after the war was over. Said he forgot it was over." He pokes the fire. "You have the rank. What do we do with him?"'],
          options: [{ id: 'hang', label: 'Hang him', hint: 'The realm\'s law. The riders will remember it.', go: serveGo(35, 'judged a rider', ['dark', 2, 'law', true], 'The Captain does it himself. He does not speak for the rest of the night.') },
            { id: 'repay', label: 'Make him pay the village back twice over', hint: 'Fair, and slow.', go: serveGo(25, 'judged a rider', ['gray', 1, 'law'], '"Twice over," says Old Standard. "He will be poor for a long time. Good."') },
            { id: 'free', label: 'Cut him loose', hint: 'The old Banner way. The villages will not like it.', go: serveGo(5, 'judged a rider', ['dark', 1, 'greed'], 'The boy runs. Old Standard watches him go. "That one will be back," he says.') }] },
        { r: 4, who: 'old_standard', setup: 'The whole camp is awake at dawn. Old Standard holds out the Banner itself, the torn one, the one that started all of this.',
          lines: ['"Carry it on the border. Let the other races see who we are."'],
          options: [{ id: 'carry', label: 'Take the Banner', hint: 'The Banner-Bearer\'s place, and every eye on you.', go: serveGo(60, 'took up the Banner', ['light', 1, 'honour'], 'The cloth is heavier than it looks. They cheer anyway.') },
            { id: 'younger', label: 'Give it to someone younger', hint: 'Humble. The camp will talk about it for years.', go: serveGo(20, 'passed on the Banner', ['light', 2, 'mercy'], 'You hand it to a girl who has never held anything so heavy. She does not drop it.') }] }],
      hearthwatch: [
        { r: 2, who: 'agathe', setup: 'Mother Agathe meets you at a chapel door. Behind her, a dozen families who backed the losing side are sitting on the benches.',
          lines: ['"They have nowhere to go. Some of them are plotters\' kin. Some of them are only hungry. Do we open the door to all of them?"'],
          options: [{ id: 'open', label: 'Open the door to all of them', hint: 'The Commonwealth\'s way. The court will worry.', go: serveGo(20, 'opened a chapel to the defeated', ['light', 2, 'mercy'], '"Good," says Agathe, and goes to find more bread.', st => gw(st, 3, 'opened the door')) },
            { id: 'sort', label: 'Take each family as it comes', hint: 'Slower. Fairer, perhaps.', go: serveGo(25, 'sorted the defeated', ['gray', 1, 'law'], 'It takes all night. Most of them stay.') },
            { id: 'shut', label: 'Turn away the plotters\' kin', hint: 'Safer for the realm. Hard on the children.', go: serveGo(35, 'turned away the plotters\' kin', ['dark', 1, 'cruelty'], 'Agathe does not argue. She does not look at you either.') }] },
        { r: 4, who: 'agathe', setup: 'The first open council of the Commonwealth meets in a barn, because no hall is big enough. Elders from a hundred villages are waiting.',
          lines: ['"Speak for us," says Agathe. "Or speak for the court. You cannot do both, not today."'],
          options: [{ id: 'elders', label: 'Speak for the villages', hint: 'The elders\' trust. The court will be cooler.', go: serveGo(40, 'spoke for the villages', ['light', 2, 'honesty'], 'The barn roars. Somewhere in Crown Keep, someone frowns.', st => gw(st, 4, 'spoke for the villages')) },
            { id: 'court', label: 'Speak for the court', hint: 'The realm\'s trust. The barn goes quiet.', go: serveGo(60, 'spoke for the court', ['gray', 1, 'law'], 'They listen. They do not cheer. That is something, in a barn.') }] }]
    };
    Object.entries(FLAVOUR).forEach(([f, list]) => list.forEach(b => C.MOVES.push({ id: 'realm_' + f + '_r' + b.r, who: b.who, at: null,
      trip: st => fk(st) === f && realmRank(st) >= b.r, setup: b.setup, lines: b.lines, options: b.options })));

    // ---- words for the realm card ----
    C.plotWords = function (st) {
      const p = plot(st); if (!p) return [];
      const out = [], found = openCells(st).filter(c => c.found), main = p.main;
      if (p.ended && p.how === 'crushed') out.push('The ' + P.by[main].rebel + ' rose, and were broken.');
      else if (p.ended) out.push('The ' + groupName(main) + '\'s plot is over.');
      else if (p.risen) out.push('The ' + P.by[main].rebel + ' have risen and are at war with the realm. ' + P.by[main].stronghold.name + ' is their stronghold.');
      else if (main) { const left = C.plotDaysLeft(st); out.push('The ' + groupName(main) + ' are plotting' + (left <= P.warn ? ', and are close to rising.' : '.') + (p.shown ? ' Their stronghold is ' + mid(P.by[main].stronghold.name) + '.' : '')); }
      const lesser = p.plotters.filter(f => f !== main && openCells(st).some(c => c.f === f));
      if (lesser.length) out.push('Also plotting: the ' + lesser.map(groupName).join(', the ') + '.');
      if (found.length) out.push('Cells found: ' + found.map(c => nm(c.at)).join(', ') + '.');
      if (C.plotUnfound(st)) out.push('Other cells are still hidden. Taverns and the realm\'s boards may know where.');
      return out;
    };

    // ---- old saves and new games ----
    { const rp0 = S.repair; S.repair = function () {
        const r = rp0.apply(this, arguments), st = r && r.state; if (!st || !st.world) return r;
        if (C.union(st) && !plot(st)) { C.makePlot(st, {}); if (r.fixes) r.fixes.push('The realm\'s plotters are at work'); }
        C.plotSync(st); return r; }; }
    { const ng0 = C.newGame; C.newGame = function () { const st = ng0.apply(this, arguments); C.plotSync(st); return st; }; }

    C.validatePlot = function () {
      const p = [], cls = D.classes || {};
      ALL.forEach(f => { const B = P.by[f]; if (!B) { p.push('plot: no plotter ' + f); return; }
        B.squad.forEach(e => { if (!cls[e.primary]) p.push('plot: ' + f + ' squad has unknown class ' + e.primary); });
        (B.sites || []).forEach(id => { if (!C.NODES[id]) p.push('plot: unknown site ' + id); });
        if (B.stronghold) { const s = B.stronghold; if (!C.NODES[s.id]) p.push('plot: no stronghold node ' + s.id);
          s.fl.concat([['boss'].concat(s.boss)]).forEach(x => x.slice(1).forEach(e => { if (!cls[e.primary]) p.push('plot: ' + s.id + ' has unknown class ' + e.primary); }));
          for (let i = 1; i <= s.floors.length; i++) if (D.maps && !D.maps['dgm_' + s.id + '_' + i]) p.push('plot: ' + s.id + ' floor ' + i + ' has no map'); } });
      ['crown', 'syndicate', 'synod', 'broken_banner', 'hearthwatch'].forEach(f => { if (!FLAVOUR[f] || FLAVOUR[f].length !== 2) p.push('plot: flavour ' + f + ' needs two beats'); });
      CORE.forEach(b => Object.keys(C.UNION.flavours).forEach(f => { if (!b.lines[f]) p.push('plot: core beat ' + b.r + ' has no line for ' + f); }));
      return p;
    };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
