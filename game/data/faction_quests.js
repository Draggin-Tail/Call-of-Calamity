/* Early faction story (design/faction_induction_quests.md). Pure rules, no screens. Needs story_world.js.
   For each human faction: a try-out that earns the invitation, an induction at the hall (mentor, oath, token, first orders),
   and four quests between rank 1 and rank 2: what the faction does well, its ideal tested, a side character's own trouble,
   and where it is cracked. The fourth quest leads into the existing rank-2 beat, and rank 2 waits for it.
   Quests are jobs (C.JOBS), so they show in Journal > Quests with map markers. Scenes are Moves; fights use the road-fight slot. */
(function () {
  function go() {
  const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE;
  if (C.FQ) return;
  const fl = st => st.world.flags, day = st => st.world.day, mark = st => Math.max(1, st.world.day);   // a flag set on day 0 must still be truthy
  const rankOf = (st, f) => { const r = S.getRank(st, f); return r ? r.rank : 0; };
  const gw = (st, d, why) => { if (S.changeGoodwill && d) S.changeGoodwill(st, d, why); };
  const lvl = st => { const l = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length))) || 1; };
  const L = (id, f, kind, depth, text) => { C.LORE[id] = { id, faction: f, kind, depth, text }; };
  const learn = (st, ids, src) => [].concat(ids || []).forEach(id => C.learn(st, id, src));
  const serve = (st, f, n, why) => { if (!n) return; if (f === 'hearthwatch') gw(st, n, why); else if (n > 0 && S.serve) S.serve(st, f, n, { reason: why }); else S.changeStanding(st, f, n, { reason: why, ripple: false }); };
  const deed = (st, f, path, w) => C.deed(st, f, path, w || 1, { public: true, tag: 'fq' });
  const give = (st, item) => { st.inventory.items[item] = (st.inventory.items[item] || 0) + 1; };

  // ===== 1. The five factions =====
  // contact: where the try-out is offered; hall: where the induction is held and most orders are given.
  const FQ = C.FQ = {
    crown: { hall: 'crown_keep', contact: 'rivermeet', mentor: 'captain_harte', token: 'keep_badge', need: 100, tryout: 'crown_tryout', quests: ['crown_q1', 'crown_q2', 'crown_q3', 'crown_q4'] },
    syndicate: { hall: 'river_cities', contact: 'canalgate', mentor: 'agent_marsh', token: 'runner_seal', need: 100, tryout: 'synd_tryout', quests: ['synd_q1', 'synd_q2', 'synd_q3', 'synd_q4'] },
    synod: { hall: 'voldun', contact: 'orchard_row', mentor: 'warden_vell', token: 'ward_seal', need: 100, tryout: 'synod_tryout', quests: ['synod_q1', 'synod_q2', 'synod_q3', 'synod_q4'] },
    broken_banner: { hall: 'outlaws_rest', contact: 'outlaws_rest', mentor: 'sergeant_rook', token: 'muster_coin', need: 50, tryout: 'banner_tryout', quests: ['banner_q1', 'banner_q2', 'banner_q3', 'banner_q4'] },
    hearthwatch: { hall: 'hearthstone_priory', contact: 'millstream', mentor: 'brother_teodor', token: 'candle_token', need: 0, tryout: 'hw_tryout', quests: ['hw_q1', 'hw_q2', 'hw_q3', 'hw_q4'], title: 'Hearth-Friend' }
  };
  const HW = 'hearthwatch';
  const member = (st, f) => f === HW ? !!fl(st).hw_sworn : rankOf(st, f) > 0;
  const inducted = (st, f) => !!fl(st)['inducted_' + f];
  const inductDue = (st, f) => f === HW ? (C.jobDone(st, FQ[f].tryout) || !!fl(st).hw_tryout) && !inducted(st, f) : member(st, f) && !!fl(st)['induct_due_' + f] && !inducted(st, f);
  const standing = (st, f) => f === HW ? S.getGoodwill(st) : S.getStanding(st, f);

  // ===== 2. What you learn (ideals for all five, and the Banner's and Hearthwatch's missing strengths and weaknesses) =====
  L('c_ideal_mem', 'crown', 'ideal', 1, 'Sworn Swords say it at drill: "The road stays open, and the law is the same at both ends of it." Most of them have never seen what a lord does with the law once the road is shut.');
  L('y_ideal_mem', 'syndicate', 'ideal', 1, 'Runners say it on the counting floor: "A word given is a debt owed, and a debt paid is a war nobody fights." They believe a ledger is kinder than a lord. Some days it is.');
  L('sy_ideal_mem', 'synod', 'ideal', 1, 'Novices learn it before their letters: "What is written is remembered, and what is remembered cannot hurt you." Most of them have seen a village after a wild spell. They would sign anything to stop another.');
  L('b_ideal', 'broken_banner', 'ideal', 0, 'The Broken Banner say they are what is left of the old king\'s army, and that they never stopped being it.');
  L('b_ideal_mem', 'broken_banner', 'ideal', 1, 'Round the fire they say: "No one left in the field." They were left, at Marrow Ford, and they have not left anyone since. Not a rider, not a village.');
  L('b_ideal_in', 'broken_banner', 'ideal', 2, 'Old Standard\'s officers know the harder truth: the Banner exists to be owed. If the Crown ever paid its debt to them, they would have to decide what they are for.');
  L('b_strength', 'broken_banner', 'strength', 0, 'Two hundred riders who know every back road in the Marches, and villages that hide them because the Banner came when nobody else did.');
  L('b_weak', 'broken_banner', 'weakness', 1, 'They live on what they take. Every winter the line between guarding a village and living off it gets thinner, and some bands have already crossed it.');
  L('hw_ideal', HW, 'ideal', 0, 'The Hearthwatch keep their doors open to anyone, and ask nothing at the threshold.');
  L('hw_ideal_mem', HW, 'ideal', 1, 'Hearth-Friends say: "A door open, a fire lit, no questions at the threshold." Pilgrims, deserters and hedge-mages have slept under the same roof, and none of them was asked a name.');
  L('hw_ideal_in', HW, 'ideal', 2, 'The oldest keepers know a harder rule: a sanctuary is only safe while nobody knows what it hides. They keep more secrets than the Synod keeps records.');
  L('hw_strength', HW, 'strength', 0, 'Chapels in every shire, bread on market days, and a name every side respects. Even the Inquisition knocks before it comes in.');
  L('hw_weak', HW, 'weakness', 1, 'They have no swords. Their safety is a courtesy the great powers extend, and a courtesy can be withdrawn.');
  // the mentors and the people around them
  L('fig_harte', 'crown', 'figure', 0, 'Captain Edwyn Harte, drill-master of Crown Keep. Thirty years a soldier. He believes in the road, the law and the Swords, in that order, and he is losing patience with the lords.');
  L('fig_corley', 'crown', 'figure', 0, 'Wat Corley, a herald\'s apprentice at Herald\'s Cross with a big voice and a borrowed tabard. He reads the Council\'s proclamations to people who no longer listen.');
  L('fig_marsh', 'syndicate', 'figure', 0, 'Agent Hester Marsh of Gildhaven trains the runners. She remembers every rate and every favour, and she has never once raised her voice.');
  L('fig_tobin', 'syndicate', 'figure', 0, 'Tobin Reed, a runner on Mercers\' Row. His father has been in Debtors\' Tower for two years over a debt Tobin swears was paid.');
  L('fig_vell', 'synod', 'figure', 0, 'Warden Cassia Vell keeps the wards of Vol\'Dun. She has buried three villages\' worth of people killed by wild magic, and she still carries chalk in every pocket.');
  L('fig_aldo', 'synod', 'figure', 0, 'Brother Aldo, a novice scribe on Scriptorium Row. Neat hands, a quick mind, and a sister living by the Sunken Cloister he does not talk about.');
  L('fig_rook', 'broken_banner', 'figure', 0, 'Sergeant Mags Rook, the Banner\'s quartermaster. She was at Marrow Ford. She counts every loaf, every arrow and every rider, and she counts them twice in winter.');
  L('fig_kit', 'broken_banner', 'figure', 0, 'Kit Ashby, a young deserter who joined the Banner last spring. Quick with a bow and quicker to laugh, with a mother at Hobb\'s Reach he has not seen since.');
  L('fig_teodor', HW, 'figure', 0, 'Brother Teodor keeps Hearthstone Priory. He was a soldier once and does not say for whom. He opens the door himself, every time.');
  L('fig_nell', HW, 'figure', 0, 'Nell, a foundling raised at the priory, who drives its mule-cart and knows every chapel between the river and the hills. She has never known her mother\'s name.');
  // how others see them, learned through the quests
  L('c_view_farm', 'crown', 'view', 0, 'A Harrow farmer on the Crown: "They took my son for the border levy, then sent a Sword for the grain he wasn\'t here to grow."');
  L('c_view_crowd', 'crown', 'view', 0, 'A market crowd at Pennant Green on the Council\'s proclamations: "Another letter from nobody, about nothing, signed by everyone."');
  L('y_view_tower', 'syndicate', 'view', 0, 'A weaver at Debtors\' Tower on the Syndicate: "They never lie to you. They just write it down so small."');
  L('y_view_floor', 'syndicate', 'view', 0, 'A Stonebridge depositor on the Syndicate: "My coin is safe as long as everyone believes it is. That is not the same as safe."');
  L('sy_view_list', 'synod', 'view', 0, 'A miller at Pilgrim\'s Stair on the Synod: "Once your name is in their book it is never out. My grandfather\'s is still there."');
  L('sy_view_hedge', 'synod', 'view', 0, 'A hedge-witch at Pale Vigil on the Synod: "They are not wrong that it is dangerous. They are wrong that writing it down makes it safe."');
  L('b_view_village', 'broken_banner', 'view', 0, 'A Gullsong fisherman on the Banner: "They came when the raiders did. They come every winter, too."');
  L('hw_view_warrant', HW, 'view', 0, 'A Synod clerk on the Hearthwatch: "They harbour warrants and call it mercy. We let them, because one day we will need the mercy."');

  // ===== 3. Quest fights (road-fight slot; a win sets the step's flag, a loss lets you try again) =====
  const E = (s) => s.split(',').map(x => { const [primary, name] = x.split(':'); return { primary, name }; });
  const FIGHTS = {
    crown_tryout: { name: 'The toll-road thieves', faction: 'outlaws', enemies: E('rogue:Toll Thief,warrior:Toll Thug,archer:Hedge Bowman'), flag: 'crown_tryout_won', text: 'A rope across the road at Kingsway Cross and three men taking "tolls". The sergeant said hold the line. Here is the line.' },
    crown_q1: { name: 'Brigands at Sheepfold', faction: 'outlaws', enemies: E('warrior:Brigand Chief,rogue:Brigand,archer:Brigand Bowman'), objective: { type: 'leader', leader: 0 }, flag: 'crown_q1_won', text: 'The carts are halfway through Sheepfold when the hedge on both sides stands up.' },
    crown_q4: { name: 'Greywatch with ten old men', faction: 'outlaws', enemies: E('berserker:Marcher Raider,warrior:Raider,archer:Raider Bowman,rogue:Raider Scout'), objective: { type: 'survive', turns: 5 }, hard: 1, flag: 'crown_q4_won', text: 'Ten old men from Dunmere, the post\'s own six, and you. The raiders come over the ridge at dusk. Hold until the beacon answers.' },
    synd_q1: { name: 'Wreckers at Silt Wharf', faction: 'outlaws', enemies: E('rogue:Wrecker,warrior:Wrecker Bosun,archer:Wharf Bowman'), objective: { type: 'leader', leader: 1 }, flag: 'synd_q1_won', text: 'A false lantern on the mudflats, and men waiting for the barge to run aground.' },
    synd_q3: { name: 'The clerk\'s collectors', faction: 'syndicate', enemies: E('rogue:Collector,warrior:Hired Fist'), flag: 'synd_q3_won', text: 'The Weighhouse clerk does not argue. He whistles, and two men come in from the yard.' },
    synd_q4: { name: 'The rumour-men', faction: 'outlaws', enemies: E('rogue:Rumour-Monger,marksman:Hired Rifle,warrior:Dock Bruiser'), objective: { type: 'leader', leader: 0 }, hard: 1, flag: 'synd_q4_won', text: 'The men who started the run on Stonebridge are drinking it off in a Low Docks tavern. Somebody paid them very well.' },
    synod_q1: { name: 'Ward-robbers', faction: 'outlaws', enemies: E('rogue:Ward-Robber,warrior:Digger,scout:Lookout'), flag: 'synod_q1_won', text: 'Three men with picks are prising the silver out of the cracked wardstone. The air around it hums.' },
    synod_q4: { name: 'The unlisted', faction: 'outlaws', enemies: E('wizard:Unlisted Mage,apprentice:Hedge Adept,shaman:Fire-Speaker'), objective: { type: 'leader', leader: 0 }, hard: 1, flag: 'synod_q4_won', text: 'At Cinder Gate three mages are working a spell that, according to the Blackstone Archive, does not exist.' },
    banner_tryout: { name: 'The tax wagon', faction: 'crown', enemies: E('warrior:Tax Guard,archer:Wagon Bowman,bulwark:Wagon Shield'), flag: 'banner_tryout_won', text: 'A Crown tax wagon rolls through Ragged Fence with three guards and a strongbox. Mags said bring the Rest something.' },
    banner_q1: { name: 'Nobody else came', faction: 'outlaws', enemies: E('berserker:Raider,warrior:Raider,archer:Raider Bowman'), objective: { type: 'leader', leader: 0 }, flag: 'banner_q1_won', text: 'Smoke over Driftmoor Farm. The Greywatch garrison is half a day away and has not moved.' },
    banner_q3: { name: 'The thief-takers', faction: 'outlaws', enemies: E('rogue:Thief-Taker,tracker:Tracker,warrior:Thief-Taker'), flag: 'banner_q3_won', text: 'Three men step out of the barn at Hobb\'s Reach with a warrant for deserters. One of them knows Kit by name.' },
    banner_q4: { name: 'The Ragged Riders', faction: 'outlaws', enemies: E('warrior:Ragged Captain,berserker:Ragged Rider,archer:Ragged Bowman,rogue:Ragged Rider'), objective: { type: 'leader', leader: 0 }, hard: 1, flag: 'banner_q4_won', text: 'They still wear the faded red. Their captain was at Marrow Ford, the same as Mags.' },
    hw_q1: { name: 'The cart road', faction: 'outlaws', enemies: E('rogue:Cart-Robber,warrior:Cart-Robber,archer:Ditch Bowman'), flag: 'hw_q1_won', text: 'Nell\'s cart, a load of bread, and three men in the road outside the Drowned Chapel who have decided a candle on the cart means nothing.' },
    hw_q4: { name: 'No knock', faction: 'syndicate', enemies: E('warrior:Bailiff,rogue:Collector,marksman:Hired Rifle'), objective: { type: 'leader', leader: 0 }, hard: 1, flag: 'hw_q4_won', text: 'Syndicate bailiffs at the Pilgrim\'s Well chapel. They did not knock.' }
  };
  function startFight(st, key) {
    const F = FIGHTS[key], at = st.world.location, region = C.NODES[at].region, lv = lvl(st);
    const enc = { name: F.name, map: C.mapFor(st, region, at), rec: lv + (F.hard || 0), enemyFaction: F.faction, enemies: F.enemies.map(e => Object.assign({}, e)), objective: F.objective || null, once: false, wander: true, fq: key, reward: { xp: 70 + 14 * lv + (F.hard ? 30 : 0), gold: 15 + 5 * lv } };
    st.world.wander = { kind: 'fight', region, from: at, to: at, day: day(st), enc, text: F.text }; C.ENCOUNTERS.wander = enc; return { fight: F.name, text: F.text, repeat: true };
  }
  { const ae0 = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, opt, res) { const En = C.ENCOUNTERS[encId], out = ae0.apply(this, arguments);
      if (En && En.fq && FIGHTS[En.fq] && res && res.won) fl(st)[FIGHTS[En.fq].flag] = mark(st); return out; }; }

  // ===== 4. Jobs: try-outs and quests =====
  // need(st): extra condition for the offer. learn: lore on report. floor: standing raised to at least this. gw: goodwill. doneFn: report text by choice.
  const J = C.JOBS;
  const step = (text, flag, at) => ({ text, flag, at });
  Object.assign(J, {
    // --- the Crown ---
    crown_tryout: { name: 'Hold the Line', giver: 'crown', at: 'rivermeet', fq: 'crown', tryout: true, need: st => standing(st, 'crown') >= FQ.crown.need,
      offer: 'The Rivermeet sergeant looks you over. "The Keep asks me for names. Before I send yours, show me you can hold a line. Thieves have strung a rope across the road at Kingsway Cross."',
      steps: [step('Clear the toll-road thieves at Kingsway Cross', 'crown_tryout_won', 'kingsway_cross')],
      done: 'He writes your name on a slip and turns it round for you to sign. "You held the line. The Keep wants swords like that. Sign, and you are a Sworn Sword. Then report to Captain Harte at Crown Keep."',
      reward: { gold: 40 }, floor: 250, learn: ['c_ideal', 'c_fig_sergeant'] },
    crown_q1: { name: 'The King\'s Road', giver: 'crown', at: 'crown_keep', fq: 'crown', quest: 1,
      offer: 'Captain Harte: "A grain convoy goes from Wheatvale to Dunmere Keep. Nobody has robbed a Crown convoy on that road in nine years. Keep it that way."',
      steps: [{ text: 'Meet the convoy at Wheatvale', visit: 'wheatvale' }, step('Get the carts through Sheepfold', 'crown_q1_won', 'sheepfold'), { text: 'Bring the carts in at Dunmere Keep', visit: 'dunmere_keep' }],
      done: 'Harte reads the Dunmere receipt twice. "Nine years and a day," he says. "That is the Crown. Not the throne, not the lords. That: a cart that gets where it is going."',
      reward: { gold: 60, standing: { crown: 30 } }, learn: ['c_strength'] },
    crown_q2: { name: 'The Letter of the Law', giver: 'crown', at: 'crown_keep', after: 'crown_q1', fq: 'crown', quest: 2,
      offer: 'Harte hands you a tally-stick. "Harrow Farms owes its levy grain. The law is the same for every farm in the shire, or it is not a law. Collect it."',
      steps: [step('Collect the levy at Harrow Farms', 'crown_q2_done', 'harrow_farms')],
      doneFn: st => ({ take: 'Harte checks the tally. "All of it. Good." He does not ask how the farm looked. You think he knows.', pay: 'Harte checks the tally and then looks at you. "This is your coin, not theirs." A long pause. "The law is satisfied. So, I think, am I."', defer: 'Harte reads your note. "Next season, under your name." He signs under it. "If they cannot pay then, it is your levy. That is what a Sword\'s word costs."' })[fl(st).crown_q2_done_how] || '',
      reward: { gold: 30, standing: { crown: 30 } }, learn: ['c_view_farm'] },
    crown_q3: { name: 'The Proclamation', giver: 'crown', at: 'heralds_cross', after: 'crown_q2', fq: 'crown', quest: 3, side: 'wat_corley',
      offer: 'A young herald in a tabard two sizes too big: "I\'m Wat Corley. I have to read the Council\'s proclamation at Pennant Green, and the last herald who read one there came back with an egg in his ear. Captain Harte said you might walk with me."',
      steps: [step('Stand with Wat at Pennant Green', 'crown_q3_done', 'pennant_green')],
      done: 'Back at Herald\'s Cross, Wat takes off the tabard and folds it with great care. "My father read the old king\'s proclamations," he says. "People used to cheer. I would like to read one they cheer for."',
      reward: { gold: 35, standing: { crown: 25 } }, learn: ['fig_corley', 'c_view_crowd'] },
    crown_q4: { name: 'Two Hundred Spears', giver: 'crown', at: 'crown_keep', after: 'crown_q3', fq: 'crown', quest: 4,
      offer: 'Harte has a map spread on a barrel. "Raiders massing past Greywatch Post. The Keep has asked Dunmere for a hundred spears. Go and bring them, and hold Greywatch until they come."',
      steps: [step('Ask Dunmere Keep for its spears', 'crown_q4_ask', 'dunmere_keep'), step('Hold Greywatch Post', 'crown_q4_won', 'greywatch_post')],
      done: '"Ten men," Harte says. "From a lord who owes the Crown his castle." He looks up at the empty gallery. "The Lord Marshal wants to see the Swords who came back from Greywatch. Do not keep him waiting." When the Keep thinks you are ready, it will make you a Knight.',
      reward: { gold: 80, standing: { crown: 45 } }, learn: ['c_weak'] },

    // --- the Syndicate ---
    synd_tryout: { name: 'A Fair Collection', giver: 'syndicate', at: 'canalgate', fq: 'syndicate', tryout: true, need: st => standing(st, 'syndicate') >= FQ.syndicate.need,
      offer: 'A counting-house clerk slides a slip across the table. "A chandler at the Low Docks owes us sixty. Collect it. How you do it is the interview."',
      steps: [step('Settle the chandler\'s debt at the Low Docks', 'synd_tryout_done', 'low_docks')],
      done: 'The clerk files your slip without reading it, then slides a fresh one across. "Gildhaven has room for a runner. Sign, and ask for Agent Marsh on the counting floor."',
      reward: { gold: 40 }, floor: 250, learn: ['y_ideal', 'y_fig_factor'] },
    synd_q1: { name: 'Grain on the Water', giver: 'syndicate', at: 'river_cities', fq: 'syndicate', quest: 1,
      offer: 'Agent Marsh: "A barge of grain leaves Silt Wharf tonight. Buy its papers at the Grain Exchange, then see it off the wharf. There are people on the mudflats who would like it to run aground."',
      steps: [{ text: 'Buy the barge\'s papers at the Grain Exchange', visit: 'grain_exchange' }, step('See the barge safely off Silt Wharf', 'synd_q1_won', 'silt_wharf')],
      done: 'Marsh shows you a pigeon-letter: Wheatvale\'s harvest failed. "The Crown will hear in nine days. We heard in two, and the grain is already on the water." It will sell at three times the price, and nobody in Wheatvale will starve.',
      reward: { gold: 70, standing: { syndicate: 30 } }, learn: ['y_strength'] },
    synd_q2: { name: 'The Weaver\'s Contract', giver: 'syndicate', at: 'river_cities', after: 'synd_q1', fq: 'syndicate', quest: 2,
      offer: 'Marsh hands you a contract. "A weaver at Debtors\' Tower is three months behind. The contract says her daughter\'s indenture covers it. Enforce the contract. Contracts are why people trust us."',
      steps: [step('Settle the weaver\'s contract at Debtors\' Tower', 'synd_q2_done', 'debtors_tower')],
      doneFn: st => ({ enforce: 'Marsh files the indenture. "Clean." She does not look at you while she says it.', buy: 'Marsh reads the receipt. "You paid it yourself." She writes something in the margin. "Generous. Do not make a habit of it in front of the Factors."', rewrite: 'Marsh reads your new terms twice and almost smiles. "Longer, smaller payments, and the indenture struck. She pays more in the end and thanks us for it." She files it. "That is the job."' })[fl(st).synd_q2_done_how] || '',
      reward: { gold: 40, standing: { syndicate: 30 } }, learn: ['y_view_tower'] },
    synd_q3: { name: 'Paid Twice', giver: 'syndicate', at: 'mercers_row', after: 'synd_q2', fq: 'syndicate', quest: 3, side: 'tobin_reed',
      offer: 'A runner your age catches your sleeve. "Tobin Reed. My father is in Debtors\' Tower for a debt he paid. I saw him pay it. The receipt will be in the Weighhouse books. Agent Marsh says you can read a ledger."',
      steps: [step('Find the receipt at the Weighhouse', 'synd_q3_page', 'weighhouse')],
      doneFn: st => fl(st).synd_q3_page_how === 'cut' ? 'Tobin takes the receipt and counts the coin you hand him. It is less than it should be. He does not know that. You do.' : 'Tobin holds the receipt in both hands. "They will have to let him out. The book says so." For the first time you see a runner believe in the books.',
      reward: { gold: 35, standing: { syndicate: 25 } }, learn: ['fig_tobin'] },
    synd_q4: { name: 'A Run on Stonebridge', giver: 'syndicate', at: 'river_cities', after: 'synd_q3', fq: 'syndicate', quest: 4,
      offer: 'Marsh, for the first time, is in a hurry. "Someone says the Stonebridge counting-house is empty. It is not. But if enough people believe it, it will be by tonight. Stop the run, then find out who started it."',
      steps: [step('Calm the crowd at Stonebridge', 'synd_q4_calm', 'stonebridge'), step('Find the rumour-men at the Low Docks', 'synd_q4_won', 'low_docks')],
      done: 'Marsh turns a gold coin over in her fingers. "One rumour, and a counting-house nearly fell. That is all we are, runner: paper, and people who believe in it." She puts the coin away. "Factor Crane has asked for you by name." When Gildhaven thinks you are ready, it will make you an Agent.',
      reward: { gold: 90, standing: { syndicate: 45 } }, learn: ['y_weak'] },

    // --- the Synod ---
    synod_tryout: { name: 'A Name for the Clerk', giver: 'synod', at: 'orchard_row', fq: 'synod', tryout: true, need: st => standing(st, 'synod') >= FQ.synod.need,
      offer: 'The Orchard Row clerk dips his pen. "An old woman at Pale Vigil charms warts. Charming is casting. Go and get her name, so it can be written down. That is all the Synod asks, mostly."',
      steps: [step('Find the wart-charmer at Pale Vigil', 'synod_tryout_done', 'pale_vigil')],
      done: 'The clerk writes for a long time, then turns the book to you. "Vol\'Dun will take you as a novice. Sign, and ask for Warden Vell at the Ward-Hall."',
      reward: { gold: 35 }, floor: 250, learn: ['sy_ideal', 'sy_fig_clerk'] },
    synod_q1: { name: 'The Cracked Ward', giver: 'synod', at: 'voldun', fq: 'synod', quest: 1,
      offer: 'Warden Vell fills your hands with chalk. "The wardstone at Wardstone Green has cracked. Fetch blessed ward-chalk from Sunwheel Chapel and help me close it before something gets through. Or someone gets in."',
      steps: [{ text: 'Fetch ward-chalk from Sunwheel Chapel', visit: 'sunwheel_chapel' }, step('Drive off whoever is at the wardstone', 'synod_q1_won', 'wardstone_green')],
      done: 'Vell chalks the last line and the stone stops humming. "Forty families sleep inside that ward tonight," she says. "None of them will ever know it was cracked. That is the work."',
      reward: { gold: 60, standing: { synod: 30 } }, learn: ['sy_strength'] },
    synod_q2: { name: 'Confirmed', giver: 'synod', at: 'voldun', after: 'synod_q1', fq: 'synod', quest: 2,
      offer: 'Vell gives you a folded confession. "A farmer swears his neighbour, the miller at Pilgrim\'s Stair, lit a lamp without flint. The Inquisitors want the name confirmed. Go and look. Tell me what you find, and I will write what you tell me."',
      steps: [step('Look into the miller at Pilgrim\'s Stair', 'synod_q2_done', 'pilgrims_stair')],
      doneFn: st => ({ confirm: 'Vell writes the miller\'s name in the book. "He will be visited and registered. Most are never troubled again." She blots the ink. "Most."', clear: 'Vell writes "nothing found" and looks at you a moment longer than she needs to. "I wrote what you told me," she says.', bring: 'The miller is brought in by your hand. Vell writes his name, and then yours beside it, as the one who brought him. "Inquisitor Thorne will like you," she says. It does not sound like praise.' })[fl(st).synod_q2_done_how] || '',
      reward: { gold: 40, standing: { synod: 30 } }, learn: ['sy_view_list'] },
    synod_q3: { name: 'A Letter to the Cloister', giver: 'synod', at: 'scriptorium_row', after: 'synod_q2', fq: 'synod', quest: 3, side: 'brother_aldo',
      offer: 'A young scribe closes the door behind you. "Brother Aldo. My sister Ria lives in the old cottages by the Sunken Cloister. Her name has gone on a list. I copied the list." He holds out a sealed letter. "I cannot be seen there. Will you take this to her?"',
      steps: [step('Find Ria by the Sunken Cloister', 'synod_q3_done', 'sunken_cloister')],
      doneFn: st => ({ warn: 'Aldo burns the reply after reading it. "She is gone. Safe." He goes back to his copying, and his hands are steady again.', register: 'Aldo reads that his sister will come to Vol\'Dun and be registered. "Then she is safe too," he says, "in the way we mean it here." He does not sound sure.', report: 'Aldo is not at his desk the next morning. A new novice is copying the list.' })[fl(st).synod_q3_done_how] || '',
      reward: { gold: 35, standing: { synod: 25 } }, learn: ['fig_aldo', 'sy_view_hedge'] },
    synod_q4: { name: 'The Unwritten Spell', giver: 'synod', at: 'voldun', after: 'synod_q3', fq: 'synod', quest: 4,
      offer: 'Vell holds up a scorched brick. "Fire that burns stone. Ask the Blackstone Archive what spell does this. Then go to Cinder Gate, where it keeps happening."',
      steps: [step('Ask the Blackstone Archive', 'synod_q4_ask', 'blackstone_archive'), step('Stop the mages at Cinder Gate', 'synod_q4_won', 'cinder_gate')],
      done: 'Vell turns the brick over. "Nineteen years that spell has been in the world, and not one line of it in our books. We cannot see what we have not written down." Inquisitor-Captain Thorne arrives after it is all over, names each of the fallen, and writes them down. When Vol\'Dun thinks you are ready, it will make you a Warden.',
      reward: { gold: 90, standing: { synod: 45 } }, learn: ['sy_weak'] },

    // --- the Broken Banner ---
    banner_tryout: { name: 'Bring the Rest Something', giver: 'broken_banner', at: 'outlaws_rest', fq: 'broken_banner', tryout: true, need: st => (!!fl(st).banner_contact || S.isMet(st, 'broken_banner')) && standing(st, 'broken_banner') >= FQ.broken_banner.need,
      offer: 'A grey-haired woman with a ledger on her knee does not get up. "Sergeant Rook. Everyone who wants to ride with us brings the Rest something first. A Crown tax wagon goes through Ragged Fence this week. Bring us what is in it."',
      steps: [step('Take the tax wagon at Ragged Fence', 'banner_tryout_won', 'ragged_fence')],
      done: 'Rook counts the strongbox twice, then writes your name in her ledger in pencil. "Pencil, for now. Say the word and it goes in ink."',
      reward: { gold: 50 }, floor: 250, learn: ['b_ideal', 'fig_rook'] },
    banner_q1: { name: 'Nobody Else Came', giver: 'broken_banner', at: 'outlaws_rest', fq: 'broken_banner', quest: 1,
      offer: 'Rook: "Raiders at Driftmoor Farm. Greywatch has a garrison half a day away and orders not to move. We have no orders. Go."',
      steps: [step('Drive the raiders off Driftmoor Farm', 'banner_q1_won', 'driftmoor_farm')],
      done: 'The Driftmoor folk send back a cart of turnips and a cured ham, and a boy who wants to ride with you. Rook sends the boy home and keeps the ham. "That is why they hide us," she says. "Because we came."',
      reward: { gold: 50, standing: { broken_banner: 30 } }, learn: ['b_strength'] },
    banner_q2: { name: 'The Winter Share', giver: 'broken_banner', at: 'outlaws_rest', after: 'banner_q1', fq: 'broken_banner', quest: 2,
      offer: 'Rook runs a finger down a column. "Gullsong owes its winter share. We kept the raiders off them all summer. Collect it. We have two hundred mouths and no farms."',
      steps: [step('Collect the winter share at Gullsong', 'banner_q2_done', 'gullsong')],
      doneFn: st => ({ full: 'Rook weighs the sacks. "All of it." She writes it in. "They will hate us a little more this winter, and we will eat."', half: 'Rook weighs the sacks. "Half." She looks at you. "Half is what I would have taken. Do not tell Old Standard I said so."', none: 'Rook looks at your empty hands for a long time. "Then we go hungry and they do not." She writes a zero in the column. "No one left in the field. I suppose that means them too."' })[fl(st).banner_q2_done_how] || '',
      reward: { gold: 30, standing: { broken_banner: 30 } }, learn: ['b_view_village'] },
    banner_q3: { name: 'Kit Goes Home', giver: 'broken_banner', at: 'outlaws_rest', after: 'banner_q2', fq: 'broken_banner', quest: 3, side: 'kit_ashby',
      offer: 'A young rider with a bow over his shoulder: "Kit Ashby. My mother is at Hobb\'s Reach and I have not seen her since I ran. There is a price on deserters there. Ride with me? I will not be long. I just want her to see I am alive."',
      steps: [step('Get Kit home to Hobb\'s Reach and back', 'banner_q3_won', 'hobbs_reach')],
      done: 'Kit rides back quieter than he went. "She cried," he says, "and then she fed me, and then she told me to go before they came back." He touches the coin on his belt. "No one left in the field. I always thought that meant us."',
      reward: { gold: 40, standing: { broken_banner: 25 } }, learn: ['fig_kit'] },
    banner_q4: { name: 'The Ragged Riders', giver: 'broken_banner', at: 'outlaws_rest', after: 'banner_q3', fq: 'broken_banner', quest: 4,
      offer: 'Rook does not open her ledger. "A band that used to ride with us has gone bad. The Ragged Riders. Last winter they ate what the villages had. This winter they are eating the villages. Old Standard says bring them home or break them. They camp at Widow\'s Barrow."',
      steps: [step('Face the Ragged Riders at Widow\'s Barrow', 'banner_q4_won', 'widows_barrow')],
      done: 'Rook writes the Ragged Riders out of her ledger, one name at a time, in ink. "They were ours," she says. "It is a short road from guarding a village to living off it. Shorter in winter." Old Standard wants to see you at the fire. When the Banner thinks you are ready, it will make you a Rider.',
      reward: { gold: 80, standing: { broken_banner: 45 } }, learn: ['b_weak', 'b_ideal_in'] },

    // --- the Hearthwatch ---
    hw_tryout: { name: 'A Market Day', giver: HW, at: 'millstream', fq: HW, tryout: true, need: st => !fl(st).hw_sworn,
      offer: 'The Millstream chapel warden hands you a basket. "We do not swear anyone in for asking. Carry the bread with us for a market day. Applecourt\'s sick-house first, then whoever needs it at Sheepfold."',
      steps: [{ text: 'Take bread to the sick-house at Applecourt', visit: 'applecourt' }, step('Carry the rest to Sheepfold', 'hw_tryout_done', 'sheepfold')],
      done: 'The warden takes the empty basket and nods. "Brother Teodor will want to meet you. Hearthstone Priory, on the river road. He opens the door himself."',
      reward: { gold: 20 }, gw: 8, learn: ['hw_ideal'] },
    hw_q1: { name: 'Bread on the Road', giver: HW, at: 'hearthstone_priory', fq: HW, quest: 1,
      offer: 'Brother Teodor: "Nell takes the cart to the Drowned Chapel every tenth day. Nobody robs a Hearthwatch cart. Lately, somebody has started. Ride with her."',
      steps: [step('Ride with Nell to the Drowned Chapel', 'hw_q1_won', 'drowned_chapel')],
      done: 'Nell unloads the bread at the Drowned Chapel herself. "At the Syndicate toll they waved us through," she says. "At the Crown bridge too. Everyone lets the candle pass. Nearly everyone." Teodor nods when he hears. "Nearly is new."',
      reward: { gold: 40 }, gw: 6, learn: ['hw_strength', 'fig_nell'] },
    hw_q2: { name: 'No Questions', giver: HW, at: 'hearthstone_priory', after: 'hw_q1', fq: HW, quest: 2,
      offer: 'Teodor: "A man came into the Millstream chapel last night with a cut arm and a Synod warrant. The warden sent for help. I am sending you."',
      steps: [step('Go to the Millstream chapel', 'hw_q2_done', 'millstream')],
      doneFn: st => ({ hide: 'Teodor listens and nods. "No questions at the threshold." He lights a candle in the window. "The Synod will be cross. They are always cross."', door: 'Teodor listens. "You let them search, and said nothing." He is quiet for a while. "That is within the rule. Only just."', name: 'Teodor listens and does not answer. After a long time he says, "The door was open, and you held it for the wrong people." He does not light the candle.' })[fl(st).hw_q2_done_how] || '',
      reward: { gold: 25 }, gw: 0, learn: ['hw_view_warrant'] },
    hw_q3: { name: 'Nell\'s Name', giver: HW, at: 'hearthstone_priory', after: 'hw_q2', fq: HW, quest: 3, side: 'nell',
      offer: 'Nell, without looking up from the mule\'s hoof: "I was left at Whitestone Abbey the winter I was born. Mother Agathe keeps a register. She will not let me read it. She might let you."',
      steps: [step('Read the register at Whitestone Abbey', 'hw_q3_done', 'whitestone_abbey')],
      doneFn: st => ({ tell: 'Nell reads what you copied: "Taken in. Mother a hedge-woman, hidden from the Synod, gone in the spring. Name withheld for her safety." She reads it again. "She was hiding," she says. "So am I, I suppose."', spare: 'You tell Nell the page said nothing. She shrugs, too quickly. "Then I am the priory\'s," she says. "That is not so bad."', sell: 'You tell Nell nothing. A Synod clerk at Orchard Row pays well for what you tell him instead.' })[fl(st).hw_q3_done_how] || '',
      reward: { gold: 30 }, gw: 6, learn: [] },
    hw_q4: { name: 'A Courtesy Withdrawn', giver: HW, at: 'hearthstone_priory', after: 'hw_q3', fq: HW, quest: 4,
      offer: 'Teodor\'s hands are shaking, which you have never seen. "Syndicate bailiffs walked into the Pilgrim\'s Well chapel this morning for a debtor. They did not knock. If they do it once, everyone does it."',
      steps: [step('Put the bailiffs out of the Pilgrim\'s Well chapel', 'hw_q4_won', 'pilgrims_well')],
      done: '"They knocked, every time, for a hundred years," Teodor says. "Not because we could stop them. Because they might need us." He shuts the priory door, gently. "A courtesy can be withdrawn. Remember that we have only courtesy." Mother Agathe will want people who have seen this.',
      reward: { gold: 70 }, gw: 8, learn: ['hw_weak', 'hw_ideal_in'] }
  });
  const FQJOBS = Object.keys(J).filter(id => J[id].fq);
  const qDone = (st, f) => C.jobDone(st, FQ[f].quests[3]);

  // offers honour need(); a quest from a side character only once you are in
  { const jo0 = C.jobOffers; C.jobOffers = function (st, at) { return jo0.apply(this, arguments).filter(j => !j.fq || (j.tryout ? !member(st, j.fq) && (!j.need || j.need(st)) : member(st, j.fq) && inducted(st, j.fq) && j.quest > 1)); }; }
  { const aj0 = C.acceptJob; C.acceptJob = function (st, id) { const j = C.JOBS[id];
      if (j && j.fq && !C.jobOffers(st, st.world.location).some(o => o.id === id)) return { ok: false, reason: 'Not available' };
      const r = aj0.apply(this, arguments); if (r && r.ok && j && j.fq) { reveal(st, id); C.checkMoves(st); } return r; }; }
  function reveal(st, id) { (C.JOBS[id].steps || []).forEach(x => { const to = x.visit || x.at; if (to && C.NODES[to] && C.discoverRoute) C.discoverRoute(st, st.world.location, to); }); }
  function activate(st, id) { if (C.jobsOf(st)[id]) return; C.jobsOf(st)[id] = { state: 'active', day: day(st), seen: {} }; reveal(st, id); }
  { const rj0 = C.reportJob; C.reportJob = function (st, id) { const j = C.JOBS[id]; const r = rj0.apply(this, arguments); if (!r || !r.ok || !j || !j.fq) return r;
      const f = j.fq; learn(st, j.learn, j.name);
      if (j.gw) gw(st, j.gw, 'Job: ' + j.name.slice(0, 18));
      if (j.doneFn) { const t = j.doneFn(st); if (t) r.text = t; }
      const nx = FQ[f].quests[FQ[f].quests.indexOf(id) + 1]; if (nx && C.discoverRoute) C.discoverRoute(st, st.world.location, J[nx].at);   // the next giver is on the map
      if (j.tryout) { fl(st)['tryout_' + f] = mark(st); if (f === HW) fl(st).hw_tryout = mark(st);
        if (j.floor && f !== HW && S.getStanding(st, f) < j.floor) r.changes = (r.changes || []).concat(S.changeStanding(st, f, j.floor - S.getStanding(st, f), { reason: 'passed their try-out', ripple: false }));
        if (C.discoverRoute) C.discoverRoute(st, st.world.location, FQ[f].hall); }
      return r; }; }

  // ===== 5. The try-out gates the invitation; rank 2 waits for the fourth quest =====
  const gated = (st, f) => f !== HW && FQ[f] && rankOf(st, f) === 1 && (inducted(st, f) || !!fl(st)['induct_due_' + f]) && !qDone(st, f);
  { const cj0 = S.canJoin; S.canJoin = function (st, f, opts) { const r = cj0.apply(this, arguments); opts = opts || {};
      if ((r.ok || r.leaves) && FQ[f] && !opts.force && !opts.outcast && !fl(st)['tryout_' + f]) return { ok: false, tryout: true, reason: 'They want to see your work first: ' + J[FQ[f].tryout].name };
      return r; }; }
  { const pr0 = S.promote; S.promote = function (st, f, opts) { if (!(opts && opts.force) && gated(st, f)) return { ok: false, reason: 'Finish your first orders first' }; return pr0.apply(this, arguments); }; }
  { const iv0 = S.invitations; S.invitations = function (st) { return iv0.apply(this, arguments).filter(o => !(o.kind === 'promote' && gated(st, o.faction))); }; }
  { const jr0 = S.joinRank; S.joinRank = function (st, f, opts) { const r = jr0.apply(this, arguments);
      if (r && r.ok && FQ[f] && !inducted(st, f)) { fl(st)['induct_due_' + f] = mark(st); if (C.discoverRoute) C.discoverRoute(st, st.world.location, FQ[f].hall); if (st.world.location === FQ[f].hall && C.checkMoves) C.checkMoves(st); }
      return r; }; }
  // older saves: a rank 1 taken before inductions existed gets its induction at the next hall visit
  { const ls0 = S.loadSlot; S.loadSlot = function () { const r = ls0.apply(this, arguments);
      if (r && r.ok && r.state && r.state.factions && r.state.world) { const st = r.state; st.world.flags = st.world.flags || {};
        Object.keys(st.factions.ranks || {}).forEach(f => { const k = st.factions.ranks[f]; if (FQ[f] && k && k.rank === 1 && !st.world.flags['inducted_' + f] && !st.world.flags['induct_due_' + f]) { st.world.flags['induct_due_' + f] = Math.max(1, st.world.day); st.world.flags['tryout_' + f] = st.world.flags['tryout_' + f] || Math.max(1, st.world.day); } }); }
      return r; }; }

  // how deep you can see: the Hearthwatch have no ranks, so being taken in counts as rank 1; seeing the crack (quest 4) shows the Banner's and
  // the Hearthwatch's inner ideal, which nothing else in the story teaches
  { const dp0 = C.depthOf; C.depthOf = function (st, f) { let d = dp0.apply(this, arguments);
      if (f === HW) { const t = S.goodwillTier ? S.goodwillTier(st).id : 'wary'; if (fl(st).hw_sworn || t !== 'wary') d = Math.max(d, 1); if (t === 'trusted') d = Math.max(d, 2); }
      if ((f === HW || f === 'broken_banner') && C.jobDone(st, FQ[f].quests[3])) d = Math.max(d, 2);
      return d; }; }
  // what to tell the player on the Factions tab
  C.tryoutHint = function (st, f) {
    const F = FQ[f]; if (!F || member(st, f) || (S.isMet && !S.isMet(st, f))) return null; const id = F.tryout, j = J[id];
    if (fl(st)['tryout_' + f]) return null;
    if (C.jobActive(st, id)) return 'Your try-out: ' + j.name + '. Finish it, then report at ' + C.NODES[j.at].name + '.';
    if (standing(st, f) < F.need) return null;
    return 'They have noticed you. Someone at ' + C.NODES[j.at].name + ' has a try-out for you: ' + j.name + '.';
  };
  C.rankHint = function (st, f) {
    const F = FQ[f]; if (!F || !member(st, f)) return null;
    if (inductDue(st, f)) return 'Go to ' + C.NODES[F.hall].name + ' for your induction.';
    if (f !== HW && !gated(st, f)) return null;
    const next = F.quests.find(id => !C.jobDone(st, id)); if (!next) return null; const j = J[next];
    return (f === HW ? 'Brother Teodor has work for you: ' : 'Before your next rank: ') + j.name + (C.jobActive(st, next) ? (C.jobReady(st, next) ? ' (report back at ' + C.NODES[j.at].name + ')' : '') : ' (ask at ' + C.NODES[j.at].name + ')') + '.';
  };
  C.hearthTitle = st => fl(st).hw_sworn ? FQ.hearthwatch.title : null;

  // ===== 5b. Offers are made in person =====
  // A rank is offered by someone at a place, never by a menu: joining at the place where you reported your try-out (the contact),
  // a promotion at the faction's hall. The offer waits there until you answer it.
  const place = id => (C.NODES[id] ? C.NODES[id].name : id);
  C.offerPlace = function (st, o) { const F = FQ[o.faction]; if (!F) return null; if (o.kind === 'join') return J[F.tryout].at; return F.hall; };
  C.OFFER_WHO = { crown: ['the sergeant', 'Captain Harte'], syndicate: ['the clerk', 'Agent Marsh'], synod: ['the clerk', 'Warden Vell'], broken_banner: ['Sergeant Rook', 'Sergeant Rook'] };
  C.offers = st => (S.invitations(st) || []).filter(o => FQ[o.faction]).map(o => Object.assign({ at: C.offerPlace(st, o), who: (C.OFFER_WHO[o.faction] || [])[o.kind === 'join' ? 0 : 1] || null }, o));
  C.offersHere = (st, at) => C.offers(st).filter(o => o.at === (at || st.world.location));
  C.acceptOffer = function (st, f) {
    const o = C.offers(st).find(x => x.faction === f); if (!o) return { ok: false, reason: 'Nothing is on offer' };
    if (o.at !== st.world.location) return { ok: false, reason: 'Give your answer in person, at ' + place(o.at) };
    const r = o.kind === 'join' ? S.joinRank(st, f, { leave: true }) : S.promote(st, f);   // taking a place elsewhere means leaving your faction
    return r && r.ok ? Object.assign({ kind: o.kind, title: o.title }, r) : r;
  };
  // What each faction wants from you next, for the Journal and the Factions tab. Quests you have taken are listed as quests, not here.
  C.factionNext = function (st) {
    const out = [];
    C.offers(st).forEach(o => out.push({ faction: o.faction, kind: 'offer', at: o.at, title: o.title, leaves: o.leaves || null,
      text: (o.kind === 'join' ? 'They offer you a place: ' : 'They offer you a promotion: ') + o.title + (o.leaves ? ' (you would leave the ' + ((window.GAME_DATA.factions[o.leaves] || {}).name || o.leaves) + ')' : '') + '. Answer in person at ' + place(o.at) + '.' }));
    Object.keys(FQ).forEach(f => {
      if (out.some(x => x.faction === f)) return; const F = FQ[f], j = J[F.tryout];
      if (inductDue(st, f)) { out.push({ faction: f, kind: 'induct', at: F.hall, text: 'Your induction is waiting at ' + place(F.hall) + '.' }); return; }
      if (!member(st, f)) {
        if (fl(st)['tryout_' + f] || C.jobActive(st, F.tryout) || C.jobDone(st, F.tryout)) return;
        if (f !== HW && S.isMet && !S.isMet(st, f)) return;
        if (standing(st, f) >= F.need && (!j.need || j.need(st))) out.push({ faction: f, kind: 'tryout', at: j.at, text: 'They have noticed you. Ask at ' + place(j.at) + ' about a try-out: ' + j.name + '.' });
        return; }
      if (f === HW || gated(st, f)) return;
      const r = S.getRank(st, f); if (!r || r.rank >= 4 || r.dormant) return; const need = S.RANK.standingNeeded[r.rank], have = S.getStanding(st, f);
      if (have < need) out.push({ faction: f, kind: 'progress', at: null, text: 'Next rank, ' + S.RANK.ladders[f][r.rank] + ', at ' + need + ' standing (you have ' + have + '). Their contract boards and scenes raise it.' });
    });
    return out;
  };

  // ===== 6. The scenes =====
  const O = (id, label, go, cond) => ({ id, label, go, if: cond });
  const scene = (id, who, at, trip, setup, lines, options, meet) => ({ id, who, at, trip, setup, lines, options, meet });
  const jobOn = (id, flag) => st => C.jobActive(st, id) && !fl(st)[flag];
  const done = (flag, how) => st => { fl(st)[flag] = mark(st); if (how) fl(st)[flag + '_how'] = how; };
  const fightOpts = (key, label) => [Object.assign(O('fight', label, st => startFight(st, key)), { hint: 'A fight. Lose, and you can come back and try again.' }), Object.assign(O('later', 'Not yet', () => ({ repeat: true, text: 'It will still be here when you come back.' })), { hint: 'Walk away for now. It waits for you here.' })];
  const choice = (job, flag, f, list) => list.map(([id, label, path, w, extra, text, cond]) => O(id, label, st => { done(flag, id)(st); if (path) deed(st, f, path, w); const t = extra ? extra(st) : null; return { text: t || text }; }, cond));

  // inductions
  function induct(f, oathLeanText) {
    return st => { const F = FQ[f]; fl(st)['inducted_' + f] = mark(st); delete fl(st)['induct_due_' + f]; if (f === HW) fl(st).hw_sworn = mark(st);
      give(st, F.token); learn(st, [f === 'crown' ? 'c_ideal_mem' : f === 'syndicate' ? 'y_ideal_mem' : f === 'synod' ? 'sy_ideal_mem' : f === 'broken_banner' ? 'b_ideal_mem' : 'hw_ideal_mem'], 'Your induction');
      if (f === HW) gw(st, 10, 'taken in as a Hearth-Friend'); else S.changeStanding(st, f, 10, { reason: 'your induction', ripple: false });
      activate(st, F.quests[0]); return { text: oathLeanText, item: F.token, orders: J[F.quests[0]].name }; };
  }
  const oath = (f, list) => list.map(([id, label, path, reply]) => O(id, label, st => { deed(st, f, path, 2); fl(st)['oath_' + f] = id; const r = induct(f, reply)(st); r.text = reply + ' ' + TOKEN_LINE[f]; return r; }));
  const TOKEN_LINE = {
    crown: 'He pins an iron badge to your coat. "Sworn Sword. Your first orders are on my table: the King\'s Road."',
    syndicate: 'She presses a brass seal into your palm. "Runner. Your first job is already in your name: Grain on the Water."',
    synod: 'She presses a wax ward-seal into your hand while it is still warm. "Novice. Your first task is chalk and a cracked stone. Come and find me."',
    broken_banner: 'She drops an old army coin into your hand, the king\'s face worn smooth. "You ride with us now. And riders ride: Driftmoor Farm is burning."',
    hearthwatch: 'He gives you a stub of candle. "Hearth-Friend. Nell is taking the cart out. Go with her."'
  };
  const INDUCT = [
    scene('fq_induct_crown', 'captain_harte', 'crown_keep', st => inductDue(st, 'crown'),
      'The drill yard of Crown Keep at dawn. Twelve new Sworn Swords in a line, and you at the end of it. A captain with a grey moustache walks the line and stops in front of you.',
      ['Captain Edwyn Harte: "Say it after me. The road stays open."', '"And the law is the same at both ends of it."', 'High in the gallery, Lord Marshal Voss watches with his arms folded. He leaves before the oath is finished.', '"Now the last line. Every Sword says it their own way, and I listen to how."'],
      oath('crown', [['people', '"I keep the peace for the people on the road."', 'light', '"Good," Harte says. "Remember them when a lord tells you to forget them."'],
        ['peace', '"I keep the peace. That is all."', 'gray', '"That is the job," Harte says. "Some days it is enough."'],
        ['cost', '"I keep the peace, whatever it costs whoever is in the way."', 'dark', 'Harte pauses. "The Crown has plenty of those," he says. "Try to be more."']]), 'fig_harte'),
    scene('fq_induct_syndicate', 'agent_marsh', 'river_cities', st => inductDue(st, 'syndicate'),
      'The counting floor of Gildhaven: a hundred clerks, a hundred pens, one sound like rain. A woman in a plain grey coat opens a ledger at a fresh page and writes your name at the top.',
      ['Agent Hester Marsh: "Runners learn one line. A word given is a debt owed."', '"And a debt paid is a war nobody fights."', 'Behind her, Factor Crane signs something without looking up, and is gone before the ink is dry.', '"Now tell me what you will do with it. I write down the answer. I always do."'],
      oath('syndicate', [['person', '"And nobody is worth less than what they owe."', 'light', 'Marsh writes it down. "Unusual," she says. "Not wrong."'],
        ['books', '"I will keep my word and my books."', 'gray', 'Marsh writes it down. "That is the whole of the job, most days."'],
        ['pays', '"And everybody pays."', 'dark', 'Marsh writes it down without looking up. "They do," she says. "Eventually."']]), 'fig_marsh'),
    scene('fq_induct_synod', 'warden_vell', 'voldun', st => inductDue(st, 'synod'),
      'The Ward-Hall of Vol\'Dun. A ring of grey stones, and in the middle one that glows faintly when a novice lays a hand on it. A warden with chalk on her sleeves nods you forward.',
      ['Warden Cassia Vell: "Put your hand on the stone. Now say it. What is written is remembered."', '"And what is remembered cannot hurt you."', 'Archon Ilvane passes along the gallery, glances down at the glowing stone, and says to no one in particular: "Looks like rain."', '"Every novice tells the stone what they will do with what they learn. It does not listen. I do."'],
      oath('synod', [['protect', '"I will keep people safe from it."', 'light', '"Good," Vell says. "Keep that. The book will try to take it off you."'],
        ['record', '"I will keep it written down."', 'gray', '"That is the vow," Vell says. "It is harder than it sounds."'],
        ['hold', '"I will keep it out of the wrong hands. Whoever\'s they are."', 'dark', 'Vell looks at you for a moment. "The Inner Circle would like you," she says. She does not say it kindly.']]), 'fig_vell'),
    scene('fq_induct_broken_banner', 'sergeant_rook', 'outlaws_rest', st => inductDue(st, 'broken_banner'),
      'Night at Outlaw\'s Rest. Two hundred riders round one fire, and Captain Old Standard on a stump, telling the story of Marrow Ford the way he has told it for eighteen years.',
      ['Old Standard: "The Crown left us in the field. Every rider here knows that story. Now you do."', 'Sergeant Rook stands you up by the fire. "Say it. No one left in the field."', '"Then say what it means to you. Everyone means something different. That is fine. Just mean it."'],
      oath('broken_banner', [['anyone', '"No one left. Not ours, not anyone\'s."', 'light', 'Old Standard looks up from the fire. "That is what it was for," he says quietly.'],
        ['ours', '"No one of ours left."', 'gray', 'Rook nods. "That is the oath as most of us keep it."'],
        ['forgiven', '"No one left, and no one forgiven."', 'dark', 'A few riders cheer. Rook does not. "That is the oath as the Ragged Riders keep it," she says.']]), 'fig_rook'),
    scene('fq_induct_hearthwatch', 'brother_teodor', 'hearthstone_priory', st => inductDue(st, 'hearthwatch'),
      'Hearthstone Priory at dusk. A broad, quiet man opens the door before you knock, and leads you to a window where one candle is burning.',
      ['Brother Teodor: "The Hearthwatch swear nothing. We light a candle and say a rule. A door open, a fire lit, no questions at the threshold."', 'In the corner Mother Agathe is mending a blanket. She does not look up. "Ask what they will do inside," she says.', '"So. Inside the door. What will you do?"'],
      oath('hearthwatch', [['none', '"No questions. Not ever."', 'light', 'Teodor smiles for the first time. "That is the old answer," he says.'],
        ['inside', '"No questions at the threshold. I will ask them inside."', 'gray', '"That is the honest answer," Teodor says. Agathe snorts, which may be approval.'],
        ['faces', '"No questions. But I will remember every face."', 'dark', 'Agathe looks up at last. "So do I," she says. "Mind what you do with them."']]), 'fig_teodor')
  ];

  // quest steps
  const STEPS = [
    // Crown
    scene('fq_crown_tryout', 'toll_thief', 'kingsway_cross', jobOn('crown_tryout', 'crown_tryout_won'), FIGHTS.crown_tryout.text, ['A thief swings the rope like a skipping game. "Toll\'s a silver a head, friend. Two for the ugly ones."', 'Behind you a farm cart has stopped, and the old man driving it is counting coins he does not have.'], fightOpts('crown_tryout', 'Hold the line')),
    scene('fq_crown_q1', 'the_carter', 'sheepfold', st => jobOn('crown_q1', 'crown_q1_won')(st) && !!((C.jobsOf(st).crown_q1 || {}).seen || {}).s0, FIGHTS.crown_q1.text, ['The carter crouches behind his wheel. "Nine years," he says. "Nine years nobody tried. Whatever is happening at the Keep, they have heard about it out here."'], fightOpts('crown_q1', 'Defend the carts')),
    scene('fq_crown_q2', 'harrow_farm', 'harrow_farms', jobOn('crown_q2', 'crown_q2_done'),
      'The farm at Harrow is half-ploughed. A woman meets you at the gate with two children behind her. Her husband and eldest son are at the border with the levy.',
      ['"We are short because the Crown took the men who grow it," she says. "But you have a tally-stick. So."'],
      choice('crown_q2', 'crown_q2_done', 'crown', [['take', 'Take the full levy. The law is the same for every farm.', 'dark', 1, st => { serve(st, 'crown', 10, 'collected the full levy'); return null; }, 'You fill the cart. She does not watch you go.'],
        ['pay', 'Pay their share yourself (65 gold)', 'light', 2, st => { st.inventory.gold -= 65; return null; }, 'You count out sixty-five gold onto the tally. She stares at it, then at you.', st => st.inventory.gold >= 65],
        ['defer', 'Write it down for next season, under your own name', 'gray', 1, null, 'You notch the tally "next season" and sign it. She does not thank you. She looks as if she might, later.']])),
    scene('fq_crown_q3', 'wat_corley', 'pennant_green', jobOn('crown_q3', 'crown_q3_done'),
      'Market day at Pennant Green. Wat climbs onto the well-stone and unrolls the proclamation. "By order of the Council of Lords, in the King\'s absence—" Someone laughs. Someone throws a cabbage.',
      ['A man at the front: "Which king? We have not had one in years!"', 'Wat keeps reading, louder. His voice shakes on the word "loyal".'],
      choice('crown_q3', 'crown_q3_done', 'crown', [['stand', 'Stand beside him while he reads it all', 'light', 1, null, 'You stand beside him and say nothing. The crowd quiets, slowly, out of something like embarrassment. Wat reads every word.'],
        ['short', 'Tell him to read the first line and get down', 'gray', 1, null, 'Wat reads the first line and the seal at the bottom, and climbs down. Nobody throws anything else. Nobody listened either.'],
        ['example', 'Drag the loudest heckler out and make an example of him', 'dark', 2, st => { serve(st, 'crown', 5, 'kept order at Pennant Green'); return null; }, 'The crowd goes very quiet after that. Wat reads it all to people who will not meet his eye.']])),
    scene('fq_crown_q4_ask', 'lord_of_dunmere', 'dunmere_keep', jobOn('crown_q4', 'crown_q4_ask'),
      'The lord of Dunmere receives you in his hall with his hounds. He reads the Keep\'s letter, folds it, and puts it under his cup.',
      ['"A hundred spears. For Greywatch." He laughs. "I have a harvest to bring in, and Lord Osric drilling men on my border. You may have ten. Old ones."'],
      [O('take', 'Take the ten', st => { done('crown_q4_ask')(st); return { text: 'Ten old men with their grandfathers\' spears fall in behind you. One of them was at Marrow Ford, on the other side.' }; }),
       O('remind', '"You owe the Crown your castle."', st => { done('crown_q4_ask')(st); deed(st, 'crown', 'gray', 1); return { text: '"I owe the Crown an oath," he says. "The castle I owe my grandfather." You get the ten.' }; })]),
    scene('fq_crown_q4', 'post_sergeant', 'greywatch_post', st => jobOn('crown_q4', 'crown_q4_won')(st) && !!fl(st).crown_q4_ask, FIGHTS.crown_q4.text, ['The post sergeant counts your ten old men and spits. "That is the Crown\'s hundred, is it?" He hands one of them a better spear. "Well. We have held with less. Not often."'], fightOpts('crown_q4', 'Hold Greywatch')),
    // Syndicate
    scene('fq_synd_tryout', 'chandler', 'low_docks', jobOn('synd_tryout', 'synd_tryout_done'),
      'The chandler\'s shop smells of tar and worry. He has the sixty, nearly. "Forty now. My boat is in the yard. When she\'s out, the rest."',
      ['His wife is listening from the back. The clerk said how you do it is the interview.'],
      choice('synd_tryout', 'synd_tryout_done', 'syndicate', [['all', 'Take all sixty: the stock will cover the rest', 'dark', 1, st => { st.inventory.gold += 5; return null; }, 'You take the forty and twenty in rope and lamp-oil. The Syndicate gets its sixty. The clerk will like that.'],
        ['terms', 'Take forty now, and write terms for the rest', 'gray', 1, null, 'You write the terms on the back of the slip: twenty more, with interest, when the boat is out. He signs. Everyone is satisfied, more or less.'],
        ['cover', 'Take forty and cover the rest yourself (30 gold)', 'light', 1, st => { st.inventory.gold -= 30; return null; }, 'You take the forty and put in twenty of your own. The chandler shakes your hand twice.', st => st.inventory.gold >= 30]])),
    scene('fq_synd_q1', 'the_bargeman', 'silt_wharf', st => jobOn('synd_q1', 'synd_q1_won')(st) && !!((C.jobsOf(st).synd_q1 || {}).seen || {}).s0, FIGHTS.synd_q1.text, ['The bargeman sees the false light too. "That is not the channel. That is a grave." He kills his own lantern. "If she runs aground they will strip her by morning, and the price of bread in Wheatvale goes where they want it."'], fightOpts('synd_q1', 'Deal with the wreckers')),
    scene('fq_synd_q2', 'weaver', 'debtors_tower', jobOn('synd_q2', 'synd_q2_done'),
      'A room at the top of Debtors\' Tower with a loom in it and a girl of fifteen winding thread. Her mother reads the contract you hold out, though she knows it by heart.',
      ['"Three months behind. The indenture is seven years. She is good with numbers," she says. "They will like that."'],
      choice('synd_q2', 'synd_q2_done', 'syndicate', [['enforce', 'Enforce the contract as written', 'dark', 2, st => { serve(st, 'syndicate', 10, 'enforced a contract'); return null; }, 'You witness the indenture. The girl signs her name very carefully, as if neatness might help.'],
        ['buy', 'Pay off the three months yourself (80 gold)', 'light', 2, st => { st.inventory.gold -= 80; return null; }, 'You pay the arrears and tear the indenture. The weaver sits down on the floor.', st => st.inventory.gold >= 80],
        ['rewrite', 'Rewrite the terms: smaller payments, longer, no indenture', 'gray', 1, st => { serve(st, 'syndicate', 5, 'rewrote a bad contract'); return null; }, 'You rewrite it at the loom. She will pay more in the end, a little at a time, and her daughter stays.']])),
    scene('fq_synd_q3', 'tobin_reed', 'weighhouse', jobOn('synd_q3', 'synd_q3_page'),
      'The Weighhouse ledgers go back twenty years. It takes you an hour to find Reed: paid in full, two years ago, signed by the clerk. And then the same debt, entered again the next month, in the same clerk\'s hand.',
      ['The clerk is watching you from his desk. He has gone very pale.'],
      [O('expose', 'Take the page to Agent Marsh', st => { done('synd_q3_page', 'expose')(st); deed(st, 'syndicate', 'gray', 1); return startFight(st, 'synd_q3'); }),
       O('quiet', '"Pay Tobin\'s father back, and I say nothing."', st => { done('synd_q3_page', 'quiet')(st); deed(st, 'syndicate', 'light', 1); return { text: 'The clerk pays, with his hands shaking, and you leave with the page and a purse for the Reeds.' }; }),
       O('cut', '"Pay Tobin back, and pay me for my trouble."', st => { done('synd_q3_page', 'cut')(st); deed(st, 'syndicate', 'dark', 2); st.inventory.gold += 30; return { text: 'The clerk pays twice: once for the Reeds and once for you. You keep thirty.' }; })]),
    scene('fq_synd_q4_calm', 'stonebridge_crowd', 'stonebridge', jobOn('synd_q4', 'synd_q4_calm'),
      'Two hundred people outside the Stonebridge counting-house, all shouting for their coin at once. The clerks have barred the door. That is making it worse.',
      ['A woman with a baby: "They say the vault is empty! Is it?"'],
      choice('synd_q4', 'synd_q4_calm', 'syndicate', [['pay', 'Open the door and pay the first twenty from your own purse (65 gold)', 'light', 1, st => { st.inventory.gold -= 65; return null; }, 'The first twenty walk out with their coin. The crowd watches them go and, slowly, stops pushing.', st => st.inventory.gold >= 65],
        ['vault', 'Stand on the steps and swear the vault is full', 'gray', 1, null, 'You swear it is full. You do not know. It turns out to be true, which is luck.'],
        ['arrest', 'Have the loudest shouters taken off by the watch', 'dark', 1, null, 'The watch takes six away. The rest go quiet and go home, and will move their coin next week.']])),
    scene('fq_synd_q4', 'the_barman', 'low_docks', st => jobOn('synd_q4', 'synd_q4_won')(st) && !!fl(st).synd_q4_calm, FIGHTS.synd_q4.text, ['The barman points without being asked. "Corner table. They have been buying all night, with new coin." He lowers his voice. "Syndicate coin, fresh from the mint. Somebody inside paid them to start that run."'], fightOpts('synd_q4', 'Take the rumour-men')),
    // Synod
    scene('fq_synod_tryout', 'wart_charmer', 'pale_vigil', jobOn('synod_tryout', 'synod_tryout_done'),
      'A cottage with a crooked chimney. The old woman is charming a wart off a carter\'s thumb with a bit of string and a rhyme. She sees your face and stops.',
      ['"You\'ve come for my name," she says. "Everybody does, eventually."'],
      choice('synod_tryout', 'synod_tryout_done', 'synod', [['write', 'Take her name for the clerk', 'gray', 1, null, 'She tells you: Goody Wren. You write it down. She asks you to spell it right.'],
        ['warn', 'Take her name, and tell her to stop charming for a while', 'light', 1, null, 'She tells you, and then laughs. "Stop? The warts will not stop." But she closes the shutters.'],
        ['bring', 'Bring her back to Orchard Row', 'dark', 2, st => { serve(st, 'synod', 10, 'brought in a charmer'); return null; }, 'She comes without a fuss. That is somehow worse.']])),
    scene('fq_synod_q1', 'warden_vell', 'wardstone_green', st => jobOn('synod_q1', 'synod_q1_won')(st) && !!((C.jobsOf(st).synod_q1 || {}).seen || {}).s0, FIGHTS.synod_q1.text, ['Vell, beside you, very calm: "If they get the silver out, the ward fails tonight, and whatever lives on the other side of it walks into forty kitchens." She draws a line of chalk across the path. "Do not step over that."'], fightOpts('synod_q1', 'Stop them')),
    scene('fq_synod_q2', 'miller', 'pilgrims_stair', jobOn('synod_q2', 'synod_q2_done'),
      'The miller is grinding when you arrive. While you watch, he leans to the lamp by the stones and it catches before his hand quite reaches it. He sees you see it.',
      ['"It is the only thing I can do," he says. "Light a lamp. Forty years. It has never burned anything I didn\'t want it to."'],
      choice('synod_q2', 'synod_q2_done', 'synod', [['confirm', 'Confirm his name for the book', 'gray', 1, null, 'You tell him his name will be written down and someone will visit. He nods. He has known all his life this day would come.'],
        ['clear', 'Report that you found nothing', 'light', 2, st => { serve(st, 'synod', -5, 'found nothing at Pilgrim\'s Stair'); return null; }, 'You tell him to use flint for a while. He gives you a loaf. You will tell Vell you found nothing.'],
        ['bring', 'Bring him in to Vol\'Dun yourself', 'dark', 2, st => { serve(st, 'synod', 10, 'brought in a miller'); return null; }, 'He banks the fire, closes the mill and walks beside you all the way to Vol\'Dun without a word.']])),
    scene('fq_synod_q3', 'ria', 'sunken_cloister', jobOn('synod_q3', 'synod_q3_done'),
      'Ria opens the door with flour on her hands and reads her brother\'s letter standing up. A little light is turning over and over above the bread oven, keeping it warm.',
      ['"He copied the list," she says. "If they find out, he is finished. If I run, they will know someone warned me."'],
      choice('synod_q3', 'synod_q3_done', 'synod', [['warn', 'Tell her to run, tonight', 'light', 2, st => { serve(st, 'synod', -5, 'a name went missing'); return null; }, 'She packs in ten minutes. She has done this before, in her head, many times.'],
        ['register', 'Persuade her to come in and register', 'gray', 1, st => { serve(st, 'synod', 5, 'brought in a registration'); return null; }, 'She agrees, for Aldo\'s sake. "Registered," she says, "like a cow."'],
        ['report', 'Take the letter to the Inquisitors instead', 'dark', 2, st => { serve(st, 'synod', 15, 'exposed a copied list'); return null; }, 'The Inquisitors thank you for the letter. They are more interested in who copied the list than in Ria.']])),
    scene('fq_synod_q4_ask', 'archivist', 'blackstone_archive', jobOn('synod_q4', 'synod_q4_ask'),
      'The Blackstone Archive is nine floors of shelves. The archivist searches for two hours, and then for two more.',
      ['"Fire that burns stone." He closes the last index. "No such spell. Not here, not anywhere. If it were real, we would have it."'],
      [O('thank', 'Thank him and go to Cinder Gate', st => { done('synod_q4_ask')(st); return { text: 'You leave him re-reading the index, as if it might have changed.' }; })]),
    scene('fq_synod_q4', null, 'cinder_gate', st => jobOn('synod_q4', 'synod_q4_won')(st) && !!fl(st).synod_q4_ask, FIGHTS.synod_q4.text, ['The gatehouse wall is running like candle-wax, and the mages working the spell have not noticed you yet.', 'One of them is laughing. "No book has this," she calls to the others. "No book will ever have it."'], fightOpts('synod_q4', 'Stop the spell')),
    // the Banner
    scene('fq_banner_tryout', 'wagon_driver', 'ragged_fence', jobOn('banner_tryout', 'banner_tryout_won'), FIGHTS.banner_tryout.text, ['The wagon driver sees you on the road and reaches for the horn. The strongbox is the shire\'s tax: grain-money, mostly, from farms the Banner protects for free.'], fightOpts('banner_tryout', 'Take the wagon')),
    scene('fq_banner_q1', 'driftmoor_farmer', 'driftmoor_farm', jobOn('banner_q1', 'banner_q1_won'), FIGHTS.banner_q1.text, ['A farmer on the roof with a pitchfork: "Are you Banner? Thank the gods. Nobody else came." Below him, his barn is already burning.'], fightOpts('banner_q1', 'Drive them off')),
    scene('fq_banner_q2', 'gullsong_headman', 'gullsong', jobOn('banner_q2', 'banner_q2_done'),
      'Gullsong is twelve houses and a smokehouse. The headman has the winter share laid out on a cloth: dried fish, oats, a little salt. It is not much, and the houses behind him are not well stocked either.',
      ['"You kept the raiders off," he says. "We remember. Take what you are owed."'],
      choice('banner_q2', 'banner_q2_done', 'broken_banner', [['full', 'Take all of it', 'dark', 1, st => { serve(st, 'broken_banner', 10, 'brought in the full share'); return null; }, 'You load it all. The headman folds the cloth and says nothing at all.'],
        ['half', 'Take half', 'gray', 1, null, 'You take half. The headman does not argue, which is how you know it was still too much.'],
        ['none', 'Take nothing. They need it more.', 'light', 2, st => { serve(st, 'broken_banner', -10, 'came back empty-handed'); return null; }, 'You leave it on the cloth. The headman stares at you as if you have forgotten your job.']])),
    scene('fq_banner_q3', 'kit_ashby', 'hobbs_reach', jobOn('banner_q3', 'banner_q3_won'), FIGHTS.banner_q3.text, ['Kit, very quietly: "That one is Hobb Senior\'s boy. We used to fish together." The thief-taker grins at him. "Twenty silver for a deserter, Kit. Nothing personal."'], fightOpts('banner_q3', 'Stand with Kit')),
    scene('fq_banner_q4', 'ragged_captain', 'widows_barrow', jobOn('banner_q4', 'banner_q4_won'), FIGHTS.banner_q4.text, ['Their captain: "Mags sent you? Tell her we are only doing what the Banner always did. We just stopped asking first." Behind him, a village\'s winter stores are stacked in sacks. "You can come with us, you know. There is a lot of winter left."'], fightOpts('banner_q4', 'Break them')),
    // the Hearthwatch
    scene('fq_hw_tryout', 'hearth_warden', 'sheepfold', st => jobOn('hw_tryout', 'hw_tryout_done')(st) && !!((C.jobsOf(st).hw_tryout || {}).seen || {}).s0,
      'At Sheepfold the last of the bread goes to an old couple and a thin man who keeps to the back. He has a Syndicate debt-mark on the back of his hand. Two collectors are coming up the lane.',
      ['The warden at your elbow, very low: "No questions at the threshold. This is the threshold."'],
      choice('hw_tryout', 'hw_tryout_done', HW, [['hide', 'Put him in the cart under the empty baskets', 'light', 2, st => { gw(st, 4, 'hid a debtor'); return null; }, 'The collectors look in the cart and see baskets. The warden says nothing on the way home, and smiles once.'],
        ['pay', 'Pay off his mark (50 gold)', 'gray', 1, st => { st.inventory.gold -= 50; return null; }, 'You pay the collectors. They give him a receipt and go. He looks at it as though it is in another language.', st => st.inventory.gold >= 50],
        ['give', 'Step aside and let them take him', 'dark', 2, st => { gw(st, -4, 'stood aside at Sheepfold'); return null; }, 'They take him. The warden does not say anything about it, then or later.']])),
    scene('fq_hw_q1', 'nell', 'drowned_chapel', jobOn('hw_q1', 'hw_q1_won'), FIGHTS.hw_q1.text, ['Nell, not stopping the cart: "They did not used to do this. Nobody robs the candle." She does not slow down. "Teodor says we never fight. Teodor is not here."'], fightOpts('hw_q1', 'Protect the cart')),
    scene('fq_hw_q2', 'hearth_warden', 'millstream', jobOn('hw_q2', 'hw_q2_done'),
      'The Millstream chapel, late. A man asleep in the back pew with his arm bound up. And at the door, a Synod inquisitor with a warrant and very good manners.',
      ['"I know he is here," she says. "I would rather not come in without being asked. Will you ask me in?"'],
      choice('hw_q2', 'hw_q2_done', HW, [['hide', '"No questions at the threshold. Not tonight."', 'light', 2, st => { gw(st, 6, 'kept the threshold'); S.changeStanding(st, 'synod', -10, { reason: 'refused a warrant at Millstream', ripple: false }); return null; }, 'She looks at you, then at the candle in the window, and goes. "Another night," she says.'],
        ['door', 'Let her search, and say nothing', 'gray', 1, null, 'She searches politely and finds him, as she was always going to. You did not lie. You did not help.'],
        ['name', 'Tell her where he is sleeping', 'dark', 2, st => { gw(st, -8, 'gave up a guest'); S.changeStanding(st, 'synod', 10, { reason: 'helped an inquisitor', ripple: false }); return null; }, 'She thanks you and goes in. The warden puts the candle out.']])),
    scene('fq_hw_q3', 'agathe', 'whitestone_abbey', jobOn('hw_q3', 'hw_q3_done'),
      'Mother Agathe listens to you ask, mending all the while. Then she unlocks a drawer and puts the abbey register on the table between you, open at a winter page.',
      ['"I will not read it to her," she says. "You may. Then you will be the one who decided. That is the price."', 'The entry is short: a foundling taken in, the mother a hedge-woman hidden from the Synod, gone in the spring. Name withheld for her safety.'],
      choice('hw_q3', 'hw_q3_done', HW, [['tell', 'Copy it out for Nell, word for word', 'light', 2, null, 'Agathe watches you copy it and says nothing. When you finish she closes the book very gently.'],
        ['spare', 'Tell Nell the page said nothing', 'gray', 1, null, 'You close the register. Agathe raises an eyebrow, which is the most she has ever shown you.'],
        ['sell', 'Remember the page, and who would pay for it', 'dark', 2, st => { gw(st, -10, 'sold a register page'); S.changeStanding(st, 'synod', 15, { reason: 'sold a hidden name', ripple: false }); st.inventory.gold += 40; return null; }, 'Agathe takes the register back without a word. She knows. She always knows.']])),
    scene('fq_hw_q4', 'the_bailiff', 'pilgrims_well', jobOn('hw_q4', 'hw_q4_won'), FIGHTS.hw_q4.text, ['The bailiff, with the debtor by the collar: "Sanctuary is a custom. Customs are not law." The chapel warden is on the floor with a cut lip. Every pilgrim in the room is watching to see what a Hearth-Friend does.'], fightOpts('hw_q4', 'Put them out'))
  ];
  // stakes, in words, under each choice (no numbers)
  C.MOVE_HINTS = Object.assign(C.MOVE_HINTS || {}, {
    'fq_crown_q2.take': 'The Crown is satisfied. The family goes hungry.',
    'fq_crown_q2.pay': 'You pay for their winter. Harte will notice.',
    'fq_crown_q2.defer': 'Your word for their debt. Harte will hold you to it.',
    'fq_crown_q3.stand': 'Wat keeps his nerve, and so do you.',
    'fq_crown_q3.short': 'Nobody gets hurt. Nobody listens either.',
    'fq_crown_q3.example': 'Order, by fear. The Crown approves.',
    'fq_crown_q4_ask.take': 'Take what he gives.',
    'fq_crown_q4_ask.remind': 'Remind him of his oath. It will not change his mind.',
    'fq_synd_tryout.all': 'The Syndicate gets every coin. The chandler goes short.',
    'fq_synd_tryout.terms': 'The Syndicate\'s way: everyone signs.',
    'fq_synd_tryout.cover': 'Your own coin. The chandler will not forget it.',
    'fq_synd_q2.enforce': 'The contract holds. The girl pays for seven years.',
    'fq_synd_q2.buy': 'Your coin buys her freedom.',
    'fq_synd_q2.rewrite': 'A cleverer contract. Everyone wins a little.',
    'fq_synd_q3.expose': 'The truth, to Marsh. The clerk will not go quietly.',
    'fq_synd_q3.quiet': 'The Reeds are paid. The clerk keeps his job.',
    'fq_synd_q3.cut': 'Everyone pays, you most of all.',
    'fq_synd_q4_calm.pay': 'Your coin buys calm.',
    'fq_synd_q4_calm.vault': 'A promise you cannot check.',
    'fq_synd_q4_calm.arrest': 'Calm, by force. Trust leaves quietly.',
    'fq_synod_tryout.write': 'The Synod\'s way: a name in the book.',
    'fq_synod_tryout.warn': 'Her name, and a kindness.',
    'fq_synod_tryout.bring': 'The Synod is pleased. She is not.',
    'fq_synod_q2.confirm': 'The truth for the book. He will be visited.',
    'fq_synod_q2.clear': 'A lie that saves him. Vell may guess.',
    'fq_synod_q2.bring': 'The Inquisitors will like you.',
    'fq_synod_q3.warn': 'Ria escapes. Aldo is safe, for now.',
    'fq_synod_q3.register': 'Safe, the Synod\'s way.',
    'fq_synod_q3.report': 'The Inquisitors want whoever copied the list.',
    'fq_banner_q2.full': 'The Banner eats. Gullsong goes short.',
    'fq_banner_q2.half': 'Half for each. Rook\'s choice too.',
    'fq_banner_q2.none': 'Gullsong eats. The Banner goes hungry.',
    'fq_hw_tryout.hide': 'He is safe. The collectors are fooled.',
    'fq_hw_tryout.pay': 'Your coin clears his debt.',
    'fq_hw_tryout.give': 'The collectors take him. The warden sees.',
    'fq_hw_q2.hide': 'The threshold kept. The Synod is crossed.',
    'fq_hw_q2.door': 'Within the rule, only just.',
    'fq_hw_q2.name': 'The Synod thanks you. The Hearthwatch will not.',
    'fq_hw_q3.tell': 'Nell learns the truth about her mother.',
    'fq_hw_q3.spare': 'Nell is spared a hard truth, and kept from it.',
    'fq_hw_q3.sell': 'Coin from the Synod. Agathe will know.',
    'corisande_chapel.help': 'The Hearthwatch see you working.',
    'corisande_chapel.ask': 'Hear what she thinks of the lords.',
    'osric_aldermere.count': 'Tell him what you see.',
    'osric_aldermere.whose': 'Ask the question nobody asks him.',
    'hw_refugees.open': 'Costs you 50 gold. The Hearthwatch will remember.',
    'hw_refugees.crown': 'A little help, and a lecture.',
    'hw_refugees.move': 'The families go on. The warden will not forget.',
    'hw_fever_priory.nurse': 'Three days. Nobody is written down.',
    'hw_fever_priory.synod': 'Everyone lives. Every name goes in a Synod ledger.',
    'hw_fever_priory.names': 'The Synod is grateful. Agathe will not be.',
    'agathe_page.ask': 'She does not know you well enough yet.',
    'agathe_return.search': 'The page, without her blessing.',
    'agathe_return.earned': 'She trusts you now.'
  });
  // the rest of the story's scenes (writing pass 2)
  Object.assign(C.MOVE_HINTS, {
    'harrow_supper.who': 'Ask the question he wants asked.',
    'harrow_supper.love': 'Argue with him. He enjoys it.',
    'harrow_supper.cold': 'Let him know you are not his.',
    'harrow_price.give': 'Riches and safety. The Steward wins.',
    'harrow_price.refuse': 'He will come to you himself.',
    'harrow_in_person.give': 'Partner by morning. He keeps his secret.',
    'harrow_in_person.threaten': 'The Crown will not forgive it. Neither will he.',
    'harrow_in_person.leave': 'Keep the Book, and the danger.',
    'osric_steel.fight': 'A fight. They know where you sleep.',
    'osric_steel.slip': 'Get away, and find out where they came from.',
    'rookwood_choice.burn': 'Osric loses his army.',
    'rookwood_choice.ledger': 'Osric keeps his army. You keep his secrets.',
    'ilvane_ward.magic': 'Ask who pays for her ward.',
    'ilvane_ward.books': 'Ask where the books go.',
    'ilvane_ward.terms': 'Carry her terms. The Synod will owe you.',
    'ilvane_return.give': 'The Synod rewards you richly. The truth goes back underground.',
    'ilvane_return.keep': 'Keep the truth. They will keep coming.',
    'thorne_parley.show': 'Show him what his arrests became.',
    'thorne_parley.lie': 'A lie he will not believe. A fight.',
    'thorne_parley.leave': 'He lets you go, this once.',
    'crane_cipher.promise': 'Crane will pay more for it, later.',
    'crane_cipher.you': 'Needle her.',
    'crane_cipher.nothing': 'Keep your counsel.',
    'crane_buyer.sell': 'A fortune. Crane takes the Syndicate.',
    'crane_buyer.refuse': 'Keep it. She will ask once more.',
    'agathe_page.take': 'She trusts you with a child\'s life.',
    'agathe_return.leave': 'Come back when she trusts you.',
    'old_standard.mine': 'Swear yourself to the Banner\'s secret.',
    'old_standard.duel': 'First blood wins the Ring.',
    'old_standard.bargain': 'Pay for it, in coin or in something harder.',
    'wil_crown.everything': 'Tell him a king owes everything.',
    'wil_crown.better': 'Tell him a king owes only to be better.',
    'wil_crown.his_choice': 'Leave the choice with him.',
    'wil_crown.leave': 'Not today.',
    'crown_marches.evacuate': 'The people first. The gate will be harder to hold.',
    'crown_marches.gate': 'Your orders, and only your orders.',
    'crown_marches.burn': 'The raiders starve, and so do the Marches.'
  });
  C.MOVE_HINTS['fq_fight'] = 'A fight. Lose, and you can come back and try again.';
  INDUCT.concat(STEPS).forEach(m => { if (C.MOVES && !C.MOVES.some(x => x.id === m.id)) C.MOVES.push(m); });
  // a quest-step scene that was dismissed ("Not yet") or a fight that was lost comes back on the next arrival there
  // (handled by repeat:true); the Moves are keyed off the job being active, so taking or finishing the job is what arms or ends them.

  // the base check only knows encounters and node choices; these flags are set by the scenes above (checked in validateQuests)
  { const v0 = C.validate; if (v0) C.validate = function () { return v0.apply(this, arguments).filter(x => !FQJOBS.some(id => x.indexOf('job ' + id + ': nothing sets flag') === 0)); }; }
  C.validateQuests = function () {
    const p = [], cls = window.GAME_DATA.classes, gear = window.GAME_DATA.gear;
    Object.entries(FQ).forEach(([f, F]) => { [F.hall, F.contact].forEach(n => { if (!C.NODES[n]) p.push(f + ': unknown place ' + n); }); if (!gear[F.token]) p.push(f + ': unknown token ' + F.token); [F.tryout].concat(F.quests).forEach(id => { if (!J[id]) p.push(f + ': missing job ' + id); }); });
    FQJOBS.forEach(id => { const j = J[id]; if (!C.NODES[j.at]) p.push(id + ': unknown giver place'); if (j.after && !J[j.after]) p.push(id + ': unknown after');
      j.steps.forEach((x, i) => { const at = x.visit || x.at; if (!at || !C.NODES[at]) p.push(id + ' step ' + i + ': no place'); if (x.flag && !C.MOVES.some(m => m.at === x.at && m.id.startsWith('fq_'))) p.push(id + ' step ' + i + ': no scene sets ' + x.flag); });
      (j.learn || []).forEach(l => { if (!C.LORE[l]) p.push(id + ': unknown lore ' + l); }); });
    Object.keys(C.MOVE_HINTS || {}).forEach(k => { const [m, o] = k.split('.'); if (!o) return; const mv = C.MOVES.find(x => x.id === m); if (!mv || !mv.options.some(x => x.id === o)) p.push('hint ' + k + ': no such scene option'); });
    Object.entries(FIGHTS).forEach(([k, F]) => F.enemies.forEach(e => { if (!cls[e.primary] || cls[e.primary].selectable === false) p.push('fight ' + k + ': illegal class ' + e.primary); }));
    return p;
  };
  }
  if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.STORY_WORLD) go(); else { const t = setInterval(() => { if (window.GAME_CAMPAIGN && window.GAME_CAMPAIGN.STORY_WORLD) { clearInterval(t); go(); } }, 20); }
})();
