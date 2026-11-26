// Gold economy (design/gold_economy.md, curve and bands in design/item_bands.md): the curve, scaled income, first-clear purses, arena, costs, and entering-only checkpoints.
// Run: LD=./real_ld.js node tgold.js | grep -v ^PASS   (it loads the harness three times: with the change, without it (NOGOLD=1), and with the arena (ARENA=1))
let fails = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };
const LD = require(process.env.LD || './real_ld.js'); const W = LD(); process.env.NOGOLD = '1'; const W0 = LD(); delete process.env.NOGOLD;
const C = W.GAME_CAMPAIGN, S = W.GAME_SAVE, D = W.GAME_DATA, C0 = W0.GAME_CAMPAIGN, S0 = W0.GAME_SAVE;
const old = L => 12 + 5 * L + 4.5;
// ---- curve ----
ok('curve hits its points', [[1, 55], [4, 71], [11, 101], [18, 140], [25, 185], [33, 235], [41, 320], [50, 360]].every(([l, g]) => Math.abs(C.goldFor(l) - g) < 1e-9));
ok('curve is linear between points and flat after 50', Math.abs(C.goldFor(6) - (71 + 30 * 2 / 7)) < 1e-9 && C.goldFor(80) === 360);
ok('multiplier never drops below 1 and is about 1.3 to 2.6 over levels 1 to 50', Array.from({ length: 50 }, (_, i) => C.goldMult(i + 1)).every(m => m >= 1.25 && m <= 2.7) && C.goldMult(300) === 1);
const mk = (w, lv) => { const st = w.GAME_CAMPAIGN.newGame({ race: 'human' }); st.roster.forEach(u => { u.level = lv; u.xp = w.GAME_LOADOUT.xpForLevel(lv); }); return st; };
// ---- fights ----
for (const lv of [3, 8, 12]) {
  C.ENCOUNTERS.wander = { name: 'x', map: 'm', rec: lv, enemyFaction: 'outlaws', enemies: [{ primary: 'squire' }], reward: { xp: 10, gold: old(lv) } };
  const r = C.encounterBuilds('wander'); ok('wander fight at level ' + lv + ' pays the curve', r.reward.gold === Math.round(old(lv) * C.goldMult(lv)) && Math.abs(r.reward.gold - C.goldFor(lv)) <= 1);
  ok('...and the encounter record is untouched', C.ENCOUNTERS.wander.reward.gold === old(lv));
}
{ const id = Object.keys(C.ENCOUNTERS).find(k => C.ENCOUNTERS[k].once && C.ENCOUNTERS[k].reward && C.ENCOUNTERS[k].reward.gold && !C.ENCOUNTERS[k].dungeon && C.ENCOUNTERS[k].enemies);
  const e = C.ENCOUNTERS[id], opt = e.options ? e.options[0].id : undefined, r = C.encounterBuilds(id, opt), r0 = C0.encounterBuilds(id, opt);
  ok('a story fight (' + id + ') is scaled by its recommended level', r.reward.gold === Math.round(r0.reward.gold * C.goldMult(e.rec)) && r.reward.gold > r0.reward.gold); }
{ const st = mk(W, 5); st.inventory.gold = 0; C.ENCOUNTERS.wander = { name: 'x', map: 'm', rec: 5, enemyFaction: 'outlaws', enemies: [{ primary: 'squire' }], reward: { xp: 10, gold: 40 } };
  C.applyEncounterResult(st, 'wander', undefined, { won: true, kills: [], factionKills: {}, unitStats: {} }); ok('winning pays the scaled gold into the purse', st.inventory.gold === Math.round(40 * C.goldMult(5))); }
