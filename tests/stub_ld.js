// Stand-in loader for running t63 outside the full game. It mirrors the GAME_SAVE / GAME_CAMPAIGN functions intrigue.js calls,
// copied from game/data/gamestate.js and campaign.js. In the real harness use the usual /tmp/ld.js instead (LD=/tmp/ld.js).
const fs = require('fs'), path = require('path');
module.exports = function () {
  const window = {};
  const F = {}; ['crown', 'syndicate', 'synod', 'broken_banner', 'hearthwatch', 'outlaws'].forEach(f => { F[f] = { name: f, relations: {}, active: true }; });
  [['crown', 'syndicate', -0.3], ['crown', 'synod', 0.2], ['syndicate', 'synod', -0.4], ['crown', 'broken_banner', -0.6], ['synod', 'broken_banner', -0.4]].forEach(([a, b, v]) => { F[a].relations[b] = v; F[b].relations[a] = v; });
  window.GAME_DATA = { factions: F };
  // ---- GAME_SAVE (subset, same rules) ----
  const S = {}; const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(+n) ? +n : 0)));
  S.RULES = { standingMin: -1000, standingMax: 1000, tiers: [{ id: 'hostile', min: -1000 }, { id: 'neutral', min: -250 }, { id: 'friendly', min: 250 }, { id: 'allied', min: 600 }], rippleFactor: 0.5, historyCap: 200 };
  S.getStanding = (st, f) => st.factions.standing[f] || 0;
  S.tierOf = n => { let t = S.RULES.tiers[0]; for (const x of S.RULES.tiers) if (n >= x.min) t = x; return t; };
  S.standingTier = (st, f) => S.tierOf(S.getStanding(st, f));
  S.getRelation = (st, a, b) => { const ov = st.factions.relationOverrides, k = a + '>' + b; if (ov && typeof ov[k] === 'number') return ov[k]; return (F[a] && F[a].relations[b]) || 0; };
  S.setRelation = (st, a, b, v, o) => { st.factions.relationOverrides[a + '>' + b] = v; if (o && o.both) st.factions.relationOverrides[b + '>' + a] = v; return v; };
  S.changeStanding = function (st, f, delta, opts) {
    opts = opts || {}; const out = [];
    const apply = (id, d, why, via) => { if (!d) return; const prev = S.getStanding(st, id), next = int(prev + d, -1000, 1000); st.factions.standing[id] = next; if (next - prev) out.push({ faction: id, delta: next - prev, via: via || null }); };
    apply(f, Math.round(delta), opts.reason);
    if (opts.ripple !== false) for (const g of Object.keys(F)) { const rel = g !== f ? S.getRelation(st, f, g) : 0; if (rel) apply(g, Math.round(delta * rel * 0.5), opts.reason, f); }
    return out;
  };
  S.RANK = { factions: ['crown', 'syndicate', 'synod', 'broken_banner'], ladders: { crown: ['Sworn Sword', 'Knight', 'Banneret', "Lord's Hand"], syndicate: ['Runner', 'Agent', 'Factor', 'Partner'], synod: ['Novice', 'Warden', 'Inquisitor', 'Adept of the Inner Circle'], broken_banner: ['Cutpurse', 'Rider', 'Captain', 'Banner-Bearer'] }, standingNeeded: [250, 400, 600, 800] };
  S.RIVALRY = { 'crown|syndicate': 'uneasy', 'crown|synod': 'uneasy', 'broken_banner|crown': 'opposed', 'synod|syndicate': 'opposed', 'broken_banner|syndicate': 'open', 'broken_banner|synod': 'opposed', 'crown|hearthwatch': 'open', 'hearthwatch|syndicate': 'open', 'hearthwatch|synod': 'uneasy', 'broken_banner|hearthwatch': 'open' };
  S.rivalry = (a, b, st) => { const k = [a, b].sort().join('|'), ov = st && st.factions.rivalryOverrides && st.factions.rivalryOverrides[k]; return ov || S.RIVALRY[k] || 'open'; };
  const rk = (st, f) => (st.factions.ranks || {})[f] || null;
  S.getRank = (st, f) => { const r = rk(st, f); return r ? { faction: f, rank: r.rank, title: S.RANK.ladders[f][r.rank - 1], secret: !!r.secret, dormant: !!r.dormant, trust: r.trust || 0 } : null; };
  S.listRanks = st => Object.keys(st.factions.ranks || {}).map(f => S.getRank(st, f));
  S.joinRank = (st, f, o) => { st.factions.ranks[f] = { rank: 1, secret: !!(o && o.secret), dormant: false, suspicion: 0, trust: 0, testDue: false, since: st.world.day }; return { ok: true }; };
  S.promote = (st, f, opts) => { const r = rk(st, f); if (!r) return { ok: false }; if (r.rank >= 4) return { ok: false, reason: 'top' }; r.rank++; return { ok: true, rank: S.getRank(st, f) }; };
  S.SUSPICION = { tiers: [20, 45, 70, 95], gain: { harm: 12, seen: 8, witness: 10, gear: 6, test_fail: 30 }, dayLeak: 0.4, coolPerDay: 3, hearthCoolPerDay: 6, sanctuaryCool: 15, testPass: { reset: 40, standing: 40, trust: 1 }, forcedAt: 100 };
  S.suspicion = (st, f) => { const r = rk(st, f); return r && r.secret ? Math.round(r.suspicion || 0) : 0; };
  S.addSuspicion = (st, f, why, o) => { const r = rk(st, f); if (!r || !r.secret || r.dormant) return { ok: false }; r.suspicion = Math.max(0, Math.min(100, (r.suspicion || 0) + ((o && o.amount !== undefined) ? o.amount : (S.SUSPICION.gain[why] || 0)))); return { ok: true }; };
  S.advanceDay = (st, n) => { st.world.day += n; for (const f of Object.keys(st.factions.ranks)) { const r = rk(st, f); if (r.secret && !r.dormant) r.suspicion = Math.min(100, r.suspicion + 0.4 * n); } return st.world.day; };
  S.GOODWILL = { min: 15, max: 100, tiers: [{ id: 'wary', min: 15 }, { id: 'kindly', min: 30 }, { id: 'trusted', min: 60 }] };
  S.getGoodwill = st => Math.max(15, Math.min(100, Math.round(st.factions.goodwill)));
  S.goodwillTier = st => { const v = S.getGoodwill(st); let t = S.GOODWILL.tiers[0]; for (const x of S.GOODWILL.tiers) if (v >= x.min) t = x; return t; };
  S.changeGoodwill = (st, d) => { st.factions.goodwill = Math.max(15, Math.min(100, S.getGoodwill(st) + d)); return st.factions.goodwill; };
  S.rankCounts = st => { const l = S.listRanks(st); return { total: l.length, public: l.filter(r => !r.secret).length, secret: l.filter(r => r.secret).length }; };
  S.suspicionTier = (st, f) => { const v = S.suspicion(st, f); let t = 0; S.SUSPICION.tiers.forEach((x, i) => { if (v >= x) t = i + 1; }); return t; };
  S.testDue = (st, f) => !!(rk(st, f) && rk(st, f).testDue);
  { const a0 = S.addSuspicion; S.addSuspicion = (st, f, why, o) => { const prev = S.suspicionTier(st, f), r = a0(st, f, why, o); if (r.ok) { const t = S.suspicionTier(st, f), x = rk(st, f); if (t >= 3 && prev < 3 && !x.testDue) x.testDue = true; } return r; }; }
  S.resolveTest = (st, f, passed) => { const r = rk(st, f); if (!r || !r.testDue) return { ok: false }; r.testDue = false; if (passed) { r.suspicion = Math.max(0, r.suspicion - 40); r.trust = (r.trust || 0) + 1; S.changeStanding(st, f, 40, { ripple: false }); return { ok: true, passed: true }; } r.suspicion = Math.min(100, r.suspicion + 30); return { ok: true, passed: false }; };
  S.exposureOptions = (st, f) => { const r = rk(st, f); if (!r || !r.secret) return []; const forced = r.suspicion >= 100, cost = 50 * r.rank + 50; return [{ id: 'bluff', name: 'Bluff or talk it out', available: !forced && ['friendly', 'allied'].includes(S.standingTier(st, f).id) }, { id: 'bargain', name: 'Confess and bargain', available: !forced && st.inventory.gold >= cost, cost }, { id: 'fight', name: 'Fight or flee', available: true }, { id: 'burn', name: 'Burn the bridge', available: true }]; };
  S.resolveExposure = (st, f, choice, opts) => { opts = opts || {}; const r = rk(st, f); if (!r) return { ok: false }; let kept = false, bounty = false; const lose = () => { delete st.factions.ranks[f]; };
    if (choice === 'bluff') { if ((opts.roll === undefined ? 0.5 : opts.roll) < 0.5) { kept = true; r.suspicion = 45; } else lose(); } else if (choice === 'bargain') { st.inventory.gold -= 50 * r.rank + 50; lose(); } else if (choice === 'fight') { if (opts.won) { kept = true; r.suspicion = 50; } else { lose(); bounty = true; } } else lose();
    if (bounty) st.world.flags['bounty_' + f] = st.world.day; return { ok: true, kept, bounty, choice }; };
  S.tickSecrets = (st, days, o) => { for (const f of Object.keys(st.factions.ranks)) { const r = rk(st, f); if (r.secret && !r.dormant) r.suspicion = Math.max(0, r.suspicion + (o && o.cool ? -(o.hearth ? 6 : 3) : 0.4) * days); } };
  S.sanctuary = st => { for (const f of Object.keys(st.factions.ranks)) { const r = rk(st, f); if (r.secret) r.suspicion = Math.max(0, r.suspicion - 15); } return { ok: true }; };
  S.RULES.rosterCap = 8; S.makeUnit = (st, o) => ({ id: 'u' + (st.roster.length + 100), name: o.name, primary: o.primary, level: o.level || 1 });
  window.GAME_SAVE = S;
  // ---- GAME_CAMPAIGN (subset, same shapes) ----
  const C = {};
  const N = (id, o) => { C.NODES[id] = Object.assign({ name: id.replace(/_/g, ' '), links: {} }, o); };
  C.NODES = {};
  N('crown_keep', { type: 'capital', capital: 'crown', owner: 'crown', faction: 'crown', shop: ['iron_sword', 'round_shield', 'chain_hauberk'] }); N('rivermeet', { type: 'town', owner: 'crown' });
  N('grain_exchange', { type: 'market', owner: 'syndicate' }); N('voldun', { type: 'capital', capital: 'synod', owner: 'synod', faction: 'synod' }); N('outlaws_rest', { type: 'poi', owner: 'broken_banner' });
  N('whitestone_abbey', { type: 'poi', owner: 'crown' }); N('muster_field', { type: 'zone', owner: 'crown' }); N('hearthstone_priory', { type: 'castle', owner: 'hearthwatch', faction: 'hearthwatch' });
  ['dunmere_keep', 'applecourt', 'millers_weir', 'marchwardens_post', 'greywatch_post', 'heralds_cross', 'sheepfold', 'wheatvale', 'oath_cairn', 'aldermere_hold'].forEach(id => N(id, { type: 'castle', owner: 'crown' }));
  ['widows_barrow', 'heron_hide'].forEach(id => N(id, { type: 'poi', owner: 'broken_banner' }));
  C.DUNGEONS = { oathstone_crypt: { hidden: true } }; N('oathstone_crypt', { type: 'dungeon', hidden: true });
  C.ownerOf = (st, id) => (st.world.nodes[id] && st.world.nodes[id].owner) || (C.NODES[id] && C.NODES[id].owner) || null;
  C.reveal = (st, id) => { if (st.world.flags['reveal_' + id]) return { ok: false }; st.world.flags['reveal_' + id] = true; return { ok: true }; };
  C.LORE = {}; const L = (id, f, kind, depth, text, o) => { C.LORE[id] = Object.assign({ id, faction: f, kind, depth, text }, o || {}); };
  L('s_succ_r2', 'crown', 'secret', 0, 'They say the old king is alive.', { sid: 'succession', stage: 1, truth: false, follow: { visit: 'whitestone_abbey' }, falseText: 'The abbey holds monks and a very old dog. Nobody is waiting for anything.' });
  L('s_hand_r1', 'syndicate', 'secret', 0, 'A cipher.', { sid: 'hidden_hand', stage: 1, truth: true }); L('s_hand_e', 'syndicate', 'secret', 0, 'A number.', { sid: 'hidden_hand', stage: 2, truth: true }); L('s_hoard_r1', 'synod', 'secret', 0, 'Mages vanish.', { sid: 'forbidden_hoard', stage: 1, truth: true });
  L('s_succ_p', 'crown', 'secret', 0, 'The Heir\'s Writ: no one.', { sid: 'succession', stage: 3, truth: true });
  L('s_hand_p', 'syndicate', 'secret', 0, 'The Second Book: all of it.', { sid: 'hidden_hand', stage: 3, truth: true });
  L('s_hoard_p', 'synod', 'secret', 0, 'The Sealed Ledger: down.', { sid: 'forbidden_hoard', stage: 3, truth: true });
  const sq = [[{ primary: 'warrior' }]];
  C.SECRETS = { succession: { faction: 'crown', name: 'The Empty Throne', proof: 's_succ_p', rival: 'syndicate', squad: sq }, hidden_hand: { faction: 'syndicate', name: 'The Hidden Hand', proof: 's_hand_p', rival: 'crown', squad: sq }, forbidden_hoard: { faction: 'synod', name: 'The Forbidden Hoard', proof: 's_hoard_p', rival: 'crown', squad: sq } };
  const dos = st => { const w = st.world; if (!w.dossier) w.dossier = { got: {}, secrets: {}, resolved: {}, proof: {}, inf: {}, news: [] }; return w.dossier; };
  C.knows = (st, id) => !!dos(st).got[id];
  C.learn = (st, id, src) => { const e = C.LORE[id], d = dos(st); if (!e || d.got[id]) return { ok: false }; d.got[id] = { day: st.world.day, src }; if (e.sid) { d.secrets[e.sid] = Math.max(d.secrets[e.sid] || 0, e.stage); if (e.stage === 3 && !d.proof[e.sid]) d.proof[e.sid] = { since: st.world.day, defended: 0, held: true }; } return { ok: true }; };
  C.proofs = st => Object.entries(dos(st).proof).filter(([, p]) => p.held).map(([k, p]) => Object.assign({ sid: k }, p));
  C.proofActions = (st, sid) => { const p = dos(st).proof[sid]; if (!p || !p.held) return []; const S0 = C.SECRETS[sid], here = C.ownerOf(st, st.world.location); const rival = here && here !== S0.faction && S.getRelation(st, here, S0.faction) < 0; return [{ id: 'expose', ok: !!rival, rival: rival ? here : null }, { id: 'blackmail', ok: here === S0.faction }, { id: 'destroy', ok: true }]; };
  C.useProof = (st, sid, how) => { const p = dos(st).proof[sid], o = C.proofActions(st, sid).find(x => x.id === how); if (!o || !o.ok) return { ok: false }; if (how === 'expose') { S.changeStanding(st, o.rival, 40, { ripple: false }); S.changeStanding(st, C.SECRETS[sid].faction, -80, { ripple: false }); st.world.flags['exposed_' + sid] = true; p.held = false; } else if (how === 'destroy') p.held = false; return { ok: true, how }; };
  C.JOBS = {}; C.CHOICES = {}; C.ENCOUNTERS = {};
  C.jobsOf = st => st.world.jobs || (st.world.jobs = {});
  C.jobDone = (st, id) => { const j = C.jobsOf(st)[id]; return !!(j && j.state === 'done'); };
  C.jobOffers = (st, at) => Object.entries(C.JOBS).filter(([id, j]) => j.at === at && !C.jobsOf(st)[id] && (!j.after || C.jobDone(st, j.after))).map(([id, j]) => Object.assign({ id }, j));
  C.nodeServices = (st, id) => ({ owner: C.ownerOf(st, id), jobOffers: C.jobOffers(st, id) });
  C.travel = (st, to) => { S.advanceDay(st, 1); st.world.location = to; return { ok: true, days: 1, events: [] }; };
  C.EDGES = []; C.NODES.aldermere_hold.pos = [0.502, 0.292]; C.NODES.aldermere_hold.region = 'crownlands'; N('river_cities', { type: 'capital', capital: 'syndicate', owner: 'syndicate', name: 'Gildhaven', region: 'river_cities' });
  Object.values(C.NODES).forEach(n => { n.region = n.region || 'crownlands'; n.pos = n.pos || [0.5, 0.5]; });
  C.discover = (st, id) => { const n = C.NODES[id]; if (n && n.hidden && !st.world.flags['reveal_' + id]) return; (st.world.nodes[id] = st.world.nodes[id] || {}).discovered = true; };
  C.lore = () => {}; C.mapFor = () => 'classic_ridge';
  C.acceptJob = (st, id) => { const j = C.JOBS[id]; if (!j || C.jobsOf(st)[id] || st.world.location !== j.at) return { ok: false }; C.jobsOf(st)[id] = { state: 'active', day: st.world.day, seen: {} }; return { ok: true }; };
  C.reportJob = (st, id) => { const j = C.jobsOf(st)[id]; if (!j) return { ok: false }; j.state = 'done'; return { ok: true }; };
  C.applyChoice = (st, cid, oid) => { const o = C.CHOICES[cid].options.find(x => x.id === oid); if (o.flag) st.world.flags[o.flag] = true; if (o.jobFlag) st.world.flags[o.jobFlag] = true; if (o.gold) st.inventory.gold += o.gold; return { ok: true }; };
  C.informantAct = () => ({ ok: true });
  C.applyEncounterResult = (st, encId, opt, res) => { const E = C.ENCOUNTERS[encId]; if (res.won && E && E.winFlag) st.world.flags[E.winFlag] = true; return { ok: true }; };
  C.proofHunt = st => { const p = C.proofs(st)[0]; if (!p) return null; const enc = { name: 'Ambush', enemies: [{ primary: 'acolyte' }, { primary: 'apprentice' }, { primary: 'squire' }], proofFor: p.sid, enemyFaction: C.SECRETS[p.sid].faction }; st.world.wander = { kind: 'fight', enc }; C.ENCOUNTERS.wander = enc; return st.world.wander; };
  S.canJoin = (st, f) => Object.keys(st.factions.ranks).length >= 3 ? { ok: false } : { ok: true };
  S.markMet = (st, f) => { (st.factions.met = st.factions.met || {})[f] = 1; };
  S.serve = (st, f, amt, o) => S.changeStanding(st, f, amt, o);
  Object.assign(C.NODES.wheatvale, { type: 'village' }); Object.assign(C.NODES.sheepfold, { type: 'hamlet' }); Object.assign(C.NODES.millers_weir, { type: 'hamlet' }); Object.assign(C.NODES.applecourt, { type: 'village' });
  N('millstream', { type: 'village', owner: 'hearthwatch', region: 'crownlands' }); N('canalgate', { type: 'town', owner: 'syndicate', region: 'river_cities' }); N('ledgerhall', { type: 'castle', owner: 'syndicate', region: 'river_cities' });
  N('orchard_row', { type: 'town', owner: 'synod', region: 'voldun' }); N('pale_vigil', { type: 'hamlet', owner: 'synod', region: 'voldun' }); N('wardstone_green', { type: 'village', owner: 'synod', region: 'voldun' });
  N('greywatch_post', { type: 'castle', owner: 'crown', region: 'free_marches' }); N('blackstone_archive', { type: 'castle', owner: 'synod', region: 'voldun' }); C.NODES.voldun.pos = [0.74, 0.565];
  C.LORE_ON = {};
  N('golden_reach', { type: 'zone', owner: 'crown', region: 'crownlands' }); N('hobbs_reach', { type: 'village', region: 'free_marches' }); N('free_marches', { type: 'contested', owner: 'crown', region: 'free_marches' });
  [['river_cities', 'canalgate'], ['river_cities', 'grain_exchange'], ['river_cities', 'ledgerhall'], ['grain_exchange', 'rivermeet'], ['voldun', 'orchard_row'], ['voldun', 'pale_vigil'], ['orchard_row', 'wardstone_green'], ['outlaws_rest', 'sheepfold'], ['outlaws_rest', 'millers_weir'], ['outlaws_rest', 'aldermere_hold'], ['hearthstone_priory', 'millstream'], ['millstream', 'wheatvale'], ['millstream', 'sheepfold'], ['crown_keep', 'millstream'],
   ['crown_keep', 'rivermeet'], ['crown_keep', 'wheatvale'], ['crown_keep', 'golden_reach'], ['rivermeet', 'sheepfold'], ['rivermeet', 'millers_weir'], ['wheatvale', 'applecourt']].forEach(([a, b]) => { C.NODES[a].links[b] = 1; C.NODES[b].links[a] = 1; });
  C.EVENTS = [
    { id: 'marches_warning', day: 12, text: 'w', effect: st => { st.world.flags.marches_warned = true; } },
    { id: 'marches_attack', day: 24, text: 'a', effect: st => { if (!st.world.flags.marches_defended) { (st.world.nodes.free_marches = st.world.nodes.free_marches || {}).owner = 'outlaws'; st.world.flags.marches_lost = true; } } },
    { id: 'human_split', day: 40, text: 's', effect: st => { st.world.flags.crown_syndicate_feud = true; } },
    { id: 'synod_crackdown', day: 56, text: 'c', effect: st => { st.world.flags.synod_crackdown = true; } }];
  C.dueEvents = st => C.EVENTS.filter(e => st.world.day >= e.day && !st.world.flags['ev_' + e.id]);
  C.runEvents = st => { const f = []; for (const e of C.dueEvents(st)) { st.world.flags['ev_' + e.id] = true; e.effect(st); f.push(e.id); } return f; };
  { const t0 = C.travel; C.travel = (st, to) => { const r = t0(st, to); r.events = C.runEvents(st); return r; }; }
  C.TV_GOSSIP = []; C.ROAD_SIGHTS = []; C.noticeBoard = (st, id) => ['Nothing but a faded notice about stray dogs.'];
  C.CHOICES.pennant_debt = { job: 'pennant_debt', options: [{ id: 'collect' }, { id: 'pay' }, { id: 'forgive' }] }; C.CHOICES.hedge_mage = { options: [{ id: 'hand' }, { id: 'hide' }, { id: 'warn' }] }; C.CHOICES.bad_paper = { job: 'bad_paper', options: [{ id: 'buy', jobFlag: 'job_bad_paper', gold: -200 }, { id: 'burn', flag: 'bad_paper_burned', jobFlag: 'job_bad_paper' }] }; C.CHOICES.road_hurt_trader = { road: true, options: [{ id: 'help' }, { id: 'rob' }, { id: 'leave' }] };
  C.ENCOUNTERS.marches_defence = { name: 'Raiders at the Marches', rec: 5, objective: { type: 'hold', zone: 'centre', size: 2, turns: 3 }, enemies: [{ primary: 'warrior' }, { primary: 'archer' }, { primary: 'rogue' }] };
  C.encounterBuilds = (id) => { const e = C.ENCOUNTERS[id]; return e ? { name: e.name, rec: e.rec, level: e.rec, objective: e.objective, builds: e.enemies.map(u => ({ primary: u.primary, level: e.rec })) } : null; };
  C.nodeServices = C.nodeServices || ((st, id) => ({}));
  window.GAME_CAMPAIGN = C;
  C.newGame = () => ({ factions: { standing: { crown: 0, syndicate: 0, synod: 0 }, relationOverrides: {}, ranks: {}, goodwill: 15 }, world: { day: 1, location: 'rivermeet', nodes: {}, flags: {} }, inventory: { gold: 500, items: {} } });
  ['intrigue.js', 'intrigue_cast.js', 'faction_work.js', 'faction_climax.js', 'story_world.js'].forEach(f => new Function('window', fs.readFileSync(path.join(process.env.GAME_DIR || path.join(__dirname, '../game'), 'data', f), 'utf8'))(window));
  return window;
};
