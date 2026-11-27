// Node ownership, phase 4b (design/node_ownership_and_land.md, section 18): the united realm's policy dials. Taxes (shop prices), patrols
// (road fight chance, the Concord's toll posts), magic law (apprentice price, hedge-mages on the roads, hedge-mage work on the boards) and
// war posture (the realm's own relation lines). Also the hand-over fix: the realm's boards find targets on the absorbed factions' old land.
// Run: cd tests && node t93.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, P = C.POLICY;
const FLAV = { osric: 'crown', ledger: 'syndicate', ilvane: 'synod', wil: 'broken_banner', corisande: 'hearthwatch' };
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const days = (st, n) => { for (let i = 0; i < n; i++) S.advanceDay(st); };
const united = outcome => { const st = fresh(); C.applyRealm(st, outcome); days(st, C.UNION.coronation); st.world.rbNext = 1e9; C.relState(st).next = 1e9; return st; };
const as = (st, f) => { st.world.union.flavour = f; C.unionSync(st); return st; };
const ranked = st => { st.factions.standing.realm = 2000; S.joinRank(st, 'realm', { force: true }); S.promote(st, 'realm', { force: true }); S.promote(st, 'realm', { force: true }); return st; };
const pk = (a, b) => [a, b].sort().join('|');
const near = (a, b) => Math.abs(a - b) < 0.011;

ok('the data checks are clean', C.validatePolicy().length === 0 && C.validateUnion().length === 0 && C.validate().length === 0, JSON.stringify(C.validatePolicy()));
ok('every flavour has four dials', Object.keys(C.UNION.flavours).every(f => ['taxes', 'patrols', 'magic', 'posture'].every(k => P.byFlavour[f] && P.byFlavour[f][k])));
ok('the dials as agreed', JSON.stringify(Object.keys(P.byFlavour).map(f => Object.values(P.byFlavour[f]).join('/'))) === JSON.stringify(['medium/heavy/licensed/defensive', 'low/tolled/for_sale/opportunistic', 'medium/medium/hunted/cautious', 'low/loose/sheltered/provoked', 'low/light/free/peaceful']));

// ---- before a union: nothing changes ----
{ const st = fresh();
  ok('no union: no dials, no words', C.policy(st) === null && C.policyWords(st).length === 0);
  ok('no union: road fights, foes, boards and posture as before', C.fightMult(st, 'crown_keep') === 1 && C.foeOk(st, { id: 'hedge' }, 'crown_keep') && C.kindOk(st, 'banner_hedge', 'broken_banner') && C.postureOf(st, 'crown') === null);
  ok('no union: the old relation lines', C.relLine(st, 'crown', 'war') === C.REL.war && C.relLine(st, 'crown', 'truceDays') === C.REL.truceDays);
}

// ---- taxes: shop prices only ----
{ const st = united('osric'), mid = C.nodeServices(st, 'crown_keep').shop.priceMult;
  as(st, 'syndicate'); const low = C.nodeServices(st, 'crown_keep').shop.priceMult;
  ok('low taxes: the realm\'s shops sell a tenth cheaper', near(low, Math.round(mid * 0.9 * 100) / 100), mid + ' -> ' + low);
  as(st, 'synod'); ok('medium taxes: prices as they were', C.nodeServices(st, 'crown_keep').shop.priceMult === mid);
  as(st, 'syndicate'); const out = Object.keys(C.NODES).find(id => C.NODES[id].shop && C.ownerOf(st, id) !== 'realm');
  if (out) { const a = C.nodeServices(st, out).shop.priceMult; as(st, 'crown'); ok('taxes leave shops off the realm\'s land alone', C.nodeServices(st, out).shop.priceMult === a); }
}

// ---- magic law: apprentice recruits ----
{ const st = united('osric'), at = 'crown_keep', m = f => { as(st, f); return C.recruitMult(st, at, 'apprentice'); };
  ok('licensed: apprentices at the old price', m('crown') === 1);
  ok('hunted: apprentices cost a quarter more', m('synod') === 1.25);
  ok('for sale, sheltered, free: apprentices a tenth cheaper', ['syndicate', 'broken_banner', 'hearthwatch'].every(f => m(f) === 0.9));
  as(st, 'synod'); ok('the magic law leaves other classes alone', C.recruitMult(st, at, 'scout') === 1);
  const g0 = st.inventory.gold = 1000, r = S.recruit(st, 'apprentice', { mult: C.recruitMult(st, at, 'apprentice') });
  ok('the recruit is charged the dial\'s price', r.ok && r.cost === Math.round(S.recruitCost(st) * 1.25) && st.inventory.gold === g0 - r.cost, JSON.stringify(r.cost));
}

// ---- magic law: boards; and the hand-over fix ----
{ const kinds = f => { const st = ranked(as(united('osric'), f)), seen = {}, boards = Object.keys(C.NODES).filter(i => ['castle', 'capital', 'hall'].includes(C.NODES[i].type));
    for (let d = 0; d < 400; d += 4) { st.world.day = d; boards.forEach(at => C.contractBoard(st, at).forEach(o => { seen[o.kind] = 1; })); } return seen; };
  const K = {}; Object.keys(P.byFlavour).forEach(f => { K[f] = kinds(f); });
  ok('the realm\'s boards post the old factions\' work on its own land', Object.keys(K.crown).length >= 15, Object.keys(K.crown).length);
  ok('hunted: the hedge-witch hunts, no smuggling', K.synod.synod_inquiry && K.synod.synod_heretic && !K.synod.banner_hedge);
  ok('sheltered and free: smuggling, no hunts', ['broken_banner', 'hearthwatch'].every(f => K[f].banner_hedge && !K[f].synod_inquiry && !K[f].synod_heretic));
  ok('licensed and for sale: neither', ['crown', 'syndicate'].every(f => P.hedgeKinds.every(k => !K[f][k])));
}

