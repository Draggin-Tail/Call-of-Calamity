/* Act III (design/faction_climax.md): rank-3 beats, each faction's climax, rank-4 beats, the new ways to call the Moot.
   Pure rules, no screens. Needs faction_work.js. Climaxes need rank 3 (the Hearthwatch: Trusted); outsiders can still take the proof
   (the dungeons stay open) and get the shorter outsider versions already in the cast (Harrow's price, Crane's purse, proof actions). */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE, D = window.GAME_DATA;
  if (C.ACT3) return; C.ACT3 = true;
  const fl = st => st.world.flags, day = st => st.world.day;
  const rankOf = (st, f) => { const r = S.getRank(st, f); return r ? r.rank : 0; };
  const gwTier = st => (S.goodwillTier ? S.goodwillTier(st).id : 'wary');
  const gw = (st, d, why) => { if (S.changeGoodwill && d) S.changeGoodwill(st, d, why); };
  const proofHeld = (st, sid) => { const p = st.world.dossier && st.world.dossier.proof && st.world.dossier.proof[sid]; return !!(p && p.held); };
  const spendProof = (st, sid, how) => { const p = st.world.dossier.proof[sid]; p.held = false; p.used = how; };
  const cleared = (st, id) => !!((st.world.dungeons || {})[id] && st.world.dungeons[id].cleared);
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const promoteTo = (st, f, n) => { const r = S.getRank(st, f); if (!r) return false; while (S.getRank(st, f).rank < n && S.promote(st, f, { force: true }).ok); return true; };
  const L = (id, f, kind, text) => { C.LORE[id] = { id, faction: f, kind, depth: 0, text }; };

  // ---- fights started by Act III beats (road-fight slot, reported through C.applyEncounterResult) ----
  const FIGHTS = {
    banner_raid: { name: 'The homecoming raid', faction: 'crown', enemies: [{ primary: 'warrior', name: 'Post Sergeant' }, { primary: 'archer', name: 'Wall Bowman' }, { primary: 'bulwark', name: 'Gate Shield' }], objective: { type: 'leader', leader: 0 }, text: 'Greywatch Post, an hour before dawn. The cells are under the gatehouse, and forty men are listening for your ladders.' },
    abbey_siege: { name: 'The siege of Whitestone', faction: 'synod', enemies: [{ primary: 'warlord', name: 'Inquisitor-Captain' }, { primary: 'wizard', name: 'Inquisitor' }, { primary: 'cleric', name: 'Confessor' }], objective: { type: 'survive', turns: 5 }, text: 'Synod lanterns all round the abbey wall. Agathe bars the door and hands you the key. "Hold them till the bell," she says. "Not even Thorne wants witnesses."' },
    ledger_knives: { name: 'Knives from the Long Ledger', faction: 'syndicate', enemies: [{ primary: 'assassin', name: 'Silent Auditor' }, { primary: 'rogue', name: 'Collector' }, { primary: 'marksman', name: 'Hired Rifle' }], objective: null, text: 'Three streets from Ledgerhall, with three contracts that have your name on the wrapper. Harrow has decided an equal is one too many.' }
  };
  function fightHere(st, key) {
    const F = FIGHTS[key], at = st.world.location, region = C.NODES[at].region, lv = lvl(st);
    const enc = { name: F.name, map: C.mapFor(st, region, at), rec: lv + 1, enemyFaction: F.faction, enemies: F.enemies.map(e => Object.assign({}, e)), objective: F.objective, once: false, wander: true, act3: key, reward: { xp: 90 + 16 * lv, gold: 20 + 6 * lv } };
    st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text: F.text }; C.ENCOUNTERS.wander = enc; return { fight: key };
  }
  const RESULT = {
    banner_raid: (st, won) => { if (won) { fl(st).banner_homecoming = day(st); C.harm(st, 'crown', 40); S.changeStanding(st, 'broken_banner', 80, { reason: 'brought the prisoners home', ripple: false }); } },
    abbey_siege: (st, won) => { if (won) { fl(st).abbey_held = day(st); C.harm(st, 'synod', 40); gw(st, 20, 'held Whitestone'); C.deed(st, 'hearthwatch', 'light', 3, { public: true }); } else { fl(st).abbey_fallen = day(st); gw(st, -10, 'Whitestone fell'); } },
    ledger_knives: (st, won) => { if (won) fl(st).harrow_knives_beaten = day(st); }
  };
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) { const E = C.ENCOUNTERS[encId], out = ae0.apply(this, arguments); if (E && E.act3 && RESULT[E.act3]) RESULT[E.act3](st, !!(res && res.won)); return out; }; }

  // ---- the Vol'Dun undercity: the Synod's climax dungeon (the Sleeper stays sealed) ----
  const U = s => { const [primary, name] = s.split(':'); return { primary, name }; };
  C.DUNGEONS.voldun_undercity = { name: 'The Undercity', parent: 'voldun', tier: 3, rec: 9, respawn: null, hidden: true, reveal: { auto: false },
    desc: 'Stairs under the Synod\'s tower, worn smooth by people carrying books down.', why: 'What is below is sealed again when you leave. It stays that way.',
    first: { gold: 320, items: { staff_arcane: 1 } },
    floors: [{ name: 'The book stair', enemies: ['enchanter:Stair Warden', 'wizard:Jailer', 'cleric:Jailer-Confessor'].map(U) },
      { name: 'The reading-room of the dead', enemies: ['necro:Name-Keeper', 'shadowmage:Hollow Reader', 'wizard:Jailer'].map(U) },
      { name: 'The tithe door', enemies: ['wizard:The First Jailer', 'stone_golem:Door Warden', 'enchanter:Stair Warden'].map(U), boss: true }] };
  { const id = 'voldun_undercity', d = C.DUNGEONS[id], par = C.NODES[d.parent];
    if (par && !C.NODES[id]) {
      C.NODES[id] = { name: d.name, region: par.region, area: par.area, type: 'dungeon', pos: [+(par.pos[0] + 0.014).toFixed(3), +(par.pos[1] + 0.016).toFixed(3)], desc: d.desc, dungeon: id, hidden: true, links: { [d.parent]: 1 } };
      par.links[id] = 1; if (C.EDGES) C.EDGES.push([d.parent, id, 1]);
      const MAPS = ['classic_ridge', 'corner_ambush', 'twin_cliffs', 'king_spire', 'sunken_causeway'];
      d.floors.forEach((f, i) => { const rec = d.rec + (f.boss ? 1 : 0); C.ENCOUNTERS['dg_' + id + '_' + (i + 1)] = { name: d.name + ': ' + f.name, map: 'dgm_' + id + '_' + (i + 1), rec, enemyFaction: 'synod', enemies: f.enemies.map(e => Object.assign({}, e)),
        objective: f.boss ? { type: 'leader', leader: 0 } : null, once: false, dungeon: id, floor: i + 1, baseReward: { xp: Math.round((30 + 12 * rec) * (f.boss ? 1.8 : 1)), gold: Math.round((10 + 5 * rec) * (f.boss ? 2 : 1)) }, reward: { xp: 0, gold: 0 } }; });
    } }
  L('s_hoard_deep', 'synod', 'secret', 'It went down, not out. Something below eats what the Synod cannot burn, and sleeps while it is fed. The Inner Circle are its jailers.');
  if (C.LORE_ON) C.LORE_ON['dungeon:voldun_undercity'] = ['s_hoard_deep'];
  { const lo0 = C.lore; C.lore = function (st, ev) { const r = lo0.apply(this, arguments);   // outsiders with the Sealed Ledger find the way in among the banned books
      if (ev === 'visit:blackstone_archive' && proofHeld(st, 'forbidden_hoard') && rankOf(st, 'synod') < 3 && C.reveal) { const x = C.reveal(st, 'voldun_undercity'); if (x && x.ok) fl(st).undercity_broken_in = day(st); }
      if (ev === 'dungeon:voldun_undercity') C.learn(st, 's_hoard_deep', 'Seen in the Undercity');
      return r; }; }

  // ---- lore for the climaxes ----
  L('writ_read', 'crown', 'secret', 'You read the Heir\'s Writ to the Lords of the realm. They knew. Every one of them knew.');
  L('long_ledger_seat', 'syndicate', 'secret', 'You sit across from Harrow at the Long Ledger. Two ciphers now, and he hates it.');
  L('agathe_graves', 'hearthwatch', 'secret', 'The "missing" mages were not all fed to the dark. Mother Agathe faked their deaths and buried empty coffins under their names.');

  const B = (id, label, go, cond) => ({ id, label, go, if: cond });
  const beat = (id, who, at, trip, setup, lines, options, extra) => Object.assign({ id, who, at, trip, setup, lines, options }, extra || {});
  const mootTryCall = (st, by) => { const r = C.mootCall(st, by); return r.ok ? r : null; };
  const NEW = [
    // ===== Crown =====
    beat('crown_banneret', 'voss', null, st => rankOf(st, 'crown') >= 3 && !fl(st).crown_banneret,
      'Twenty lances and a banner with your name on it: Lord Marshal Voss\'s first gift, and his only order. "Keep the road." On the road north, a lord\'s men are burning a Banner village. The lord outranks you. The village is full of people.',
      ['His captain salutes. "Orders from Lord Osric of Aldermere. Outlaws harboured here. You will want to ride on, sir."'],
      [B('stop', 'Stop them', st => { fl(st).crown_banneret = day(st); C.harm(st, 'crown', 20); S.changeStanding(st, 'broken_banner', 25, { reason: 'stopped a burning', ripple: false }); C.deed(st, 'crown', 'light', 2, { public: true }); return { text: 'Your lances form up across the road. The captain thinks about it, and turns his men round. Lord Osric will hear of this.' }; }),
       B('ride', 'Ride on', st => { fl(st).crown_banneret = day(st); C.deed(st, 'crown', 'gray', 1); return { text: 'The smoke follows you for a mile. Your lances do not look at you.' }; }),
       B('join', 'Lend him your lances', st => { fl(st).crown_banneret = day(st); S.serve(st, 'crown', 40, { reason: 'helped clear the outlaws' }); C.harm(st, 'broken_banner', 30); C.deed(st, 'crown', 'dark', 2, { public: true }); return { text: 'It is over by noon. Lord Osric sends his thanks, and a cask of wine.' }; })]),
    beat('crown_marches', 'voss', null, st => !!fl(st).knighted && !!fl(st).marches_warned && !fl(st).marches_defended && !fl(st).crown_marches && C.NODES[st.world.location] && C.areaOf(st.world.location) === 'free_marches',
      'The Free Marches: farms, hedgerows, and smoke on the horizon. The raiders will be here by nightfall.\n\nThe garrison captain is glad to see a knight, and gladder still to hand you the decision. "I have forty men. The Lord Marshal\'s orders say hold the gate. My mother lives out on the farms."',
      ['"We cannot hold the farms and the gate both. Tell me which."'],
      [B('evacuate', 'Get the farm folk out first', st => { fl(st).crown_marches = 'evacuate'; gw(st, 5, 'evacuated the Marches'); C.deed(st, 'crown', 'light', 2, { public: true }); return { text: 'The carts go south toward Millstream. The gate will be harder to hold now.' }; }),
       B('gate', 'Hold the gate', st => { fl(st).crown_marches = 'gate'; C.deed(st, 'crown', 'gray', 1); return { text: 'You take the gate. Whatever is outside it is outside it.' }; }),
       B('burn', 'Burn the fields so the raiders starve', st => { fl(st).crown_marches = 'burn'; gw(st, -5, 'burned the Marches\' harvest'); C.deed(st, 'crown', 'dark', 2, { public: true }); return { text: 'The raiders will go hungry. So will everyone else in the Marches this winter.' }; })]),
    beat('crown_barrow_writ', 'voss', null, st => proofHeld(st, 'succession') && rankOf(st, 'crown') >= 3 && !fl(st).crown_writ,
      'The Old King lies still at last. In his hand, under the dust, is a writ with his seal on it, naming no one. If it is read aloud, the Lords can no longer pretend the throne is a mystery. You carry it up into daylight, and Voss is waiting at the top of the stair.',
      [],
      [B('lords', 'Read it to the Lords at Crown Keep', st => { fl(st).crown_writ = 'read'; spendProof(st, 'succession', 'read'); fl(st).exposed_succession = day(st); S.changeStanding(st, 'crown', -40, { reason: 'shamed the Lords', ripple: false }); C.learn(st, 'writ_read', 'The Hall of Oaths'); C.deed(st, 'crown', 'light', 3, { public: true }); const m = C.mootCheck(st); return { text: 'The hall goes silent. Then very loud. The Interval is over.', moot: m }; }),
       B('keep', 'Keep it, for now', st => { fl(st).crown_writ = 'kept'; C.deed(st, 'crown', 'gray', 1); return { text: '"Wise," Voss says, "or cowardly. I could never tell the difference either."' }; }),
       B('harrow', 'Give it to the Steward', st => { fl(st).crown_writ = 'buried'; spendProof(st, 'succession', 'harrow'); st.inventory.gold += 300; S.serve(st, 'crown', 60, { reason: 'kept the Interval' }); C.deed(st, 'crown', 'dark', 2); return { text: 'Harrow reads it once and puts it in the fire. "The realm thanks you," he says, and the purse is heavy.' }; })],
      { view: st => [C.lean(st, 'crown').lean === 'light' ? '"You are going to do the right thing with that," Voss says, "and it is going to cost us all. Go on."' : C.lean(st, 'crown').lean === 'dark' ? '"I know what you will do with it," Voss says. "I hoped I was wrong about you."' : '"So now you know," Voss says. "What will you do with it?"'] }),
    beat('crown_lords_hand', 'harrow', 'crown_keep', st => rankOf(st, 'crown') >= 4 && !fl(st).crown_hand,
      'Crown Keep, late. Harrow holds out the seal of the Lord\'s Hand, which has hung on a nail since the last Hand died. It is heavier than it looks.',
      ['"The Hand speaks for the throne while there is no one on it. You will find that is most of the time. So. What will you do with it?"'],
      [B('moot', 'Take it, and use it to end the Interval', st => { fl(st).crown_hand = 'moot'; C.deed(st, 'crown', 'light', 2, { public: true }); const m = mootTryCall(st, 'petition'); return { text: 'Harrow\'s face does not change. "As you wish." The notices go up that night.', moot: m }; }),
       B('keep', 'Take it, and keep the peace', st => { fl(st).crown_hand = 'peace'; C.deed(st, 'crown', 'gray', 1); C.learn(st, 'harrow_ledger', 'Harrow, handing over the seal'); return { text: '"Good," Harrow says. "Peace is underrated by people who have never run out of it."' }; }),
       B('purse', 'Take it, and the stipend that comes with not asking questions', st => { fl(st).crown_hand = 'purse'; fl(st).pledged_regency = fl(st).pledged_regency || day(st); st.inventory.gold += 250; C.deed(st, 'crown', 'dark', 2); return { text: 'The purse comes with the seal. So does the understanding.' }; })]),
    // ===== Syndicate =====
    beat('synd_factor', 'crane', null, st => rankOf(st, 'syndicate') >= 3 && !fl(st).synd_factor,
      'A bad harvest across the Crownlands. The Syndicate holds most of the grain, and the Factors meet in Gildhaven to set the price. The vote is tied. Yours is the deciding voice, and every Factor is watching which way you lean.',
      ['Crane, quietly: "Every Factor gets one of these. It tells us who they are."'],
      [B('corner', 'Corner the market', st => { fl(st).synd_factor = 'corner'; st.inventory.gold += 150; S.serve(st, 'syndicate', 60, { reason: 'cornered the grain' }); gw(st, -5, 'hunger in the Crownlands'); C.deed(st, 'syndicate', 'dark', 3, { public: true }); return { text: 'The price doubles. The ledgers sing. The villages do not.' }; }),
       B('dear', 'Sell dear, not ruinous', st => { fl(st).synd_factor = 'dear'; S.serve(st, 'syndicate', 30, { reason: 'a good price' }); C.deed(st, 'syndicate', 'gray', 1); return { text: 'A good year for the Syndicate, and a hard one for everyone else. Nobody starves.' }; }),
       B('cost', 'Sell at cost through the winter', st => { fl(st).synd_factor = 'cost'; S.changeStanding(st, 'syndicate', -30, { reason: 'gave away the margin', ripple: false }); gw(st, 6, 'cheap bread in a bad year'); C.deed(st, 'syndicate', 'light', 3, { public: true }); return { text: 'The other Factors call it sentimental. The villages call it a miracle. Crane calls it "noted".' }; })]),
    beat('synd_hand', 'harrow', 'ledgerhall', st => proofHeld(st, 'hidden_hand') && rankOf(st, 'syndicate') >= 3 && !fl(st).synd_hand,
      'Ledgerhall after midnight. You lay the Second Book on the table, open at the page with the Steward\'s private seal next to the cipher. Harrow arrives alone, as you asked, and sits down across from you.',
      ['"So," he says. "Now you know what the Syndicate is. What will you do with it?"'],
      [B('give', 'Give it back, for a Partner\'s seat', st => { fl(st).synd_hand = 'harrow'; spendProof(st, 'hidden_hand', 'harrow'); promoteTo(st, 'syndicate', 4); C.deed(st, 'syndicate', 'gray', 1); return { text: 'He takes the Book and your hand. "Welcome to the Long Ledger. Under it, anyway."' }; }),
       B('ledger', 'Keep it, and take a seat beside him', st => { fl(st).synd_hand = 'ledger'; fl(st).long_ledger = day(st); promoteTo(st, 'syndicate', 4); st.inventory.gold += 200; C.learn(st, 'long_ledger_seat', 'Ledgerhall, after midnight'); C.deed(st, 'syndicate', 'dark', 2); return { text: 'He looks at you for a long time. Then he writes out the cipher, a second time, for you. "Partners," he says. He does not mean it.' }; }),
       B('crane', 'Sell it to Crane', st => { fl(st).synd_hand = 'crane'; spendProof(st, 'hidden_hand', 'sold'); fl(st).crane_hand = day(st); st.inventory.gold += 450; C.deed(st, 'syndicate', 'gray', 1); return { text: 'Crane is waiting outside. Harrow watches you hand it to her and says nothing at all.' }; }),
       B('expose', 'Read it to the Factors in the morning', st => { fl(st).synd_hand = 'exposed'; spendProof(st, 'hidden_hand', 'read'); fl(st).exposed_hidden_hand = day(st); S.changeStanding(st, 'syndicate', -80, { reason: 'exposed the Hand', ripple: false }); C.deed(st, 'syndicate', 'light', 3, { public: true }); const m = C.mootCheck(st); return { text: 'By noon the whole realm knows who has been holding its debts. Harrow is gone from Ledgerhall before the Factors finish reading.', moot: m }; })]),
    beat('synd_knives', 'harrow', null, st => !!fl(st).long_ledger && !fl(st).harrow_knives && day(st) > fl(st).long_ledger,
      'You notice the man following you three streets too late.', [],
      [B('fight', 'Turn and face them', st => { fl(st).harrow_knives = day(st); return Object.assign({ text: 'Three of them. They have a contract and they mean to finish it.' }, fightHere(st, 'ledger_knives')); })], { urgent: true }),
    beat('synd_partner', 'crane', 'river_cities', st => rankOf(st, 'syndicate') >= 4 && !fl(st).synd_partner,
      'A Partner\'s seat at the long table in Gildhaven. The other Partners raise their cups. There are nine of them, and Crane is not one. She stands behind your chair, to make sure you notice.',
      ['"A Partner\'s money can buy anything," the eldest says. "Every Partner tells us what they mean to buy."'],
      [B('bread', '"Bread. For everyone."', st => { fl(st).synd_partner = 'bread'; C.deed(st, 'syndicate', 'light', 2, { public: true }); return { text: 'Someone laughs. Crane does not.' }; }),
       B('peace', '"Peace. It is good for business."', st => { fl(st).synd_partner = 'peace'; C.deed(st, 'syndicate', 'gray', 1); return { text: 'They drink to that.' }; }),
       B('all', '"Everything."', st => { fl(st).synd_partner = 'all'; C.deed(st, 'syndicate', 'dark', 2); return { text: 'They drink to that too, more slowly.' }; })]),
    // ===== Synod =====
    beat('synod_inquisitor', 'thorne', null, st => rankOf(st, 'synod') >= 3 && !fl(st).synod_inquisitor,
      'Your first hunt as Inquisitor, on a Synod warrant with your name at the top. The hedge-mage is nine years old, and she set a barn on fire by being frightened.',
      ['Her mother stands in the doorway with a carving knife. She is not going to use it, and she knows it.'],
      [B('voldun', 'Take her to Vol\'Dun', st => { fl(st).synod_inquisitor = 'voldun'; S.serve(st, 'synod', 50, { reason: 'brought in a wild talent' }); C.deed(st, 'synod', 'dark', 2, { public: true }); return { text: 'Transfer orders, stamped with a closed eye. You do not ask where they go.' }; }),
       B('school', 'Enrol her at the chantry school, openly, with her mother\'s leave', st => { fl(st).synod_inquisitor = 'school'; S.serve(st, 'synod', 25, { reason: 'enrolled a wild talent' }); C.deed(st, 'synod', 'gray', 1); return { text: 'Her name goes on a list. She is taught. She is also watched, for the rest of her life.' }; }),
       B('hide', 'Take her to Mother Agathe', st => { fl(st).synod_inquisitor = 'agathe'; S.changeStanding(st, 'synod', -20, { reason: 'lost a wild talent', ripple: false }); gw(st, 5, 'brought a child to sanctuary'); C.deed(st, 'synod', 'light', 2); return { text: 'Agathe takes the girl\'s hand and does not ask you anything at all.' }; })]),
    beat('synod_initiation', 'ilvane', 'voldun', st => rankOf(st, 'synod') >= 3 && !fl(st).synod_initiated,
      'Vol\'Dun, after dark. The Archon meets you at the foot of the black stair with a lamp in each hand. She gives you one. Whatever the Synod has been guarding, you are about to be asked to guard it too.',
      ['"Everything you have been told about the books is true," she says. "It is just not all of it. Come down."'],
      [B('down', 'Follow her down', st => { fl(st).synod_initiated = day(st); if (C.reveal) C.reveal(st, 'voldun_undercity'); return { text: 'The stair goes down further than the tower goes up.' }; }),
       B('later', 'Not yet', () => ({ text: '"It will still be there," she says. "It always is."', repeat: true }))]),
    beat('synod_tithe', 'ilvane', 'voldun_undercity', st => cleared(st, 'voldun_undercity') && !fl(st).synod_tithe,
      'The tithe door. On the other side, something breathes, slow as a tide. The jailers stand aside to let you see the slot where the books go in.',
      ['The First Jailer, wiping his hands: "One a week keeps it dreaming. Nobody asked us. Nobody thanked us. Now you know."'],
      [B('join', 'Take up the jailers\' work', st => { fl(st).synod_tithe = 'kept'; if (!promoteTo(st, 'synod', 4)) S.changeStanding(st, 'synod', 300, { reason: 'kept the tithe', ripple: false }); C.deed(st, 'synod', 'gray', 2); return { text: 'You feed it the first book yourself. It is lighter than you expected.' }; }, st => rankOf(st, 'synod') >= 3),
       B('truth', 'Carry the truth to the Moot', st => { fl(st).synod_tithe = 'truth'; fl(st).sleeper_truth = day(st); S.changeStanding(st, 'synod', -100, { reason: 'betrayed the Undercity', ripple: false }); C.deed(st, 'synod', 'light', 3, { public: true }); return { text: 'The jailers do not stop you leaving. They do not think anyone will believe you.' }; }),
       B('power', 'Take a book of your own from the hoard', st => { fl(st).synod_tithe = 'taken'; fl(st).hoard_taken = day(st); st.inventory.items.tome_focus = (st.inventory.items.tome_focus || 0) + 1; fl(st).bounty_synod = day(st); C.deed(st, 'synod', 'dark', 3); return { text: 'The hoard is a library of everything forbidden. You take what you want. The breathing on the other side of the door changes, very slightly.' }; })]),
    beat('synod_adept', 'ilvane', 'voldun', st => rankOf(st, 'synod') >= 4 && !fl(st).synod_adept,
      'The Inner Circle meets in a room with no windows and a great many lamps. There is a chair for you, and eleven faces that have been deciding this for forty years.',
      ['The Archon: "The Ward needs a king\'s seal. The realm needs a king. You could give it both."'],
      [B('ward', 'Raise the Ward (and call for a king)', st => { fl(st).synod_adept = 'ward'; C.deed(st, 'synod', 'gray', 1); const m = mootTryCall(st, 'ward'); return { text: 'The Archon\'s letter goes to Crown Keep that night: the Synod will anoint no one until a king is chosen.', moot: m }; }),
       B('starve', 'Starve the tithe, slowly, and say nothing', st => { fl(st).synod_adept = 'starve'; C.deed(st, 'synod', 'light', 2); return { text: 'Fewer books go down each week. Nobody notices but you, and whatever is below.' }; }),
       B('rule', 'Take the Archon\'s chair', st => { fl(st).synod_adept = 'rule'; C.deed(st, 'synod', 'dark', 3); S.changeStanding(st, 'synod', -40, { reason: 'took the chair', ripple: false }); return { text: 'Ilvane steps aside without a word. She looks almost relieved.' }; }, st => fl(st).synod_tithe === 'taken' || C.lean(st, 'synod').lean === 'dark')]),
    // ===== Broken Banner =====
    beat('banner_captain', 'old_standard', null, st => rankOf(st, 'broken_banner') >= 3 && !fl(st).banner_captain,
      'A Banner band has turned to plain banditry, robbing the villages the Banner swore to protect. They wear the old colours, so every village they rob blames the whole Banner. Old Standard gives them to you.',
      ['"They are yours now, Captain. Do what you think is right. I will tell you after if it was."'],
      [B('punish', 'Hang the leaders, take back what they stole', st => { fl(st).banner_captain = 'punish'; gw(st, 4, 'the Banner kept its word'); C.deed(st, 'broken_banner', 'light', 2, { public: true }); return { text: 'The villages get their goods back, and their faith in the Banner, nearly.' }; }),
       B('absorb', 'Take them back into the Banner under your eye', st => { fl(st).banner_captain = 'absorb'; S.serve(st, 'broken_banner', 30, { reason: 'more riders' }); C.deed(st, 'broken_banner', 'gray', 1); return { text: 'Thirty more riders. Some of them will even stay honest.' }; }),
       B('lead', 'Lead them yourself', st => { fl(st).banner_captain = 'lead'; st.inventory.gold += 120; gw(st, -5, 'Banner banditry'); C.deed(st, 'broken_banner', 'dark', 2, { public: true }); return { text: 'The villages learn to fear the old colours. Old Standard does not speak to you for a week.' }; })]),
    beat('banner_raid', 'old_standard', null, st => rankOf(st, 'broken_banner') >= 3 && !!fl(st).wil_consents && !fl(st).banner_raid,
      'Wil has a name now, and the Banner has a reason. Old Standard spreads a map: forty Banner riders in the cells at Greywatch Post, waiting for the rope. Some of them were at Marrow Ford.',
      ['"Bring them home and we have an army. Leave them and we have a story."'],
      [B('storm', 'Storm the post', st => { fl(st).banner_raid = 'storm'; C.deed(st, 'broken_banner', 'gray', 1, { public: true }); return Object.assign({ text: 'Ropes, ladders, and forty men who have nothing left to lose.' }, fightHere(st, 'banner_raid')); }),
       B('parley', 'Talk the commander into opening the cells', st => { fl(st).banner_raid = 'parley'; fl(st).banner_homecoming = day(st); S.changeStanding(st, 'crown', -20, { reason: 'a commander shamed', ripple: false }); C.deed(st, 'broken_banner', 'light', 2, { public: true }); return { text: 'It takes a night, and your Crown rank, and every favour you have. The gate opens at dawn.' }; }, st => rankOf(st, 'crown') >= 2),
       B('wait', 'Not yet', () => ({ text: '"They have waited this long," Old Standard says.', repeat: true }))]),
    beat('banner_bearer', 'old_standard', 'outlaws_rest', st => rankOf(st, 'broken_banner') >= 4 && !fl(st).banner_bearer,
      'Old Standard takes the banner down from the oak: the real one, the old king\'s colours, rotten at the edges. He holds it out to you.',
      ['"I carried it eighteen years. Your turn. Where will you carry it?"'],
      [B('home', '"Home."', st => { fl(st).banner_bearer = 'home'; C.deed(st, 'broken_banner', 'light', 2, { public: true }); return { text: 'He nods as if that is the only answer, and it might be.' }; }),
       B('king', '"To the Moot, behind Wil."', st => { fl(st).banner_bearer = 'king'; C.deed(st, 'broken_banner', 'gray', 1); return { text: '"Then we had better make him a king," he says.' }; }),
       B('us', '"Wherever the Banner can take what it is owed."', st => { fl(st).banner_bearer = 'us'; C.deed(st, 'broken_banner', 'dark', 2); return { text: 'He hands it over anyway. "It has been carried to worse places."' }; })]),
    // ===== Hearthwatch (Trusted) =====
    beat('hw_graves', 'agathe', 'whitestone_abbey', st => gwTier(st) === 'trusted' && !!fl(st).hw_ch2 && !fl(st).hw_graves,
      'Agathe takes you down to the abbey\'s burial ground at night, and stops at a row of new graves with old names. She has never asked you for anything before.',
      ['"They are empty," she says. "The Synod\'s missing mages. Not all of them went down. Some came here, and I buried their names so the Synod would stop looking."', '"Thorne has found out. He will be here tomorrow."'],
      [B('defend', 'Defend the abbey', st => { fl(st).hw_graves = 'defend'; C.learn(st, 'agathe_graves', 'Whitestone, at night'); return Object.assign({ text: 'You bar the gate and count the people inside: twelve mages, three wardens, one Abbess.' }, fightHere(st, 'abbey_siege')); }),
       B('smuggle', 'Get them out tonight, to the Banner', st => { fl(st).hw_graves = 'smuggle'; fl(st).abbey_held = day(st); C.learn(st, 'agathe_graves', 'Whitestone, at night'); C.harm(st, 'synod', 30); S.changeStanding(st, 'broken_banner', 30, { reason: 'twelve hedge-mages', ripple: false }); gw(st, 15, 'saved the hidden mages'); C.deed(st, 'hearthwatch', 'light', 2); return { text: 'Twelve figures in borrowed cloaks, across the fields before dawn. Thorne finds an empty abbey and an old woman making tea.' }; }),
       B('hand', 'Hand them over before Thorne arrives', st => { fl(st).hw_graves = 'betrayed'; C.learn(st, 'agathe_graves', 'Whitestone, at night'); S.changeStanding(st, 'synod', 80, { reason: 'gave up the hidden mages', ripple: false }); gw(st, -40, 'betrayed Whitestone'); C.deed(st, 'hearthwatch', 'dark', 3, { public: true }); return { text: 'Agathe watches them taken. She does not curse you. That is worse.' }; })])
  ];

  // stakes, in words, under each choice (writing pass 3): what it buys, what it costs, no numbers
  C.MOVE_HINTS = Object.assign(C.MOVE_HINTS || {}, {
    'crown_banneret.stop': 'The village lives. Lord Osric will remember who stopped him.',
    'crown_banneret.ride': 'No quarrel with a lord. Your lances will remember.',
    'crown_banneret.join': 'Osric is grateful. The Banner will not forgive it.',
    'crown_marches.evacuate': 'The farms are saved. The gate may not hold.',
    'crown_marches.gate': 'The gate holds. The farms are on their own.',
    'crown_marches.burn': 'The raiders go hungry. So does everyone else.',
    'crown_barrow_writ.lords': 'The truth is out, and the Lords will not forgive who said it.',
    'crown_barrow_writ.keep': 'Nothing changes yet. The writ stays with you.',
    'crown_barrow_writ.harrow': 'Gold and the Crown\'s thanks. The Interval goes on.',
    'crown_lords_hand.moot': 'The Interval ends. Harrow will not thank you.',
    'crown_lords_hand.keep': 'The peace holds. Harrow shows you a little of what he keeps.',
    'crown_lords_hand.purse': 'Gold, and your silence bought.',
    'synd_factor.corner': 'Gold and the Factors\' praise. The villages go hungry.',
    'synd_factor.dear': 'A fair profit and a hard winter. Nobody starves.',
    'synd_factor.cost': 'The villages eat. The Factors think you soft.',
    'synd_hand.give': 'A Partner\'s seat, and Harrow\'s thanks. The Book goes back.',
    'synd_hand.ledger': 'A seat beside Harrow, and his knives to follow.',
    'synd_hand.crane': 'A great deal of gold. Harrow will know who sold him.',
    'synd_hand.expose': 'The realm learns the truth. The Syndicate will not take you back.',
    'synd_partner.bread': 'An odd promise. The Partners will hold you to it.',
    'synd_partner.peace': 'A safe answer. They drink to it.',
    'synd_partner.all': 'A hungry answer. They will watch your hands.',
    'synod_inquisitor.voldun': 'The Synod is pleased. The girl is gone.',
    'synod_inquisitor.school': 'She is taught, and watched. The Synod is content.',
    'synod_inquisitor.hide': 'The girl is safe. The Synod will ask where she went.',
    'synod_initiation.down': 'You will learn what the Synod hides.',
    'synod_initiation.later': 'It will wait for you.',
    'synod_tithe.join': 'The jailers\' trust, and the jailers\' work.',
    'synod_tithe.truth': 'The realm hears it. The Synod will never forgive you.',
    'synod_tithe.truth_crown': 'The king hears it. The Synod will never forgive you.',
    'synod_tithe.power': 'Forbidden power. The Synod will hunt you for it.',
    'synod_adept.ward': 'The Synod waits for a king. Crown Keep will take notice.',
    'synod_adept.ward_crown': 'The Synod kneels to the new crown. Crown Keep will take notice.',
    'synod_adept.starve': 'A quiet mercy, and a secret kept from your own.',
    'synod_adept.rule': 'The chair is yours. So is the resentment in this room.',
    'banner_captain.punish': 'The villages trust the Banner again. Some riders will not.',
    'banner_captain.absorb': 'More riders. Some of them will cheat you.',
    'banner_captain.lead': 'Gold, and a banner the villages fear.',
    'banner_raid.storm': 'A hard fight. If you win, forty men come home.',
    'banner_raid.parley': 'No blood. It costs you with the Crown.',
    'banner_raid.wait': 'The men in the cells keep waiting.',
    'banner_bearer.home': 'The Banner goes home, whoever sits the throne.',
    'banner_bearer.king': 'The Banner rides for Wil.',
    'banner_bearer.king_made': 'The Banner rides for the king it helped make.',
    'banner_bearer.us': 'The Banner takes what it is owed. Old Standard will not like it.',
    'hw_graves.defend': 'A hard night. If the walls hold, the abbey stands.',
    'hw_graves.smuggle': 'The mages get away. The Synod will be furious.',
    'hw_graves.hand': 'The Synod is grateful. Agathe will never forgive you.'
  });
  NEW.forEach(m => { if (!C.MOVES.some(x => x.id === m.id)) C.MOVES.push(m); });

  // ---- the Moot: three new ways to call it, and what the climaxes change at the vote ----
  C.MOOT.manualCalls = ['petition', 'debts', 'ward', 'people'];
  Object.assign(C.MOOT.calls, { debts: 'As a Partner you have called in the Crown\'s debts. The lords cannot pay without a king to borrow against.', ward: 'The Archon will seal no Ward and anoint no one until a king is chosen.', people: 'The people\'s petition: ten thousand marks and names, carried to Crown Keep by the Hearthwatch.' });
  { const cr0 = C.mootCallReasons; C.mootCallReasons = function (st) { const r = cr0.apply(this, arguments); if (st.world.realm) return r;
      const s = S.getRank(st, 'syndicate'), y = S.getRank(st, 'synod');
      if (s && s.rank >= 4) r.push('debts'); if (y && y.rank >= 4 && fl(st).synod_tithe !== 'truth') r.push('ward'); if (gwTier(st) === 'trusted' && fl(st).abbey_held) r.push('people'); return r; }; }
  { const mc0 = C.mootCall; C.mootCall = function (st, by) { if (['debts', 'people'].includes(by) && st.world.location !== 'crown_keep') return { ok: false, reason: 'Bring it to Crown Keep' }; return mc0.apply(this, arguments); }; }
  // The Long Ledger's seat votes as you do; the Sleeper's truth leaves the Synod with nothing to say.
  { const sv0 = C.mootSeatVotes; C.mootSeatVotes = function (st) {
      const seats = sv0.apply(this, arguments), m = C.moot(st), f = fl(st), stand = C.mootStanding(st);
      for (const s of seats) {
        if (s.seat === 'syndicate' && f.long_ledger && !f.exposed_hidden_hand && s.how !== 'pressured') { const v = m.declared || m.backing; if (v && stand.includes(v)) { s.list = [v].concat(s.list.filter(c => c !== v)); s.how = 'ledger'; } }
        if (s.seat === 'synod' && f.sleeper_truth && s.how !== 'pressured') { s.list = []; s.how = 'abstain'; }
      }
      return seats; }; }

  C.validateClimax = function () {
    const p = [], cls = D.classes;
    Object.entries(FIGHTS).forEach(([k, F]) => { if (!D.factions[F.faction]) p.push('fight ' + k + ': unknown faction'); if (cls) F.enemies.forEach(e => { if (!cls[e.primary] || cls[e.primary].selectable === false) p.push('fight ' + k + ': illegal class ' + e.primary); }); });
    NEW.forEach(m => { if (m.at && !C.NODES[m.at]) p.push('move ' + m.id + ': unknown place ' + m.at); });
    const d = C.DUNGEONS.voldun_undercity, n = C.NODES.voldun_undercity; if (!n || !n.links.voldun || Object.keys(n.links).length !== 1) p.push('undercity: not a leaf off Vol\'Dun');
    if (!d.floors[d.floors.length - 1].boss) p.push('undercity: last floor must be a boss');
    if (cls) d.floors.forEach(f => f.enemies.forEach(e => { if (!cls[e.primary]) p.push('undercity: unknown class ' + e.primary); }));
    return p;
  };
  (window.GAME_CLIMAX_HOOKS || []).forEach(f => f()); window.GAME_CLIMAX_HOOKS = { push: f => f() };   // story_world.js builds on this
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.CONTRACT_KINDS) go(); else (window.GAME_WORK_HOOKS = window.GAME_WORK_HOOKS || []).push(go);
})();
