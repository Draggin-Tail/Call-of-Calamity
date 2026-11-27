// Node ownership, phase 2 (design/node_ownership_and_land.md section 9): one faction at a time, no Suspicion or double lives,
// rival factions mark you up, the Banner's capital, and old saves trimmed to one rank.
// Run: cd tests && node t86.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE, D = w.GAME_DATA, N = C.NODES;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; ['crown', 'syndicate', 'synod', 'broken_banner'].forEach(f => { st.factions.standing[f] = 0; }); return st; };
const WAR = ['crown', 'syndicate', 'synod', 'broken_banner'];

// ---- one rank at a time ----
{ const st = fresh(); S.joinRank(st, 'crown', { force: true });
  const c = S.canJoin(st, 'syndicate', { force: true });
  ok('holding a rank blocks a plain join elsewhere, and says whom you would leave', !c.ok && c.leaves === 'crown');
  ok('the rank cap is one', S.RANK.maxRanks === 1);
  const before = S.getStanding(st, 'crown'), r = S.joinRank(st, 'syndicate', { force: true, leave: true });
  ok('joining with leave: you leave your faction and join the new one', r.ok && r.left === 'crown' && !S.getRank(st, 'crown') && S.getRank(st, 'syndicate').rank === 1 && S.listRanks(st).length === 1);
  ok('leaving costs standing with the faction you left', S.getStanding(st, 'crown') < before);
  ok('S.sworn names your one faction', S.sworn(st) === 'syndicate'); }
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); S.promote(st, 'crown', { force: true }); S.promote(st, 'crown', { force: true });
  S.joinRank(st, 'synod', { force: true, leave: true }); S.joinRank(st, 'crown', { force: true, leave: true });
  ok('rejoining a faction you left starts you at rank 1', S.getRank(st, 'crown').rank === 1); }
{ const st = fresh(); const r = S.outcastJoin(st);
  ok('the Banner still takes in an outcast with nowhere to go', r.ok && S.getRank(st, 'broken_banner') && S.getStanding(st, 'crown') < 0); }
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); const g = S.getGoodwill(st); S.changeGoodwill(st, 20, 't');
  ok('Hearthwatch goodwill sits outside the one-rank limit', S.getGoodwill(st) === g + 20 && S.getRank(st, 'crown')); }
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); S.setDormant(st, 'crown', true); const r = S.promote(st, 'crown', { force: true });
  ok('stepping back (a dormant rank) still pauses promotion', !r.ok && S.getRank(st, 'crown').dormant); }
{ const st = fresh(); const ch = S.serve(st, 'crown', 100);
  ok('serving a faction still drains standing with an Uneasy rival', ch.some(c => c.faction === 'syndicate' && c.delta === -25) && st.factions.history.some(h => h.faction === 'syndicate' && h.reason === 'serving crown')); }

// ---- offers ----
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); st.factions.standing.syndicate = 300; st.world.flags.tryout_syndicate = 1;
  const o = S.invitations(st).find(x => x.faction === 'syndicate');
  ok('another faction can still offer you a place while you serve one; the offer says you would leave', o && o.kind === 'join' && o.leaves === 'crown');
  ok('no offer is "in secret"', S.invitations(st).every(x => !('needsSecret' in x)));
  const off = C.offers(st).find(x => x.faction === 'syndicate'); st.world.location = off.at;
  const r = C.acceptOffer(st, 'syndicate');
  ok('accepting it in person leaves your faction and joins the new one', r.ok && r.left === 'crown' && S.sworn(st) === 'syndicate');
  const fn = C.factionNext(fresh()); ok('the Journal lines read without errors', Array.isArray(fn)); }
{ const st = fresh(); st.factions.standing.syndicate = 300;
  const r = S.canJoin(st, 'syndicate');
  ok('the try-out still comes before the first offer', !r.ok && r.tryout); }

// ---- Suspicion, double lives and lying low are gone ----
ok('no Suspicion rules are left', S.SUSPICION === undefined && !S.addSuspicion && !S.suspicion && !S.tickSecrets && !S.resolveExposure && !S.testDue);
ok('no double-life scenes are left', !C.secretCheck && !C.secretScene && !C.secretChoose && !C.coverSuspicion && !C.lieLow && !C.holdLieLow);
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); ok('a rank has no secret flag or suspicion', !('secret' in S.getRank(st, 'crown')) && !('suspicion' in st.factions.ranks.crown)); }
{ const st = fresh(); S.joinRank(st, 'synod', { force: true }); const d0 = st.world.day; S.advanceDay(st, 10);
  ok('days pass without touching a rank', st.world.day === d0 + 10 && Object.keys(st.factions.ranks.synod).sort().join() === 'dormant,rank,since,trust'); }
{ const st = fresh(); S.joinRank(st, 'crown', { force: true }); const s0 = S.getStanding(st, 'crown'); C.harm(st, 'crown', 10);
  ok('hurting your own faction costs standing, nothing more', S.getStanding(st, 'crown') === s0 - 10 && !st.world.secret); }

