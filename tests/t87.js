// The two new Moot claimants (design/succession_moot.md, "Two new claimants"): the Long Ledger (Harrow, openly; Syndicate)
// and Archon Ilvane (Synod). Their gates, the default count, the one-step sway, the counters, and each outcome's rivalry and hold.
// Run: cd tests && node t87.js | grep -v ^PASS
let fails = 0; const ok = (n, c, info) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c || !info ? '' : '  [' + info + ']')); if (!c) fails++; };
const w = require(process.env.LD || './real_ld.js')(); const C = w.GAME_CAMPAIGN, S = w.GAME_SAVE;
const fresh = () => { const st = C.newGame({ race: 'human', name: 'T' }); st.world.rbNext = 1e9; st.world.day = 5; return st; };
const proof = (st, sid) => { C.dossier(st); st.world.dossier.proof[sid] = { since: st.world.day, defended: 0, held: true }; };
const callMoot = st => { const m = C.moot(st); m.called = st.world.day; m.by = 'test'; };
const at = (st, id) => { st.world.location = id; };
const offer = (st, id, opt, place) => { at(st, place); const b = C.startMove(st, id); if (!b) return null; return C.chooseMove(st, opt); };
const sorted = (a, b) => [a, b].sort().join('|');

ok('data checks pass', C.validateIntrigue().length === 0 && C.validateCast().length === 0, C.validateIntrigue().concat(C.validateCast()).join('; '));
ok('both claimants are listed with their backers', C.MOOT.claimants.ledger.backer === 'syndicate' && C.MOOT.claimants.ilvane.backer === 'synod');

// ---- the Long Ledger ----
{ const st = fresh(); callMoot(st); at(st, 'crown_keep');
  ok('without the Second Book, The Steward\'s Offer does not come', C.startMove(st, 'stewards_offer') === null);
  ok('the field without new claimants is unchanged', C.mootStanding(st).join() === 'regency,osric,corisande'); }
{ const st = fresh(); proof(st, 'hidden_hand'); at(st, 'crown_keep');
  ok('the Offer waits for the Moot to be called', C.startMove(st, 'stewards_offer') === null); }
{ const st = fresh(); proof(st, 'hidden_hand'); st.world.flags.crane_hand = 1; callMoot(st);
  ok('if Crane holds the Book, Harrow cannot stand', offer(st, 'stewards_offer', 'give', 'crown_keep') === null); }
{ const st = fresh(); proof(st, 'hidden_hand'); callMoot(st);
  const r = offer(st, 'stewards_offer', 'keep', 'crown_keep');
  ok('keeping the Book leaves the field as it was', r && r.ok && !C.mootStanding(st).includes('ledger') && st.world.dossier.proof.hidden_hand.held); }
{ const st = fresh(); proof(st, 'hidden_hand'); callMoot(st);
  const r = offer(st, 'stewards_offer', 'give', 'crown_keep'), stand = C.mootStanding(st);
  ok('giving back the Book: the Ledger stands and the Regency withdraws', r && r.ok && stand.includes('ledger') && !stand.includes('regency'), stand.join());
  ok('the Book is spent (given to Harrow), not exposed', !st.world.dossier.proof.hidden_hand.held && st.world.dossier.proof.hidden_hand.used === 'ledger');
  const t = C.mootTally(st), v = s => t.seats.find(x => x.seat === s).vote;
  ok('seats: Lords Osric, Syndicate Ledger, Synod Osric, Hearthwatch Corisande', v('lords') === 'osric' && v('syndicate') === 'ledger' && v('synod') === 'osric' && v('hearthwatch') === 'corisande', t.seats.map(s => s.seat + ':' + s.vote).join());
  ok('default count: Osric wins 5 to 2', t.winner === 'osric' && t.counts.osric === 5 && t.counts.ledger === 2);
  C.moot(st).canvass.lords = { how: 'persuade', for: 'ledger', day: 1 };
  const t2 = C.mootTally(st);
  ok('swaying the Lords one step gives the Ledger 5 and the Moot', t2.winner === 'ledger' && t2.counts.ledger === 5, JSON.stringify(t2.counts));
  ok('the Synod never backs the Ledger, even swayed', (() => { C.moot(st).canvass.synod = { how: 'persuade', for: 'ledger', day: 1 }; return C.mootTally(st).seats.find(x => x.seat === 'synod').vote !== 'ledger'; })()); }
{ const st = fresh(); proof(st, 'hidden_hand'); callMoot(st); offer(st, 'stewards_offer', 'give', 'crown_keep'); st.world.flags.pledged_regency = 1;
  const m = C.moot(st); m.canvass.lords = { how: 'persuade', for: 'ledger', day: 1 }; at(st, 'crown_keep');
  C.mootOpen(st); const d = C.mootDeclare(st, 'ledger'), before = S.getStanding(st, 'crown'), r = C.mootResolve(st);
  ok('declaring for the Ledger and winning', d.ok && r.ok && r.outcome === 'ledger' && r.kingmaker, JSON.stringify(r).slice(0, 200));
  ok('declaring for Harrow as the Ledger does not break a pledge to the Steward', !(r.changes || []).some(c => c.faction === 'crown' && c.delta === -C.MOOT.pledgeCost));
  const ov = st.factions.rivalryOverrides;
  ok('Ledger outcome: Crown/Syndicate Open, Syndicate/Synod and Crown/Banner Opposed', ov[sorted('crown', 'syndicate')] === 'open' && ov[sorted('syndicate', 'synod')] === 'opposed' && ov[sorted('crown', 'broken_banner')] === 'opposed');
  ok('the ruler is Lord Treasurer Harrow', C.realmTitle(st) === 'Lord Treasurer Harrow');
  ok('Crane is his heir and Voss resigns', !!st.world.flags.crane_heir && !!st.world.flags.voss_resigned);
  const ho = C.holdOffers(st).map(o => o.id);
  ok('the hold offers are three places near Gildhaven', ho.join() === 'debtors_tower,barge_landing,brassbell' && ho.every(id => C.NODES[id].area === 'river_cities'));
  const g = C.grantHold(st, 'debtors_tower');
  ok('the hold is granted, backed by the Syndicate', g.ok && st.world.hold.backer === 'syndicate' && C.ownerOf(st, 'debtors_tower') === 'player');
  ok('the board reads that debts are the law', /debts are the law/.test(C.AFTER_MOOT.ledger.board));
  ok('the Moot is recorded in the dossier', C.knows ? C.knows(st, 'moot_ledger') : true); }

