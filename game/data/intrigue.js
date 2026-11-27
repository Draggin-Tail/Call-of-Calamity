/* Intrigue, part 1: the Succession Moot (design/succession_moot.md, moot_script.md, intrigue_followups.md).
   Pure rules, no screens. Load after campaign.js (needs GAME_DATA.factions, GAME_SAVE and GAME_CAMPAIGN).
   Everything is kept in the save: st.world.moot (this Moot), st.world.realm (the outcome), st.world.hold (the Kingmaker's hold),
   st.world.leverage (personal secrets, spent once), st.factions.rivalryOverrides (the new rivalry table).
   Nothing runs on a clock: the Moot is called by what the player does and opens only when the player chooses. */
(function () {
  // Loaded from factions.js, possibly before campaign.js has run: wait until the campaign exists (by DOMContentLoaded at the latest).
  function init() {
  if (window.GAME_INTRIGUE || !window.GAME_CAMPAIGN || !window.GAME_SAVE) return;
  window.GAME_INTRIGUE = true;
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE, D = window.GAME_DATA, F = D.factions;

  // ---- the Aldermere Crown: Osric's breakaway faction after a Broken Moot (or Aldermere's new owner under Queen Corisande) ----
  if (!F.aldermere) {
    F.aldermere = { name: 'Aldermere Crown', race: 'human', region: 'crownlands', color: '#8c6a2f', active: false, relations: { crown: -0.5 },
      desc: 'Lord Osric\'s breakaway crown, held by the lords who would not accept the Moot.' };
    if (F.crown) F.crown.relations.aldermere = -0.5;
  }

  // ---- the Lost Prince: a fourth secret (Broken Banner), proved by the Naming Ring, hunted by Crown agents ----
  const L = (id, f, kind, depth, text, o) => { C.LORE[id] = Object.assign({ id, faction: f, kind, depth, text }, o || {}); };
  L('s_prince_r1', 'broken_banner', 'secret', 0, 'A Banner boy has the old king\'s eyes, they say, and laughs the way he did. Old soldiers go quiet when he rides past.', { sid: 'lost_prince', stage: 1, truth: true, follow: { visit: 'whitestone_abbey' } });   // the page itself comes from Mother Agathe (intrigue_cast.js)
  L('s_prince_e', 'broken_banner', 'secret', 0, 'A page is torn from the abbey register, from the year the prince fell. The stub still shows part of a name: Fenn.', { sid: 'lost_prince', stage: 2, truth: true });
  L('s_prince_p', 'broken_banner', 'secret', 0, 'The Naming Ring: the prince\'s own ring, left to his son. The boy is Wil Fenn, a Banner rider who thinks it is tin.', { sid: 'lost_prince', stage: 3, truth: true });
  if (C.LORE.s_succ_r2) C.LORE.s_succ_r2.falseText = 'The abbey holds keepers, sick folk and a very old dog. Nobody is waiting for anything. But one page of its register has been torn out, from the year the prince fell.';
  C.SECRETS.lost_prince = { faction: 'crown', name: 'The Lost Prince', proof: 's_prince_p', rival: 'broken_banner', hunt: 'Crown agents', squad: C.SECRETS.succession.squad };
  // what the dossier says once the realm has chosen
  L('moot_regency', 'crown', 'view', 0, 'The Moot kept the Steward. The boards call it the Long Regency: nothing changed, which was the point.');
  L('moot_osric', 'crown', 'view', 0, 'The Moot crowned Lord Osric of Aldermere. The Synod will raise its Ward, and the roads get more patrols.');
  L('moot_corisande', 'crown', 'view', 0, 'The Moot crowned Lady Corisande Hale. Aldermere closed its gates the same night.');
  L('moot_wil', 'crown', 'view', 0, 'The Moot crowned Wil Fenn, the prince\'s son. His first order was that everyone go home and eat something.');
  L('moot_broken', 'crown', 'view', 0, 'The Moot found no majority. Osric walked out with half the Lords and calls Aldermere a crown of its own.');

  // ---- data ----
  C.MOOT = {
    claimants: {
      regency: { name: 'The Regency', who: 'Steward Edric Harrow', backer: 'crown' },
      osric: { name: 'Lord Osric of Aldermere', who: 'Lord Osric', backer: 'crown' },
      corisande: { name: 'Lady Corisande Hale', who: 'Lady Corisande', backer: 'hearthwatch' },
      wil: { name: 'Wil Fenn', who: 'Wil Fenn', backer: 'broken_banner' }
    },
    // seat order is the order they declare in
    seats: {
      lords: { name: 'The Lords', faction: 'crown', votes: 3, prefs: ['regency', 'osric', 'corisande', 'wil'], speaker: 'Lord Marshal Voss', job: 'oath_roll', leverage: 'lev_voss' },
      syndicate: { name: 'The Syndicate', faction: 'syndicate', votes: 2, prefs: ['regency', 'osric', 'corisande'], cranePrefs: ['osric', 'corisande', 'regency'], speaker: 'Factor Crane', job: 'bad_paper', leverage: 'lev_crane' },
      synod: { name: 'The Synod', faction: 'synod', votes: 2, prefs: ['osric', 'regency', 'corisande'], speaker: 'Archon Ilvane', job: 'writ_of_wards', leverage: 'lev_ilvane' },
      hearthwatch: { name: 'The Hearthwatch', faction: 'hearthwatch', votes: 1, prefs: ['corisande', 'wil', 'regency', 'osric'], speaker: 'Mother Agathe', job: 'bread_for_moot', leverage: 'lev_agathe' },
      banner: { name: 'The Broken Banner', faction: 'broken_banner', votes: 2, prefs: ['wil', 'corisande'], seatedOnly: true, speaker: 'Captain Old Standard', job: 'old_standards_price', leverage: 'lev_old_standard' }
    },
    // proofs that can be laid before the Moot (sid -> what it does, for the sheet)
    testimony: { succession: 'The Lords strike the Regency.', hidden_hand: 'The Regency is struck; the Syndicate abstains; the Lords move Osric down.', forbidden_hoard: 'The Synod abstains.', lost_prince: 'Wil Fenn may stand, and the Banner is seated.' },
    // the Kingmaker's hold: three places offered by each new ruler
    holds: { regency: ['dunmere_keep', 'applecourt', 'ploughmans_ford'], osric: ['marchwardens_post', 'greywatch_post', 'heralds_cross'],
      corisande: ['heralds_cross', 'sheepfold', 'wheatvale'], wil: ['widows_barrow', 'heron_hide', 'dunmere_keep'] },
    calls: { writ: 'The Heir\'s Writ has been read aloud. The Lords can no longer pretend the throne is a mystery.', petition: 'As Lord\'s Hand, you have asked Harrow to ring the bell and end the Interval. He cannot refuse the Hand.',
      wil: 'The Banner has ridden to Crown Keep with the prince\'s son, and will not leave until the Lords hear him.', second: 'The Lords have learned that the Steward was the Hidden Hand. They call the Moot again.' },
    hallBacking: 3, pressureCost: 60, loserCost: 80, pledgeCost: 40, holdShopMult: 0.85
  };
  // what each outcome does to the realm. Rivalry ratings: open / uneasy / opposed (S.rivalry reads st.factions.rivalryOverrides).
  const KING = ['King\'s Sword', 'King\'s Knight', 'Banneret', 'King\'s Hand'], QUEEN = ['Queen\'s Sword', 'Queen\'s Knight', 'Banneret', 'Queen\'s Hand'];
  C.REALM = {
    regency: { ruler: 'Steward Harrow', rivalry: { 'crown|syndicate': 'open' }, owners: {} },
    osric: { ruler: 'King Osric', titles: KING, rivalry: { 'crown|syndicate': 'open', 'crown|synod': 'open', 'synod|hearthwatch': 'opposed', 'crown|broken_banner': 'opposed' }, owners: {}, flags: ['corisande_fled', 'wil_hiding'] },
    corisande: { ruler: 'Queen Corisande', titles: QUEEN, rivalry: { 'crown|syndicate': 'opposed', 'crown|broken_banner': 'uneasy', 'crown|hearthwatch': 'open', 'aldermere|crown': 'opposed' }, owners: { aldermere_hold: 'aldermere' }, flags: ['osric_sulks'] },
    wil: { ruler: 'King Wil', titles: KING, rivalry: { 'crown|broken_banner': 'open', 'crown|synod': 'opposed', 'crown|syndicate': 'uneasy' }, owners: { outlaws_rest: 'crown' }, flags: ['old_standard_marshal'] },
    broken: { ruler: 'nobody', rivalry: { 'aldermere|crown': 'opposed' }, owners: { aldermere_hold: 'aldermere', heralds_cross: 'aldermere', oath_cairn: 'aldermere', applecourt: 'aldermere' }, flags: ['aldermere_crown'] }
  };
  const REL = { open: 0.2, uneasy: -0.15, opposed: -0.5 };
  // leverage: one personal secret per figure, not hunted, spent once (found through the cast's Moves; see intrigue_cast.md)
  C.LEVERAGE = {
    lev_voss: { who: 'Lord Marshal Voss', name: 'The Rearguard', seat: 'lords', text: 'Voss never sent the signal to fall back at Marrow Ford, and left the Banner\'s rearguard to die. If the Lords knew, they would stop listening to him.' },
    lev_crane: { who: 'Factor Crane', name: 'The Skim', seat: 'syndicate', text: 'Crane has been skimming the Grain Exchange for years, a little off every barge. The Syndicate does not forgive its own thieves.' },
    lev_ilvane: { who: 'Archon Ilvane', name: 'The Old Name', seat: 'synod', text: 'The Archon was a hedge-witch once, a girl the Hearthwatch hid from the inquisitors. Now she leads them. The Synod would not survive the story.' },
    lev_agathe: { who: 'Mother Agathe', name: 'The False Graves', seat: 'hearthwatch', text: 'Agathe faked the deaths of mages the Synod was hunting, and buried empty coffins under their names. The Synod would burn Whitestone for it.' },
    lev_old_standard: { who: 'Captain Old Standard', name: 'The Long Lie', seat: 'banner', text: 'Old Standard has known whose son Wil is for eighteen years, and lied about it to his own men every winter. They would not forgive the lie.' },
    lev_osric: { who: 'Lord Osric', name: 'Bad Notes', seat: null, text: 'Osric owes the Second Book more than any lord alive. His spears are paid for with money he cannot repay.' },
    lev_corisande: { who: 'Lady Corisande', name: 'The Sister', seat: null, text: 'Lady Corisande hides a hedge-mage sister, Brielle. One word to the Synod and her sister is taken.' },
    lev_thorne: { who: 'Inquisitor-Captain Thorne', name: 'The Unsent Letter', seat: null, text: 'Thorne wrote down his doubts about the prisoner transfers to Vol\'Dun, and never sent the letter. An inquisitor who doubts is an inquisitor the Synod removes.' }
  };

  // ---- state ----
  const fl = st => st.world.flags;
  const M = st => st.world.moot || (st.world.moot = { n: 0, called: null, by: null, open: false, canvass: {}, seated: { banner: false }, testimony: [], declared: null, result: null, hall: null, tally: null, holdOffers: null });
  C.moot = st => M(st);
  const dosProof = (st, sid) => st.world.dossier && st.world.dossier.proof && st.world.dossier.proof[sid];
  const holds = (st, sid) => { const p = dosProof(st, sid); return !!(p && p.held); };
  const levOf = st => st.world.leverage || (st.world.leverage = {});
  C.gainLeverage = function (st, id, src) { const l = levOf(st); if (!C.LEVERAGE[id] || l[id]) return { ok: false }; l[id] = { got: st.world.day, spent: null, src: src || 'Learned' }; return { ok: true, leverage: C.LEVERAGE[id] }; };
  C.leverageHeld = (st, id) => !!(levOf(st)[id] && !levOf(st)[id].spent);
  C.leverageList = st => Object.entries(levOf(st)).filter(([, v]) => !v.spent).map(([id, v]) => Object.assign({ id }, C.LEVERAGE[id], v));
  const spendLev = (st, id, how) => { levOf(st)[id].spent = how; };
  const handExposed = st => !!(fl(st).exposed_hidden_hand || M(st).testimony.includes('hidden_hand'));
  const isOpen = st => { const m = M(st); return m.called !== null && !m.result; };

  // ---- who is standing ----
  C.mootStanding = function (st) {
    const f = fl(st), out = [];
    if (!handExposed(st)) out.push('regency');                    // once the Steward is known to be the Hand, the Regency is finished
    out.push('osric');
    if (!f.corisande_withdrawn) out.push('corisande');
    if (f.wil_proclaimed) out.push('wil');
    return out;
  };
  function seatPrefs(st, seat) {
    const s = C.MOOT.seats[seat], f = fl(st), m = M(st), stand = C.mootStanding(st);
    let p = (seat === 'syndicate' && f.crane_hand ? s.cranePrefs : s.prefs).filter(c => stand.includes(c));
    if (seat === 'lords' && (f.exposed_succession || m.testimony.includes('succession'))) p = p.filter(c => c !== 'regency');
    if (seat === 'lords' && handExposed(st)) { const i = p.indexOf('osric'); if (i >= 0 && i < p.length - 1) { p.splice(i, 1); p.splice(i + 1, 0, 'osric'); } }
    return p;
  }
  function abstains(st, seat) {
    const m = M(st), f = fl(st);
    if (seat === 'syndicate' && handExposed(st) && !f.crane_hand) return true;
    if (seat === 'synod' && (m.testimony.includes('forbidden_hoard') || f.exposed_forbidden_hoard)) return true;
    return false;
  }
  // Pure: the current state of the vote. Canvassing moves a seat one step toward your claimant (if it lies further down its list); pressure takes it outright.
  C.mootTally = function (st) {
    const m = M(st), seats = [], counts = {}; let total = 0; const stand = C.mootStanding(st);
    for (const [id, s] of Object.entries(C.MOOT.seats)) {
      if (s.seatedOnly && !m.seated.banner) continue;
      total += s.votes; const cv = m.canvass[id], prefs = seatPrefs(st, id); let vote = null, how = 'free';
      if (cv && cv.how === 'pressure' && stand.includes(cv.for)) { vote = cv.for; how = 'pressured'; }
      else if (abstains(st, id)) how = 'abstain';
      else { vote = prefs[0] || null; if (!vote) how = 'abstain'; else if (cv && prefs.indexOf(cv.for) > 0) { vote = prefs[1]; how = 'swayed'; } }
      if (vote) counts[vote] = (counts[vote] || 0) + s.votes;
      seats.push({ seat: id, name: s.name, faction: s.faction, votes: s.votes, vote, how });
    }
    const need = Math.floor(total / 2) + 1, top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { seats, counts, total, need, winner: top.length && top[0][1] >= need ? top[0][0] : null, standing: stand };
  };

  // ---- calling the Moot (no clock: any of these, whenever it happens) ----
  C.mootCallReasons = function (st) {
    const f = fl(st), r = [], rl = st.world.realm;
    if (rl) { if (rl.outcome === 'regency' && f.exposed_hidden_hand && !f.second_moot) r.push('second'); return r; }
    if (f.exposed_succession) r.push('writ');
    const cr = S.getRank(st, 'crown'); if (cr && cr.rank >= 4) r.push('petition');
    if (f.wil_proclaimed) r.push('wil');
    return r;
  };
  C.mootCall = function (st, by) {
    if (!C.mootCallReasons(st).includes(by)) return { ok: false, reason: 'Nothing calls the Moot yet' };
    if (by !== 'second' && M(st).called !== null) return { ok: false, reason: 'The Moot is already called' };
    if (by === 'petition' && st.world.location !== 'crown_keep') return { ok: false, reason: 'Petition the Steward at Crown Keep' };
    if (by === 'second') { const n = M(st).n + 1; st.world.moot = null; M(st).n = n; fl(st).second_moot = st.world.day; }
    const m = M(st); m.called = st.world.day; m.by = by;
    if (by === 'wil') m.seated.banner = true;
    if (C.DUNGEONS && C.DUNGEONS.oathstone_crypt && C.reveal) C.reveal(st, 'oathstone_crypt');   // the Lords' canvass job goes there
    return { ok: true, by, text: C.MOOT.calls[by] + ' A notice goes up on every board: the Moot will sit at Crown Keep.' };
  };
  // Called on arrival anywhere: the automatic calls (the petition is the player's own act).
  C.mootCheck = function (st) {
    const r = C.mootCallReasons(st).filter(x => !(C.MOOT.manualCalls || ['petition']).includes(x));   // the player's own acts are not automatic
    if (r.includes('second')) return C.mootCall(st, 'second');
    if (r.length && M(st).called === null) return C.mootCall(st, r[0]);
    return null;
  };
  C.mootState = function (st) {
    const m = M(st); return { called: m.called !== null, by: m.by, open: m.open, resolved: !!m.result, result: m.result, second: m.n > 0, hall: m.hall, declared: m.declared,
      canvass: Object.assign({}, m.canvass), seatedBanner: m.seated.banner, testimony: m.testimony.slice(), tally: C.mootTally(st) };
  };

  // ---- the Banner's seat ----
  C.bannerSeatOptions = function (st) {
    const cr = S.getRank(st, 'crown'), gw = S.goodwillTier ? S.goodwillTier(st).id : 'wary', f = fl(st);
    return [{ id: 'crown', label: 'A safe-conduct under your Crown rank', ok: !!(cr && cr.rank >= 3) && !f.voss_unseated, why: 'Needs Crown rank 3 (Banneret).' },
      { id: 'hearthwatch', label: 'The Hearthwatch escort them under sanctuary', ok: gw === 'trusted' && !f.voss_unseated, why: 'Needs the Hearthwatch to trust you.' }];
  };
  C.seatBanner = function (st, how) {
    const m = M(st); if (!isOpen(st) || m.open) return { ok: false, reason: 'Only while the Moot is called and before it opens' };
    if (m.seated.banner) return { ok: false, reason: 'Already seated' };
    const o = C.bannerSeatOptions(st).find(x => x.id === how); if (!o || !o.ok) return { ok: false, reason: o ? o.why : 'Unknown way' };
    m.seated.banner = true; return { ok: true };
  };

  // ---- canvassing: each seat can be swayed once, before the Moot opens ----
  const proofForSeat = (st, seat) => Object.keys(C.SECRETS).find(sid => sid !== 'lost_prince' && C.SECRETS[sid].faction === C.MOOT.seats[seat].faction && holds(st, sid)) || null;
  C.canvassOptions = function (st, seat) {
    const s = C.MOOT.seats[seat]; if (!s) return [];
    const f = s.faction, r = S.getRank(st, f), tier = f === 'hearthwatch' ? null : S.standingTier(st, f).id;
    const friendly = f === 'hearthwatch' ? (S.goodwillTier ? S.goodwillTier(st).id !== 'wary' : false) : (tier === 'friendly' || tier === 'allied' || !!r);
    const proof = proofForSeat(st, seat), lev = C.leverageHeld(st, s.leverage);
    return [{ id: 'persuade', label: 'Persuade', ok: friendly, why: f === 'hearthwatch' ? 'The Hearthwatch need to know you first.' : 'Needs Friendly standing or a rank.' },
      { id: 'pressure', label: 'Pressure', ok: !!(proof || lev), why: 'Needs proof against them, or leverage on ' + s.speaker + '.', proof, leverage: lev ? s.leverage : null },
      { id: 'bargain', label: 'Bargain', ok: !!C.jobDone(st, s.job), why: 'Finish ' + ((C.JOBS[s.job] || {}).name || 'their job') + ' first.', job: s.job }];
  };
  C.canvass = function (st, seat, how, claimant, opts) {
    opts = opts || {}; const m = M(st), s = C.MOOT.seats[seat];
    if (!s) return { ok: false, reason: 'Unknown seat' };
    if (!isOpen(st) || m.open) return { ok: false, reason: m.open ? 'The Moot is already sitting' : 'The Moot has not been called' };
    if (m.canvass[seat]) return { ok: false, reason: s.name + ' have already been canvassed' };
    if (!C.mootStanding(st).includes(claimant)) return { ok: false, reason: 'That claimant is not standing' };
    const o = C.canvassOptions(st, seat).find(x => x.id === how); if (!o) return { ok: false, reason: 'Unknown way' }; if (!o.ok) return { ok: false, reason: o.why };
    const f = s.faction, changes = []; let spent = null;
    if (how === 'pressure') {
      const useProof = o.proof && (opts.use !== 'leverage' || !o.leverage);
      if (useProof) { const p = dosProof(st, o.proof); p.held = false; p.used = 'pressure'; spent = { proof: o.proof }; } else { spendLev(st, o.leverage, 'pressure'); spent = { leverage: o.leverage }; }
      if (f === 'hearthwatch') S.changeGoodwill(st, -15, 'pressured at the Moot');
      else { changes.push(...S.changeStanding(st, f, -C.MOOT.pressureCost, { reason: 'pressured at the Moot', ripple: false })); fl(st)['bounty_' + f] = st.world.day; }
    }
    m.canvass[seat] = { how, for: claimant, day: st.world.day }; m.backing = claimant;
    return { ok: true, seat, how, claimant, changes, spent, tally: C.mootTally(st) };
  };

  // ---- the Moot itself: open, testimony, declarations, resolution ----
  C.mootOpen = function (st) {
    const m = M(st); if (!isOpen(st)) return { ok: false, reason: 'The Moot has not been called' }; if (m.open) return { ok: false, reason: 'Already sitting' };
    if (st.world.location !== 'crown_keep') return { ok: false, reason: 'The Moot sits at Crown Keep' };
    m.open = st.world.day; return { ok: true, standing: C.mootStanding(st) };
  };
  C.mootTestimonyOptions = st => Object.keys(C.MOOT.testimony).filter(sid => holds(st, sid) && !(sid === 'hidden_hand' && fl(st).crane_hand)).map(sid => ({ sid, text: C.MOOT.testimony[sid], ok: sid !== 'lost_prince' || !!fl(st).wil_consents }));
  C.mootTestify = function (st, sid) {
    const m = M(st); if (!m.open || m.declared) return { ok: false, reason: 'Testimony is heard once the Moot sits, before the declarations' };
    if (!holds(st, sid)) return { ok: false, reason: 'You do not carry that' };
    if (sid === 'lost_prince' && !fl(st).wil_consents) return { ok: false, reason: 'Wil will not let you. Not yet.', refused: true };
    const p = dosProof(st, sid); p.held = false; p.used = 'testimony'; m.testimony.push(sid);
    if (sid === 'lost_prince') { fl(st).wil_proclaimed = st.world.day; m.seated.banner = true; }
    return { ok: true, sid, tally: C.mootTally(st) };
  };
  C.mootDeclare = function (st, claimant) {
    const m = M(st); if (!m.open) return { ok: false, reason: 'The Moot is not sitting' }; if (m.declared) return { ok: false, reason: 'You have declared' };
    if (!C.mootStanding(st).includes(claimant)) return { ok: false, reason: 'That claimant is not standing' };
    m.declared = claimant; return { ok: true };
  };
  C.mootResolve = function (st) {
    const m = M(st); if (!m.declared) return { ok: false, reason: 'Declare first' }; if (m.result || m.hall) return { ok: false, reason: 'Already counted' };
    const t = C.mootTally(st), f = fl(st), changes = []; m.tally = t;
    if (f.pledged_regency && m.declared !== 'regency') changes.push(...S.changeStanding(st, 'crown', -C.MOOT.pledgeCost, { reason: 'broke a promise to the Steward', ripple: false }));
    if (t.winner && t.winner !== 'osric' && (t.counts.osric || 0) >= C.MOOT.hallBacking && !f.armoury_burned) {
      m.hall = { pending: true, winner: t.winner }; return { ok: true, tally: t, hall: true, changes };
    }
    const fin = finish(st, t.winner || 'broken'); return Object.assign({ ok: true, tally: t, hall: false }, fin, { changes: changes.concat(fin.changes) });
  };
  // The Hall of Oaths: Osric's men try to take the hall. side: defend | coup (only if you declared for him). won: result of the fight.
  C.mootHall = function (st, side, won) {
    const m = M(st); if (!m.hall || !m.hall.pending) return { ok: false, reason: 'Nothing is happening in the hall' };
    if (side === 'coup' && m.declared !== 'osric') return { ok: false, reason: 'Only Osric\'s backers join his men' };
    if (side !== 'coup' && side !== 'defend') return { ok: false, reason: 'Pick a side' };
    m.hall.pending = false; m.hall.side = side; m.hall.won = !!won;
    if (side === 'defend') return Object.assign({ ok: true }, finish(st, won ? m.hall.winner : 'osric', { force: !won }));
    return Object.assign({ ok: true }, finish(st, won ? 'osric' : m.hall.winner, { force: won, outlaw: !won }));
  };
  function finish(st, outcome, o) {
    o = o || {}; const m = M(st), f = fl(st), changes = []; C.applyRealm(st, outcome); m.result = outcome; m.forced = !!o.force;
    const out = { outcome, kingmaker: false, outlawed: false, changes };
    if (o.outlaw) { changes.push(...S.changeStanding(st, 'crown', -2000, { reason: 'took arms in the Hall of Oaths', ripple: false })); f.bounty_crown = st.world.day; out.outlawed = true; }
    else if (outcome !== 'broken' && m.declared === outcome) {
      f.kingmaker = st.world.day; out.kingmaker = true; m.holdOffers = C.MOOT.holds[outcome].slice();
      const b = C.MOOT.claimants[outcome].backer, r = S.getRank(st, b);
      if (b === 'hearthwatch') S.changeGoodwill(st, 20, 'the Kingmaker');
      else if (r) { const p = S.promote(st, b, { force: true }); if (!p.ok) changes.push(...S.changeStanding(st, b, 150, { reason: 'the Kingmaker', ripple: false })); else out.promoted = p.rank; }
      else changes.push(...S.changeStanding(st, b, 150, { reason: 'the Kingmaker', ripple: false }));
    } else if (outcome !== 'broken') {
      const backers = new Set((m.tally ? m.tally.seats : []).filter(s => s.vote === outcome).map(s => s.faction));
      backers.forEach(fac => { if (fac === 'hearthwatch') S.changeGoodwill(st, -10, 'backed the loser'); else changes.push(...S.changeStanding(st, fac, -C.MOOT.loserCost, { reason: 'you stood against them at the Moot', ripple: false })); });
    }
    return out;
  }
  C.applyRealm = function (st, outcome) {
    const R = C.REALM[outcome]; if (!R) return { ok: false };
    st.factions.rivalryOverrides = st.factions.rivalryOverrides || {};
    for (const [k, v] of Object.entries(R.rivalry)) { const [a, b] = k.split('|'); st.factions.rivalryOverrides[[a, b].sort().join('|')] = v; S.setRelation(st, a, b, REL[v], { both: true }); }
    for (const [id, own] of Object.entries(R.owners)) (st.world.nodes[id] = st.world.nodes[id] || {}).owner = own;
    (R.flags || []).forEach(x => { fl(st)[x] = st.world.day; });
    st.world.realm = { outcome, ruler: R.ruler, day: st.world.day };
    if (C.learn) C.learn(st, 'moot_' + outcome, 'The Moot at Crown Keep');
    return { ok: true };
  };
  C.realmTitle = st => { const r = st.world.realm; return r ? C.REALM[r.outcome].ruler : null; };
  // rank titles follow the new ruler (King's Knight, Queen's Hand)
  { const gr0 = S.getRank; S.getRank = function (st, f) { const r = gr0(st, f), rl = st && st.world && st.world.realm, t = rl && f === 'crown' && C.REALM[rl.outcome].titles; if (r && t) r.title = t[r.rank - 1]; return r; }; }

  // ---- proving Wil: the Naming Ring cannot be exposed or sold, only proclaimed (with Wil's consent) or burned ----
  { const pa0 = C.proofActions, up0 = C.useProof;
    C.proofActions = function (st, sid) {
      if (sid !== 'lost_prince') return pa0(st, sid);
      if (!holds(st, sid)) return []; const consent = !!fl(st).wil_consents, at = st.world.location === 'crown_keep';
      return [{ id: 'proclaim', label: 'Proclaim Wil Fenn before the lords', ok: consent && at && !st.world.realm, why: consent ? 'Do it at Crown Keep.' : 'Wil has not agreed to stand.' }, { id: 'destroy', label: 'Burn it', ok: true }];
    };
    C.useProof = function (st, sid, how) {
      if (sid !== 'lost_prince') { const r = up0(st, sid, how); if (r && r.ok) { if (how === 'expose') fl(st)['exposed_' + sid] = fl(st)['exposed_' + sid] || true; r.moot = C.mootCheck(st); } return r; }
      const o = C.proofActions(st, sid).find(x => x.id === how); if (!o || !o.ok) return { ok: false, reason: o ? o.why : 'You cannot do that here' };
      const p = dosProof(st, sid); p.held = false; p.used = how;
      if (how === 'destroy') return { ok: true, how, text: 'The ring goes into the river. Wil will never know, unless someone tells him.', changes: [], gold: 0 };
      fl(st).wil_proclaimed = st.world.day; const call = C.mootCall(st, 'wil'); if (!call.ok && isOpen(st)) M(st).seated.banner = true;
      return { ok: true, how, text: 'Wil holds up his hand in the courtyard of Crown Keep. Old Standard says, loud enough for everyone: "That is the prince\'s ring." Nobody laughs.', moot: call, changes: [], gold: 0 };
    };
  }

  // ---- the Kingmaker's hold ----
  C.holdOffers = st => (!st.world.hold && M(st).holdOffers) ? M(st).holdOffers.map(id => ({ id, name: C.NODES[id].name })) : [];
  C.grantHold = function (st, id) {
    if (st.world.hold) return { ok: false, reason: 'You already have a hold' };
    if (!C.holdOffers(st).some(o => o.id === id)) return { ok: false, reason: 'That place was not offered' };
    const from = C.ownerOf(st, id), backer = C.MOOT.claimants[st.world.realm.outcome].backer;
    st.world.hold = { node: id, granted: st.world.day, from, backer, stash: {}, safe: null, lost: null, takenBy: null, appealed: false, reclaim: null, siege: null };
    (st.world.nodes[id] = st.world.nodes[id] || {}).owner = 'player'; fl(st).kingmaker_hold = id;
    return { ok: true, name: C.NODES[id].name + ', the Kingmaker\'s Hold' };
  };
  C.holdName = (st, id) => { const h = st.world.hold; return h && h.node === id && !h.lost ? C.NODES[id].name + ', the Kingmaker\'s Hold' : null; };
  const atHold = st => { const h = st.world.hold; return !!(h && !h.lost && st.world.location === h.node); };
  C.holdServices = function (st, id) {
    const h = st.world.hold; if (!h || h.lost || h.node !== id) return null;
    const cap = Object.keys(C.NODES).find(k => C.NODES[k].capital === h.backer), stock = (cap && C.NODES[cap].shop) || ['healer_locket', 'traveler_boots', 'steel_dagger'];
    return { rest: true, stash: Object.assign({}, h.stash), recruitFrom: h.backer, shop: { stock: stock.slice(), priceMult: C.MOOT.holdShopMult }, siege: h.siege, reclaim: h.reclaim };
  };
  C.holdStash = function (st, itemId, dir) {
    if (!atHold(st)) return { ok: false, reason: 'You are not at your hold' }; const h = st.world.hold, inv = st.inventory.items;
    const [a, b] = dir === 'in' ? [inv, h.stash] : [h.stash, inv]; if (!a[itemId]) return { ok: false, reason: 'None to move' };
    a[itemId]--; if (!a[itemId]) delete a[itemId]; b[itemId] = (b[itemId] || 0) + 1; return { ok: true };
  };
  // Betrayal: turning Hostile with the backer who granted it brings a herald (checked on arrival).
  C.holdCheck = function (st) {
    const h = st.world.hold; if (!h || h.lost || h.reclaim || h.backer === 'hearthwatch') return null;
    if (S.standingTier(st, h.backer).id === 'hostile') { h.reclaim = st.world.day; return { reclaim: true }; } return null;
  };
  C.holdReclaim = function (st, choice) {
    const h = st.world.hold; if (!h || !h.reclaim) return { ok: false, reason: 'No herald at the gate' };
    if (choice === 'quiet') { h.reclaim = null; loseHold(st, h.from || h.backer); return { ok: true, lost: true }; }
    if (choice === 'refuse') { h.reclaim = null; h.siege = { by: h.backer, day: st.world.day }; return { ok: true, siege: true }; }
    if (choice === 'appeal') {
      if (h.appealed || M(st).declared !== st.world.realm.outcome) return { ok: false, reason: 'The ruler owes you nothing now' };
      h.appealed = true; h.reclaim = null; st.factions.standing[h.backer] = S.RULES.tiers.find(t => t.id === 'neutral').min; return { ok: true, kept: true };
    }
    return { ok: false, reason: 'Unknown choice' };
  };
  C.holdSiege = function (st, by) { const h = st.world.hold; if (!h || h.lost) return { ok: false }; h.siege = { by, day: st.world.day }; return { ok: true }; };
  C.holdSiegeResult = function (st, won) {
    const h = st.world.hold; if (!h || !h.siege) return { ok: false, reason: 'No siege' }; const by = h.siege.by; h.siege = null;
    if (won) { fl(st).siege_won = st.world.day; return { ok: true, kept: true }; } loseHold(st, by); return { ok: true, lost: true };
  };
  function loseHold(st, by) { const h = st.world.hold; h.lost = st.world.day; h.takenBy = by; h.safe = Object.assign({}, h.stash); h.stash = {}; (st.world.nodes[h.node] = st.world.nodes[h.node] || {}).owner = by; }
  C.claimSafe = function (st) {   // the stash is kept at any Hearthwatch house
    const h = st.world.hold; if (!h || !h.safe || !Object.keys(h.safe).length) return { ok: false, reason: 'Nothing is being kept for you' };
    if (C.ownerOf(st, st.world.location) !== 'hearthwatch') return { ok: false, reason: 'Ask at a Hearthwatch house' };
    for (const [k, n] of Object.entries(h.safe)) st.inventory.items[k] = (st.inventory.items[k] || 0) + n; h.safe = null; return { ok: true };
  };
  C.retakeHold = function (st, won) {
    const h = st.world.hold; if (!h || !h.lost) return { ok: false, reason: 'Your hold is not lost' }; if (!won) return { ok: true, kept: false };
    h.lost = null; h.takenBy = null; (st.world.nodes[h.node] = st.world.nodes[h.node] || {}).owner = 'player'; return { ok: true, retaken: true };
  };

  // ---- canvass jobs (one per seat), offered only while the Moot is called and before it is counted ----
  Object.assign(C.CHOICES, {
    bad_paper: { job: 'bad_paper', text: 'Bundles of notes sit in the Exchange\'s back room, tied with the debtors\' names. Osric\'s bundle is the thickest. Dov Quill pretends not to see you.',
      options: [{ id: 'buy', label: 'Buy the notes (320 gold)', gold: -320, jobFlag: 'job_bad_paper' }, { id: 'burn', label: 'Burn them in the clerks\' own stove', standing: { syndicate: -15 }, flag: 'bad_paper_burned', jobFlag: 'job_bad_paper' }] },
    pardon_writ: { job: 'old_standards_price', text: 'The clerks of Crown Keep keep a pardon roll. A name on it needs a seal, and seals cost something.',
      options: [{ id: 'fees', label: 'Pay the sealing fees (160 gold)', gold: -160, jobFlag: 'job_pardon' }, { id: 'favour', label: 'Ask a friend at court to look away', standing: { crown: -20 }, jobFlag: 'job_pardon' }] }
  });
  if (C.NODES.grain_exchange && !C.NODES.grain_exchange.choice) C.NODES.grain_exchange.choice = 'bad_paper';
  if (C.NODES.crown_keep && !C.NODES.crown_keep.choice) C.NODES.crown_keep.choice = 'pardon_writ';
  C.ENCOUNTERS.gq_moot_raiders = { name: 'Raiders at the Moot camp', map: 'hollow_fields', rec: 5, enemyFaction: 'outlaws', once: true, job: 'bread_for_moot', winFlag: 'job_bread_won',
    enemies: [{ primary: 'warrior', name: 'Camp Raider' }, { primary: 'archer', name: 'Raider Bowman' }, { primary: 'rogue', name: 'Cutpurse' }], reward: { xp: 110, gold: 30 } };
  if (C.NODES.muster_field && !C.NODES.muster_field.encounter) C.NODES.muster_field.encounter = 'gq_moot_raiders';
  Object.assign(C.JOBS, {
    oath_roll: { name: 'The Oath Roll', giver: 'crown', at: 'crown_keep', after: null, moot: true,
      offer: 'Lord Marshal Voss taps the table. "Aldermere swore an oath the year the king died. The roll went missing. If it says what I think it says, half the Lords will listen to you."',
      steps: [{ text: 'Recover the roll from the Oathbreakers\' Crypt', clear: 'oathstone_crypt' }], done: 'Osric\'s grandfather swore Aldermere to "the old king and his blood, whoever they be". Voss reads it twice.', reward: { gold: 60 } },
    bad_paper: { name: 'Bad Paper', giver: 'syndicate', at: 'grain_exchange', after: null, moot: true,
      offer: 'Dov Quill, ink to the elbow: "Everyone owes. The question is who is allowed to know. Buy the right notes and the Factor will vote however the notes tell her to."',
      steps: [{ text: 'Deal with the notes at the Grain Exchange', flag: 'job_bad_paper' }], done: 'Dov files the matter under "settled". The Factor will have read it by morning.', reward: { gold: 0 } },
    writ_of_wards: { name: 'The Writ of Wards', giver: 'synod', at: 'voldun', after: null, moot: true,
      offer: 'Archon Ilvane hands you a sealed sheaf. "Carry these terms to your claimant at Crown Keep. Bring back a yes."',
      steps: [{ text: 'Carry the terms to Crown Keep', visit: 'crown_keep' }], done: 'The Archon reads the answer without expression and files it.', reward: { gold: 40 } },
    bread_for_moot: { name: 'Bread for the Moot', giver: 'hearthwatch', at: 'crown_keep', after: null, moot: true,
      offer: 'Mother Agathe looks at the crowds camped outside the walls. "Three thousand people came to watch the realm decide its future. None of them brought dinner."',
      steps: [{ text: 'Buy supplies at the Grain Exchange', visit: 'grain_exchange' }, { text: 'Drive off the raiders at the Muster Field', flag: 'job_bread_won' }], done: '"They will remember who fed them," Agathe says. "People always do, for about a week."', reward: { gold: 20 } },
    old_standards_price: { name: 'Old Standard\'s Price', giver: 'broken_banner', at: 'outlaws_rest', after: null, moot: true,
      offer: 'Old Standard spits into the fire. "A pardon. In writing. With a seal on it I cannot bite through."',
      steps: [{ text: 'Get a sealed pardon at Crown Keep', flag: 'job_pardon' }], done: 'He reads the pardon three times, then folds it into his coat like a letter from home.', reward: { gold: 0 } }
  });
  { const jo0 = C.jobOffers; C.jobOffers = (st, at) => jo0(st, at).filter(j => !j.moot || isOpen(st) && !M(st).open); }

  // ---- hooks: arriving anywhere can call the Moot or bring a herald to your hold; place services show the hold ----
  { const tr0 = C.travel; C.travel = function (st, to) { const r = tr0(st, to); if (r && r.ok) { r.moot = C.mootCheck(st); r.hold = C.holdCheck(st); } return r; }; }
  { const ns0 = C.nodeServices; C.nodeServices = function (st, id) { const sv = ns0(st, id); if (sv) { sv.hold = C.holdServices(st, id); sv.holdName = C.holdName(st, id); } return sv; }; }

  // ---- data checks ----
  C.validateIntrigue = function () {
    const p = [];
    Object.entries(C.MOOT.seats).forEach(([k, s]) => { if (!F[s.faction]) p.push('seat ' + k + ': unknown faction'); if (!C.JOBS[s.job]) p.push('seat ' + k + ': unknown job'); if (!C.LEVERAGE[s.leverage]) p.push('seat ' + k + ': unknown leverage'); s.prefs.concat(s.cranePrefs || []).forEach(c => { if (!C.MOOT.claimants[c]) p.push('seat ' + k + ': unknown claimant ' + c); }); });
    Object.entries(C.MOOT.claimants).forEach(([k, c]) => { if (!F[c.backer]) p.push('claimant ' + k + ': unknown backer'); if (!C.REALM[k]) p.push('claimant ' + k + ': no realm outcome'); if (!C.MOOT.holds[k]) p.push('claimant ' + k + ': no hold offers'); });
    Object.entries(C.MOOT.holds).forEach(([k, l]) => l.forEach(id => { if (!C.NODES[id]) p.push('hold ' + k + ': unknown place ' + id); }));
    Object.entries(C.REALM).forEach(([k, R]) => { Object.keys(R.owners).forEach(id => { if (!C.NODES[id]) p.push('realm ' + k + ': unknown place ' + id); if (!F[R.owners[id]]) p.push('realm ' + k + ': unknown owner'); });
      Object.entries(R.rivalry).forEach(([pair, v]) => { if (!REL[v]) p.push('realm ' + k + ': bad rating ' + v); pair.split('|').forEach(f => { if (!F[f]) p.push('realm ' + k + ': unknown faction ' + f); }); }); if (!C.LORE['moot_' + k]) p.push('realm ' + k + ': no dossier line'); });
    Object.keys(C.MOOT.testimony).forEach(sid => { if (!C.SECRETS[sid]) p.push('testimony: unknown secret ' + sid); });
    ['s_prince_r1', 's_prince_e', 's_prince_p'].forEach(id => { const e = C.LORE[id]; if (e.follow && !C.NODES[e.follow.visit]) p.push(id + ': bad follow-up'); });
    return p;
  };
  (window.GAME_INTRIGUE_HOOKS || []).forEach(f => f());   // files that build on the Moot (intrigue_cast.js) run once it exists
  window.GAME_INTRIGUE_HOOKS = { push: f => f() };
  }
  if (window.GAME_CAMPAIGN && window.GAME_SAVE) init();
  else if (typeof document !== 'undefined' && document.addEventListener) { document.addEventListener('DOMContentLoaded', init); window.addEventListener('load', init); }
})();
