/* The story's glue (design/story_world.md). Pure rules, no screens. Needs faction_climax.js.
   1. Reputation on two scales, Mercy (kind to cruel) and Honesty (true to deceitful), built from deeds. Public deeds count in full,
      private ones at a third (word gets around). Each faction's own story still reads its light/gray/dark lean.
   2. The early choices (the opening jobs, road events) and the deceits in later scenes become deeds.
   3. Act I seeds the Interval and the claimants: notice boards, tavern gossip, road sights, two short scenes (Corisande, Osric).
   4. Real fights for the Hall of Oaths, sieges on your hold, taking it back, and the Marches (shaped by your choice there). */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
  if (C.STORY_WORLD) return; C.STORY_WORLD = true;
  const fl = st => st.world.flags, day = st => st.world.day;
  const gw = (st, d, why) => { if (S.changeGoodwill && d) S.changeGoodwill(st, d, why); };
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const L = (id, f, kind, text) => { C.LORE[id] = { id, faction: f, kind, depth: 0, text }; };

  // ===== 1. Reputation: Mercy and Honesty =====
  { const d0 = C.deed; C.deed = function (st, faction, path, weight, opts) {
      opts = opts || {}; const d = d0.call(this, st, faction, path, weight, opts), w = weight || 0;
      d.axes = Object.assign({ mercy: path === 'light' ? w : path === 'dark' ? -w : 0, honesty: 0 }, opts.axes || {}); return d; }; }
  C.REPUTE = {
    mercy: [{ id: 'cruel', name: 'Cruel', max: -8 }, { id: 'hard', name: 'Hard', max: -3 }, { id: 'none', name: '', max: 3 }, { id: 'kind', name: 'Kind', max: 8 }, { id: 'merciful', name: 'Merciful', max: Infinity }],
    honesty: [{ id: 'deceitful', name: 'Deceitful', max: -8 }, { id: 'sly', name: 'Sly', max: -3 }, { id: 'none', name: '', max: 3 }, { id: 'honest', name: 'Honest', max: 8 }, { id: 'true', name: 'True to your word', max: Infinity }],
    privateShare: 1 / 3
  };
  const tierOf = (list, v) => list.find(t => v < t.max) || list[list.length - 1];
  C.reputation = function (st) {
    let mercy = 0, honesty = 0; ((st.world.morals || {}).deeds || []).forEach(d => { const a = d.axes || { mercy: d.path === 'light' ? d.weight : d.path === 'dark' ? -d.weight : 0, honesty: 0 }, k = d.public ? 1 : C.REPUTE.privateShare; mercy += a.mercy * k; honesty += (a.honesty || 0) * k; });
    mercy = Math.round(mercy * 10) / 10; honesty = Math.round(honesty * 10) / 10;
    return { mercy, honesty, mercyTier: tierOf(C.REPUTE.mercy, mercy), honestyTier: tierOf(C.REPUTE.honesty, honesty) };
  };

  // ===== 2. Choices become deeds =====
  // [faction (null = no faction), path, weight, public, axes]
  const CHOICE_DEEDS = {
    'pennant_debt:collect': ['syndicate', 'dark', 1, true], 'pennant_debt:pay': ['syndicate', 'light', 2, true], 'pennant_debt:forgive': ['syndicate', 'light', 1, false, { honesty: -1 }],
    'sealed_letter:deliver': ['synod', 'gray', 1, false, { honesty: 1 }], 'sealed_letter:read': ['synod', 'gray', 1, false, { honesty: -1 }], 'sealed_letter:burn': ['synod', 'gray', 1, true],
    'hedge_mage:hand': ['synod', 'dark', 2, true], 'hedge_mage:hide': ['synod', 'light', 2, false, { honesty: -1 }], 'hedge_mage:warn': ['synod', 'light', 1, false, { honesty: 1 }],
    'road_hurt_trader:help': [null, 'light', 1, true], 'road_hurt_trader:rob': [null, 'dark', 2, false], 'road_pilgrim:escort': [null, 'light', 1, true], 'road_pilgrim:water': [null, 'light', 1, false],
    'road_hunter:help': [null, 'light', 1, true], 'road_shrine:take': [null, 'dark', 1, false, { honesty: -1 }], 'road_shrine:tend': [null, 'light', 1, false],
    'carrow_tower:loot': [null, 'gray', 0, false, { honesty: -1 }], 'carrow_tower:report': ['crown', 'gray', 0, false, { honesty: 1 }], 'reliquary_hill:steal': [null, 'dark', 1, false, { honesty: -1 }],
    'whitestone_abbey:donate': [null, 'light', 1, false], 'moonwell:take': [null, 'dark', 1, false, { honesty: -1 }], 'tidemother_shrine:dive': [null, 'dark', 1, false, { honesty: -1 }],
    'bad_paper:burn': ['syndicate', 'gray', 1, false], 'bad_paper:buy': ['syndicate', 'gray', 1, false], 'pardon_writ:favour': ['crown', 'gray', 0, false, { honesty: -1 }]
  };
  // deceits and honesty in later scenes: extra deeds on top of the scene's own (honesty only)
  const HONESTY = {
    'contract:crown_deserter:free': [-1, false], 'contract:synd_note:bribe': [-1, false], 'contract:synd_note:blackmail': [-2, false], 'contract:synod_inquiry:hide': [-1, false],
    'contract:synod_heretic:extort': [-1, false], 'contract:synd_grimoire:burn': [-1, false], 'contract:banner_free:bribe': [-1, false], 'contract:banner_free:trade': [1, true],
    'move:thorne_parley:lie': [-2, false], 'move:thorne_parley:show': [1, false], 'move:osric_purse:take': [-1, false], 'move:harrow_office:accept': [-1, false],
    'move:crown_barrow_writ:lords': [2, true], 'move:crown_barrow_writ:harrow': [-2, false], 'move:synd_hand:expose': [2, true], 'move:synd_hand:ledger': [-1, false],
    'move:synod_tithe:truth': [2, true], 'move:crane_buyer:sell': [-1, false], 'move:harrow_price:give': [-1, false], 'move:crown_lords_hand:purse': [-1, false]
  };
  C.CHOICE_DEEDS = CHOICE_DEEDS; C.HONESTY_DEEDS = HONESTY;
  const honest = (st, key, faction) => { const h = HONESTY[key]; if (h) C.deed(st, faction, 'gray', 0, { public: h[1], axes: { mercy: 0, honesty: h[0] }, tag: 'honesty' }); };
  { const ac0 = C.applyChoice; C.applyChoice = function (st, cid, oid) { const r = ac0.apply(this, arguments); const d = CHOICE_DEEDS[cid + ':' + oid];
      if (r && r.ok && d) C.deed(st, d[0], d[1], d[2], { public: d[3], axes: d[4] ? Object.assign({ mercy: d[1] === 'light' ? d[2] : d[1] === 'dark' ? -d[2] : 0 }, d[4]) : undefined, tag: 'choice' }); return r; }; }
  { const cc0 = C.contractChoose; C.contractChoose = function (st, optId) { const id = st.world.contracts && st.world.contracts.scene, c = id && st.world.contracts.list.find(x => x.id === id), r = cc0.apply(this, arguments);
      if (r && r.ok && c) honest(st, 'contract:' + c.kind + ':' + optId, c.faction); return r; }; }
  { const cm0 = C.chooseMove; C.chooseMove = function (st, optId) { const id = st.world.moves && st.world.moves.pending, r = cm0.apply(this, arguments);
      if (r && r.ok && id) honest(st, 'move:' + id + ':' + optId, null); return r; }; }

  // ===== 3. Act I: seeding the Interval and the claimants =====
  L('interval_hint', 'crown', 'view', 'Folk call the wait for a new king "the Interval". Nobody will say how long it is meant to last, and the lords change the subject.');
  L('osric_spears', 'crown', 'view', 'Lord Osric drills more spears at Aldermere than any border lord needs. "Whoever the realm needs," his sergeant says, when asked whose king they drill for.');
  L('corisande_bread', 'hearthwatch', 'view', 'Lady Corisande Hale hands out bread at the Millstream chapel herself, sleeves rolled up. The pilgrims call her "the poor folk\'s lady".');
  if (C.TV_GOSSIP) C.TV_GOSSIP.push(
    { id: 'interval', if: st => !st.world.realm, lines: ['How long since the old king died, now?', 'Long enough that the lords gave the wait a name. The Interval. Do not ask them how long it is meant to last.'] },
    { id: 'claimants', if: st => !st.world.realm && day(st) >= 3, lines: ['If the lords ever pick, it will be Osric of Aldermere. He has the spears.', 'Or Lady Hale. The poor love her, and she has never once asked them for anything.'] },
    { id: 'laughing_rider', if: st => !st.world.realm, lines: ['There is a Banner boy who laughs like the old king did. My father served the old king. Same laugh.', 'Say that louder and the Crown will hang you for it, and him.'] },
    { id: 'rep_kind', if: st => ['kind', 'merciful'].includes(C.reputation(st).mercyTier.id), lines: ['Heard of a traveller who paid a whole village\'s tithe out of their own purse.', 'Someone like that will not last long. Pity.'] },
    { id: 'rep_cruel', if: st => ['hard', 'cruel'].includes(C.reputation(st).mercyTier.id), lines: ['There is someone on the roads who hangs first and asks after.', 'Keep your voice down. They might be in here.'] },
    { id: 'rep_honest', if: st => ['honest', 'true'].includes(C.reputation(st).honestyTier.id), lines: ['They say there is one traveller whose word you can take to the bank.', 'Which bank? The Syndicate would not know what to do with it.'] },
    { id: 'rep_sly', if: st => ['sly', 'deceitful'].includes(C.reputation(st).honestyTier.id), lines: ['Count your fingers after you shake hands with that one.', 'Count them twice.'] }
  );
  { const tv0 = C.tavernVisit; if (tv0) C.tavernVisit = function (st, id) { const r = tv0.apply(this, arguments); const seen = st.world.tvSeen || {};
      if (seen.interval) C.learn(st, 'interval_hint', 'Overheard in a tavern'); return r; }; }
  if (C.ROAD_SIGHTS) C.ROAD_SIGHTS.push(
    'A young Banner rider gallops past, laughing at something, and tips a hat he is not wearing. The old man at the roadside stares after him.',
    'A column of Aldermere spearmen marches by in step, more of them than any border needs.',
    'A cart stacked with loaves rolls toward Millstream. The woman driving it has a lady\'s voice and a farmer\'s hands.',
    'A Synod prisoner-cart rattles past, heading east toward Vol\'Dun. The woman inside it is still holding a sprig of rosemary.',
    'A Syndicate courier gallops by with a sealed satchel. Behind him, a minute later, a second rider in grey, not hurrying, following.',
    'Somebody has scratched a crown on a milestone, and then scratched it out. Somebody else has drawn it again.'
  );
  { const nb0 = C.noticeBoard; if (nb0) C.noticeBoard = function (st, id) { const out = nb0.apply(this, arguments); if (!out || st.world.realm) return out;
      const own = C.ownerOf(st, id), extra = own === 'crown' ? 'By order of the Steward: the Interval continues. Tithes are due as before. E. Harrow, Steward of the Seal.'
        : own === 'syndicate' ? 'Factor O. Crane will hear petitions for credit on the first day of each week.' : own === 'synod' ? 'The Archon Ilvane reminds all: unlicensed magic is a danger to your neighbours. Report it.'
        : own === 'hearthwatch' ? 'Bread for any who need it, market days, by the kindness of Lady Corisande Hale.' : null;
      if (extra && out[0] && !/^Nothing but/.test(out[0])) out.splice(1, 0, extra); else if (extra) out.splice(0, out.length, extra);
      // Hearthwatch places are villages and priories, which have no board: Lady Hale's bread is posted in the towns near Millstream instead
      if (own !== 'hearthwatch' && HALE_BOARDS[id]) out.splice(Math.min(2, out.length), 0, 'Bread for any who need it, market days at Millstream, by the kindness of Lady Corisande Hale.');
      return out.slice(0, 5); }; }
  const HALE_BOARDS = (() => { const o = {}, d = { millstream: 0 }, q = ['millstream']; if (!C.NODES.millstream) return o;
    while (q.length) { const x = q.shift(); if (d[x] >= 2) continue; Object.keys(C.NODES[x].links || {}).forEach(y => { if (!(y in d) && C.NODES[y]) { d[y] = d[x] + 1; q.push(y); } }); }
    Object.keys(d).forEach(k => { if (d[k] > 0 && ['town', 'market', 'capital', 'castle'].includes(C.NODES[k].type)) o[k] = 1; }); return o; })();
  const B = (id, label, go, cond) => ({ id, label, go, if: cond });
  [{ id: 'corisande_chapel', who: 'corisande', at: 'millstream', meet: 'fig_corisande', trip: st => !st.world.realm,
      setup: 'The chapel at Millstream has a queue out of the door. At the front, a woman in a plain grey dress is handing out loaves, sleeves rolled to the elbow.',
      lines: ['"Take two," she tells a boy. "One for later. Nobody ever plans for later."', 'A pilgrim beside you whispers: "That is Lady Hale. Royal blood, they say. She comes every market day."'],
      options: [B('help', 'Help hand out the bread', st => { gw(st, 2, 'helped at Millstream'); C.deed(st, 'hearthwatch', 'light', 1, { public: true }); C.learn(st, 'corisande_bread', 'Millstream chapel'); return { text: '"Thank you," she says, without looking up. "Nobody plans for later. You did."' }; }),
        B('ask', 'Ask her about the Interval', st => { C.learn(st, 'interval_hint', 'Lady Hale, at Millstream'); C.learn(st, 'corisande_bread', 'Millstream chapel'); return { text: '"It is what the lords call waiting for someone else to be brave," she says, and hands you a loaf.' }; }),
        B('leave', 'Leave her to it', st => { C.learn(st, 'corisande_bread', 'Millstream chapel'); return {}; })] },
    { id: 'osric_aldermere', who: 'osric', at: 'aldermere_hold', meet: 'fig_osric', trip: st => !st.world.realm,
      setup: 'The yard at Aldermere Hold is full of spearmen at drill. A big man in a plain coat watches from the steps, and the sergeants watch him.',
      lines: ['Lord Osric, without turning: "You look like someone who can count. How many do you make it?"'],
      options: [B('count', '"More than a border needs."', st => { C.learn(st, 'osric_spears', 'Aldermere Hold'); return { text: '"Good," he says. "Then you can count. Most cannot."' }; }),
        B('whose', '"Whose king are they drilling for?"', st => { C.learn(st, 'osric_spears', 'Aldermere Hold'); C.learn(st, 'interval_hint', 'Aldermere Hold'); return { text: '"Whoever the realm needs," he says, and finally looks at you. "Ask me again after the Interval."' }; }),
        B('leave', 'Nod and move on', () => ({}))] }
  ].forEach(m => { if (C.MOVES && !C.MOVES.some(x => x.id === m.id)) C.MOVES.push(m); });

  // ===== 4. Real fights for the Moot, the hold and the Marches =====
  const startFight = (st, enc, text) => { const at = st.world.location, region = C.NODES[at].region; enc.map = enc.map || C.mapFor(st, region, at); enc.once = false; enc.wander = true;
    st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text }; C.ENCOUNTERS.wander = enc; return { ok: true, fight: enc.name, text }; };
  // the Hall of Oaths: defend the result against Osric's men, or join them against the Crown's guard
  C.mootHallFight = function (st, side) {
    const m = C.moot(st); if (!m.hall || !m.hall.pending) return { ok: false, reason: 'Nothing is happening in the hall' };
    if (side === 'coup' && m.declared !== 'osric') return { ok: false, reason: 'Only Osric\'s backers join his men' }; if (side !== 'coup' && side !== 'defend') return { ok: false, reason: 'Pick a side' };
    const lv = lvl(st), defend = side === 'defend';
    return startFight(st, { name: 'The Hall of Oaths', rec: lv + 2, enemyFaction: defend ? 'aldermere' : 'crown', objective: { type: 'leader', leader: 0 }, hall: side, reward: { xp: 150 + 20 * lv, gold: 40 + 8 * lv },
      enemies: defend ? [{ primary: 'warlord', name: 'Lord Osric' }, { primary: 'warrior', name: 'Aldermere Knight' }, { primary: 'archer', name: 'Aldermere Bowman' }] : [{ primary: 'warlord', name: 'Lord Marshal Voss' }, { primary: 'bulwark', name: 'Crown Shield' }, { primary: 'archer', name: 'Crown Bowman' }] },
      defend ? 'Steel at the back of the hall. Osric\'s men have barred the doors from the inside. "The Moot has spoken," Osric says. "Now the realm will."' : 'You step down from the benches to stand with Aldermere. Voss draws his sword and looks very tired.');
  };
  // sieges on your hold, and taking it back
  const SIEGERS = { aldermere: { name: 'Aldermere banners on the ridge', enemies: [{ primary: 'warlord', name: 'Aldermere Captain' }, { primary: 'warrior', name: 'Aldermere Knight' }, { primary: 'archer', name: 'Aldermere Bowman' }] },
    crown: { name: 'The Crown has come for its hold', enemies: [{ primary: 'warrior', name: 'Royal Herald\'s Guard' }, { primary: 'bulwark', name: 'Crown Shield' }, { primary: 'archer', name: 'Crown Bowman' }] },
    syndicate: { name: 'Grey coats at the gate', enemies: [{ primary: 'assassin', name: 'Silent Auditor' }, { primary: 'rogue', name: 'Collector' }, { primary: 'marksman', name: 'Hired Rifle' }] },
    outlaws: { name: 'A warrant and a rough crowd', enemies: [{ primary: 'rogue', name: 'Bounty Hunter' }, { primary: 'archer', name: 'Hunter\'s Bowman' }, { primary: 'warrior', name: 'Thief-Taker' }] } };
  C.holdSiegeFight = function (st) {
    const h = st.world.hold; if (!h || !h.siege) return { ok: false, reason: 'No siege' }; if (st.world.location !== h.node) return { ok: false, reason: 'Be at your hold' };
    const by = SIEGERS[h.siege.by] ? h.siege.by : 'outlaws', S0 = SIEGERS[by], lv = lvl(st);
    return startFight(st, { name: 'Siege of your hold', rec: lv + 1, enemyFaction: by === 'outlaws' ? 'outlaws' : by, enemies: S0.enemies.map(e => Object.assign({}, e)), objective: { type: 'survive', turns: 5 }, holdSiege: true, reward: { xp: 120 + 16 * lv, gold: 20 + 6 * lv } }, S0.name + '. Your steward counts them twice and goes pale.');
  };
  C.retakeHoldFight = function (st, way) {
    const h = st.world.hold; if (!h || !h.lost) return { ok: false, reason: 'Your hold is not lost' }; if (st.world.location !== h.node) return { ok: false, reason: 'Be at your old gate' };
    const party = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).primary), sneak = party.some(p => ['rogue', 'scout', 'assassin'].includes(p)) || (S.goodwillTier && S.goodwillTier(st).id === 'trusted');
    if (way === 'door' && !sneak) return { ok: false, reason: 'You need a rogue or scout in the party, or the Hearthwatch\'s trust' };
    const by = SIEGERS[h.takenBy] ? h.takenBy : 'outlaws', lv = lvl(st);
    return startFight(st, { name: way === 'door' ? 'Through the side door' : 'Storming your own gate', rec: lv + (way === 'door' ? 0 : 2), enemyFaction: by === 'outlaws' ? 'outlaws' : by, enemies: SIEGERS[by].enemies.map(e => Object.assign({}, e)), objective: { type: 'leader', leader: 0 }, holdRetake: true, reward: { xp: 120 + 16 * lv, gold: 20 + 6 * lv } },
      way === 'door' ? 'The side door is still broken. Nobody ever fixed it.' : 'Your old gate, someone else\'s banner.');
  };
  // the Marches battle follows the choice made there
  { const eb0 = C.encounterBuilds; C.encounterBuilds = function (encId, optionId) { const r = eb0.apply(this, arguments); if (encId !== 'marches_defence' || !r) return r;
      const st = C._storyState, how = st && fl(st).crown_marches; if (!how) return r; const o = Object.assign({}, r, { builds: r.builds.slice() });
      if (how === 'evacuate') { o.rec = o.level = (r.rec || 1) + 1; o.objective = { type: 'survive', turns: 6 }; o.builds.forEach(b => { b.level = o.level; }); }
      if (how === 'burn') o.builds = o.builds.slice(0, 2);
      return o; }; }
  { const tr0 = C.travel, ns0 = C.nodeServices; C.travel = function (st) { C._storyState = st; return tr0.apply(this, arguments); }; C.nodeServices = function (st) { C._storyState = st; return ns0.apply(this, arguments); }; }   // the battle briefing has no state argument
  C.marchesBattle = function (st) { C._storyState = st; const b = C.encounterBuilds('marches_defence'); return b; };   // the screen asks for the builds through this so the choice applies
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) {
      const E = C.ENCOUNTERS[encId]; C._storyState = st; const out = ae0.apply(this, arguments), won = !!(res && res.won);
      if (E && E.hall) C.mootHall(st, E.hall, won);
      if (E && E.holdSiege) C.holdSiegeResult(st, won);
      if (E && E.holdRetake) C.retakeHold(st, won);
      if (E && E.badPaper && won) { fl(st).job_bad_paper = true; fl(st).bad_paper_burned = true; fl(st).choice_bad_paper = 'burn'; }
      if (encId === 'marches_defence' && won) { const how = fl(st).crown_marches; if (how === 'evacuate') gw(st, 3, 'the Marches folk are safe'); if (how === 'gate') S.serve(st, 'crown', 20, { reason: 'held the Marches gate' }); fl(st).marches_battle = how || 'plain'; }
      return out; }; }


  // ===== 5. Double lives: cut (node ownership phase 2, design/node_ownership_and_land.md section 9). One faction at a time, no Suspicion. =====

  // ===== 6. Loose ends from the first pass =====
  const rankN = (st, f) => { const r = S.getRank(st, f); return r ? r.rank : 0; };
  const sneakyParty = st => (st.party || []).some(id => ['rogue', 'scout', 'assassin'].includes(((st.roster || []).find(u => u.id === id) || {}).primary));
  // Bad Paper: burning the notes is a fight with the Exchange's guards (win it and the job is done; lose it and you can try again)
  if (C.CHOICES.bad_paper) { const b = C.CHOICES.bad_paper.options.find(o => o.id === 'burn'); if (b) { delete b.jobFlag; b.label = 'Burn them in the clerks\' own stove (the guards will not like it)'; } }
  { const ac1 = C.applyChoice; C.applyChoice = function (st, cid, oid) { const r = ac1.apply(this, arguments);
      if (r && r.ok && cid === 'bad_paper' && oid === 'burn') { const lv = lvl(st); delete fl(st).choice_bad_paper;
        Object.assign(r, startFight(st, { name: 'The Grain Exchange guards', rec: lv + 1, enemyFaction: 'syndicate', enemies: [{ primary: 'warrior', name: 'Exchange Guard' }, { primary: 'rogue', name: 'Enforcer' }, { primary: 'marksman', name: 'Counting-House Gun' }], objective: null, badPaper: true, reward: { xp: 70 + 12 * lv, gold: 15 } }, 'The paper catches. So does the guards\' attention.'), { fight: true }); }
      return r; }; }
  // Old Standard's pardon: from the Marshal, from Lady Hale, from the Steward for a price, or forged through the Syndicate
  if (C.NODES.crown_keep && C.NODES.crown_keep.choice === 'pardon_writ') delete C.NODES.crown_keep.choice;   // the scene below replaces the clerk's roll (kept in data for the job's checks)
  const jobOn = (st, id) => C.jobActive ? C.jobActive(st, id) : !!(st.world.jobs && st.world.jobs[id] && st.world.jobs[id].state === 'active');
  const mootLive = st => { const m = C.moot(st); return m.called !== null && !m.result; };
  // ===== 7. After the Moot =====
  const AFTER = {
    regency: { line: 'Harrow stands at the seal table as he always has. "Back to work," he says to no one in particular.', board: 'By order of the Steward: the Long Regency begins. Tithes are due as before.', talk: ['So nothing changed.', 'That was the point, they say. The bread is still cheap.', 'Harrow smiled at the count, they say. Nobody could tell you whether it was a good smile.', 'Five seats met, and a man kept his chair. I have seen less theatre at a fair.'] },
    osric: { line: 'King Osric\'s banners hang in the Hall of Oaths. The Synod\'s lamps burn along the walls, and there are patrols on every road.', board: 'By order of King Osric: the Ward will be raised. Report all unlicensed magic. Outlaws will hang.', talk: ['A king again. A strong one.', 'Strong is a word. Ask a hedge-witch what she thinks of it.', 'The patrols are polite, I will give them that. They only ask for your papers twice.', 'Lamps along the Keep wall every night now. You get used to the light. You do not get used to why.'] },
    corisande: { line: 'Queen Corisande holds court in a plain grey dress. The granary doors are open, and the Syndicate\'s clerks look worried.', board: 'By order of Queen Corisande: the Banner is pardoned. The granaries open in hard years. Aldermere is in rebellion.', talk: ['They say the Queen still hands out bread herself.', 'And Aldermere has shut its gates. Bread does not stop spears.', 'The granary clerks are sulking. First time in forty years someone has told them to give it away.', 'A grey dress and a wooden spoon. Say what you like, nobody is afraid of her. That is the worry.'] },
    wil: { line: 'King Wil sits on the old throne as if it might bite him. Old Standard stands behind it in a Marshal\'s coat that does not fit.', board: 'By order of King Wil: every rider of the Broken Banner is pardoned and may go home.', talk: ['A Banner boy on the throne. My father would not believe it.', 'Your father served his grandfather. He would believe it.', 'They say he asked if the chair was supposed to be that cold.', 'Old Standard keeps his hand on the back of it. Whether to hold the boy up or the chair down, nobody says.'] },
    ledger: { line: 'Harrow keeps the seal table, but the seal on it is new: a pair of scales. Factor Crane stands at his shoulder, learning the job. Voss\'s chair is empty.', board: 'By order of the Lord Treasurer: debts are the law. Every note in the realm is owed to the throne, and will be collected.', talk: ['So the Steward was the Hand all along, and now he says so.', 'At least he says so. The bread is still cheap.', 'My cousin owes the Second Book. Now he owes the king. Well. The Treasurer.'] },
    ilvane: { line: 'The Archon-Regent sits under the Ward\'s lamps in a plain black robe. Thorne stands below her in a Lord Inquisitor\'s chain, and Lady Hale\'s chair is empty.', board: 'By order of the Archon-Regent: the Ward will be fed. Report all hedge-craft. Lord Inquisitor Thorne keeps the roads.', talk: ['A priest on the throne. Well, a regent.', 'They took the herb-woman from our village last week. For a charm against warts.', 'The roads are safe, I\'ll give them that. Nobody is on them.'] },
    broken: { line: 'The Hall of Oaths is half empty. Half the Lords went with Osric, and the other half are counting who went.', board: 'The Moot found no majority. Aldermere calls itself a crown. The Steward keeps the seal, for now.', talk: ['Two crowns now. Which one do I pay?', 'Both, probably.', 'A tax-man from each side came through on the same day. They nodded to each other like it was market day.', 'My cousin marched for Osric. My brother held the Hall. Mother has stopped setting the table.'] }
  };
  // Voss, the morning after: weary honour, and a line about what it will cost whoever is left holding the road
  const VOSS_AFTER = {
    regency: '"Nothing changed," Voss says. "That is the cruelest result, and the safest. The Interval goes on, and I keep the road for a man I do not trust. Thank you for trying."',
    osric: '"I will serve him," Voss says. "I swore to serve whoever the Lords chose. But I have seen what Osric does with a road he thinks is his, and I am too old to pretend I have not."',
    corisande: '"She is kind," Voss says, "and kindness needs soldiers. I am going to ask Aldermere to stand down, and Aldermere is going to say no. I would like you with me when it does."',
    wil: '"A boy from the Banner," Voss says. "I left his people at Marrow Ford. I will carry that to my grave. I would very much like to carry him a sword instead."',
    ledger: '"I have resigned," Voss says. "I kept the road for a Steward I did not trust. I will not keep it for a ledger that says so out loud. Someone braver than me can explain that to the Lords."',
    ilvane: '"I will serve the Regent," Voss says. "The Lords chose her. But Thorne has my old maps now, and a list of every village with a hedge-witch in it. I would like you to be on the road when he uses them."',
    broken: '"Two crowns," Voss says, and laughs, once, without any joy in it. "Half the Lords will march for one, and half for the other. And the road between them is mine to keep. Gods help the road."'
  };
  C.AFTER_MOOT = AFTER;
  if (C.TV_GOSSIP) Object.entries(AFTER).forEach(([k, a]) => C.TV_GOSSIP.push({ id: 'realm_' + k, if: st => !!st.world.realm && st.world.realm.outcome === k, lines: a.talk }));
  { const nb1 = C.noticeBoard; if (nb1) C.noticeBoard = function (st, id) { const out = nb1.apply(this, arguments); const rl = st.world.realm; if (!out || !rl || !AFTER[rl.outcome]) return out;
      const n = C.NODES[id]; if (!n || n.region !== 'human') return out;
      if (out[0] && /^Nothing but/.test(out[0])) return [AFTER[rl.outcome].board]; out.splice(1, 0, AFTER[rl.outcome].board); return out.slice(0, 5); }; }
  const B7 = (id, label, go, cond) => ({ id, label, go, if: cond });
  [{ id: 'banner_pardon', who: 'old_standard', at: 'crown_keep', trip: st => jobOn(st, 'old_standards_price') && !fl(st).job_pardon,
      setup: 'A pardon needs a seal, and every seal at Crown Keep belongs to somebody.', lines: ['Old Standard\'s words: "A seal on it I cannot bite through."'],
      options: [B7('voss', 'Ask the Lord Marshal to sign it', st => { fl(st).job_pardon = day(st); if (fl(st).voss_pardon) fl(st).voss_pardon = 0; C.deed(st, 'crown', 'light', 1); return { text: 'Voss reads the names twice. "I left some of these men at Marrow Ford," he says, and signs.' }; }, st => !!fl(st).voss_pardon || rankN(st, 'crown') >= 3 || !!fl(st).voss_speak),
        B7('corisande', 'Ask Lady Hale', st => { fl(st).job_pardon = day(st); C.deed(st, 'hearthwatch', 'light', 1, { public: true }); return { text: 'She writes it on the spot, in her own hand, and seals it with a ring she rarely wears. "If I am queen, it stands. If I am not, it stands anyway."' }; }, st => mootLive(st) && !fl(st).corisande_withdrawn),
        B7('harrow', 'Ask the Steward, for a price', st => { fl(st).job_pardon = day(st); S.changeStanding(st, 'crown', -20, { reason: 'a pardon for outlaws', ripple: false }); C.deed(st, null, 'gray', 0, { axes: { mercy: 0, honesty: -1 } }); return { text: 'Harrow seals it without reading it. "Everything has a price," he says. "This one you will pay later."' }; }),
        B7('forge', 'Have the Syndicate forge one (65 gold)', st => { st.inventory.gold -= 65; fl(st).job_pardon = day(st); C.deed(st, 'syndicate', 'gray', 1, { axes: { mercy: 0, honesty: -2 } }); return { text: 'Dov Quill\'s cousin does seals. The wax is perfect. The signature is better than the real one.' }; }, st => rankN(st, 'syndicate') >= 1 && st.inventory.gold >= 65),
        B7('later', 'Not yet', () => ({ repeat: true }))] },
    { id: 'realm_court', who: 'voss', at: 'crown_keep', trip: st => !!st.world.realm,
      setup: 'Crown Keep, the first morning after the Moot. Lord Marshal Voss finds you in the yard, and for once he is not giving orders.', lines: [], view: st => { const o = st.world.realm.outcome, a = AFTER[o]; return [a ? a.line : '', VOSS_AFTER[o] || '']; },
      options: [B7('go', 'Go on', () => ({}))] }
  ].forEach(m => { if (C.MOVES && !C.MOVES.some(x => x.id === m.id)) C.MOVES.push(m); });
  // Thorne, turned, joins you (if there is room in the roster)
  { const cm1 = C.chooseMove; C.chooseMove = function (st, optId) { const id = st.world.moves && st.world.moves.pending, r = cm1.apply(this, arguments);
      if (r && r.ok && id === 'thorne_parley' && optId === 'show' && !fl(st).thorne_recruited) {
        const D = window.GAME_DATA, cls = D.classes && D.classes.inquisitor && D.classes.inquisitor.selectable !== false ? 'inquisitor' : 'warrior';
        if (S.makeUnit && st.roster && st.roster.length < ((S.RULES && S.RULES.rosterCap) || 8)) { const u = S.makeUnit(st, { primary: cls, name: 'Brannoc Thorne', race: 'human', level: lvl(st) + 1 }); st.roster.push(u); fl(st).thorne_recruited = day(st); r.recruit = u.name; r.text = (r.text || '') + ' He asks if you have room for one more. You do.'; }
        else { fl(st).thorne_waiting = day(st); r.text = (r.text || '') + ' He will join you when you have room.'; }
      } return r; }; }
  // Brielle's road: with a rogue or scout along you can hide her instead of fighting the patrol
  C.hideBrielle = function (st) {
    const wv = st.world.wander; if (!wv || !wv.enc || wv.enc.intrigue !== 'brielle_patrol') return { ok: false, reason: 'No patrol on the road' };
    if (!sneakyParty(st)) return { ok: false, reason: 'You need a rogue or scout with you' };
    st.world.wander = null; fl(st).brielle_hidden = day(st); if (S.getRank(st, 'synod')) C.harm(st, 'synod', 5);
    return { ok: true, text: 'A ditch, a cart of turnips, and a very long minute. The patrol rides past.' };
  };

  // ===== 8. No dead ends (design/story_world.md section 8) =====
  // A lost duel or a failed raid does not close a story for good: the scene comes back on a later arrival.
  const rearm = (st, id) => { const M = st.world.moves; if (M) { delete M.fired[id]; delete M.crossed[id]; } };
  { const ae2 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) {
      const E = C.ENCOUNTERS[encId], won = !!(res && res.won), out = ae2.apply(this, arguments);
      if (E && !won && E.intrigue === 'old_standard_duel' && !C.knows(st, 's_prince_p')) rearm(st, 'old_standard');
      if (E && !won && E.act3 === 'banner_raid') { delete fl(st).banner_raid; rearm(st, 'banner_raid'); }
      return out; }; }
  // Story fights that must be fought cannot be dodged by walking away (travel used to clear them): the Hall of Oaths, being found out,
  // the story's own fights, and a siege you chose to meet. Retreating in battle still ends them, as a defeat. Bad Paper and retaking a hold can wait.
  C.mustFight = st => { const w = st.world.wander, e = w && w.kind === 'fight' && w.from === w.to && w.enc; return !!(e && (e.hall || (e.intrigue && e.intrigue !== 'brielle_patrol') || e.act3 || e.holdSiege)); };
  { const tv = C.travel; C.travel = function (st) {
      if (C.mustFight(st)) return { ok: false, reason: 'You cannot walk away from this. Open the story and see it through.' };
      const r = tv.apply(this, arguments); if (!r || !r.ok) return r;
      // Thorne said he would join when you had room: he keeps his word on your next arrival
      if (fl(st).thorne_waiting && !fl(st).thorne_recruited && S.makeUnit && st.roster && st.roster.length < ((S.RULES && S.RULES.rosterCap) || 8)) {
        const D = window.GAME_DATA, cls = D.classes && D.classes.inquisitor && D.classes.inquisitor.selectable !== false ? 'inquisitor' : 'warrior';
        st.roster.push(S.makeUnit(st, { primary: cls, name: 'Brannoc Thorne', race: 'human', level: lvl(st) + 1 })); fl(st).thorne_recruited = day(st); delete fl(st).thorne_waiting;
        (r.events = r.events || []).push({ id: 'thorne_joins', text: 'A big man on a milestone, helmet under his arm. "You said you had room now." Brannoc Thorne joins your roster.' });
      }
      return r; }; }

  // ===== 9. When the Moot comes (design/story_world.md section 9) =====
  // The Moot waits for the player's own climax: before anyone reaches rank 3 (the Hearthwatch: Trusted), exposing the Writ is a scandal and
  // nothing more; the Lords argue and adjourn. Once you have finished any faction's climax, the Lords force the Moot themselves, so the story
  // can always end, even with every proof lost or burned. They wait for your rank-4 scene first (or a while, if you never get there).
  C.climaxReady = st => ['crown', 'syndicate', 'synod', 'broken_banner'].some(f => { const r = S.getRank(st, f); return r && r.rank >= 3; }) || (S.goodwillTier && S.goodwillTier(st).id === 'trusted') || C.climaxDone(st);
  // The Moot is not named to the player until it is near: a climax reached, the Moot called (or callable), or a realm already made.
  C.mootKnown = st => !!(C.climaxReady(st) || C.moot(st).called || st.world.realm || C.mootCallReasons(st).length);
  C.climaxDone = st => { const f = fl(st); return !!(f.crown_writ || f.synd_hand || f.synod_tithe || f.banner_homecoming || (f.hw_graves && (f.abbey_held || f.abbey_fallen || f.hw_graves !== 'defend'))); };
  // Where each seat is met (v4.4): canvassing is done in person, at the place of the seat's speaker, never from a menu. Places are put on the map when the Moot is called.
  Object.assign(C.MOOT.seats.lords, { at: ['crown_keep'] }); Object.assign(C.MOOT.seats.syndicate, { at: ['river_cities'] }); Object.assign(C.MOOT.seats.synod, { at: ['voldun'] });
  Object.assign(C.MOOT.seats.hearthwatch, { at: ['whitestone_abbey', 'hearthstone_priory'] }); Object.assign(C.MOOT.seats.banner, { at: ['outlaws_rest'] });
  C.seatPlaces = seat => ((C.MOOT.seats[seat] || {}).at || []).filter(id => C.NODES[id]);
  C.mootRevealPlaces = st => { Object.keys(C.MOOT.seats).forEach(sd => { if (C.MOOT.seats[sd].seatedOnly) return; C.seatPlaces(sd).forEach(id => { if (C.discoverRoute) C.discoverRoute(st, st.world.location, id); else if (C.discover) C.discover(st, id); }); }); };
  { const mc0 = C.mootCall; C.mootCall = function (st) { const r = mc0.apply(this, arguments); if (r && r.ok) C.mootRevealPlaces(st); return r; }; }
  C.MOOT.calls.lords = 'The Lords will not wait any longer. Lord Marshal Voss rings the old bell at Crown Keep: the Moot of the Five Seats is called.';
  { const cr = C.mootCallReasons; C.mootCallReasons = function (st) { let r = cr.apply(this, arguments); if (st.world.realm) return r;
      if (!C.climaxReady(st)) r = r.filter(x => x !== 'writ' && x !== 'wil');
      if (C.lordsReady(st) && !r.includes('lords')) r.push('lords');
      return r; }; }
  // The Lords wait for your rank-4 scene, so each faction's own way of calling the Moot (the petition, the debts, the Ward) gets its chance.
  // A faction is settled when its climax and its rank-4 scene are both done; the Hearthwatch has no rank 4, so its climax is enough.
  // Backstop: if no faction gets there, the Lords stop waiting after C.LORDS_WAIT arrivals since your first finished climax.
  C.LORDS_WAIT = 8;
  const CLIMAX = { crown: f => f.crown_writ, syndicate: f => f.synd_hand, synod: f => f.synod_tithe, broken_banner: f => f.banner_homecoming, hearthwatch: f => f.hw_graves && (f.abbey_held || f.abbey_fallen || f.hw_graves !== 'defend') };
  const RANK4 = { crown: 'crown_hand', syndicate: 'synd_partner', synod: 'synod_adept', broken_banner: 'banner_bearer', hearthwatch: null };
  C.factionSettled = (st, f) => { const F = fl(st); return !!(CLIMAX[f](F) && (!RANK4[f] || F[RANK4[f]])); };
  C.lordsReady = st => C.climaxDone(st) && (Object.keys(CLIMAX).some(f => C.factionSettled(st, f)) || (fl(st).lords_wait || 0) >= C.LORDS_WAIT);
  { const tv = C.travel; C.travel = function (st) { const r = tv.apply(this, arguments);
      if (r && r.ok && C.climaxDone(st) && !C.moot(st).called && !st.world.realm) fl(st).lords_wait = (fl(st).lords_wait || 0) + 1;
      return r; }; }
  { const up = C.useProof; C.useProof = function (st, sid, how) { const r = up.apply(this, arguments);
      if (r && r.ok && how === 'expose' && sid === 'succession' && !C.climaxReady(st)) r.text = (r.text || '') + ' The Lords meet, argue, and adjourn. Everyone knows now that the throne has no heir. Nobody is ready to say what comes next. Not yet.';
      return r; }; }
  // Rank-4 scenes (and a climax met late) can now come after the Moot: the Moot-facing choices change, and so do the lines that say there is no king.
  { const mv = id => (C.MOVES || []).find(m => m.id === id), mootGone = st => !!(C.moot(st).called !== null || st.world.realm);
    const crowned = st => !!(st.world.realm && !['regency', 'broken', 'ledger', 'ilvane'].includes(st.world.realm.outcome));
    const only = (o, cond) => { const c0 = o.if; o.if = st => cond(st) && (!c0 || c0(st)); };
    const after = (m, id, label, go) => { if (!m.options.some(o => o.id === id)) m.options.push({ id, label, go, if: st => !!st.world.realm }); };
    const relines = (m, alt) => { const base = m.view || (() => m.lines); m.view = st => crowned(st) ? alt : base(st); };
    let m = mv('crown_lords_hand'); if (m) { only(m.options.find(o => o.id === 'moot'), st => !mootGone(st)); relines(m, ['"The Hand speaks for the throne. There is someone on it now, so mostly the Hand listens. And remembers."']); }
    m = mv('synod_adept'); if (m) { const w = m.options.find(o => o.id === 'ward'); only(w, st => !st.world.realm); relines(m, ['The Archon: "The Ward needs a king\'s seal. Now there is a king to ask."']);
      after(m, 'ward_crown', 'Raise the Ward under the new crown', st => { fl(st).synod_adept = 'ward'; C.deed(st, 'synod', 'gray', 1); return { text: 'The Archon\'s letter goes to Crown Keep that night, asking for the new seal. It comes back within the week.' }; }); }
    m = mv('banner_bearer'); if (m) { only(m.options.find(o => o.id === 'king'), st => !st.world.realm);
      after(m, 'king_made', '"To the king we made."', st => { fl(st).banner_bearer = 'king'; C.deed(st, 'broken_banner', 'gray', 1); return { text: st.world.realm.outcome === 'wil' ? '"Then we had better keep him one," he says.' : '"Whoever sits there now," he says, "will learn what this banner means."' }; }); }
    m = mv('synod_tithe'); if (m) { const t = m.options.find(o => o.id === 'truth'); only(t, st => !st.world.realm);
      after(m, 'truth_crown', 'Carry the truth to Crown Keep', st => { const r = t.go(st); return Object.assign({}, r, { text: 'You climb out with the truth and nowhere to spend it but the throne room. The new court listens, and does not know what to do with it.' }); }); }
  }

  C.validateStory = function () {
    const p = [], cls = window.GAME_DATA.classes;
    Object.keys(CHOICE_DEEDS).forEach(k => { const [cid, oid] = k.split(':'); const c = C.CHOICES[cid]; if (c && !c.options.some(o => o.id === oid)) p.push('deed for unknown option ' + k); });
    Object.keys(HONESTY).forEach(k => { const [kind, id, oid] = k.split(':'); if (kind === 'contract' && !C.CONTRACT_KINDS[id]) p.push('honesty: unknown contract ' + id); if (kind === 'move' && !C.MOVES.some(m => m.id === id && m.options.some(o => o.id === oid))) p.push('honesty: unknown move option ' + k); });
    if (cls) Object.values(SIEGERS).forEach(s => s.enemies.forEach(e => { if (!cls[e.primary] || cls[e.primary].selectable === false) p.push('siege: illegal class ' + e.primary); }));
    return p;
  };
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.ACT3) go(); else (window.GAME_CLIMAX_HOOKS = window.GAME_CLIMAX_HOOKS || []).push(go);
})();
