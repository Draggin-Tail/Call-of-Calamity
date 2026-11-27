// Node ownership, phase 3a (design/node_ownership_and_land.md section 6): relations between the human factions drift toward a resting point
// set by ideals and motives; wars, peace and truces, one ally each; the council that asks the player; the player's levers; ideals cost standing.
// Run: cd tests && node t88.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, R = C.REL;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 1; C.relState(st).day = 1; C.relState(st).next = 1e9; return st; };
const set = (st, a, b, v) => S.setRelation(st, a, b, v, { both: true });
const days = (st, n) => { for (let i = 0; i < n; i++) S.advanceDay(st, 1); };
const hall = f => Object.keys(C.NODES).find(id => C.ownerOf(fresh(), id) === f && C.NODES[id].type === 'capital');
const rank = (st, f, n) => { S.joinRank(st, f, { force: true, leave: true }); while (S.getRank(st, f).rank < n) S.promote(st, f, { force: true }); };

ok('data checks pass', C.validateRelations().length === 0 && C.validateCast().length === 0, C.validateRelations().join('; '));
ok('every human faction has ideals and a motive', R.factions.every(f => C.IDEALS[f] && C.MOTIVES[f]));
ok('ideals: the Banner and the Hearthwatch are alike, the Synod and the Banner clash', C.idealAffinity('broken_banner', 'hearthwatch') > 0.3 && C.idealAffinity('synod', 'broken_banner') < -0.3);

// ---- drift ----
{ const st = fresh(), t = C.relTarget(st, 'syndicate', 'synod'), v0 = C.relValue(st, 'syndicate', 'synod'); days(st, 30);
  const v1 = C.relValue(st, 'syndicate', 'synod');
  ok('a pair drifts toward its resting point, slowly', Math.abs(v1 - t) < Math.abs(v0 - t) && Math.abs(v1 - v0) < 0.2, v0.toFixed(2) + ' -> ' + v1.toFixed(2) + ' (rest ' + t.toFixed(2) + ')');
  ok('relations stay symmetric', Math.abs(S.getRelation(st, 'syndicate', 'synod') - S.getRelation(st, 'synod', 'syndicate')) < 1e-9);
  ok('drift alone leaves the rivalry table alone', S.rivalry('syndicate', 'synod', st) === 'opposed'); }
{ const st = fresh(); const t0 = C.relTarget(st, 'crown', 'synod'); C.relState(st).wars['broken_banner|crown'] = { since: 1, by: 'crown' }; C.relState(st).wars['broken_banner|synod'] = { since: 1, by: 'synod' };
  ok('a shared enemy warms a pair', C.relTarget(st, 'crown', 'synod') > t0 + 0.1); }
{ const st = fresh(); const t0 = C.relTarget(st, 'crown', 'broken_banner'); C.relState(st).wars['broken_banner|crown'] = { since: 1, by: 'crown' }; st.world.day = 61;
  ok('war weariness raises the resting point the longer a war runs', C.relTarget(st, 'crown', 'broken_banner') > t0 + 0.2); }
{ const st = fresh(); const t0 = C.relTarget(st, 'crown', 'synod'); C.relFlip(st, 'synod', 'crown');
  ok('losing a place: a sharp drop and a grudge on the resting point', C.relTarget(st, 'crown', 'synod') < t0 - 0.2 && C.relValue(st, 'crown', 'synod') < 0.15); }

// ---- incidents ----
{ const st = fresh(); C.relState(st).next = 2; days(st, 1);
  const n = C.relReport(st).news; ok('an incident comes on its day and makes the news', n.length === 1 && n[0].kind === 'incident', JSON.stringify(n)); }

// ---- war and peace between AI factions ----
{ const st = fresh(); set(st, 'crown', 'broken_banner', -0.7); days(st, 1);
  ok('below the war line the Crown declares war on the Banner (its motive names them)', C.relAtWar(st, 'crown', 'broken_banner') && C.relState(st).wars['broken_banner|crown'].by === 'crown');
  ok('war makes the pair Opposed', S.rivalry('crown', 'broken_banner', st) === 'opposed');
  set(st, 'crown', 'broken_banner', -0.35); days(st, 1);
  ok('above the peace line they make peace, and the pair is Uneasy', !C.relAtWar(st, 'crown', 'broken_banner') && S.rivalry('crown', 'broken_banner', st) === 'uneasy');
  set(st, 'crown', 'broken_banner', -0.8); days(st, 1);
  ok('during the truce there is no new war', !C.relAtWar(st, 'crown', 'broken_banner'));
  days(st, R.truceDays); set(st, 'crown', 'broken_banner', -0.8); days(st, 1);
  ok('after the truce, war can come again', C.relAtWar(st, 'crown', 'broken_banner')); }
{ const st = fresh(); set(st, 'synod', 'hearthwatch', -0.9); days(st, 1);
  ok('no AI faction makes war on the Hearthwatch', !C.relAtWar(st, 'synod', 'hearthwatch')); }

