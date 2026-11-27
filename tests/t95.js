// Node ownership, phase 4d (design/node_ownership_and_land.md, section 18): the player's wars. Ordering an attack (rank 3, at a hall),
// moving against the Hearthwatch (rank 4), the Hearthwatch never a target for the AI, the Priory as its capital, its fall and the refuges,
// capital gear (fought at the last stand, or ordered), the plotters' leaders' pieces, sync between saves, and the united realm.
// Run: cd tests && node t95.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, K = C.CONQUEST, G = w.GAME_DATA.gear;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; st.world.flags.guide_off = 1; return st; };
const rank = (st, f, n) => { S.joinRank(st, f, { force: true, leave: true }); while (S.getRank(st, f).rank < n) S.promote(st, f, { force: true }); };
const war = (st, a, b) => { C.relState(st).wars[[a, b].sort().join('|')] = { since: 1, by: a }; S.setRelation(st, a, b, -0.9, { both: true }); };
const own = (st, id, f) => { (st.world.nodes[id] = st.world.nodes[id] || {}).owner = f; };
const PR = 'hearthstone_priory', HWP = ['millstream', 'drowned_chapel'];
const won = { won: true, kills: [], survivors: [] }, lost = { won: false, kills: [], survivors: [] };
const news = st => C.relReport(st).news.map(n => n.text).join(' | ');

ok('the data checks are clean', C.validateConquest().length === 0 && C.validate().length === 0 && C.validateAttacks().length === 0 && C.validateUnion().length === 0 && C.validatePlot().length === 0, JSON.stringify(C.validateConquest()));
ok('forty uniques, and every new one has an award', Object.keys(w.GAME_DATA.uniques).length === 40 && Object.values(K.gear).every(id => G[id] && G[id].unique && C.UNIQUE_AWARDS[id]));
ok('four refuges, hidden, one per old human area, a day from their place', K.refuges.length === 4 && new Set(K.refuges.map(r => r.area)).size === 4 &&
  K.refuges.every(r => { const n = C.NODES[r.id]; return n.hidden && n.refuge && n.area === r.area && n.links[r.parent] === 1 && C.NODES[r.parent].links[r.id] === 1; }));
ok('the Priory is the Hearthwatch\'s capital: four stages', C.NODES[PR].capital === 'hearthwatch' && C.siegeStages(PR) === 4);
ok('Mother Agathe holds the last stand, with the Hearthwatch\'s own people', C.ATTACK.leaders.hearthwatch === 'Mother Agathe' && C.ATTACK.squads.hearthwatch.enemies.length === 3);

// ---- ordering an attack ----
{ const st = fresh();
  ok('unsworn: no orders', !C.leadOk(st).ok && C.leadOptions(st).length === 0);
  rank(st, 'crown', 2); st.world.location = 'crown_keep';
  ok('rank 2: no orders', !C.leadOk(st).ok && /rank 3/.test(C.leadOk(st).reason));
  rank(st, 'crown', 3); st.world.location = 'millstream';
  ok('rank 3 away from a hall: no orders', !C.leadOk(st).ok && /hall or the capital/.test(C.leadOk(st).reason));
  st.world.location = 'crown_keep';
  ok('rank 3 at the capital: orders, but nothing to attack in peace', C.leadOk(st).ok && C.leadOptions(st).length === 0);
  war(st, 'crown', 'broken_banner');
  const o = C.leadOptions(st);
  ok('at war: the Banner\'s places within reach, each with its odds and stages in words', o.length > 0 && o.every(x => C.ownerOf(st, x.target) === 'broken_banner' && ['good', 'even', 'poor'].includes(x.chance) && x.stages >= 1));
  ok('a capital is never offered while its faction holds other places', !o.some(x => x.target === 'outlaws_rest'));
  const before = JSON.stringify(C.attackState(st).last), t = o[o.length - 1].target, r = C.leadAttack(st, t), a = r.attack;
  ok('ordering launches an attack, marked as yours, a week out', r.ok && a && a.led && a.by === 'crown' && a.target === t && a.lands === st.world.day + 7 && C.attacks(st).includes(a));
  ok('the order costs the faction neither its wait nor its own attacks', JSON.stringify(C.attackState(st).last) === before);
  ok('word on the roads says it was your order', /On your order, the /.test(news(st)), news(st));
  ok('one order at a time', !C.leadOk(st).ok && C.leadOk(st).busy && !C.leadAttack(st, o[0].target).ok);
  ok('the sworn player can only fight for the side that attacks', C.attackSides(st, t).join() === 'attack');
  const stg = a.stages; a.lands = st.world.day; C.attackTick(st);
  ok('away from the fight, an ordered attack is rolled like any other', !C.attacks(st).includes(a) || a.stage === 1 && stg > 1);
}

