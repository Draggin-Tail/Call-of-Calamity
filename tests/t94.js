// Node ownership, phase 4c (design/node_ownership_and_land.md, section 18): the realm's plotters and beats. Plotters and the main one,
// cells and where they sit, finding them (rumours, the realm's contract, informers), clearing them, the reveals, the clock and the warning,
// the rising (the old faction back under a rebel name, at war), the stronghold (shown, foiled, crushed), old saves, sync between saves,
// and the beats (a core scene per realm rank, the flavours' rank 2 and 4 scenes).
// Run: cd tests && node t94.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, P = C.PLOT, F = w.GAME_DATA.factions;
const HW = ['crown', 'syndicate', 'synod', 'broken_banner'];
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; st.world.flags.guide_off = 1; return st; };
const days = (st, n) => { for (let i = 0; i < n; i++) S.advanceDay(st); };
// a crowned Moot, with plotters set by hand (a real Moot's tally is not run here)
const united = (outcome, plotters) => { const st = fresh(); C.applyRealm(st, outcome); days(st, C.UNION.coronation); C.union(st).seen = 1; st.world.rbNext = 1e9; C.relState(st).next = 1e9;
  delete st.world.plot; C.union(st).plotters = plotters; C.makePlot(st, {}); C.attackTick0 = C.attackTick0 || C.attackTick; return st; };
const noAttacks = fn => { const a = C.attackTick; C.attackTick = () => {}; try { return fn(); } finally { C.attackTick = a; } };
const won = { won: true, kills: [], survivors: [] }, lost = { won: false, kills: [], survivors: [] };
const strike = (st, c) => { st.world.location = c.at; const b = C.checkMoves(st, c.at); if (!b || !/^plot_cell_/.test(b.id)) return null; const r = C.chooseMove(st, 'strike'); return r; };
const fired = st => (st.world.moves || {}).fired || {};
const words = s => /\d/.test(s.replace(/\(\d+ gold\)/g, ''));

ok('the data checks are clean', C.validatePlot().length === 0 && C.validate().length === 0 && C.validateUnion().length === 0 && C.validatePolicy().length === 0 && (!C.validateWork || C.validateWork().length === 0), JSON.stringify(C.validatePlot()));
ok('four strongholds: hidden dungeons, three floors, borrowed maps', HW.every(f => { const s = P.by[f].stronghold, n = C.NODES[s.id], d = C.DUNGEONS[s.id]; return n && n.hidden && n.type === 'dungeon' && n.stronghold === f && d.floors.length === 3 && [1, 2, 3].every(i => !!w.GAME_DATA.maps['dgm_' + s.id + '_' + i]); }));

// ---- before a union ----
{ const st = fresh();
  ok('no union: no plot, no words', !C.plot(st) && C.plotWords(st).length === 0 && C.plotUnfound(st) === 0);
  ok('strongholds never turn up in rumours', HW.every(f => C.rumourSkip(st, P.by[f].stronghold.id)) && !C.rumourSkip(st, 'rookwood_barn'));
  ok('the hunt is not on any board', !Object.keys(C.NODES).some(id => C.contractBoard(st, id).some(o => o.kind === 'realm_cell')));
}

// ---- the plot: who plots, the main plotter, the cells ----
{ const st = united('ilvane', ['crown', 'broken_banner', 'syndicate']), p = C.plot(st);
  ok('the recorded plotters plot, and Aldermere too', p.plotters.join() === 'crown,broken_banner,syndicate,aldermere', p.plotters.join());
  ok('the main plotter held the most places (at the start, if none hold any now)', p.main === 'crown');
  const n = f => p.cells.filter(c => c.f === f).length;
  ok('three cells for the main plotter, two for the lesser, one for Aldermere', n('crown') === 3 && n('broken_banner') === 2 && n('syndicate') === 2 && n('aldermere') === 1);
  ok('cells sit in the plotter\'s old land, in ordinary places', p.cells.filter(c => c.f !== 'aldermere').every(c => C.defaultOwner(c.at) === c.f && !C.NODES[c.at].hidden && P.siteTypes.includes(C.NODES[c.at].type)));
  ok('no place holds two cells', new Set(p.cells.map(c => c.at)).size === p.cells.length);
  ok('nothing is found at first, and the clock starts at the union', p.cells.every(c => !c.found && !c.cleared) && p.clock === st.world.day && C.plotDaysLeft(st) === P.rise);
  ok('the realm card names the plotters in words', C.plotWords(st).some(t => /Old Oath loyalists are plotting/.test(t)) && C.plotWords(st).some(t => /Aldermere loyalists/.test(t)) && !C.plotWords(st).some(words));
  const q = united('osric', ['syndicate']);
  ok('Osric crowned: Aldermere does not plot', !C.plot(q).plotters.includes('aldermere') && C.plot(q).main === 'syndicate');
  const r = united('wil', []);
  ok('no war faction against the winner: Aldermere alone, and no main plotter', C.plot(r).main === null && C.plot(r).plotters.join() === 'aldermere' && C.plotDaysLeft(r) === null);
}

