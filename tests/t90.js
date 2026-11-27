// Node ownership, phase 3c (design/node_ownership_and_land.md section 16): AI attacks. Who may attack what (marching 3 roads through unclaimed ground),
// the muster and the margin, war weariness, the defender's answer, weekly redeployment, warning, cooldown and the cap on attacks under way,
// how an attack is settled, armies moving in, and the player stepping in for either side.
// Run: cd tests && node t90.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, A = C.ATTACK;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const war = (st, a, b) => { C.relState(st).wars[[a, b].sort().join('|')] = { since: 1, by: a }; };
const day = (st, n) => { for (let i = 0; i < (n || 1); i++) { st.world.day++; C.supplyTick(st); C.attackTick(st); } };
const news = st => C.relState(st).news.filter(n => n.kind === 'attack').map(n => n.text);

ok('data checks pass', C.validateAttacks().length === 0, C.validateAttacks().join('; '));
ok('the agreed numbers: 7 days warning, 7 days between attacks, 2 at once, margin 1.5', A.warn === 7 && A.cooldown === 7 && A.maxActive === 2 && A.margin === 1.5);

// ---- who may attack what ----
{ const st = fresh(); C.attackTick(st); ok('no war, no attacks', C.attacks(st).length === 0); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const o = C.attackOptions(st, 'crown');
  ok('at war, the Crown has targets', o.length > 0);
  ok('every target is held by the enemy, within 3 roads of a Crown place, and is not a capital', o.every(x => C.ownerOf(st, x.target) === 'broken_banner' && x.dist <= 3 && C.marchReach(st, 'crown', x.from)[x.target] === x.dist && C.ownerOf(st, x.from) === 'crown' && C.NODES[x.target].type !== 'capital'));
  const keep = id => Math.ceil(C.garrisonBase(id) / 2), R0 = C.marchReach(st, 'crown', o[0].from), pool0 = Object.keys(R0).filter(y => y !== o[0].from && C.ownerOf(st, y) === 'crown').reduce((n, y) => n + Math.max(0, C.garrison(st, y) - keep(y)), 0);
  ok('the force is the launch place plus what it can muster within 3 roads, and beats the target by 1.5x', o[0].force === C.garrison(st, o[0].from) + pool0 && o.every(x => x.force >= 1.5 * x.garrison), o[0].force + ' vs ' + (C.garrison(st, o[0].from) + pool0));
  const x = o[0]; ok('an attack can only start from a supplied place', !C.attackOptions(st, 'crown', new Set([x.from])).some(y => y.from === x.from));
  { const y = C.supplyNeighbours(x.from).find(z => ['neutral', 'monsters', 'crown'].includes(C.ownerOf(st, z))), R1 = C.marchReach(st, 'crown', x.from);
    if (y) { const o0 = C.ownerOf(st, y); (st.world.nodes[y] = st.world.nodes[y] || {}).owner = 'syndicate'; const R2 = C.marchReach(st, 'crown', x.from), lost = Object.keys(R1).filter(z => !(z in R2));
      st.world.nodes[y].owner = o0; ok('a march stops at ground held by anyone else (here the Syndicate)', y in R2 && Object.keys(R2).length <= Object.keys(R1).length, lost.join()); } }
  C.setGarrison(st, x.target, Math.ceil(x.force / 1.5) + 1); ok('a garrison the force cannot beat by the margin is left alone', !C.attackOptions(st, 'crown').some(y => y.target === x.target)); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const o = C.attackOptions(st, 'crown').find(x => x.force < 2 * x.garrison) || C.attackOptions(st, 'crown')[0];
  C.attackState(st).fails.crown = [1, 1]; ok('each failed attack in the last 60 days adds 0.25 to the margin', C.attackMargin(st, 'crown') === 2);
  st.world.day = 70; ok('older failures are forgotten', C.attackMargin(st, 'crown') === 1.5 && !C.attackState(st).fails.crown); }
{ const st = fresh(); const hw = Object.keys(C.NODES).find(id => C.ownerOf(st, id) === 'hearthwatch'); war(st, 'crown', 'hearthwatch');
  ok('the Hearthwatch is never a target', !C.attackOptions(st, 'crown').some(x => C.ownerOf(st, x.target) === 'hearthwatch'), hw); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); ['crown', 'syndicate', 'synod', 'broken_banner'].forEach(f => ['crown', 'syndicate', 'synod', 'broken_banner'].forEach(g => { if (f < g) war(st, f, g); }));
  const all = ['crown', 'syndicate', 'synod', 'broken_banner'].flatMap(f => C.attackOptions(st, f));
  ok('capitals are never targets (left for 3d)', all.length && !all.some(x => C.NODES[x.target].type === 'capital')); }