// ---- the Hearthwatch: no AI target, the motion ----
{ const st = fresh(); rank(st, 'crown', 4); st.world.location = 'crown_keep'; war(st, 'crown', 'hearthwatch');
  ok('at war, the AI still never targets the Hearthwatch', !C.attackOptions(st, 'crown').some(o => o.on === 'hearthwatch') && !C.attackTargetable(st, 'millstream'));
  ok('your orders can', C.leadOptions(st).some(o => o.on === 'hearthwatch') && C.attackTargetable(st, 'millstream', true));
  ok('the Priory only once the Hearthwatch holds nothing else in its land', !C.leadOptions(st).some(o => o.target === PR));
  HWP.forEach(id => own(st, id, 'crown')); own(st, 'stonebridge', 'crown');
  ok('Brimstone Chapel, in orc land, does not keep it safe', C.ownerOf(st, 'brimstone_chapel') === 'hearthwatch' && C.attackTargetable(st, PR, true));
}
{ const st = fresh(); rank(st, 'crown', 3); st.world.location = 'crown_keep';
  ok('rank 3 cannot move against the Hearthwatch', !C.hearthMotionOk(st).ok && /rank 4/.test(C.hearthMotionOk(st).reason));
  rank(st, 'crown', 4); st.world.location = 'millstream';
  ok('only at a hall or the capital', !C.hearthMotionOk(st).ok);
  st.world.location = 'crown_keep'; S.changeGoodwill(st, 40, 'test'); const bb = S.getStanding(st, 'broken_banner'), cr = S.getStanding(st, 'crown'), syn = S.getStanding(st, 'synod');
  ok('rank 4 at the capital can', C.hearthMotionOk(st).ok && C.hearthMotionCost(st).join() === 'broken_banner');
  const r = C.hearthMotion(st);
  ok('the motion means war at once', r.ok && C.relAtWar(st, 'crown', 'hearthwatch') && /declared war on the Hearthwatch/.test(news(st)), news(st));
  ok('all Hearthwatch goodwill is lost', S.getGoodwill(st) === S.GOODWILL.min);
  ok('the Banner, which values mercy most, thinks much less of you; the Crown and Synod do not mind', S.getStanding(st, 'broken_banner') === bb - 20 && S.getStanding(st, 'crown') === cr && S.getStanding(st, 'synod') === syn,
    [bb, S.getStanding(st, 'broken_banner')].join());
  ok('not twice', !C.hearthMotionOk(st).ok && /already at war/.test(C.hearthMotionOk(st).reason));
  ok('the Hearthwatch never answers by mustering or striking back', (() => { const o = C.leadOptions(st).find(x => x.on === 'hearthwatch'); const g = C.garrison(st, o.target); const a = C.leadAttack(st, o.target).attack; return a && !a.answer && C.garrison(st, o.target) === g; })());
}
{ const st = fresh(); rank(st, 'crown', 4); st.world.location = 'crown_keep'; const rs = C.relState(st); rs.allies.crown = 'hearthwatch'; rs.allies.hearthwatch = 'crown';
  const r = C.hearthMotion(st);
  ok('an alliance with the Hearthwatch breaks', r.ok && r.broke && !rs.allies.crown && !rs.allies.hearthwatch && C.relAtWar(st, 'crown', 'hearthwatch'));
}
{ const st = fresh(); rank(st, 'crown', 4); st.world.location = 'crown_keep'; C.relState(st).truce['crown|hearthwatch'] = st.world.day + 10;
  ok('not during a truce', !C.hearthMotionOk(st).ok && /truce/.test(C.hearthMotionOk(st).reason));
}

