/* Human unification (design/node_ownership_and_land.md, Phase 4a). Pure rules, no screens. Needs attacks.js (and through it relations.js
   and supply.js), intrigue.js (the Moot), faction_work.js and faction_quests.js.
   - Two ways in. A war victory: only one human war faction is left (or the winner and its ally). The Moot: a crowned claimant unites the
     realm after a coronation a week later; wars pause in between. Old saves whose Moot already crowned someone unite when they load.
   - The new faction has one id, 'realm', and a flavour picked by who won: crown, syndicate, synod, broken_banner or hearthwatch. Each flavour
     fills the template: name, motto, colour, ruler, rank ladder, recruit lean, ideals, patrols (C.UNION.flavours).
   - Uniting: every place held by an absorbed faction flips to the realm, and Crown Keep is its capital (the other old capitals become
     ordinary places). The absorbed factions are marked in st.world.fallen with absorbed: true, so relations, attacks and joining skip them.
     Their wars, truces, alliances, talks and attacks end. A rank in one of them ends with no standing cost; its title stays in the history.
   - Standing carries over as a starting boost: 0.6 of the winner's standing and 0.4 of the others' average, capped just below rank 2.
   - Hand-over: boards, contracts and jobs keep running under the realm's name (C.heir maps an absorbed id to 'realm'); standing given to an
     absorbed faction goes to the realm. Try-outs and faction quest chains of the absorbed factions close.
   - The Hearthwatch is never absorbed. Allied to the winner at a war victory, it stays the realm's ally and gets a seat at court.
   - Recorded for later steps: who plots against the realm (4c) and the named posts of the leaders who backed the winner.
   - Global data (the realm's name and colour, its ladder, capitals) follows the save in play: C.unionSync(st) sets it, and runs on load,
     on a new game and at unification. */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.ATTACK || !C.wipeOut || !C.REL || !C.FQ || !C.CONTRACT_KINDS || !C.REALM || !C.MOVES || !C.offers || !C.LEAN || C.UNION) return false;
    const D = window.GAME_DATA, F = D.factions, A = C.ATTACK;
    const ID = 'realm', HUMAN_WAR = ['crown', 'syndicate', 'synod', 'broken_banner'];
    const day = st => st.world.day, fl = st => st.world.flags;
    const fname = f => (F[f] && F[f].name) || f;
    const P = (sq, name) => ({ name, enemies: sq.enemies.map(e => Object.assign({}, e)) });

    const U = C.UNION = {
      id: ID, coronation: 7, hall: 'crown_keep',
      carry: { winner: 0.6 },          // the rest is the other absorbed factions' average; capped just below rank 2 (set below)
      byOutcome: { regency: 'crown', osric: 'crown', ledger: 'syndicate', ilvane: 'synod', wil: 'broken_banner', corisande: 'hearthwatch' },
      flavours: {
        crown: { name: 'Restored Throne', motto: 'One road, one law.', color: '#d1a62c', ruler: 'the Steward',
          desc: 'The old kingdom made whole under one throne at Crown Keep. Oaths, knights, and the same law at both ends of every road.',
          ladder: ['Sworn Sword', 'Knight', 'Banneret', "Lord's Hand"], lean: { classes: ['squire'], mult: 0.75, needRank: 1 }, ideals: 'crown',
          want: 'The Restored Throne wants its law kept on every road, and its oaths honoured.', patrol: 'crown', patrolName: 'Throne patrol', who: ['the herald', 'Captain Harte'] },
        syndicate: { name: 'Ledger Concord', motto: 'Every debt paid, every road open.', color: '#2f9e74', ruler: 'the Partners of the Concord',
          desc: 'The realm run like a counting-house: every lord in debt, every road tolled, every quarrel settled on paper before it is settled with steel.',
          ladder: ['Runner', 'Agent', 'Factor', 'Partner'], lean: { classes: ['scout'], mult: 0.75, needRank: 1 }, ideals: 'syndicate', weary: 2,
          want: 'The Ledger Concord wants open roads and full markets, and peace for as long as peace pays.', patrol: 'syndicate', patrolName: 'Concord tollwardens', who: ['the clerk', 'Agent Marsh'] },
        synod: { name: 'Ascendancy', motto: 'What is written is remembered.', color: '#8462d0', ruler: 'the Archon',
          desc: 'The realm under the Ward. Every spell licensed, every grimoire under lock, and inquisitors on the roads who knock before they come in. Usually.',
          ladder: ['Novice', 'Warden', 'Inquisitor', 'Adept of the Inner Circle'], lean: { classes: ['apprentice'], mult: 0.75, needRank: 1 }, ideals: 'synod',
          want: 'The Ascendancy wants every spell in the realm written down, and the Ward kept fed.', patrol: 'synod', patrolName: 'Ascendancy watch', who: ['the clerk', 'Warden Vell'] },
        broken_banner: { name: 'Free Banner Realm', motto: 'No one left in the field.', color: '#b5502f', ruler: 'Captain Old Standard',
          desc: 'Deserters made lords, a pardon for everyone, and loose roadwardens where the knights used to ride. Nobody is quite sure how it works. So far, it does.',
          ladder: ['Cutpurse', 'Rider', 'Captain', 'Banner-Bearer'], lean: { classes: ['squire', 'scout', 'acolyte', 'apprentice'], mult: 0.85, needRank: 1 }, ideals: 'broken_banner',
          want: 'The Free Banner Realm wants to be left alone to feed its villages, and fights only when it is pushed.', patrol: 'broken_banner', patrolName: 'Banner roadwardens', who: ['Sergeant Rook', 'Sergeant Rook'] },
        hearthwatch: { name: 'Hearth Commonwealth', motto: 'A door open, a fire lit.', color: '#e0bd62', ruler: 'Queen Corisande',
          desc: 'A realm ruled from the chapels outward. Light taxes, few patrols, hedge-mages left in peace, and a long memory for who was kind.',
          ladder: ['Lampbearer', 'Keeper', 'Hearthwarden', 'Hearth-Elder'], lean: { classes: ['acolyte'], mult: 0.75, needRank: 1 }, ideals: 'hearthwatch',
          want: 'The Hearth Commonwealth wants the fighting over, and talks every neighbour toward a truce.', patrol: 'crown', patrolName: 'Hearth wardens', who: ['Brother Teodor', 'Brother Teodor'] }
      },
      // the leaders who backed the winner at the Moot take posts in the new realm (by Moot seat)
      posts: { lords: 'Lord Marshal Voss keeps the realm\'s armies.', syndicate: 'Factor Crane takes the treasury.', synod: 'Archon Ilvane keeps the Ward for the whole realm.',
        banner: 'Captain Old Standard rides as warden of the roads.', hearthwatch: 'Mother Agathe takes a seat at court and speaks for the chapels.' },
      hearthSeat: 'Mother Agathe takes a seat at court and speaks for the chapels, though the Hearthwatch swears to no throne.'
    };
    U.carry.cap = S.RANK.standingNeeded[1] - 1;

    // ---- the realm in the faction list (inactive until a save unites) ----
    const BASE_REL = {};   // the realm's starting relations follow its flavour's faction
    Object.keys(F).forEach(f => { BASE_REL[f] = Object.assign({}, F[f].relations); });
    if (!F[ID]) F[ID] = { name: 'United Realm', race: 'human', region: null, color: '#c9a227', active: false, relations: {}, desc: 'The human lands under one rule.' };
    if (!S.RANK.factions.includes(ID)) S.RANK.factions.push(ID);
    S.RANK.ladders[ID] = U.flavours.crown.ladder.slice();   // replaced by the flavour's ladder when a save unites
    const CAP0 = {}; Object.keys(C.NODES).forEach(id => { if (C.NODES[id].capital) CAP0[id] = C.NODES[id].capital; });

    // ---- which save is in play ----
    let ABS = new Set(), cur = null;
    const union = st => (st && st.world && st.world.union) || null;
    const absorbed = (st, f) => { const u = union(st); return !!u && u.absorbed.includes(f); };
    C.union = union;
    C.absorbed = absorbed;
    C.heir = f => ABS.has(f) ? ID : f;                                   // for code with no save at hand (names); synced with the save in play
    C.heirOf = (st, f) => absorbed(st, f) ? ID : f;
    C.unionFlavour = st => { const u = union(st); return u ? U.flavours[u.flavour] : null; };

    C.unionSync = function (st) {
      const u = union(st); cur = u;
      ABS = new Set(u ? u.absorbed : []);
      // capitals: Crown Keep becomes the realm's; the absorbed factions' other capitals become ordinary places
      Object.keys(CAP0).forEach(id => { const n = C.NODES[id]; n.capital = CAP0[id]; delete n.formerCapital; });
      const R = C.REL.factions, i = R.indexOf(ID);
      if (!u) { if (i >= 0) R.splice(i, 1); F[ID].active = false; return; }
      const fv = U.flavours[u.flavour], src = u.flavour;
      Object.keys(CAP0).forEach(id => { const n = C.NODES[id]; if (u.absorbed.includes(CAP0[id])) { n.capital = null; n.formerCapital = true; } });
      const ck = C.NODES[U.hall]; ck.capital = ID; delete ck.formerCapital;
      if (i < 0) R.push(ID);
      Object.assign(F[ID], { name: fv.name, color: fv.color, desc: fv.desc, motto: fv.motto, active: true, flavour: u.flavour });
      // relations: the flavour faction's, less the absorbed ones; both directions
      const rel = {}; Object.entries(BASE_REL[src] || {}).forEach(([g, v]) => { if (!u.absorbed.includes(g) && g !== ID && F[g]) rel[g] = v; });
      F[ID].relations = rel; Object.keys(F).forEach(g => { if (g !== ID && F[g].relations) { if (rel[g] !== undefined) F[g].relations[ID] = rel[g]; else delete F[g].relations[ID]; } });
      const crowned = u.how === 'moot' && C.REALM[u.outcome] && C.REALM[u.outcome].titles && u.flavour === 'crown';
      S.RANK.ladders[ID] = (crowned ? C.REALM[u.outcome].titles : fv.ladder).slice();
      C.LEAN[ID] = Object.assign({}, fv.lean, { classes: fv.lean.classes.slice() });
      C.IDEALS[ID] = Object.assign({}, C.IDEALS[fv.ideals]);
      C.MOTIVES[ID] = { name: fv.motto, want: fv.want, bias: {}, foes: [], weary: fv.weary };
      C.PATROLS[ID] = P(C.PATROLS[fv.patrol] || A.squads[fv.patrol] || C.PATROLS.crown, fv.patrolName);   // the Banner has no road patrol: its riders stand in
      A.squads[ID] = P(A.squads[fv.patrol] || A.squads.crown, fv.name + ' soldiers');
      A.leaders[ID] = u.ruler;
      (C.OFFER_WHO = C.OFFER_WHO || {})[ID] = fv.who.slice();
    };

    // ---- uniting ----
    // o: { how: 'war' | 'moot', flavour, winner (a faction id, or null for the Hearthwatch flavour), outcome (Moot) }
    C.unify = function (st, o) {
      if (union(st)) return { ok: false, reason: 'The realm is already one' };
      const w = st.world, rs = C.relState(st), ar = C.attackState ? C.attackState(st) : (w.atk || {}), alive = HUMAN_WAR.filter(f => !C.fallen(st, f));
      const ally = o.winner ? rs.allies[o.winner] || null : null;
      const abs = o.how === 'moot' ? alive.slice() : alive.filter(f => f === o.winner || f === ally);
      if (!abs.length) return { ok: false, reason: 'Nobody is left to unite' };
      // standing carries over (worked out before anything is redirected)
      const st0 = f => S.getStanding(st, f), mean = l => l.length ? l.reduce((a, f) => a + st0(f), 0) / l.length : 0;
      const W = o.winner && abs.includes(o.winner) ? o.winner : null, others = abs.filter(f => f !== W);
      let carry = W ? (others.length ? U.carry.winner * st0(W) + (1 - U.carry.winner) * mean(others) : st0(W)) : mean(abs);
      carry = Math.round(Math.max(S.RULES.standingMin, Math.min(U.carry.cap, carry)));
      // a rank in an absorbed faction ends; its title stays in the history
      let former = null; const sw = S.sworn(st);
      if (sw && abs.includes(sw)) { const r = S.getRank(st, sw); former = { faction: sw, title: r.title, rank: r.rank }; delete st.factions.ranks[sw]; }
      // who backed whom (Moot) or who was beaten (war): posts now, plotters for 4c
      const posts = [], plotters = [];
      if (o.how === 'moot') {
        const m = C.moot(st), seats = (m.tally && m.tally.seats) || [];
        seats.forEach(s => { const v = s.final !== undefined ? s.final : s.vote;
          if (v === o.outcome) { if (U.posts[s.seat] && !(o.outcome === 'ilvane' && s.seat === 'synod')) posts.push(U.posts[s.seat]); }
          else if (v && HUMAN_WAR.includes(s.faction) && !plotters.includes(s.faction)) plotters.push(s.faction); });
      } else HUMAN_WAR.forEach(f => { if (C.fallen(st, f) && !abs.includes(f)) plotters.push(f); });
      const hearthSeat = o.how === 'war' && ally === 'hearthwatch';
      const ruler = o.how === 'moot' && C.REALM[o.outcome] ? C.REALM[o.outcome].ruler : U.flavours[o.flavour].ruler;
      // the absorbed factions leave the board
      w.fallen = w.fallen || {};
      abs.forEach(f => { w.fallen[f] = { day: day(st), by: ID, absorbed: true }; });
      const ss = C.supplyState(st);
      for (const y of Object.keys(C.NODES)) if (abs.includes(C.ownerOf(st, y))) { (w.nodes[y] = w.nodes[y] || {}).owner = ID; delete ss.iso[y]; delete ss.cut[y]; }
      const hit = k => k.split('|').some(f => abs.includes(f));
      for (const k of Object.keys(rs.wars)) if (hit(k)) delete rs.wars[k];
      for (const k of Object.keys(rs.truce)) if (hit(k)) delete rs.truce[k];
      for (const g of Object.keys(rs.allies)) if (abs.includes(g) || abs.includes(rs.allies[g])) delete rs.allies[g];
      if (hearthSeat) { rs.allies[ID] = 'hearthwatch'; rs.allies.hearthwatch = ID; }
      if (rs.pending && (abs.includes(rs.pending.faction) || abs.includes(rs.pending.with))) rs.pending = null;
      if (ar.list) ar.list = ar.list.filter(x => !abs.includes(x.by) && !abs.includes(x.on));
      if (ar.talks) for (const k of Object.keys(ar.talks)) if (hit(k)) delete ar.talks[k];
      if (ar.grab && (abs.includes(ar.grab.by) || abs.includes(ar.grab.on))) ar.grab = null;
      // the realm with the Hearthwatch: the flavour faction's footing carries on
      const src = o.flavour === 'hearthwatch' ? null : o.flavour;
      S.setRelation(st, ID, 'hearthwatch', src ? S.getRelation(st, src, 'hearthwatch') : 0.4, { both: true });
      st.factions.rivalryOverrides = st.factions.rivalryOverrides || {};
      st.factions.rivalryOverrides[['hearthwatch', ID].sort().join('|')] = src ? S.rivalry(src, 'hearthwatch', st) : 'open';
      // the Kingmaker's hold answers to the realm now
      if (w.hold && abs.includes(w.hold.backer)) w.hold.backer = ID;
      if (w.hold && abs.includes(w.hold.from)) w.hold.from = ID;
      // try-outs and faction quest chains of the absorbed factions close
      const jobs = C.jobsOf(st), chain = new Set(); abs.forEach(f => { const Q = C.FQ[f]; if (Q) [Q.tryout].concat(Q.quests).forEach(j => chain.add(j)); });
      const closed = []; Object.keys(jobs).forEach(j => { if (chain.has(j) && jobs[j].state === 'active') { jobs[j].state = 'closed'; jobs[j].closed = day(st); closed.push(j); } });
      st.world.union = { day: day(st), how: o.how, outcome: o.outcome || null, flavour: o.flavour, winner: o.winner || null, absorbed: abs, ally: hearthSeat ? 'hearthwatch' : null,
        ruler, posts, plotters, hearthSeat, former, closed, seen: false };
      delete st.world.unionPending;
      C.unionSync(st);
      st.factions.standing[ID] = carry; (st.factions.met = st.factions.met || {})[ID] = 1;
      st.factions.history.push({ day: day(st), faction: ID, delta: 0, reason: 'the human lands are one realm, and your name carries into it' });
      if (former) st.factions.history.push({ day: day(st), faction: former.faction, delta: 0, reason: 'you were ' + former.title + ' of the ' + fname(former.faction) + '; that rank ended when the realm became one' });
      if (C.relNews) C.relNews(st, 'The human lands are one realm now: the ' + fname(ID) + '. ' + (ruler.charAt(0).toUpperCase() + ruler.slice(1)) + ' rules from Crown Keep.', 'union');
      return { ok: true, union: st.world.union };
    };

    // a crowned claimant: the coronation comes a week later, and wars pause until then
    { const ar0 = C.applyRealm; C.applyRealm = function (st, outcome) {
        const r = ar0.apply(this, arguments);
        if (r && r.ok && U.byOutcome[outcome] && !union(st) && !st.world.unionPending) {
          st.world.unionPending = { outcome, flavour: U.byOutcome[outcome], day: day(st) + U.coronation };
          if (C.relNews) C.relNews(st, 'Heralds ride from Crown Keep: the coronation is set, and every banner in the realm is called home for it.', 'union');
        }
        return r; }; }
    C.unionCheck = function (st) {
      if (union(st)) return null;
      const p = st.world.unionPending;
      if (p) return day(st) >= p.day ? C.unify(st, { how: 'moot', flavour: p.flavour, outcome: p.outcome, winner: p.flavour === 'hearthwatch' ? null : p.flavour }) : null;
      const alive = HUMAN_WAR.filter(f => !C.fallen(st, f)); if (alive.length === HUMAN_WAR.length || !alive.length) return null;
      const rs = C.relState(st);
      let winner = null;
      if (alive.length === 1) winner = alive[0];
      else if (alive.length === 2 && rs.allies[alive[0]] === alive[1]) {   // the victor and its ally: the victor is whoever took the last capital
        const last = Object.values(st.world.fallen || {}).filter(x => alive.includes(x.by)).reduce((m, x) => !m || x.day >= m.day ? x : m, null);   // the latest (ties: the last recorded)
        const held = f => Object.keys(C.NODES).filter(y => C.ownerOf(st, y) === f).length;
        winner = last ? last.by : (held(alive[0]) >= held(alive[1]) ? alive[0] : alive[1]);
      }
      return winner ? C.unify(st, { how: 'war', flavour: winner, winner }) : null;
    };
    { const rt0 = C.relTick; C.relTick = function (st) { const out = rt0.apply(this, arguments); C.unionCheck(st); return out; }; }
    { const at0 = C.attackTick; C.attackTick = function (st) { if (st.world.unionPending) return; return at0.apply(this, arguments); }; }

    // ---- no Moot once the realm is one (or the crown is being set) ----
    { const mc0 = C.mootCall; C.mootCall = function (st) { if (union(st) || st.world.unionPending) return { ok: false, reason: 'The realm already has a ruler' }; return mc0.apply(this, arguments); }; }
    { const mk0 = C.mootCheck; C.mootCheck = function (st) { if (union(st)) return null; return mk0.apply(this, arguments); }; }

    // ---- hand-over: standing, names, jobs, contracts, offers ----
    { const cs0 = S.changeStanding; S.changeStanding = function (st, f, delta, opts) {
        if (!union(st)) return cs0.apply(this, arguments);
        const u = union(st), keep = {}; u.absorbed.forEach(g => { keep[g] = st.factions.standing[g]; });
        const n = st.factions.history.length, out = cs0.call(this, st, C.heirOf(st, f), delta, opts);
        // ripples onto absorbed factions are dropped: their standing is frozen as it was at the union
        u.absorbed.forEach(g => { if (keep[g] === undefined) delete st.factions.standing[g]; else st.factions.standing[g] = keep[g]; });
        const tail = st.factions.history.slice(n).filter(x => !u.absorbed.includes(x.faction)); st.factions.history.length = n; st.factions.history.push(...tail);
        return out.filter(c => !u.absorbed.includes(c.faction)); }; }
    { const sv0 = S.serve; S.serve = function (st, f) { const a = Array.prototype.slice.call(arguments); a[1] = C.heirOf(st, f); return sv0.apply(this, a); }; }
    { const cj0 = S.canJoin; S.canJoin = function (st, f) {
        if (f === ID && !union(st)) return { ok: false, reason: 'The human lands are not one realm' };
        if (absorbed(st, f)) return { ok: false, reason: 'The ' + fname(f) + ' is part of the ' + fname(ID) + ' now' };
        return cj0.apply(this, arguments); }; }
    { const tv0 = C.tvName; C.tvName = f => tv0(C.heir(f)); }
    const chainJob = new Set(); Object.keys(C.FQ).forEach(f => { const Q = C.FQ[f]; [Q.tryout].concat(Q.quests).forEach(j => chainJob.add(j + '|' + f)); });
    const isChainOf = (id, f) => chainJob.has(id + '|' + f);
    { const jo0 = C.jobOffers; C.jobOffers = function (st, at) { const u = union(st), l = jo0.apply(this, arguments); if (!u) return l;
        return l.filter(j => !u.absorbed.some(f => isChainOf(j.id, f))).map(j => Object.assign({}, j, { giver: C.heirOf(st, j.giver) })); }; }
    { const jl0 = C.jobList; C.jobList = function (st) { const u = union(st), l = jl0.apply(this, arguments); if (!u) return l; const J = C.jobsOf(st);
        return l.map(j => J[j.id] && J[j.id].state === 'closed' ? Object.assign({}, j, { state: 'done', closed: true, name: j.name + ' (ended with the union)' }) : Object.assign({}, j, { giver: C.heirOf(st, j.giver) })); }; }
    if (C.jobLeads) { const jd0 = C.jobLeads; C.jobLeads = function (st) { return jd0.apply(this, arguments).map(j => Object.assign({}, j, { giver: C.heirOf(st, j.giver) })); }; }
    { const ct0 = C.contracts; C.contracts = function (st) { return ct0.apply(this, arguments).map(c => Object.assign({}, c, { faction: C.heirOf(st, c.faction) })); }; }
    { const op0 = C.offerPlace; C.offerPlace = function (st, o) { return o.faction === ID ? U.hall : op0.apply(this, arguments); }; }
    { const of0 = C.offers; C.offers = function (st) {
        const l = of0.apply(this, arguments); if (!union(st)) return l;
        const who = (C.OFFER_WHO || {})[ID] || [];
        return l.concat((S.invitations(st) || []).filter(o => o.faction === ID).map(o => Object.assign({ at: U.hall, who: who[o.kind === 'join' ? 0 : 1] || null }, o))); }; }

    // ---- the opening scene: the first arrival anywhere after the union ----
    const wordOf = st => { const u = union(st), fv = U.flavours[u.flavour], R = u.ruler.charAt(0).toUpperCase() + u.ruler.slice(1), at = st.world.location === U.hall;
      const lead = u.how === 'moot'
        ? (at ? 'The great hall of Crown Keep is packed to the rafters. The crown goes on to a noise like a storm breaking.' : 'Riders come through with the news from Crown Keep: the crown is on, and the bells have not stopped since.')
        : (at ? 'The last enemy banner is burned in the courtyard of Crown Keep, and a new one goes up the pole.' : 'Riders come through with the news: the last of the old powers has fallen, and the human lands answer to one rule now.');
      const lines = [lead, R + ' rules from Crown Keep, and the realm takes a new name: ' + fv.name + '. Its motto is painted on every gate by nightfall: "' + fv.motto + '"'];
      if (u.posts.length) lines.push(u.posts.join(' '));
      if (u.hearthSeat) lines.push(U.hearthSeat);
      if (u.former) lines.push('Your old title went with the ' + fname(u.former.faction) + '. The new court remembers your name, though.');
      lines.push(S.canJoin(st, ID).ok ? 'A herald finds you in the crowd. The new realm has a place for you, if you will swear to it.' : 'Nobody asks you to swear to anything yet. The new realm is still learning who its friends are.');
      return lines; };
    C.MOVES.push({ id: 'union_opening', who: 'herald', at: null,
      trip: st => { const u = union(st); return !!u && !u.seen; },
      setup: 'The realm is one.', lines: [], view: st => wordOf(st),
      options: [
        { id: 'swear', label: 'Swear to the new realm', if: st => S.canJoin(st, ID).ok, go: st => { union(st).seen = day(st); const r = S.joinRank(st, ID, { leave: true }); return { text: r.ok ? 'You kneel with a hundred others. When you stand up, you are ' + S.getRank(st, ID).title + ' of the ' + fname(ID) + '.' : r.reason }; } },
        { id: 'watch', label: 'Watch, and keep your own counsel', go: st => { union(st).seen = day(st); return { text: 'The cheering goes on long after you have left it behind.' }; } }
      ] });

    // ---- loading and new games ----
    { const rp0 = S.repair; S.repair = function () {
        const r = rp0.apply(this, arguments), st = r && r.state; if (!st || !st.world) return r;
        const rl = st.world.realm;
        if (rl && U.byOutcome[rl.outcome] && !union(st) && !st.world.unionPending) {   // a Moot that crowned someone before Phase 4: unite now
          const fv = U.byOutcome[rl.outcome], u = C.unify(st, { how: 'moot', flavour: fv, outcome: rl.outcome, winner: fv === 'hearthwatch' ? null : fv });
          if (u.ok) r.fixes.push('The realm united after the Moot (the ' + fname(ID) + ')');
        }
        if (union(st) && st.factions.ranks) Object.keys(st.factions.ranks).forEach(f => { if (absorbed(st, f)) { delete st.factions.ranks[f]; r.fixes.push('Dropped a rank in an absorbed faction (' + f + ')'); } });
        C.unionSync(st); return r; }; }
    { const ng0 = C.newGame; C.newGame = function () { const st = ng0.apply(this, arguments); C.unionSync(st); return st; }; }

    // ---- data checks ----
    C.validateUnion = function () {
      const p = [];
      Object.entries(U.byOutcome).forEach(([k, f]) => { if (!C.REALM[k]) p.push('union: unknown Moot outcome ' + k); if (!U.flavours[f]) p.push('union: no flavour ' + f); });
      Object.entries(U.flavours).forEach(([k, fv]) => {
        if (fv.ladder.length !== 4) p.push('union ' + k + ': ladder needs 4 titles');
        if (!C.IDEALS[fv.ideals]) p.push('union ' + k + ': unknown ideals ' + fv.ideals);
        if (!(C.PATROLS[fv.patrol] || A.squads[fv.patrol]) || !A.squads[fv.patrol]) p.push('union ' + k + ': unknown patrol ' + fv.patrol);
        fv.lean.classes.forEach(c => { if (!D.classes[c]) p.push('union ' + k + ': unknown class ' + c); });
      });
      if (!C.NODES[U.hall]) p.push('union: no hall');
      return p;
    };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