// ---- warning, cooldown, two at once ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown');
  ok('an attack is announced 7 days ahead, in the news', a && a.lands === st.world.day + 7 && news(st).some(t => t.includes('gathering men at') || t.includes('massing at')));
  ok('the target shows as under threat', !!C.attackOn(st, a.target) && C.nodeServices(st, a.target).attack.days === 7);
  for (let i = 0; i < 6; i++) { st.world.day++; C.attackTick(st); }
  ok('no second Crown attack within 7 days', C.attacks(st).filter(x => x.by === 'crown').length === 1);
  st.world.day++; C.supplyTick(st); C.attackTick(st); }
{ const run = cap => { const st = fresh(); ['broken_banner', 'syndicate', 'synod'].forEach(g => war(st, 'crown', g)); const r = C.attackState(st); let most = 0; A.maxActive = cap;
    for (let i = 0; i < 40; i++) { day(st); most = Math.max(most, C.attacks(st).filter(x => x.by === 'crown').length); r.list.forEach(a => { a.lands = 1e9; }); }
    A.maxActive = 2; return most; };
  ok('with several fronts, the Crown has 2 under way at once (counterattacks count)', run(2) === 2); ok('and the cap holds (tried at 1)', run(1) === 1); }

// ---- the muster, the defender's answer, redeployment ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackState(st).moved = { crown: 1, broken_banner: 1 };   // no redeployment today, so only the muster moves men
  const os = C.attackOptions(st, 'crown'), g0s = os.map(o => C.garrison(st, o.from)); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown' && !x.counter), i = os.findIndex(o => o.target === a.target), o = os[i], g0 = g0s[i];
  ok('launching musters the army into the launch place', C.garrison(st, a.from) === o.force && o.force > g0, g0 + ' -> ' + C.garrison(st, a.from));
  const keep = id => Math.ceil(C.garrisonBase(id) / 2); const R = C.marchReach(st, 'crown', a.from);
  ok('no donor is stripped below half its base', Object.keys(R).filter(y => C.ownerOf(st, y) === 'crown' && y !== a.from).every(y => C.garrison(st, y) >= Math.min(keep(y), C.garrisonBase(y))));
  ok('the defender answers: it calls in men, or strikes back', a.answer === 'hold' || a.answer === 'counter'); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); A.counterOdds = 2; C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'); A.counterOdds = 0.6;
  ok('when calling in men is enough, the defender holds', a.answer === 'hold' && !C.attacks(st).some(x => x.counter)); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); A.counterOdds = -1; C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown' && !x.counter), c = C.attacks(st).find(x => x.counter); A.counterOdds = 0.6;
  ok('when it would not be, the defender strikes back at the attacker instead', a.answer === 'counter' && c && c.by === 'broken_banner' && c.on === 'crown' && news(st).some(t => t.includes('answers by striking')), a.answer); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const r = C.redeploy(st, 'crown');
  ok('weekly redeployment feeds an outmatched front place from the rear', r && r.men > 0 && C.garrison(st, r.to) > C.garrisonBase(r.to) - 1, JSON.stringify(r));
  const r2 = C.redeploy(st, 'syndicate'); ok('a faction at peace redeploys nothing', r2 === null); }