// ---- the Priory falls ----
const priory = () => { const st = fresh(); rank(st, 'crown', 4); st.world.location = 'crown_keep'; C.hearthMotion(st); HWP.forEach(id => own(st, id, 'crown')); own(st, 'stonebridge', 'crown'); C.setGarrison(st, 'stonebridge', 12);   // a way in: the Priory sits among Syndicate places
  const o = C.leadOptions(st).find(x => x.target === PR); const a = C.leadAttack(st, PR).attack; a.stage = 3; return { st, a, o }; };
{ const { st, a, o } = priory();
  ok('ordered at the Priory: a siege in four stages', !!o && a.stages === 4);
  st.world.location = PR; const k = C.attackEncounter(st, PR), E = C.ENCOUNTERS[k];
  ok('the last stand is against Mother Agathe', E && E.options.length === 1 && E.options[0].enemies[0].name === 'Mother Agathe' && E.options[0].objective.leader === 0);
  ok('no refuge is on the map, or turns up in rumours, before the fall', C.refuges(st).length === 0 && K.refuges.every(r => C.rumourSkip(st, r.id)));
  const out = C.applyEncounterResult(st, k, 'attack', won), f = out.attack && out.attack.fell;
  ok('winning it ends the Hearthwatch', f && f.faction === 'hearthwatch' && C.fallen(st, 'hearthwatch') && C.ownerOf(st, PR) === 'crown');
  ok('its places go to the taker, the chapel abroad too', C.ownerOf(st, 'brimstone_chapel') === 'crown');
  ok('four refuges come to light, held by the Hearthwatch', f.refuges.length === 4 && C.refuges(st).length === 4 && K.refuges.every(r => C.ownerOf(st, r.id) === 'hearthwatch' && st.world.flags['reveal_' + r.id]));
  ok('word on the roads names them', /refuges still open: The Mill Loft/.test(news(st)), news(st));
  ok('they shelter you; the taken chapels do not', K.refuges.every(r => C.sanctuaryAt(st, r.id)) && !C.sanctuaryAt(st, PR) && !C.sanctuaryAt(st, 'millstream'));
  ok('the Priory is an ordinary place again', !C.NODES[PR].capital && C.siegeStages(PR) === 3);
  ok('its piece is yours: the Priory Hearthstone', st.inventory.items.priory_hearthstone === 1 && (out.uniques || []).includes('priory_hearthstone'));
  ok('the motion and the fall are recorded', st.world.conquest.hearth.faction === 'crown' && st.world.conquest.fell.by === 'crown');
  const st2 = fresh(); C.unionSync(st2);
  ok('another save still has the Hearthwatch\'s capital (global data synced per save)', C.NODES[PR].capital === 'hearthwatch' && C.siegeStages(PR) === 4);
  const st3 = S.repair(JSON.parse(JSON.stringify(st))) || st;
  ok('loading the fallen save clears it again', !C.NODES[PR].capital);
}
{ const { st, a } = priory(); st.world.location = PR; const k = C.attackEncounter(st, PR);
  C.applyEncounterResult(st, k, 'attack', lost);
  ok('losing at the last stand still counts as fighting there', a.lastFought === true && !C.fallen(st, 'hearthwatch'));
  const r = C.attackSettle(st, a, 'attack');
  ok('so when it falls, the piece is yours', r.fell && st.inventory.items.priory_hearthstone === 1);
}
{ let st, r; for (let i = 0; i < 30; i++) { const p = priory(); st = p.st; st.world.location = 'crown_keep'; C.setGarrison(st, p.a.from, 40); C.setGarrison(st, PR, 1); C.attackState(st).seed = 7 + i; r = C.attackSettle(st, p.a, null); if (r.fell) break; }
  ok('an ordered attack gives the piece even when it is rolled off-screen', r.fell && !r.side && st.inventory.items.priory_hearthstone === 1);
}