// ---- alliances ----
{ const st = fresh(); set(st, 'crown', 'synod', 0.6); days(st, 1);
  ok('above the alliance line two free factions ally', C.relAllyOf(st, 'crown') === 'synod' && C.relAllyOf(st, 'synod') === 'crown' && S.rivalry('crown', 'synod', st) === 'open');
  set(st, 'crown', 'syndicate', 0.7); days(st, 1);
  ok('one ally each: a third faction is not taken on', C.relAllyOf(st, 'crown') === 'synod' && !C.relAllyOf(st, 'syndicate'));
  set(st, 'crown', 'synod', 0.25); days(st, 1);
  ok('below the break line the alliance ends, and the pair is Uneasy', !C.relAllyOf(st, 'crown') && S.rivalry('crown', 'synod', st) === 'uneasy'); }
{ const st = fresh(); set(st, 'broken_banner', 'hearthwatch', 0.8); days(st, 1);
  ok('no AI faction allies with the Hearthwatch', !C.relAllyOf(st, 'hearthwatch')); }

// ---- the council ----
{ const st = fresh(); rank(st, 'crown', 1); set(st, 'crown', 'broken_banner', -0.7); days(st, 1);
  const p = C.relState(st).pending;
  ok('sworn to the Crown: it asks you before it starts the war', !C.relAtWar(st, 'crown', 'broken_banner') && p && p.kind === 'war' && p.faction === 'crown' && p.with === 'broken_banner');
  st.world.location = 'rivermeet'; ok('the council does not meet away from its halls', !C.movesHere(st, 'rivermeet').some(m => m.id === 'faction_council'));
  const H = hall('crown'); st.world.location = H; const b = C.startMove(st, 'faction_council');
  ok('at a Crown hall the council scene opens and names the war', b && b.lines.join(' ').includes('Broken Banner'), JSON.stringify(b && b.lines));
  const r = C.chooseMove(st, 'yes');
  ok('saying yes declares the war', r.ok && C.relAtWar(st, 'crown', 'broken_banner') && !C.relState(st).pending); }
{ const st = fresh(); rank(st, 'crown', 1); set(st, 'crown', 'broken_banner', -0.7); days(st, 1); st.world.location = hall('crown');
  C.startMove(st, 'faction_council'); C.chooseMove(st, 'no');
  ok('saying no: no war, and the pair is pulled back from the line', !C.relAtWar(st, 'crown', 'broken_banner') && C.relValue(st, 'crown', 'broken_banner') >= R.declineTo - 0.01);
  set(st, 'crown', 'broken_banner', -0.7); days(st, 1);
  ok('they do not ask again straight away', !C.relState(st).pending && !C.relAtWar(st, 'crown', 'broken_banner')); }
{ const st = fresh(); rank(st, 'crown', 1); set(st, 'crown', 'broken_banner', -0.7); days(st, 1); days(st, R.summonsDays);
  ok('an unanswered council counts as no', !C.relState(st).pending && !C.relAtWar(st, 'crown', 'broken_banner') && C.relReport(st).news.some(n => /did nothing/.test(n.text))); }
{ const st = fresh(); rank(st, 'broken_banner', 1); set(st, 'crown', 'broken_banner', -0.7); days(st, 1);
  ok('being attacked is not a choice: the Crown declares on your Banner without asking you', C.relAtWar(st, 'crown', 'broken_banner') && !C.relState(st).pending); }
{ const st = fresh(); rank(st, 'synod', 1); set(st, 'crown', 'synod', 0.6); days(st, 1);
  ok('an alliance for your faction waits for your word', !C.relAllyOf(st, 'synod') && C.relState(st).pending && C.relState(st).pending.kind === 'ally');
  const r = C.relDecide(st, true); ok('yes swears it', r.ok && C.relAllyOf(st, 'synod') === 'crown'); }
{ const st = fresh(); rank(st, 'crown', 1); set(st, 'crown', 'hearthwatch', 0.7); days(st, 1);
  ok('your faction may ally with the Hearthwatch, if you say yes', C.relState(st).pending && C.relState(st).pending.with === 'hearthwatch'); }