{ const st = fresh(); st.world.day = 0; proof(st, 'hidden_hand'); callMoot(st); offer(st, 'stewards_offer', 'give', 'crown_keep');
  ok('the Ledger stands even if the Book is given back on day 0', C.mootStanding(st).includes('ledger')); }

// ---- Archon Ilvane ----
{ const st = fresh(); proof(st, 'forbidden_hoard'); callMoot(st); S.joinRank(st, 'synod', { force: true }); S.promote(st, 'synod', { force: true });
  ok('at Synod rank 2, The Archon\'s Ward does not come', (at(st, 'voldun'), C.startMove(st, 'archons_ward')) === null); }
{ const st = fresh(); callMoot(st); S.joinRank(st, 'synod', { force: true }); S.promote(st, 'synod', { force: true }); S.promote(st, 'synod', { force: true });
  ok('without the Sleeper truth (the Sealed Ledger), it does not come', (at(st, 'voldun'), C.startMove(st, 'archons_ward')) === null); }
const ilvaneGame = () => { const st = fresh(); proof(st, 'forbidden_hoard'); callMoot(st); S.joinRank(st, 'synod', { force: true }); S.promote(st, 'synod', { force: true }); S.promote(st, 'synod', { force: true });
  const r = offer(st, 'archons_ward', 'carry', 'voldun'); return { st, r }; };
{ const { st, r } = ilvaneGame(), stand = C.mootStanding(st);
  ok('carrying her claim: Ilvane stands beside the others', r && r.ok && stand.join() === 'regency,ilvane,osric,corisande', stand.join());
  ok('the Sealed Ledger is still held', st.world.dossier.proof.forbidden_hoard.held);
  const t = C.mootTally(st), v = s => t.seats.find(x => x.seat === s).vote;
  ok('seats: Lords Regency, Syndicate Regency, Synod Ilvane, Hearthwatch Corisande', v('lords') === 'regency' && v('syndicate') === 'regency' && v('synod') === 'ilvane' && v('hearthwatch') === 'corisande', t.seats.map(s => s.seat + ':' + s.vote).join());
  ok('default count: the Regency wins 5 to 2', t.winner === 'regency' && t.counts.regency === 5 && t.counts.ilvane === 2);
  C.moot(st).canvass.lords = { how: 'persuade', for: 'ilvane', day: 1 };
  const t2 = C.mootTally(st);
  ok('swaying the Lords one step gives Ilvane 5 and the Moot', t2.winner === 'ilvane' && t2.counts.ilvane === 5, JSON.stringify(t2.counts));
  C.moot(st).canvass.syndicate = { how: 'persuade', for: 'ilvane', day: 1 };
  ok('the Syndicate never backs Ilvane, even swayed', C.mootTally(st).seats.find(x => x.seat === 'syndicate').vote !== 'ilvane'); }
{ const { st } = ilvaneGame(); at(st, 'crown_keep'); C.mootOpen(st); const r = C.mootTestify(st, 'forbidden_hoard');
  ok('laying the Sealed Ledger ends her claim and the Synod abstains', r.ok && !C.mootStanding(st).includes('ilvane') && C.mootTally(st).seats.find(x => x.seat === 'synod').how === 'abstain'); }
{ const { st } = ilvaneGame(); st.world.flags.exposed_forbidden_hoard = 1;
  ok('exposing the Sealed Ledger anywhere ends her claim too', !C.mootStanding(st).includes('ilvane')); }
{ const { st } = ilvaneGame(); C.gainLeverage(st, 'lev_ilvane', 'test'); C.moot(st).canvass.synod = { how: 'pressure', for: 'regency', day: 1 };
  ok('leverage on Ilvane can turn her own seat', C.mootTally(st).seats.find(x => x.seat === 'synod').vote === 'regency'); }
{ const { st } = ilvaneGame(); C.moot(st).canvass.lords = { how: 'persuade', for: 'ilvane', day: 1 }; at(st, 'crown_keep');
  C.mootOpen(st); C.mootDeclare(st, 'ilvane'); const r = C.mootResolve(st);
  ok('declaring for Ilvane and winning', r.ok && r.outcome === 'ilvane' && r.kingmaker, JSON.stringify(r).slice(0, 200));
  const ov = st.factions.rivalryOverrides;
  ok('Ilvane outcome: Crown/Synod Open; Synod/Hearthwatch, Syndicate/Synod and Synod/Banner Opposed',
    ov[sorted('crown', 'synod')] === 'open' && ov[sorted('synod', 'hearthwatch')] === 'opposed' && ov[sorted('syndicate', 'synod')] === 'opposed' && ov[sorted('synod', 'broken_banner')] === 'opposed');
  ok('the ruler is the Archon-Regent', C.realmTitle(st) === 'the Archon-Regent');
  ok('Thorne is Lord Inquisitor, hedge-mages are hunted, Corisande flees', !!(st.world.flags.thorne_lord_inquisitor && st.world.flags.hedge_hunt && st.world.flags.corisande_fled));
  const ho = C.holdOffers(st).map(o => o.id);
  ok('the hold offers are three places near Vol\'Dun', ho.join() === 'sunwheel_chapel,pale_vigil,orchard_row' && ho.every(id => C.NODES[id].area === 'voldun'));
  ok('the hold is granted, backed by the Synod', C.grantHold(st, 'pale_vigil').ok && st.world.hold.backer === 'synod');
  ok('Crown rank titles are not renamed to King\'s or Queen\'s', !C.REALM.ilvane.titles && !C.REALM.ledger.titles); }

// ---- after the Moot ----
ok('both outcomes have after-Moot lines and a Voss line', ['ledger', 'ilvane'].every(k => C.AFTER_MOOT[k] && C.AFTER_MOOT[k].line && C.AFTER_MOOT[k].board && C.AFTER_MOOT[k].talk.length));
ok('both outcomes have a dossier line', !!(C.LORE.moot_ledger && C.LORE.moot_ilvane));

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
