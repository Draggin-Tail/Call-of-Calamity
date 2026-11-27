/* The united realm's policy dials (design/node_ownership_and_land.md, Phase 4b). Pure rules, no screens. Needs unification.js, and
   roads.js for the toll stop. Each flavour sets four dials; each dial is a small, readable rule that only touches the realm's own land.
   - Taxes: the realm's shops sell cheaper under low taxes. Pay is untouched.
   - Patrols: the chance of a road fight on the realm's land is multiplied (heavy patrols fewer, light patrols more). Other road meetings
     keep their chance. Under tolled roads, the Concord's tollwardens stop you at some road posts for a small toll.
   - Magic law: the price of an apprentice recruit at the realm's places; whether hedge-mages turn up as road foes on its land (fewer when
     hunted, none when sheltered or free); and which hedge-mage contracts its boards post (hunts only when hunted, smuggling only when
     sheltered or free, neither when licensed or for sale).
   - War posture: the realm's own lines for declaring war, making peace, swearing and breaking alliances, and how long its truces hold
     (relations.js reads them through C.postureOf). It shows once other races join relations.
   Hooks used: C.fightMult and C.foeOk (campaign.js road rolls), C.kindOk (faction_work.js boards), C.postureOf (relations.js). */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
    if (!C || !S || !C.UNION || !C.union || !C.nodeServices || !C.recruitMult || !C.contractBoard || !C.REL || !C.obstacleOptions || !C.resolveObstacle || !C.rollWander || C.POLICY) return false;
    const ID = C.UNION.id;
    const hsh = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
    const lvl = st => Math.max(1, ...st.roster.map(u => u.level || 1));

    const P = C.POLICY = {
      byFlavour: {
        crown: { taxes: 'medium', patrols: 'heavy', magic: 'licensed', posture: 'defensive' },
        syndicate: { taxes: 'low', patrols: 'tolled', magic: 'for_sale', posture: 'opportunistic' },
        synod: { taxes: 'medium', patrols: 'medium', magic: 'hunted', posture: 'cautious' },
        broken_banner: { taxes: 'low', patrols: 'loose', magic: 'sheltered', posture: 'provoked' },
        hearthwatch: { taxes: 'low', patrols: 'light', magic: 'free', posture: 'peaceful' }
      },
      taxes: {
        low: { shop: 0.9, word: 'Taxes are low: its shops sell cheaper.' },
        medium: { shop: 1, word: 'Taxes are as they were.' }
      },
      patrols: {
        heavy: { fight: 0.6, word: 'Its roads are heavily patrolled: fewer ambushes.' },
        medium: { fight: 0.8, word: 'Its roads are watched: somewhat fewer ambushes.' },
        tolled: { fight: 0.8, toll: true, word: 'Its tollwardens keep the roads somewhat safer, and charge for it at some road posts.' },
        loose: { fight: 1, word: 'Its roadwardens ride loose: the roads are as risky as ever.' },
        light: { fight: 1.2, word: 'Its roads are lightly kept: more ambushes.' }
      },
      magic: {
        hunted: { apprentice: 1.25, hedge: 'rare', boards: ['synod_inquiry', 'synod_heretic'], word: 'Hedge-mages are hunted: apprentices cost more, few hedge-mages walk its roads, and its boards post the hunts.' },
        licensed: { apprentice: 1, hedge: 'as_was', boards: [], word: 'Magic is licensed: no hunts and no smuggling on its boards.' },
        for_sale: { apprentice: 0.9, hedge: 'as_was', boards: [], word: 'Magic is for sale: apprentices come cheaper.' },
        sheltered: { apprentice: 0.9, hedge: 'none', boards: ['banner_hedge'], word: 'Hedge-mages are sheltered: apprentices come cheaper, no hedge-mage turns on travellers, and its boards smuggle the hunted to safety.' },
        free: { apprentice: 0.9, hedge: 'none', boards: ['banner_hedge'], word: 'Magic is free: apprentices come cheaper, no hedge-mage turns on travellers, and its boards help the hunted to safety.' }
      },
      // the realm's own relation lines; the old shared ones are C.REL.war -0.6, peace -0.4, ally 0.5, allyBreak 0.3, truceDays 20
      postures: {
        defensive: { war: -0.75, peace: -0.4, ally: 0.5, allyBreak: 0.15, truceDays: 25, word: 'It fights only when it must, and keeps its oaths to allies.' },
        opportunistic: { war: -0.5, peace: -0.3, ally: 0.4, allyBreak: 0.3, truceDays: 15, word: 'It goes to war when war pays, and makes peace as soon as peace pays better.' },
        cautious: { war: -0.7, peace: -0.45, ally: 0.6, allyBreak: 0.3, truceDays: 25, word: 'It is slow to war and slow to trust.' },
        provoked: { war: -0.5, peace: -0.45, ally: 0.5, allyBreak: 0.3, truceDays: 15, word: 'It fights hard when pushed, and is slow to forgive.' },
        peaceful: { war: -0.85, peace: -0.3, ally: 0.45, allyBreak: 0.2, truceDays: 40, word: 'It talks every neighbour toward peace, and its truces last.' }
      },
      hedgeSets: ['hedge'],                                   // C.FOE_SETS ids that are hedge-mages
      hedgeKinds: ['synod_inquiry', 'synod_heretic', 'banner_hedge'],
      toll: { every: 3, days: 5, base: 8, perLevel: 3 }       // a toll post at one road in `every`; at most once per `days`
    };
    const dials = st => { const u = C.union(st); return u && P.byFlavour[u.flavour] ? P.byFlavour[u.flavour] : null; };
    const realmAt = (st, id) => !!id && C.ownerOf(st, id) === ID;
    const dial = (st, k) => { const d = dials(st); return d ? P[k][d[k]] : null; };
    C.policy = dials;

    // ---- taxes: the realm's shops ----
    { const ns0 = C.nodeServices; C.nodeServices = function (st, id) {
        const sv = ns0.apply(this, arguments), t = dial(st, 'taxes');
        if (sv && sv.shop && t && t.shop !== 1 && realmAt(st, id)) sv.shop.priceMult = Math.round(sv.shop.priceMult * t.shop * 100) / 100;
        return sv; }; }

    // ---- magic law: apprentice recruits ----
    { const rm0 = C.recruitMult; C.recruitMult = function (st, at, cls) {
        const m = rm0.apply(this, arguments), g = dial(st, 'magic');
        return g && cls === 'apprentice' && realmAt(st, at) ? Math.round(m * g.apprentice * 100) / 100 : m; }; }

    // ---- patrols: road fights on the realm's land; magic law: hedge-mages on its roads ----
    C.fightMult = (st, to) => { const p = dial(st, 'patrols'); return p && realmAt(st, to) ? p.fight : 1; };
    C.foeOk = (st, set, to) => {
      if (!P.hedgeSets.includes(set.id)) return true;
      const g = dial(st, 'magic'); if (!g || !realmAt(st, to)) return true;
      if (g.hedge === 'none') return false;
      if (g.hedge === 'rare') return hsh(st.world.day + '|' + to) % 2 === 0;   // about half as often
      return true;
    };

    // ---- magic law: the realm's boards ----
    C.kindOk = (st, kind, board) => {
      if (board !== ID || !P.hedgeKinds.includes(kind)) return true;
      const g = dial(st, 'magic'); return !g || g.boards.includes(kind);
    };

    // ---- war posture ----
    C.postureOf = (st, f) => { if (f !== ID) return null; const d = dials(st); return d ? P.postures[d.posture] : null; };

    // ---- tolled roads: the Concord's tollwardens ----
    const tollAt = id => C.NODES[id] && C.NODES[id].type === 'road' && hsh('toll|' + id) % P.toll.every === 0;
    C.realmToll = st => Math.round((P.toll.base + P.toll.perLevel * lvl(st)) * (C.costMult ? C.costMult(st) : 1));
    { const rw0 = C.rollWander; C.rollWander = function (st, from, to, days) {
        const r = rw0.apply(this, arguments); if (r) return r;
        const p = dial(st, 'patrols'); if (!p || !p.toll || !tollAt(to) || !realmAt(st, to)) return null;
        const last = st.world.realmToll; if (last !== undefined && st.world.day - last < P.toll.days) return null;
        const w = { kind: 'obstacle', obstacle: 'realm_toll', region: C.areaOf(to), from, to, day: st.world.day, title: 'A toll post',
          text: 'Two Concord tollwardens have a chain across the road and a ledger on a stool. Everyone pays, they say. The road is safer for it.\n\nThe road to ' + C.NODES[to].name + ' runs on beyond them.' };
        st.world.wander = w; return w; }; }
    { const oo0 = C.obstacleOptions; C.obstacleOptions = function (st, w) {
        if (!w || w.obstacle !== 'realm_toll') return oo0.apply(this, arguments);
        const t = C.realmToll(st), rank = S.getRank && S.getRank(st, ID);
        return [{ id: 'known', label: 'Show your realm rank', ok: !!rank, note: rank ? null : 'You hold no rank in the realm.', hint: rank ? 'They wave their own through.' : null },
          { id: 'pay', label: 'Pay the toll (' + t + ' g)', ok: st.inventory.gold >= t, hint: 'The road is theirs to keep.' },
          { id: 'detour', label: 'Find another way round (1 day)', ok: true, hint: 'Slower, and free.' },
          { id: 'turn', label: 'Turn back', ok: true }];
      }; }
    { const ro0 = C.resolveObstacle; C.resolveObstacle = function (st, choice) {
        const w = st.world.wander; if (!w || w.obstacle !== 'realm_toll') return ro0.apply(this, arguments);
        const o = C.obstacleOptions(st, w).find(x => x.id === choice); if (!o || !o.ok) return { ok: false, reason: 'Not possible' };
        const pass = text => { st.world.realmToll = st.world.day; st.world.wander = null; return { ok: true, passed: true, text }; };
        if (choice === 'turn') { C.turnBack(st, w.from); return { ok: true, turned: true, text: 'You turn back.' }; }
        if (choice === 'known') return pass('The warden checks your seal against his ledger and lifts the chain.');
        if (choice === 'pay') { st.inventory.gold -= C.realmToll(st); return pass('You pay. The warden writes your name in the ledger and lifts the chain.'); }
        if (choice === 'detour') { S.advanceDay(st, 1); return pass('You leave the road and go round the post. It costs you a day.'); }
        return { ok: false, reason: 'Not possible' };
      }; }

    // ---- the dials in words, for the realm card ----
    C.policyWords = st => { const d = dials(st); if (!d) return []; return [P.taxes[d.taxes].word, P.patrols[d.patrols].word, P.magic[d.magic].word, P.postures[d.posture].word]; };

    C.validatePolicy = function () {
      const p = [];
      Object.keys(C.UNION.flavours).forEach(f => { const d = P.byFlavour[f]; if (!d) { p.push('policy: no dials for ' + f); return; }
        ['taxes', 'patrols', 'magic'].forEach(k => { if (!P[k][d[k]]) p.push('policy: ' + f + ' has unknown ' + k + ' ' + d[k]); });
        if (!P.postures[d.posture]) p.push('policy: ' + f + ' has unknown posture ' + d.posture); });
      Object.entries(P.postures).forEach(([k, x]) => { if (!(x.war < x.peace)) p.push('policy: posture ' + k + ' makes peace below its war line'); if (!(x.allyBreak < x.ally)) p.push('policy: posture ' + k + ' breaks alliances above its alliance line'); });
      P.hedgeSets.forEach(id => { if (!C.FOE_SETS.some(x => x.id === id)) p.push('policy: no foe set ' + id); });
      P.hedgeKinds.forEach(id => { if (!C.CONTRACT_KINDS[id]) p.push('policy: no contract kind ' + id); });
      Object.values(P.magic).forEach(g => g.boards.forEach(id => { if (!P.hedgeKinds.includes(id)) p.push('policy: board kind ' + id + ' is not a hedge kind'); }));
      return p;
    };
    return true;
  }
  if (!go()) { let n = 0; (function wait() { if (go()) return; if (++n < 400 && typeof setTimeout === 'function') setTimeout(wait, 25); })(); }
})();