// ---- the player's levers ----
{ const st = fresh(); rank(st, 'crown', 1); st.world.location = hall('crown');
  ok('arguing needs rank 2', C.relArgueOptions(st).length === 0);
  S.promote(st, 'crown', { force: true }); const o = C.relArgueOptions(st);
  ok('at rank 2, at a Crown hall, you can speak for peace or alliance', o.length === 4 && o.find(x => x.faction === 'broken_banner').peace && o.find(x => x.faction === 'synod').ally);
  const v0 = C.relValue(st, 'crown', 'synod'), r = C.relArgue(st, 'synod', 'ally');
  ok('speaking for an alliance warms the pair', r.ok && C.relValue(st, 'crown', 'synod') > v0 + 0.03);
  ok('once heard, wait before arguing it again', !C.relArgue(st, 'synod', 'ally').ok);
  st.world.location = 'rivermeet'; ok('away from a hall, no arguing', C.relArgueOptions(st).length === 0); }
{ const st = fresh(); const f0 = C.relFit(st, 'broken_banner'); for (let i = 0; i < 6; i++) C.deed(st, null, 'light', 2, { public: true });
  ok('a merciful name fits the Banner better, and the Synod worse', C.relFit(st, 'broken_banner') > f0 + 0.2 && C.relFit(st, 'synod') < 1); }
{ const st = fresh(); rank(st, 'crown', 1); const base = Object.keys(C.ENCOUNTERS).find(k => C.ENCOUNTERS[k].enemyFaction === 'outlaws' && !C.ENCOUNTERS[k].dungeon), E = 't88_banner';
  C.ENCOUNTERS[E] = Object.assign({}, C.ENCOUNTERS[base], { enemyFaction: 'broken_banner', once: false, winFlag: null, job: null });
  const v0 = C.relValue(st, 'crown', 'broken_banner'); C.applyEncounterResult(st, E, null, { won: true, kills: [], survivors: [] });
  ok('winning a fight against the Banner while sworn to the Crown sours the two', C.relValue(st, 'crown', 'broken_banner') < v0 - 0.02, E); }

// ---- ideals cost standing ----
{ const st = fresh(); rank(st, 'crown', 1); const s0 = S.getStanding(st, 'crown');
  C.deed(st, null, 'gray', 0, { public: true, axes: { mercy: 0, honesty: -2 } });
  ok('a public lie costs a Crown knight a little standing', S.getStanding(st, 'crown') === s0 - 6, S.getStanding(st, 'crown') - s0);
  const s1 = S.getStanding(st, 'crown'); C.deed(st, null, 'gray', 0, { public: false, axes: { mercy: 0, honesty: -2 } });
  ok('a private one costs a third as much', S.getStanding(st, 'crown') === s1 - 2, S.getStanding(st, 'crown') - s1);
  const s2 = S.getStanding(st, 'crown'); C.deed(st, null, 'light', 2, { public: true });
  ok('mercy costs a Crown knight nothing (the Crown does not care either way)', S.getStanding(st, 'crown') === s2); }
{ const st = fresh(); rank(st, 'syndicate', 1); const s0 = S.getStanding(st, 'syndicate'); C.deed(st, null, 'light', 2, { public: true });
  ok('public kindness costs a Syndicate agent a little (it calls mercy weakness)', S.getStanding(st, 'syndicate') === s0 - 3, S.getStanding(st, 'syndicate') - s0); }
{ const st = fresh(); const s0 = S.getStanding(st, 'crown'); C.deed(st, null, 'gray', 0, { public: true, axes: { honesty: -2 } });
  ok('serving no faction, ideals cost nothing', S.getStanding(st, 'crown') === s0); }

// ---- saves ----
{ const st = fresh(); delete st.world.rel; const st2 = S.repair(JSON.parse(JSON.stringify(st))).state; days(st2, 3);
  ok('an old save without relations starts them on its current day', C.relState(st2).day === st2.world.day); }
{ const a = fresh(), b = fresh(); C.relState(a).seed = C.relState(b).seed = 99; C.relState(a).next = C.relState(b).next = 2; days(a, 40); days(b, 40);
  ok('the same seed gives the same incidents', JSON.stringify(C.relReport(a).news) === JSON.stringify(C.relReport(b).news)); }
{ const st = fresh(); S.advanceDay(st, 5); ok('a five-day jump runs five days of drift', C.relState(st).day === st.world.day && st.world.day === 6); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
