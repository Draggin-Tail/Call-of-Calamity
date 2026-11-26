/* The Sandring (design/arena.md): a neutral fighting ring on the south edge of the Crownlands.
   Step 2 of the build: the place, its roads, the ladder of four rings (12 bouts), purses, gate fees and level scaling.
   Step 3 adds side bets and the Grand Tourney (below). Not here yet: the seven arena-only uniques (step 4).
   Every bout is a campaign encounter (so enemy kits, gear tiers, XP and JP work as for any fight) with these extras:
     arena: { ring, bout }   hazards: 'light' | 'heavy' | 'full'   enemyFaction: 'wild' (inert: a ring fight never costs faction standing)
   Progress is the existing st.campaign.completed list (a bout id is in it once won), so saves need no new fields.
   Wraps nodeServices (adds .arena) and applyEncounterResult (a repeat win pays half gold and half XP; JP is halved by the core). */
(function () {
  function go() {
    const C = window.GAME_CAMPAIGN; if (!C || !C.nodeServices || !C.ENCOUNTERS || C.ARENA) return false; C.ARENA = true;
    const ID = 'the_sandring';

    // ---- the place ----
    C.NODES[ID] = { name: 'The Sandring', region: 'human', area: 'crownlands', type: 'market', owner: 'neutral', pos: [0.522, 0.570], links: {},
      desc: 'A walled ring of raked sand where the Kingsway meets the road south. Nobody owns it. The Crown, the Syndicate and the Synod each sponsor a team, and none of them will let the others run the gate, so a Sandmaster keeps the peace and takes the fee.',
      shop: ['iron_sword', 'halberd', 'katana', 'round_shield', 'chain_hauberk'] };
    if (C.MAP_POS) C.MAP_POS[ID] = [0.522, 0.570];
    // ---- the first visit: Tamsin says the rules out loud (once per save; no standing or gold changes) ----
    C.CHOICES.sandring_gate = { text: 'A woman in a sand-coloured coat stands at the gate with a tally board, counting heads as they go in. She sees your party, and does not look surprised.\n\n"Tamsin Reeve, Sandmaster. Gate fee at the door, purse at the end. Nobody is killed for the crowd. The sand is not so careful, so mind the floor. The Crown, the Syndicate and the Synod each pay for a team in here, and I take no side. Any of that you want explained?"',
      options: [
        { id: 'rules', label: '"How does it work?"', hint: 'Four rings, three bouts each. Win the third to open the next.', flag: 'sandring_rules', reply: '"Four rings. Three bouts in each, and the third is the rank match. Win it and the next ring opens. Fight a won bout again and the purse is half. The Grand Tourney comes round every twelve days. Read the board inside."' },
        { id: 'floor', label: '"What did you mean, the floor?"', hint: 'The traps are in plain sight, and they hurt both sides.', flag: 'sandring_floor', reply: '"Everything on the sand is drawn where you can see it, and it hurts whoever stands on it, you or them. Fire and jets show a round before they hit. The sand can finish a fighter, so do not stand where I have told you not to."' },
        { id: 'bets', label: '"Can I back myself?"', hint: 'The bookmaker at the gate takes wagers. Tamsin never does.', flag: 'sandring_bets', reply: '"The bookmaker takes a quarter of your gold at most. You may back yourselves to win, to win clean, or to win quick. I never bet. It would not be fair on the ring."' },
        { id: 'pay', label: 'Pay the fee and go in', hint: 'Nothing more to ask.', flag: 'sandring_pay', reply: '"Fifteen for the Pit. Keep your feet off the plates." She chalks a mark on the board and waves you through.' }
      ] };
    C.NODES[ID].choice = 'sandring_gate';
    if (C.MAP_POS) C.MAP_POS[ID] = [0.522, 0.570];
    ['willow_flats', 'arch_mile', 'tithe_barn'].forEach(o => { if (!C.NODES[o]) throw new Error('arena: unknown neighbour ' + o); C.EDGES.push([ID, o, 1]); C.NODES[ID].links[o] = 1; C.NODES[o].links[ID] = 1; });

    // ---- the ladder ----
    const RINGS = [
      { id: 'pit', name: 'The Pit', map: 'sandring_pit', band: [2, 4], fee: 15, needs: null,
        warn: ['Spike plates are bare in the lanes. Whoever steps on one is hurt and slowed.', 'More plates in the lanes tonight. Mind the Needle.', 'Every plate is out. The way through the middle is narrow.'],
        bouts: [
          { name: 'The Chained Pack', purse: 60, xp: 50, enemies: [{ primary: 'cave_bear', name: 'Pit Bear' }, { primary: 'dire_wolf', name: 'Chained Wolf' }, { primary: 'dire_wolf', name: 'Chained Wolf' }] },
          { name: 'The Mudhall Three', purse: 85, xp: 60, enemies: [{ primary: 'squire', name: 'Dunn Garrow' }, { primary: 'scout', name: 'Perrin Lowe' }, { primary: 'apprentice', name: 'Wick Sallow' }] },
          { name: 'Bram Kessel, Champion of the Pit', purse: 190, xp: 100, enemies: [{ primary: 'warrior', name: 'Bram Kessel' }, { primary: 'archer', name: 'Ness Tolliver' }, { primary: 'acolyte', name: 'Brother Gant' }] }] },
      { id: 'sand', name: 'The Sand', map: 'sandring_sand', band: [5, 7], fee: 25, needs: 'pit',
        warn: ['The moat is soft sand. The causeway is firm, and it is the only firm way up.', 'More of the moat has gone soft tonight. The dunes are the dry way round.', 'The whole moat is soft. Hold a causeway or hold a dune.'],
        bouts: [
          { name: 'The Salt Dogs', purse: 100, xp: 90, enemies: [{ primary: 'rogue', name: 'Tam Saltreeve' }, { primary: 'archer', name: 'Ivo Brine' }, { primary: 'warrior', name: 'Hob Cutler' }] },
          { name: 'The Dune Choir', purse: 130, xp: 100, enemies: [{ primary: 'shaman', name: 'Mother Sable' }, { primary: 'druid', name: 'Rafe Ostler' }, { primary: 'scout', name: 'Tess Rooke' }] },
          { name: 'Orsolya Kent, Champion of the Sand', purse: 255, xp: 150, enemies: [{ primary: 'berserker', name: 'Orsolya Kent' }, { primary: 'marksman', name: 'Hal Garrity' }, { primary: 'cleric', name: 'Sister Ottoline' }] }] },
      { id: 'gold', name: 'The Gold Circle', map: 'sandring_gold', band: [8, 11], fee: 40, needs: 'sand',
        warn: ['The jets fire every other round along two lanes. The rim and the hub are safe.', 'Three lanes are lit in turn tonight. Do not cross on the beat.', 'All four lanes fire together. Stay on the rim or the hub.'],
        bouts: [
          { name: 'The Brass Lanterns', purse: 160, xp: 140, enemies: [{ primary: 'warrior', name: 'Enid Brass' }, { primary: 'wizard', name: 'Loric Dray' }, { primary: 'cleric', name: 'Sister Moll' }] },
          { name: 'Vesper and Company', purse: 195, xp: 160, enemies: [{ primary: 'assassin', name: 'Vesper Doyle' }, { primary: 'spellbow', name: 'Cadoc Fern' }, { primary: 'bulwark', name: 'Big Aldous' }] },
          { name: 'Isaura Quennell, Champion of the Gold Circle', purse: 440, xp: 220, enemies: [{ primary: 'blood_knight', name: 'Isaura Quennell' }, { primary: 'stormcaller', name: 'Tessaly Roke' }, { primary: 'cleric', name: 'Father Orin' }] }] },
      { id: 'gate', name: "The Champion's Gate", map: 'sandring_gate', band: [12, 14], fee: 50, needs: 'gold',
        warn: ['The outer floor catches fire in the sixth round, and the fire climbs from there. The centre never burns.', 'The fire starts in the fifth round tonight. Take the stairs early.', 'The fire starts in the fourth round. Nobody stalls in this ring. Make for the dais.'],
        bouts: [
          { name: 'The Stone Watch', purse: 250, xp: 200, enemies: [{ primary: 'paladin', name: 'Sir Dunstan Tolland' }, { primary: 'zen_archer', name: 'Lio Tamsen' }, { primary: 'warden', name: 'Rhea Dunmore' }] },
          { name: 'Chalk and Flint', purse: 275, xp: 220, enemies: [{ primary: 'shadowmage', name: 'Wren Chalk' }, { primary: 'enchanter', name: 'Aubry Flint' }, { primary: 'sentinel', name: 'Gorm Ketch' }] },
          { name: 'Casimir Thole, Champion of the Gate', purse: 690, xp: 300, enemies: [{ primary: 'warlord', name: 'Casimir Thole' }, { primary: 'ranger', name: 'Yselle Dane' }, { primary: 'necro', name: 'Mortimer Pyke' }] }] }
    ];
    const LAYOUT = ['light', 'heavy', 'full'];
    C.ARENA_RINGS = RINGS;
    RINGS.forEach(R => R.bouts.forEach((b, i) => {
      b.id = 'arena_' + R.id + '_' + (i + 1); b.ring = R.id; b.n = i + 1; b.layout = LAYOUT[i];
      C.ENCOUNTERS[b.id] = { name: b.name, map: R.map, rec: R.band[0], enemyFaction: 'wild', arena: { ring: R.id, bout: i + 1 }, hazards: b.layout, enemies: b.enemies, reward: { xp: b.xp, gold: b.purse } };
    }));
    const ringOf = id => RINGS.find(r => r.id === id), boutOf = id => { for (const R of RINGS) { const b = R.bouts.find(x => x.id === id); if (b) return b; } return null; };
    C.arenaBout = boutOf; C.arenaRing = ringOf;

    // ---- state: a bout is won once its id is in st.campaign.completed ----
    const won = (st, id) => st.campaign.completed.includes(id);
    C.arenaBoutWon = won;
    C.arenaRingOpen = (st, ringId) => { const R = ringOf(ringId); return !!R && (!R.needs || won(st, 'arena_' + R.needs + '_3')); };
    C.arenaBoutOpen = (st, id) => { const b = boutOf(id); return !!b && C.arenaRingOpen(st, b.ring) && (b.n === 1 || won(st, 'arena_' + b.ring + '_' + (b.n - 1))); };
    C.arenaPartyLevel = st => { const us = (st.party || []).map(i => st.roster.find(u => u.id === i)).filter(Boolean); return us.length ? us.reduce((a, u) => a + u.level, 0) / us.length : 1; };
    // levels follow the party inside the ring's band; the rank match is one level up
    C.arenaLevel = (st, id) => { const b = boutOf(id), R = ringOf(b.ring), l = Math.round(C.arenaPartyLevel(st)) + (b.n === 3 ? 1 : 0); return Math.max(R.band[0], Math.min(R.band[1], l)); };
    C.arenaStatus = st => RINGS.map(R => ({ id: R.id, name: R.name, fee: R.fee, band: R.band, open: C.arenaRingOpen(st, R.id), needs: R.needs && ringOf(R.needs).name,
      bouts: R.bouts.map(b => ({ id: b.id, n: b.n, name: b.name, purse: b.purse, layout: b.layout, won: won(st, b.id), open: C.arenaBoutOpen(st, b.id), pay: won(st, b.id) ? Math.floor(b.purse / 2) : b.purse })) }));
    // what the Sandmaster and the crowd say before the bout (words, not numbers)
    C.arenaBrief = (st, id) => {
      const b = boutOf(id), R = ringOf(b.ring), lv = C.arenaLevel(st, id), mine = C.arenaPartyLevel(st), gap = lv - mine;
      const crowd = gap >= 1.5 ? 'The crowd fancies the other side. You are the underdogs tonight.' : gap <= -1.5 ? 'The crowd likes you. They think this will be quick.' : 'The crowd cannot split you. Bets are even.';
      return { warn: R.warn[b.n - 1], crowd, level: lv };
    };
    // pay the gate fee and set the level; the fee is kept on a loss, a draw or a retreat
    const AS = st => { const f = st.world.flags; return f.arena || (f.arena = { wagersWon: 0, titles: 0, bet: null, t: null }); };
    C.arenaState = AS;
    // ---- side bets (before any bout): back yourselves (even), a clean win (two to one), quick work (two to one) ----
    const BETS = { back: { name: 'Back yourselves', mult: 1, line: 'You win. Pays even money.' }, clean: { name: 'A clean win', mult: 2, line: 'You win and nobody in your party is knocked out, the sand included. Pays two to one.' },
      quick: { name: 'Quick work', mult: 2, line: 'You win within the round limit. Pays two to one.' } };
    C.ARENA_BETS = BETS;
    C.arenaQuickN = id => { const b = boutOf(id); return b.ring === 'gate' ? [9, 8, 7][b.n - 1] : b.ring === 'pit' ? 8 : 10; };
    // the most a wager can be: three wander fights' pay at the party's level (so a stake keeps its size against pay), and never more than a quarter of the gold
    C.arenaBetMax = st => { const lv = Math.max(1, Math.round(C.arenaPartyLevel(st))); return C.goldFor ? Math.round(3 * C.goldFor(lv) / 5) * 5 : 45 * lv; };
    C.arenaBetCap = st => Math.max(0, Math.min(Math.floor(st.inventory.gold / 4), C.arenaBetMax(st)));
    C.arenaUnderdog = (st, id) => C.arenaLevel(st, id) - C.arenaPartyLevel(st) >= 1.5;
    // the share of the winnings the stake earns: the house keeps a tenth, and an underdog bet pays half again
    C.arenaPayout = (stake, type, under) => stake + Math.floor(stake * BETS[type].mult * (under ? 1.5 : 1) * 0.9);
    C.arenaEnter = (st, id, bet) => {
      const b = boutOf(id); if (!b) return { ok: false, reason: 'No such bout' };
      if (st.world.location !== ID) return { ok: false, reason: 'You are not at the Sandring' };
      if (!(st.party || []).length) return { ok: false, reason: 'You have no party' };
      if (!C.arenaBoutOpen(st, id)) return { ok: false, reason: 'That bout is not open yet' };
      const fee = ringOf(b.ring).fee; if (st.inventory.gold < fee) return { ok: false, reason: 'The gate fee is ' + fee + ' gold' };
      let stake = 0;
      if (bet && bet.type) {
        if (!BETS[bet.type]) return { ok: false, reason: 'No such wager' };
        stake = Math.floor(bet.stake || 0); const cap = Math.max(0, Math.min(Math.floor((st.inventory.gold - fee) / 4), C.arenaBetMax(st)));
        if (stake < 1 || stake > cap) return { ok: false, reason: 'The bookmaker will take 1 to ' + cap + ' gold from you' };
      }
      st.inventory.gold -= fee + stake; C.ENCOUNTERS[id].rec = C.arenaLevel(st, id);
      AS(st).bet = stake ? { id, type: bet.type, stake, under: C.arenaUnderdog(st, id), n: C.arenaQuickN(id) } : null;
      return { ok: true, fee, stake };
    };

    // ---- services: always open, never closed to the Hostile ----
    const ns0 = C.nodeServices;
    C.nodeServices = function (st, id) {
      const sv = ns0.apply(this, arguments); if (!sv || id !== ID) return sv;
      sv.owner = null; sv.open = true; sv.besieged = false; sv.arena = true; return sv;
    };

    // ---- a repeat win pays half gold and half XP (the core halves JP for completed encounters) ----
    const ar0 = C.applyEncounterResult;
    C.applyEncounterResult = function (st, encId, optId, res) {
      const E = C.ENCOUNTERS[encId];
      if (!E || !E.arena) return ar0.apply(this, arguments);
      const repeat = !E.arena.tourney && won(st, encId), orig = E.reward;
      if (repeat) E.reward = { xp: Math.floor((orig.xp || 0) / 2), gold: Math.floor((orig.gold || 0) / 2) };
      let r; try { r = ar0.apply(this, arguments); } finally { E.reward = orig; }
      if (E.arena.tourney) { st.campaign.completed = st.campaign.completed.filter(x => x !== encId); r.tourney = tourneyResult(st, res); return r; } // each round pays in full every window
      const A = AS(st), bet = A.bet; A.bet = null;
      if (bet && bet.id === encId) {
        const knocked = (res.kills || []).some(k => k.victimTeam === 'P'), rounds = res.rounds || res.turns;
        let ok = false; if (res.won && !res.draw) ok = bet.type === 'back' || (bet.type === 'clean' && !knocked) || (bet.type === 'quick' && rounds <= bet.n);
        if (res.draw) { st.inventory.gold += bet.stake; r.wager = { type: bet.type, stake: bet.stake, result: 'draw', payout: bet.stake }; }
        else if (ok) { const pay = C.arenaPayout(bet.stake, bet.type, bet.under); st.inventory.gold += pay; A.wagersWon++; r.wager = { type: bet.type, stake: bet.stake, result: 'won', payout: pay, under: bet.under }; }
        else r.wager = { type: bet.type, stake: bet.stake, result: 'lost', payout: 0, why: res.won ? (bet.type === 'clean' ? 'someone went down' : 'too slow') : 'you did not win' };
      }
      return r;
    };
    // ---- the Grand Tourney: lists open 4 days in every 12; 8 teams, 3 rounds on the Sand, the Gold Circle and the Gate (full layouts) ----
    const T = { every: 12, open: 4, fee: 65, prizes: [135, 220, 480], xp: [100, 180, 300], maps: ['sandring_sand', 'sandring_gold', 'sandring_gate'], rings: ['sand', 'gold', 'gate'], names: ['Round one, on the Sand', 'Round two, on the Gold Circle', 'The Final, on the Champion\u2019s Gate'] };
    C.ARENA_TOURNEY = T;
    const TEAMS = [
      { id: 'ninth_banner', name: 'The Ninth Banner', rating: 8, line: 'Crown-sponsored knights in plate. They hold a stair head until someone pays to move them.', enemies: [{ primary: 'paladin', name: 'Sir Evander Lisle' }, { primary: 'bulwark', name: 'Ewan Holt' }, { primary: 'warrior', name: 'Cass Merrow' }] },
      { id: 'fair_count', name: 'The Fair Count', rating: 6, line: 'Syndicate-sponsored. Rogues and archers who take the high ground first and a fixer who plays the odds.', enemies: [{ primary: 'rogue', name: 'Silas Quarrel' }, { primary: 'archer', name: 'Pip Odell' }, { primary: 'enchanter', name: 'Mr Tally' }] },
      { id: 'chalk_circle', name: 'The Chalk Circle', rating: 7, line: 'Synod-licensed mages who bind and silence. They like to slow you in the moat.', enemies: [{ primary: 'wizard', name: 'Ondine Chalk' }, { primary: 'shadowmage', name: 'Brisk Havel' }, { primary: 'enchanter', name: 'Mavis Teague' }] },
      { id: 'redline_riders', name: 'The Redline Riders', rating: 6, line: 'Broken Banner spears and halberds, hard on the flank.', enemies: [{ primary: 'warrior', name: 'Garrick Redline' }, { primary: 'berserker', name: 'Tobin Spur' }, { primary: 'scout', name: 'Lark Wennel' }] },
      { id: 'lamp_wardens', name: 'The Lamp Wardens', rating: 5, line: 'Hearthwatch healers who refuse the killing blow. They lose nothing and wear you down.', enemies: [{ primary: 'cleric', name: 'Sister Wick' }, { primary: 'warden', name: 'Hollis Lamp' }, { primary: 'acolyte', name: 'Brother Ansel' }] },
      { id: 'free_company', name: 'The Free Company', rating: 4, line: 'Sellswords with no sponsor and nothing to lose.', enemies: [{ primary: 'squire', name: 'Dusty Mercer' }, { primary: 'ranger', name: 'Neve Arrow' }, { primary: 'shaman', name: 'Old Marl' }] },
      { id: 'house_champion', name: 'The House Champion', rating: 9, line: 'The Sandmaster\u2019s own champion and her two best.', enemies: [{ primary: 'warlord', name: 'Jory Varrow' }, { primary: 'stormcaller', name: 'Ivy Lorn' }, { primary: 'cleric', name: 'Abbot Loam' }] }
    ];
    C.ARENA_TEAMS = TEAMS;
    for (let i = 0; i < 3; i++) C.ENCOUNTERS['arena_t_' + (i + 1)] = { name: T.names[i], map: T.maps[i], rec: 5, enemyFaction: 'wild', arena: { tourney: i + 1 }, hazards: 'full', enemies: TEAMS[0].enemies, reward: { xp: T.xp[i], gold: T.prizes[i] } };
    const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const teamOf = id => TEAMS.find(t => t.id === id);
    C.arenaWindow = day => { const idx = Math.floor(day / T.every), start = idx * T.every, openNow = day - start < T.open; return { idx, open: openNow, closes: start + T.open, next: openNow ? start : start + T.every }; };
    C.arenaTourneyStatus = st => {
      const A = AS(st), w = C.arenaWindow(st.world.day), run = A.t && A.t.win === w.idx ? A.t : null;
      return { window: w, run, entered: !!run, canEnter: w.open && !run, fee: T.fee, daysToOpen: Math.max(0, w.next - st.world.day) };
    };
    // the bracket is drawn once, from the save and the window, so a reload gives the same eight teams and the same results
    function drawBracket(st, win) {
      const rnd = rng(hash(win + '|' + (st.roster[0] ? st.roster[0].id + st.roster[0].name : 'x'))), order = TEAMS.map(t => t.id);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const beat = (a, b) => rnd() < teamOf(a).rating / (teamOf(a).rating + teamOf(b).rating) ? a : b;
      const w2 = beat(order[1], order[2]), w3 = beat(order[3], order[4]), w4 = beat(order[5], order[6]), semi2 = beat(w3, w4);
      return { slots: order, opp: [order[0], w2, semi2], others: { m2: [order[1], order[2], w2], m3: [order[3], order[4], w3], m4: [order[5], order[6], w4], semi2: [w3, w4, semi2] } };
    }
    // enter the lists: the fee, and an optional stake that pays by the round you reach
    C.arenaTourneyEnter = (st, stake) => {
      const S0 = C.arenaTourneyStatus(st); stake = Math.floor(stake || 0);
      if (st.world.location !== ID) return { ok: false, reason: 'You are not at the Sandring' };
      if (!(st.party || []).length) return { ok: false, reason: 'You have no party' };
      if (!S0.canEnter) return { ok: false, reason: S0.entered ? 'You have already entered these lists' : 'The lists are closed' };
      const cap = Math.max(0, Math.min(Math.floor((st.inventory.gold - T.fee) / 4), C.arenaBetMax(st)));
      if (st.inventory.gold < T.fee) return { ok: false, reason: 'The entry fee is ' + T.fee + ' gold' };
      if (stake < 0 || stake > cap) return { ok: false, reason: 'The bookmaker will take up to ' + cap + ' gold from you' };
      st.inventory.gold -= T.fee + stake;
      AS(st).t = { win: S0.window.idx, round: 1, wins: 0, stake, status: 'active', bracket: drawBracket(st, S0.window.idx), log: [] };
      return { ok: true, fee: T.fee, stake };
    };
    C.arenaTourneyLevel = (st, round) => { const [lo, hi] = ringOf(T.rings[round - 1]).band, a = Math.round(C.arenaPartyLevel(st)); return round === 3 ? Math.max(lo, Math.min(hi, a)) + 1 : Math.max(lo, Math.min(hi, a)); };
    // set the next round's fight (opponents, level) and return its encounter id
    C.arenaTourneyNext = st => {
      const t = AS(st).t; if (!t || t.status !== 'active') return null;
      const id = 'arena_t_' + t.round, E = C.ENCOUNTERS[id], team = teamOf(t.bracket.opp[t.round - 1]);
      E.enemies = team.enemies; E.name = T.names[t.round - 1] + ': ' + team.name; E.rec = C.arenaTourneyLevel(st, t.round); return { id, team };
    };
    function tourneyResult(st, res) {
      const A = AS(st), t = A.t; if (!t || t.status !== 'active') return null;
      if (res.draw) return { draw: true, round: t.round };           // a draw: the round is fought again
      if (!res.won) { t.status = 'out'; return settle(st, t, { out: true, round: t.round }); }
      const team = t.bracket.opp[t.round - 1]; t.wins++; t.log.push(team); const round = t.round;
      if (t.round === 3) { t.status = 'champion'; A.titles++; if (team === 'house_champion') A.houseBeaten = 1; return settle(st, t, { champion: true, round, team }); }
      t.round++; return { won: true, round, next: t.round };
    }
    function settle(st, t, out) { // the stake pays by the round reached: out in round one loses it; 1x, 2x, 4x back for 1, 2 or 3 wins
      if (t.stake) { const mult = [0, 1, 2, 4][t.wins], profit = Math.max(0, mult - 1) * t.stake, pay = mult ? t.stake + Math.floor(profit * 0.9) : 0; st.inventory.gold += pay; out.stake = { stake: t.stake, payout: pay, wins: t.wins }; }
      return out;
    }
    C.arenaTourneyTeam = teamOf;
    return true;
  }
  if (!go() && typeof setTimeout === 'function') { let n = 0; (function wait() { if (go()) return; if (++n < 400) setTimeout(wait, 25); })(); }
})();