// ---- settling ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'), f0 = C.garrison(st, a.from);
  ok('nothing is settled before the day it lands', (day(st, 6), C.ownerOf(st, a.target) === 'broken_banner' && !!C.attackOn(st, a.target)));
  day(st, 1); ok('on the day it lands it is settled one way or the other', !C.attacks(st).includes(a) && news(st).some(t => t.includes('fallen') || t.includes('beat off'))); }
{ let won = 0, n = 300; for (let i = 0; i < n; i++) { const st = fresh(); st.world.rng = i * 7919 + 1; war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown');
    C.setGarrison(st, a.from, 9); C.setGarrison(st, a.target, 1); a.lands = st.world.day; C.attackTick(st); if (C.ownerOf(st, a.target) === 'crown') won++; }
  ok('the roll: force 9 against 1 wins about 90% of the time', won / n > 0.82 && won / n < 0.97, won + '/' + n); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'); C.setGarrison(st, a.from, 8);
  C.attackSettle(st, a, 'attack');
  ok('a winner takes the place: owner, news and a grudge', C.ownerOf(st, a.target) === 'crown' && news(st).some(t => t.includes('fallen')) && !!C.relState(st).grudge['broken_banner|crown']);
  ok('the army moves in: half the force (it may sit above the base), the rest stays, less a man lost', C.garrison(st, a.target) === 4 && C.garrison(st, a.from) === 3, C.garrison(st, a.target) + '/' + C.garrison(st, a.from));
  const g = C.garrison(st, a.target), b = C.garrisonBase(a.target);
  if (g > b) { delete C.relState(st).wars['broken_banner|crown']; day(st, 10); ok('a garrison above its base drains back a man every 10 days', C.garrison(st, a.target) === g - 1, C.garrison(st, a.target)); } }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'), f0 = C.garrison(st, a.from), t0 = C.garrison(st, a.target);
  C.attackSettle(st, a, 'hold');
  ok('beaten off: the place stays, both sides lose a man, and the failure counts toward war weariness', C.ownerOf(st, a.target) === 'broken_banner' && C.garrison(st, a.from) === Math.max(1, f0 - 1) && C.garrison(st, a.target) === Math.max(1, t0 - 1) && C.attackMargin(st, 'crown') === 1.75); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown');
  delete C.relState(st).wars['broken_banner|crown']; day(st);
  ok('peace calls off an attack under way', !C.attacks(st).length && C.ownerOf(st, a.target) === 'broken_banner' && news(st).some(t => t.includes('called off'))); }

// ---- stepping in ----
const rank = (st, f) => S.joinRank(st, f, { force: true, leave: true });
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown');
  ok('away from the place there is no fight to join', C.attackEncounter(st, a.target) === null);
  st.world.location = a.target; ok('unsworn, you can help either side', C.attackSides(st, a.target).join() === 'hold,attack');
  rank(st, 'crown'); ok('sworn to the attacker, you can only join the attack', C.attackSides(st, a.target).join() === 'attack');
  rank(st, 'broken_banner'); ok('sworn to the defender, you can only help hold it', C.attackSides(st, a.target).join() === 'hold'); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'); st.world.location = a.target;
  const k = C.attackEncounter(st, a.target), E = C.ENCOUNTERS[k], b = C.encounterBuilds(k, 'attack'), hb = C.encounterBuilds(k, 'hold');
  ok('the fight has both sides: join the attack fights the garrison, holding fights the attackers', b.builds.every(u => u.faction === 'broken_banner') && hb.builds.every(u => u.faction === 'crown') && E.options.length === 2);
  ok('the briefing shows the standing at stake', b.standing.crown === 10 && b.standing.broken_banner === -10);
  const s0 = S.getStanding(st, 'crown'), r = C.applyEncounterResult(st, k, 'attack', { won: true, kills: [], survivors: [] });
  ok('winning for the attackers takes the place at once', C.ownerOf(st, a.target) === 'crown' && r.attack && r.attack.won && !C.attackOn(st, a.target));
  ok('and the side you helped thinks better of you', S.getStanding(st, 'crown') > s0); }
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.attackTick(st); const a = C.attacks(st).find(x => x.by === 'crown'); st.world.location = a.target;
  const k = C.attackEncounter(st, a.target); C.applyEncounterResult(st, k, 'hold', { won: false, kills: [], survivors: [] });
  ok('losing a fight leaves the attack to the roll', !!C.attackOn(st, a.target));
  C.applyEncounterResult(st, C.attackEncounter(st, a.target), 'hold', { won: true, kills: [], survivors: [] });
  ok('winning for the defenders beats the attack off at once', C.ownerOf(st, a.target) === 'broken_banner' && !C.attackOn(st, a.target) && C.attackMargin(st, 'crown') === 1.75); }

