/* Gold economy (design/gold_economy.md). Income follows the gear price ladder: about 12 fights at the band buys the party its next tier.
   - C.GOLD: the curve (gold for a fight at level L, linear between points), the flat multiplier for jobs, choices and gifts, and the share of it that costs follow.
   - Fights: encounterBuilds gold x goldMult(rec), for every encounter except dungeon floors (done in dungeonFight, first-clear purse included)
     and arena bouts (their purses, fees and prizes are written already scaled in data/arena.js).
   - Contracts: the reward gold of each contract kind x goldMult(level).
   - Jobs and faction quests (C.JOBS reward gold) and positive choice gold: x GOLD.flat.
   - Costs follow at half the rise (C.costMult): border and checkpoint tolls, bounty settlements, recruit cost, and road gifts. Fixed prices in choice labels are left as written.
   - Scene windfalls (a scene option, tavern or proof deal, Moot reward) are topped up after the fact by the fight multiplier; road coins (npcTalk) by costMult.
   Not scaled here: shop prices and sell value. Arena purses, fees, prizes and the wager cap are written scaled in data/arena.js; a wager pays by its stake. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.STORY_WORLD || !C.FQ || !C.encounterBuilds || !C.dungeonFight || !C.CONTRACT_KINDS || !C.JOBS || !C.applyChoice || !C.rollWander || C.GOLD) return false;
    const GOLD = C.GOLD = {
      curve: [[1, 55], [4, 71], [11, 101], [18, 140], [25, 185], [33, 235], [41, 320], [50, 360]],   // gold for a fight at that level (the old rule paid 12 + 5 x level + 4.5); points sit at the middle of each item band
      flat: 2.2,                                                                            // jobs and choices: about the average rise of the curve
      costShare: 0.5                                                                        // costs rise by this share of the income rise
    };
    const old = L => 12 + 5 * L + 4.5;
    C.goldFor = L => { L = Math.max(1, L || 1); const c = GOLD.curve; for (let i = c.length - 1; i >= 0; i--) if (L >= c[i][0]) { const a = c[i], b = c[i + 1]; return b ? a[1] + (b[1] - a[1]) * (L - a[0]) / (b[0] - a[0]) : a[1]; } return c[0][1]; };
    C.goldMult = L => Math.max(1, C.goldFor(L) / old(Math.max(1, L || 1)));
    const partyLevel = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((x, y) => x + y, 0) / Math.max(1, l.length))); };
    C.costMult = st => 1 + (C.goldMult(partyLevel(st)) - 1) * GOLD.costShare;
    const scaled = (g, m) => Math.round(g * m);

    // ---- fights ----
    { const eb0 = C.encounterBuilds; C.encounterBuilds = function (encId) {
        const r = eb0.apply(this, arguments); if (!r || !r.reward || !r.reward.gold || !r.rec) return r;
        const E = C.ENCOUNTERS[encId]; if (!E || E.dungeon || E.arena || E.goldScaled === false) return r;
        r.reward = Object.assign({}, r.reward, { gold: scaled(r.reward.gold, C.goldMult(r.rec)) }); return r; }; }
    // dungeon floors: the floor's pay and the first-clear purse are both scaled by the floor's level, so a purse keeps its old worth in fights
    { const df0 = C.dungeonFight; C.dungeonFight = function (st, id) {
        const encId = df0.apply(this, arguments), e = encId && C.ENCOUNTERS[encId];
        if (e && e.reward && e.reward.gold) e.reward.gold = scaled(e.reward.gold, C.goldMult(e.rec));
        return encId; }; }
    // ---- contracts ----
    Object.values(C.CONTRACT_KINDS).forEach(K => { const r0 = K.reward; if (typeof r0 !== 'function') return;
      K.reward = function (lv) { const r = r0.apply(this, arguments); if (r && r.gold) r.gold = scaled(r.gold, C.goldMult(lv)); return r; }; });
    // ---- jobs and faction quests ----
    Object.values(C.JOBS).forEach(j => { if (j.reward && j.reward.gold && !j.reward._gold) { j.reward.gold = scaled(j.reward.gold, GOLD.flat); Object.defineProperty(j.reward, '_gold', { value: 1, enumerable: false }); } });
    // ---- choices (positive gold only; the extra is added after the original runs, so the road's 'stare' case is covered) ----
    { const ac0 = C.applyChoice; C.applyChoice = function (st) {
        const r = ac0.apply(this, arguments);
        if (r && r.ok && r.gold > 0) { const extra = scaled(r.gold, GOLD.flat - 1); st.inventory.gold += extra; r.gold += extra; }
        return r; }; }
    // ---- roads: a gift on the road pays more; tolls and checkpoints are scaled where they are made ----
    { const rw0 = C.rollWander; C.rollWander = function () {
        const w = rw0.apply(this, arguments), st = arguments[0]; if (w && w.kind === 'gift' && w.gold > 0 && !w._scaled) { w.gold = scaled(w.gold, C.costMult(st)); w._scaled = 1; }
        return w; }; }
    // ---- scene windfalls: gold handed over by a scene option, a tavern or proof deal, a Moot reward, a sale of a secret ----
    // These are hand-written lump sums, so they are caught where the player chooses: any net gain during the call is topped up by the
    // fight multiplier at the party's level (x costMult for small kindnesses). Only the outermost call tops up, and a net loss is left alone.
    { let depth = 0;
      const top = (name, mult) => { const f0 = C[name]; if (typeof f0 !== 'function') return;
        C[name] = function (st) { const g0 = st.inventory.gold; depth++; let r; try { r = f0.apply(this, arguments); } finally { depth--; }
          const d = st.inventory.gold - g0;
          if (!depth && d > 0 && !(r && r._windfall)) { const extra = scaled(d, mult(st) - 1);
            if (extra > 0) { st.inventory.gold += extra; if (r && typeof r === 'object') { if (typeof r.gold === 'number') r.gold += extra; Object.defineProperty(r, '_windfall', { value: 1, enumerable: false }); } } }
          return r; }; };
      const big = st => C.goldMult(partyLevel(st));
      ['chooseMove', 'contractChoose', 'tavernChoose', 'useProof', 'mootResolve', 'mootHall'].forEach(n => top(n, big));
      ['npcTalk'].forEach(n => top(n, C.costMult)); }
    // ---- recruits ----
    { const rc0 = S.recruitCost; S.recruitCost = function (st) { return Math.round(rc0.apply(this, arguments) * C.costMult(st)); }; }
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