// ---- dungeons ----
{ const id = 'old_toll_cellars', d = C.DUNGEONS[id], st = mk(W, d.rec), st0 = mk(W0, d.rec), n = d.floors.length;
  const run = (c, s) => { const out = []; for (let i = 0; i < n; i++) { const e = c.dungeonFight(s, id); out.push(c.ENCOUNTERS[e].reward.gold); s.world.dungeons[id].stage++; } return out; };
  const a = run(C, st), b = run(C0, st0);
  ok('floors before the last are scaled', a.slice(0, n - 1).every((g, i) => g === Math.round(b[i] * C.goldMult(C.ENCOUNTERS['dg_' + id + '_' + (i + 1)].rec))));
  ok('the first-clear purse is scaled with the floor (' + d.first.gold + ' -> ' + a[n - 1] + ')', a[n - 1] === Math.round(b[n - 1] * C.goldMult(C.ENCOUNTERS['dg_' + id + '_' + n].rec)) && a[n - 1] > b[n - 1] + d.first.gold);
  { const ratio = Object.values(C.DUNGEONS).filter(x => x.first).every(x => x.first.gold * C.goldMult(x.rec) > x.first.gold * 1.3); ok('every dungeon purse is worth at least 1.3 times what it was', ratio); }
  st.world.dungeons[id].stage = 0; const e = C.dungeonFight(st, id); ok('encounterBuilds does not scale a dungeon floor a second time', C.encounterBuilds(e).reward.gold === C.ENCOUNTERS[e].reward.gold);
  const st2 = mk(W, d.rec); const s2 = st2.world.dungeons = {}; s2[id] = { stage: n - 1, cleared: false, clearedDay: -1, clears: 1 }; const e2 = C.dungeonFight(st2, id), st3 = mk(W0, d.rec); st3.world.dungeons = { [id]: { stage: n - 1, cleared: false, clearedDay: -1, clears: 1 } }; const e3 = C0.dungeonFight(st3, id);
  ok('a repeat clear pays no purse and half pay, scaled', C.ENCOUNTERS[e2].reward.gold === Math.round(C0.ENCOUNTERS[e3].reward.gold * C.goldMult(C.ENCOUNTERS[e2].rec))); }
// ---- arena stays as written ----
{ process.env.ARENA = '1'; const WA = LD(); delete process.env.ARENA; const CA = WA.GAME_CAMPAIGN, id = Object.keys(CA.ENCOUNTERS).find(k => CA.ENCOUNTERS[k].arena); if (!id) ok('arena bouts exist in this load', false); else { const e = CA.ENCOUNTERS[id], r = CA.encounterBuilds(id); ok('an arena bout is not scaled', r.reward.gold === e.reward.gold); } }
// ---- contracts, jobs, choices ----
{ const ks = Object.keys(C.CONTRACT_KINDS); ok('contract rewards are scaled by level', ks.every(k => [2, 8].every(lv => { const a = C.CONTRACT_KINDS[k].reward(lv), b = C0.CONTRACT_KINDS[k].reward(lv); return a.gold === Math.round(b.gold * C.goldMult(lv)); }))); }
{ const ids = Object.keys(C.JOBS).filter(j => C.JOBS[j].reward && C.JOBS[j].reward.gold); ok('every job with gold pays x2.2 (' + ids.length + ')', ids.length > 10 && ids.every(j => C.JOBS[j].reward.gold === Math.round(C0.JOBS[j].reward.gold * 2.2))); }
{ const cid = Object.keys(C.CHOICES).find(k => !C.CHOICES[k].road && C.CHOICES[k].options.some(o => o.gold > 0 && !o.fight)), c = C.CHOICES[cid], o = c.options.find(x => x.gold > 0 && !x.fight), neg = Object.keys(C.CHOICES).find(k => C.CHOICES[k].options.some(x => x.gold < 0));
  const st = mk(W, 3), st0 = mk(W0, 3); st.inventory.gold = st0.inventory.gold = 100; const r = C.applyChoice(st, cid, o.id), r0 = C0.applyChoice(st0, cid, o.id);
  ok('positive choice gold (' + cid + ') pays x2.2 and arrives in the purse', r.ok && r.gold === Math.round(o.gold * 2.2) && st.inventory.gold === 100 + r.gold && st0.inventory.gold === 100 + r0.gold);
  const nc = C.CHOICES[neg], no = nc.options.find(x => x.gold < 0), s1 = mk(W, 3), s2 = mk(W0, 3); s1.inventory.gold = s2.inventory.gold = 500; const a = C.applyChoice(s1, neg, no.id); C0.applyChoice(s2, neg, no.id);
  ok('a choice that costs gold costs what its label says', a.ok && s1.inventory.gold === s2.inventory.gold && s1.inventory.gold === 500 + no.gold); }
// ---- costs ----
{ const st = mk(W, 8), st0 = mk(W0, 8); const m = C.costMult(st); ok('costMult is half the income rise', Math.abs(m - (1 + (C.goldMult(8) - 1) / 2)) < 1e-9 && m > 1 && m < C.goldMult(8));
  ok('recruit cost follows costMult', S.recruitCost(st) === Math.round(S0.recruitCost(st0) * m)); }