// ---- patrols: road fights on the realm's land ----
{ const st = united('osric'); st.roster.forEach(u => { u.level = 5; }); st.world.flags.guide_off = 1;
  const zone = Object.keys(C.NODES).find(id => C.NODES[id].type === 'zone' && C.NODES[id].danger > 0 && C.ownerOf(st, id) === 'realm');
  const from = Object.keys(C.NODES[zone].links)[0];
  const roll = (f, n) => { as(st, f); const out = { fight: 0, other: 0, hedge: 0 }; st.world.seed = 12345;
    for (let i = 0; i < n; i++) { st.world.calm = 99; st.world.wander = null; st.world.realmToll = st.world.day; const r = C.rollWander(st, from, zone, 1);
      if (r && r.kind === 'fight') { out.fight++; if (/Hedge mages/.test(r.enc.name)) out.hedge++; } else if (r) out.other++; }
    st.world.wander = null; return out; };
  const N = 6000, cr = roll('crown', N), bb = roll('broken_banner', N), hw = roll('hearthwatch', N), sn = roll('synod', N);
  ok('a realm zone to roll on', !!zone && !!from);
  const rt = (a, b) => a.fight / b.fight;
  ok('heavy patrols: road fights about 0.6 as often as loose', rt(cr, bb) > 0.5 && rt(cr, bb) < 0.7, rt(cr, bb).toFixed(2));
  ok('light patrols: road fights about 1.2 as often as loose', rt(hw, bb) > 1.08 && rt(hw, bb) < 1.32, rt(hw, bb).toFixed(2));
  ok('other road meetings keep their chance', Math.abs(cr.other - bb.other) / bb.other < 0.12, cr.other + ' vs ' + bb.other);
  ok('licensed: hedge-mages still walk the roads', cr.hedge > 0, cr.hedge);
  ok('sheltered and free: no hedge-mage turns on travellers', bb.hedge === 0 && hw.hedge === 0);
  ok('hunted: fewer hedge-mages than licensed', sn.hedge / sn.fight < 0.8 * cr.hedge / cr.fight, (sn.hedge / sn.fight).toFixed(3) + ' vs ' + (cr.hedge / cr.fight).toFixed(3));
}

// ---- tolled: the Concord's toll posts ----
{ const st = as(united('ledger'), 'syndicate'); st.inventory.gold = 500;
  const posts = Object.keys(C.NODES).filter(id => C.NODES[id].type === 'road' && C.ownerOf(st, id) === 'realm');
  const tollRoad = posts.find(id => { st.world.wander = null; delete st.world.realmToll; st.world.calm = 0; const r = C.rollWander(st, Object.keys(C.NODES[id].links)[0], id, 1); return r && r.obstacle === 'realm_toll'; });
  ok('tolled: some of the realm\'s roads have a toll post', !!tollRoad && posts.filter(id => C.NODES[id].type === 'road').length > 3);
  const w0 = st.world.wander, opts = C.obstacleOptions(st, w0);
  ok('the toll post offers rank, toll, detour and turning back', opts.map(o => o.id).join() === 'known,pay,detour,turn' && !opts[0].ok && opts[1].ok);
  const g = st.inventory.gold, t = C.realmToll(st), r = C.resolveObstacle(st, 'pay');
  ok('paying the toll lets you pass', r.ok && r.passed && st.inventory.gold === g - t && !st.world.wander);
  st.world.calm = 0; const again = C.rollWander(st, Object.keys(C.NODES[tollRoad].links)[0], tollRoad, 1);
  ok('no second toll within a few days', !(again && again.obstacle === 'realm_toll'));
  ranked(st); st.world.realmToll = st.world.day - 10; st.world.calm = 0; const w1 = C.rollWander(st, Object.keys(C.NODES[tollRoad].links)[0], tollRoad, 1);
  ok('a realm rank waves you through', w1 && w1.obstacle === 'realm_toll' && C.resolveObstacle(st, 'known').passed);
  as(st, 'crown'); st.world.realmToll = st.world.day - 10; st.world.calm = 0; st.world.wander = null; const w2 = C.rollWander(st, Object.keys(C.NODES[tollRoad].links)[0], tollRoad, 1);
  ok('no toll posts under other flavours', !(w2 && w2.obstacle === 'realm_toll'));
}

// ---- war posture ----
{ const st = united('osric');
  ok('the realm uses its posture\'s lines, others the shared ones', C.relLine(st, 'realm', 'war') === P.postures.defensive.war && C.relLine(st, 'hearthwatch', 'war') === C.REL.war);
  as(st, 'hearthwatch'); ok('a peaceful realm keeps long truces', C.relLine(st, 'realm', 'truceDays') === 40);
  const peaceAt = (f, v) => { const s = as(united('osric'), f), r = C.relState(s), k = pk('realm', 'hearthwatch');
    if (!C.REL.factions.includes('hearthwatch') || !C.REL.factions.includes('realm')) return null;
    r.wars[k] = { since: s.world.day, by: 'realm' }; S.setRelation(s, 'realm', 'hearthwatch', v, { both: true }); C.relTick(s); return { peace: !r.wars[k], truce: (r.truce[k] || 0) - s.world.day }; };
  const a = peaceAt('crown', -0.37), b = peaceAt('syndicate', -0.37);
  ok('peace comes at the pair\'s average line, and the truce is the longer', a && a.peace && a.truce === 25, JSON.stringify(a));
  ok('an opportunist holds out at the same mood', b && !b.peace, JSON.stringify(b));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
