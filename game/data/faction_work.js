/* Faction work (design/human_story_map.md, faction_fantasies.md, crown_storyline.md). Pure rules, no screens. Needs intrigue_cast.js.
   - Deeds and morality: every choice with a moral weight is recorded as a deed (light / gray / dark, for a faction, public or not).
     Each faction story reads its own lean; a realm-wide reputation will read the public deeds (its shape is still open).
   - Contract boards: repeatable faction work between the hand-written beats. A board at a faction's castles offers three contracts
     (changing every four days), filtered by your rank. Contracts have steps (visit, fight, scene) and are reported at any of the faction's castles.
   - The day-timed world events become tripwires (the world waits for the player).
   - Lean, not lock: a faction favours its fantasy (cheaper recruits of its classes).
   Crown first; the other factions add their kinds to C.CONTRACT_KINDS. */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
  if (C.CONTRACT_KINDS) return;
  const fl = st => st.world.flags, day = st => st.world.day;
  const rankOf = (st, f) => { const r = S.getRank(st, f); return r ? r.rank : 0; };
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const hsh = s => { let a = 2166136261; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); } return a >>> 0; };
  const gw = (st, d, why) => { if (S.changeGoodwill && d) S.changeGoodwill(st, d, why); };

  // ---- deeds and morality ----
  const mor = st => st.world.morals || (st.world.morals = { deeds: [] });
  C.deed = function (st, faction, path, weight, opts) {
    opts = opts || {}; const d = { day: day(st), faction, path, weight: weight || 1, public: !!opts.public, tag: opts.tag || null };
    const m = mor(st); m.deeds.push(d); if (m.deeds.length > 400) m.deeds = m.deeds.slice(-400); return d;
  };
  C.lean = function (st, faction) {
    const o = { light: 0, gray: 0, dark: 0 }; mor(st).deeds.filter(d => d.faction === faction).forEach(d => { o[d.path] += d.weight; });
    o.lean = o.light - o.dark >= 3 ? 'light' : o.dark - o.light >= 3 ? 'dark' : 'gray'; return o;
  };
  C.publicDeeds = st => mor(st).deeds.filter(d => d.public);   // the realm-wide reputation will be built on these

  // ---- the day-timed events become tripwires ----
  { const T = {
      marches_warning: st => !!fl(st).knighted || ['crown', 'syndicate', 'synod', 'broken_banner'].some(f => rankOf(st, f) >= 2),
      marches_attack: st => !!fl(st).marches_warned && !fl(st).marches_defended && day(st) > (fl(st).marches_warned_day || 0) && C.NODES[st.world.location] && C.areaOf(st.world.location) === 'free_marches',
      human_split: st => C.knows(st, 's_hand_e') || rankOf(st, 'syndicate') >= 3,
      synod_crackdown: st => C.knows(st, 's_hoard_e') || rankOf(st, 'synod') >= 3 };
    (C.EVENTS || []).forEach(e => { if (T[e.id]) e.trip = T[e.id]; });
    const w = (C.EVENTS || []).find(e => e.id === 'marches_warning'); if (w) { const f0 = w.effect; w.effect = st => { f0(st); fl(st).marches_warned_day = day(st); }; w.text = 'Word from the Marches: raiders are massing past the border, more than anyone has seen in years. The Crown has sent no extra spears. Unless someone goes and stands there, the border farms of the Free Marches will burn.'; }
    const a = (C.EVENTS || []).find(e => e.id === 'marches_attack'); if (a) a.text = 'You arrive to smoke on every horizon. The raiders have come over the border, and the farms of the Free Marches are burning.';
    C.dueEvents = st => (C.EVENTS || []).filter(e => !fl(st)['ev_' + e.id] && (e.trip ? e.trip(st) : st.world.day >= e.day));
  }

  // ---- lean, not lock: a faction's places sell its fantasy cheaper ----
  C.LEAN = { crown: { classes: ['squire'], mult: 0.75, needRank: 1 } };
  C.recruitMult = function (st, at, classId) {
    const own = C.ownerOf(st, at), L = C.LEAN[own]; if (!L || !L.classes.includes(classId)) return 1;
    return rankOf(st, own) >= L.needRank ? L.mult : 1;
  };

  // ---- contract boards ----
  const ctr = st => st.world.contracts || (st.world.contracts = { n: 0, list: [] });
  // Boards: a faction's castles, capitals and halls; the Banner and the Hearthwatch hold no castles, so any place they own has one.
  C.BOARD_ANY = { broken_banner: true, hearthwatch: true };
  const isBoard = (st, id, f) => { const n = C.NODES[id]; return !!n && C.ownerOf(st, id) === f && (C.BOARD_ANY[f] || n.type === 'castle' || n.type === 'capital' || n.type === 'hall'); };
  // Rank for board purposes: the Hearthwatch has none, so its goodwill tiers stand in (Wary 0, Kindly 1, Trusted 2).
  const workRank = (st, f) => f === 'hearthwatch' ? ['wary', 'kindly', 'trusted'].indexOf(S.goodwillTier ? S.goodwillTier(st).id : 'wary') : rankOf(st, f);
  function nearby(st, from, f, types, hops, owners) {
    const okOwner = id => owners === 'any' ? true : owners ? owners.includes(C.ownerOf(st, id)) : C.ownerOf(st, id) === f;
    const dist = { [from]: 0 }, q = [from], out = [];
    while (q.length) { const x = q.shift(); if (dist[x] >= hops) continue; Object.keys((C.NODES[x] || {}).links || {}).forEach(y => { if (dist[y] === undefined) { dist[y] = dist[x] + 1; q.push(y); } }); }
    Object.keys(dist).forEach(id => { const n = C.NODES[id]; if (id !== from && n && !n.hidden && types.includes(n.type) && okOwner(id)) out.push(id); });
    if (!out.length) Object.keys(C.NODES).forEach(id => { const n = C.NODES[id]; if (id !== from && !n.hidden && types.includes(n.type) && okOwner(id) && (owners || C.areaOf(id) === C.areaOf(from))) out.push(id); });
    return out.sort();
  }
  const OUTLAWS = [[{ primary: 'squire', name: 'Deserter' }, { primary: 'scout', name: 'Hedge Archer' }, { primary: 'rogue', name: 'Cutthroat' }], [{ primary: 'warrior', name: 'Brigand Chief' }, { primary: 'archer', name: 'Brigand Bowman' }, { primary: 'rogue', name: 'Brigand Knife' }]];
  const S_ = (type, extra) => Object.assign({ type }, extra || {});
  // kind: { faction, name, minRank, targets (place types), hops, n (targets), steps(t[]), reward(lv), scene?: { setup, options: [{ id, label, cost?, effect(st) }] }, fight?: { name, enemies(lv), text } }
  C.CONTRACT_KINDS = {
    crown_patrol: { faction: 'crown', name: 'Ride the patrol', minRank: 0, targets: ['village', 'hamlet', 'town'], hops: 3, n: 2,
      brief: t => 'Show the colours at ' + t.map(x => C.NODES[x].name).join(' and ') + '. Folk sleep better when they see a knight.',
      steps: t => t.map(x => S_('visit', { at: x })), reward: lv => ({ gold: 20 + 5 * lv, standing: 25 }) },
    crown_bandits: { faction: 'crown', name: 'Clear the road', minRank: 0, targets: ['zone', 'hamlet'], hops: 3, n: 1,
      brief: t => 'Brigands are robbing travellers near ' + C.NODES[t[0]].name + '. Put an end to it.',
      steps: t => [S_('fight', { at: t[0] })], reward: lv => ({ gold: 30 + 6 * lv, standing: 35 }),
      fight: { name: 'Road brigands', enemies: lv => OUTLAWS[lv > 5 ? 1 : 0], text: 'The brigands are where the sergeant said they would be, and they have seen your colours.' } },
    crown_deserter: { faction: 'crown', name: 'Bring in a deserter', minRank: 1, targets: ['hamlet', 'village'], hops: 3, n: 1,
      brief: t => 'A deserter from the Marches garrison is hiding at ' + C.NODES[t[0]].name + '. Bring him in.',
      steps: t => [S_('scene', { at: t[0] })], reward: lv => ({ gold: 25 + 5 * lv, standing: 0 }),
      scene: { setup: 'You find him in a hayloft: nineteen, maybe, with a wife and a cough. He ran from the Marches garrison when they stopped sending food.\n\nHe knows why you have come. He does not reach for the knife beside him.',
        options: [
          { id: 'bring', label: 'Bring him back to face the court', effect: st => { S.serve(st, 'crown', 30, { reason: 'brought in a deserter' }); C.deed(st, 'crown', 'gray', 1, { tag: 'law' }); return 'He walks beside your horse the whole way and does not try to run.'; } },
          { id: 'hang', label: 'Hang him here, as the law allows', effect: st => { S.serve(st, 'crown', 40, { reason: 'hanged a deserter' }); C.deed(st, 'crown', 'dark', 2, { public: true, tag: 'cruelty' }); return 'The village watches from its doorways. Nobody will desert from here again, and nobody will forget you either.'; } },
          { id: 'free', label: 'Let him go, and point him to the Banner', effect: st => { S.changeStanding(st, 'crown', -10, { reason: 'let a deserter go', ripple: false }); S.changeStanding(st, 'broken_banner', 20, { reason: 'sent them a deserter', ripple: false }); C.deed(st, 'crown', 'light', 1, { tag: 'mercy' }); return '"I will not forget it," he says. You will report that you never found him.'; } }] } },
    crown_escort: { faction: 'crown', name: 'Guard the tax chest', minRank: 1, targets: ['village', 'town'], hops: 3, n: 1,
      brief: t => 'The tithe from ' + C.NODES[t[0]].name + ' needs an escort back to the keep. Last time it did not arrive.',
      steps: t => [S_('fight', { at: t[0] })], reward: lv => ({ gold: 35 + 6 * lv, standing: 40 }),
      fight: { name: 'The tax-road ambush', enemies: lv => OUTLAWS[lv > 5 ? 1 : 0], text: 'You are a mile out of the village when the arrows start.' } },
    crown_tithe: { faction: 'crown', name: 'Collect the tithe', minRank: 2, targets: ['village', 'hamlet'], hops: 3, n: 1,
      brief: t => C.NODES[t[0]].name + ' is short on its tithe for the second year running. The steward wants it collected.',
      steps: t => [S_('scene', { at: t[0] })], reward: lv => ({ gold: 0, standing: 0 }),
      scene: { setup: 'The reeve shows you the granary. It is half empty after a wet summer, and the village has forty mouths.\n\n"The Crown\'s tithe is the Crown\'s tithe," he says. "But if you take all of it, we will not eat through the winter."',
        options: [
          { id: 'full', label: 'Take the full tithe', effect: st => { S.serve(st, 'crown', 50, { reason: 'collected the full tithe' }); st.inventory.gold += 30; gw(st, -3, 'took a starving village\'s grain'); C.deed(st, 'crown', 'dark', 2, { public: true, tag: 'cruelty' }); return 'The carts are heavy going out. The children watch them go.'; } },
          { id: 'spare', label: 'Take what they can spare', effect: st => { S.serve(st, 'crown', 25, { reason: 'collected part of the tithe' }); C.deed(st, 'crown', 'gray', 1, { tag: 'law' }); return 'The steward will grumble. The village will get through the winter, just.'; } },
          { id: 'pay', label: 'Pay the shortfall yourself (65 gold)', cost: 65, effect: st => { st.inventory.gold -= 65; S.serve(st, 'crown', 15, { reason: 'paid a village\'s tithe' }); gw(st, 3, 'paid a village\'s tithe'); C.deed(st, 'crown', 'light', 2, { public: true, tag: 'mercy' }); return 'The reeve does not know what to say. The village will.'; } }] } },
    crown_levy: { faction: 'crown', name: 'Raise the levy', minRank: 2, targets: ['village', 'hamlet', 'town'], hops: 3, n: 1,
      brief: t => 'The Marshal needs men. ' + C.NODES[t[0]].name + ' owes the Crown six spears.',
      steps: t => [S_('scene', { at: t[0] })], reward: lv => ({ gold: 0, standing: 0 }),
      scene: { setup: 'Six names on the levy roll, for the border garrison. Four of them are the only sons of their mothers, and the mothers are standing at the back of the hall.',
        options: [
          { id: 'press', label: 'Take the six on the roll', effect: st => { S.serve(st, 'crown', 50, { reason: 'raised the levy' }); gw(st, -5, 'pressed only sons into the levy'); C.deed(st, 'crown', 'dark', 2, { public: true, tag: 'cruelty' }); return 'You ride out with six spears and a sound behind you you will hear for a while.'; } },
          { id: 'volunteers', label: 'Take volunteers only', effect: st => { S.serve(st, 'crown', 20, { reason: 'raised a short levy' }); C.deed(st, 'crown', 'light', 1, { tag: 'mercy' }); return 'Three come forward. The Marshal will want to know where the other three are.'; } },
          { id: 'subs', label: 'Hire substitutes (95 gold)', cost: 95, effect: st => { st.inventory.gold -= 95; S.serve(st, 'crown', 35, { reason: 'raised the levy with hired men' }); C.deed(st, 'crown', 'gray', 1, { tag: 'law' }); return 'Six sellswords, paid in advance. The roll is satisfied, if not the spirit of it.'; } }] } }
  };
  C.MAX_CONTRACTS = 3;
  C.contractBoard = function (st, at) {
    const own = C.factionOwner(st, at); if (!own || !isBoard(st, at, own) || (own !== 'hearthwatch' && (!S.standingTier || S.standingTier(st, own).id === 'hostile'))) return [];
    const per = Math.floor(day(st) / 4), kinds = Object.entries(C.CONTRACT_KINDS).filter(([, k]) => k.faction === own && workRank(st, own) >= k.minRank).map(([id]) => id);
    const taken = new Set(ctr(st).list.filter(c => c.board === at + '|' + per).map(c => c.slot)), out = [];
    for (let slot = 0; slot < 3 && kinds.length; slot++) {
      const kid = kinds[hsh(at + '|' + per + '|' + slot) % kinds.length], K = C.CONTRACT_KINDS[kid], pool = nearby(st, at, own, K.targets, K.hops, K.owners);
      if (pool.length < K.n) continue; const t = []; for (let i = 0; t.length < K.n && i < 20; i++) { const x = pool[hsh(at + '|' + per + '|' + slot + '|' + i) % pool.length]; if (!t.includes(x)) t.push(x); }
      if (t.length < K.n) continue;
      out.push({ slot, kind: kid, name: K.name, faction: own, targets: t, brief: K.brief(t), reward: K.reward(lvl(st)), taken: taken.has(slot) });
    }
    return out;
  };
  C.takeContract = function (st, at, slot) {
    const o = C.contractBoard(st, at).find(x => x.slot === slot); if (!o) return { ok: false, reason: 'No such contract' }; if (o.taken) return { ok: false, reason: 'Already taken' };
    const c = ctr(st); if (c.list.filter(x => x.state === 'active').length >= C.MAX_CONTRACTS) return { ok: false, reason: 'You can carry ' + C.MAX_CONTRACTS + ' contracts at a time' };
    const K = C.CONTRACT_KINDS[o.kind], k = { id: 'k' + (++c.n), kind: o.kind, faction: o.faction, giver: at, board: at + '|' + Math.floor(day(st) / 4), slot, day: day(st), state: 'active', name: o.name, brief: o.brief, reward: o.reward, steps: K.steps(o.targets).map(s => Object.assign({ done: false }, s)), pick: null };
    c.list.push(k); return { ok: true, contract: k };
  };
  C.contracts = st => ctr(st).list.filter(c => c.state === 'active').map(c => Object.assign({}, c, { ready: c.steps.every(s => s.done) }));
  const cById = (st, id) => ctr(st).list.find(c => c.id === id);
  // On arrival: tick visits; start a fight; or open a scene (one scene at a time, kept until chosen).
  C.contractArrive = function (st, at) {
    const out = { visited: [], fight: null, scene: null };
    for (const c of ctr(st).list.filter(x => x.state === 'active')) for (const s of c.steps) {
      if (s.done || s.at !== at) continue;
      if (s.type === 'visit') { s.done = true; out.visited.push(c.id); }
      else if (s.type === 'fight' && !out.fight && !st.world.wander) {
        const F = C.CONTRACT_KINDS[c.kind].fight, lv = lvl(st), region = C.NODES[at].region;
        const enc = { name: F.name, map: C.mapFor(st, region, at), rec: lv, enemyFaction: F.faction || 'outlaws', enemies: F.enemies(lv).map(e => Object.assign({}, e)), objective: null, once: false, wander: true, contract: c.id, reward: { xp: 50 + 12 * lv, gold: 10 + 4 * lv } };
        st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text: F.text }; C.ENCOUNTERS.wander = enc; out.fight = c.id;
      } else if (s.type === 'scene' && !out.scene) { ctr(st).scene = c.id; out.scene = C.contractScene(st); }
    }
    return out;
  };
  // the stakes of each contract choice, in words (writing pass 2)
  C.CONTRACT_HINTS = {
    'crown_deserter.bring': 'The law, done properly. The Crown approves.',
    'crown_deserter.hang': 'The Crown approves more. The village never forgets.',
    'crown_deserter.free': 'The Banner gains a rider. The Crown loses patience.',
    'crown_tithe.full': 'The Crown is pleased. The village starves.',
    'crown_tithe.spare': 'A fair share. Everyone grumbles a little.',
    'crown_tithe.pay': 'Your coin feeds them. The Hearthwatch hear of it.',
    'crown_levy.press': 'The Crown gets its men. The mothers get nothing.',
    'crown_levy.volunteers': 'Fewer men, and no grudges.',
    'crown_levy.subs': 'Your coin spares the sons.',
    'synd_collect.squeeze': 'The Syndicate is very pleased. The shop closes.',
    'synd_collect.terms': 'The Syndicate\'s way: he pays for years.',
    'synd_collect.cover': 'Your coin keeps the shop open.',
    'synd_note.bribe': 'The lord is owned. The Crown loses a little.',
    'synd_note.blackmail': 'The lord is owned, and the steward hates you.',
    'synd_note.leave': 'The lord keeps his dignity. The factor is disappointed.',
    'synd_rival.ruin': 'The Syndicate takes her market.',
    'synd_rival.buy': 'A fair price, and she keeps working.',
    'synd_rival.warn': 'She escapes. The factor will wonder how.',
    'synd_grimoire.sell': 'Good coin. The Synod would hang you for it.',
    'synd_grimoire.synod': 'The Synod is grateful. The Syndicate is not.',
    'synd_grimoire.burn': 'Nobody reads it. Nobody pays you for it.',
    'synod_inquiry.hand': 'The Synod is pleased. The Hearthwatch are not.',
    'synod_inquiry.license': 'On the list, for a fee she cannot afford.',
    'synod_inquiry.hide': 'She escapes. The Synod is short a name.',
    'synod_seize.burn': 'Only the dangerous books burn.',
    'synod_seize.down': 'Every book goes down to Vol\'Dun.',
    'synod_seize.keep': 'A spellbook for you. Nobody counts but you.',
    'synod_heretic.arrest': 'The Synod is pleased. The grain store rots.',
    'synod_heretic.extort': 'Coin for you, and a man in your debt.',
    'synod_heretic.warn': 'The ward gets finished. The Synod gets nothing.',
    'banner_toll.fair': 'A fair toll. The Crown calls it theft anyway.',
    'banner_toll.all': 'Rich pickings. Everyone hears who robbed them.',
    'banner_toll.bread': 'The village eats. The Banner gets little.',
    'banner_free.bribe': 'Quiet, and costly.',
    'banner_free.break': 'Loud. The Crown will want a name.',
    'banner_free.trade': 'A deal the Crown can live with.',
    'banner_granary.give': 'The hamlets eat, and love the Banner for it.',
    'banner_granary.sell': 'Coin from the Syndicate.',
    'banner_granary.burn': 'The Crown goes hungry, and so do the hamlets.',
    'hw_refuge.shelter': 'A night on the chapel floor, with them.',
    'hw_refuge.onward': 'A week\'s grace, for your coin.',
    'hw_refuge.labour': 'Coin for you, and debts for them.',
    'hw_fever.nurse': 'Two days. Nobody else dies.',
    'hw_fever.synod': 'It is cured. Her name goes in a Synod ledger.',
    'hw_fever.seal': 'The fever stops here. Not everyone inside survives.'
  };
  C.contractScene = function (st) {
    const id = ctr(st).scene, c = id && cById(st, id); if (!c) return null; const sc = C.CONTRACT_KINDS[c.kind].scene;
    return { contract: c.id, name: c.name, setup: sc.setup, options: sc.options.map(o => ({ id: o.id, label: o.label, ok: !o.cost || st.inventory.gold >= o.cost, hint: (C.CONTRACT_HINTS || {})[c.kind + '.' + o.id] || null })) };
  };
  C.contractChoose = function (st, optId) {
    const id = ctr(st).scene, c = id && cById(st, id); if (!c) return { ok: false, reason: 'Nothing to decide' };
    const o = C.CONTRACT_KINDS[c.kind].scene.options.find(x => x.id === optId); if (!o) return { ok: false, reason: 'Not an option' };
    if (o.cost && st.inventory.gold < o.cost) return { ok: false, reason: 'Not enough gold' };
    const text = o.effect(st); c.pick = optId; c.steps.forEach(s => { if (s.type === 'scene' && s.at === st.world.location) s.done = true; }); ctr(st).scene = null;
    return { ok: true, text, contract: c.id };
  };
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) {
      const E = C.ENCOUNTERS[encId], out = ae0.apply(this, arguments);
      if (E && E.contract && res && res.won) { const c = cById(st, E.contract); if (c) c.steps.forEach(s => { if (s.type === 'fight' && s.at === st.world.location) s.done = true; }); }
      return out; }; }
  C.reportContract = function (st, id) {
    const c = cById(st, id); if (!c || c.state !== 'active') return { ok: false, reason: 'No such contract' };
    if (!c.steps.every(s => s.done)) return { ok: false, reason: 'Not finished' };
    if (!isBoard(st, st.world.location, c.faction)) return { ok: false, reason: 'Report at one of their castles' };
    c.state = 'done'; c.doneDay = day(st); st.inventory.gold += c.reward.gold || 0;
    const changes = c.reward.standing ? S.serve(st, c.faction, c.reward.standing, { reason: 'Contract: ' + c.name }) : [];
    if (c.reward.goodwill) gw(st, c.reward.goodwill, 'Contract: ' + c.name);
    return { ok: true, gold: c.reward.gold || 0, changes };
  };
  // ready contracts that can be handed in at this place (the place sheet shows them; the Journal only points the way)
  C.contractsReportableAt = function (st, at) { return C.contracts(st).filter(c => c.ready && isBoard(st, at, c.faction)); };
  C.dropContract = function (st, id) {
    const c = cById(st, id); if (!c || c.state !== 'active') return { ok: false }; c.state = 'dropped';
    if (ctr(st).scene === id) ctr(st).scene = null; S.changeStanding(st, c.faction, -10, { reason: 'abandoned a contract', ripple: false }); return { ok: true };
  };
  C.contractsDone = (st, f) => ctr(st).list.filter(c => c.state === 'done' && (!f || c.faction === f)).length;

  // ---- the Crown's rank-2 beat: the knighting (a Move in the cast engine) ----
  C.LORE.crown_oath_light = { id: 'crown_oath_light', faction: 'crown', kind: 'ideal', depth: 0, text: 'The old oath: to the weak first, then the realm, then the Crown. Voss swore it once, and says he broke it at Marrow Ford.' };
  const oath = (path, line, deedW) => st => { fl(st).knighted = day(st); fl(st).crown_oath = path; C.deed(st, 'crown', path, deedW, { public: true, tag: 'oath' });
    if (path === 'light') C.learn(st, 'crown_oath_light', 'Sworn at Crown Keep'); st.inventory.items.chain_hauberk = (st.inventory.items.chain_hauberk || 0) + 1;
    return { text: line + ' Voss hands you a knight\'s hauberk. "Wear it where people can see. Then they will expect things of you."' }; };
  if (C.MOVES && !C.MOVES.some(m => m.id === 'crown_knighting')) C.MOVES.push({
    id: 'crown_knighting', who: 'voss', at: 'crown_keep', meet: 'fig_voss', trip: st => rankOf(st, 'crown') >= 2 && !fl(st).knighted,
    setup: 'A night\'s vigil in the chapel of Crown Keep, alone with a sword on the altar and the old king\'s empty chair behind it.\n\nAt dawn Lord Marshal Voss comes in, stiff with the cold. He is older than he looks from the gallery, and he looks at you as if you might be the last knight he makes.',
    lines: ['"Every knight swears to something first. The words are the same for everyone. What comes first is not."', '"So. To whom do you swear?"'],
    options: [
      { id: 'weak', label: '"To the weak, as the old oath says."', go: oath('light', '"That is the oath I took," Voss says. "I broke it at Marrow Ford. See that you do better."', 2) },
      { id: 'crown', label: '"To the Crown, whoever wears it."', go: oath('gray', '"An honest answer," Voss says. "Most give that one and pretend they gave the first."', 1) },
      { id: 'order', label: '"To order, whatever it costs."', go: oath('dark', '"Good," Voss says, and does not smile. "The realm needs a few of those. Not many."', 2) }] });

  // ---- arrival hook: contract steps (after the cast's beats and the road) ----
  { const tr0 = C.travel; C.travel = function (st, to) { const r = tr0.apply(this, arguments); if (!r || !r.ok) return r;
      if (!st.world.wander) { const a = C.contractArrive(st, to); r.contract = a; if (a.fight) r.wander = st.world.wander; } return r; }; }


  // ---- cross-faction harm: work that hurts a faction costs standing there ----
  C.harm = function (st, f, amount) {
    if (f === 'hearthwatch') { gw(st, -Math.max(1, Math.round(amount / 5)), 'harmed the Hearthwatch'); return; }
    S.changeStanding(st, f, -amount, { reason: 'your work hurt them', ripple: false });
  };
  // An option written as data: { serve: n (the contract's faction), harm: { faction: n }, gw, gold, cost, deed: [path, weight, public], item, flag, days, text }
  const OPT = (f, id, label, sp) => ({ id, label, cost: sp.cost, effect: st => {
    if (sp.cost) st.inventory.gold -= sp.cost; if (sp.gold) st.inventory.gold += sp.gold;
    if (sp.serve > 0) (f === 'hearthwatch' ? gw(st, sp.serve, label) : S.serve(st, f, sp.serve, { reason: label }));
    if (sp.serve < 0) (f === 'hearthwatch' ? gw(st, sp.serve, label) : S.changeStanding(st, f, sp.serve, { reason: label, ripple: false }));
    for (const [h, n] of Object.entries(sp.harm || {})) C.harm(st, h, n);
    for (const [h, n] of Object.entries(sp.help || {})) h === 'hearthwatch' ? gw(st, n, label) : S.changeStanding(st, h, n, { reason: label, ripple: false });
    if (sp.gw) gw(st, sp.gw, label);
    if (sp.deed) C.deed(st, f, sp.deed[0], sp.deed[1], { public: !!sp.deed[2] });
    if (sp.item) st.inventory.items[sp.item] = (st.inventory.items[sp.item] || 0) + 1;
    if (sp.flag) fl(st)[sp.flag] = day(st); if (sp.days) S.advanceDay(st, sp.days);
    return sp.text || ''; } });
  const BANDITS = { name: 'Road brigands', enemies: lv => OUTLAWS[lv > 5 ? 1 : 0], text: 'They are waiting where you were told they would be.' };
  const K = (id, def) => { C.CONTRACT_KINDS[id] = def; };
  const one = t => [S_('scene', { at: t[0] })], fightAt = t => [S_('fight', { at: t[0] })], visits = t => t.map(x => S_('visit', { at: x }));
  const names = t => t.map(x => C.NODES[x].name).join(' and ');

  // ---- the Syndicate: the rogue (debts, smuggling, secrets) ----
  const SY = 'syndicate';
  K('synd_collect', { faction: SY, name: 'Collect a debt', minRank: 0, targets: ['village', 'hamlet', 'town'], hops: 4, n: 1, owners: ['crown', 'syndicate'], brief: t => 'A shopkeeper at ' + names(t) + ' is three months behind.', steps: one, reward: lv => ({ gold: 10 + 3 * lv, standing: 0 }),
    scene: { setup: 'The shop is half empty and the shelves have been dusted for nothing. The owner is three months behind.\n\nHis daughter is minding the counter, and she already knows who you are.', options: [
      OPT(SY, 'squeeze', 'Take the stock as payment', { serve: 40, gold: 25, deed: ['dark', 2, true], text: 'You leave with a cart. The shop will not open tomorrow.' }),
      OPT(SY, 'terms', 'Write new terms: longer, dearer', { serve: 25, deed: ['gray', 1], text: 'He signs. He will be paying for years, but he will be paying.' }),
      OPT(SY, 'cover', 'Cover the arrears yourself (50 gold)', { cost: 50, serve: 10, gw: 2, deed: ['light', 2], text: 'The factor will ask no questions. Money is money.' })] } });
  K('synd_convoy', { faction: SY, name: 'Ride with a grain convoy', minRank: 0, targets: ['village', 'town', 'market'], hops: 4, n: 1, owners: ['syndicate', 'crown'], brief: t => 'A grain convoy is bound for ' + names(t) + '. The last one did not arrive.', steps: fightAt, reward: lv => ({ gold: 30 + 6 * lv, standing: 35 }), fight: BANDITS });
  K('synd_smuggle', { faction: SY, name: 'Move a cargo the Crown does not need to know about', minRank: 1, targets: ['village', 'town', 'hamlet'], hops: 4, n: 2, owners: ['crown'], brief: t => 'Sealed crates, two stops: ' + names(t) + '. Do not open them. Do not pay the tolls.', steps: visits, reward: lv => ({ gold: 45 + 8 * lv, standing: 35 }), harmOnReport: { crown: 15 } });
  K('synd_note', { faction: SY, name: 'Buy a lord\'s note', minRank: 1, targets: ['castle'], hops: 5, n: 1, owners: ['crown'], brief: t => 'The lord at ' + names(t) + ' owes more than he admits. The Syndicate would like to hold the paper.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'The lord\'s steward meets you in the buttery, nervous as a cat. His master\'s note of debt is in a strongbox upstairs. Whoever holds that note can tell a lord how to vote.', options: [
      OPT(SY, 'bribe', 'Bribe the steward (80 gold)', { cost: 80, serve: 40, harm: { crown: 10 }, deed: ['gray', 1], text: 'The note changes hands. The lord will learn who owns him at a time of the Syndicate\'s choosing.' }),
      OPT(SY, 'blackmail', 'Remind the steward what you know about his own accounts', { serve: 50, harm: { crown: 15 }, deed: ['dark', 2], text: 'He hands it over with shaking hands. He will hate you quietly for the rest of his life.' }),
      OPT(SY, 'leave', 'Leave the lord his dignity', { serve: -10, deed: ['light', 1], text: 'The factor will be disappointed. The lord will never know how close it was.' })] } });
  K('synd_rival', { faction: SY, name: 'Deal with a rival merchant', minRank: 2, targets: ['town', 'market', 'village'], hops: 5, n: 1, owners: ['crown', 'syndicate'], brief: t => 'An independent trader at ' + names(t) + ' is undercutting Syndicate grain.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'Her prices are fair and her stalls are full, and she pays no Syndicate fee. The Syndicate does not like fair, and it likes free even less.', options: [
      OPT(SY, 'ruin', 'Ruin her: buy her suppliers, call in her loans', { serve: 60, gold: 20, deed: ['dark', 2, true], text: 'By the next market day her stalls are empty. By the one after, they are Syndicate stalls.' }),
      OPT(SY, 'buy', 'Buy her out at a fair price (130 gold)', { cost: 130, serve: 40, deed: ['light', 1], text: 'She takes the money and a job. She runs the stall better than anyone you could have hired.' }),
      OPT(SY, 'warn', 'Warn her what is coming', { serve: -20, gw: 3, deed: ['light', 2], text: 'She sells up and leaves before the Syndicate can move. The factor wonders how she knew.' })] } });
  K('synd_grimoire', { faction: SY, name: 'Sell a grimoire', minRank: 2, targets: ['town', 'market', 'village'], hops: 5, n: 1, owners: ['syndicate', 'crown'], brief: t => 'A buyer at ' + names(t) + ' wants a book the Synod would burn. The Syndicate has one.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'The buyer is a pale young man with ink on his fingers and far too much money. The grimoire in your pack is warm to the touch, and the Synod would hang you for carrying it.', options: [
      OPT(SY, 'sell', 'Sell it, and do not ask what for', { serve: 50, gold: 60, harm: { synod: 20 }, deed: ['dark', 1], text: 'He clutches it like a drowning man clutches a rope.' }),
      OPT(SY, 'synod', 'Hand the book to the Synod instead', { serve: -15, help: { synod: 30 }, deed: ['gray', 1], text: 'The Synod thanks you. The Syndicate does not.' }),
      OPT(SY, 'burn', 'Burn it and tell the factor it was a fake', { serve: -5, deed: ['light', 1], text: 'Some books should not be read by anyone. You decide this was one.' })] } });

  // ---- the Synod: the mage (policing magic, or hoarding it) ----
  const SN = 'synod';
  K('synod_wards', { faction: SN, name: 'Renew the wards', minRank: 0, targets: ['village', 'hamlet', 'town'], hops: 4, n: 2, owners: ['synod', 'crown'], brief: t => 'The wardstones at ' + names(t) + ' are failing.', steps: visits, reward: lv => ({ gold: 20 + 5 * lv, standing: 25 }) });
  K('synod_renegade', { faction: SN, name: 'Put down a renegade', minRank: 0, targets: ['zone', 'hamlet'], hops: 4, n: 1, owners: ['synod', 'crown', null], brief: t => 'A renegade adept is burning farms near ' + names(t) + '. This one is real.', steps: fightAt, reward: lv => ({ gold: 30 + 6 * lv, standing: 35 }),
    fight: { name: 'A renegade adept', enemies: lv => [{ primary: 'wizard', name: 'Renegade Adept' }, { primary: 'apprentice', name: 'Fire-Touched' }, { primary: lv > 5 ? 'warrior' : 'squire', name: 'Hired Blade' }], text: 'The field is on fire before you see who lit it.' } });
  K('synod_inquiry', { faction: SN, name: 'Inquire into a hedge-witch', minRank: 1, targets: ['village', 'hamlet'], hops: 4, n: 1, owners: ['synod', 'crown'], brief: t => 'Someone at ' + names(t) + ' is curing fevers without a licence.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'She is an old woman with a garden full of herbs and a cat that watches you. Half the village owes her its life, and the other half owes her for warts.\n\nShe has no licence. She knows the Synod does not grant them to women like her.', options: [
      OPT(SN, 'hand', 'Hand her to the inquisitors', { serve: 40, harm: { hearthwatch: 10 }, deed: ['dark', 2, true], text: 'The village watches the cart leave. Nobody speaks to you on the way out.' }),
      OPT(SN, 'license', 'License her, for a fee she can barely pay', { serve: 20, gold: 10, deed: ['gray', 1], text: 'She is on the Synod\'s list now. Lists have a way of growing.' }),
      OPT(SN, 'hide', 'Report the cottage empty, and warn her', { serve: -15, gw: 3, help: { broken_banner: 10 }, deed: ['light', 2], text: 'She is gone by nightfall. The Banner has a new healer.' })] } });
  K('synod_confession', { faction: SN, name: 'Escort a confession', minRank: 1, targets: ['village', 'town'], hops: 4, n: 1, owners: ['synod', 'crown'], brief: t => 'A sealed confession must travel from ' + names(t) + ' to the Ash Court. Someone would rather it did not.', steps: fightAt, reward: lv => ({ gold: 35 + 6 * lv, standing: 40 }), fight: BANDITS });
  K('synod_seize', { faction: SN, name: 'Seize a library', minRank: 2, targets: ['town', 'village', 'market'], hops: 5, n: 1, owners: ['syndicate', 'crown', 'synod'], brief: t => 'A private library at ' + names(t) + ' holds books on the Synod\'s list.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'A scholar\'s library: three shelves of the forbidden and one of the merely embarrassing. The owner watches from the doorway with his hands clasped.\n\n"Some of those were my grandmother\'s," he says.', options: [
      OPT(SN, 'burn', 'Burn the dangerous ones, leave the rest', { serve: 25, deed: ['light', 1, true], text: 'The smoke is green for an hour. The owner keeps his poetry.' }),
      OPT(SN, 'down', 'Send every book to Vol\'Dun', { serve: 45, harm: { syndicate: 10 }, deed: ['gray', 1], text: 'Three carts, sealed with a closed eye. They go down, not out.' }),
      OPT(SN, 'keep', 'Send most of it to Vol\'Dun, and keep the best for yourself', { serve: 35, item: 'spellbook', deed: ['dark', 2], text: 'No one counts the books but you.' })] } });
  K('synod_heretic', { faction: SN, name: 'Arrest a Syndicate mage', minRank: 2, targets: ['town', 'market', 'village'], hops: 5, n: 1, owners: ['syndicate'], brief: t => 'A mage at ' + names(t) + ' sells wards to Syndicate warehouses. The Synod calls that heresy.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'The Syndicate mage is mending a ward on a grain store, so the rats and the damp stay out. It is very good work, better than the Synod\'s own.\n\nHe has no licence. He looks up when your shadow falls across the chalk.', options: [
      OPT(SN, 'arrest', 'Arrest him', { serve: 50, harm: { syndicate: 20 }, deed: ['gray', 1, true], text: 'The warehouse is unwarded by morning. Someone will rob it by the week\'s end.' }),
      OPT(SN, 'extort', 'Let him go, for a price', { serve: 10, gold: 60, deed: ['dark', 2], text: 'He pays. He will pay again, next time anyone from the Synod comes calling.' }),
      OPT(SN, 'warn', 'Warn him and let him finish the ward', { serve: -15, help: { syndicate: 10 }, deed: ['light', 1], text: 'He finishes the ward, very quickly, and is gone.' })] } });

  // ---- the Broken Banner: outlaws with a knight's old oath, a rogue's methods and a hedge-mage or two ----
  const BB = 'broken_banner';
  K('banner_toll', { faction: BB, name: 'Take the Banner\'s toll', minRank: 0, targets: ['hamlet', 'village'], hops: 4, n: 1, owners: ['crown'], brief: t => 'A Crown caravan passes ' + names(t) + ' tomorrow.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'Two Crown supply wagons, and four guards who do not want to die for someone else\'s grain. The Banner calls it a toll. The Crown calls it robbery.', options: [
      OPT(BB, 'fair', 'Take a fair toll and let them pass', { serve: 25, gold: 20, harm: { crown: 10 }, deed: ['gray', 1], text: 'The guards look almost grateful.' }),
      OPT(BB, 'all', 'Take everything', { serve: 40, gold: 50, harm: { crown: 20 }, deed: ['dark', 2, true], text: 'The drivers walk home. They will tell everyone who robbed them.' }),
      OPT(BB, 'bread', 'Take a sack of flour for the village and wave them on', { serve: 10, gw: 2, deed: ['light', 2], text: 'The village eats well tonight. Old Standard shakes his head, but he is smiling.' })] } });
  K('banner_protect', { faction: BB, name: 'Guard a village the Crown forgot', minRank: 0, targets: ['hamlet', 'village'], hops: 4, n: 1, owners: ['crown', null], brief: t => 'Raiders keep hitting ' + names(t) + '. The Crown has not answered their letters.', steps: fightAt, reward: lv => ({ gold: 10 + 3 * lv, standing: 35, goodwill: 2 }), fight: BANDITS });
  K('banner_hedge', { faction: BB, name: 'Smuggle a hedge-mage to safety', minRank: 1, targets: ['village', 'hamlet'], hops: 4, n: 1, owners: ['synod', 'crown'], brief: t => 'A hedge-mage is hiding at ' + names(t) + '. The Synod is a day behind.', steps: fightAt, reward: lv => ({ gold: 10, standing: 40 }), harmOnReport: { synod: 15 },
    fight: { name: 'Synod hunters', faction: 'synod', enemies: lv => [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Ward-Reader' }], text: 'The Synod is not a day behind. It is here.' } });
  K('banner_free', { faction: BB, name: 'Free a Banner prisoner', minRank: 1, targets: ['castle'], hops: 5, n: 1, owners: ['crown'], brief: t => 'A Banner rider is in the cells at ' + names(t) + ', waiting for the rope.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'A Banner rider is in the Crown cells, due to hang at dawn. One guard on the night watch, and he looks like he hates the job.', options: [
      OPT(BB, 'bribe', 'Bribe the guard (65 gold)', { cost: 65, serve: 35, harm: { crown: 10 }, deed: ['gray', 1], text: 'The door is left unlocked. Nobody sees anything.' }),
      OPT(BB, 'break', 'Break him out', { serve: 50, harm: { crown: 25 }, deed: ['dark', 1, true], text: 'The guard will wake with a headache and a story. The Crown will want a name.' }),
      OPT(BB, 'trade', 'Offer the Crown a trade: a bandit\'s head for the rider', { serve: 30, help: { crown: 10 }, deed: ['light', 1], text: 'The captain takes the deal. Everyone pretends it was his idea.' })] } });
  K('banner_granary', { faction: BB, name: 'Raid a Crown granary', minRank: 2, targets: ['village', 'town'], hops: 5, n: 1, owners: ['crown'], brief: t => 'The Crown\'s granary at ' + names(t) + ' is full while the hamlets around it starve.', steps: one, reward: lv => ({ gold: 0, standing: 0 }),
    scene: { setup: 'The Crown granary\'s doors are open and the guards are at supper. Sacks to the rafters, while the hamlets round it are eating bark.', options: [
      OPT(BB, 'give', 'Take it and hand it out to the hamlets', { serve: 40, gw: 4, harm: { crown: 20 }, deed: ['light', 2, true], text: 'Every hamlet for ten miles knows the Banner\'s colours by nightfall.' }),
      OPT(BB, 'sell', 'Take it and sell it on to the Syndicate', { serve: 40, gold: 60, harm: { crown: 20 }, help: { syndicate: 10 }, deed: ['gray', 1], text: 'The Syndicate pays well and asks nothing.' }),
      OPT(BB, 'burn', 'Burn it, so the Crown goes hungry too', { serve: 50, gw: -3, harm: { crown: 30 }, deed: ['dark', 2, true], text: 'The smoke can be seen from Crown Keep. So can the hamlets\' faces.' })] } });

  // ---- the Hearthwatch: the cleric (goodwill, no ranks; its tiers are the 'rank' for its board) ----
  const HW = 'hearthwatch';
  K('hw_tend', { faction: HW, name: 'Tend the sick', minRank: 0, targets: ['village', 'hamlet'], hops: 4, n: 2, owners: 'any', brief: t => 'The sick at ' + names(t) + ' need a visit, and a strong back to carry the water.', steps: visits, reward: lv => ({ gold: 0, goodwill: 4 }) });
  K('hw_bury', { faction: HW, name: 'Guard the burials', minRank: 0, targets: ['zone', 'hamlet', 'poi'], hops: 4, n: 1, owners: 'any', brief: t => 'Grave-robbers are digging up the poor at ' + names(t) + ' and selling what they find.', steps: fightAt, reward: lv => ({ gold: 5 + 2 * lv, goodwill: 5 }),
    fight: { name: 'Grave-robbers', enemies: lv => OUTLAWS[lv > 5 ? 1 : 0], text: 'Spades and lanterns among the graves. They drop the spades and draw knives.' } });
  K('hw_refuge', { faction: HW, name: 'Find room for refugees', minRank: 1, targets: ['village', 'town'], hops: 4, n: 1, owners: 'any', brief: t => 'Refugees from the Marches are sleeping in the road at ' + names(t) + '.', steps: one, reward: lv => ({ gold: 0 }),
    scene: { setup: 'Forty people from the Marches, three carts, one cow. The reeve wants them gone by nightfall. "We have nothing to feed them on," he says, and he is not lying.', options: [
      OPT(HW, 'shelter', 'Walk them to the nearest chapel and stay the night', { serve: 6, days: 1, deed: ['light', 2], text: 'Nobody is turned away. The chapel floor is crowded and warm.' }),
      OPT(HW, 'onward', 'Pay the reeve to let them stay a week (30 gold)', { cost: 30, serve: 3, deed: ['gray', 1], text: 'A week is not a home, but it is a week.' }),
      OPT(HW, 'labour', 'Sell their passage to a Syndicate labour gang', { serve: -4, gold: 40, help: { syndicate: 15 }, deed: ['dark', 2], text: 'They will have work, and debts to go with it. The chapel will hear about this.' })] } });
  K('hw_fever', { faction: HW, name: 'Answer a fever', minRank: 1, targets: ['hamlet', 'village'], hops: 4, n: 1, owners: 'any', brief: t => 'A fever has taken hold at ' + names(t) + '.', steps: one, reward: lv => ({ gold: 0 }),
    scene: { setup: 'Shutters closed, a child coughing behind every one. The local hedge-healer has not slept in three days.\n\nThe Synod could cure it. The Synod would also write down her name.', options: [
      OPT(HW, 'nurse', 'Stay and nurse them (two days)', { serve: 6, days: 2, deed: ['light', 2], text: 'Two days without sleep. Nobody else dies.' }),
      OPT(HW, 'synod', 'Send for Synod healers', { serve: 2, help: { synod: 15 }, deed: ['gray', 1], text: 'They come, and they cure it. They also write down the hedge-healer\'s name.' }),
      OPT(HW, 'seal', 'Seal the hamlet until it burns out', { serve: -2, deed: ['dark', 2], text: 'The fever does not spread. Not everyone inside survives it.' })] } });

  // reporting a contract can hurt a rival (smuggling past Crown tolls, hiding a mage from the Synod)
  { const rc0 = C.reportContract; C.reportContract = function (st, id) { const c = cById(st, id), r = rc0.apply(this, arguments);
      if (r && r.ok && c) for (const [h, n] of Object.entries(C.CONTRACT_KINDS[c.kind].harmOnReport || {})) C.harm(st, h, n); return r; }; }

  // ---- lean, not lock: each faction favours its fantasy ----
  Object.assign(C.LEAN, { syndicate: { classes: ['scout'], mult: 0.75, needRank: 1 }, synod: { classes: ['apprentice'], mult: 0.75, needRank: 1 }, hearthwatch: { classes: ['acolyte'], mult: 0.75, needRank: 1 },
    broken_banner: { classes: ['squire', 'scout', 'acolyte', 'apprentice'], mult: 0.85, needRank: 1 } });
  { const rm0 = C.recruitMult; C.recruitMult = function (st, at, cls) { const own = C.ownerOf(st, at); if (own === 'hearthwatch') { const L = C.LEAN.hearthwatch; return L.classes.includes(cls) && workRank(st, own) >= L.needRank ? L.mult : 1; } return rm0.apply(this, arguments); }; }

  // ---- the Banner and the Hearthwatch become playable; first contact with the Banner comes through Corporal Hask ----
  ['broken_banner', 'hearthwatch'].forEach(f => { if (window.GAME_DATA.factions[f]) window.GAME_DATA.factions[f].active = true; });
  { const lo0 = C.lore; C.lore = function (st, ev) { const r = lo0.apply(this, arguments);
      if (ev === 'npc:hask:3' && !fl(st).banner_contact) { fl(st).banner_contact = day(st); if (C.discoverRoute) C.discoverRoute(st, st.world.location, 'outlaws_rest'); else if (C.discover) C.discover(st, 'outlaws_rest'); if (S.markMet) S.markMet(st, 'broken_banner'); }
      return r; }; }

  // ---- rank-2 beats: the Agent, the Warden, the Rider; Hearthwatch chapters 1 and 2 ----
  const beat = (id, who, at, trip, setup, lines, opts) => ({ id, who, at, trip, setup, lines, options: opts });
  const BO = (id, label, sp, extra) => ({ id, label, go: st => { const t = OPT(sp.f, id, label, sp).effect(st); if (extra) extra(st); return { text: t }; } });
  if (C.MOVES) C.MOVES.push(
    beat('synd_agent', 'crane', 'river_cities', st => rankOf(st, SY) >= 2 && !fl(st).synd_agent,
      'In Gildhaven\'s green room, Factor Crane signs your name into a ledger bound in green leather, then turns it round so you can see. Agent Marsh stands behind your chair, very still.',
      ['"Agents get the first rule. Everyone else learns it the hard way."', '"So tell me what you think it is."'],
      [BO('paid', '"Every debt gets paid."', { f: SY, deed: ['dark', 2, true], item: 'steel_dagger', flag: 'synd_agent', text: '"Close enough," Crane says. "You will do well here."' }),
       BO('written', '"Every debt gets written down."', { f: SY, deed: ['gray', 1], item: 'steel_dagger', flag: 'synd_agent', text: '"That is the first rule," Crane says, surprised.' }),
       BO('person', '"Every debtor is a person."', { f: SY, deed: ['light', 2, true], item: 'steel_dagger', flag: 'synd_agent', text: '"That is not a rule," Crane says. "That is a weakness. Keep it quiet."' })]),
    beat('synod_warden', 'ilvane', 'voldun', st => rankOf(st, SN) >= 2 && !fl(st).synod_warden,
      'In the Ward-Hall, Archon Ilvane herself presses the Warden\'s brand into a dish of hot wax and hands you the seal. Warden Vell watches from the ring of stones, and nods once.',
      ['"Magic is a fire," the Archon says. "Every Warden says what they do with fire, once, and we write it down. You will be held to it."'],
      [BO('bank', '"I bank it, so it cannot spread."', { f: SN, deed: ['light', 1], item: 'mana_ring', flag: 'synod_warden', text: 'She writes it down. "A careful answer."' }),
       BO('guard', '"I guard it, so no one else can use it."', { f: SN, deed: ['gray', 1], item: 'mana_ring', flag: 'synod_warden', text: 'She writes it down. "The usual answer."' }),
       BO('own', '"I keep it."', { f: SN, deed: ['dark', 2], item: 'mana_ring', flag: 'synod_warden', text: 'She looks at you for a long time before she writes it down. "The Inner Circle\'s answer."' })]),
    beat('banner_rider', 'old_standard', 'outlaws_rest', st => rankOf(st, BB) >= 2 && !fl(st).banner_rider,
      'At the fire, in front of everyone, Old Standard ties a strip of the old banner round your arm: faded red, older than you, and stiff with something that was once blood.',
      ['"Every rider tells me once why they ride. Then I never ask again."'],
      [BO('king', '"For the old kingdom."', { f: BB, deed: ['gray', 1], item: 'traveler_boots', flag: 'banner_rider', text: '"Good," he says. "Somebody should remember it."' }),
       BO('villages', '"For the villages nobody else will defend."', { f: BB, deed: ['light', 2, true], item: 'traveler_boots', flag: 'banner_rider', text: '"That is what we were for," he says quietly.' }),
       BO('plunder', '"For whatever I can carry."', { f: BB, deed: ['dark', 2], item: 'traveler_boots', flag: 'banner_rider', text: '"Honest," he says. "We have plenty of those."' })]),
    beat('hw_refugees', 'agathe', 'millstream', st => !!fl(st).marches_warned && !fl(st).hw_ch1,
      'The chapel at Millstream is full: families from the Marches, sleeping between the pews. The warden looks at you as if you might be help.',
      ['"They keep coming. Forty last night, more today. We have bread for two more days."', 'A boy of about six is asleep on the chapel\'s last sack of flour, holding a wooden sword.', '"The Crown has grain at Rivermeet," the warden says. "It will want a reason. What would you do?"'],
      [BO('open', 'Give what you have and stay to help (50 gold)', { f: HW, cost: 50, serve: 10, deed: ['light', 2, true], flag: 'hw_ch1', text: 'You stay the night. In the morning, so do they.' }),
       BO('crown', 'Petition the Crown for grain', { f: HW, serve: 5, deed: ['gray', 1], flag: 'hw_ch1', text: 'The Crown sends half a cart and a lecture. It is something.' }),
       BO('move', 'Tell them to move on to the next town', { f: HW, serve: -3, deed: ['dark', 1], flag: 'hw_ch1', text: 'They go. The warden does not look at you again.' })]),
    beat('hw_fever_priory', 'agathe', 'hearthstone_priory', st => !!fl(st).hw_ch1 && workRank(st, HW) >= 1 && !fl(st).hw_ch2,
      'Fever in the mother-house itself. Mother Agathe is in the infirmary with her sleeves rolled up, and she does not look up.',
      ['"The Synod will cure it in a day, if we let them in. They will also write down the name of everyone sleeping here."', '"Some of the people sleeping here would rather not be written down."'],
      [BO('nurse', 'Help nurse it out (three days)', { f: HW, serve: 15, days: 3, deed: ['light', 2], flag: 'hw_ch2', text: 'Three days. Two people die who might have lived. Nobody is written down.' }),
       BO('synod', 'Bring in the Synod', { f: HW, serve: 5, help: { synod: 20 }, deed: ['gray', 1], flag: 'hw_ch2', text: 'Nobody dies. The Synod\'s clerks fill a ledger.' }),
       BO('names', 'Bring in the Synod, and give them the names they want', { f: HW, serve: -5, help: { synod: 40 }, deed: ['dark', 2], flag: 'hw_ch2', text: 'Nobody dies of the fever. Agathe will not speak to you for a long time.' })])
  );

  C.validateWork = function () {
    const p = [], F = window.GAME_DATA.factions, cls = window.GAME_DATA.classes;
    Object.entries(C.CONTRACT_KINDS).forEach(([id, k]) => {
      if (!F[k.faction]) p.push('contract ' + id + ': unknown faction');
      if (k.steps(['x']).some(s => s.type === 'fight') && !k.fight) p.push('contract ' + id + ': fight step without a fight');
      if (k.steps(['x']).some(s => s.type === 'scene') && !k.scene) p.push('contract ' + id + ': scene step without a scene');
      if (k.fight && cls) [1, 9].forEach(lv => k.fight.enemies(lv).forEach(e => { if (!cls[e.primary] || cls[e.primary].selectable === false) p.push('contract ' + id + ': illegal class ' + e.primary); }));
    });
    (C.EVENTS || []).forEach(e => { if (!e.trip && !(e.day >= 0)) p.push('event ' + e.id + ': no trigger'); });
    return p;
  };
  (window.GAME_WORK_HOOKS || []).forEach(f => f()); window.GAME_WORK_HOOKS = { push: f => f() };   // faction_climax.js builds on this
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.MOVES) go(); else (window.GAME_CAST_HOOKS = window.GAME_CAST_HOOKS || []).push(go);
})();
