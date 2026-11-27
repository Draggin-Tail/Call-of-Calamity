// Node ownership, phase 4a (design/node_ownership_and_land.md, section 18): human unification. The Moot's coronation, a war victory
// (alone, with an ally, with the Hearthwatch as ally), the flavours, places flipping, Crown Keep as the only capital, standing carried
// over, ranks ending, the hand-over of boards, contracts, jobs and standing, closed quest chains, old saves, and sync between saves.
// Run: cd tests && node t92.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, U = C.UNION, F = w.GAME_DATA.factions;
const HW = ['crown', 'syndicate', 'synod', 'broken_banner'];
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const days = (st, n) => { for (let i = 0; i < n; i++) S.advanceDay(st); };
const capOf = f => Object.keys(C.NODES).find(id => C.NODES[id].type === 'capital' && C.NODES[id].capital === f);
const CAPS = {}; HW.forEach(f => { CAPS[f] = capOf(f); });
const held = (st, f) => Object.keys(C.NODES).filter(id => C.ownerOf(st, id) === f);
const pk = (a, b) => [a, b].sort().join('|');
const ally = (st, a, b) => { const rs = C.relState(st); rs.allies[a] = b; rs.allies[b] = a; S.setRelation(st, a, b, 0.7, { both: true }); return rs; };
const crown = st => { C.applyRealm(st, 'osric'); days(st, U.coronation); return st; };
// wipe f out as by (every place to by, then the capital rule's wipe-out)
const wipe = (st, f, by) => { held(st, f).forEach(id => { (st.world.nodes[id] = st.world.nodes[id] || {}).owner = by; }); return C.wipeOut(st, f, by, false, CAPS[f]); };

ok('the data checks are clean', C.validateUnion().length === 0 && C.validate().length === 0 && C.validateSupply().length === 0 && C.validateAttacks().length === 0, JSON.stringify(C.validateUnion()));
ok('five flavours, six crowning Moot outcomes', Object.keys(U.flavours).length === 5 && Object.keys(U.byOutcome).length === 6);

// ---- before any union ----
{ const st = fresh();
  ok('a new game has no realm: inactive, not in relations, not joinable', !F.realm.active && !C.REL.factions.includes('realm') && !S.canJoin(st, 'realm', { force: true }).ok && !C.union(st));
  ok('the four old capitals stand', HW.every(f => !!capOf(f)));
  ok('the heir of a faction is itself', C.heirOf(st, 'crown') === 'crown' && C.heir('crown') === 'crown');
}