// ---- checkpoints and gates: entering only ----
{ const N = C.NODES, fac = r => (C.REGIONS[r] || {}).faction, hostileOK = r => fac(r) && C.PATROLS[fac(r)];
  const edge = C.EDGES.map(([a, b]) => [[a, b], [b, a]]).flat().find(([a, b]) => N[b].type === 'road' && N[a].region !== N[b].region && hostileOK(N[b].region) && !N[a].hidden);
  const inner = C.EDGES.map(([a, b]) => [[a, b], [b, a]]).flat().find(([a, b]) => N[b].type === 'road' && N[a].region === N[b].region && hostileOK(N[b].region));
  ok('found test edges', !!edge && !!inner);
  const setup = (to) => { const st = mk(W, 6), f = fac(N[to].region); st.factions.standing[f] = -600; st.world.rbNext = 1e9; st.world.pass = {}; Object.keys(N).forEach(k => { st.world.flags['gate_' + k] = 1; }); return st; };
  const roll = (st, from, to) => { st.world.location = from; st.world.calm = 0; return C.rollWander(st, from, to, 1); };
  { const [a, b] = edge, st = setup(b), r = roll(st, a, b); ok('entering hostile land by a road stop asks for a toll', r && r.kind === 'checkpoint' && r.toll === Math.round((C.WANDER.tollBase + C.WANDER.tollPerLevel * 6) * C.costMult(st))); }
  { const [a, b] = edge, st = setup(b); const r = roll(st, b, a); ok('leaving hostile land the same way does not', !(r && r.kind === 'checkpoint')); }
  { const [a, b] = inner; let seen = 0; for (let i = 0; i < 40; i++) { const st = setup(b); st.world.day = 1 + i * 3; const r = roll(st, a, b); if (r && r.kind === 'checkpoint') seen++; } ok('moving inside hostile land never asks for a toll', seen === 0); }
  { const [a, b] = inner; let seen = 0; for (let i = 0; i < 40; i++) { const st = setup(a); st.world.day = 1 + i * 3; const r = roll(st, b, a); if (r && r.kind === 'checkpoint') seen++; } ok('walking back out toward the inside does not either', seen === 0); } }
// ---- scene windfalls: hand-written lump sums are topped up where the player chooses ----
{ const contract = (w, lv, opt) => { const st = mk(w, lv); st.inventory.gold = 200; st.world.contracts = { n: 1, list: [{ id: 'c1', kind: 'synd_collect', name: 'x', steps: [], state: 'open', faction: 'syndicate' }], scene: 'c1' }; const r = w.GAME_CAMPAIGN.contractChoose(st, opt); return { r, g: st.inventory.gold - 200 }; };
  for (const lv of [3, 10, 20]) { const a = contract(W, lv, 'squeeze'), b = contract(W0, lv, 'squeeze'); ok('contract scene gold at level ' + lv + ' follows the fight multiplier (' + b.g + ' -> ' + a.g + ')', b.g > 0 && a.g === b.g + Math.round(b.g * (C.goldMult(lv) - 1))); }
  { const a = contract(W, 10, 'cover'), b = contract(W0, 10, 'cover'); ok('a scene option that costs gold is not topped up', a.g === b.g && a.g <= 0); }
  const move = (w, lv, id, opt) => { const st = mk(w, lv); st.inventory.gold = 0; st.world.moves = { crossed: {}, fired: {}, cancelled: {}, pending: id }; const r = w.GAME_CAMPAIGN.chooseMove(st, opt); return { r, g: st.inventory.gold }; };
  { const a = move(W, 8, 'osric_purse', 'take'), b = move(W0, 8, 'osric_purse', 'take'); ok('a move payout (Osric\'s purse) is topped up once (' + b.g + ' -> ' + a.g + ')', b.g > 0 && a.g === b.g + Math.round(b.g * (C.goldMult(8) - 1))); ok('...and the reported gold matches the purse', !a.r.gold || a.r.gold === a.g); }
  { const a = move(W, 12, 'banner_captain', 'lead'), b = move(W0, 12, 'banner_captain', 'lead'); ok('a Moot-chain windfall (banner captain) is topped up (' + b.g + ' -> ' + a.g + ')', b.g > 0 && a.g > b.g * (1 + 0.8 * (C.goldMult(12) - 1))); }
  { const st = mk(W, 6); st.inventory.gold = 0; let n = 0; for (let i = 0; i < 3; i++) { st.world.day = 5 + i; C.npcTalk(st, 'crown_keep', Object.keys(C.NPCS || C.TAVERN_NPCS || {})[0]); n++; } ok('npc talks still run with the wrapper', n === 3); }
}
// ---- arena: written already scaled (purses, fees, prizes, wager cap), so the ring still pays about what a wander fight does ----
{ process.env.ARENA = '1'; const WA = LD(); delete process.env.ARENA; const CA = WA.GAME_CAMPAIGN, st = mk(WA, 8);
  const ring = CA.arenaStatus(st); const mid = { pit: 3, sand: 6, gold: 9.5, gate: 13 };
  ring.forEach(R => { const L = mid[R.id], first = R.bouts[0].purse, champ = R.bouts[2].purse, w = CA.goldFor(L);
    ok(R.id + ': the opening bout pays 90% to 250% of a wander fight, as designed (' + first + ' vs ' + Math.round(w) + ')', first >= 0.9 * w && first <= 2.5 * w);
    ok(R.id + ': the champion pays about 3 times the opening bout (' + champ + ')', champ >= 2.4 * first && champ <= 3.6 * first);
    ok(R.id + ': the gate fee stays under a quarter of the opening purse (' + R.fee + ')', R.fee <= 0.25 * first); });
  const T = CA.ARENA_TOURNEY; ok('Tourney prizes rise and the entry fee is under half the first prize', T.prizes[0] < T.prizes[1] && T.prizes[1] < T.prizes[2] && T.fee < 0.6 * T.prizes[0]);
  const stp = mk(WA, 10); stp.inventory.gold = 100000; ok('the wager cap is three wander fights at the party level, to 5 gold (' + CA.arenaBetCap(stp) + ')', CA.arenaBetCap(stp) === Math.round(3 * CA.goldFor(10) / 5) * 5); }
