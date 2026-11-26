/* Campaign data and world helpers (slice). Needs GAME_DATA (classes, gear, maps, races, factions), GAME_LOADOUT and GAME_SAVE.
   Node map positions are fractions of the painted map (x, y in 0..1) so the art can be swapped without touching data.
   Everything here is data plus small pure helpers: the screens that show it come in the menu step.

   NODE:      { name, region, type: hall|market|battle|road|choice|contested|town, pos:[x,y], faction?, owner?, desc, (links come from EDGES: [a, b, days])
                encounter?, choice?, shop?: [gearIds], recruit?: true }
   ENCOUNTER: { name, map, rec: recommended level, enemyFaction, enemies: [{primary, secondary?, name?}] (max 3), reward: { xp, gold, items },
                once?: true, options?: [{ id, label, enemyFaction, enemies, standing: { faction: delta }, reward }] }
   CHOICE:    { text, options: [{ id, label, standing?, gold?, flag?, relations?: [[a, b, delta, both]] }] }
   EVENT:     { id, day, once, text, effect(st) } fired by dueEvents(st) when the day passes.
   The data parts load first: regions.js, places.js, roads_gen.js, encounters.js. This file holds the rules and publishes GAME_CAMPAIGN. */
(function () {
  const P = window.__CAMPAIGN_PARTS, C = P.C;
  const G = () => window.GAME_DATA, S = () => window.GAME_SAVE, LO = () => window.GAME_LOADOUT;
  // ---- state helpers ----
  const nodeState = P.nodeState;  // defined in regions.js, shared with encounters.js
  C.ownerOf = (st, id) => (st.world.nodes[id] && st.world.nodes[id].owner) || (C.NODES[id] && C.NODES[id].owner) || null;
  C.isDiscovered = (st, id) => !!(st.world.nodes[id] && st.world.nodes[id].discovered);
  C.discover = (st, id) => { const n = C.NODES[id]; if (!n) return; if (n.hidden && !st.world.flags['reveal_' + id]) return; nodeState(st, id).discovered = true; };

  C.startOptions = () => Object.keys(C.STARTS).filter(r => G().races[r] && G().races[r].active).map(r => ({ race: r, name: G().races[r].name, desc: G().races[r].desc, trait: G().races[r].trait, opening: C.STARTS[r].opening, location: C.STARTS[r].location }));

  // Plain-language lines for what a race gives (read from data/races.js, so the creator never drifts from the rules).
  C.traitLines = function (raceId) {
    const R = G().races[raceId]; if (!R) return []; const o = [], m = R.statMods || {};
    if (m.hp) o.push((m.hp > 0 ? '+' : '') + m.hp + ' max HP'); if (m.mv) o.push((m.mv > 0 ? '+' : '') + m.mv + ' move'); if (m.jump) o.push((m.jump > 0 ? '+' : '') + m.jump + ' jump'); if (m.spd) o.push((m.spd > 0 ? '+' : '') + m.spd + ' speed');
    if (R.armor) o.push('+' + R.armor + '% armor'); if (R.rangedReduce) o.push(R.rangedReduce + '% less damage from ranged attacks'); if (R.pushImmune) o.push('Cannot be pushed');
    if (R.jpRate && R.jpRate !== 1) o.push('JP gain ×' + R.jpRate);
    return o;
  };
  // Create a new campaign for a race: recruits named from the race list, standing, location and the discovered nodes of that start.
  C.newGame = function (opts) {
    opts = opts || {}; const race = opts.race, R = G().races[race], T = C.STARTS[race];
    if (!R || !T || !R.active) throw new Error('Race cannot start a game: ' + race);
    const recruits = T.recruits.map((r, i) => Object.assign({ name: R.names[i % R.names.length], race }, r));
    const hc = opts.heroClass && G().classes[opts.heroClass]; // the hero (first recruit) may start as any entry class
    if (hc && G().classes[opts.heroClass].tier === 1 && G().classes[opts.heroClass].selectable !== false) recruits[0].primary = opts.heroClass;
    if (opts.name && String(opts.name).trim()) recruits[0].name = String(opts.name).trim().slice(0, 16);
    const st = S().newGame({ name: opts.name, race, slot: opts.slot, location: T.location, standing: T.standing, recruits, gold: opts.gold });
    T.discovered.forEach(id => C.discover(st, id));
    Object.keys(C.NODES[T.location].links).forEach(id => C.discover(st, id)); // you know the roads out of where you stand
    T.discovered.forEach(id => { const seen = { [T.location]: null }, q = [T.location]; while (q.length) { const x = q.shift(); if (x === id) break; Object.keys(C.NODES[x].links).forEach(y => { if (!(y in seen)) { seen[y] = x; q.push(y); } }); } // you know the way to places you have heard of
      for (let x = id; x && x !== T.location; x = seen[x]) C.discover(st, x); });
    S().markMet(st, C.NODES[T.location].owner); st.world.flags.opening = T.opening; if (race !== 'human') st.world.flags.guide_none = 1;
    return st;
  };

  // ---- guided first week (the 'crossroads week'): a short checklist that lets each power introduce itself and leaves a lead to follow ----
  // Steps can be done in any order. Each finished step shows its 'talk' once, may reveal a route (lead), and the last pays a small purse. The player can skip it.
  C.discoverRoute = function (st, from, to) {
    const seen = { [from]: null }, q = [from];
    while (q.length) { const x = q.shift(); if (x === to) break; Object.keys(C.NODES[x].links).forEach(y => { if (!(y in seen)) { seen[y] = x; q.push(y); } }); }
    for (let x = to; x && x in seen; x = seen[x]) C.discover(st, x);
  };
  const fl = (st, k) => !!st.world.flags[k], vis = (st, id) => !!(st.world.nodes[id] && st.world.nodes[id].visited);
  C.GUIDE = [
    { id: 'gear', title: 'Gear up', hint: 'Kingsway Cross has a shop. Buy anything: a blade, a pair of boots.', done: st => fl(st, 'g_buy'),
      talk: 'The shopkeeper weighs your coin and your companions together. "First time on the crossroads? Then learn this: every road belongs to somebody. Rivermeet, south on the river road, is where the Crown keeps its garrison. Go and see whose roads these are before you get lost on one."' },
    { id: 'crown', title: 'Walk to Rivermeet', hint: 'Open the map and tap Rivermeet. Roads take a day each.', done: st => vis(st, 'rivermeet'), lead: ['crown_keep'],
      talk: 'THE CROWN. Rivermeet flies the royal colours, a little faded. The sergeants here pay for steady swords and remember who held a line. They believe order, even stiff and unfair order, is better than a war over the empty throne.\n\nBut the Crown is brittle. Its lords keep their own grain and their own spears, and in the corner of the garrison tavern a Syndicate factor is buying them one debt at a time. A captain mentions Crown Keep, where the throne waits for somebody. You now know the way there.' },
    { id: 'fight', title: 'Win a fight', hint: 'Zones such as the Golden Reach are where trouble finds travellers. Walk in and see.', done: st => fl(st, 'g_fight'), lead: ['canalgate'],
      talk: 'THE SYNDICATE. The men you beat were debt-collectors, and not very good ones. One carried a ledger slip stamped for Canalgate.\n\nThe Syndicate lends, buys and collects. It paid for bridges when the Crown could not, and it owns half the wells it dug. It says a debt paid is a war nobody fights, and it pays well for anyone useful and quiet. You now know the way to Canalgate.' },
    { id: 'synod', title: 'Walk to Pennant Green', hint: 'A village on the other side of the crossroads. Pilgrims pass through it.', done: st => vis(st, 'pennant_green'), lead: ['orchard_row'],
      talk: 'THE SYNOD. A pilgrim shares her bread with you on the green and asks nothing for it.\n\nThe Synod keeps the chantries and the hospices, hears confessions and writes everything down. It polices magic, because it has seen what wild magic does to a village, and it never forgets what it has been told. The pilgrim points you to Orchard Row, where the clerks are. You now know the way there.' },
    { id: 'factions', title: 'Open the Factions tab', hint: 'Tap Factions at the bottom. It shows where you stand, offers, and who is watching you.', done: st => fl(st, 'g_factions'), purse: 50,
      talk: 'Nobody owns you yet. Your standing with each power moves with what you do, and what you do for one is noticed by the others.\n\nWhen a power has noticed you, someone of theirs will offer you a try-out. Pass it and they will invite you in. You can serve one, serve two and keep one secret, or stay free. The rest of the map is yours to uncover.' }
  ];
  C.guideState = function (st) { const f = st.world.flags; return { off: !!(f.guide_off || f.guide_done), steps: C.GUIDE.map(g => ({ id: g.id, title: g.title, hint: g.hint, done: !!f['gd_' + g.id] })) }; };
  C.guideFlag = (st, k) => { st.world.flags[k] = 1; };
  C.guideSkip = st => { st.world.flags.guide_off = 1; };
  C.guideCheck = function (st) {
    const f = st.world.flags, out = []; if (!f.opening || f.guide_off || f.guide_done || f.guide_none) return out;
    C.GUIDE.forEach(g => { if (f['gd_' + g.id] || !g.done(st)) return; f['gd_' + g.id] = 1;
      (g.lead || []).forEach(id => C.discoverRoute(st, st.world.location, id)); if (g.purse) st.inventory.gold += g.purse;
      ({ crown: 'crown', fight: 'syndicate', synod: 'synod' })[g.id] && S().markMet(st, ({ crown: 'crown', fight: 'syndicate', synod: 'synod' })[g.id]);
      out.push({ id: g.id, title: g.title, talk: g.talk, purse: g.purse || 0, lead: g.lead || [] }); });
    if (C.GUIDE.every(g => f['gd_' + g.id])) f.guide_done = 1;
    return out;
  };

  // ---- jobs: small quests for the starting country. A job is offered at a place, has steps (flags set by scenes and fights, or a visit), and is reported back at the giver. ----
  // Scenes and fights tied to a job are only open while it is active (choice.job / encounter.job); encounter.winFlag is set on a win. Rewards: gold, standing, and rumours (reveal) that put hidden places on the map.
  C.JOBS = {
    toll_road: { name: 'The Tithe Barn Road', giver: 'crown', at: 'rivermeet', after: null,
      offer: 'A Crown sergeant with a broken nose slaps a map on the table. "Deserters. Our own, once. They have taken the Tithe Barn and they are robbing the grain carts on the river road, and every cart they rob is bread somebody in Rivermeet does not eat."\n\n"Clear them out. The Crown does not forget a favour. It does not forget a failure either."',
      steps: [{ text: 'Drive the raiders out of the Tithe Barn', flag: 'job_toll_won' }], done: 'The carts roll again. The sergeant counts out your pay without looking up, then does look up. "Most sellswords take the money and ask what the job was for. You did not ask. I will remember that, for good or ill."',
      reward: { gold: 90, standing: { crown: 60 } } },
    barrow_whispers: { name: 'Lights in the Barrow', giver: 'crown', at: 'crown_keep', after: 'toll_road',
      offer: 'A grey steward in Crown Keep draws you into a window-seat and lowers his voice. Shepherds have seen lights at night in the King\'s Barrow, where the old king lies sealed.\n\n"Nobody is supposed to go in there. Nobody has a key." He pauses. "Go and look. Do not touch anything. Tell me what you see, and tell nobody else."',
      steps: [{ text: 'Visit the King\'s Barrow', visit: 'kings_barrow' }], done: 'The steward listens to every word and goes pale at the part about the door. "Resealed," he repeats. Then, very quietly, he tells you of a way down into the Barrow that the masons used. "The Crown would rather this stayed quiet. So would I. So, I think, would you."',
      reward: { gold: 60, standing: { crown: 40 }, reveal: ['kings_barrow_depths'] } },
    pennant_debt: { name: 'A Debt at Pennant Green', giver: 'syndicate', at: 'rivermeet', after: null,
      offer: 'A Syndicate factor in a good grey coat taps a ledger with one clean fingernail. "Ebb Thatcher, Pennant Green. Ninety-five gold for seed, overdue since the harvest failed. The Syndicate would like it settled."\n\n"How you settle it is your business," she says. "A settled account is a settled account. But I will read what you did, and so will people above me."',
      steps: [{ text: 'Settle the farmer\'s debt at Pennant Green', flag: 'job_debt_settled' }], done: 'The factor reads your account of it and makes a small note beside your name. She does not say what the note is. She never will.',
      reward: { gold: 40, standing: { syndicate: 25 } } },
    cellar_ledger: { name: 'The Applecourt Cellars', giver: 'syndicate', at: 'rivermeet', after: 'pennant_debt',
      offer: 'The factor slides a stained slip across the table. "Smugglers have a cache in the cellars under Applecourt. One of our ledgers went down there with a clerk, and only the clerk came back, without it."\n\n"Go and see that the village is still standing," she says. "That is what I will tell people I asked. What we care about is the ledger."',
      steps: [{ text: 'Visit Applecourt', visit: 'applecourt' }], done: 'The factor hears about the cellars and smiles in a way you do not like. "Then the ledger is still down there. Good." The way into the cellars is now on your map, if you want to go and fetch it.',
      reward: { gold: 70, standing: { syndicate: 40 }, reveal: ['applecourt_cellars'] } },
    sealed_letter: { name: 'A Sealed Letter', giver: 'synod', at: 'pennant_green', after: null,
      offer: 'The pilgrim from the roadside, her foot bound up now, presses a sealed letter into your hands. "For the Synod\'s clerks at Orchard Row. I am too lame to walk it in time, and it must be there in time."\n\n"Do not lose it," she says. Then, more quietly: "And do not be curious. Curiosity is how people end up in letters."',
      steps: [{ text: 'Take the letter to Orchard Row', flag: 'job_letter_done' }], done: 'The pilgrim weighs your face for a long moment when you tell her it is delivered, as if reading what you have not said. Then she thanks you, and means it.',
      reward: { gold: 50, standing: { synod: 20 } } },
    hedge_mage: { name: 'The Hedge-Mage', giver: 'synod', at: 'orchard_row', after: 'sealed_letter',
      offer: 'A clerk at Orchard Row asks for a quiet pair of hands. "A self-taught healer is lodging at Pale Vigil. Unlicensed. Unwatched. Half the village swears by her, which is half the problem."\n\n"Talk to her," he says. "See what she is. The chantry will hear what you tell it, and act on it. Choose your words."',
      steps: [{ text: 'Meet the healer at Pale Vigil', flag: 'job_mage_done' }], done: 'The clerk writes down exactly what you say, word for word, and reads it back to you. "Is that all of it?" You nod. What he does with it now is the Synod\'s business, and the Synod does not forget.',
      reward: { gold: 40, standing: { synod: 15 } } }
  };

  // General side quests: small jobs from ordinary folk. Giver 'general'. Step kinds: flag (set by a fight), visit, tavern (have a drink there after taking the job), clear (a dungeon is cleared).
  C.ENCOUNTERS.gq_poachers = { name: 'Poachers at Ploughman\'s Ford', map: 'hollow_fields', rec: 2, enemyFaction: 'outlaws', once: true, job: 'poachers', winFlag: 'job_poachers_won', enemies: [{ primary: 'scout', name: 'Poacher' }, { primary: 'squire', name: 'Poacher' }, { primary: 'rogue', name: 'Skinner' }], reward: { xp: 60, gold: 25 } };
  C.ENCOUNTERS.gq_smugglers = { name: 'Cask Hollow Smugglers', map: 'vane_smugglers', rec: 3, enemyFaction: 'bilge_rats', once: true, job: 'cask_trouble', winFlag: 'job_cask_won', enemies: [{ primary: 'rogue', name: 'Runner' }, { primary: 'warrior', name: 'Cask Guard' }, { primary: 'archer', name: 'Lookout' }], reward: { xp: 80, gold: 30 } };
  C.ENCOUNTERS.gq_brigands = { name: 'Brigands of Hobb\'s Reach', map: 'gallows_hill', rec: 3, enemyFaction: 'outlaws', once: true, job: 'gallows_brigands', winFlag: 'job_brigands_won', enemies: [{ primary: 'warrior', name: 'Brigand' }, { primary: 'scout', name: 'Brigand Archer' }, { primary: 'acolyte', name: 'Camp Healer' }], reward: { xp: 90, gold: 35 } };
  C.NODES.ploughmans_ford.encounter = 'gq_poachers'; C.NODES.cask_hollow.encounter = 'gq_smugglers'; C.NODES.hobbs_reach.encounter = 'gq_brigands';
  Object.assign(C.JOBS, {
    lost_flock: { name: 'The Lost Flock', giver: 'general', at: 'sheepfold', after: null, offer: 'A shepherd wrings her hat between her hands. "Eleven gone in the night, and the dog came home alone with its tail down. They always head for Hollow Fields when they get out. There is something else out there lately. Could you look?"',
      steps: [{ text: 'Look for the strays at Hollow Fields', visit: 'hollow_fields' }], done: 'The shepherd counts eleven sheep, twice, and one very smug dog. She pays you in coin and wool and will not take no for either.', reward: { gold: 25 } },
    mill_lamps: { name: 'Lamps for the Mill', giver: 'general', at: 'duskwater_mill', after: null, offer: 'The miller\'s lamp oil has run out, and the mill has to grind through the night or the village\'s flour spoils in the damp. "Harrow Farms has a chandler. Fetch me oil, and quick. I will pay for the oil and for your legs."',
      steps: [{ text: 'Fetch lamp oil from Harrow Farms', visit: 'harrow_farms' }], done: 'The mill burns bright all night and the stones never stop. In the morning the miller sends you off with a warm loaf and flour on both your shoulders where he clapped them.', reward: { gold: 30 } },
    miller_son: { name: 'The Miller\'s Son', giver: 'general', at: 'duskwater_mill', after: 'mill_lamps', offer: 'The miller\'s son has gone off with a pedlar\'s girl, and the miller pretends he only wants his cart back. "Try Ploughman\'s Ford. Then ask about at the tavern in Wheatvale. Somebody will know." He looks at the floor. "Just tell me he is safe."',
      steps: [{ text: 'Check Ploughman\'s Ford', visit: 'ploughmans_ford' }, { text: 'Ask around the tavern at Wheatvale', tavern: 'wheatvale' }], done: 'The boy is well, married at Wheatvale and not coming home. The miller is quiet for a long time. Then he sighs, pays you, and asks whether the girl seemed kind.', reward: { gold: 40, standing: { crown: 10 } } },
    poachers: { name: 'Poachers at the Ford', giver: 'general', at: 'wheatvale', after: null, offer: 'A farmer\'s wife points at a line of snares along the hedge. "The Lord\'s own hares. If he finds them gone, it is the village that pays the fine, not the poachers. And the Lord\'s own men are afraid to go near the camp at Ploughman\'s Ford."',
      steps: [{ text: 'Drive the poachers from Ploughman\'s Ford', flag: 'job_poachers_won' }], done: 'The snares are cut and the camp is empty. The farmer\'s wife gives you what she can spare and says the Lord will never know how close the village came to paying.', reward: { gold: 60, standing: { crown: 15 } } },
    peddlers_trail: { name: 'The Peddler\'s Trail', giver: 'general', at: 'crownwatch_inn', after: null, offer: 'The innkeeper says a pedlar skipped without paying and left a pack of strange tin trinkets behind as security. "Tobb, he calls himself. He drinks at Pilgrim\'s Well or Herald\'s Cross. Ask in the taverns. If you hear where he went, I want to know."',
      steps: [{ text: 'Ask after him at the tavern in Pilgrim\'s Well', tavern: 'pilgrims_well' }, { text: 'Ask after him at the tavern in Herald\'s Cross', tavern: 'heralds_cross' }], done: 'Tobb, it turns out, is good for the money and a long way down the road. The innkeeper pays you for the trouble.', reward: { gold: 25 } },
    fair_price: { name: 'A Fair Price', giver: 'general', at: 'stonebridge', after: null, offer: 'A grain merchant lowers his voice. "Somebody is shorting the weights. A pound in twenty, at Mercers\' Row or the Grain Exchange, maybe both. A pound in twenty is a family\'s winter. Look at the scales and tell me which."',
      steps: [{ text: 'Check the scales at Mercers Row', visit: 'mercers_row' }, { text: 'Check the scales at the Grain Exchange', visit: 'grain_exchange' }], done: 'He thanks you for the report and does not say what he will do with it. In the River Cities, knowing is worth more than telling.', reward: { gold: 40, standing: { syndicate: 10 } } },
    barge_cargo: { name: 'Barge Cargo', giver: 'general', at: 'barge_landing', after: null, offer: 'A bargemaster scratches her head with the end of a pencil. A whole load of seed-grain went missing between the Gilded Ferry and Silt Wharf, and the farmers need it in the ground this month. "Walk the route and ask. Somebody saw something. Somebody always does."',
      steps: [{ text: 'Walk to Gilded Ferry', visit: 'gilded_ferry' }, { text: 'Walk on to Silt Wharf', visit: 'silt_wharf' }], done: 'The grain was never stolen. It was misdelivered to the wrong wharf by a clerk who could not read his own hand. She pays you, and then swears at the clerk for a long and educational time.', reward: { gold: 45, standing: { syndicate: 10 } } },
    cask_trouble: { name: 'Trouble at Cask Hollow', giver: 'general', at: 'weighhouse', after: null, offer: 'The weighhouse keeper jerks his thumb at the south road. "Somebody has taken the old brewery at Cask Hollow. Carts in at night, nothing out by day. I do not think they are brewing, and I do not think they are paying duty either."',
      steps: [{ text: 'Break up the smugglers at Cask Hollow', flag: 'job_cask_won' }], done: 'The keeper counts the cask-stamps you brought back and nods very slowly.', reward: { gold: 70, standing: { syndicate: 15 } } },
    toll_rats: { name: 'Rats in the Toll Cellars', giver: 'general', at: 'tollhouse_quay', after: null, offer: 'The quay-warden has had enough of the Old Toll Cellars. "Something big is nesting down there. The fishermen hear it at night, under the boards, and two of them have stopped coming to work. Clear the place and I will make it worth your while."',
      steps: [{ text: 'Clear the Old Toll Cellars', clear: 'old_toll_cellars' }], done: 'The quay goes quiet at night. The warden digs a small purse and a charm out of a drawer.', reward: { gold: 130, items: { healer_locket: 1 }, standing: { syndicate: 15 } } },
    marches_scout: { name: 'Watching the Marches', giver: 'general', at: 'wayfarers_rest', after: null, offer: 'An innkeeper with a veteran\'s limp wants word from the border posts. "Greywatch, and the Marchwarden\'s Post. I want to know who is on the walls, and how many. Something is building past the border, and the Crown is not telling us anything."',
      steps: [{ text: 'Visit Greywatch Post', visit: 'greywatch_post' }, { text: 'Visit Marchwardens\' Post', visit: 'marchwardens_post' }], done: 'He listens, draws a little map in spilled ale, and nods. "That is about what I feared."', reward: { gold: 40, standing: { crown: 10 } } },
    gallows_gossip: { name: 'Gallows Hill Gossip', giver: 'general', at: 'ragged_fence', after: null, offer: 'A hedge-priest sits on the fence rail and mutters to nobody in particular. "There is a camp on Gallows Hill and nobody will say whose. Ask around at the tavern in Wayfarer\'s Rest, then go and look. Do not go up there first. Nobody comes down who goes up there first."',
      steps: [{ text: 'Ask around the tavern at Wayfarer\'s Rest', tavern: 'wayfarers_rest' }, { text: 'Look at Gallows Hill', visit: 'gallows_hill' }], done: 'He nods and mutters something that might be a blessing, or a plan.', reward: { gold: 30 } },
    gallows_brigands: { name: 'The Brigands of Hobb\'s Reach', giver: 'general', at: 'ragged_fence', after: 'gallows_gossip', offer: 'The hedge-priest finally speaks plainly. "Brigands, a dozen of them, and they have taken the old road at Hobb\'s Reach. They charge my congregation to walk to their own fields. I would like the road back, and I would like them to stop."',
      steps: [{ text: 'Break the brigand camp at Hobb\'s Reach', flag: 'job_brigands_won' }], done: 'The fence-rail congregation cheers. The priest hands over what the road-tolls earned.', reward: { gold: 75, standing: { crown: 15 } } },
    cairn_offerings: { name: 'Cairn Offerings', giver: 'general', at: 'pilgrims_well', after: null, offer: 'A well-keeper presses a bundle of ribbons into your hands, each one tied by a different family. "Prayers for the ones who are not coming home. Half to Oath Cairn, half to Whitestone Abbey, before the first frost. My knees will not make it this year."',
      steps: [{ text: 'Leave the ribbons at Oath Cairn', visit: 'oath_cairn' }, { text: 'Leave the rest at Whitestone Abbey', visit: 'whitestone_abbey' }], done: 'The well-keeper cries a little and gives you what he saved.', reward: { gold: 35, standing: { synod: 10 } } },
    beacon_watch: { name: 'The Beacon Watch', giver: 'general', at: 'aldermere_hold', after: null, offer: 'A steward of Aldermere frowns at his ledgers. "The signal tower and Beacon Hill have both gone quiet, and Lord Osric has not told me why. I would like someone to go and look, and tell me nothing is wrong."',
      steps: [{ text: 'Visit the signal tower', visit: 'signal_tower' }, { text: 'Visit Beacon Hill', visit: 'beacon_hill' }], done: 'Nothing is wrong. Both towers are manned, by Osric\'s own men, under orders to light nothing for anyone but him. The steward thinks this is the most worrying thing he has heard all month.', reward: { gold: 45, standing: { crown: 10 } } }
  });
  C.jobsOf = st => st.world.jobs || (st.world.jobs = {});
  C.jobActive = (st, id) => { const j = C.jobsOf(st)[id]; return !!(j && j.state === 'active'); };
  C.jobDone = (st, id) => { const j = C.jobsOf(st)[id]; return !!(j && j.state === 'done'); };
  C.jobStepDone = (st, job, step, i) => step.flag ? !!st.world.flags[step.flag] : step.tavern ? !!(C.jobsOf(st)[job] && ((st.world.tavern || {})[step.tavern] >= C.jobsOf(st)[job].day)) : step.clear ? (() => { try { return !!C.dungeonStatus(st, step.clear).cleared; } catch (e) { return false; } })() : !!(C.jobsOf(st)[job] && (C.jobsOf(st)[job].seen || {})['s' + i]);
  C.jobReady = (st, id) => C.jobActive(st, id) && C.JOBS[id].steps.every((s, i) => C.jobStepDone(st, id, s, i));
  C.jobOffers = (st, at) => Object.entries(C.JOBS).filter(([id, j]) => j.at === at && !C.jobsOf(st)[id] && (!j.after || C.jobDone(st, j.after))).map(([id, j]) => Object.assign({ id }, j));
  C.jobReports = (st, at) => Object.entries(C.JOBS).filter(([id, j]) => j.at === at && C.jobReady(st, id)).map(([id, j]) => Object.assign({ id }, j));
  C.jobList = st => Object.entries(C.JOBS).filter(([id]) => C.jobsOf(st)[id]).map(([id, j]) => ({ id, name: j.name, giver: j.giver, at: j.at, state: C.jobsOf(st)[id].state, ready: C.jobReady(st, id), steps: j.steps.map((x, i) => ({ text: x.text, done: C.jobStepDone(st, id, x, i) })) }));
  C.acceptJob = function (st, id) {
    const j = C.JOBS[id]; if (!j || C.jobsOf(st)[id]) return { ok: false, reason: 'Not available' };
    if (st.world.location !== j.at) return { ok: false, reason: 'You are not there' };
    if (j.after && !C.jobDone(st, j.after)) return { ok: false, reason: 'Not yet' };
    C.jobsOf(st)[id] = { state: 'active', day: st.world.day, seen: {} };
    return { ok: true };
  };
  // After arriving: tick off 'visit' steps. Returns the names of steps just finished.
  C.jobCheck = function (st) {
    const out = [];
    Object.entries(C.JOBS).forEach(([id, j]) => { if (!C.jobActive(st, id)) return; const js = C.jobsOf(st)[id]; js.seen = js.seen || {};
      j.steps.forEach((x, i) => { if (x.visit && !js.seen['s' + i] && st.world.location === x.visit) { js.seen['s' + i] = 1; out.push({ job: j.name, step: x.text }); } }); });
    return out;
  };
  C.reportJob = function (st, id) {
    const j = C.JOBS[id]; if (!j || !C.jobReady(st, id)) return { ok: false, reason: 'Not finished' };
    if (st.world.location !== j.at) return { ok: false, reason: 'Report to them in person' };
    const R = j.reward || {}, changes = []; C.jobsOf(st)[id].state = 'done'; C.jobsOf(st)[id].doneDay = st.world.day;
    if (R.gold) st.inventory.gold += R.gold;
    for (const [k, n] of Object.entries(R.items || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
    C.queueLetter(st, id); C.lore(st, 'job_done:' + id);
    for (const [f, d] of Object.entries(R.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: 'Job: ' + j.name.slice(0, 18) }));
    const found = []; (R.reveal || []).forEach(d => { const r = C.reveal(st, d); if (r && r.ok) found.push(C.NODES[d].name); });
    return { ok: true, gold: R.gold || 0, items: R.items || null, changes, found, text: j.done };
  };

  // ---- taverns: rumours, overheard talk, hints and small choices ----
  // A tavern stands in every town, village, market and capital. One visit a day per tavern, for a few coins. Scenes are seeded by place, day and visit count, so reloading does not reroll them.
  // Kinds: rumour (reveals a hidden place nearby, or points at a job), overheard (faction squabbles that follow the relations as they shift, and gossip about what you did), hint (dungeon levels, rules of the road) and choice (take a side, buy a round).
  C.TAVERN = { cost: 3, types: ['town', 'village', 'market', 'capital'], weights: { rumour: 30, overheard: 40, hint: 16, whisper: 9, choice: 14 } };
  C.TV_PEOPLE = {
    any: ['a drover with mud to the knee', 'a ferrywoman nursing one cup', 'a one-eyed carter', 'two off-duty guards', 'a tinker counting coins', 'a widow with a ledger', 'a young priest at the corner table', 'a poet who is not sober', 'a cooper wiping his hands', 'a sellsword past her prime'],
    crownlands: ['a tithe clerk', 'a retired halberdier', 'a steward on his day off'], free_marches: ['a woodcutter', 'a trapper with a pelt over one shoulder', 'a bargeman'],
    river_cities: ['a lock-keeper', 'a dockhand', 'a chandler with rope burns'], voldun: ['a gaunt miller', 'a pilgrim with ink on her fingers', 'a gravedigger'],
    elven_realms: ['a leaf-cloaked scout', 'a herbalist', 'a long-limbed archer who does not drink'], dwarven_holds: ['a soot-faced miner', 'a stonemason', 'a bearded clerk with a chisel'],
    iceflow: ['a whaler', 'a fur-trader', 'a ferryman who has seen the ice break'], orc_lands: ['a scarred drover', 'a quarry boss', 'a clan courier'], goblin_fens: ['a reed-cutter', 'a mud-spattered runner', 'a toothy barkeep']
  };
  C.TV_TALK = { // pride: what its friends say; sore: what its critics say
    crown: ['The Crown keeps the roads open and the toll barns full.', 'The Crown takes the grain twice, once as tithe and once as a "loan".', 'The Crown sends a sergeant when you are robbed. Eventually.', 'Twelve years without a king and the roads still work. Say what you like about the lords.'],
    syndicate: ['The Syndicate paid for the new bridge when the Crown could not.', 'The Syndicate lends you a coin and owns your well.', 'A Syndicate receipt is the only promise in this realm anybody keeps.', 'They never lie. They just write the truth very small.'],
    synod: ['The Synod fed half this town through the bad winter.', 'The Synod writes down what you confess and never forgets it.', 'The wards on the well are Synod work. Nobody has drowned in it since.', 'My cousin went to Vol\'Dun to be registered. That was four years ago.'],
    ivory: ['The Spire\'s mages mended our well-water in a night.', 'The Spire answers a question with a longer question.'],
    canopy: ['The Wardens keep the old trees standing.', 'The Wardens call an axe handle a crime.'],
    matriarchy: ['The Matriarchy has never lost a debt owed to it.', 'Nobody has seen a Matriarchy envoy smile or leave a debt unpaid.'],
    cabal: ['The Cabal knows what the Matriarchy would rather it did not.', 'The Cabal pays in secrets, and secrets do not buy bread.'],
    envoys: ['The Envoys trade fair, even with those who spat at them.', 'The Envoys come up from the dark with new prices every spring.'],
    ironbound: ['Ironbound oaths are cut in stone and kept.', 'An Ironbound clansman holds a grudge longer than a mountain holds snow.'],
    anvil: ['The Anvil guild made the tools that built this town.', 'The Anvil would mine a grave if the ore ran true.'],
    blood_iron: ['The Legion\'s champions earned every scar.', 'The Legion counts a village as a supply depot.'],
    ash_speakers: ['The Ash-Speakers remember what the Legion burned.', 'The Ash-Speakers talk to cinders and call it counsel.'],
    bilge_rats: ['The Cartel gets cargo through where the Crown\'s seals cannot.', 'The Cartel\'s tunnels keep opening under people\'s cellars.'],
    mire_born: ['The Mire-Born know every drowned path in the fens.', 'The Mire-Born took the old causeway and call it a tax.'],
    seraphic: ['The Seraphic Host stood on the wall the night the sky broke.', 'The Host judges before it listens.'],
    dawn: ['The Choir sings the wounded back to health.', 'The Choir\'s hymns stop at a sinner\'s door.'],
    vigilant: ['The Vigilant never sleep on a watch.', 'The Vigilant watch everything, you included.'],
    cinder: ['The Cinder-Crown pays its soldiers in iron and truth.', 'The Cinder-Crown\'s truth comes with a brand.'],
    whisper: ['The Whisper-Pact always keeps the letter of a bargain.', 'The Whisper-Pact keeps the letter and takes the rest.'],
    reavers: ['The Reavers laugh at walls.', 'The Reavers laugh at the walls and then at what is behind them.'],
    broken_banner: ['The Broken Banner still fights for the soldiers the Crown forgot.', 'The Broken Banner robs a cart and calls it a levy.', 'When the raiders came, it was the Banner rode in. Not the Crown.'],
    hearthwatch: ['The Hearthwatch lets a hunted man sleep.', 'The Hearthwatch asks nothing, and that is what worries me.', 'Mother Agathe has buried more people than the plague. Some of them twice, they say.'],
    outlaws: ['The roadmen out in the wild take no side but their own.', 'A raider is a raider whatever flag he once flew.']
  };
  C.TV_PAIRS = { // hand-written squabbles for the old rivalries (key: a|b, either order)
    'crown|syndicate': [[['The Crown built these roads.', 'And the Syndicate keeps the carts on them. Who pays for that?'], ['Everyone pays the Crown.', 'Everyone pays the Syndicate too, and gets a receipt.'], ['Then why do both of them fill my cellar with sealed crates?', null]],
      [['They say the Syndicate bought the old tollhouse.', 'The Crown sold it to them.'], ['The Crown sold what it should have kept.', 'The Crown sold what it could not afford to keep. There is a difference.']]],
    'synod|syndicate': [[['The Synod fed this town when the Syndicate raised the price of flour.', 'The Synod fed it on borrowed flour. Guess whose.'], ['Charity with a ledger behind it is still charity.', 'Then the chantry bell is a debt-bell.']],
      [['A Syndicate factor was in the chantry again.', 'Paying for a roof, I heard.'], ['A roof with his name carved on it.', 'Better his name than a hole.']]],
    'ironbound|anvil': [[['An Ironbound hold never sold a mountain.', 'An Ironbound hold never built a road either.'], ['The Anvil digs where the clans bury their dead.', 'Then the clans should bury them somewhere less rich.']]],
    'blood_iron|ash_speakers': [[['The Legion wins, and the ashes follow.', 'The ashes remember, and the Legion forgets.'], ['Say that outside.', 'I will. Out loud. Where the cinders can hear.']]],
    'bilge_rats|mire_born': [[['The Cartel dug under the old causeway.', 'The causeway was ours before it was anybody\'s.'], ['Ours, theirs. The tunnel pays whoever holds the lamp.', 'Then hold your lamp somewhere the water cannot reach.']]],
    'canopy|crown': [[['The Crown wants timber for ships.', 'The Wardens want the Crown\'s axemen out of the wood.'], ['A tree is a tree.', 'Not to the ones who planted it.']]]
  };
  C.TV_GOSSIP = [ // talk about you; each is told once
    { id: 'g_fight', if: st => !!st.world.flags.g_fight, lines: ['Somebody put the debt-collectors in the ditch out at the Golden Reach.', 'A hero or a thief, depending who you ask. Three in the party, I heard.'] },
    { id: 'toll', if: st => C.jobDone(st, 'toll_road'), lines: ['The Tithe Barn road is open again. The sergeants are telling it like they did it.', 'It was a stranger with a small party. The sergeants would rather you forgot.'] },
    { id: 'debt', if: st => C.jobDone(st, 'pennant_debt'), lines: ['The Pennant Green farmer paid up in the end.', 'Nobody asked how. That is how the Syndicate likes it.'] },
    { id: 'letter', if: st => C.jobDone(st, 'sealed_letter'), lines: ['The clerks at Orchard Row swear the pilgrim\'s seal was never broken.', 'Funny. They swear it a little too hard.'] },
    { id: 'barrow', if: st => C.jobDone(st, 'barrow_whispers'), lines: ['They say the steward at Crown Keep has gone grey since he sent a stranger to the Barrow.', 'Lights in a tomb. I would go grey too.'] },
    { id: 'cellar', if: st => C.jobDone(st, 'cellar_ledger'), lines: ['The Syndicate\'s factor is smiling again, and it is not the nice kind.', 'Folk have stopped walking past Applecourt after dark.'] },
    { id: 'mage', if: st => C.jobDone(st, 'hedge_mage'), lines: ['The hedge-mage left Pale Vigil in a hurry.', 'The chantry clerks are not saying why. The chantry clerks are always saying why.'] },
    { id: 'hostile', if: st => Object.keys(window.GAME_DATA.factions).some(f => f !== 'outlaws' && S().standingTier(st, f).id === 'hostile' && S().isMet(st, f)), lines: st => ['There are notices up in the next town. Somebody matching a party like yours.', 'Said nothing, did I? Not yet.'] },
    { id: 'sworn', if: st => !!st.factions.allegiance, lines: st => ['Is that ' + C.tvName(st.factions.allegiance) + ' colours on that one?', 'It is. Mind your tongue about them tonight.'] },
    { id: 'dungeon', if: st => Object.keys(C.DUNGEONS).some(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }), lines: ['They say somebody walked out of the dark under the hills and came back with their pockets full.', 'And their party in one piece. That is the strange part.'] }
  ];
  C.TV_HINTS = [
    'Whoever holds the high ground shoots farther. Put your archers on the hill and let them come up to you.',
    'A Rogue can climb two steps where others climb one. There is not a cliff in the world that stops a good one.',
    'Shopkeepers charge you more the less they like you, and stop talking to you at all if it gets bad enough.',
    'If a faction puts a price on your head, the Syndicate will take coin to look away, and the Hearthwatch will take penance.',
    'Some places, trouble finds you. The word is on the map. Walk in and out a few times and you will see.',
    'Rest at a Hearthwatch sanctuary and old trails go cold. They ask nothing in return.',
    'The deeper floors of a dungeon pay more, but if you lose, you start over from the top. Know when to leave.',
    'Do not fight a dungeon far above your level; the people with the money say it is not worth the ride.'
  ];
  C.tvName = f => { const F = window.GAME_DATA.factions[f], n = F ? F.name : f; return /^the /i.test(n) ? n : 'the ' + n; };
  const tvRng = seed => { let a = 7; for (const c of seed) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const tvPick = (r, a) => a[Math.floor(r() * a.length)];
  C.hasTavern = id => !!(C.NODES[id] && C.TAVERN.types.includes(C.NODES[id].type));
  C.tavernState = function (st, id, sv) {
    if (!C.hasTavern(id)) return null;
    sv = sv || C.nodeServices(st, id); if (!sv || !sv.open || sv.besieged) return null;
    const w = st.world.tavern || {};
    return { cost: C.calendar(st.world.day).festival ? 0 : C.TAVERN.cost, doneToday: w[id] === st.world.day };
  };
  // hops from here to each place (hidden places included), for "nearby" rumours
  function tvDist(from) { const d = { [from]: 0 }, q = [from]; while (q.length) { const x = q.shift(); Object.keys((C.NODES[x] || { links: {} }).links).forEach(y => { if (d[y] === undefined) { d[y] = d[x] + 1; q.push(y); } }); } return d; }
  function tvJobGated() { const s = new Set(); Object.values(C.JOBS).forEach(j => ((j.reward || {}).reveal || []).forEach(d => s.add(d))); return s; }
  function tvRumour(st, id, r) {
    const dist = tvDist(id), gated = tvJobGated(), out = [];
    const hid = Object.keys(C.NODES).filter(k => C.NODES[k].hidden && !st.world.flags['reveal_' + k] && !gated.has(k) && dist[k] !== undefined && dist[k] <= 3);
    const told = st.world.tvSeen || (st.world.tvSeen = {}), jobs = Object.entries(C.JOBS).filter(([k, j]) => !told['job_' + k] && !C.jobsOf(st)[k] && j.at !== id && C.isDiscovered(st, j.at) && (!j.after || C.jobDone(st, j.after)));
    const opts = []; if (hid.length) opts.push('place'); if (jobs.length) opts.push('job'); if (!opts.length) return null;
    const who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any)), kind = tvPick(r, opts);
    if (kind === 'job') { const [k, j] = tvPick(r, jobs); told['job_' + k] = 1; return { kind: 'rumour', title: 'A rumour', lines: [{ who, text: j.giver === 'general' ? 'I hear folk at ' + C.NODES[j.at].name + ' need a hand with something. Honest work, modest pay.' : 'I hear ' + C.tvName(j.giver) + ' have work going at ' + C.NODES[j.at].name + '. Quiet work, the paying kind.' }], found: [] }; }
    const t = tvPick(r, hid), n = C.NODES[t]; C.reveal(st, t);
    const d = C.DUNGEONS[t], text = d ? n.name + '. ' + n.desc + ' Folk say it is level ' + d.rec + ' work, and no kinder.' : 'Have you heard of ' + n.name + '? ' + n.desc;
    return { kind: 'rumour', title: 'A rumour', lines: [{ who, text }], found: [n.name], narr: n.name + ' is now on your map.' };
  }
  function tvPool(st, id) { // factions the talk can name: the local owner, those you have met, and owners of nearby places
    const s = new Set(), o = C.ownerOf(st, id) || C.NODES[id].faction; if (o && window.GAME_DATA.factions[o]) s.add(o);
    Object.keys(window.GAME_DATA.factions).forEach(f => { if (S().isMet(st, f)) s.add(f); }); const dist = tvDist(id);
    Object.keys(C.NODES).forEach(k => { if (dist[k] !== undefined && dist[k] <= 2) { const f = C.ownerOf(st, k) || C.NODES[k].faction; if (f && window.GAME_DATA.factions[f]) s.add(f); } });
    if (['crown', 'syndicate', 'synod'].includes(o)) ['crown', 'syndicate', 'synod'].forEach(f => s.add(f)); // the starting country always has its three powers in the room
    ['outlaws', 'hearthwatch'].forEach(f => s.delete(f)); return [...s].filter(f => C.TV_TALK[f]);
  }
  function tvSquabble(st, id, r) {
    const pool = tvPool(st, id), pairs = [], own = C.ownerOf(st, id);
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) { const a = pool[i], b = pool[j], rel = (S().getRelation(st, a, b) + S().getRelation(st, b, a)) / 2; if (rel <= -0.25) pairs.push({ a, b, rel, w: (-rel * 10 + (C.TV_PAIRS[a + '|' + b] || C.TV_PAIRS[b + '|' + a] ? 6 : 0) + [a, b].reduce((t, f) => t + (f === own ? 6 : 0) + (S().isMet(st, f) ? 4 : 0), 0)) / (1 + ((st.world.tvSeen || {})['p_' + a + '|' + b] || 0) * 1.5) }); }
    if (!pairs.length) return null;
    let tot = pairs.reduce((s, p) => s + p.w, 0), x = r() * tot, p = pairs[0]; for (const q of pairs) { x -= q.w; if (x <= 0) { p = q; break; } }
    const reg = C.NODES[id].region, pe = C.TV_PEOPLE[reg] || [], s1 = tvPick(r, pe.concat(C.TV_PEOPLE.any)); let s2 = tvPick(r, C.TV_PEOPLE.any); if (s2 === s1) s2 = 'a stranger at the bar';
    const sn = st.world.tvSeen || (st.world.tvSeen = {}); sn['p_' + p.a + '|' + p.b] = (sn['p_' + p.a + '|' + p.b] || 0) + 1;
    const hv = C.TV_PAIRS[p.a + '|' + p.b] || C.TV_PAIRS[p.b + '|' + p.a], cnt = sn['p_' + p.a + '|' + p.b], hand = hv && cnt <= hv.length ? hv[cnt - 1] : null, lines = [];
    if (hand) { hand.forEach(ex => ex.forEach(t => { if (t) lines.push({ who: lines.length % 2 ? s2 : s1, text: t }); })); }
    else { const A = C.TV_TALK[p.a], B = C.TV_TALK[p.b], shape = Math.floor(r() * 3);
      if (shape === 0) lines.push({ who: s1, text: A[0] }, { who: s2, text: A[1] }, { who: s1, text: tvPick(r, ['Say that again.', 'Watch your mouth.', 'Not in here, friend.']) });
      else if (shape === 1) lines.push({ who: s2, text: B[0] }, { who: s1, text: B[1] }, { who: s2, text: tvPick(r, ['You would say that.', 'Ask anyone.', 'Drink your drink.']) });
      else lines.push({ who: s1, text: A[0] }, { who: s2, text: A[1] }, { who: s1, text: B[1] }, { who: s2, text: B[0] }); }
    let narr = tvPick(r, ['The barkeep sets a jug between them and the heat goes out of it, for now.', 'Somebody starts a song to drown them out. It nearly works.', 'They are still at it when you finish your cup.']);
    const base = (window.GAME_DATA.factions[p.a].relations || {})[p.b] || 0, now = S().getRelation(st, p.a, p.b);
    if (now - base >= 0.15) narr = 'It was not always this friendly between them. Folk say it has been thawing.'; else if (base - now >= 0.15) narr = 'It was not always this bitter between them. It is now.';
    return { kind: 'overheard', title: 'Overheard', lines, narr, pair: [p.a, p.b] };
  }
  function tvGossip(st, r) {
    const seen = st.world.tvSeen || (st.world.tvSeen = {}), ok = C.TV_GOSSIP.filter(g => !seen[g.id] && g.if(st)); if (!ok.length) return null;
    const g = tvPick(r, ok), ls = typeof g.lines === 'function' ? g.lines(st) : g.lines; seen[g.id] = 1;
    return { kind: 'overheard', title: 'Overheard', lines: ls.map((t, i) => ({ who: i ? 'the other' : 'a patron', text: t })), narr: 'They stop when they notice you looking.' };
  }
  function tvHint(st, id, r) {
    const ds = Object.keys(C.DUNGEONS).filter(d => C.isDiscovered(st, d) && !(() => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } })());
    const who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any));
    if (ds.length && r() < 0.5) { const d = C.DUNGEONS[tvPick(r, ds)]; return { kind: 'hint', title: 'A word of advice', lines: [{ who, text: d.name + '? Go in at level ' + d.rec + ' or not at all. ' + (d.why || '') }] }; }
    const sn = st.world.tvSeen || (st.world.tvSeen = {}); let fresh = C.TV_HINTS.filter((h, i) => !sn['h' + i]); if (!fresh.length) { C.TV_HINTS.forEach((h, i) => delete sn['h' + i]); fresh = C.TV_HINTS; } const h = tvPick(r, fresh); sn['h' + C.TV_HINTS.indexOf(h)] = 1;
    return { kind: 'hint', title: 'A word of advice', lines: [{ who, text: h }] };
  }
  function tvChoice(st, id, r, sq) {
    const owner = C.ownerOf(st, id), kinds = ['round', 'news']; if (sq && sq.pair) kinds.push('side', 'side');
    const k = tvPick(r, kinds);
    if (k === 'side') { const [a, b] = sq.pair, A = C.tvName(a), B = C.tvName(b); return { id: 'side', text: 'The argument turns to you. "Well? Whose side are you on?"', options: [
      { id: 'a', label: 'Back ' + A, hint: A.charAt(0).toUpperCase() + A.slice(1) + ' will remember it. So will ' + B + '.', standing: { [a]: 15, [b]: -10 }, relations: [[a, b, -0.05, true]] }, { id: 'b', label: 'Back ' + B, hint: B.charAt(0).toUpperCase() + B.slice(1) + ' will remember it. So will ' + A + '.', standing: { [b]: 15, [a]: -10 }, relations: [[a, b, -0.05, true]] },
      { id: 'calm', label: 'Buy them both a drink (15 gold)', hint: 'Nobody wins. Everybody is a little grateful.', gold: -15, standing: { [a]: 5, [b]: 5 }, relations: [[a, b, 0.05, true]] }, { id: 'out', label: 'Stay out of it' }] }; }
    if (k === 'news') return { id: 'news', text: 'The keeper wipes a cup and watches you. "I hear more than I say. Fifteen gold says more."', options: [{ id: 'pay', label: 'Pay for news (15 gold)', hint: 'Fifteen gold for something worth hearing.', gold: -15, rumour: true }, { id: 'no', label: 'No, thanks' }] };
    return { id: 'round', text: 'A song starts up. The table looks hopefully at your purse.', options: [{ id: 'buy', label: 'Buy a round (20 gold)', hint: 'A warm table and loose tongues. The place remembers a generous stranger.', gold: -20, standing: owner && C.TV_TALK[owner] ? { [owner]: 10 } : {}, rumour: true }, { id: 'no', label: 'Hum along and keep your coin' }] };
  }
  C.tavernVisit = function (st, id) {
    if (st.world.location !== id) return { ok: false, reason: 'You are not there' };
    const ts = C.tavernState(st, id); if (!ts) return { ok: false, reason: 'No tavern open here' };
    if (ts.doneToday) return { ok: false, reason: 'You have had your fill here today' };
    if (st.inventory.gold < ts.cost) return { ok: false, reason: 'You cannot afford a cup (' + ts.cost + ' gold)' };
    st.world.tavern = st.world.tavern || {}; st.world.tvCount = (st.world.tvCount || 0) + 1; st.world.tavern[id] = st.world.day; st.inventory.gold -= ts.cost;
    const r = tvRng(id + '|' + st.world.day + '|' + st.world.tvCount), recent = st.world.tvRecent || (st.world.tvRecent = []), W = C.TAVERN.weights;
    const kinds = Object.keys(W).filter(k => k !== 'choice'); let sc = null, sq = null;
    const first = st.world.tvCount === 1; const order = []; const bag = kinds.slice(); // weighted draw without the kind used last time
    while (bag.length) { const tot = bag.reduce((s, k) => s + W[k] * (k === recent[recent.length - 1] ? .3 : 1), 0); let x = r() * tot, ch = bag[0]; for (const k of bag) { x -= W[k] * (k === recent[recent.length - 1] ? .3 : 1); if (x <= 0) { ch = k; break; } } order.push(ch); bag.splice(bag.indexOf(ch), 1); }
    if (first) order.unshift('rumour');
    for (const k of order) {
      if (k === 'rumour') sc = tvRumour(st, id, r); else if (k === 'whisper') sc = tvWhisper(st, id, r); else if (k === 'overheard') { sc = (r() < 0.4 ? tvGossip(st, r) : null) || tvSquabble(st, id, r) || tvGossip(st, r); } else sc = tvHint(st, id, r);
      if (sc) break;
    }
    if (!sc) sc = tvHint(st, id, r);
    if (sc.pair) { sq = sc; const pr = sc.pair.slice().sort().join('|'); C.lore(st, 'squab:' + pr); sc.pair.forEach(f => { C.learn(st, 'tv_' + f + '_p', 'Overheard in a tavern'); C.learn(st, 'tv_' + f + '_s', 'Overheard in a tavern'); }); }
    recent.push(sc.kind); if (recent.length > 4) recent.shift();
    st.world.tvPending = null;
    if (r() * 100 < W.choice && sc.kind !== 'rumour') { const ch = tvChoice(st, id, r, sq); sc.choice = { id: ch.id, text: ch.text, options: ch.options.map(o => ({ id: o.id, label: o.label, hint: o.hint || null })) }; st.world.tvPending = { id: ch.id, options: ch.options, at: id }; }
    return { ok: true, scene: sc, cost: ts.cost };
  };
  C.tavernChoose = function (st, optId) {
    const p = st.world.tvPending; if (!p) return { ok: false, reason: 'Nothing to decide' };
    const o = p.options.find(x => x.id === optId); if (!o) return { ok: false, reason: 'Unknown option' };
    if (o.gold < 0 && st.inventory.gold < -o.gold) return { ok: false, reason: 'Not enough gold' };
    const changes = []; for (const [f, d] of Object.entries(o.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: 'Tavern talk' }));
    if (o.gold) st.inventory.gold += o.gold; for (const [a, b, d, both] of o.relations || []) S().shiftRelation(st, a, b, d, { both });
    let found = []; if (o.rumour) { const r = tvRng(p.at + '|' + st.world.day + '|' + st.world.tvCount + '|c'), rr = tvRumour(st, p.at, r); if (rr) found = rr.found; var rumour = rr; }
    st.world.tvPending = null; return { ok: true, changes, found, rumour: rumour || null, gold: o.gold || 0 };
  };

  // ---- a living world: seasons and festivals, place events, arrival lines, notice boards, rotating shops, recurring people, road sights and letters ----
  // Everything here is derived from the day number and the place (no saved state beyond who you have met and the letters in the post), so it costs nothing to keep and reloading never changes it.
  const hsh = s => { let a = 2166136261; for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); } return (a >>> 0); };
  const hpick = (a, s) => a[hsh(s) % a.length];
  C.SEASONS = [{ id: 'thaw', name: 'Thaw', fest: 'the Sowing Fair' }, { id: 'sun', name: 'High Sun', fest: 'the Sunwake Fair' }, { id: 'glean', name: 'Gleaning', fest: 'Harvest Home' }, { id: 'frost', name: 'Frostfall', fest: 'Longnight' }];
  C.calendar = function (day) { const y = Math.floor(day / 120), d = day % 120, s = Math.floor(d / 30), n = d % 30; return { season: C.SEASONS[s], dayOfSeason: n + 1, year: y + 1, festival: n === 14 ? C.SEASONS[s].fest : null, festivalIn: n < 14 ? 14 - n : null }; };
  C.EVENT_KINDS = {
    boom: { name: 'Market boom', mult: 0.9, line: 'Stalls are packed and prices are soft; everyone is trying to sell.' },
    shortage: { name: 'Shortage', mult: 1.12, line: 'Shelves are bare in places and the sellers know it.' },
    fair: { name: 'Travelling fair', mult: 1, line: 'A fair has rolled in: jugglers, a bear on a chain, and a queue for pies.' },
    scare: { name: 'Raid scare', mult: 1, line: 'Shutters are half closed. Someone saw riders on the ridge last night.' },
    mourning: { name: 'Mourning', mult: 1, line: 'Black ribbons hang on the doors. Voices are low.' }
  };
  C.placeEvent = function (st, id) {
    const n = C.NODES[id]; if (!n || !['town', 'village', 'market', 'hamlet', 'capital'].includes(n.type)) return null;
    const day = st.world.day, per = Math.floor(day / 6), h = hsh(id + '|ev|' + per);
    if (h % 100 >= 14) return null;
    const kind = ['boom', 'shortage', 'fair', 'scare', 'mourning'][(h >>> 8) % 5];
    return Object.assign({ id: kind, until: (per + 1) * 6 }, C.EVENT_KINDS[kind]);
  };
  C.shopMult = function (st, id) { const e = C.placeEvent(st, id), cal = C.calendar(st.world.day); let m = e ? e.mult : 1; if (cal.festival && ['town', 'market', 'capital'].includes(C.NODES[id].type)) m *= 0.9; return m; };
  const SHOP_POOL = () => { const s = new Set(); Object.values(C.NODES).forEach(n => (n.shop || []).forEach(g => s.add(g))); return [...s].sort(); };
  C.rotateStock = function (st, id, base) { // a few things sell out or turn up as the days pass; changes every four days
    const per = Math.floor(st.world.day / 4), out = base.slice(), notes = []; if (!base.length) return { stock: out, notes };
    if (base.length >= 3 && hsh(id + '|out|' + per) % 3 === 0) { const g = out.splice(hsh(id + '|o2|' + per) % out.length, 1)[0]; notes.push({ out: g }); }
    if (hsh(id + '|ped|' + per) % 100 < 40) { const pool = SHOP_POOL().filter(g => !out.includes(g) && !base.includes(g)); if (pool.length) { const g = pool[hsh(id + '|p2|' + per) % pool.length]; out.push(g); notes.push({ pedlar: g }); } }
    return { stock: out, notes };
  };
  C.TV_ARRIVE = {
    type: {
      town: ['Smoke from a hundred chimneys, and a market bell somewhere.', 'Carts jam the main street and nobody is giving way.', 'A town crier clears his throat and thinks better of it.', 'Dogs, children and a very patient mule hold the square.'],
      village: ['A handful of roofs and one very loud rooster.', 'Washing flaps between the houses and children stop to stare.', 'The well has a queue, and the queue has opinions.', 'Someone is mending a fence and talking the whole time.'],
      hamlet: ['A few houses and a lot of sky.', 'A single lamp burns in a window, though it is not yet dusk.', 'The place smells of woodsmoke and wet straw.', 'Nobody is about, but a kettle is steaming.'],
      castle: ['Banners hang limp above the gate and the guards look you over twice.', 'Boots echo on the wall walk. Somebody is always watching.', 'The portcullis is half raised, as if the place is making up its mind.', 'A drill sergeant\'s voice carries over the yard.'],
      market: ['Stalls pressed so tight a cat would have to turn sideways.', 'Haggling rises and falls like surf.', 'A scale clinks. A scale always clinks.', 'Every second voice is shouting a price.'],
      capital: ['Bells, banners and too many people for the streets.', 'The great hall\'s shadow falls across the whole square.', 'Messengers sprint past in three different liveries.', 'Even the beggars look like they have opinions about policy.'],
      poi: ['The place is quiet in a way that feels deliberate.', 'Old stone, older stories.', 'Something here has been left alone for a long time.', 'Wind finds every gap in the ruin and whistles through it.'],
      zone: ['The land feels watchful.', 'Tracks cross the path, none of them friendly.', 'Birds go quiet as you come in.', 'Nobody lives here. Nobody sensible, anyway.']
    },
    owner: {
      crown: ['The royal colours are everywhere, freshly pressed.', 'A tax notice flutters on the door post.', 'A sergeant in a clean tabard watches the road.'],
      syndicate: ['A ledger-clerk in every doorway.', 'Everything has a price tag, even the water trough.', 'The lamplighters wear Syndicate grey, and the lamps are bright.'],
      synod: ['A chantry bell rings the hour and everyone pauses.', 'Pilgrims shuffle through the streets, quiet and hungry.', 'A priest watches you pass and writes something down.'],
      hearthwatch: ['A lantern burns at every door, no matter the hour.', 'Nobody asks your name here. It is a relief.', 'The Hearthwatch have set a kettle on the green for any who need it.'],
      broken_banner: ['Patched cloaks, hard eyes, and a lot of old swords.', 'Someone is singing a marching song with the words changed.'],
      outlaws: ['Doors are barred, and a hard-faced man leans on the post and does not move.']
    },
    season: {
      thaw: ['Meltwater runs in every gutter.', 'The first green is coming through the mud.', 'Plough teams are out, and so are the mud-wrestling children.'],
      sun: ['Heat shimmers off the roofs.', 'Dust hangs in the air and every dog is flat in the shade.', 'The long evening light turns everything gold.'],
      glean: ['The smell of cut straw and cider on the wind.', 'Sheaves are stacked high against every wall.', 'Wagons groan under apples, grain and the occasional pig.'],
      frost: ['Breath hangs in the air and every chimney is working hard.', 'Frost has rimed the thatch and the water butt.', 'Folk are bundled to the eyes and not inclined to talk.']
    }
  };
  C.placeLine = function (st, id) {
    const n = C.NODES[id]; if (!n) return null; const day = st.world.day, cal = C.calendar(day), ev = C.placeEvent(st, id), T = C.TV_ARRIVE, seed = id + '|' + day;
    if (cal.festival && ['town', 'village', 'market', 'capital'].includes(n.type)) return 'It is ' + cal.festival + '. Ribbons on every post and music from every door.';
    if (ev && hsh(seed + 'e') % 3) return ev.line;
    const owner = C.ownerOf(st, id), pools = [].concat(T.type[n.type] || [], T.type[n.type] || [], T.type[n.type] || [], (T.owner[owner] || []).concat(T.owner[owner] || []), T.season[cal.season.id], T.season[cal.season.id]);
    return hpick(pools, seed);
  };
  C.noticeBoard = function (st, id) { // headlines from the real state of the world
    const n = C.NODES[id], out = [], dist = tvDist(id), cal = C.calendar(st.world.day);
    if (!['town', 'market', 'capital', 'castle'].includes(n.type)) return null;
    const own = C.ownerOf(st, id); if (own && window.GAME_DATA.factions[own]) out.push(C.tvName(own).replace(/^the /, 'The ') + ' holds this place and reminds all travellers of the road laws.');
    if (cal.festival) out.push(cal.festival[0].toUpperCase() + cal.festival.slice(1) + ' is today. Prices are lowered in the markets.'); else if (cal.festivalIn <= 6) out.push(cal.season.fest[0].toUpperCase() + cal.season.fest.slice(1) + ' is in ' + cal.festivalIn + ' day' + (cal.festivalIn > 1 ? 's' : '') + '. Stalls are being put up.');
    Object.keys(C.NODES).filter(k => dist[k] !== undefined && dist[k] <= 2 && k !== id).forEach(k => { const e = C.placeEvent(st, k); if (e && out.length < 5) out.push(e.name + ' at ' + C.NODES[k].name + ' until day ' + e.until + '.'); });
    const here = C.placeEvent(st, id); if (here) out.unshift(here.name + ' here until day ' + here.until + '. ' + here.line);
    const ov = st.factions && st.factions.relationOverrides || {}; Object.keys(ov).slice(-2).forEach(k => { const [a, b] = k.split('>'), base = (window.GAME_DATA.factions[a] && window.GAME_DATA.factions[a].relations || {})[b] || 0; if (Math.abs(ov[k] - base) >= 0.1 && a < b) out.push(ov[k] < base ? C.tvName(a).replace(/^the /, 'The ') + ' and ' + C.tvName(b) + ' are said to be at odds.' : C.tvName(a).replace(/^the /, 'The ') + ' and ' + C.tvName(b) + ' are said to be easing off.'); });
    Object.keys(C.DUNGEONS).filter(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }).slice(0, 1).forEach(d => out.push('Word is that ' + C.DUNGEONS[d].name + ' has been cleared. Adventurers are asking where the loot went.'));
    const open = Object.entries(C.JOBS).filter(([k, j]) => j.giver === 'general' && j.at === id && !C.jobsOf(st)[k] && (!j.after || C.jobDone(st, j.after)));
    open.forEach(([k, j]) => { (st.world.tvSeen = st.world.tvSeen || {})['job_' + k] = 1; out.push('WANTED: ' + j.name + '. Ask here.'); });
    if (!out.length) out.push('Nothing but a faded notice about stray dogs.');
    return out.slice(0, 5);
  };
  C.NPCS = {
    tobb: { name: 'Tobb the Pedlar', desc: 'a pedlar under a pack taller than he is', route: ['kingsway_cross', 'harrow_farms', 'rivermeet', 'heralds_cross', 'wheatvale', 'pennant_green', 'canalgate'],
      lines: ['"New face! Every face is a customer to Tobb. Mind the left strap, it bites. Tin rings, needles, a very nearly silver spoon. No? Tobb will see you again. Tobb sees everybody again."', '"You again! Good. Repeat customers live longest. Tobb has a theory about that, but it costs a copper."', '"I stopped counting miles years ago. I count faces. Yours I know. Crown faces are tired, Syndicate faces are counting, Synod faces are listening. Yours is still making up its mind."', '"A lord\'s man bought every tin ring Tobb had, last week. Said they were for a wedding. Tobb has sold rings to weddings. That was not a wedding. That was an army that wanted to look married."', '"Tobb\'s advice, free, once only: when the great folk start buying, sell. When they start borrowing, leave town."', '"Still here? Still buying? Tobb is touched. Tobb is also out of spoons."'],
      react: [{ if: st => C.jobDone(st, 'toll_road'), text: '"They say the Tithe Barn road is open. Tobb will be using it, so Tobb thanks you, and so do Tobb\'s feet."' }, { if: st => !!st.world.flags.g_fight, text: '"I saw the Golden Reach from the road. The ditch was full of debt-collectors. Bold! The Syndicate does not like its collectors in ditches. Tobb would buy you a drink, but Tobb would like to keep his customers."' }] },
    maren: { name: 'Sister Maren', desc: 'a travelling pilgrim with a patched Synod mantle', route: ['pennant_green', 'pilgrims_well', 'wheatvale', 'applecourt', 'millstream'],
      lines: ['"Peace on the road. Have you eaten? I have bread, and an opinion about everything, and I will give you both whether you want them or not."', '"The same road twice. Perhaps there is a reason. I was taught there always is. I am less sure than I was, but I still look for it."', '"I pray for the faces I know. You are on the list now, and you do not get a say." She breaks her bread in half. "The Synod says magic must be written down to be safe. I believed that for twenty years. Lately I have been counting the people who go to Vol\'Dun to be written down."', '"I have counted them now. Mages taken \'for questioning\' to Vol\'Dun. None of them come back. Not one, in all the years I have walked this road." She does not look at you. "But their books do. Their books stay."', '"I will tell you something I have told no one." Her voice is very low. "The Archon herself was a hedge-witch once. A girl the Hearthwatch hid from the inquisitors. She was hidden, and now she does the hunting. I do not know what to do with that."', '"Still walking. Still praying. Some days for the Synod, some days for the people it writes down. I hope those are the same prayer. I am no longer sure."', '"You look tired. Sit. Eat. The realm will still be broken in an hour."'],
      react: [{ if: st => C.jobDone(st, 'sealed_letter'), text: '"The Orchard Row clerks said a stranger carried my letter. I did not tell them I knew the stranger. Some things are safer unwritten. You see? I am learning."' }, { if: st => C.jobDone(st, 'hedge_mage'), text: '"I hear the healer has gone from Pale Vigil. I hope she is warm, wherever the road took her. Or wherever the Synod did."' }] },
    hask: { name: 'Corporal Hask', desc: 'a deserter in a coat that used to be a uniform', route: ['ragged_fence', 'gullsong', 'driftmoor_farm', 'hobbs_reach', 'wayfarers_rest'],
      lines: ['"Do not stare. I was a corporal once. Now I am a man who owns a coat, and the coat remembers more than I do."', '"Still alive, still walking. You look like you are on the same schedule." He spits. "They left us in the field, you know. Marrow Ford. The Crown is not a person. It is a debt nobody collects."', '"They keep asking what I know about the Marches. I keep not telling them." He looks at you for a long time. "There is a camp in the old forest, past the Marches. Outlaw\'s Rest. Men like me. If you ever need a friend nobody else will be, tell them Hask sent you."', '"Here is a thing I heard from a steward, drunk, at Wayfarer\'s Rest. The old king never named an heir. Never. And the seal on his Barrow door was set after he was dead, not before." He shrugs. "Means nothing to me. Means a great deal to somebody."', 'He has never told you the rest of it before. "At Marrow Ford the Banner held the rearguard so the army could cross. The Lord Marshal was supposed to send the signal to fall back. He never sent it. Voss. Bertrand Voss. We waited all night. He knew."', '"Do not look at me like that. It was eighteen years ago. The coat still remembers. So do I, on the bad days."', '"Still alive? Good. Somebody ought to be."'],
      react: [{ if: st => C.jobDone(st, 'toll_road'), text: '"You cleared the barn? I knew two of them. Do not tell me their names." He is quiet. "They were good once. Hunger is a bad sergeant."' }, { if: st => !!st.world.flags.marches_lost, text: '"The Marches have fallen and I am not even surprised. The Crown never sends enough. It never has."' }] },
    wen: { name: 'Old Wen', desc: 'a ferrywoman who has seen every river mood', route: ['gilded_ferry', 'barge_landing', 'silt_wharf', 'tollhouse_quay', 'brassbell'],
      lines: ['"If you are going downriver, pay first. If you are going up, pay double. The river does not care which, but I do."', '"Back again. The river knows you now. It is not impressed. Neither am I, but I take your coin the same."', '"Fifty years on the water. I have seen what comes up and I have seen what goes down. Grain goes down to the cities. Debt comes back up. Nobody ever ships it the other way."', '"There are two ledgers in the counting-houses, they say. One for us and one for them. I only ever see the first one. I pay into it every day."', '"Get in, sit down, do not rock the boat. That is the whole of my wisdom, and it has kept me alive."'],
      react: [{ if: st => Object.keys(C.DUNGEONS).some(d => { try { return C.dungeonStatus(st, d).cleared; } catch (e) { return false; } }), text: '"I hear somebody walked out of the old toll cellars with all their limbs. Whoever it was owes me a fare, and I will collect it."' }] },
    dov: { name: 'Dov Quill', desc: 'a thin Syndicate clerk with ink to the elbow', route: ['rivermeet', 'stonebridge', 'canalgate', 'mercers_row', 'low_docks'],
      lines: ['"Account name? No? Then you are an opportunity. Welcome." He writes something down. "Dov Quill. I keep the small books. Small books are where the big ones keep their secrets."', '"I remember a face the way I remember a debt: completely, and with interest."', '"You are on my list. Not the bad one. The other one. The longer one." He taps his nose with an inky finger. "Keep it that way and the Syndicate will be very generous. Stop, and it will still be very generous, to somebody else, with your things."', '"Every ledger in the Syndicate carries a tiny mark in the corner. Every one. The clerks cannot explain it, and the Factors do not try." He wipes his pen. "I have been trying for nine years. I think it is somebody\'s cipher. I think it is somebody who is not on any list at all."', '"Forget I said that. No, really. Forget it. I have a list of people who did not forget things, and it is a short list, and it is getting shorter."', '"Business as usual. Which is to say: everyone owes, and nobody is allowed to know who to."'],
      react: [{ if: st => C.jobDone(st, 'pennant_debt'), text: '"The Pennant Green account is closed. Somebody was very efficient." He looks at you over his spectacles. "Efficient is a compliment. Mostly."' }, { if: st => C.jobDone(st, 'cellar_ledger'), text: '"We found the ledger. Do not ask how. We would rather not say, and you would rather not know."' }] },
    ysolde: { name: 'Ysolde the Hedge-Singer', desc: 'a barefoot singer with a lute missing two strings', route: ['wheatvale', 'applecourt', 'sheepfold', 'millstream', 'duskwater_mill'],
      lines: ['"Free song, paid song, or silence. Silence costs the most, because nobody ever wants to hear it twice."', '"I wrote a verse about your last visit. It rhymes badly. The truth often does."', '"Every road has a song. Yours is just getting started, and I do not know the ending yet. Neither do you. That is the only kind worth singing."', '"I sang about the old king in Wheatvale and three men walked out. I sang about the Interval and the whole room went quiet. Interesting, what people cannot bear to hear."', '"Have a verse, free: \'The throne is empty, the lords are full, the roads are open, the purses are pulled.\' It needs work. So does the realm."'],
      react: [{ if: st => C.jobDone(st, 'barrow_whispers'), text: '"Lights in the Barrow. I have a verse for that. It scares the children, which is its job, and it scares the stewards, which is not."' }] }
  };
  C.npcAt = function (st, id) {
    const day = st.world.day, per = Math.floor(day / 3);
    return Object.entries(C.NPCS).filter(([k, p]) => { const r = p.route.filter(x => C.NODES[x]); return r.length && r[hsh(k + '|' + per) % r.length] === id; }).map(([k, p]) => ({ id: k, name: p.name, desc: p.desc, met: (st.world.npcMet || {})[k] || 0, talkedToday: (st.world.npcTalk || {})[k] === day }));
  };
  C.npcTalk = function (st, id, npcId) {
    const here = C.npcAt(st, id).find(n => n.id === npcId); if (!here) return { ok: false, reason: 'They are not here' }; if (here.talkedToday) return { ok: false, reason: 'You have already spoken today' };
    const p = C.NPCS[npcId], met = (st.world.npcMet = st.world.npcMet || {}), talk = (st.world.npcTalk = st.world.npcTalk || {}), n = met[npcId] || 0;
    const reacts = p.react.filter(r => r.if(st)), line = reacts.length && n > 0 && hsh(npcId + st.world.day) % 2 ? reacts[hsh(npcId + st.world.day + 'r') % reacts.length].text : p.lines[n < p.lines.length ? n : Math.max(0, p.lines.length - 2) + ((n - p.lines.length) % Math.min(2, p.lines.length))];
    met[npcId] = n + 1; talk[npcId] = st.world.day; C.lore(st, 'npc:' + npcId + ':' + (n + 1));
    const out = { ok: true, name: p.name, desc: p.desc, text: line, found: [], gold: 0, first: n === 0 };
    if (n >= 1 && n % 2 === 1) { const rr = tvRumour(st, id, tvRng(npcId + '|' + st.world.day + '|' + n)); if (rr) { out.tip = rr.lines[0].text; out.found = rr.found || []; } }
    if (n >= 3 && n % 3 === 0) { out.gold = 10 + n * 2; st.inventory.gold += out.gold; out.gift = 'They press a few coins into your hand. "For the road."'; }
    return out;
  };
  C.ROAD_SIGHTS = [
    'A burnt-out cart lies in the ditch, its load scattered. Somebody has already picked it over.', 'A funeral procession crosses the road: six bearers, a priest, and one dog that will not leave the coffin.',
    'A patrol drags a hooded prisoner along in the dust. Nobody looks at you.', 'A shrine at a crossroad has fresh flowers and an unlit candle. Someone is hoping.', 'A merchant\'s mule has gone lame and he is sitting on a milestone, arguing with it.',
    'Two children are racing hoops down the hill with a goat chasing them.', 'A long file of pilgrims winds past, singing slightly out of tune.', 'A signpost has been turned round. Someone thought that was funny.',
    'A tinker is mending a pot in the middle of the road and refuses to move for anyone.', 'Wolves have been at a stray lamb. The shepherd is bandaging her own hand.', 'A bard on a gatepost is composing a song about you, apparently. It is mostly rhymes with "ditch".',
    'A scarecrow wears a stolen soldier\'s helm, and somebody has given it a coin purse. You do not touch it.', 'The wind brings the smell of a far-off fire, and then it passes.'
  ];
  C.sight = function (st, from, to) { if (hsh(from + '>' + to + '|' + st.world.day + '|s') % 100 >= 18) return null; return { id: 'sight', text: hpick(C.ROAD_SIGHTS, to + '|' + st.world.day) }; };
  // Each sight leaves something behind: a few coins, a little goodwill, or a road you had not noticed. Sights never stop a journey; the shell lists them on arrival.
  C.SIGHT_GIFTS = [
    ['A burnt-out cart', { gold: 10, note: 'They missed a purse under the axle: +10 gold.' }], ['A funeral procession', { goodwill: 1, note: 'You stand aside, heads bowed. Word of it travels.' }],
    ['A patrol drags', { reveal: 1, note: 'You see which road they came by.' }], ['A shrine at a crossroad', { goodwill: 1, note: 'You light the candle as you pass.' }],
    ['A merchant\'s mule', { gold: 8, note: 'You get the mule moving again. He pays 8 gold for the trouble.' }], ['Two children', { reveal: 1, note: 'They shout a shortcut after you.' }],
    ['A long file of pilgrims', { goodwill: 1, note: 'You walk with them a mile and share your water.' }], ['A signpost has been turned', { reveal: 1, note: 'You turn it back, and read where the roads really go.' }],
    ['A tinker is mending', { gold: 6, note: 'He buys a bent buckle off you for 6 gold. Odd man.' }], ['Wolves have been at', { goodwill: 1, note: 'You bind her hand properly before moving on.' }],
    ['A bard on a gatepost', { gold: 5, note: 'The crowd he has gathered tosses coins. He shares 5 with his subject.' }], ['A scarecrow wears', { goodwill: 1, note: 'A farmer sees you leave the purse alone, and remembers.' }],
    ['The wind brings', { reveal: 1, note: 'You climb a rise to look, and see more of the land.' }]
  ];
  { const sg0 = C.sight; C.sight = function (st, from, to) { const r = sg0.apply(this, arguments); if (!r) return r;
      const g = (C.SIGHT_GIFTS.find(([k]) => r.text.indexOf(k) === 0) || [])[1]; if (!g) { r.note = 'A sign of the times. Worth remembering.'; return r; }
      if (g.gold) st.inventory.gold += g.gold; if (g.goodwill && S().changeGoodwill) S().changeGoodwill(st, g.goodwill, 'kindness on the road');
      const found = [];
      if (g.reveal) { const seen = new Set([to]); let f = [to]; for (let d = 0; d < 2 && found.length < 2; d++) { const nx = []; f.forEach(x => Object.keys(C.NODES[x].links).forEach(y => { if (seen.has(y)) return; seen.add(y); nx.push(y); if (found.length < 2 && !C.isDiscovered(st, y) && !C.NODES[y].hidden) { C.discover(st, y); found.push(y); } })); f = nx; } }   // one or two places, not a whole county r.note = g.note + (g.goodwill ? ' (Hearthwatch goodwill +' + g.goodwill + ')' : '') + (g.reveal ? (found.length ? ' New on your map: ' + found.map(x => C.NODES[x].name).join(', ') + '.' : ' Nothing new, but you know the way better.') : '');
      r.note = g.note + (g.goodwill ? ' (Hearthwatch goodwill +' + g.goodwill + ')' : '') + (g.reveal ? (found.length ? ' New on your map: ' + found.map(x => C.NODES[x].name).join(', ') + '.' : ' Nothing new, but you know the way better.') : '');
      r.gold = g.gold || 0; r.found = found; return r; }; }
  C.LETTER_TEXT = {
    crown: 'The Crown notes your service at {at}. A little coin goes with the sergeant\'s regard.', syndicate: 'Your account at {at} is settled, with a small courtesy added. Do remember who extended it.',
    synod: 'The clerks of {at} remember you in their prayers and in their ledgers. A small offering goes with this note.', general: 'Word got round that you did right by {at}. The folk there chipped in what they could.'
  };
  C.queueLetter = function (st, jobId) {
    const j = C.JOBS[jobId]; if (!j) return; const q = st.world.letters = st.world.letters || [], base = Math.max(5, Math.round(((j.reward || {}).gold || 0) * 0.2));
    q.push({ due: st.world.day + 3, from: j.giver, text: (C.LETTER_TEXT[j.giver] || C.LETTER_TEXT.general).replace('{at}', C.NODES[j.at].name), gold: base });
  };
  C.jobLeads = st => Object.keys(st.world.tvSeen || {}).filter(k => k.startsWith('job_')).map(k => k.slice(4)).filter(k => C.JOBS[k] && !C.jobsOf(st)[k]).map(k => ({ id: k, giver: C.JOBS[k].giver, at: C.JOBS[k].at }));
  C.takeLetters = function (st) { const q = st.world.letters || [], due = q.filter(l => l.due <= st.world.day); if (!due.length) return []; st.world.letters = q.filter(l => l.due > st.world.day); due.forEach(l => { st.inventory.gold += l.gold; }); return due; };

  // ---- the dossier: what the player has learned about each faction, and the secrets they can prove ----
  // Entries appear only once learned (seen, overheard, told or found). Depth gates what a source will say: 0 anyone, 1 friendly or a rank, 2 allied or rank 2 (the leadership's own version).
  // Secrets climb rumour (1) > evidence (2) > proof (3). Not every rumour is true: a rumour can be followed up (visit a place) and turn out false. Holding proof makes the faction send hunters; defend it or lose it.
  C.LORE = {}; const LK = ['ideal', 'strength', 'weakness', 'figure', 'view', 'secret'];
  const L = (id, f, kind, depth, text, o) => { C.LORE[id] = Object.assign({ id, faction: f, kind, depth, text }, o || {}); };
  // --- Royalist Crown ---
  L('c_ideal', 'crown', 'ideal', 0, 'Order, even stiff and unfair, is better than a war over who sits the throne. Ask a sergeant and he will say it in fewer words.');
  L('c_ideal_in', 'crown', 'ideal', 2, 'The lords do not call it order among themselves. They call it the Interval: the quiet before a claimant is named. Nobody is allowed to say how long the Interval has lasted.');
  L('c_strength', 'crown', 'strength', 0, 'A garrison in every shire and roads that work. Where the Crown rules, a cart can cross a county without being robbed.');
  L('c_weak', 'crown', 'weakness', 1, 'The lords hold the realm by oath, not love. Each sits on his own grain and his own levy and would not send either far from home.');
  L('c_fig_sergeant', 'crown', 'figure', 0, 'The sergeant at Rivermeet. Pays for steady swords and thinks the realm is held together by men like him.');
  L('c_fig_steward', 'crown', 'figure', 0, 'The Steward of Crown Keep. Greyer each month since he sent a stranger to the Barrow. Folk say he keeps the old king\'s seal.');
  L('c_view_synd', 'crown', 'view', 0, 'Crown clerks on the Syndicate: "They own half our debt and call it a favour."');
  L('c_view_hask', 'crown', 'view', 1, 'A deserter on the Crown: "They left us in the field. The Crown is not a person. It is a debt nobody collects."');
  L('s_succ_r1', 'crown', 'secret', 0, 'A steward swears the old king never named an heir, and that the seal on his Barrow was set after he died, not before. If so, somebody has been hiding an empty throne.', { sid: 'succession', stage: 1, truth: true, follow: { visit: 'kings_barrow', gives: 's_succ_e' } });
  L('s_succ_r2', 'crown', 'secret', 0, 'They say the old king is not dead at all. He lies in Whitestone Abbey, waiting for the right hour.', { sid: 'succession', stage: 1, truth: false, follow: { visit: 'whitestone_abbey' }, falseText: 'The abbey holds monks and a very old dog. Nobody is waiting for anything.' });
  L('s_succ_e', 'crown', 'secret', 0, 'The seal on the Barrow door is newer than the dust around it. Someone resealed it long after the funeral.', { sid: 'succession', stage: 2, truth: true });
  L('s_succ_p', 'crown', 'secret', 0, 'The Heir\'s Writ: the old king\'s own hand, naming no one. The throne has no rightful claimant, and the lords have known it all through the Interval, and let the realm wait anyway.', { sid: 'succession', stage: 3, truth: true });
  // --- Mercantile Syndicate ---
  L('y_ideal', 'syndicate', 'ideal', 0, 'Whoever owns the debts and the grain owns the realm, and that is safer than a crown.');
  L('y_ideal_in', 'syndicate', 'ideal', 2, 'Among the factors they call it the Long Ledger: a balanced book is the only peace that lasts. They truly do not see the harm in it.');
  L('y_strength', 'syndicate', 'strength', 0, 'Credit, grain barges and fast news. The Syndicate can feed a town or starve one in a week.');
  L('y_weak', 'syndicate', 'weakness', 1, 'Every kindness has a ledger and every ledger has a creditor. Spoil the trust in the books and the whole thing wobbles.');
  L('y_fig_dov', 'syndicate', 'figure', 0, 'Dov Quill, a thin clerk who remembers every face like a debt. Ask about the ledgers and he changes the subject.');
  L('y_fig_factor', 'syndicate', 'figure', 0, 'The factor at Rivermeet. Smiles in a way you do not like.');
  L('y_view_synod', 'syndicate', 'view', 0, 'Synod clerks on the Syndicate: "Charity with a ledger behind it is still charity. But whose?"');
  L('s_hand_r1', 'syndicate', 'secret', 0, 'Every Syndicate ledger carries a tiny mark in the corner that the clerks cannot explain. It looks like a cipher. Nobody has found whose it is, and the Factors do not ask.', { sid: 'hidden_hand', stage: 1, truth: true, follow: { visit: 'ledgerhall', gives: 's_hand_e' } });
  L('s_hand_r2', 'syndicate', 'secret', 0, 'The Syndicate is run by the old Duke of Gildhaven, kept alive by Synod magic.', { sid: 'hidden_hand', stage: 1, truth: false, follow: { visit: 'debtors_tower' }, falseText: 'The Duke died years ago. The tower holds debtors, not masters.' });
  L('s_hand_e', 'syndicate', 'secret', 0, 'A clerk at Ledgerhall copies the same mark on every authorised draft. It is not a name. It is a number, and it changes.', { sid: 'hidden_hand', stage: 2, truth: true });
  L('s_hand_p', 'syndicate', 'secret', 0, 'The Second Book: a hidden ledger of every lord\'s debt that was never written in the first, and the cipher of the one person who holds them all. Whoever holds it holds the lords.', { sid: 'hidden_hand', stage: 3, truth: true });
  // --- Ascendant Synod ---
  L('sy_ideal', 'synod', 'ideal', 0, 'Magic is dangerous and must be policed. The rank and file believe it sincerely, and they have stopped real disasters.');
  L('sy_ideal_in', 'synod', 'ideal', 2, 'The inner circle calls it stewardship: if dangerous knowledge has to be held by someone, better the ones who understand it.');
  L('sy_strength', 'synod', 'strength', 0, 'Wards, hospices and a long memory. The Synod keeps a record of every confession and every spell.');
  L('sy_weak', 'synod', 'weakness', 1, 'They cannot see what is not written down. Hedge-mages outlive the Synod\'s lists.');
  L('sy_fig_maren', 'synod', 'figure', 0, 'Sister Maren, a travelling pilgrim in a patched mantle. She believes, and she is troubled.');
  L('sy_fig_clerk', 'synod', 'figure', 0, 'The clerk at Orchard Row who wrote down every word you said.');
  L('s_hoard_r1', 'synod', 'secret', 0, 'Mages taken "for questioning" to Vol\'Dun are not seen again. Their families are told they were registered and released. The Synod keeps their grimoires.', { sid: 'forbidden_hoard', stage: 1, truth: true, follow: { visit: 'orchard_row', gives: 's_hoard_e' } });
  L('s_hoard_r2', 'synod', 'secret', 0, 'The Synod\'s inner circle died years ago. A necromancer wears their robes and signs their letters.', { sid: 'forbidden_hoard', stage: 1, truth: false, follow: { visit: 'pale_vigil' }, falseText: 'A lame cat and a cold hearth. Nothing sinister, only sad.' });
  L('s_hoard_e', 'synod', 'secret', 0, 'The transfer orders at Orchard Row name no chantry. All are stamped Vol\'Dun with a closed eye, and all are for mages who never arrived.', { sid: 'forbidden_hoard', stage: 2, truth: true });
  L('s_hoard_p', 'synod', 'secret', 0, 'The Sealed Ledger: every grimoire the Synod has taken, and where each one went. None of them were burned. They all went down, under Vol\'Dun.', { sid: 'forbidden_hoard', stage: 3, truth: true });
  // generic views built from the tavern lines: what its friends say, what its critics say
  Object.entries(C.TV_TALK).forEach(([f, t]) => { L('tv_' + f + '_p', f, 'view', 0, 'Its friends say: ' + t[0]); L('tv_' + f + '_s', f, 'view', 0, 'Its critics say: ' + t[1]); });
  C.SECRETS = {
    succession: { faction: 'crown', name: 'The Empty Throne', proof: 's_succ_p', rival: 'syndicate', hunt: 'Crown agents', squad: [[{ primary: 'warrior', name: 'Royal Agent' }, { primary: 'archer', name: 'Crown Marksman' }, { primary: 'rogue', name: 'Sealer' }], [{ primary: 'warlord', name: 'Crown Warden' }, { primary: 'marksman', name: 'Royal Marksman' }, { primary: 'assassin', name: 'Quiet Hand' }]] },
    hidden_hand: { faction: 'syndicate', name: 'The Hidden Hand', proof: 's_hand_p', rival: 'crown', hunt: 'Syndicate collectors', squad: [[{ primary: 'rogue', name: 'Collector' }, { primary: 'warrior', name: 'Ledger Guard' }, { primary: 'archer', name: 'Lookout' }], [{ primary: 'assassin', name: 'Silent Auditor' }, { primary: 'marksman', name: 'Hired Rifle' }, { primary: 'warrior', name: 'Debt Enforcer' }]] },
    forbidden_hoard: { faction: 'synod', name: 'The Forbidden Hoard', proof: 's_hoard_p', rival: 'crown', hunt: 'Synod inquisitors', squad: [[{ primary: 'acolyte', name: 'Chantry Guard' }, { primary: 'apprentice', name: 'Ward-Reader' }, { primary: 'squire', name: 'Lay Brother' }], [{ primary: 'wizard', name: 'Inquisitor' }, { primary: 'cleric', name: 'Confessor' }, { primary: 'warrior', name: 'Chantry Champion' }]] }
  };
  // what you see and do teaches you things (event: job_done:<job>, visit:<place>, squab:<a>|<b>, npc:<id>:<meetings>, dungeon:<id>)
  C.LORE_ON = {
    'job_done:toll_road': ['c_strength', 'c_fig_sergeant'], 'job_done:barrow_whispers': ['c_fig_steward', 'c_weak', 's_succ_r1'],
    'job_done:pennant_debt': ['y_ideal'], 'job_done:cellar_ledger': ['y_fig_factor', 'y_weak', 's_hand_r1'], 'visit:canalgate': ['y_strength'],
    'job_done:sealed_letter': ['sy_ideal'], 'job_done:hedge_mage': ['sy_fig_clerk', 'sy_weak', 's_hoard_r1'], 'visit:orchard_row': ['sy_strength'], 'visit:rivermeet': ['c_ideal'],
    'squab:crown|syndicate': ['c_view_synd'], 'squab:synod|syndicate': ['y_view_synod'],
    'npc:hask:2': ['c_view_hask'], 'npc:hask:4': ['s_succ_r1'], 'npc:dov:1': ['y_fig_dov'], 'npc:dov:4': ['s_hand_r1'], 'npc:maren:1': ['sy_fig_maren'], 'npc:maren:4': ['s_hoard_r1'],
    'dungeon:kings_barrow_depths': ['s_succ_p'], 'dungeon:silt_wharf_undercroft': ['s_hand_p']
  };
  const dos = st => { const w = st.world; if (!w.dossier) w.dossier = { got: {}, secrets: {}, resolved: {}, proof: {}, inf: {}, news: [] }; return w.dossier; };
  C.depthOf = function (st, f) { const tier = S().standingTier(st, f).id, r = S().getRank ? S().getRank(st, f) : null; let d = 0; if (tier === 'friendly' || (r && r.rank >= 1)) d = 1; if (tier === 'allied' || (r && r.rank >= 2)) d = 2; return d; };
  C.knows = (st, id) => !!dos(st).got[id];
  C.learn = function (st, id, src) {
    const e = C.LORE[id], d = dos(st); if (!e) return { ok: false, reason: 'unknown' }; if (d.got[id]) return { ok: false, reason: 'known' };
    if (e.depth > C.depthOf(st, e.faction)) return { ok: false, reason: 'depth' };
    d.got[id] = { day: st.world.day, src: src || 'Heard' }; d.news.push({ id, kind: 'new' });
    if (e.sid) { d.secrets[e.sid] = Math.max(d.secrets[e.sid] || 0, e.stage); if (e.stage === 3 && !d.proof[e.sid]) d.proof[e.sid] = { since: st.world.day, defended: 0, held: true }; }
    return { ok: true, entry: e };
  };
  const srcOf = ev => { const [k, a, b] = ev.split(':'); const nm = x => (C.NODES[x] ? C.NODES[x].name : x); return k === 'job_done' ? 'Seen while working' : k === 'visit' ? 'Seen at ' + nm(a) : k === 'squab' ? 'Overheard in a tavern' : k === 'npc' ? 'Told by ' + (C.NPCS[a] ? C.NPCS[a].name : a) : k === 'dungeon' ? 'Found in ' + (C.DUNGEONS[a] ? C.DUNGEONS[a].name : a) : 'Heard'; };
  C.lore = function (st, ev) {
    const d = dos(st); (C.LORE_ON[ev] || []).forEach(id => C.learn(st, id, srcOf(ev)));
    if (ev.startsWith('visit:')) { const at = ev.slice(6), name = C.NODES[at] ? C.NODES[at].name : at; // follow-ups: a visit settles the rumours that pointed here
      Object.keys(d.got).forEach(id => { const e = C.LORE[id]; if (!e || !e.follow || e.follow.visit !== at || d.resolved[id]) return;
        if (e.truth) { d.resolved[id] = 'true'; if (e.follow.gives) C.learn(st, e.follow.gives, 'Checked at ' + name); } else { d.resolved[id] = 'false'; d.news.push({ id, kind: 'false' }); } }); }
  };
  C.rumourState = function (st, id) { const e = C.LORE[id], d = dos(st); if (!e || e.kind !== 'secret' || e.stage !== 1) return null; if (d.resolved[id] === 'false') return 'false'; if (e.truth && (d.secrets[e.sid] || 0) >= 2) return 'confirmed'; return d.resolved[id] === 'true' ? 'confirmed' : 'unverified'; };
  C.dossier = function (st, f) {
    const d = dos(st); return Object.keys(d.got).map(id => C.LORE[id]).filter(e => e && e.faction === f).sort((a, b) => LK.indexOf(a.kind) - LK.indexOf(b.kind) || d.got[a.id].day - d.got[b.id].day)
      .map(e => ({ id: e.id, kind: e.kind, depth: e.depth, text: e.text, src: d.got[e.id].src, day: d.got[e.id].day, stage: e.stage || 0, state: C.rumourState(st, e.id), falseText: e.falseText || null }));
  };
  C.dossierCount = (st, f) => Object.keys(dos(st).got).filter(id => C.LORE[id] && C.LORE[id].faction === f).length;
  C.takeLoreNews = function (st) { const d = dos(st), n = d.news; d.news = []; return n.map(x => { const e = C.LORE[x.id]; return x.kind === 'false' ? { kind: 'false', faction: e.faction, text: 'A rumour about ' + C.tvName(e.faction) + ' turns out to be false.' } : { kind: 'new', faction: e.faction, text: 'Dossier: ' + C.tvName(e.faction).replace(/^the /, '') + ' (' + e.kind + ')' }; }); };
  C.loreSweep = function (st) { Object.keys(C.LORE).forEach(id => { const e = C.LORE[id]; if (e.depth === 2 && !C.knows(st, id) && C.depthOf(st, e.faction) >= 2) C.learn(st, id, 'Said among the leadership'); }); };
  // whispers in the tavern: some are true, some are not
  function tvWhisper(st, id, r) {
    const d = dos(st), pool = Object.values(C.LORE).filter(e => e.kind === 'secret' && e.stage === 1 && !d.got[e.id]); if (!pool.length) return null;
    const e = tvPick(r, pool), who = tvPick(r, (C.TV_PEOPLE[C.NODES[id].region] || []).concat(C.TV_PEOPLE.any)); C.learn(st, e.id, 'Whispered in a tavern');
    return { kind: 'whisper', title: 'A whisper', lines: [{ who: who + ', leaning in', text: e.text }], narr: tvPick(r, ['They look over their shoulder before they finish. You cannot tell whether they believe it themselves.', 'They say it low and quick, and are gone before you can ask where they heard it.', 'It may be true. It may be a story told for a free drink. Only checking will tell.']), fac: e.faction };
  }
  // whistleblowers: someone inside, unhappy, who will talk if you have already heard the rumour
  C.INFORMANTS = {
    pell: { name: 'Quartermaster Pell', desc: 'a Crown quartermaster with a nervous cough', faction: 'crown', sid: 'succession', at: 'crownwatch_inn', evidence: 's_succ_e', proof: 's_succ_p', first: '"I count the king\'s stores. All of them, even the ones he never ate. Twelve years of an empty throne, and the stores still come in under his name." He coughs. "I know what the Barrow door really says. Will you hear it? Not here. Not loud."', second: '"I took this from the sealed chest before the steward noticed. If I am found with it I am done. Take it and go far."' },
    iris: { name: 'Iris Vane', desc: 'a Syndicate junior clerk with ink on her cuffs', faction: 'syndicate', sid: 'hidden_hand', at: 'canalgate', evidence: 's_hand_e', proof: 's_hand_p', first: '"The mark on every draft is a number. A tiny one, in the corner, in the same hand. I have watched it change for six years." She turns her cuff so the ink does not show. "Nobody asks whose it is. I asked once. I was given a raise and a new desk, a long way from the books."', second: '"The Second Book. I copied the first page and nothing else. Take it before they count the ledgers."' },
    aldric: { name: 'Novice Aldric', desc: 'a pale Synod novice with chantry-cropped hair', faction: 'synod', sid: 'forbidden_hoard', at: 'orchard_row', evidence: 's_hoard_e', proof: 's_hoard_p', first: '"I fetch the transfer orders for prisoners sent on to Vol\'Dun. There are no chantries on them, no names of who received them. They just go down." He swallows. "Do you know what that means? Neither do I. I would like to stop wondering."', second: '"I have the ledger. I cannot carry it any longer. If the inquisitors find it, they will not ask whose it was."' }
  };
  C.informantAt = function (st, id) {
    const d = dos(st); return Object.entries(C.INFORMANTS).filter(([k, p]) => p.at === id && (d.secrets[p.sid] || 0) >= 1 && S().standingTier(st, p.faction).id !== 'hostile' && !(d.inf[k] && d.inf[k].done))
      .map(([k, p]) => { const s = d.inf[k] || { stage: 0 }, wait = s.stage === 1 && st.world.day - s.day < 3; return { id: k, name: p.name, desc: p.desc, faction: p.faction, stage: s.stage, wait, line: s.stage ? p.second : p.first, canProof: s.stage === 1 && !wait && !d.got[p.proof] }; });
  };
  C.informantAct = function (st, id, k, how) {
    const p = C.INFORMANTS[k], d = dos(st), a = C.informantAt(st, id).find(x => x.id === k); if (!a) return { ok: false, reason: 'They are not here' }; const s = d.inf[k] = d.inf[k] || { stage: 0, day: st.world.day };
    if (how === 'report') { const ch = S().changeStanding(st, p.faction, 30, { reason: 'reported a leak' }); s.done = true; return { ok: true, text: 'You pass the name up the line. They thank you in the way institutions do. Pell, Iris and Aldric are not the sort to be seen again.'.replace('Pell, Iris and Aldric are', p.name + ' is'), changes: ch }; }
    if (how === 'listen' && s.stage === 0) { const r = C.learn(st, p.evidence, 'Told by ' + p.name); s.stage = 1; s.day = st.world.day; return { ok: true, text: C.LORE[p.evidence].text, learned: r.ok }; }
    if (how === 'take' && s.stage === 1) { if (a.wait) return { ok: false, reason: p.name + ' needs a few days to get it out' }; const ch = S().changeStanding(st, p.faction, -20, { reason: 'took stolen proof' }); const r = C.learn(st, p.proof, 'Given by ' + p.name); s.done = true; return { ok: true, text: C.LORE[p.proof].text, learned: r.ok, changes: ch, proof: true }; }
    return { ok: false, reason: 'Nothing to do' };
  };
  // proof: held proof draws hunters (after word gets out), must be defended, and can be used
  C.proofs = st => { const d = dos(st); return Object.entries(d.proof).filter(([k, p]) => p.held).map(([k, p]) => Object.assign({ sid: k, name: C.LORE[C.SECRETS[k].proof].text.split(':')[0], secret: C.SECRETS[k].name, faction: C.SECRETS[k].faction }, p, { hunted: st.world.day - p.since >= 4 })); };
  C.PROOF = { lag: 4, base: 0.1, perDefence: 0.04, cap: 0.35 };
  C.proofHunt = function (st, region, from, to, days) {
    const list = C.proofs(st).filter(p => st.world.day - p.since >= C.PROOF.lag); if (!list.length) return null;
    for (let i = 0; i < days; i++) for (const p of list) if (rnd(st) < Math.min(C.PROOF.cap, C.PROOF.base + C.PROOF.perDefence * p.defended)) {
      const S0 = C.SECRETS[p.sid], lv = partyLevel(st), set = S0.squad[lv > 7 ? 1 : 0], enc = { name: 'Ambush: ' + S0.hunt, map: C.mapFor(st, region, to), rec: lv, enemyFaction: S0.faction, enemies: set.map(e => Object.assign({}, e)), objective: null, once: false, wander: true, proofFor: p.sid, reward: { xp: 70 + 12 * lv, gold: 20 + 6 * lv } };
      return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: C.tvName(S0.faction).replace(/^the /, 'The ') + ' know what you carry. ' + S0.hunt + ' have found you, and they want ' + p.name.toLowerCase().replace(/^the /, 'the ') + ' back.' });
    }
    return null;
  };
  C.proofResult = function (st, sid, won) { const d = dos(st), p = d.proof[sid]; if (!p || !p.held) return null; if (won) { p.defended++; return { kept: true, text: 'You drive them off. The proof is still yours, and they will be back.' }; } p.held = false; p.lost = true; return { kept: false, text: 'They take the proof. ' + C.SECRETS[sid].name + ' goes back into the dark.' }; };
  C.proofActions = function (st, sid) {
    const d = dos(st), p = d.proof[sid]; if (!p || !p.held) return []; const S0 = C.SECRETS[sid], here = C.ownerOf(st, st.world.location), out = [];
    const rival = here && here !== S0.faction && window.GAME_DATA.factions[here] && S().getRelation(st, here, S0.faction) < 0 && here !== 'outlaws';
    out.push({ id: 'expose', label: 'Expose it to ' + (rival ? C.tvName(here) : 'a rival'), ok: !!rival, why: 'Take it to a place held by a rival of ' + C.tvName(S0.faction) + '.', rival: rival ? here : null });
    out.push({ id: 'blackmail', label: 'Blackmail ' + C.tvName(S0.faction), ok: here === S0.faction && S().standingTier(st, S0.faction).id !== 'hostile', why: 'Do it in a place they hold, where they can reach you.' });
    out.push({ id: 'destroy', label: 'Burn it', ok: true });
    return out;
  };
  C.useProof = function (st, sid, how) {
    const d = dos(st), p = d.proof[sid], S0 = C.SECRETS[sid], opt = C.proofActions(st, sid).find(o => o.id === how); if (!p || !p.held || !opt || !opt.ok) return { ok: false, reason: 'You cannot do that here' };
    const ch = []; let text = '', gold = 0;
    if (how === 'expose') { ch.push(...S().changeStanding(st, opt.rival, 40, { reason: 'proof against ' + S0.name })); ch.push(...S().changeStanding(st, S0.faction, -80, { reason: 'secret exposed', ripple: false })); gold = 80; st.inventory.gold += gold; S().shiftRelation(st, opt.rival, S0.faction, -0.1, { both: true }); st.world.flags['exposed_' + sid] = true; p.held = false; p.used = 'expose'; addBounty(st, S0.faction); text = C.tvName(opt.rival).replace(/^the /, 'The ') + ' read it twice and say nothing. By the next market day, everyone is saying something. ' + C.tvName(S0.faction).replace(/^the /, 'The ') + ' want you silenced.'; }
    else if (how === 'blackmail') { gold = 150 + 20 * partyLevel(st); st.inventory.gold += gold; ch.push(...S().changeStanding(st, S0.faction, -30, { reason: 'blackmail', ripple: false })); p.blackmail = (p.blackmail || 0) + 1; text = 'They pay, with the look of people who plan to remember it. They know you still have it.'; }
    else { p.held = false; p.used = 'destroy'; text = 'It burns quickly. The hunters will find nothing, and so will you.'; }
    return { ok: true, text, changes: ch, gold, how };
  };

  // ---- map and travel ----
  C.neighbors = (st, id) => Object.entries((C.NODES[id] || { links: {} }).links).map(([to, days]) => ({ id: to, days, discovered: C.isDiscovered(st, to) }));
  C.travelCost = (a, b) => (C.NODES[a] && C.NODES[a].links[b]) || null;
  // ---- random encounters on the road ----
  // One roll per day on the road: base + danger of the region, more the longer it has been quiet. Tunable.
  // Random meetings: ordinary roads are nearly quiet (base). Arriving in a zone rolls zoneBase (25%) + perDanger x the zone's danger. In a region whose owner is Hostile to you the roads are hunted (huntBase and up, growing with each patrol, forgotten after huntForget quiet days); border road stops become checkpoints. After bountyAt patrols the faction puts a bounty on you and hunters can find you anywhere (bountyBase per bounty) until it lapses (bountyDecay days) or is settled.
  C.WANDER = { base: 0.02, zoneBase: 0.25, perDanger: 0.07, calmBonus: 0.02, cooldown: 1, cap: 0.5, weights: { fight: 45, trader: 15, event: 25, patrol: 15 }, fleeGoldFraction: 0.1, fleeDays: 1,
    huntBase: 0.2, huntStep: 0.08, huntCap: 0.55, huntForget: 6, bountyAt: 3, bountyBase: 0.12, bountyCap: 0.3, bountyDecay: 20, checkpointDays: 5, tollBase: 20, tollPerLevel: 10, settleBase: 100, settlePerLevel: 30, penanceDays: 5 };
  function rnd(st) { // small seeded generator kept in the save, so reloading a save gives the same road
    let t = st.world.rng; if (!(t >= 0)) t = (Math.random() * 4294967296) >>> 0;
    t = (t + 0x6D2B79F5) >>> 0; st.world.rng = t; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (st, arr) => arr[Math.floor(rnd(st) * arr.length)];
  const nodeDanger = id => Math.max((C.REGIONS[C.NODES[id].region] || {}).danger || 0, C.NODES[id].danger || 0); // a named wild area can be nastier than its region
  const dangerOf = (a, b) => Math.max(nodeDanger(a), nodeDanger(b));
  C.routeRisk = function (path, from) {
    let a = from, d = 0, n = 0; path.forEach(b => { d += dangerOf(a, b) * C.travelCost(a, b); n += C.travelCost(a, b); a = b; });
    const avg = n ? d / n : 0; return avg < 1.2 ? 'low' : avg < 2.2 ? 'medium' : 'high';
  };
  const partyLevel = st => { const l = st.party.map(id => (st.roster.find(u => u.id === id) || {}).level || 1); return Math.max(1, Math.round(l.reduce((x, y) => x + y, 0) / Math.max(1, l.length))); };
  // A generated fight, in the same shape as a story encounter. Rewards scale with level and are lower than a story fight.
  // Which battle map a meeting uses: a zone has its own map (same key as the zone); anywhere else draws from the terrain pool for that region.
  C.REGION_POOL = { crownlands: 'plains', free_marches: 'plains', river_cities: 'riverbank', voldun: 'ruins', elven_realms: 'forest', dwarven_holds: 'highland', iceflow: 'snow', orc_lands: 'volcanic', goblin_fens: 'marsh' };
  C.mapFor = function (st, region, to) {
    const M = G().maps; if (to && C.NODES[to] && C.NODES[to].type === 'zone' && M[to]) return to;
    const tag = C.REGION_POOL[region], list = Object.keys(M).filter(k => M[k].pool === tag);
    return list.length ? pick(st, list) : Object.keys(M)[0];
  };
  function wanderFight(st, region, kind, opts) {
    opts = opts || {}; const lv = Math.max(1, partyLevel(st) + Math.floor(rnd(st) * 3) - 1);
    let name, faction, enemies;
    if (kind === 'patrol') { const p = C.PATROLS[opts.faction]; name = p.name; faction = opts.faction; enemies = p.enemies; }
    else if (kind === 'hunters') { name = opts.set.name; faction = 'outlaws'; enemies = opts.set.enemies; }
    else { const fitM = C.MONSTER_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv && (x.zones || []).includes(opts.to)), zoneM = fitM.length && rnd(st) < 0.6, roam = !fitM.length && lv >= 3 && rnd(st) < 0.05;
      const fit = zoneM ? fitM : C.FOE_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv && (!x.regions || x.regions.includes(region))); const set = pick(st, roam ? C.MONSTER_SETS.filter(x => lv >= x.minLv && lv <= x.maxLv) : fit.length ? fit : C.FOE_SETS.slice(0, 1)); name = set.name; faction = set.faction; enemies = set.enemies; }
    const roll = rnd(st), objective = roll < 0.25 ? { type: 'survive', turns: 4 } : roll < 0.5 ? { type: 'leader', leader: 0 } : null;
    return { name: 'Ambush: ' + name, map: C.mapFor(st, region, opts.to), rec: lv, enemyFaction: faction, enemies: enemies.map(e => Object.assign({}, e)), objective, once: false, wander: true, swap: rnd(st) < 0.5,
      reward: { xp: Math.round((40 + 14 * lv) * 0.6), gold: 12 + 5 * lv + Math.floor(rnd(st) * 10) } };
  }
  function makeTrader(st) {
    const ids = Object.keys(G().gear).filter(g => G().gear[g].price && G().gear[g].price <= 200 && !(G().gear[g].tier > 1) && !G().gear[g].token); let stock = [];   // tier 1 ids, raised to the party's band below
    while (stock.length < 4 && ids.length) stock.push(ids.splice(Math.floor(rnd(st) * ids.length), 1)[0]);
    if (C.promoteStock && C.shopTier) stock = C.promoteStock(stock, Math.max(1, Math.min(7, G().gearTiers.tierForLevel(partyLevel(st)))), 'trader|' + st.world.day);
    return { stock, mult: 0.9 };
  }
  function pickRoadEvent(st, region) {
    const ok = Object.entries(C.CHOICES).filter(([id, c]) => c.road && (!c.regions || c.regions.includes(region)) && !(c.once && st.world.flags['choice_' + id]) && id !== st.world.lastRoadEvent).map(([id]) => id);
    return ok.length ? pick(st, ok) : null;
  }
  // ---- hunted land, checkpoints, bounties ----
  const hostileFac = (st, region) => { const f = (C.REGIONS[region] || {}).faction; return f && C.PATROLS[f] && S().standingTier(st, f).id === 'hostile' ? f : null; };
  function huntState(st, f) { const h = st.world.hunt || (st.world.hunt = {}); let x = h[f] || (h[f] = { n: 0, day: st.world.day }); if (x.n && st.world.day - x.day > C.WANDER.huntForget) { x.n = 0; } return x; }
  function bountyMap(st) {                                   // the exposure scene leaves flags['bounty_<faction>'] = day; fold those in, and let old bounties lapse
    const w = st.world, b = w.bounty || (w.bounty = {});
    for (const k of Object.keys(w.flags || {})) { const m = /^bounty_(.+)$/.exec(k); if (m && typeof w.flags[k] === 'number') { if (!b[m[1]]) b[m[1]] = { since: w.flags[k], last: w.flags[k] }; delete w.flags[k]; } }
    for (const f of Object.keys(b)) if (st.world.day - b[f].last >= C.WANDER.bountyDecay) delete b[f];
    return b;
  }
  C.bounties = st => Object.entries(bountyMap(st)).map(([f, x]) => ({ faction: f, since: x.since, daysLeft: Math.max(0, C.WANDER.bountyDecay - (st.world.day - x.last)), cost: settleCost(st, f) }));
  const settleCost = st => Math.round((C.WANDER.settleBase + C.WANDER.settlePerLevel * partyLevel(st)) * (C.costMult ? C.costMult(st) : 1));
  function addBounty(st, f) { const b = bountyMap(st); if (!b[f]) b[f] = { since: st.world.day, last: st.world.day }; else b[f].last = st.world.day; }
  C.HUNTERS = [
    { maxLv: 6, name: 'Bounty hunters', enemies: [{ primary: 'rogue', name: 'Bounty Hunter' }, { primary: 'archer', name: 'Hunter\'s Bowman' }, { primary: 'squire', name: 'Hired Blade' }] },
    { maxLv: 999, name: 'Bounty hunters', enemies: [{ primary: 'assassin', name: 'Bounty Killer' }, { primary: 'marksman', name: 'Dead-Eye' }, { primary: 'warrior', name: 'Thief-Taker' }] }
  ];
  function patrolFight(st, fac, region, from, to) {
    const enc = wanderFight(st, region, 'patrol', { faction: fac, to }); enc.name = 'Patrol: ' + C.PATROLS[fac].name;
    const hs = huntState(st, fac); hs.n++; hs.day = st.world.day; if (hs.n >= C.WANDER.bountyAt) addBounty(st, fac);
    const nm = C.PATROLS[fac].name.toLowerCase();
    return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, faction: fac, hunted: hs.n, text: hs.n <= 1 ? 'A ' + nm + ' has recognised you and will not let you pass.' : 'The ' + nm + ' are still hunting you. Another band has found you.' });
  }
  function hunterFight(st, region, from, to) {
    const lv = partyLevel(st), set = C.HUNTERS.find(x => lv <= x.maxLv), enc = wanderFight(st, region, 'hunters', { set, to });
    return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: 'Someone has been paid to find you. They have.' });
  }
  // Chance (0..1) that arriving in this place starts a meeting, for the map and the node sheet.
  C.zoneChance = function (id) { const n = C.NODES[id], W = C.WANDER; return n && n.type === 'zone' && n.danger > 0 ? Math.min(W.cap, W.zoneBase + W.perDanger * nodeDanger(id)) : 0; };
  C.rollWander = function (st, from, to, days) {
    const W = C.WANDER, n = C.NODES[to], region = n.region, calm0 = st.world.calm || 0; let calm = calm0;
    const hostile = hostileFac(st, region), bm = bountyMap(st), nb = Object.keys(bm).length;
    // checkpoint: a border road stop in hostile land, at most once per few days
    if (hostile && n.type === 'road' && W.checkpointDays && (C.NODES[from] || {}).region !== region) {   // only when entering the land: leaving it, or moving inside it, never stops you
      const pass = (st.world.pass || {})[hostile]; if (pass === undefined || st.world.day - pass > W.checkpointDays) {
        const toll = Math.round((W.tollBase + W.tollPerLevel * partyLevel(st)) * (C.costMult ? C.costMult(st) : 1));
        return setWander(st, { kind: 'checkpoint', region, from, to, day: st.world.day, faction: hostile, toll, text: 'A ' + C.PATROLS[hostile].name.toLowerCase() + ' holds the road. They know your face.' });
      }
    }
    // guided first week: the first zone you walk into while you still have no fight to your name always turns up one (a fair, small one)
    { const f = st.world.flags; if (f.opening && !f.guide_none && !f.guide_off && !f.guide_done && !f.g_fight && n.type === 'zone' && n.danger > 0) { st.world.calm = 0; const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, { kind: 'fight', region, from, to, day: st.world.day, enc, text: 'Armed strangers step out of the grass ahead. Your first real test.' }); } }
    { const ph = C.proofHunt(st, region, from, to, days); if (ph) { st.world.calm = 0; return ph; } }
    for (let d = 1; d <= days; d++) {
      if (nb && W.bountyBase && rnd(st) < Math.min(W.bountyCap, W.bountyBase * nb)) { st.world.calm = 0; return hunterFight(st, region, from, to); }
      if (hostile && W.huntBase) { const hs = huntState(st, hostile); if (rnd(st) < Math.min(W.huntCap, W.huntBase + W.huntStep * hs.n)) { st.world.calm = 0; return patrolFight(st, hostile, region, from, to); } continue; }
      if (calm < W.cooldown) { calm++; continue; }
      const zone = n.type === 'zone' && n.danger > 0, p = zone ? Math.min(W.cap, W.zoneBase + W.perDanger * nodeDanger(to) + W.calmBonus * (calm - W.cooldown)) : W.base;
      if (!(p > 0) || rnd(st) >= p) { calm++; continue; }
      st.world.calm = 0; return makeWander(st, region, from, to);
    }
    st.world.calm = calm; return null;
  };
  // Checkpoint choices: pay the toll, bluff (needs a rank to flash), fight, or turn back.
  C.checkpointOptions = function (st, w) {
    const ranks = S().listRanks ? S().listRanks(st).length : 0;
    return [{ id: 'pay', label: 'Pay the toll (' + w.toll + ' g)', ok: st.inventory.gold >= w.toll }, { id: 'bluff', label: 'Bluff your way through', ok: ranks > 0, note: ranks ? null : 'You have no rank to flash.' },
      { id: 'fight', label: 'Fight your way through', ok: true }, { id: 'turn', label: 'Turn back', ok: true }];
  };
  C.resolveCheckpoint = function (st, choice, roll) {
    const w = st.world.wander; if (!w || w.kind !== 'checkpoint') return { ok: false, reason: 'No checkpoint' };
    const opt = C.checkpointOptions(st, w).find(o => o.id === choice); if (!opt || !opt.ok) return { ok: false, reason: 'Not possible' };
    const pass = () => { (st.world.pass = st.world.pass || {})[w.faction] = st.world.day; st.world.wander = null; };
    if (choice === 'pay') { st.inventory.gold -= w.toll; pass(); return { ok: true, passed: true }; }
    if (choice === 'turn') { const from = w.from; C.turnBack(st, from); return { ok: true, turned: true }; }
    if (choice === 'bluff') { const chance = Math.min(0.8, 0.3 + 0.12 * S().listRanks(st).length + 0.05 * S().listRanks(st).reduce((a, r) => a + (r.trust || 0), 0)); if ((roll === undefined ? rnd(st) : roll) < chance) { pass(); return { ok: true, passed: true, bluffed: true }; } }
    patrolFight(st, w.faction, w.region, w.from, w.to); return { ok: true, fight: true, bluffFailed: choice === 'bluff' };
  };
  // Settling a bounty: the Syndicate will arrange it for a price at any of its places; a Hearthwatch chapel takes penance instead (days of service).
  C.bountyOptions = function (st, id) {
    const n = C.NODES[id], owner = C.ownerOf(st, id), out = [], bs = C.bounties(st); if (!bs.length) return out;
    for (const b of bs) {
      if (owner === 'syndicate' && n.shop) out.push({ faction: b.faction, how: 'pay', cost: Math.round(b.cost * 1.5), ok: st.inventory.gold >= Math.round(b.cost * 1.5) });
      if (owner === 'hearthwatch') out.push({ faction: b.faction, how: 'penance', days: C.WANDER.penanceDays, ok: true });
    }
    return out;
  };
  C.settleBounty = function (st, id, faction, how) {
    const o = C.bountyOptions(st, id).find(x => x.faction === faction && x.how === how); if (!o) return { ok: false, reason: 'Not available here' }; if (!o.ok) return { ok: false, reason: 'Not enough gold' };
    if (how === 'pay') st.inventory.gold -= o.cost; else { S().advanceDay(st, o.days); if (S().changeGoodwill) S().changeGoodwill(st, 3, 'did penance'); }
    delete bountyMap(st)[faction]; huntState(st, faction).n = 0; return { ok: true, how, cost: o.cost || 0, days: o.days || 0 };
  };

  // ---- dungeon state ----
  function dgState(st, id) { const d = st.world.dungeons || (st.world.dungeons = {}); return d[id] || (d[id] = { stage: 0, cleared: false, clearedDay: -1, clears: 0 }); }
  C.refreshDungeon = function (st, id) { const d = C.DUNGEONS[id], s = dgState(st, id); if (d && s.cleared && d.respawn && st.world.day - s.clearedDay >= d.respawn) { s.cleared = false; s.stage = 0; s.refills = (s.refills || 0) + 1; } return s; };
  C.dungeonStatus = function (st, id) {
    const d = C.DUNGEONS[id]; if (!d) return null; const s = C.refreshDungeon(st, id), lv = partyLevel(st), over = lv - d.rec;
    return { id, name: d.name, tier: d.tier, rec: d.rec, floors: d.floors.length, stage: s.stage, cleared: s.cleared, clears: s.clears, respawn: d.respawn || null, why: d.why,
      daysLeft: s.cleared && d.respawn ? Math.max(0, d.respawn - (st.world.day - s.clearedDay)) : null, repeat: s.clears > 0, partyLevel: lv, tooEasy: over > 3, floorName: d.floors[Math.min(s.stage, d.floors.length - 1)].name };
  };
  // Prepare the next floor's fight (rewards depend on the run: repeat clears pay half, and far-above-level parties get less) and return its encounter id, or null when the dungeon is clear.
  C.dungeonFight = function (st, id) {
    const d = C.DUNGEONS[id], s = C.refreshDungeon(st, id); if (!d || s.cleared) return null; const encId = 'dg_' + id + '_' + (s.stage + 1), e = C.ENCOUNTERS[encId];
    const over = partyLevel(st) - d.rec, lvMult = over <= 3 ? 1 : over <= 6 ? 0.6 : 0.3, mult = (s.clears > 0 ? 0.5 : 1) * lvMult, last = s.stage === d.floors.length - 1, first = s.clears === 0 && last;
    e.reward = { xp: Math.round(e.baseReward.xp * mult), gold: Math.round(e.baseReward.gold * mult) + (first && d.first ? d.first.gold : 0) }; if (first && d.first && d.first.items) e.reward.items = Object.assign({}, d.first.items);
    return encId;
  };
  C.reveal = function (st, id) { const n = C.NODES[id]; if (!n || !n.hidden) return { ok: false }; if (st.world.flags['reveal_' + id]) return { ok: false, already: true }; st.world.flags['reveal_' + id] = true; nodeState(st, id).discovered = true; return { ok: true, name: n.name }; };
  function autoReveal(st, at) {
    const out = []; for (const [id, d] of Object.entries(C.DUNGEONS)) if (d.hidden && d.parent === at && d.reveal && d.reveal.auto && partyLevel(st) >= (d.reveal.minLevel || 1) && !st.world.flags['reveal_' + id]) { C.reveal(st, id); out.push(d.name); }
    return out;
  }

  function makeWander(st, region, from, to) {
    const W = C.WANDER, fac = (C.REGIONS[region] || {}).faction; let kinds = Object.entries(W.weights).filter(([k]) => k !== 'patrol' || (fac && C.PATROLS[fac]));
    let total = kinds.reduce((a, [, w]) => a + w, 0), r = rnd(st) * total, kind = kinds[kinds.length - 1][0];
    for (const [k, w] of kinds) { if (r < w) { kind = k; break; } r -= w; }
    const base = { kind, region, from, to, day: st.world.day };
    if (kind === 'patrol') {
      const tier = S().standingTier(st, fac).id;
      if (tier === 'hostile') { const enc = wanderFight(st, region, 'patrol', { faction: fac, to }); enc.name = 'Patrol: ' + C.PATROLS[fac].name; return setWander(st, Object.assign(base, { kind: 'fight', enc, faction: fac, text: 'A ' + C.PATROLS[fac].name.toLowerCase() + ' has recognised you and will not let you pass.' })); }
      if (tier === 'friendly' || tier === 'allied') return setWander(st, Object.assign(base, { kind: 'gift', faction: fac, gold: 20 + 8 * partyLevel(st), tip: true, text: 'A ' + C.PATROLS[fac].name.toLowerCase() + ' greets you by name. They share what they know of the roads and press a few coins on you.' }));
      kind = 'event'; base.kind = 'event';
    }
    if (kind === 'fight') { const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, Object.assign(base, { enc, text: 'Armed strangers step onto the road ahead.' })); }
    if (kind === 'trader') return setWander(st, Object.assign(base, { trader: makeTrader(st), text: 'A wandering trader has pulled his cart off the road and is open for business.' }));
    const ev = pickRoadEvent(st, region);
    if (!ev) { const enc = wanderFight(st, region, 'fight', { to }); return setWander(st, Object.assign(base, { kind: 'fight', enc, text: 'Armed strangers step onto the road ahead.' })); }
    return setWander(st, Object.assign(base, { kind: 'event', choice: ev }));
  }
  function setWander(st, w) { st.world.wander = w; if (w.enc) C.ENCOUNTERS.wander = w.enc; return w; }
  C.activeWander = st => { const w = st.world.wander || null; if (w && w.enc) C.ENCOUNTERS.wander = w.enc; return w; };
  C.endWander = st => { st.world.wander = null; };
  // Run from a road fight: it costs time and a little gold, and you go on.
  C.flee = function (st) {
    const W = C.WANDER, lost = Math.min(st.inventory.gold, Math.max(st.inventory.gold ? 5 : 0, Math.round(st.inventory.gold * W.fleeGoldFraction)));
    const wv = st.world.wander, proof = wv && wv.enc && wv.enc.proofFor ? C.proofResult(st, wv.enc.proofFor, false) : null;
    st.inventory.gold -= lost; S().advanceDay(st, W.fleeDays); st.world.wander = null; return { ok: true, gold: lost, days: W.fleeDays, events: C.runEvents(st), proof };
  };
  // After losing a road fight the party wakes where it set out from.
  C.turnBack = function (st, from) { st.world.location = from; st.world.wander = null; };
  C.claimGift = function (st) { const w = st.world.wander; if (!w || w.kind !== 'gift') return { ok: false }; st.inventory.gold += w.gold; if (w.faction) S().changeStanding(st, w.faction, 5, { reason: 'friendly patrol' }); const found = w.tip ? C.revealAround(st, st.world.location, 2) : []; st.world.wander = null; return { ok: true, gold: w.gold, found }; };
  C.revealAround = function (st, id, depth) { const seen = new Set([id]); let f = [id], out = []; for (let d = 0; d < depth; d++) { const nx = []; f.forEach(x => Object.keys(C.NODES[x].links).forEach(y => { if (!seen.has(y)) { seen.add(y); nx.push(y); if (!C.isDiscovered(st, y)) { C.discover(st, y); out.push(y); } } })); f = nx; } return out; };
  C.traderBuy = function (st, itemId) { const t = st.world.wander && st.world.wander.trader; if (!t) return { ok: false, reason: 'No trader here' }; return S().buy(st, itemId, { stock: t.stock, mult: t.mult }); };

  // Move to a linked node. Passes the days (events may fire), discovers the node's neighbours and rolls the road for a chance meeting.
  // Returns { ok, days, events, wander }: if wander is set, something happens on the road before you arrive (the party is already at `to`; C.turnBack undoes it if the party is beaten).
  C.travel = function (st, to) {
    const from = st.world.location, days = C.travelCost(from, to);
    if (!days) return { ok: false, reason: 'No road from ' + from + ' to ' + to };
    if (!C.isDiscovered(st, to) && C.NODES[to].hidden && !st.world.flags['reveal_' + to]) return { ok: false, reason: 'You have not found that place yet' };   // an unmarked road out of where you stand can be followed; a hidden place cannot
    st.world.wander = null;
    if (C.NODES[from].dungeon) { const ds = dgState(st, C.NODES[from].dungeon); if (!ds.cleared) ds.stage = 0; }   // leaving a dungeon half-done: it closes up again
    const wander = C.rollWander(st, from, to, days);
    S().advanceDay(st, days); st.world.location = to; nodeState(st, to).visited = true;
    C.discover(st, to);   // arriving names the place; the roads out of it stay unmarked until you take them or hear of them
    S().markMet(st, C.ownerOf(st, to) || (C.REGIONS[C.NODES[to].region] || {}).faction);
    const revealed = autoReveal(st, to); C.lore(st, 'visit:' + to); C.loreSweep(st);
    const events = C.runEvents(st), sight = !wander && !events.length ? C.sight(st, from, to) : null; if (sight) events.push(sight);
    return { ok: true, days, from, events, wander, revealed };
  };
  C.dueEvents = st => C.EVENTS.filter(e => st.world.day >= e.day && !(st.world.flags['ev_' + e.id]));
  C.runEvents = function (st) {
    const fired = [];
    for (const e of C.dueEvents(st)) { st.world.flags['ev_' + e.id] = true; e.effect(st); fired.push({ id: e.id, text: e.text }); }
    return fired;
  };

  // ---- services at a node, by standing and owner ----
  // Who you can hire at a place: the race of its region. Only the races that are switched on can be hired.
  C.REGION_RACE = { dwarven_holds: 'dwarf', elven_realms: 'wood_elf', crownlands: 'human', free_marches: 'human', river_cities: 'human', voldun: 'human' };
  C.recruitRace = id => { const n = C.NODES[id], r = n && C.REGION_RACE[n.region]; return r && G().races[r] && G().races[r].active ? r : null; };
  const PRICE = { hostile: null, neutral: 1, friendly: 0.9, allied: 0.8 };
  const isHall = n => n.type === 'capital' || !!n.seat; // seats of a faction: capitals and halls
  C.nodeServices = function (st, id) {
    const n = C.NODES[id]; if (!n) return null;
    const owner = C.ownerOf(st, id), fac = n.faction || owner;
    const tier = fac && fac !== 'outlaws' ? S().standingTier(st, fac).id : 'neutral';
    const lost = owner === 'outlaws';
    const open = !lost && PRICE[tier] !== null && PRICE[tier] !== undefined;
    return {
      owner, tier, open,
      shop: n.shop && open ? (() => { const rs = C.rotateStock(st, id, n.shop.concat(n.shopFriendly && (tier === 'friendly' || tier === 'allied') ? n.shopFriendly : [])), ev = C.placeEvent(st, id), cal = C.calendar(st.world.day); return { stock: rs.stock, priceMult: Math.round(PRICE[tier] * C.shopMult(st, id) * 100) / 100, notes: rs.notes, event: ev && ev.mult !== 1 ? ev.name : null, festival: cal.festival && ['town', 'market', 'capital'].includes(n.type) ? cal.festival : null }; })() : null,
      recruit: n.recruit && open && C.recruitRace(id) ? { classes: S().entryClasses(), race: C.recruitRace(id) } : null,   // open unless Hostile (or besieged); the recruit's race is the region's
      join: isHall(n) && n.faction && !lost ? { faction: n.faction, can: S().tierIndex(tier) >= S().tierIndex(S().RULES.joinMinTier) } : null,
      encounter: encounterAvailable(st, id), choice: n.choice && !st.world.flags['choice_' + n.choice] && !(C.CHOICES[n.choice] && C.CHOICES[n.choice].job && !C.jobActive(st, C.CHOICES[n.choice].job)) ? n.choice : null,
      jobOffers: C.jobOffers(st, id), jobReports: C.jobReports(st, id),
      besieged: lost,
      tavern: C.hasTavern(id) && open && !lost ? { cost: C.calendar(st.world.day).festival ? 0 : C.TAVERN.cost, doneToday: (st.world.tavern || {})[id] === st.world.day } : null,
      dungeon: n.dungeon ? C.dungeonStatus(st, id) : null, bounty: C.bountyOptions(st, id)
    };
  };
  // Shopping at a node: stock and price multiplier come from the node's services (closed when hostile or besieged).
  C.buy = function (st, nodeId, itemId) {
    if (st.world.location !== nodeId) return { ok: false, reason: 'You are not there' };
    const sv = C.nodeServices(st, nodeId); if (!sv || !sv.shop) return { ok: false, reason: 'No shop open here' };
    const br = S().buy(st, itemId, { stock: sv.shop.stock, mult: sv.shop.priceMult }); if (br && br.ok) st.world.flags.g_buy = 1; return br;
  };
  // Any open shop buys from the stash at half the base price (standing does not change what you get for selling).
  C.sell = function (st, nodeId, itemId) {
    if (st.world.location !== nodeId) return { ok: false, reason: 'You are not there' };
    const sv = C.nodeServices(st, nodeId); if (!sv || !sv.shop) return { ok: false, reason: 'No shop open here' };
    return S().sell(st, itemId);
  };
  function encounterAvailable(st, id) {
    const n = C.NODES[id]; if (!n) return null;
    if (id === 'free_marches' && st.world.flags.marches_warned && !st.world.flags.marches_defended && !st.world.flags.marches_lost) return 'marches_defence';
    if (id === 'free_marches' && st.world.flags.marches_lost && !st.world.flags.marches_defended) return 'marches_defence';
    if (!n.encounter) return null;
    const e = C.ENCOUNTERS[n.encounter];
    if (e && e.job && (!C.jobActive(st, e.job) || st.world.flags[e.winFlag])) return null;
    return e && e.once && st.campaign.completed.includes(n.encounter) ? null : n.encounter;
  }

  // Resolve a choice node or a road event. Returns what changed (and fight: true when an option starts a battle).
  C.applyChoice = function (st, choiceId, optionId) {
    const c = C.CHOICES[choiceId]; let o = c && c.options.find(x => x.id === optionId);
    if (!o) return { ok: false, reason: 'Unknown choice' };
    if (o.stare) o = (st.party || []).length < 3 ? Object.assign({}, o, { fight: true }) : Object.assign({}, o, { gold: 15 });   // too few to frighten anyone: it comes to blows; otherwise they back off and drop their toll-pouch
    const keep = !c.road || c.once; // node choices and once-only road events are remembered
    if (keep && st.world.flags['choice_' + choiceId]) return { ok: false, reason: 'Already decided' };
    if (o.gold < 0 && st.inventory.gold < -o.gold) return { ok: false, reason: 'Not enough gold' };
    const changes = [];
    for (const [f, d] of Object.entries(o.standing || {})) changes.push(...S().changeStanding(st, f, d, { reason: c.text.slice(0, 24) }));
    if (o.gold) st.inventory.gold += o.gold;
    for (const [k, n] of Object.entries(o.items || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
    if (o.flag) st.world.flags[o.flag] = true; if (o.jobFlag) st.world.flags[o.jobFlag] = true;
    for (const [a, b, d, both] of o.relations || []) S().shiftRelation(st, a, b, d, { both });
    const found = o.reveal ? C.revealAround(st, st.world.location, 2) : o.revealNear ? C.revealAround(st, st.world.location, 1) : [];
    if (keep) st.world.flags['choice_' + choiceId] = optionId;
    let fight = false;
    if (c.road) { st.world.lastRoadEvent = choiceId; const w = st.world.wander; if (o.fight && w) { const enc = wanderFight(st, w.region, 'fight', { to: w.to }); st.world.wander = Object.assign({}, w, { kind: 'fight', enc, text: 'It turns violent.' }); C.ENCOUNTERS.wander = enc; fight = true; } else st.world.wander = null; }
    return { ok: true, changes, found, fight, gold: o.gold || 0 };
  };

  // Enemy builds for an encounter (option id for encounters that let the player pick a side).
  // ---- fight size: enemy count by tier, and how many of your party a map can hold (design/party_slots_and_recruiting.md) ----
  // A map holds as many per side as its smaller spawn list (the sides can be swapped). The tier is 3/4/5/6 by level (S.RULES.fightTiers).
  C.mapCap = mapId => { const m = G().maps && G().maps[mapId]; return m && m.spawns && m.spawns.P && m.spawns.E ? Math.min(m.spawns.P.length, m.spawns.E.length) : 3; };
  C.tierFor = lv => { let n = 3; for (const [from, size] of S().RULES.fightTiers) if ((lv || 1) >= from) n = size; return n; };
  C.partyLimit = (st, mapId) => Math.min(S().fightTier(st), C.mapCap(mapId));
  // A written fight of the standard three enemies fields the tier's size from its recommended level (4 from 11, 5 from 21, 6 from 31), as far as its map has room.
  // The extras copy the written enemies in turn (never the leader or a named character) and get their own kits. A fight flagged `small`, an arena bout and any
  // fight not written with three enemies keeps what it was written with.
  C.scaleEnemies = function (e, o) {
    const list = o.enemies || [];
    if (e.arena || e.small || o.small || list.length !== 3) return list;
    const want = Math.min(C.tierFor(e.rec || 1), C.mapCap(e.map)); if (want <= list.length) return list;
    const ob = o.objective || e.objective || null, lead = ob && ob.type === 'leader' ? (ob.leader || 0) : -1;
    const pool = list.filter((u, i) => i !== lead), out = list.slice();
    for (let i = 0; out.length < want; i++) { const c = Object.assign({}, (pool.length ? pool : list)[i % (pool.length || list.length)]); delete c.name; delete c.keepClass; delete c.skills; delete c.secSkills; out.push(c); }
    return out;
  };
  C.encounterBuilds = function (encId, optionId) {
    const e = C.ENCOUNTERS[encId]; if (!e) return null;
    const o = e.options ? e.options.find(x => x.id === optionId) : e; if (!o) return null;
    return { map: e.map, swap: !!e.swap, name: e.name, rec: e.rec, level: e.rec, objective: o.objective || e.objective || null, reward: o.reward || e.reward, standing: o.standing || null,
      builds: C.scaleEnemies(e, o).map((u, i) => ({ id: 'e' + (i + 1), level: e.rec || 1, name: u.name || G().classes[u.primary].name, faction: o.enemyFaction, primary: u.primary, secondary: u.secondary || null, passives: u.passives || [],
        gear: LO().cleanGear(u.primary, u.gear || LO().defaultGear(u.primary), u.passives || []) })) };
  };
  // One line for the briefing: how this fight is won.
  C.objectiveText = function (ob, builds) {
    if (!ob || ob.type === 'rout') return 'Defeat every enemy.';
    const lim = ob.limit ? ' Within ' + ob.limit + ' rounds.' : '';
    if (ob.type === 'leader') { const b = (builds || [])[ob.leader || 0]; return 'Defeat ' + (b ? b.name : 'the enemy leader') + ' (marked with a crown).' + lim; }
    if (ob.type === 'survive') return 'Survive ' + ob.turns + ' rounds. Defeating every enemy also wins.';
    if (ob.type === 'reach') return (ob.label ? ob.label + ': ' : '') + 'get a party member onto the marked tile.' + lim;
    if (ob.type === 'hold') return (ob.label ? ob.label + ': ' : '') + 'keep a party member on the marked ground, with no enemy on it, at the start of ' + ob.turns + ' rounds.' + lim;
    return '';
  };
  // Apply the extra campaign results of a won encounter (standing bonus for the chosen side, item drops, free marches defended flag).
  C.applyEncounterResult = function (st, encId, optionId, res) {
    const info = C.encounterBuilds(encId, optionId); if (!info) return { ok: false };
    const out = S().applyBattleResult(st, res, { node: encId === 'wander' ? null : encId, days: encId === 'wander' ? 0 : undefined, gold: info.reward && info.reward.gold, xp: info.reward && info.reward.xp, jp: info.reward && info.reward.jp, rec: info.rec });
    const E = C.ENCOUNTERS[encId]; let dungeon = null;
    if (E && E.dungeon) { const D = C.DUNGEONS[E.dungeon], ds = dgState(st, E.dungeon);
      if (res.won) { ds.stage = E.floor; if (E.floor >= D.floors.length) { ds.cleared = true; ds.clearedDay = st.world.day; ds.clears++; dungeon = { id: E.dungeon, floor: E.floor, final: true, respawn: D.respawn || null }; } else dungeon = { id: E.dungeon, floor: E.floor, final: false }; }
      else { ds.stage = 0; dungeon = { id: E.dungeon, floor: E.floor, failed: true }; } }
    if (res.won) { st.world.flags.g_fight = 1; if (E && E.winFlag) st.world.flags[E.winFlag] = true; }
    if (dungeon && dungeon.final) C.lore(st, 'dungeon:' + dungeon.id);
    const proof = E && E.proofFor ? C.proofResult(st, E.proofFor, !!res.won) : null;
    if (res.won) {
      for (const [k, n] of Object.entries((info.reward && info.reward.items) || {})) st.inventory.items[k] = (st.inventory.items[k] || 0) + n;
      for (const [f, d] of Object.entries(info.standing || {})) S().changeStanding(st, f, d, { reason: info.name });
      if (encId === 'marches_defence') { st.world.flags.marches_defended = true; const n = nodeState(st, 'free_marches'); n.owner = 'crown'; n.besieged = false; S().changeStanding(st, 'crown', 30, { reason: 'defended the Marches' }); S().changeStanding(st, 'syndicate', 30, { reason: 'defended the Marches' }); }
    }
    return { ok: true, awards: out, dungeon, proof };
  };


  // ---- Bestiary: what the party has learned about each creature by fighting it. Seen once = what it is; twice = how it fights; three times = what hurts it. ----
  const FAM = { beast: 'Beast', undead: 'Undead and spirit', elemental: 'Elemental and construct', dragon: 'Dragonkin and horror' };
  const HAB = { dire_wolf: 'Hill meadows and forest edges. Packs follow the wounded.', cave_bear: 'Cold hills and tarns. Dangerous mostly when hungry or cornered.', giant_spider: 'Glass hollows, fords and mist. They like places where travellers stop.',
    ghoul: 'Gallows, battlefields and cairns, wherever the dead are poorly kept.', banshee: 'Burial grounds and pyre-fields; the old griefs that did not end.', bone_archer: 'Old battlefields and barrows, still shooting at a war that ended.',
    fire_elemental: 'Vents, ash and hot springs, wherever the ground is thin.', stone_golem: 'Ruins and old galleries. Built to guard, and it has not been told it can stop.', storm_elemental: 'High towers and bare peaks where lightning gathers.',
    drake_whelp: 'Ash fields and vents. Young drakes hunt alone and sleep on warm stone.', basilisk: 'Sulphur pools and glassy hollows, stone-grey like the rocks it lies on.', maw_horror: 'Fog and the deep places. It is not clear where it comes from.',
    elder_drake: 'Old drakes keep to the hearts of mountains and come out for no one.', barrow_king: 'A crowned dead lord below an old barrow, who has not yet agreed to be dead.' };
  const VIEWS = { beast: { canopy: 'The Wardens say a wild thing is a neighbour, and a starved one a danger. They tame what they can and cull what they must.', crown: 'The Crown pays a bounty on anything that takes a farmer\'s stock.', syndicate: 'The Syndicate buys pelts and asks no questions about the source.' },
    undead: { synod: 'The Synod holds that the unquiet dead are a debt, and sends wardens to lay them to rest.', crown: 'The Crown would prefer rumours of walking dead were not spoken of in market squares.' },
    elemental: { anvil: 'The Guild studies them; some call it science and some call it trespass.', ironbound: 'The Holds say the old guardians were built by their own ancestors, and are not to be broken without cause.' },
    dragon: { crown: 'Crown tax-rolls list a drake as an act of god, not a thing a lord can do anything about.', ironbound: 'Hold-songs call drakes the oldest creditors of the mountain.' } };
  C.BEASTS = {}; Object.entries(G().classes).forEach(([id, c]) => { if (c.monster) C.BEASTS[id] = { id, name: c.name, family: c.family, famName: FAM[c.family], boss: !!c.boss, hab: HAB[id] || '', views: VIEWS[c.family] || {} }; });
  const beastSt = st => (st.world.beasts = st.world.beasts || {});
  C.beastTier = (st, id) => { const n = (beastSt(st)[id] || {}).n || 0; return n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0; };
  C.beastNote = (id, tier) => {
    const c = G().classes[id], B = C.BEASTS[id]; if (!c || !B) return null; const D = G(), t = c.traits || {}, out = { name: c.name, family: B.famName, hab: B.hab, boss: B.boss };
    if (tier >= 2) { out.moves = (c.ab || []).map(a => D.abilities[a].n + ': ' + D.abilities[a].desc); out.views = Object.entries(B.views).map(([f, x]) => ({ faction: f, text: x })); }
    if (tier >= 3) { const w = [], r = [];
      Object.entries(t.elemRes || {}).forEach(([e, v]) => { if (v < 0) w.push(e); else if (v >= 40) r.push(e); });
      const tough = []; if ((t.armor || 0) >= 30) tough.push('Blades barely scratch it.'); else if ((t.armor || 0) >= 15) tough.push('Thick hide: weapons bite less.'); if (t.rangedReduce) tough.push('Arrows lose force against it.'); if (t.pushImmune) tough.push('It cannot be shoved.');
      out.weak = w; out.resist = r; out.tough = tough; }
    return out;
  };
  // Every battle teaches: each monster kind in the fight counts once per battle (win or lose).
  { const prev = C.applyEncounterResult; C.applyEncounterResult = function (st, encId, optionId, res) {
    const out = prev.apply(this, arguments), info = C.encounterBuilds(encId, optionId), seen = new Set(), news = [];
    if (info) info.builds.forEach(b => { if (C.BEASTS[b.primary] && !seen.has(b.primary)) { seen.add(b.primary); const bs = beastSt(st), e = bs[b.primary] || (bs[b.primary] = { n: 0 }), t0 = C.beastTier(st, b.primary); e.n++; const t1 = C.beastTier(st, b.primary); if (t1 > t0) news.push({ id: b.primary, tier: t1 }); } });
    if (news.length) out.bestiary = news; return out; }; }
  C.bestiaryList = st => Object.keys(C.BEASTS).map(id => ({ id, tier: C.beastTier(st, id), note: C.beastNote(id, C.beastTier(st, id)) })).filter(x => x.tier > 0);

  // Monster quests: the wild comes to the village's door.
  Object.assign(C.JOBS, {
    bear_tarn: { name: 'The Bear at the Tarn', giver: 'general', at: 'elk_meadow', after: null, offer: 'A herdsman holds up a torn bell. "A bear took the lead ewe from the high pasture and the flock will not graze. It lairs near Snowmelt Tarn. It had a wolf with it, if you can believe that."',
      steps: [{ text: 'Drive the bear from Snowmelt Tarn', flag: 'job_bear_won' }], done: 'The flock grazes again. The herdsman gives you a fleece-lined cloak and what coin the village can spare.', reward: { gold: 70, standing: { canopy: 10 } } },
    gallows_ghouls: { name: 'What Walks at Gallows Hill', giver: 'general', at: 'hobbs_reach', after: null, offer: 'The reeve of Hobb\'s Reach will not meet your eye. "Graves have been opened at Gallows Hill. Not dug. Opened, from inside. We pay for the burying and the burying does not hold."',
      steps: [{ text: 'Put down whatever haunts Gallows Hill', flag: 'job_ghouls_won' }], done: 'The reeve has the hill blessed and the graves filled. A Synod warden thanks you, quietly.', reward: { gold: 80, standing: { synod: 15, crown: 5 } } }
  });
  C.ENCOUNTERS.gq_bear = { name: 'The Bear at Snowmelt Tarn', map: 'classic_ridge', rec: 4, enemyFaction: 'wild', once: true, job: 'bear_tarn', winFlag: 'job_bear_won', enemies: [{ primary: 'cave_bear', name: 'Tarn Bear' }, { primary: 'dire_wolf', name: 'Starving Wolf' }], reward: { xp: 90, gold: 20 } };
  C.ENCOUNTERS.gq_ghouls = { name: 'Gallows Hill ghouls', map: 'gallows_hill', rec: 4, enemyFaction: 'wild', once: true, job: 'gallows_ghouls', winFlag: 'job_ghouls_won', enemies: [{ primary: 'ghoul', name: 'Gallows Ghoul' }, { primary: 'ghoul', name: 'Gallows Ghoul' }, { primary: 'bone_archer', name: 'Hanged Archer' }], reward: { xp: 100, gold: 25 } };
  C.NODES.snowmelt_tarn.encounter = 'gq_bear'; C.NODES.gallows_hill.encounter = 'gq_ghouls';

  // Data checks: graph symmetry, legal enemies, valid maps, shops, starts, events. Returns a list of problems (empty = fine).
  C.validate = function () {
    const p = [], D = G();
    for (const [id, n] of Object.entries(C.NODES)) {
      if (!n.pos || n.pos[0] < 0 || n.pos[0] > 1 || n.pos[1] < 0 || n.pos[1] > 1) p.push(id + ': bad position');
      for (const [to, d] of Object.entries(n.links)) { if (!C.NODES[to]) p.push(id + ' links to unknown ' + to); else if (C.NODES[to].links[id] !== d) p.push(id + '<->' + to + ' links are not symmetric'); }
      if (n.faction && !D.factions[n.faction]) p.push(id + ': unknown faction');
      if (n.owner && !D.factions[n.owner]) p.push(id + ': unknown owner');
      if (n.encounter && !C.ENCOUNTERS[n.encounter]) p.push(id + ': unknown encounter');
      if (n.choice && !C.CHOICES[n.choice]) p.push(id + ': unknown choice');
      (n.shop || []).forEach(g => { if (!D.gear[g]) p.push(id + ': unknown shop item ' + g); else if (!D.gear[g].price) p.push(id + ': shop item without a price ' + g); });
    }
    const unit = (where, u) => { const c = D.classes[u.primary]; if (!c || (c.selectable === false && !c.monster)) p.push(where + ': illegal class ' + u.primary); };
    const checkObj = (where, e, o) => { const ob = o.objective || e.objective; if (!ob) return;
      if (!['rout', 'leader', 'survive', 'reach', 'hold'].includes(ob.type)) { p.push(where + ': unknown objective ' + ob.type); return; }
      if ((ob.type === 'survive' || ob.type === 'hold') && !(ob.turns > 0)) p.push(where + ': ' + ob.type + ' needs turns');
      if (ob.type === 'leader' && !(ob.leader >= 0 && ob.leader < (o.enemies || []).length)) p.push(where + ': leader index out of range');
      if ((ob.type === 'reach' || ob.type === 'hold') && !ob.tiles && !['centre', 'enemy_camp', 'player_camp'].includes(ob.zone)) p.push(where + ': needs a zone or tiles');
      if (ob.limit !== undefined && !(ob.limit > 0)) p.push(where + ': bad round limit'); };
    const checkEnc = (where, o) => { if (!o.enemies || !o.enemies.length || o.enemies.length > 3) p.push(where + ': needs 1-3 enemies'); (o.enemies || []).forEach(u => unit(where, u)); if (o.enemyFaction !== 'outlaws' && o.enemyFaction !== 'wild' && !D.factions[o.enemyFaction]) p.push(where + ': unknown enemy faction');
      for (const g of Object.keys((o.reward && o.reward.items) || {})) if (!D.gear[g]) p.push(where + ': unknown reward item ' + g);
      for (const f of Object.keys(o.standing || {})) if (!D.factions[f]) p.push(where + ': unknown standing faction ' + f); };
    for (const [id, e] of Object.entries(C.ENCOUNTERS)) {
      if (!D.maps[e.map]) p.push(id + ': unknown map ' + e.map);
      if (e.options) e.options.forEach(o => { checkEnc(id + '/' + o.id, o); checkObj(id + '/' + o.id, e, o); }); else { checkEnc(id, e); checkObj(id, e, e); }
    }
    for (const [id, e] of Object.entries(C.ENCOUNTERS)) if (e.map && !G().maps[e.map]) p.push('encounter ' + id + ': unknown map ' + e.map);
    for (const [id, n] of Object.entries(C.NODES)) if (n.type === 'zone' && !G().maps[id]) p.push('zone ' + id + ' has no battle map');
    Object.entries(C.REGION_POOL).forEach(([r, t]) => { if (Object.values(G().maps).filter(m => m.pool === t).length < 2) p.push('region ' + r + ': fewer than two road maps in pool ' + t); });
    Object.entries(C.LORE_ON).forEach(([ev, ids]) => ids.forEach(i => { if (!C.LORE[i]) p.push('lore trigger ' + ev + ': unknown entry ' + i); }));
    Object.values(C.LORE).forEach(e => { if (!D.factions[e.faction]) p.push('lore ' + e.id + ': unknown faction'); if (e.follow && (!C.NODES[e.follow.visit] || (e.follow.gives && !C.LORE[e.follow.gives]))) p.push('lore ' + e.id + ': bad follow-up'); if (e.truth === false && !e.falseText) p.push('lore ' + e.id + ': false rumour needs falseText'); });
    Object.entries(C.INFORMANTS).forEach(([k, i]) => { if (!C.NODES[i.at] || !C.LORE[i.evidence] || !C.LORE[i.proof] || !C.SECRETS[i.sid]) p.push('informant ' + k + ': bad data'); });
    Object.entries(C.SECRETS).forEach(([k, x]) => { if (!C.LORE[x.proof] || !D.factions[x.faction] || !D.factions[x.rival]) p.push('secret ' + k + ': bad data'); x.squad.forEach(sq => sq.forEach(u => { const c = D.classes[u.primary]; if (!c || c.selectable === false) p.push('secret ' + k + ': illegal class ' + u.primary); })); });
    Object.entries(C.NPCS).forEach(([k, n]) => n.route.forEach(r => { if (!C.NODES[r]) p.push('npc ' + k + ': unknown place ' + r); }));
    Object.entries(C.ENCOUNTERS).forEach(([k, e]) => { if (e.job && !C.JOBS[e.job]) p.push('encounter ' + k + ': unknown job ' + e.job); });
    for (const [id, j] of Object.entries(C.JOBS)) { if (!C.NODES[j.at]) p.push('job ' + id + ': unknown place ' + j.at); if (j.after && !C.JOBS[j.after]) p.push('job ' + id + ': unknown prerequisite'); if (j.giver !== 'general' && !D.factions[j.giver]) p.push('job ' + id + ': unknown giver'); (j.steps || []).forEach(x => { if (x.visit && !C.NODES[x.visit]) p.push('job ' + id + ': unknown visit ' + x.visit); if (x.tavern && !C.hasTavern(x.tavern)) p.push('job ' + id + ': no tavern at ' + x.tavern); if (x.clear && !C.DUNGEONS[x.clear]) p.push('job ' + id + ': unknown dungeon ' + x.clear); if (x.flag && !Object.values(C.ENCOUNTERS).some(e => e.winFlag === x.flag) && !Object.values(C.CHOICES).some(c => (c.options || []).some(o => o.jobFlag === x.flag))) p.push('job ' + id + ': nothing sets flag ' + x.flag); }); Object.keys((j.reward || {}).standing || {}).forEach(f => { if (!D.factions[f]) p.push('job ' + id + ': unknown standing faction ' + f); }); ((j.reward || {}).reveal || []).forEach(d => { if (!C.NODES[d] || !C.NODES[d].hidden) p.push('job ' + id + ': reveal target not hidden ' + d); }); }
    for (const [id, c] of Object.entries(C.CHOICES)) for (const o of c.options) { for (const f of Object.keys(o.standing || {})) if (!D.factions[f]) p.push(id + '/' + o.id + ': unknown faction'); for (const [a, b] of o.relations || []) if (!D.factions[a] || !D.factions[b]) p.push(id + '/' + o.id + ': unknown relation faction'); }
    for (const [r, t] of Object.entries(C.STARTS)) {
      if (!D.races[r]) p.push('start ' + r + ': unknown race'); if (!C.NODES[t.location]) p.push('start ' + r + ': unknown location');
      t.discovered.forEach(n => { if (!C.NODES[n]) p.push('start ' + r + ': unknown node ' + n); });
      Object.keys(t.standing).forEach(f => { if (!D.factions[f]) p.push('start ' + r + ': unknown faction ' + f); });
      t.recruits.forEach(u => unit('start ' + r, u));
      if (D.races[r] && D.races[r].home !== t.location && !t.crossroads) p.push('start ' + r + ': location differs from the race home');
    }
    for (const [r, g] of Object.entries(C.REGIONS)) { if (!(g.danger >= 0 && g.danger <= 3)) p.push('region ' + r + ': bad danger'); if (g.faction && !D.factions[g.faction]) p.push('region ' + r + ': unknown faction'); }
    for (const [id, n] of Object.entries(C.NODES)) if (!C.REGIONS[n.region]) p.push(id + ': unknown region ' + n.region);
    C.EDGES.forEach(([a, b, d]) => { if (!C.NODES[a] || !C.NODES[b]) p.push('edge ' + a + '-' + b + ': unknown node'); if (!(d >= 1 && d <= 5)) p.push('edge ' + a + '-' + b + ': bad days'); });
    const sets = C.FOE_SETS.concat(C.MONSTER_SETS).map(x => [x.id, x]).concat(Object.entries(C.PATROLS));
    sets.forEach(([id, x]) => { (x.enemies || []).forEach(u => unit('foe ' + id, u)); if (!x.enemies || x.enemies.length < 1 || x.enemies.length > 3) p.push('foe ' + id + ': needs 1-3 enemies'); if (x.faction && x.faction !== 'outlaws' && x.faction !== 'wild' && !D.factions[x.faction]) p.push('foe ' + id + ': unknown faction'); (x.regions || []).forEach(r => { if (!C.REGIONS[r]) p.push('foe ' + id + ': unknown region ' + r); }); (x.zones || []).forEach(z => { if (!C.NODES[z] || C.NODES[z].type !== 'zone') p.push('foe ' + id + ': unknown zone ' + z); }); });
    for (const f of Object.keys(C.PATROLS)) if (!D.factions[f]) p.push('patrol ' + f + ': unknown faction');
    for (const [id, d] of Object.entries(C.DUNGEONS)) { const n = C.NODES[id]; if (!n) { p.push('dungeon ' + id + ': no node'); continue; } if (!C.NODES[d.parent] || !n.links[d.parent]) p.push('dungeon ' + id + ': not linked to its parent'); if (Object.keys(n.links).length !== 1) p.push('dungeon ' + id + ': should be a leaf');
      if (!d.floors.length || !d.floors[d.floors.length - 1].boss) p.push('dungeon ' + id + ': last floor must be a boss'); if (d.faction && !D.factions[d.faction]) p.push('dungeon ' + id + ': unknown faction'); if (d.hidden && !d.reveal) p.push('dungeon ' + id + ': hidden needs a reveal rule'); }
    for (const [id, n] of Object.entries(C.NODES)) if (n.type === 'zone' && !(n.danger >= 0 && n.danger <= 3)) p.push(id + ': zone needs danger 0-3');
    for (const [id, c] of Object.entries(C.CHOICES)) if (c.road) { (c.regions || []).forEach(r => { if (!C.REGIONS[r]) p.push(id + ': unknown region ' + r); }); if (!c.options.some(o => !o.gold || o.gold >= 0)) p.push(id + ': every option costs gold, so a broke party is stuck'); }
    // every node reachable from every start
    for (const [r, t] of Object.entries(C.STARTS)) { const seen = new Set([t.location]), q = [t.location]; while (q.length) { const x = q.pop(); for (const y of Object.keys(C.NODES[x].links)) if (!seen.has(y)) { seen.add(y); q.push(y); } } if (seen.size !== Object.keys(C.NODES).length) p.push('start ' + r + ': not every node is reachable'); }
    return p;
  };

  window.GAME_CAMPAIGN = C;
  delete window.__CAMPAIGN_PARTS;
})();