// ---- rival shops and recruiters ----
const svc = (st, id) => C.nodeServices(st, id);
const shopOf = f => Object.keys(N).find(id => N[id].shop && C.defaultOwner(id) === f && !N[id].hidden);
const recruitOf = f => Object.keys(N).find(id => N[id].recruit && C.defaultOwner(id) === f && C.recruitRace(id) && !N[id].hidden);
{ const id = shopOf('syndicate'), a = fresh(), b = fresh(); S.joinRank(b, 'crown', { force: true });
  const p0 = svc(a, id).shop.priceMult, p1 = svc(b, id).shop.priceMult;
  ok('an Uneasy rival (Crown vs Syndicate) charges you about 20% more', Math.abs(p1 / p0 - 1.2) < 0.02, p0 + ' -> ' + p1);
  ok('an Uneasy rival still recruits for you', !recruitOf('syndicate') || !!svc(b, recruitOf('syndicate')).recruit); }
{ const id = shopOf('synod'), rid = recruitOf('synod'), a = fresh(), b = fresh(); S.joinRank(b, 'syndicate', { force: true });
  const p0 = svc(a, id).shop.priceMult, p1 = svc(b, id).shop.priceMult;
  ok('an Opposed rival (Syndicate vs Synod) charges you about 40% more', Math.abs(p1 / p0 - 1.4) < 0.02, p0 + ' -> ' + p1);
  ok('an Opposed rival\'s recruiters will not deal with you', !!rid && !!svc(a, rid).recruit && !svc(b, rid).recruit, rid);
  ok('the place sheet knows the rating', svc(b, id).rival === 'opposed'); }
{ const id = shopOf('crown'), a = fresh(); S.joinRank(a, 'crown', { force: true }); const b = fresh();
  ok('your own faction\'s shops are not marked up', svc(a, id).shop.priceMult === svc(b, id).shop.priceMult); }
{ const hw = Object.keys(N).find(id => N[id].shop && C.defaultOwner(id) === 'hearthwatch'), a = fresh(), b = fresh(); S.joinRank(b, 'synod', { force: true });
  ok('the Hearthwatch never marks you up (Synod is Uneasy with it)', !hw || svc(a, hw).shop.priceMult === svc(b, hw).shop.priceMult, hw); }
{ const id = shopOf('syndicate'), st = fresh(); S.joinRank(st, 'crown', { force: true }); st.factions.rivalryOverrides = { 'crown|syndicate': 'opposed' };
  ok('a rating changed by the world (a Moot outcome) changes the markup', svc(st, id).rival === 'opposed'); }
{ const id = shopOf('synod'), st = fresh(); st.factions.standing.synod = -900;
  ok('Hostile standing still shuts shops and recruiters', !svc(st, id).shop && !svc(st, id).recruit); }
{ const id = shopOf('synod'), buy = sworn => { const st = fresh(); if (sworn) S.joinRank(st, 'syndicate', { force: true }); st.world.location = id; st.inventory.gold = 99999; const it = svc(st, id).shop.stock[0], r = C.buy(st, id, it.id || it); return r.ok ? 99999 - st.inventory.gold : null; };
  const a = buy(false), b = buy(true); ok('buying charges the marked-up price', a && b && Math.abs(b / a - 1.4) < 0.03, a + ' -> ' + b); }

// ---- switching sides has no wait ----
{ const st = fresh(); st.factions.standing.crown = 300; st.factions.standing.synod = 300;
  const a = S.setAllegiance(st, 'crown'), b = S.setAllegiance(st, 'synod');
  ok('swearing allegiance elsewhere has no cooldown', a.ok && b.ok, b.reason); }

// ---- the Banner's capital ----
ok('Outlaw\'s Rest is the Broken Banner\'s capital', N.outlaws_rest.type === 'capital' && N.outlaws_rest.capital === 'broken_banner' && C.defaultOwner('outlaws_rest') === 'broken_banner');
ok('every human war faction has exactly one capital', WAR.every(f => Object.values(N).filter(n => n.capital === f).length === 1));
ok('Outlaw\'s Rest keeps its scene', N.outlaws_rest.choice === 'outlaws_rest');

// ---- old saves ----
{ const st = fresh(); st.world.day = 50; st.world.secret = { cover: { crown: 40 } };
  st.factions.ranks = { crown: { rank: 3, secret: false, suspicion: 0, since: 20 }, syndicate: { rank: 3, secret: false, suspicion: 0, since: 10 }, synod: { rank: 4, secret: true, suspicion: 70, testDue: true, since: 5 } };
  const r = S.repair(JSON.parse(JSON.stringify(st))), R = r.state.factions.ranks;
  ok('an old save keeps its highest public rank (ties: the one held longest)', Object.keys(R).join() === 'syndicate' && R.syndicate.rank === 3, Object.keys(R).join());
  ok('the kept rank has no secret or suspicion left', !('secret' in R.syndicate) && !('suspicion' in R.syndicate) && !('testDue' in R.syndicate) && !('wasSecret' in R.syndicate));
  ok('the double-life record is cleared', !r.state.world.secret);
  ok('the dropped ranks are noted in the faction history', ['crown', 'synod'].every(f => r.state.factions.history.some(h => h.faction === f && h.delta === 0 && /one faction/.test(h.reason))));
  ok('the repaired save validates', S.validate(r.state).length === 0, S.validate(r.state).join('; ')); }
{ const st = fresh(); st.factions.ranks = { synod: { rank: 4, secret: true, suspicion: 30, since: 5 }, crown: { rank: 1, secret: false, since: 9 } };
  const R = S.repair(JSON.parse(JSON.stringify(st))).state.factions.ranks;
  ok('a public rank wins over a higher secret one', Object.keys(R).join() === 'crown'); }
{ const st = fresh(); st.factions.ranks = { synod: { rank: 2, secret: true, suspicion: 30, since: 5 } };
  const R = S.repair(JSON.parse(JSON.stringify(st))).state.factions.ranks;
  ok('a lone secret rank is kept, now in the open', R.synod && R.synod.rank === 2 && !('secret' in R.synod)); }

// ---- data ----
ok('data validates', C.validate().length === 0, C.validate().slice(0, 3).join('; '));
['validateCast', 'validateWork', 'validateQuests'].forEach(k => { if (C[k]) ok(k + ' is clean', C[k]().length === 0, C[k]().slice(0, 3).join('; ')); });
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