// ---- finding and clearing a cell; the reveal; informers ----
{ const st = united('ilvane', ['crown', 'broken_banner']), p = C.plot(st);
  const c = C.findCell(st, 'crown_keep');
  ok('finding a cell marks it and puts its place on the map', !!c && c.found > 0 && C.isDiscovered(st, c.at));
  ok('a found cell is a scene at its place', C.movesHere(st, c.at).some(m => /^plot_cell_/.test(m.id)));
  st.world.location = c.at; const b = C.checkMoves(st, c.at);
  ok('the scene offers to root them out, or not yet', b && b.options.map(o => o.id).join() === 'strike,later' && !b.lines.some(words));
  C.chooseMove(st, 'later'); ok('not yet: the cell waits', !c.cleared && C.movesHere(st, c.at).length > 0);
  let r = strike(st, c); ok('rooting them out is a fight', r && r.fight === 'plot_cell' && st.world.wander && /cell of the/.test(st.world.wander.enc.name), JSON.stringify(r));
  C.applyEncounterResult(st, 'wander', null, lost);
  ok('a lost fight leaves the cell, and the scene comes back', !c.cleared && !fired(st)['plot_cell_' + c.f + '_' + c.slot] && C.movesHere(st, c.at).length > 0);
  st.world.wander = null; const s0 = S.getStanding(st, 'realm'); p.clock = st.world.day - 30;
  r = strike(st, c); const out = C.applyEncounterResult(st, 'wander', null, won);
  ok('a won fight clears it: the realm is pleased, word goes round', c.cleared > 0 && S.getStanding(st, 'realm') > s0 && out.plotCell && C.relState(st).news.some(x => /has been rooted out/.test(x.text)));
  ok('clearing one of the main plotter\'s cells starts its clock again', c.f !== p.main || p.clock === st.world.day);
  st.world.wander = null; const rv = C.checkMoves(st, c.at);
  ok('the reveal follows: the plotter names its leader and cause', rv && rv.id === 'plot_reveal_' + c.f && rv.lines.some(l => l.includes(P.by[c.f].leader.split(' ').pop()) || /Marshal|Captain/.test(l)), rv && rv.id);
  ok('the reveal offers an informer while cells of theirs are hidden', rv && rv.options.some(o => o.id === 'turn') === (st.inventory.gold >= P.reward.informer));
  st.inventory.gold = 500; delete (st.world.moves.fired || {})['plot_reveal_' + c.f]; st.world.moves.pending = null; const rv2 = C.startMove(st, 'plot_reveal_' + c.f) || C.checkMoves(st, c.at);
  const before = C.plotUnfound(st); const t = C.chooseMove(st, 'turn');
  ok('an informer gives up another cell, for the price on the label', t.ok && C.plotUnfound(st) === before - 1 && st.inventory.gold === 500 - P.reward.informer, JSON.stringify(t));
}

// ---- rumours and the realm's contract ----
{ const st = united('ilvane', ['crown', 'broken_banner']); st.inventory.gold = 5000;
  const cell = C.plot(st).cells.find(c => c.f === 'crown'); const tav = Object.keys(C.NODES).find(id => C.hasTavern(id) && (() => { const d = {}; const q = [id]; d[id] = 0; while (q.length) { const x = q.shift(); if (d[x] >= 3) continue; Object.keys(C.NODES[x].links).forEach(y => { if (d[y] === undefined) { d[y] = d[x] + 1; q.push(y); } }); } return d[cell.at] !== undefined; })() && C.ownerOf(st, id) === 'realm');
  st.world.location = tav; let hit = null;
  for (let i = 0; i < 40 && !hit; i++) { st.world.day++; const r = C.tavernVisit(st, tav); if (r.ok && /cell of the/.test(r.scene.narr || '')) hit = r; }
  ok('tavern talk turns up a cell within three roads', !!hit && hit.scene.kind === 'rumour' && !hit.scene.choice && C.plot(st).cells.some(c => c.found), tav);
  ok('the rumour reads in words', hit && !hit.scene.lines.some(l => words(l.text)));
  const st2 = united('ilvane', ['crown', 'broken_banner']); st2.inventory.gold = 500;
  let o = null; for (let d = 0; d < 200 && !o; d += 4) { st2.world.day = d; o = C.contractBoard(st2, 'crown_keep').find(x => x.kind === 'realm_cell'); }
  ok('the realm\'s boards post the hunt while cells are hidden', !!o);
  const tk = C.takeContract(st2, 'crown_keep', o.slot), k = tk.contract; st2.world.location = k.steps[0].at;
  const ar = C.contractArrive(st2, k.steps[0].at), n0 = C.plotUnfound(st2), ch = C.contractChoose(st2, 'ask');
  ok('its scene gives up a cell', ar.scene && ch.ok && C.plotUnfound(st2) === n0 - 1 && /a cell of the/.test(ch.text), JSON.stringify(ch).slice(0, 200));
  C.plot(st2).cells.forEach(c => { c.found = 1; });
  let any = false; for (let d = 0; d < 200; d += 4) { st2.world.day = d; if (C.contractBoard(st2, 'crown_keep').some(x => x.kind === 'realm_cell')) any = true; }
  ok('no hunt once every cell is found', !any);
}

