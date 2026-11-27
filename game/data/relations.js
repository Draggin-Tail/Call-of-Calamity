/* Relations between the human factions (design/node_ownership_and_land.md, Phase 3a): drift, wars, peace, one ally each,
   ideals and motives, the player's levers, and the council that asks the player before their own faction starts a war or joins an alliance.
   Pure rules, no screens. Nothing changes hands here: attacks come in Phase 3c.
   - Every pair has a relation (-1..1, symmetric; S.getRelation). Each day it moves a little toward a resting point set by the two factions'
     ideals (C.IDEALS), their motives toward each other (C.MOTIVES), shared borders, shared enemies, war weariness and grudges.
   - Incidents (about every ten days) and the player's levers push pairs away from it.
   - Thresholds with a buffer: war below -0.6, peace above -0.4 (then a truce), alliance at +0.5, broken below +0.3.
   - The rivalry table (Open / Uneasy / Opposed) changes only at those events: alliance Open, war Opposed, peace or a broken alliance Uneasy.
   - The Hearthwatch never declares war, and no AI faction allies with it or makes war on it; only the player's faction can, with the player's yes.
   - Acting against your own faction's ideals costs a little standing with it (public deeds in full, private ones at a third). */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.STORY_WORLD || !C.deed || !C.reputation || !C.MOVES || !C.applyEncounterResult || C.REL) return false;
    const D = window.GAME_DATA;
    const R = C.REL = {
      factions: ['crown', 'syndicate', 'synod', 'broken_banner', 'hearthwatch'],
      war: -0.6, peace: -0.4, truceDays: 20, ally: 0.5, allyBreak: 0.3,
      rate: 0.01,                         // share of the gap to the resting point closed each day
      border: -0.03, borderCap: -0.15,    // per road between their places
      sharedEnemy: 0.5, foe: -0.35, allyWarm: 0.1,
      weariness: 0.005, wearinessCap: 0.35, // per day at war
      grudge: -0.3, grudgeDays: 60, flipShift: -0.1,
      incidentEvery: [7, 13],
      fight: -0.03, argue: 0.05, argueEvery: 10, argueRank: 2,
      summonsDays: 7, declineCooldown: 20, declineTo: -0.55,
      idealCost: 3, privateShare: 1 / 3,
      news: 30
    };
    // Ideals on four scales, -2..2. Mercy and Honesty are the player's reputation scales; Magic runs free (-2) to controlled (+2), Order freedom (-2) to law (+2).
    C.IDEALS = {
      crown: { mercy: 0, honesty: 2, magic: 1, order: 2 },
      syndicate: { mercy: -1, honesty: 0, magic: -2, order: 1 },
      synod: { mercy: -1, honesty: 0, magic: 2, order: 1 },
      broken_banner: { mercy: 2, honesty: 1, magic: -1, order: -2 },
      hearthwatch: { mercy: 2, honesty: 1, magic: -2, order: 0 }
    };
    // Motives: what each faction wants. bias: how the motive bends its resting point with another faction. foes: whom it would start a war on.
    C.MOTIVES = {
      crown: { name: 'the throne and the oath', want: 'The Crown wants the deserters of the Banner gone and Crown Keep secure.', bias: { broken_banner: -0.25, syndicate: -0.15 }, foes: ['broken_banner'] },
      syndicate: { name: 'profit', want: 'The Syndicate wants markets and open roads, and sides with whoever looks strongest.', bias: { broken_banner: 0.2, crown: -0.15 }, foes: [], weary: 2 },
      synod: { name: 'control of magic', want: 'The Synod wants every grimoire under its lock, and distrusts anyone who shelters hedge-mages.', bias: { broken_banner: -0.1, hearthwatch: -0.05 }, foes: ['broken_banner'] },
      broken_banner: { name: 'pardon and survival', want: 'The Banner wants a pardon and to be left alone, and fights only when it is pushed.', bias: {}, foes: [] },
      hearthwatch: { name: 'peace', want: 'The Hearthwatch wants the fighting to stop, and talks every side toward a truce.', bias: {}, foes: [] }
    };
    const pk = (a, b) => [a, b].sort().join('|');
    const pairs = () => { const o = []; R.factions.forEach((a, i) => R.factions.slice(i + 1).forEach(b => o.push([a, b]))); return o; };
    const fname = f => (D.factions[f] && D.factions[f].name) || f;
    const day = st => st.world.day;
    const RS = st => {
      const w = st.world; if (!w.rel) w.rel = { day: w.day, wars: {}, allies: {}, truce: {}, grudge: {}, cool: {}, argued: {}, pending: null, next: w.day + 10, seed: (w.rng >>> 0) || 12345, news: [] };
      return w.rel;
    };
    C.relState = RS;
    const rnd = st => { const r = RS(st); r.seed = (Math.imul(r.seed ^ (r.seed >>> 15), 2246822519) + 0x6D2B79F5) >>> 0; return r.seed / 4294967296; };
    const rel = (st, a, b) => (S.getRelation(st, a, b) + S.getRelation(st, b, a)) / 2;
    const shift = (st, a, b, d) => S.setRelation(st, a, b, rel(st, a, b) + d, { both: true });
    const setRival = (st, a, b, v) => { st.factions.rivalryOverrides = st.factions.rivalryOverrides || {}; st.factions.rivalryOverrides[pk(a, b)] = v; };
    const news = (st, text, kind) => { const r = RS(st); r.news.push({ day: day(st), text, kind: kind || 'news' }); if (r.news.length > R.news) r.news = r.news.slice(-R.news); };
    const atWar = (st, a, b) => !!RS(st).wars[pk(a, b)];
    const allyOf = (st, f) => RS(st).allies[f] || null;
    C.relAtWar = atWar; C.relAllyOf = allyOf; C.relValue = rel;
    C.relEnemies = (st, f) => Object.keys(RS(st).wars).map(k => k.split('|')).filter(p => p.includes(f)).map(p => p[0] === f ? p[1] : p[0]);
    const sworn = st => (S.sworn ? S.sworn(st) : null);

    // ---- the resting point ----
    C.idealAffinity = (a, b) => { const A = C.IDEALS[a], B = C.IDEALS[b]; if (!A || !B) return 0; return ['mercy', 'honesty', 'magic', 'order'].reduce((n, k) => n + A[k] * B[k], 0) / 16; };
    function borders(st) {
      const o = {}; for (const [x, y] of C.EDGES || []) { const a = C.ownerOf(st, x), b = C.ownerOf(st, y); if (a !== b && R.factions.includes(a) && R.factions.includes(b)) { const k = pk(a, b); o[k] = (o[k] || 0) + 1; } }
      return o;
    }
    C.relTarget = function (st, a, b, bd) {
      const r = RS(st), k = pk(a, b), M = C.MOTIVES; bd = bd || borders(st);
      let t = C.idealAffinity(a, b) + ((M[a].bias || {})[b] || 0) + ((M[b].bias || {})[a] || 0);
      if (a !== 'hearthwatch' && b !== 'hearthwatch') t += Math.max(R.borderCap, R.border * (bd[k] || 0));
      // a common foe warms a pair: fighting the same enemy counts in full, both merely disliking one counts at half
      for (const g of R.factions) { if (g === a || g === b) continue; if (atWar(st, a, g) && atWar(st, b, g)) t += R.sharedEnemy; else if (rel(st, a, g) < R.foe && rel(st, b, g) < R.foe) t += R.sharedEnemy / 2; }
      if (allyOf(st, a) === b) t += R.allyWarm;
      const w = r.wars[k]; if (w) t += Math.min(R.wearinessCap, R.weariness * (day(st) - w.since) * ((M[a].weary || 1) + (M[b].weary || 1)) / 2);
      const g = r.grudge[k]; if (g) { const left = 1 - (day(st) - g.day) / R.grudgeDays; if (left > 0) t += g.v * left; else delete r.grudge[k]; }
      return Math.max(-1, Math.min(1, t));
    };

    // ---- events: war, peace, alliance ----
    function declareWar(st, by, on) {
      const r = RS(st), k = pk(by, on); if (r.wars[k]) return;
      r.wars[k] = { since: day(st), by }; delete r.truce[k];
      [by, on].forEach(f => { if (r.allies[f] === (f === by ? on : by)) delete r.allies[f]; });
      setRival(st, by, on, 'opposed');
      news(st, 'The ' + fname(by) + ' has declared war on the ' + fname(on) + '.', 'war');
    }
    function makePeace(st, a, b) {
      const r = RS(st), k = pk(a, b); if (!r.wars[k]) return; delete r.wars[k]; r.truce[k] = day(st) + R.truceDays; setRival(st, a, b, 'uneasy');
      news(st, 'The ' + fname(a) + ' and the ' + fname(b) + ' have made peace. A truce holds for now.', 'peace');
    }
    function makeAlly(st, a, b) {
      const r = RS(st); r.allies[a] = b; r.allies[b] = a; setRival(st, a, b, 'open');
      news(st, 'The ' + fname(a) + ' and the ' + fname(b) + ' have sworn an alliance.', 'ally');
    }
    function breakAlly(st, a, b) {
      const r = RS(st); if (r.allies[a] === b) delete r.allies[a]; if (r.allies[b] === a) delete r.allies[b]; setRival(st, a, b, 'uneasy');
      news(st, 'The alliance between the ' + fname(a) + ' and the ' + fname(b) + ' is over.', 'ally');
    }
    // who would start a war: the side whose motive names the other, else the side that thinks worse of the other; never the Hearthwatch
    function warBy(st, a, b) {
      const can = [a, b].filter(f => f !== 'hearthwatch'); if (!can.length) return null;
      const m = can.filter(f => C.MOTIVES[f].foes.includes(f === a ? b : a)); if (m.length === 1) return m[0];
      const pool = m.length ? m : can; return pool.slice().sort((x, y) => S.getRelation(st, x, x === a ? b : a) - S.getRelation(st, y, y === a ? b : a) || (x < y ? -1 : 1))[0];
    }
    function ask(st, kind, f, other) {
      const r = RS(st); if (r.pending) return false;
      r.pending = { kind, faction: f, with: other, day: day(st) }; news(st, 'The ' + fname(f) + ' has called its council and wants you at one of its halls.', 'summons');
      return true;
    }
    function checkPair(st, a, b) {
      const r = RS(st), k = pk(a, b), v = rel(st, a, b), me = sworn(st), cool = r.cool[k] && r.cool[k] > day(st);
      const pend = r.pending && pk(r.pending.faction, r.pending.with) === k;
      if (r.wars[k]) { if (v > R.peace) makePeace(st, a, b); return; }
      if (r.allies[a] === b) { if (v < R.allyBreak) breakAlly(st, a, b); return; }
      if (pend || cool) return;
      if (v < R.war && !(r.truce[k] && r.truce[k] > day(st))) {
        const by = warBy(st, a, b); if (!by) return; const on = by === a ? b : a;
        if (on === 'hearthwatch' && by !== me) return;                 // only the player's faction can make war on the Hearthwatch, and only with a yes
        if (by === me) ask(st, 'war', by, on); else declareWar(st, by, on);
        return;
      }
      if (v >= R.ally && !r.allies[a] && !r.allies[b]) {
        const hw = a === 'hearthwatch' || b === 'hearthwatch'; if (hw && !(me && (me === a || me === b))) return;   // no AI faction allies with the Hearthwatch
        if (me === a || me === b) ask(st, 'ally', me, me === a ? b : a); else makeAlly(st, a, b);
      }
    }

    // ---- incidents: motives decide which pairs they hit ----
    C.INCIDENTS = [
      { id: 'border_raid', d: -0.08, pick: (st, bd) => Object.keys(bd).filter(k => !k.includes('hearthwatch')).map(k => k.split('|')), text: (a, b) => 'Raiders from the ' + fname(a) + ' burned a barn on the ' + fname(b) + '\'s side of the border.' },
      { id: 'trade_dispute', d: -0.05, pick: () => ['crown', 'synod', 'broken_banner'].map(f => ['syndicate', f]), text: (a, b) => 'The ' + fname(a) + ' and the ' + fname(b) + ' are quarrelling over tolls and bad debts.' },
      { id: 'debt_called', d: -0.06, pick: () => [['syndicate', 'crown']], text: () => 'The Syndicate has called in a Crown loan early. The Lords are furious.' },
      { id: 'mage_raid', d: -0.08, pick: () => [['synod', 'broken_banner'], ['synod', 'hearthwatch']], text: (a, b) => 'Synod inquisitors raided a village under the ' + fname(b) + '\'s protection, looking for a hedge-mage.' },
      { id: 'feast', d: 0.06, pick: () => [['crown', 'synod'], ['crown', 'syndicate'], ['crown', 'hearthwatch']], text: (a, b) => 'The ' + fname(a) + ' held a feast for the ' + fname(b) + '. Toasts were drunk on both sides.' },
      { id: 'charity', d: 0.05, pick: () => ['crown', 'syndicate', 'synod', 'broken_banner'].map(f => ['hearthwatch', f]), text: (a, b) => 'The Hearthwatch fed the ' + fname(b) + '\'s wounded through a hard week. People remember.' },
      { id: 'pardon_offer', d: 0.06, pick: () => [['crown', 'broken_banner'], ['hearthwatch', 'broken_banner']], text: (a, b) => 'The ' + fname(a) + ' offered a pardon to a band of the Banner\'s riders, and some took it.' },
      { id: 'fenced_goods', d: 0.05, pick: () => [['syndicate', 'broken_banner']], text: () => 'Syndicate buyers paid the Banner well for a caravan\'s worth of goods. Nobody asked whose caravan.' }
    ];
    function incident(st, bd) {
      const r = RS(st), pool = [];
      C.INCIDENTS.forEach(I => (I.pick(st, bd) || []).forEach(p => pool.push([I, p])));
      if (!pool.length) return null; const [I, [a, b]] = pool[Math.floor(rnd(st) * pool.length)];
      shift(st, a, b, I.d); news(st, I.text(a, b), 'incident'); return I.id;
    }

    // ---- the day ----
    C.relTick = function (st) {
      const r = RS(st), bd = borders(st);
      if (r.pending && day(st) - r.pending.day >= R.summonsDays) decline(st, true);
      for (const [a, b] of pairs()) { const v = rel(st, a, b), t = C.relTarget(st, a, b, bd); S.setRelation(st, a, b, v + R.rate * (t - v), { both: true }); }
      if (day(st) >= r.next) { incident(st, bd); r.next = day(st) + R.incidentEvery[0] + Math.floor(rnd(st) * (R.incidentEvery[1] - R.incidentEvery[0] + 1)); }
      for (const [a, b] of pairs()) checkPair(st, a, b);
    };
    { const ad0 = S.advanceDay; S.advanceDay = function (st, n) {
        const r = st && st.world && st.factions ? RS(st) : null, out = ad0.apply(this, arguments); if (!r) return out;   // state first, so a new save ticks its first day too
        let guard = 0; while (r.day < st.world.day && guard++ < 400) { r.day++; const real = st.world.day; st.world.day = r.day; try { C.relTick(st); } finally { st.world.day = real; } }
        r.day = st.world.day; return out; }; }

    // ---- the council: your faction asks before it starts a war or joins an alliance ----
    function decline(st, lapsed) {
      const r = RS(st), p = r.pending; if (!p) return; r.pending = null; const k = pk(p.faction, p.with); r.cool[k] = day(st) + R.declineCooldown;
      if (p.kind === 'war') S.setRelation(st, p.faction, p.with, Math.max(rel(st, p.faction, p.with), R.declineTo), { both: true });
      news(st, lapsed ? 'The ' + fname(p.faction) + '\'s council waited for you, and in the end did nothing.' : 'On your word, the ' + fname(p.faction) + (p.kind === 'war' ? ' stands down.' : ' lets the alliance go.'), 'summons');
    }
    C.relDecide = function (st, yes) {
      const r = RS(st), p = r.pending; if (!p) return { ok: false, reason: 'Nobody is waiting for your answer' };
      if (sworn(st) !== p.faction) { r.pending = null; return { ok: false, reason: 'You no longer serve them' }; }
      if (!yes) { decline(st, false); return { ok: true, yes: false }; }
      r.pending = null;
      if (p.kind === 'war') declareWar(st, p.faction, p.with);
      else { if (r.allies[p.faction] || r.allies[p.with]) return { ok: false, reason: 'One of them already has an ally' }; makeAlly(st, p.faction, p.with); }
      return { ok: true, yes: true, kind: p.kind, with: p.with };
    };
    const isHall = (st, id, f) => { const n = C.NODES[id]; return !!n && C.ownerOf(st, id) === f && (n.type === 'hall' || n.type === 'capital'); };
    const COUNCIL_LINES = {
      war: (f, g) => ['The ' + fname(f) + ' means to declare war on the ' + fname(g) + '.', C.MOTIVES[f].want, '"We will not do it without you," says the oldest voice at the table. "Say the word, or say no."'],
      ally: (f, g) => ['The ' + fname(g) + ' has offered the ' + fname(f) + ' an alliance: an oath that neither will raise a hand against the other.', C.MOTIVES[f].want, '"It binds us," someone says. "It binds you too. Well?"']
    };
    C.MOVES.push({ id: 'faction_council', who: 'council', at: null,
      trip: st => { const p = RS(st).pending; return !!p && sworn(st) === p.faction && isHall(st, st.world.location, p.faction); },
      setup: 'You are taken straight to the council room. Everyone at the table stops talking when you come in.', lines: [],
      view: st => { const p = RS(st).pending; return p ? COUNCIL_LINES[p.kind](p.faction, p.with) : []; },
      options: [
        { id: 'yes', label: 'Say yes', go: st => { const p = RS(st).pending, r = C.relDecide(st, true); return { repeat: true, text: !r.ok ? r.reason : p.kind === 'war' ? 'The table rises. By morning the heralds are on the roads.' : 'The oath is sworn before nightfall.' }; } },
        { id: 'no', label: 'Say no', go: st => { C.relDecide(st, false); return { repeat: true, text: 'They argue for an hour. In the end they do as you say.' }; } }
      ] });

    // ---- the player's levers ----
    // your reputation's fit with what the other faction values: 0.5 (it clashes) to 1.5 (it fits)
    C.relFit = function (st, g) {
      const I = C.IDEALS[g], rp = C.reputation(st); if (!I) return 1;
      const part = (v, i) => Math.sign(v) * Math.min(Math.abs(v), 8) / 8 * i / 2;
      const a = Math.max(-1, Math.min(1, (part(rp.mercy, I.mercy) + part(rp.honesty, I.honesty)) / 2));
      return Math.round((1 + 0.5 * a) * 100) / 100;
    };
    C.relArgueOptions = function (st) {
      const f = sworn(st), r = S.getRank && f ? S.getRank(st, f) : null; if (!f || !R.factions.includes(f) || !r || r.rank < R.argueRank || !isHall(st, st.world.location, f)) return [];
      const rs = RS(st);
      return R.factions.filter(g => g !== f).map(g => {
        const war = atWar(st, f, g), ally = allyOf(st, f) === g, wait = rs.argued[g] && rs.argued[g] > day(st);
        return { faction: g, peace: rel(st, f, g) < 0 || war, ally: !war && !ally, wait: wait ? rs.argued[g] - day(st) : 0, fit: C.relFit(st, g) };
      });
    };
    C.relArgue = function (st, g, kind) {
      const o = C.relArgueOptions(st).find(x => x.faction === g); if (!o) return { ok: false, reason: 'Speak at a hall of your own faction, from rank ' + R.argueRank };
      if (o.wait) return { ok: false, reason: 'They have heard you on this. Give it ' + o.wait + ' days.' };
      if (kind === 'peace' ? !o.peace : kind === 'ally' ? !o.ally : true) return { ok: false, reason: 'There is nothing to argue for there' };
      const f = sworn(st), d = R.argue * o.fit; shift(st, f, g, d); RS(st).argued[g] = day(st) + R.argueEvery;
      return { ok: true, fit: o.fit, text: o.fit > 1.15 ? 'They listen. Your name carries weight with the ' + fname(g) + '.' : o.fit < 0.85 ? 'They hear you out, but your name works against you with the ' + fname(g) + '.' : 'They hear you out.' };
    };
    // fighting a faction for your own sours the two
    { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
        const E = encId === 'wander' ? st.world.wander : C.ENCOUNTERS[encId], O = E && optionId && E.options ? E.options.find(o => o.id === optionId) : null, foe = (O && O.enemyFaction) || (E && E.enemyFaction);
        const out = ae0.apply(this, arguments), me = sworn(st);
        if (res && res.won && me && foe && foe !== me && R.factions.includes(me) && R.factions.includes(foe)) shift(st, me, foe, R.fight);
        return out; }; }
    // losing a place to someone (Phase 3c calls this when places change hands)
    C.relFlip = function (st, taker, loser) {
      if (!R.factions.includes(taker) || !R.factions.includes(loser) || taker === loser) return;
      shift(st, taker, loser, R.flipShift); RS(st).grudge[pk(taker, loser)] = { v: R.grudge, day: day(st) };
    };

    // ---- acting against your own faction's ideals ----
    { const dd0 = C.deed; C.deed = function (st, faction, path, weight, opts) {
        const d = dd0.apply(this, arguments), f = sworn(st), I = f && C.IDEALS[f]; if (!d || !I) return d;
        const ax = d.axes || {}, share = d.public ? 1 : R.privateShare;
        const cost = ['mercy', 'honesty'].reduce((n, k) => { const a = ax[k] || 0; return n + (a && I[k] && Math.sign(a) !== Math.sign(I[k]) ? Math.abs(a) * Math.abs(I[k]) / 2 : 0); }, 0);
        const pts = Math.round(cost * R.idealCost * share);
        if (pts > 0) S.changeStanding(st, f, -pts, { reason: 'acted against what the ' + fname(f) + ' stands for', ripple: false });
        return d; }; }

    // ---- for the screens ----
    C.relMood = v => v >= R.ally ? 'close' : v >= 0.2 ? 'friendly' : v >= -0.2 ? 'cool' : v >= R.war ? 'hostile' : 'bitter';
    C.relReport = function (st) {
      const r = RS(st);
      return { wars: Object.entries(r.wars).map(([k, w]) => ({ a: w.by, b: k.split('|').find(x => x !== w.by), since: w.since })),
        allies: Object.entries(r.allies).filter(([a, b]) => a < b).map(([a, b]) => ({ a, b })),
        truces: Object.entries(r.truce).filter(([, d]) => d > day(st)).map(([k, d]) => ({ a: k.split('|')[0], b: k.split('|')[1], left: d - day(st) })),
        pairs: pairs().map(([a, b]) => ({ a, b, mood: C.relMood(rel(st, a, b)), status: r.wars[pk(a, b)] ? 'war' : r.allies[a] === b ? 'allied' : (r.truce[pk(a, b)] || 0) > day(st) ? 'truce' : null })),
        pending: r.pending, news: r.news.slice().reverse() };
    };
    C.validateRelations = function () {
      const p = []; R.factions.forEach(f => { if (!D.factions[f]) p.push('relations: unknown faction ' + f); if (!C.IDEALS[f]) p.push('relations: no ideals for ' + f); if (!C.MOTIVES[f]) p.push('relations: no motive for ' + f);
        Object.keys((C.MOTIVES[f] || {}).bias || {}).concat((C.MOTIVES[f] || {}).foes || []).forEach(g => { if (!R.factions.includes(g)) p.push('relations: ' + f + ' motive names ' + g); }); });
      return p;
    };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