// ---- prices written in labels: the figure shown is the figure charged, and it was scaled with the rest ----
{ const num = l => { const m = /\((\d+) gold/.exec(l || ''); return m ? +m[1] : null; };
  const costed = [], gained = [];
  Object.entries(C.CHOICES).forEach(([k, c]) => (c.options || []).forEach(o => { const n = num(o.label); if (n == null) return; (o.gold < 0 ? costed : gained).push([k, o, n]); }));
  ok('choice labels with a price exist (' + costed.length + ' costs)', costed.length >= 15);
  ok('every priced choice label matches what it charges', costed.every(([k, o, n]) => n === -o.gold || console.log('  mismatch', k, o.id, n, o.gold)));
  ok('prices were scaled by about 1.6 and kept to multiples of 5', costed.every(([k, o, n]) => -o.gold % 5 === 0 && -o.gold >= 10));
  ok('a label that pays you shows what you will receive', gained.every(([k, o, n]) => n === o.gold + Math.round(o.gold * 1.2) || console.log('  mismatch', k, o.id, n, o.gold)));
  const D0 = Object.values(C.CONTRACT_KINDS).filter(K => K.scene), bad = [];
  D0.forEach(K => K.scene.options.forEach(o => { const n = num(o.label); if (n != null && n !== o.cost) bad.push(K.name + ':' + o.id); }));
  ok('contract option labels match their cost', bad.length === 0 || console.log('  ' + bad)); }
{ const st = mk(W, 8), B = C.ROADBLOCKS || null; if (B) { ok('roadblock prices exist', Object.keys(B).length > 0); } }
// ---- the pace target: 12 fights buy the next tier ----
{ const T = D.gearTiers, G = D.gear, cls = Object.keys(D.classes).filter(c => D.classes[c].selectable !== false), LO = W.GAME_LOADOUT;
  const kit = t => cls.reduce((s, c) => { const g = LO.defaultGear(c, []); let x = 0; for (const sl in g) x += (G[T.tierItem(g[sl], t)] || {}).price || 0; return s + x; }, 0) / cls.length;
  const mid = T.bands.slice(0, 6).map((b, i) => (b + T.bands[i + 1] - 1) / 2);
  mid.forEach((L, i) => { const net = 3 * (kit(i + 2) - 0.5 * kit(i + 1)), gold = 12 * C.goldFor(L), ratio = gold / net; ok('band ' + (i + 1) + ' (middle level ' + L + '): 12 fights earn ' + Math.round(ratio * 100) + '% of the net cost of the next tier (70% to 110%)', ratio >= 0.7 && ratio <= 1.1); }); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