// ---- the clock, the warning, the rising ----
{ const st = united('ilvane', ['crown', 'broken_banner']), p = C.plot(st), f = p.main, B = P.by[f];
  noAttacks(() => days(st, P.rise - P.warn - 1));
  ok('no warning yet', !p.warned);
  noAttacks(() => days(st, 1));
  ok('word on the roads warns before the rising', p.warned && C.relState(st).news.some(x => /buying blades and horses/.test(x.text)) && C.plotWords(st).some(t => /close to rising/.test(t)));
  const cellOne = p.cells.find(c => c.f === f); cellOne.found = 1; const r = strike(st, cellOne); C.applyEncounterResult(st, 'wander', null, won); st.world.wander = null;
  ok('clearing a cell puts the rising off', p.clock === st.world.day && C.plotDaysLeft(st) === P.rise && !p.warned);
  noAttacks(() => days(st, P.rise - 1)); ok('not yet risen', !p.risen);
  const left = p.cells.filter(c => c.f === f && !c.cleared).map(c => c.at);
  noAttacks(() => days(st, 1));
  ok('the main plotter rises when the clock runs out', p.risen > 0);
  ok('its old faction is back under the rebel name, no longer absorbed', F[f].name === B.rebel && !C.absorbed(st, f) && !C.fallen(st, f) && C.heirOf(st, f) === f);
  ok('it holds its stronghold (its capital, now on the map) and its uncleared cells', C.ownerOf(st, B.stronghold.id) === f && C.NODES[B.stronghold.id].capital === f && st.world.flags['reveal_' + B.stronghold.id] && left.every(id => C.ownerOf(st, id) === f));
  ok('it is at war with the realm', C.relAtWar(st, f, 'realm'));
  ok('nobody can join the rebels', !S.canJoin(st, f, { force: true }).ok);
  ok('the news names the rebels, their leader and the stronghold', C.relState(st).news.some(x => x.text.includes(B.rebel + ' have risen') && x.text.includes(B.leader)));
  noAttacks(() => { S.setRelation(st, 'realm', f, 0.5, { both: true }); days(st, 3); });
  ok('rebels make no peace', C.relAtWar(st, f, 'realm') && S.getRelation(st, 'realm', f) <= -0.8);
  ok('the supply map sees the stronghold as its capital', !!C.supplied(st)[f]);
  ok('the rebels can attack from it', C.attackOptions(st, f).length > 0);
  // crushing them
  const sh = B.stronghold.id; let k = 0; while (!C.dungeonStatus(st, sh).cleared && k++ < 5) { const e = C.dungeonFight(st, sh); C.applyEncounterResult(st, e, null, won); }
  ok('clearing the stronghold crushes the rebels', p.ended > 0 && p.how === 'crushed' && C.fallen(st, f) && C.absorbed(st, f) && C.ownerOf(st, sh) === 'realm');
  ok('their old name and the stronghold\'s capital mark go back', F[f].name !== B.rebel && !C.NODES[sh].capital && C.heirOf(st, f) === 'realm');
  ok('the realm card says so', C.plotWords(st).some(t => /rose, and were broken/.test(t)));
}