// ---- the Moot: a coronation a week later ----
{ const st = fresh(); st.factions.standing.crown = 700; S.joinRank(st, 'crown', { force: true }); S.promote(st, 'crown', { force: true });
  const r = C.relState(st); r.wars[pk('crown', 'broken_banner')] = { since: 1, by: 'crown' };
  const tgt = held(st, 'broken_banner').find(id => C.NODES[id].type !== 'capital');
  C.attackState(st).list.push({ n: 990, by: 'crown', on: 'broken_banner', target: tgt, from: 'crown_keep', day: 1, lands: 2, stage: 0, stages: 1 });
  C.applyRealm(st, 'osric');
  ok('a crowning Moot sets the coronation a week later', st.world.unionPending && st.world.unionPending.flavour === 'crown' && st.world.unionPending.day === st.world.day + U.coronation);
  ok('no new Moot while the crown is being set', !C.mootCall(st, 'writ').ok);
  days(st, U.coronation - 1);
  ok('wars pause before the coronation: the attack due has not landed', !C.union(st) && C.ownerOf(st, tgt) === 'broken_banner' && C.attackState(st).list.some(a => a.n === 990));
  days(st, 1);
  const u = C.union(st);
  ok('on the day the realm is one, in the Crown flavour', !!u && u.how === 'moot' && u.flavour === 'crown' && u.outcome === 'osric' && F.realm.name === 'Restored Throne');
  ok('all four war factions are absorbed and marked fallen', u.absorbed.length === 4 && HW.every(f => C.fallen(st, f) && st.world.fallen[f].absorbed));
  ok('no place is held by an absorbed faction any more', HW.every(f => held(st, f).length === 0), HW.map(f => f + held(st, f).length).join());
  ok('every place they held is the realm\'s, the enclaves abroad too', C.ownerOf(st, 'crown_keep') === 'realm' && C.ownerOf(st, 'outlaws_rest') === 'realm' && C.ownerOf(st, 'greywater_landing') === 'realm');
  ok('Crown Keep is the realm\'s capital and the only human capital', capOf('realm') === 'crown_keep' && HW.every(f => !capOf(f)));
  ok('the old capitals are ordinary places: no capital rule, castle-deep sieges', ['river_cities', 'voldun', 'outlaws_rest'].every(id => C.NODES[id].formerCapital && C.siegeStages(id) === 3) && C.siegeStages('crown_keep') === 4);
  ok('the attack under way and the war are gone', C.attackState(st).list.length === 0 && !Object.keys(r.wars).length);
  ok('the Moot cannot be called again', !C.mootCall(st, 'writ').ok && C.mootCheck(st) === null);
  ok('the rank ended, and its title stays in the history', !S.sworn(st) && st.factions.history.some(x => x.faction === 'crown' && /King's Knight/.test(x.reason)) && u.former.title === "King's Knight");
  ok('standing carries over, capped just below rank 2', S.getStanding(st, 'realm') === S.RANK.standingNeeded[1] - 1);
  ok('the crowned King\'s titles name the ladder', S.RANK.ladders.realm[0] === "King's Sword" && S.RANK.ladders.realm[3] === "King's Hand");
  ok('relations: only the realm and the Hearthwatch are left', C.REL.factions.includes('realm') && C.relReport(st).pairs.length === 1);
  ok('the realm has no capital cut off and its supply is whole', C.supplyCut(st).length === 0);
  // the opening scene and the oath
  st.world.location = 'crown_keep';
  let b = C.checkMoves(st, 'crown_keep'), guard = 0; while (b && b.id !== 'union_opening' && guard++ < 6) { C.chooseMove(st, b.options[0].id); b = C.checkMoves(st, 'crown_keep'); }
  ok('the opening scene comes, names the realm and its motto, and offers the oath', !!b && b.id === 'union_opening' && b.lines.join(' ').includes('Restored Throne') && b.lines.join(' ').includes('One road, one law') && b.options.some(o => o.id === 'swear'));
  ok('the scene tells the player their old title went with their faction', b.lines.some(l => /old title went with the Royalist Crown/.test(l)));
  ok('the oath is also offered in person at Crown Keep', C.offers(st).some(o => o.faction === 'realm' && o.at === 'crown_keep' && o.kind === 'join'));
  C.chooseMove(st, 'swear');
  ok('swearing makes you rank 1 of the realm', S.sworn(st) === 'realm' && S.getRank(st, 'realm').rank === 1 && C.union(st).seen);
  ok('the scene does not come back', C.checkMoves(st, 'crown_keep') === null || C.checkMoves(st, 'crown_keep').id !== 'union_opening');
  ok('the realm wears the flavour\'s colour on the map', F.realm.color === U.flavours.crown.color);

  // ---- hand-over ----
  const c0 = st.factions.standing.crown, r0 = S.getStanding(st, 'realm');
  const ch = S.changeStanding(st, 'crown', 20, { reason: 'test' });
  ok('standing given to an absorbed faction goes to the realm', S.getStanding(st, 'realm') === r0 + 20 && st.factions.standing.crown === c0 && ch.every(x => !HW.includes(x.faction)));
  const r1 = S.getStanding(st, 'realm'); S.serve(st, 'synod', 10, { reason: 'test' });
  ok('serving an absorbed faction serves the realm, with no rival drain on the old factions', S.getStanding(st, 'realm') === r1 + 10 && HW.every(f => !st.factions.history.slice(-3).some(x => x.faction === f)));
  const h0 = st.factions.history.length, rp = S.changeStanding(st, 'ironbound', 100, { reason: 'test' });   // ironbound's relations reach the Crown and the Synod
  ok('ripples never touch an absorbed faction', st.factions.standing.crown === c0 && rp.some(x => x.faction === 'realm') && !rp.some(x => HW.includes(x.faction)) && !st.factions.history.slice(h0).some(x => HW.includes(x.faction)));
  const bd = C.contractBoard(st, 'crown_keep');
  ok('the board at Crown Keep runs under the realm\'s name', bd.length > 0 && bd.every(o => o.faction === 'realm'));
  ok('the old factions\' contract kinds are on the realm\'s boards', bd.every(o => HW.includes(C.CONTRACT_KINDS[o.kind].faction)));
  ok('the realm\'s recruit lean is its flavour\'s', C.recruitMult(st, 'crown_keep', 'squire') === 0.75 && C.recruitMult(st, 'crown_keep', 'scout') === 1);
  ok('patrols on the realm\'s roads are the realm\'s', !!C.PATROLS.realm && C.PATROLS.realm.name === 'Throne patrol');
  ok('rumours name the realm, not the old faction', /Restored Throne/.test(C.tvName('crown')));
}

// ---- contracts and jobs taken before the union ----
{ const st = fresh(); st.factions.standing.crown = 300; S.joinRank(st, 'crown', { force: true }); st.world.location = 'crown_keep';
  const o = C.contractBoard(st, 'crown_keep')[0], t = C.takeContract(st, 'crown_keep', o.slot);
  C.jobsOf(st).toll_road = { state: 'active', day: 1, seen: {} };
  C.jobsOf(st)[C.FQ.synod.tryout] = { state: 'active', day: 1, seen: {} };
  crown(st);
  const k = C.contracts(st).find(x => x.id === t.contract.id);
  ok('a contract taken from an old faction is now the realm\'s', !!k && k.faction === 'realm');
  k && C.contracts(st); t.contract.steps.forEach(s => { s.done = true; });
  const r0 = S.getStanding(st, 'realm'), rep = C.reportContract(st, t.contract.id);
  ok('it is reported at the realm\'s castles and pays the realm', rep.ok && S.getStanding(st, 'realm') > r0, JSON.stringify(rep));
  const jl = C.jobList(st);
  ok('an old faction\'s job keeps running, given by the realm', jl.some(j => j.id === 'toll_road' && j.state === 'active' && j.giver === 'realm'));
  ok('a try-out in progress closes, and the Journal says so', C.jobsOf(st)[C.FQ.synod.tryout].state === 'closed' && jl.some(j => j.id === C.FQ.synod.tryout && j.closed && /ended with the union/.test(j.name)) && !C.jobDone(st, C.FQ.synod.tryout));
  ok('the old factions\' try-outs are no longer offered', HW.every(f => !C.jobOffers(st, C.JOBS[C.FQ[f].tryout].at).some(j => j.id === C.FQ[f].tryout)));
  ok('the closed chain is listed in the union record', C.union(st).closed.includes(C.FQ.synod.tryout));
}

// ---- standing carried over ----
{ const st = fresh(); Object.assign(st.factions.standing, { crown: 300, syndicate: 100, synod: 0, broken_banner: -200 }); crown(st);
  ok('0.6 of the winner\'s standing and 0.4 of the others\' average', S.getStanding(st, 'realm') === Math.round(0.6 * 300 + 0.4 * (100 + 0 - 200) / 3), S.getStanding(st, 'realm'));
}
{ const st = fresh(); Object.assign(st.factions.standing, { crown: -900, syndicate: -900, synod: -900, broken_banner: -900 }); crown(st);
  ok('a hated name carries over too', S.getStanding(st, 'realm') === -900 && !S.canJoin(st, 'realm').ok);
}

// ---- every Moot outcome picks its flavour ----
[['regency', 'crown', 'Restored Throne', 'Sworn Sword'], ['ledger', 'syndicate', 'Ledger Concord', 'Runner'], ['ilvane', 'synod', 'Ascendancy', 'Novice'],
 ['wil', 'broken_banner', 'Free Banner Realm', 'Cutpurse'], ['corisande', 'hearthwatch', 'Hearth Commonwealth', 'Lampbearer']].forEach(([oc, fv, name, t1]) => {
  const st = fresh(); C.applyRealm(st, oc); days(st, U.coronation); const u = C.union(st);
  ok('Moot ' + oc + ': the ' + name + ', ladder from ' + t1, !!u && u.flavour === fv && F.realm.name === name && S.RANK.ladders.realm[0] === t1 && C.IDEALS.realm.mercy === C.IDEALS[fv].mercy && C.IDEALS.realm.order === C.IDEALS[fv].order);
});
{ const st = fresh(); Object.assign(st.factions.standing, { crown: 100, syndicate: 200, synod: 300, broken_banner: 0 }); C.applyRealm(st, 'corisande'); days(st, U.coronation);
  ok('the Hearthwatch flavour: no winner, standing is the plain average, the Hearthwatch not absorbed', C.union(st).winner === null && S.getStanding(st, 'realm') === 150 && !C.union(st).absorbed.includes('hearthwatch') && !C.fallen(st, 'hearthwatch'));
  ok('the Hearthwatch flavour\'s patrols are Hearth wardens and its lean is acolytes', C.PATROLS.realm.name === 'Hearth wardens' && C.LEAN.realm.classes[0] === 'acolyte');
}
{ const st = fresh(); C.applyRealm(st, 'wil'); days(st, U.coronation);
  ok('the Banner flavour borrows its riders for patrols (it has no road patrol)', C.PATROLS.realm.enemies[0].name === 'Banner Rider' && C.ownerOf(st, 'outlaws_rest') === 'realm');
}

// ---- posts and plotters from the count ----
{ const st = fresh(); const m = C.moot(st);
  m.tally = { seats: [{ seat: 'lords', faction: 'crown', vote: 'ledger' }, { seat: 'syndicate', faction: 'syndicate', vote: 'ledger' }, { seat: 'synod', faction: 'synod', vote: 'osric' },
    { seat: 'hearthwatch', faction: 'hearthwatch', vote: 'ledger' }, { seat: 'banner', faction: 'broken_banner', vote: 'corisande', final: 'osric' }] };
  C.applyRealm(st, 'ledger'); days(st, U.coronation); const u = C.union(st);
  ok('the leaders who backed the winner take posts', u.posts.some(p => /Voss/.test(p)) && u.posts.some(p => /Crane/.test(p)) && u.posts.some(p => /Agathe/.test(p)) && !u.posts.some(p => /Ilvane/.test(p)));
  ok('the factions that voted against the winner are the plotters (for the hidden cells)', u.plotters.length === 2 && u.plotters.includes('synod') && u.plotters.includes('broken_banner'));
  st.world.location = 'crown_keep'; let b = C.checkMoves(st, 'crown_keep'), g = 0; while (b && b.id !== 'union_opening' && g++ < 6) { C.chooseMove(st, b.options[0].id); b = C.checkMoves(st, 'crown_keep'); }
  ok('the posts are told in the opening scene', !!b && b.lines.some(l => /Voss/.test(l) && /Crane/.test(l)));
}
{ const st = fresh(); const m = C.moot(st); m.tally = { seats: [{ seat: 'synod', faction: 'synod', vote: 'ilvane' }] }; C.applyRealm(st, 'ilvane'); days(st, U.coronation);
  ok('Archon Ilvane, crowned Regent, takes no post under herself', !C.union(st).posts.length);
}

// ---- a war victory ----
{ const st = fresh(); wipe(st, 'syndicate', 'crown'); wipe(st, 'synod', 'crown');
  days(st, 1); ok('no union while two enemies are left standing', !C.union(st));
  wipe(st, 'broken_banner', 'crown'); days(st, 1); const u = C.union(st);
  ok('the last enemy gone: the realm is one, in the winner\'s flavour, at once', !!u && u.how === 'war' && u.flavour === 'crown' && u.winner === 'crown' && u.absorbed.join() === 'crown');
  ok('the beaten factions are the plotters', u.plotters.length === 3);
  ok('a war ruler, no Moot titles', u.ruler === U.flavours.crown.ruler && S.RANK.ladders.realm[0] === 'Sworn Sword');
  ok('no Moot after a war victory', !C.mootCall(st, 'writ').ok);
  const b = (() => { st.world.location = 'crown_keep'; let x = C.checkMoves(st, 'crown_keep'), g = 0; while (x && x.id !== 'union_opening' && g++ < 6) { C.chooseMove(st, x.options[0].id); x = C.checkMoves(st, 'crown_keep'); } return x; })();
  ok('the opening scene tells of the war, not a Moot', !!b && b.id === 'union_opening' && !/Moot|crown goes on/i.test(b.lines.join(' ')) && /banner/i.test(b.lines[0]));
}
{ const st = fresh(); ally(st, 'crown', 'synod');
  wipe(st, 'broken_banner', 'synod'); days(st, 1); ok('the winner and its ally with an enemy left: no union yet', !C.union(st));
  wipe(st, 'syndicate', 'crown'); days(st, 1); const u = C.union(st);
  ok('only the victor and its ally left: both are absorbed, the one that took the last capital leads', !!u && u.absorbed.length === 2 && u.absorbed.includes('synod') && u.flavour === 'crown');
  ok('the ally\'s places are the realm\'s too', held(st, 'synod').length === 0 && C.ownerOf(st, 'voldun') === 'realm');
}
{ const st = fresh(); ally(st, 'crown', 'synod'); wipe(st, 'broken_banner', 'crown'); wipe(st, 'syndicate', 'synod'); days(st, 1);
  ok('the ally took the last capital: the ally\'s flavour', C.union(st) && C.union(st).flavour === 'synod' && F.realm.name === 'Ascendancy');
}
{ const st = fresh(); st.factions.standing.crown = 300; S.joinRank(st, 'crown', { force: true }); const rs = ally(st, 'crown', 'hearthwatch');
  ['syndicate', 'synod', 'broken_banner'].forEach(f => wipe(st, f, 'crown')); days(st, 1); const u = C.union(st);
  ok('the Hearthwatch as the winner\'s ally stays neutral, keeps the alliance and gets a seat', !!u && !u.absorbed.includes('hearthwatch') && u.hearthSeat && rs.allies.realm === 'hearthwatch' && rs.allies.hearthwatch === 'realm');
}

// ---- a long peace afterwards ----
{ const st = crown(fresh()); const n0 = held(st, 'realm').length; days(st, 200);
  ok('200 days on: no wars, no attacks, no place lost', !Object.keys(C.relState(st).wars).length && C.attackState(st).list.length === 0 && held(st, 'realm').length === n0);
}

// ---- old saves, and switching between saves ----
{ const st = fresh(); st.factions.standing.broken_banner = 400; S.joinRank(st, 'broken_banner', { force: true }); st.world.realm = { outcome: 'wil', ruler: 'King Wil', day: 1 };
  const r = S.repair(JSON.parse(JSON.stringify(st))), u = C.union(r.state);
  ok('an old save whose Moot crowned someone unites when it loads', !!u && u.flavour === 'broken_banner' && r.fixes.some(x => /united/.test(x)));
  ok('its rank in the Banner ended, and the realm is the Free Banner Realm', !S.sworn(r.state) && F.realm.name === 'Free Banner Realm');
  const r2 = S.repair(JSON.parse(JSON.stringify(r.state)));
  ok('loading it again changes nothing', C.union(r2.state).day === u.day && !r2.fixes.some(x => /united/.test(x)));
  const st2 = C.newGame({ race: 'human', name: 'T2' });
  ok('a new game after it puts the old capitals back and hides the realm', !C.union(st2) && !F.realm.active && HW.every(f => !!capOf(f)) && !C.REL.factions.includes('realm') && C.heir('crown') === 'crown');
  const r3 = S.repair(JSON.parse(JSON.stringify(r.state)));
  ok('loading the united save again brings the realm back', F.realm.active && capOf('realm') === 'crown_keep' && C.heir('crown') === 'realm' && !!C.union(r3.state));
  ok('the save still passes validation', S.validate(r3.state).length === 0, JSON.stringify(S.validate(r3.state)));
}
{ const st = fresh(); C.applyRealm(st, 'regency'); const r = S.repair(JSON.parse(JSON.stringify(st)));
  ok('a save in the week before the coronation keeps waiting for it', !C.union(r.state) && !!r.state.world.unionPending);
}

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