// ---- trade grabs ----
{ const st = fresh(); const o = C.grabOptions(st);
  ok('the Syndicate can eye a weakly held market or town up to 6 roads out', o.length > 0 && o.every(x => ['market', 'town'].includes(C.NODES[x.target].type) && x.dist <= 6 && x.on !== 'syndicate' && x.force >= 1.5 * x.garrison), o.length);
  C.grabTick(st, new Set()); const g = C.attackState(st).grab;
  ok('at peace with everyone, it starts a grab, in the news', g && g.target === o[0].target && C.relState(st).news.some(n => n.kind === 'grab' && n.text.includes('buying up the debts')));
  const v0 = C.relValue(st, 'syndicate', g.on); for (let i = 0; i < 10; i++) { st.world.day++; C.grabTick(st, new Set()); }
  ok('its relation with the holder sours each day', C.relValue(st, 'syndicate', g.on) < v0 - 0.09, v0 + ' -> ' + C.relValue(st, 'syndicate', g.on));
  ok('when war comes, the Syndicate is the one that declares it', C.relDeclarer(st, 'syndicate', g.on) === 'syndicate' && C.relDeclarer(st, g.on, 'syndicate') === 'syndicate');
  war(st, 'syndicate', g.on); const way = new Set(C.grabWay(st)), ao = C.attackOptions(st, 'syndicate');
  ok('in a grab war it attacks only the prize and the holder\'s places on the way to it', way.has(g.target) && ao.every(x => x.on !== g.on || way.has(x.target)), [...way].join());
  (st.world.nodes[g.target] = st.world.nodes[g.target] || {}).owner = 'syndicate'; C.grabTick(st, new Set());
  ok('holding the prize, it asks for terms', !!C.attackState(st).grab.took && C.relState(st).news.some(n => n.text.includes('asking the')));
  const v1 = C.relValue(st, 'syndicate', g.on); st.world.day++; C.grabTick(st, new Set()); ok('and the relation warms toward peace', C.relValue(st, 'syndicate', g.on) > v1);
  ok('it asks for no more of the holder\'s places once it has the prize', !C.attackOptions(st, 'syndicate').some(x => x.on === g.on)); }
{ const st = fresh(); war(st, 'crown', 'syndicate'); C.grabTick(st, new Set()); ok('at war already, it starts no grab', !C.attackState(st).grab); }

// ---- men are moved, not made ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); const men = f => Object.keys(C.NODES).filter(id => C.ownerOf(st, id) === f).reduce((n, id) => n + C.garrison(st, id), 0), cap = f => Object.keys(C.NODES).filter(id => C.ownerOf(st, id) === f).reduce((n, id) => n + C.garrisonBase(id), 0);
  for (let i = 0; i < 120; i++) { day(st); C.attackState(st).list.forEach(a => { a.lands = 1e9; }); }
  ok('mustering and regrowth never take a faction past the sum of its base garrisons', men('crown') <= cap('crown') && men('broken_banner') <= cap('broken_banner'), men('crown') + '/' + cap('crown')); }

// ---- wiring and saves ----
{ const st = fresh(); war(st, 'crown', 'broken_banner'); C.relState(st).wars['broken_banner|crown'].since = 1; S.advanceDay(st, 1); ok('the daily tick runs from advanceDay', C.attacks(st).length > 0); }
{ const st = fresh(); const s2 = S.repair(JSON.parse(JSON.stringify(st))).state; delete s2.world.atk; S.advanceDay(s2, 1); ok('a save without attack state loads and ticks', !!s2.world.atk); }
{ let moved = 0, t = Date.now(); for (let g = 0; g < 10; g++) { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rng = (g * 7919 + 13) >>> 0; S.advanceDay(st, 300);
    moved += Object.keys(C.NODES).filter(id => C.ownerOf(st, id) !== C.defaultOwner(id)).length; }
  ok('300 days of real play: places change hands and the tick stays cheap', moved > 0 && Date.now() - t < 30000, moved + ' changed, ' + (Date.now() - t) + ' ms'); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