// ---- the stronghold shown before a rising; a plot foiled ----
{ const st = united('ilvane', ['crown']), p = C.plot(st), f = p.main, sh = P.by[f].stronghold.id;
  p.cells.filter(c => c.f === f).forEach((c, i) => { c.found = 1; strike(st, c); C.applyEncounterResult(st, 'wander', null, won); st.world.wander = null; st.world.moves.pending = null;
    if (i < 2) ok('the stronghold stays hidden while cells remain (' + (i + 1) + ')', !st.world.flags['reveal_' + sh]); });
  ok('clearing every cell of the main plotter shows its stronghold', !!st.world.flags['reveal_' + sh] && p.shown > 0 && C.plotWords(st).some(t => /stronghold is the Oath Vault/.test(t)));
  const e1 = C.dungeonFight(st, sh); st.roster.forEach(u => { u.level = 14; }); const e2 = C.dungeonFight(st, sh);
  ok('the stronghold is fought at the party\'s level', C.ENCOUNTERS[e2].rec >= 15, C.ENCOUNTERS[e2].rec);
  let k = 0; while (!C.dungeonStatus(st, sh).cleared && k++ < 5) C.applyEncounterResult(st, C.dungeonFight(st, sh), null, won);
  ok('taking it before the rising foils the plot', p.ended > 0 && p.how === 'foiled' && !p.risen && C.absorbed(st, f));
  noAttacks(() => days(st, P.rise + 5)); ok('a foiled plot never rises', !p.risen);
}

// ---- old saves and sync between saves ----
{ const st = united('ilvane', ['crown']); delete st.world.plot;
  const r = S.repair(JSON.parse(JSON.stringify(st)));
  ok('a united save from before 4c gets its plot on load', !!C.plot(r.state) && C.plot(r.state).main === 'crown');
  const a = united('ilvane', ['crown']); noAttacks(() => { C.plot(a).clock = a.world.day - P.rise; days(a, 1); });
  ok('risen in one save: the rebel name is up', F.crown.name === P.by.crown.rebel);
  const b = fresh(); ok('a plain save puts the old name back', F.crown.name !== P.by.crown.rebel && !C.NODES.oath_vault.capital);
  S.repair(JSON.parse(JSON.stringify(a))); ok('loading the risen save brings it back', F.crown.name === P.by.crown.rebel && C.NODES.oath_vault.capital === 'crown');
  const cellAt = C.plot(a).cells[0].at, m = C.MOVES.find(x => x.id === 'plot_cell_crown_0');
  ok('cell scenes follow the save in play', m.at === cellAt);
  fresh();
}

// ---- the beats ----
{ const st = united('ilvane', []); st.factions.standing.realm = 400; S.joinRank(st, 'realm', { force: true });
  if (st.world.moves) st.world.moves.pending = null; let b = C.checkMoves(st, 'crown_keep');
  for (let i = 0; i < 6 && b && b.id !== 'realm_core_1'; i++) { C.chooseMove(st, b.options[0].id); b = C.checkMoves(st, 'crown_keep'); }   // older realm scenes may come first
  ok('rank 1: the shared core scene, with the flavour\'s line', b && b.id === 'realm_core_1' && b.lines.some(l => /Ascendancy wants every spell/.test(l)) && b.who === 'Warden Vell', b && b.id + ' ' + b.who);
  C.chooseMove(st, 'ask'); S.promote(st, 'realm', { force: true }); st.world.moves.pending = null;
  const seen = []; for (let i = 0; i < 4; i++) { const x = C.checkMoves(st, 'crown_keep'); if (!x) break; seen.push(x.id); C.chooseMove(st, x.options[0].id); }
  ok('rank 2: the core scene and the flavour\'s own', seen.includes('realm_core_2') && seen.includes('realm_synod_r2'), seen.join());
  S.promote(st, 'realm', { force: true }); S.promote(st, 'realm', { force: true }); const s2 = []; for (let i = 0; i < 4; i++) { const x = C.checkMoves(st, 'crown_keep'); if (!x) break; s2.push(x.id); C.chooseMove(st, x.options[0].id); }
  ok('ranks 3 and 4: the core scenes and the flavour\'s rank 4', ['realm_core_3', 'realm_core_4', 'realm_synod_r4'].every(id => s2.includes(id)) && !s2.some(id => /realm_(crown|syndicate|broken_banner|hearthwatch)_r/.test(id)), s2.join());
  const all = C.MOVES.filter(m => /^(realm_core_|realm_(crown|syndicate|synod|broken_banner|hearthwatch)_r|plot_)/.test(m.id));
  const text = m => [m.setup].concat(m.lines || []).concat(m.options.map(o => o.label + ' ' + (o.hint || ''))).join(' ');
  ok('no Moot named, no light, gray or dark labels', !all.some(m => /\bMoot\b|\b(light|gray|dark)\b/i.test(text(m))));
  ok('stakes in words: no numbers but gold prices', !all.some(m => words(text(m))), all.filter(m => words(text(m))).map(m => m.id).join());
  ok('every flavour has its rank 2 and rank 4 scenes', Object.keys(C.UNION.flavours).every(f => C.MOVES.some(m => m.id === 'realm_' + f + '_r2') && C.MOVES.some(m => m.id === 'realm_' + f + '_r4')));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
