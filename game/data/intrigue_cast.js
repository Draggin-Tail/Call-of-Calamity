/* Intrigue, part 2: the named cast, their Moves, leverage and leads (design/intrigue_cast.md, intrigue_beats.md, intrigue_followups.md).
   Pure rules, no screens. Needs intrigue.js (the Moot); runs once it is ready, in whatever order the two files load.
   A Move fires when the player crosses its tripwire: the tripwire is noted when crossed, and the beat is shown on a later (or the same) arrival,
   at most one per arrival, oldest first. A beat always offers a choice. Anything longer becomes a lead (st.world.leads), shown in the Quests tab.
   Fights started by a beat use the road-fight slot (st.world.wander) and report back through C.applyEncounterResult (enc.intrigue). */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
  if (C.MOVES) return;
  const fl = st => st.world.flags, day = st => st.world.day;
  const proofHeld = (st, sid) => { const p = st.world.dossier && st.world.dossier.proof && st.world.dossier.proof[sid]; return !!(p && p.held); };
  const spendProof = (st, sid, how) => { const p = st.world.dossier.proof[sid]; p.held = false; p.used = how; };
  const rankOf = (st, f) => { const r = S.getRank(st, f); return r ? r.rank : 0; };
  const gw = st => (S.goodwillTier ? S.goodwillTier(st).id : 'wary');
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const mootOn = st => { const m = C.moot(st); return m.called !== null && !m.result; };
  const L = (id, f, kind, text) => { C.LORE[id] = { id, faction: f, kind, depth: 0, text }; };

  // ---- dossier lines for the cast (learned when you meet them) ----
  L('fig_harrow', 'crown', 'figure', 'Steward Edric Harrow keeps the seal at Crown Keep. He eats alone and reads receipts for pleasure.');
  L('fig_osric', 'crown', 'figure', 'Lord Osric of Aldermere: the biggest levy in the realm, and a purse he is happy to open.');
  L('fig_corisande', 'crown', 'figure', 'Lady Corisande Hale: thin blood, a beloved face, and a sister she will not let the Synod near.');
  L('fig_voss', 'crown', 'figure', 'Lord Marshal Bertrand Voss speaks for the Lords. He left men at Marrow Ford and has not forgiven himself.');
  L('fig_ilvane', 'synod', 'figure', 'Archon Ilvane: younger than her title. She talks about the Ward the way other people talk about rain.');
  L('fig_thorne', 'synod', 'figure', 'Inquisitor-Captain Brannoc Thorne names you, the charge and himself before he draws. He believes all of it.');
  L('fig_crane', 'syndicate', 'figure', 'Factor Odile Crane signs for the Syndicate, and does not know who signs for her.');
  L('fig_agathe', 'hearthwatch', 'figure', 'Mother Agathe of Whitestone mends blankets and keeps secrets, and does not look up when you come in.');
  L('fig_old_standard', 'broken_banner', 'figure', 'Captain Old Standard has kept two hundred men together for eighteen years with one story.');
  L('fig_wil', 'broken_banner', 'figure', 'Wil Fenn, a Banner rider who shoes horses badly and laughs about it.');
  L('harrow_ledger', 'syndicate', 'ideal', 'Harrow, over supper: a king dies and a war starts; a debt comes due and a man pays it. Nobody has starved since the Interval began.');
  L('ilvane_ward', 'synod', 'ideal', 'The Archon\'s Great Ward: one ward over the realm, keyed to the Synod and sealed by a king. No village burns for a wrong book again, and no other magic is allowed.');
  L('ilvane_down', 'synod', 'secret', 'Asked where the seized books go, the Archon said one word: "Down."');
  L('harrow_buys', 'crown', 'secret', 'Harrow buys votes in his own hand.');
  L('osric_arming', 'crown', 'secret', 'Osric was arming at Rookwood Barn before anyone had voted.');

  // ---- leverage: where it comes from (see C.LEVERAGE in intrigue.js) ----
  // Hask (5th meeting) -> Voss; Maren (5th) -> Ilvane; burning Bad Paper -> Crane; the ossuary -> Agathe; Wil's ring -> Old Standard;
  // the Rookwood ledger -> Osric; hearing Corisande out -> Corisande; Novice Aldric's proof -> Thorne.
  { const lore0 = C.lore; C.lore = function (st, ev) { const r = lore0.apply(this, arguments);
      if (ev === 'npc:hask:5') C.gainLeverage(st, 'lev_voss', 'Told by Corporal Hask'); if (ev === 'npc:maren:5') C.gainLeverage(st, 'lev_ilvane', 'Told by Sister Maren'); return r; }; }
  { const ac0 = C.applyChoice; C.applyChoice = function (st, cid, oid) { const r = ac0.apply(this, arguments); if (r && r.ok && cid === 'bad_paper' && oid === 'burn') C.gainLeverage(st, 'lev_crane', 'The numbers in Osric\'s bundle did not add up'); return r; }; }
  { const ia0 = C.informantAct; if (ia0) C.informantAct = function (st, at, k, how) { const r = ia0.apply(this, arguments); if (r && r.ok && k === 'aldric' && how === 'take') C.gainLeverage(st, 'lev_thorne', 'Folded inside the ledger: a letter Thorne never sent'); return r; }; }
  { const rj0 = C.reportJob; C.reportJob = function (st, id) { const r = rj0.apply(this, arguments); if (r && r.ok && id === 'old_standards_price' && !C.knows(st, 's_prince_p')) C.learn(st, 's_prince_p', 'Given by Old Standard'); return r; }; }

  // ---- leads (longer threads a beat starts; done when their check passes) ----
  C.LEADS = {
    stewards_price: { name: 'The Steward\'s Price', who: 'Harrow', text: 'Harrow wants the Second Book and will see you himself at Crown Keep.', done: st => !proofHeld(st, 'hidden_hand') || !!fl(st).harrow_threatened },
    aldermere_steel: { name: 'Aldermere Steel', who: 'Osric', text: 'Osric\'s raiders carried a chit: "Forty spears, Rookwood barn." Find the armoury near Aldermere Hold.', done: st => !!(fl(st).armoury_burned || C.leverageHeld(st, 'lev_osric')) },
    sisters_road: { name: 'The Sister\'s Road', who: 'Corisande', text: 'Meet Brielle Hale at Sheepfold and bring her safe to Hearthstone Priory.', done: st => !!(fl(st).sisters_road_done || fl(st).brielle_taken) },
    torn_page: { name: 'The Torn Page', who: 'Mother Agathe', text: 'Agathe will not hand over the page to a stranger. Earn the Hearthwatch\'s trust, or search the abbey\'s ossuary.', done: st => C.knows(st, 's_prince_e') }
  };
  const leads = st => st.world.leads || (st.world.leads = {});
  const startLead = (st, id) => { if (!leads(st)[id]) leads(st)[id] = { day: day(st) }; };
  C.leadList = st => Object.entries(leads(st)).map(([id, l]) => Object.assign({ id, since: l.day }, C.LEADS[id], { done: C.LEADS[id].done(st) }));

  // ---- fights started by a beat ----
  const FIGHTS = {
    osric_raid: { name: 'Aldermere raiders', enemyFaction: 'outlaws', enemies: [{ primary: 'warrior', name: 'Aldermere Levy' }, { primary: 'archer', name: 'Levy Bowman' }, { primary: 'rogue', name: 'Cloaked Knife' }], text: 'Smoke at the edge of town. Men in plain cloaks and good Aldermere boots came for the place you were sleeping.' },
    brielle_patrol: { name: 'Synod patrol', enemyFaction: 'synod', enemies: [{ primary: 'wizard', name: 'Synod Adept' }, { primary: 'cleric', name: 'Synod Warden' }, { primary: 'apprentice', name: 'Ward-Reader' }], text: 'A Synod patrol is checking travellers on the road. Brielle pulls her hood down and does not look at the fire in their lanterns.' },
    old_standard_duel: { name: 'First blood with Old Standard', enemyFaction: 'broken_banner', enemies: [{ primary: 'warlord', name: 'Captain Old Standard' }], objective: { type: 'leader', leader: 0 }, text: 'First blood. He rolls up a sleeve covered in old scars and grins.' },
    thorne_again: { name: 'Thorne, again', enemyFaction: 'synod', enemies: [{ primary: 'warlord', name: 'Brannoc Thorne' }, { primary: 'cleric', name: 'Confessor' }, { primary: 'wizard', name: 'Inquisitor' }], objective: { type: 'leader', leader: 0 }, text: 'Thorne puts his helmet back on. "Then we do this properly."' }
  };
  function startFight(st, key) {
    const F = FIGHTS[key], at = st.world.location, region = C.NODES[at].region, lv = lvl(st);
    const enc = { name: F.name, map: C.mapFor(st, region, at), rec: lv + 1, enemyFaction: F.enemyFaction, enemies: F.enemies.map(e => Object.assign({}, e)), objective: F.objective || null, once: false, wander: true, intrigue: key, reward: { xp: 60 + 14 * lv, gold: 15 + 5 * lv } };
    st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text: F.text }; C.ENCOUNTERS.wander = enc; return { fight: key };
  }
  const RESULT = {
    osric_raid: () => {},
    brielle_patrol: (st, won) => { if (!won) { fl(st).brielle_taken = day(st); fl(st).brielle_with_you = 0; } },
    old_standard_duel: (st, won) => { if (won && !C.knows(st, 's_prince_p')) C.learn(st, 's_prince_p', 'Won from Old Standard'); },
    thorne: (st, won) => { if (won) fl(st).thorne_beaten = day(st); },
    thorne_again: (st, won) => { if (won) fl(st).thorne_beaten_twice = day(st); }
  };
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
      const E = C.ENCOUNTERS[encId], out = ae0.apply(this, arguments); if (E && E.intrigue && RESULT[E.intrigue]) RESULT[E.intrigue](st, !!(res && res.won)); return out; }; }
  // The first Synod hunt against the Sealed Ledger is led by Thorne himself; once he has turned, half their hunts never come.
  { const ph0 = C.proofHunt; C.proofHunt = function (st) { const r = ph0.apply(this, arguments);
      if (r && r.enc && r.enc.proofFor === 'forbidden_hoard') {
        if (fl(st).thorne_turned && day(st) % 2) { st.world.wander = null; return null; }
        if (!fl(st).thorne_met) { fl(st).thorne_met = day(st); r.enc.enemies[0] = { primary: 'warlord', name: 'Brannoc Thorne' }; r.enc.objective = { type: 'leader', leader: 0 }; r.enc.intrigue = 'thorne'; r.enc.name = 'Inquisitor-Captain Thorne';
          r.text = 'The squad on the road does not ambush you. They stand in a line across it, and the big man in the middle calls out your name, the charge, and his own: Brannoc Thorne, Inquisitor-Captain.'; C.learn(st, 'fig_thorne', 'Met on the road'); }
      } return r; }; }

  // ---- the Moves ----
  // { id, who, at (place or null = anywhere), trip(st), meet (dossier figure), setup, lines, options: [{ id, label, if?(st), go(st) -> { text?, repeat?, fight? } }] }
  const O = (id, label, go, cond) => ({ id, label, go, if: cond });
  C.MOVES = [
    { id: 'harrow_supper', who: 'harrow', at: 'crown_keep', meet: 'fig_harrow', trip: st => C.knows(st, 's_hand_r1') && (rankOf(st, 'crown') >= 2 || rankOf(st, 'syndicate') >= 2),
      setup: 'A page finds you before your boots are dry. "The Steward asks if you have eaten."\n\nSteward Harrow has kept the royal seal through all the years of the Interval. He eats alone in a small room off the seal hall, at a table with two plates. One of them is already served.',
      lines: ['"Sit. I have read about you. Not in reports. In receipts."', '"A king dies, a war starts. A debt comes due, a man pays it. Which would you rather run a realm on?"', '"Nobody has starved since the Interval began. No lord has marched on another. The bridges are mended and the grain moves. Notice that, even if you notice nothing else."'],
      options: [O('who', '"Who holds the cipher?"', st => { C.learn(st, 'harrow_ledger', 'Harrow, over supper'); return { text: '"Someone who balances the books."' }; }),
        O('love', '"A ledger can\'t love anyone."', st => { C.learn(st, 'harrow_ledger', 'Harrow, over supper'); return { text: '"Neither can a crown. But a crown can be inherited by an idiot."' }; }),
        O('cold', 'Leave the plate untouched', st => { C.learn(st, 'harrow_ledger', 'Harrow, over supper'); fl(st).harrow_cold = day(st); return { text: 'He notices. He notices everything.' }; })] },
    { id: 'harrow_price', who: 'harrow', at: null, meet: 'fig_harrow', trip: st => proofHeld(st, 'hidden_hand') && rankOf(st, 'syndicate') < 3,
      setup: 'A grey-coated clerk is waiting by your table with a chair already pulled out. He does not sit.',
      lines: ['"The Steward knows what you carry. He would like it back, and he is fair about such things."', '"His offer: Partner. Your name in the Long Ledger, not under it, and a share of everything it touches. And nobody comes for you on the road again." He glances at the window. "Nobody."'],
      options: [O('give', 'Hand it over', st => partnerFor(st, 'Harrow')), O('refuse', 'Refuse', st => { fl(st).harrow_refused = day(st); startLead(st, 'stewards_price'); return { text: '"He thought you might. He will see you himself."' }; })] },
    { id: 'harrow_in_person', who: 'harrow', at: 'crown_keep', meet: 'fig_harrow', trip: st => !!fl(st).harrow_refused && proofHeld(st, 'hidden_hand'),
      setup: 'No supper this time. Harrow stands at the seal table with the Crown\'s seal in one hand, as if weighing it. He looks older than he did, and much less patient.',
      lines: ['"You turned down my clerk. Fair. Clerks are easy to turn down."', '"So, plainly: give me the Book and you will be a Partner by morning. Keep it and I cannot stop the people who think less of you than I do."'],
      options: [O('give', 'Hand it over', st => partnerFor(st, 'Harrow')),
        O('threaten', 'Threaten him', st => { fl(st).harrow_threatened = day(st); S.changeStanding(st, 'crown', -20, { reason: 'threatened the Steward', ripple: false }); cancel(st, 'harrow_office'); return { text: '"Go on, then." He does not move.' }; }),
        O('leave', 'Leave', () => ({ text: 'He does not ask again.' }))] },
    { id: 'harrow_office', who: 'harrow', at: null, meet: 'fig_harrow', trip: st => mootOn(st) && !fl(st).harrow_threatened,
      setup: 'The Moot notices are still wet on the boards when a rider brings you a letter under the Steward\'s own seal.',
      lines: ['"The Moot will ask the realm to choose between an honest ledger and a dishonest crown. Declare for the Regency and the Lord\'s Hand is yours: its keys, its stipend and its quiet. E.H."'],
      options: [O('accept', 'Accept', st => { fl(st).pledged_regency = day(st); return { text: 'You keep the letter. It is the kind of thing that is useful later.' }; }), O('decline', 'Decline', () => ({})),
        O('burn', 'Burn the letter', st => { C.learn(st, 'harrow_buys', 'A letter you burned'); return {}; })] },
    // The Steward's Offer: give Harrow back the Second Book and he drops the Regency to stand openly as the Long Ledger (design/succession_moot.md, Two new claimants)
    { id: 'stewards_offer', who: 'harrow', at: 'crown_keep', meet: 'fig_harrow', trip: st => mootOn(st) && !C.moot(st).declared && proofHeld(st, 'hidden_hand') && !fl(st).crane_hand,
      setup: 'Harrow is alone in the seal hall with the Moot roll in front of him. He has crossed out "The Regency" in his own hand, neatly, and left the space beside it blank.',
      lines: ['"You could lay that book before the Lords and finish me. Or you could give it back, and I will stop pretending."', '"No more Steward. I will stand as what I am: the man the whole realm owes. Let them vote on the ledger with their eyes open."'],
      options: [O('give', 'Give him the Book', st => { spendProof(st, 'hidden_hand', 'ledger'); fl(st).ledger_stands = Math.max(1, day(st)); return { text: 'He writes "The Long Ledger" in the blank space, and blots it. "Thank you. Honesty is expensive. I can afford it now."' }; }),
        O('keep', 'Keep it', st => { fl(st).stewards_offer_refused = day(st); return { text: '"Then lay it, if you are going to," he says. "Do not keep me waiting. Waiting costs interest."' }; })] },
    { id: 'osric_purse', who: 'osric', at: null, meet: 'fig_osric', trip: st => Object.values(C.moot(st).canvass).some(c => c.for !== 'osric'),
      setup: 'An Aldermere knight, still muddy from the road, bows too low. The purse he holds out is heavy enough to make the bow worth it.',
      lines: ['"My lord hears you have been telling people who should be king. He admires the energy."', '"He asks only that you stop. Take this for your trouble, and your trouble ends here."'],
      options: [O('take', 'Take the purse', st => { const g = 150 + 50 * lvl(st); st.inventory.gold += g; fl(st).pledged_osric = day(st); return { text: 'The knight smiles like a man who has never once been refused.', gold: g }; }),
        O('refuse', 'Refuse', st => { fl(st).osric_refused = day(st); return { text: '"Then my lord will be sorry, and so will you."' }; })] },
    { id: 'osric_steel', who: 'osric', at: null, urgent: true, trip: st => !!(fl(st).osric_refused || fl(st).osric_pledge_broken),
      setup: 'Smoke at the edge of town, and shouting. Men in plain cloaks and good Aldermere boots have set fire to the inn where you were meant to be sleeping.\n\nThey are still in the yard, looking for you among the people who ran out.',
      lines: [],
      options: [O('fight', 'Fight them', st => { rookwood(st); return Object.assign({ text: 'On a body afterwards: a requisition chit. "Forty spears, Rookwood barn."' }, startFight(st, 'osric_raid')); }),
        O('slip', 'Slip away', st => { rookwood(st); return { text: 'A frightened stable boy tells you where the riders came from: Rookwood barn, by Aldermere.' }; })] },
    { id: 'rookwood_choice', who: 'osric', at: 'rookwood_barn', trip: st => !!fl(st).armoury_won,
      setup: 'Rookwood barn is full to the rafters: spear-hafts stacked like firewood, helmets in rows, and enough arrows to start a war, or end one quickly.\n\nIn a strongbox under the hay is Lord Osric\'s own ledger. It lists every spear, who paid for it, and which lords have promised to look the other way.', lines: [],
      options: [O('burn', 'Burn it', st => { fl(st).armoury_burned = day(st); C.learn(st, 'osric_arming', 'Rookwood Barn'); return { text: 'Osric will have no army to take the hall with.' }; }),
        O('ledger', 'Leave the spears and take the ledger', st => { C.gainLeverage(st, 'lev_osric', 'Osric\'s ledger, from Rookwood'); C.learn(st, 'osric_arming', 'Rookwood Barn'); return { text: 'The armoury still stands. But now you know what he owes.' }; })] },
    { id: 'sisters_road', who: 'corisande', at: null, meet: 'fig_corisande', trip: st => gw(st) === 'trusted' || Object.values(C.moot(st).canvass).some(c => c.for === 'corisande'),
      setup: 'A woman in a plain cloak sits at the end of a chapel bench. When she lowers her hood you see why she wears one.',
      lines: ['"I am told you can be trusted, which is the most dangerous thing anyone can say about a person."', '"My sister hears voices in the hearth. The Synod calls that a gift and takes it away. If I am to be anointed, they will search my house first."', '"Get her to Hearthstone Priory. Then I can stand with nothing to hide."'],
      options: [O('accept', 'Accept', st => { C.gainLeverage(st, 'lev_corisande', 'Corisande told you herself'); fl(st).brielle_waiting = day(st); startLead(st, 'sisters_road'); return { text: 'She tells you where: Sheepfold.' }; }),
        O('refuse', 'Refuse', st => { C.gainLeverage(st, 'lev_corisande', 'Corisande told you herself'); return { text: '"Then I will find someone who will."' }; })] },
    { id: 'brielle_meet', who: 'corisande', at: 'sheepfold', trip: st => !!fl(st).brielle_waiting,
      setup: 'Brielle Hale is younger than Corisande and does not look like her. She is warming her hands at a hearth that is not lit.',
      lines: ['"My sister sent you? She would send a stranger before she would send a letter. Letters get read."', '"Do not stand so close to the fire. Sometimes it answers."'],
      options: [O('go', 'Set out for Hearthstone Priory', st => { fl(st).brielle_with_you = day(st); return {}; })] },
    { id: 'brielle_priory', who: 'corisande', at: 'hearthstone_priory', trip: st => !!fl(st).brielle_with_you && !fl(st).brielle_taken,
      setup: 'A warden takes her in without asking her name.', lines: ['Brielle, at the door: "Tell my sister the fire said she will win. It does not say things like that. I just wanted to say something kind."'],
      options: [O('ok', 'Go', st => { fl(st).sisters_road_done = day(st); fl(st).brielle_with_you = 0; if (S.changeGoodwill) S.changeGoodwill(st, 5, 'brought Brielle to sanctuary'); if (fl(st).corisande_withdrawn && !C.moot(st).open) fl(st).corisande_withdrawn = 0; return {}; })] },
    { id: 'corisande_withdraw', who: 'corisande', at: null, trip: st => !!(st.world.leverage && st.world.leverage.lev_corisande && st.world.leverage.lev_corisande.spent) && !fl(st).sisters_road_done,
      setup: 'A notice in Corisande\'s own hand is on every board: she withdraws her claim "for the peace of my house".', lines: [],
      options: [O('go', 'Go to her', st => { startLead(st, 'sisters_road'); if (!fl(st).brielle_waiting) fl(st).brielle_waiting = day(st); return { text: 'If her sister is safe before the Moot sits, she will stand again.' }; }), O('let', 'Let it stand', () => ({}))] },
    { id: 'voss_rearguard', who: 'voss', at: 'crown_keep', meet: 'fig_voss', trip: st => mootOn(st) && !C.moot(st).open && rankOf(st, 'broken_banner') > 0 && !fl(st).wil_proclaimed,
      setup: 'The Lord Marshal finds you on the wall walk, where the wind carries words away. He is old enough to have stood on worse walls.',
      lines: ['"I hear you want the Banner in the Hall of Oaths."', '"I left those men at Marrow Ford with a promise I could not keep. I will not have them stand in that hall and say so to my face."', '"Keep them outside. A Crown pardon for one man of your choosing, signed by me. That is worth more than a bench."'],
      options: [O('agree', 'Agree', st => { fl(st).voss_unseated = day(st); C.moot(st).seated.banner = false; fl(st).voss_pardon = 1; return {}; }), O('refuse', 'Refuse', () => ({})),
        O('tell', '"Tell them yourself."', st => { fl(st).voss_speak = day(st); return { text: 'He looks at you a long time. "Maybe I will."' }; })] },
    { id: 'ilvane_ward', who: 'ilvane', at: 'voldun', meet: 'fig_ilvane', trip: st => rankOf(st, 'synod') >= 2 || C.knows(st, 's_hoard_r1'),
      setup: 'You are led up a stair of black glass to a windowless room full of lamps. Archon Ilvane, who leads the Synod, is younger than her title and much calmer than her inquisitors.\n\nShe pours you water herself.',
      lines: ['"Novices think we take grimoires to read them. We take them so no one does."', '"Picture a realm where no village burns because a boy found the wrong book. One ward, one key, held by people who have given their lives to holding it."', '"It needs a king\'s seal. That is all I want from whoever sits the throne."'],
      options: [O('magic', '"And everyone else\'s magic?"', st => { C.learn(st, 'ilvane_ward', 'The Archon, at Vol\'Dun'); return { text: '"Hedge-craft dies. I am sorry. I was a hedge-witch once; it is not a loss I speak of lightly."' }; }),
        O('books', '"Where do the books go now?"', st => { C.learn(st, 'ilvane_ward', 'The Archon, at Vol\'Dun'); C.learn(st, 'ilvane_down', 'The Archon, at Vol\'Dun'); return { text: '"Down." She says nothing more.' }; }),
        O('terms', 'Carry her terms to Crown Keep', st => { C.learn(st, 'ilvane_ward', 'The Archon, at Vol\'Dun'); const r = C.acceptJob(st, 'writ_of_wards'); return { text: r.ok ? 'She hands you a sealed sheaf.' : '"When there is a Moot to carry them to."' }; }, st => mootOn(st)),
        O('leave', 'Leave', st => { C.learn(st, 'ilvane_ward', 'The Archon, at Vol\'Dun'); return {}; })] },
    { id: 'ilvane_return', who: 'ilvane', at: null, meet: 'fig_ilvane', trip: st => proofHeld(st, 'forbidden_hoard'),
      setup: 'An inquisitor waits at the gate with empty hands held out, the old sign for parley. He is very careful not to look at your pack.',
      lines: ['"The Archon asks for the Ledger. She says you have read it, so you know why she asks."', '"Return it and the Inner Circle will open its door. Keep it and she cannot protect you from those who will not ask."'],
      options: [O('give', 'Return it', st => { spendProof(st, 'forbidden_hoard', 'returned'); fl(st).inner_circle_invite = day(st); const r = S.getRank(st, 'synod'); if (r && r.rank < 4) S.promote(st, 'synod', { force: true }); else S.changeStanding(st, 'synod', 200, { reason: 'returned the Sealed Ledger', ripple: false }); return { text: 'The inquisitor bows, very slightly.' }; }),
        O('keep', 'Keep it', st => { st.world.dossier.proof.forbidden_hoard.defended += 2; return { text: 'He nods as if he had expected nothing else, and walks away faster than he came.' }; })] },
    { id: 'thorne_parley', who: 'thorne', at: null, meet: 'fig_thorne', trip: st => !!fl(st).thorne_beaten && proofHeld(st, 'forbidden_hoard'),
      setup: 'Inquisitor-Captain Thorne comes alone this time, helmet under his arm, and sits on a milestone on the other side of the road. There is a bandage under his collar, from the last time.',
      lines: ['"I have lost to you once. I would rather not make a habit of it."', '"So tell me why anyone would bleed for a book."'],
      options: [O('show', 'Show him the Ledger', st => { fl(st).thorne_turned = day(st); return { text: 'He reads for a long time. "These are my arrests. People I brought in myself." Then, quietly: "Where did they go?" He does not hunt you again.' }; }),
        O('lie', '"It is worthless."', st => Object.assign({ text: '"Then give it to me."' }, startFight(st, 'thorne_again'))),
        O('leave', 'Leave', () => ({ text: 'He lets you go, once.' }))] },
    { id: 'crane_cipher', who: 'crane', at: 'river_cities', meet: 'fig_crane', trip: st => C.knows(st, 's_hand_e'),
      setup: 'Factor Odile Crane, who signs for the Syndicate, receives you in a counting room where every clerk is pretending not to listen. When she waves a hand, they all find somewhere else to be.',
      lines: ['"You have been to Ledgerhall and looked at the marks in the margins. So did I, for nine years."', '"I sign for the Syndicate. I do not know who signs for me. That is an uncomfortable thing to say aloud."', '"If you learn who, tell me first. I will make it worth your while."'],
      options: [O('promise', 'Promise to', st => { fl(st).crane_promised = day(st); return {}; }), O('you', '"Maybe it is you."', () => ({ text: '"I would have given myself a raise."' })), O('nothing', 'Tell her nothing', () => ({}))] },
    { id: 'crane_buyer', who: 'crane', at: 'river_cities', meet: 'fig_crane', trip: st => proofHeld(st, 'hidden_hand') && !fl(st).crane_hand && rankOf(st, 'syndicate') < 3,
      setup: 'Crane meets you after dark in a warehouse that smells of grain and lamp oil. A strongbox is already open on the table between you, full.',
      lines: ['"You found it. I can see it on you. People carrying that book walk like it is heavier than it is."', '"Sell it to me. Then whoever holds the cipher holds nothing, and I hold the Syndicate."'],
      options: [O('sell', 'Sell it', st => { const g = Math.round((400 + 40 * lvl(st)) * (fl(st).crane_promised ? 1.25 : 1)); spendProof(st, 'hidden_hand', 'sold'); st.inventory.gold += g; fl(st).crane_hand = day(st); return { text: 'She counts it out without looking at the coins. "Pleasure."', gold: g }; }),
        O('refuse', 'Refuse', st => { const n = (fl(st).crane_asked || 0) + 1; fl(st).crane_asked = n; return { text: '"The offer stays open. I do not."', repeat: n < 2 }; })] },
    { id: 'agathe_page', who: 'agathe', at: 'whitestone_abbey', meet: 'fig_agathe', trip: st => C.knows(st, 's_prince_r1'),
      setup: 'Mother Agathe, who keeps Whitestone Abbey and the Hearthwatch with it, is mending a blanket in the register room. She does not look up when you come in.',
      lines: ['"You are the one asking about the page. Sit. Your feet are loud."'],
      options: [O('take', 'Hear her out', st => { C.learn(st, 's_prince_e', 'Given by Mother Agathe'); return { text: '"I tore it out the week the Crown came asking after the prince\'s boy. A page is a small thing to burn. I did not burn it." She takes it from her sleeve. "Do better by him than the world has."' }; }, st => gw(st) === 'trusted'),
        O('ask', 'Ask what it would take', st => { startLead(st, 'torn_page'); return { text: '"I do not know you well enough to hand you a child\'s life. Come back when the sick know your name."' }; }, st => gw(st) !== 'trusted')] },
    { id: 'agathe_return', who: 'agathe', at: 'whitestone_abbey', trip: st => !!leads(st).torn_page && !C.knows(st, 's_prince_e'),
      setup: 'The register room is empty, and Agathe\'s mending lies folded on her chair. Beyond it, narrow stairs go down to the ossuary, where the abbey keeps its dead in labelled niches.', lines: [],
      options: [O('earned', 'Ask Agathe again', st => { C.learn(st, 's_prince_e', 'Given by Mother Agathe'); return { text: '"The sick know your name. Fine."' }; }, st => gw(st) === 'trusted'),
        O('search', 'Search the ossuary', st => { C.learn(st, 's_prince_e', 'Found in the abbey ossuary'); if (S.changeGoodwill) S.changeGoodwill(st, -5, 'went through the dead'); C.gainLeverage(st, 'lev_agathe', 'The newer names in the ossuary'); return { text: 'Among the newer names, a little skull labelled "the prince\'s boy". Behind it, folded small: the torn page. The skull is a sheep\'s.' }; }),
        O('leave', 'Leave it for now', () => ({ repeat: true }))] },
    { id: 'old_standard', who: 'old_standard', at: null, meet: 'fig_old_standard', trip: st => C.knows(st, 's_prince_e') && !C.knows(st, 's_prince_p'),
      setup: 'Captain Old Standard, who has led the Broken Banner for eighteen years, is waiting at your fire when you come back to it. He has helped himself to your stew, and his sword is across his knees.',
      lines: ['"You have a page from a book you should not have read. Sit down before I decide what you are."', '"Eighteen years I have kept that boy alive by lying to two hundred men. The lie keeps them together. The truth gets him killed."'],
      options: [O('mine', '"I am one of yours."', st => { C.learn(st, 's_prince_p', 'Given by Old Standard'); return { text: '"So you are. Do not make me regret it." He hands over the Naming Ring.' }; }, st => rankOf(st, 'broken_banner') >= 2),
        O('duel', 'Duel him', st => Object.assign({ text: '"First blood. Win and you get the Ring, and my respect, which is rarer."' }, startFight(st, 'old_standard_duel'))),
        O('bargain', 'Bargain', st => { if (mootOn(st)) { fl(st).old_standard_bargain = day(st); return { text: '"A pardon. In writing. Then we talk." (Ask him for the job at Outlaw\'s Rest.)' }; } const g = 400; if (st.inventory.gold < g) return { text: '"Come back with more than that."', repeat: true }; st.inventory.gold -= g; C.learn(st, 's_prince_p', 'Bought from Old Standard'); return { text: '"Coin is a pardon of sorts." He puts the ring on the table.', gold: -g }; })] },
    { id: 'wil_crown', who: 'wil', at: 'outlaws_rest', meet: 'fig_wil', trip: st => C.knows(st, 's_prince_r1'),
      setup: 'Wil Fenn, a young Banner rider, is shoeing a horse badly and laughing about it. The horse is not laughing.', lines: [],
      view: st => proofHeld(st, 'lost_prince') ? ['He turns the ring over. It fits. He takes it off again as if it burned.', '"My mother had one like it. She told me it was tin."', '"If I stand, what do I owe them? The men, I mean. Everyone."']
        : C.knows(st, 's_prince_e') ? ['He reads the page twice. "It is a name. Lots of people have names." He hands it back too quickly.'] : ['"Me? The old king\'s grandson?" He laughs until he has to sit down.', '"Old Standard tells that one every winter. Last year I was a duke\'s bastard. The year before, a dragon."'],
      options: [O('everything', '"Everything."', st => wilYes(st, 'everything'), st => proofHeld(st, 'lost_prince')),
        O('better', '"Only to be better than the others."', st => wilYes(st, 'better'), st => proofHeld(st, 'lost_prince')),
        O('his_choice', '"That is yours to decide."', st => wilYes(st, 'his_choice'), st => proofHeld(st, 'lost_prince')),
        O('leave', 'Leave it', () => ({ repeat: true }), st => !proofHeld(st, 'lost_prince'))] },
    // The Archon's Ward: knowing what sleeps under Vol'Dun, an Inquisitor can carry Ilvane's claim to the Moot
    { id: 'archons_ward', who: 'ilvane', at: 'voldun', meet: 'fig_ilvane', trip: st => mootOn(st) && !C.moot(st).declared && proofHeld(st, 'forbidden_hoard') && rankOf(st, 'synod') >= 3,
      setup: 'The Archon receives you below the cathedral, where the floor is warm and the walls hum very faintly.',
      lines: ['"You have read the Sealed Ledger, so you know what the tithe feeds. Osric would starve it to pay his spears. Harrow would put it out to tender."', '"Only a ruler who keeps the Ward fed can keep the realm safe. Carry my claim to Crown Keep, Inquisitor. I will stand."'],
      options: [O('carry', 'Carry her claim', st => { fl(st).ilvane_stands = Math.max(1, day(st)); return { text: 'She seals the claim with the Ward\'s own sigil. "They will hate me," she says. "They will be alive to do it."' }; }),
        O('refuse', 'Refuse', st => { fl(st).archons_ward_refused = day(st); return { text: '"Then the Sleeper will have to trust someone else\'s appetite," she says.' }; })] },
  ];
  const byId = id => C.MOVES.find(m => m.id === id);
  function wilYes(st, a) { fl(st).wil_consents = day(st); fl(st).wil_answer = a; C.gainLeverage(st, 'lev_old_standard', 'Wil\'s mother told him it was tin'); return { text: 'He puts the ring back on and leaves it there.' }; }
  function rookwood(st) { if (C.reveal) C.reveal(st, 'rookwood_barn'); startLead(st, 'aldermere_steel'); }
  function partnerFor(st) {
    spendProof(st, 'hidden_hand', 'harrow'); const r = S.getRank(st, 'syndicate');
    if (r) { while (S.getRank(st, 'syndicate').rank < 4 && S.promote(st, 'syndicate', { force: true }).ok); return { text: 'By morning your name is in the Long Ledger, in a column very few names reach.' }; }
    const j = S.canJoin ? S.canJoin(st, 'syndicate', { force: true }) : { ok: false };
    if (j.ok) { S.joinRank(st, 'syndicate', { force: true }); while (S.getRank(st, 'syndicate').rank < 4 && S.promote(st, 'syndicate', { force: true }).ok); return { text: 'By morning you are a Partner of a company you never applied to.' }; }
    st.inventory.gold += 400; return { text: 'You hold too many oaths already. He pays you in coin instead, and remembers you as a Partner who declined the title.', gold: 400 };
  }
  // ---- the engine ----
  const mv = st => st.world.moves || (st.world.moves = { crossed: {}, fired: {}, cancelled: {}, pending: null });
  function noteCrossed(st) { const M = mv(st); for (const m of C.MOVES) if (!M.fired[m.id] && !M.cancelled[m.id] && M.crossed[m.id] === undefined && m.trip(st)) M.crossed[m.id] = day(st); }
  function cancel(st, id) { const M = mv(st); if (!M.fired[id]) M.cancelled[id] = day(st); if (M.pending === id) M.pending = null; }
  C.checkMoves = function (st, at) {
    const M = mv(st); at = at || st.world.location;
    noteCrossed(st);
    if (M.pending) return C.moveBeat(st);
    const due = C.MOVES.filter(m => M.crossed[m.id] !== undefined && !M.fired[m.id] && !M.cancelled[m.id] && (!m.at || m.at === at) && m.trip(st)).sort((a, b) => (!!b.urgent - !!a.urgent) || M.crossed[a.id] - M.crossed[b.id]);   // urgent Moves (a broken pledge) jump the queue
    if (!due.length) return null; M.pending = due[0].id; return C.moveBeat(st);
  };
  C.moveBeat = function (st) {
    const M = mv(st), m = M.pending && byId(M.pending); if (!m) return null;
    return { id: m.id, who: m.who, setup: m.setup, lines: m.view ? m.view(st) : m.lines, options: m.options.filter(o => !o.if || o.if(st)).map(o => ({ id: o.id, label: o.label, hint: o.hint || (C.MOVE_HINTS && C.MOVE_HINTS[m.id + '.' + o.id]) || null })) };
  };
  C.chooseMove = function (st, optId) {
    const M = mv(st), m = M.pending && byId(M.pending); if (!m) return { ok: false, reason: 'Nothing is happening' };
    const o = m.options.find(x => x.id === optId && (!x.if || x.if(st))); if (!o) return { ok: false, reason: 'Not an option' };
    const r = o.go(st) || {}; M.pending = null; if (m.meet) C.learn(st, m.meet, 'Met in person');
    if (r.repeat) delete M.crossed[m.id]; else M.fired[m.id] = day(st);
    return Object.assign({ ok: true, move: m.id }, r);
  };
  C.movesFired = st => Object.keys(mv(st).fired);
  // Scenes waiting at a place: everything due here that is not yet resolved, including one you closed or put off ("Not yet").
  // Arriving still opens the first one by itself; these are what the place's own sheet lists, so you never have to leave and come back.
  C.movesHere = function (st, at) {
    const M = mv(st); at = at || st.world.location; noteCrossed(st);
    return C.MOVES.filter(m => m.at === at && (M.pending === m.id || (M.crossed[m.id] !== undefined && !M.fired[m.id] && !M.cancelled[m.id] && m.trip(st)))).map(m => ({ id: m.id, who: m.who, pending: M.pending === m.id }));
  };
  C.startMove = function (st, id) {
    const M = mv(st); if (M.pending && M.pending !== id) return C.moveBeat(st);
    const m = byId(id); if (!m || (m.at && m.at !== st.world.location) || M.fired[id] || M.cancelled[id] || !m.trip(st)) return null;
    M.pending = id; return C.moveBeat(st);
  };
  // Breaking Osric's pledge brings his men at once.
  { const cv0 = C.canvass; C.canvass = function (st, seat, how, claimant) { const r = cv0.apply(this, arguments); if (r && r.ok && fl(st).pledged_osric && claimant !== 'osric') fl(st).osric_pledge_broken = day(st); return r; }; }

  // ---- using leverage: Pressure (a seat, via C.canvass), Cancel (one of that figure's Moves) or Favour ----
  const FIG = { lev_voss: 'voss', lev_crane: 'crane', lev_ilvane: 'ilvane', lev_agathe: 'agathe', lev_old_standard: 'old_standard', lev_osric: 'osric', lev_corisande: 'corisande', lev_thorne: 'thorne' };
  const FAC = { voss: 'crown', crane: 'syndicate', ilvane: 'synod', agathe: 'hearthwatch', old_standard: 'broken_banner', osric: 'crown', corisande: 'crown', thorne: 'synod' };
  const clearBounty = (st, f) => { delete (st.world.bounty || {})[f]; delete fl(st)['bounty_' + f]; if (st.world.hunt && st.world.hunt[f]) st.world.hunt[f].n = 0; };
  const FAVOUR = {
    voss: st => { if (fl(st).voss_speak && mootOn(st)) { C.moot(st).seated.banner = true; return 'Voss stands up in the hall and asks that the Banner be seated. Nobody argues with him.'; } clearBounty(st, 'crown'); return 'A Crown pardon, signed by the Marshal. Your Crown bounty is gone.'; },
    crane: st => { fl(st).crane_discount = day(st); return 'Syndicate shops will treat you as family: 10% off, for good.'; },
    ilvane: st => { fl(st).inner_circle_invite = day(st); return 'The Inner Circle\'s door is open to you, whatever your rank.'; },
    agathe: st => { const b = Object.keys(st.world.bounty || {})[0]; if (b) clearBounty(st, b); return b ? 'Sanctuary, and a word in the right ear: one bounty is gone.' : 'Sanctuary whenever you need it.'; },
    old_standard: st => { if (mootOn(st)) C.moot(st).seated.banner = true; return 'The Banner will sit wherever you ask them to.'; },
    osric: st => { fl(st).armoury_burned = fl(st).armoury_burned || 'leverage'; return 'Osric\'s men will not move against the hall. He knows what you could tell the Syndicate.'; },
    corisande: st => { fl(st).corisande_withdrawn = day(st); return 'Corisande withdraws.'; },
    thorne: st => { clearBounty(st, 'synod'); return 'Thorne lets a hedge-mage go, and the Synod\'s warrant on you quietly lapses.'; }
  };
  C.useLeverage = function (st, id, how) {
    if (!C.leverageHeld(st, id)) return { ok: false, reason: 'You do not hold that' };
    if (id === 'lev_corisande' && fl(st).sisters_road_done) return { ok: false, reason: 'Her sister is safe. There is nothing left to use.' };
    const who = FIG[id]; let text = '';
    if (how === 'cancel') { const M = mv(st), t = C.MOVES.find(m => m.who === who && !M.fired[m.id] && !M.cancelled[m.id]); if (!t) return { ok: false, reason: 'Nothing of theirs to stop' }; cancel(st, t.id); text = 'You make sure ' + C.LEVERAGE[id].who + ' knows what you know. It does not happen.'; }
    else if (how === 'favour') text = FAVOUR[who](st);
    else return { ok: false, reason: C.mootKnown && !C.mootKnown(st) ? 'There is nothing to pressure them for yet' : 'Pressure is used at the Moot, through canvassing' };
    st.world.leverage[id].spent = how;
    return { ok: true, how, text };
  };
  { const ns0 = C.nodeServices; C.nodeServices = function (st, id) { const sv = ns0.apply(this, arguments); if (sv && sv.shop && fl(st).crane_discount && C.ownerOf(st, id) === 'syndicate') sv.shop.priceMult = Math.round(sv.shop.priceMult * 0.9 * 100) / 100; return sv; }; }

  // ---- the Regency's promise kept ----
  function regencyReward(st, r) {
    const m = C.moot(st); if (!r || r.outcome !== 'regency' || m.declared !== 'regency' || !fl(st).pledged_regency || fl(st).harrow_paid) return r;
    fl(st).harrow_paid = day(st); const cr = S.getRank(st, 'crown');
    if (cr && cr.rank < 4) { while (S.getRank(st, 'crown').rank < 4 && S.promote(st, 'crown', { force: true }).ok); r.office = 'lords_hand'; } else { st.inventory.gold += 300; r.office = 'stipend'; }
    return r;
  }
  { const mr0 = C.mootResolve, mh0 = C.mootHall; C.mootResolve = function (st) { return regencyReward(st, mr0.apply(this, arguments)); }; C.mootHall = function (st) { return regencyReward(st, mh0.apply(this, arguments)); }; }

  // ---- Rookwood Barn: Osric's hidden armoury, a leaf off Aldermere Hold ----
  if (C.NODES.aldermere_hold && !C.NODES.rookwood_barn) {
    const p = C.NODES.aldermere_hold.pos;
    C.NODES.rookwood_barn = { name: 'Rookwood Barn', region: C.NODES.aldermere_hold.region, area: C.NODES.aldermere_hold.area, type: 'poi', pos: [+(p[0] - 0.018).toFixed(3), +(p[1] - 0.022).toFixed(3)], desc: 'A tithe barn with new locks and old walls.', hidden: true, links: { aldermere_hold: 1 }, encounter: 'rookwood_armoury' };
    C.NODES.aldermere_hold.links.rookwood_barn = 1; if (C.EDGES) C.EDGES.push(['aldermere_hold', 'rookwood_barn', 1]);
    C.ENCOUNTERS.rookwood_armoury = { name: 'Rookwood Barn', map: 'tithe_raiders', rec: 6, enemyFaction: 'outlaws', once: true, winFlag: 'armoury_won',
      enemies: [{ primary: 'warrior', name: 'Levy Sergeant' }, { primary: 'archer', name: 'Barn Bowman' }, { primary: 'squire', name: 'Aldermere Levy' }], objective: { type: 'leader', leader: 0 }, reward: { xp: 130, gold: 40 } };
  }

  // ---- arrival: travelling with Brielle draws one Synod patrol; then at most one Move ----
  { const tr0 = C.travel; C.travel = function (st, to) { const r = tr0.apply(this, arguments); if (!r || !r.ok) return r;
      if (fl(st).brielle_with_you && !fl(st).brielle_patrol && !r.wander && to !== 'hearthstone_priory') { fl(st).brielle_patrol = day(st); startFight(st, 'brielle_patrol'); r.wander = st.world.wander; return r; }
      if (!r.wander) r.move = C.checkMoves(st, to); else noteCrossed(st);   // the fight comes first; the beat waits for the next arrival
      return r; }; }

  C.validateCast = function () {
    const p = [], F = window.GAME_DATA.factions;
    C.MOVES.forEach(m => { if (m.at && !C.NODES[m.at]) p.push('move ' + m.id + ': unknown place ' + m.at); if (m.meet && !C.LORE[m.meet]) p.push('move ' + m.id + ': unknown figure line'); if (!m.options.length) p.push('move ' + m.id + ': no options'); });
    Object.values(FAC).forEach(f => { if (!F[f]) p.push('cast: unknown faction ' + f); });
    Object.keys(FIG).forEach(id => { if (!C.LEVERAGE[id]) p.push('leverage ' + id + ': unknown'); });
    Object.values(FIGHTS).forEach(f => f.enemies.forEach(e => { const c = window.GAME_DATA.classes && window.GAME_DATA.classes[e.primary]; if (window.GAME_DATA.classes && (!c || c.selectable === false)) p.push('fight: illegal class ' + e.primary); }));
    return p;
  };
  (window.GAME_CAST_HOOKS || []).forEach(f => f()); window.GAME_CAST_HOOKS = { push: f => f() };   // faction_work.js builds on the cast
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.MOOT) go(); else (window.GAME_INTRIGUE_HOOKS = window.GAME_INTRIGUE_HOOKS || []).push(go);
})();