// ---- capital gear for the war factions ----
{ const st = fresh();
  ok('an AI capture with you nowhere near gives nothing', C.capitalGear(st, 'broken_banner', 'crown', false, { led: false }) === null && !st.inventory.items.outlaws_bell);
  ok('fighting at the last stand (on either side) gives it', C.capitalGear(st, 'synod', 'crown', false, { lastFought: true }) === 'voldun_canon' && st.inventory.items.voldun_canon === 1);
  ok('ordering the attack gives it', C.capitalGear(st, 'syndicate', 'crown', false, { led: true }) === 'gildhaven_key' && st.inventory.items.gildhaven_key === 1);
  ok('helping take it gives it', C.capitalGear(st, 'crown', 'synod', true, null) === 'keep_wardens_plate' && st.inventory.items.keep_wardens_plate === 1);
  C.capitalGear(st, 'synod', 'crown', false, { lastFought: true });
  ok('once per save', st.inventory.items.voldun_canon === 1);
}
{ const st = fresh(); rank(st, 'crown', 3); st.world.location = 'crown_keep'; war(st, 'crown', 'broken_banner');
  Object.keys(C.NODES).forEach(id => { if (id !== 'outlaws_rest' && C.ownerOf(st, id) === 'broken_banner') own(st, id, 'crown'); });
  const o = C.leadOptions(st).find(x => x.target === 'outlaws_rest');
  ok('the Banner down to its capital: you can order the siege of Outlaw\'s Rest', !!o);
  const a = C.leadAttack(st, 'outlaws_rest').attack; a.stage = 3; const r = C.attackSettle(st, a, 'attack');
  ok('it falls, the Banner is gone, and the Outlaw\'s Rest Bell is yours', r.fell && r.fell.faction === 'broken_banner' && st.inventory.items.outlaws_bell === 1);
  ok('its old capital is an ordinary place now: three stages, open to attack while the Crown holds others', !C.NODES.outlaws_rest.capital && C.siegeStages('outlaws_rest') === 3 && C.attackTargetable(st, 'outlaws_rest'));
  const st2 = fresh();
  ok('another save still has the Banner\'s capital', C.NODES.outlaws_rest.capital === 'broken_banner' && C.siegeStages('outlaws_rest') === 4);
  S.repair(st);
  ok('loading the save where it fell clears it again', !C.NODES.outlaws_rest.capital);
}

// ---- the plotters' leaders ----
{ const pieces = { oath_vault: 'marshals_edge', second_counting_house: 'cranes_tally', sealed_scriptorium: 'ilvanes_circlet', last_camp: 'old_standards_horn' };
  ok('each stronghold\'s first clear gives its leader\'s piece', Object.entries(pieces).every(([d, id]) => { const st = fresh(); st.world.dungeons = { [d]: { stage: 3, cleared: true, clearedDay: 1, clears: 1 } }; const g = C.checkUniques(st); return g.length === 1 && g[0] === id; }));
}

// ---- after the union ----
{ const st = fresh(); C.applyRealm(st, 'regency'); for (let i = 0; i < C.UNION.coronation; i++) S.advanceDay(st); C.union(st).seen = 1; C.relState(st).next = 1e9;
  rank(st, 'realm', 4); st.world.location = 'crown_keep';
  ok('the realm\'s officers can order attacks and move against the Hearthwatch', C.leadOk(st).ok && C.hearthMotionOk(st).ok);
  const r = C.hearthMotion(st);
  ok('the realm goes to war with it', r.ok && C.relAtWar(st, 'realm', 'hearthwatch') && C.leadOptions(st).some(o => o.on === 'hearthwatch'));
}

// ---- words ----
{ const st = fresh(); rank(st, 'crown', 4); st.world.location = 'crown_keep'; war(st, 'crown', 'broken_banner');
  ok('no numbers in the orders or the motion', !C.leadOptions(st).some(o => /\d/.test(o.chance)) && !/\d/.test(C.hearthMotion(st).text) && !/\d/.test(news(st)));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
