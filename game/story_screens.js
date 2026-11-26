/* Story screens: the scene sheet for everything the human story rules (data/intrigue*.js, faction_work.js, faction_climax.js, story_world.js) ask of the player.
   Loaded by data/factions.js after the rule files; needs no edit to index.html or shell.js. It sits beside the campaign shell:
   - no button of its own: the shell's Journal tab (bottom bar) lists what needs you, your contracts beside your jobs, leads, leverage and the Moot;
     a place's sheet on the map shows its contract board and anything you can do there (your hold, lying low); the Factions tab shows how the realm sees you;
   - a sheet opens by itself when a scene, a story fight or news is waiting and the shell has nothing else up, and to show what an action did;
   - story fights (scene fights use the road-fight slot) run through the same battle page and report back through C.applyEncounterResult;
   - on Brielle's road, a "hide her" button is added to the shell's road-fight sheet.
   Portrait only, one column (max 480px), tap targets of 44px or more. Plain DOM, no libraries. */
(function () {
  'use strict';
  let tries = 0;
  (function wait() {
    const C = window.GAME_CAMPAIGN, S = window.GAME_SAVE, SH = window.GAME_SHELL;
    if (C && S && SH && C.STORY_WORLD && C.MOVES && document.body && document.getElementById('shell')) return init(C, S, SH);
    if (++tries < 600) setTimeout(wait, 50);
  })();

  function init(C, S, SH) {
    if (window.GAME_STORY_SCREENS) return;
    const D = window.GAME_DATA;
    const ST = () => SH.state();
    let open = false, tab = 'now', flash = null, lastAuto = '', claimant = null, dropArm = null;
    const news = [];

    // ---------- helpers ----------
    function h(tag, props) {
      const e = document.createElement(tag); props = props || {};
      for (const k of Object.keys(props)) {
        const v = props[k]; if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'text') e.textContent = v; else if (k === 'disabled') e.disabled = !!v; else e.setAttribute(k, v === true ? '' : v);
      }
      for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
      return e;
    }
    function add(e, c) { if (c === undefined || c === null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(e, x)); else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
    const btn = (text, fn, cls, dis) => h('button', { class: 'sb ' + (cls || ''), onclick: fn, disabled: dis, text });
    const gap = n => h('div', { style: 'height:' + (n || 6) + 'px' });
    const why = t => t ? h('div', { class: 'dim', style: 'font-size:12px;margin:2px 0 6px', text: t }) : gap();
    const fname = f => (D.factions[f] ? D.factions[f].name : f === 'player' ? 'You' : f);
    const node = id => (C.NODES[id] ? C.NODES[id].name : id);
    const cname = id => (D.classes && D.classes[id] ? D.classes[id].name : id);
    const WHO = { voss: 'Lord Marshal Voss', crane: 'Factor Crane', ilvane: 'Archon Ilvane', agathe: 'Mother Agathe', old_standard: 'Captain Old Standard', osric: 'Lord Osric', corisande: 'Lady Corisande', thorne: 'Inquisitor-Captain Thorne', harrow: 'Steward Harrow', wil: 'Wil Fenn', brielle: 'Brielle Hale', hask: 'Hask' };
    const who = id => WHO[id] || (id ? String(id).replace(/_/g, ' ').replace(/(^| )./g, c => c.toUpperCase()) : '');
    const claimName = c => (c === 'broken' ? 'No one (a broken Moot)' : C.MOOT.claimants[c] ? C.MOOT.claimants[c].name : c);
    const save = () => { try { S.saveSlot('auto', ST()); } catch (e) { /* storage may be blocked */ } };
    const changes = r => { const ch = (r && r.changes) || []; const vis = S.visibleChanges ? S.visibleChanges(ST(), ch) : ch; return vis.map(c => fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + (S.tierOf && c.to !== undefined && S.tierOf(c.to).name ? ' (now ' + S.tierOf(c.to).name + ')' : '')); };
    function toast(msg, bad) { const t = document.getElementById('sh-toast') || document.getElementById('ss-toast'); if (!t) return; t.textContent = msg; t.style.borderColor = bad ? 'var(--foe)' : 'var(--gold)'; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 2800); }
    const inGame = () => !!document.querySelector('#shell.on .sh-tabs');
    const shellSheetUp = () => !!document.querySelector('#sh-sheet.on');
    const here = () => ST().world.location;
    const fl = () => ST().world.flags;
    // after any rule call: save, redraw the shell under us, show the outcome at the top of the sheet
    // what the player had when the sheet was last drawn: anything a choice changes shows up even when the rule does not report it
    let snap = null;
    const takeSnap = () => { const st = ST(); if (st) snap = { stand: Object.assign({}, st.factions.standing), gold: st.inventory.gold, gw: S.getGoodwill ? S.getGoodwill(st) : null }; };
    function diffLines(r) {
      const st = ST(), out = []; if (!snap) return out;
      const gold = st.inventory.gold - snap.gold; if (gold && !r.gold) out.push((gold > 0 ? '+' : '') + gold + ' gold');
      if (!(r.changes && r.changes.length)) Object.keys(Object.assign({}, snap.stand, st.factions.standing)).forEach(f => { const d = (st.factions.standing[f] || 0) - (snap.stand[f] || 0); if (d && D.factions[f] && f !== 'outlaws') out.push(fname(f) + ' ' + (d > 0 ? '+' : '') + d + (S.tierOf && S.tierOf(st.factions.standing[f] || 0).name ? ' (now ' + S.tierOf(st.factions.standing[f] || 0).name + ')' : '')); });
      const g = S.getGoodwill ? S.getGoodwill(st) : null; if (g !== null && snap.gw !== null && g !== snap.gw) out.push('Hearthwatch goodwill ' + (g > snap.gw ? '+' : '') + (g - snap.gw));
      return out;
    }
    function did(r, title, extra) {
      if (!r || r.ok === false) { toast((r && r.reason) || 'Not possible', true); return false; }
      save(); SH.render();
      const lines = [].concat(r.gold ? [(r.gold > 0 ? '+' : '') + r.gold + ' gold'] : [], r.recruit ? [r.recruit + ' joins your roster.'] : [], changes(r), diffLines(r), extra || []);
      flash = { title: title || 'Done', text: r.text || '', lines };
      if (!open) openSheet('now'); else draw(); return true;
    }

    // ---------- styles ----------
    document.head.appendChild(h('style', { text: `
#ss-sheet{position:fixed;inset:0;z-index:42;background:rgba(0,0,0,.55);display:none;justify-content:center;align-items:flex-end;font:15px/1.4 system-ui,sans-serif;color:var(--ink)}
#ss-sheet.on{display:flex}#ss-sheet *{box-sizing:border-box}
#ss-sheet .p{background:var(--bg);border-top:2px solid var(--gold);border-radius:16px 16px 0 0;width:100%;max-width:480px;max-height:90%;display:flex;flex-direction:column}
#ss-sheet .ph{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;gap:8px}
#ss-sheet .ph h2{margin:0;font-size:17px}
#ss-sheet .pb{overflow-y:auto;padding:12px;padding-bottom:calc(16px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
#ss-sheet .q,#shell .q{margin:6px 0;padding-left:10px;border-left:3px solid var(--line);font-style:italic}
#ss-sheet .who,#shell .who{font-size:12px;color:var(--gold);letter-spacing:.06em;text-transform:uppercase}
#ss-sheet .card.urg,#shell .card.urg{border-color:var(--gold)}#ss-sheet .card.foe,#shell .card.foe{border-color:var(--foe)}
#ss-sheet .seat,#shell .seat{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}#ss-sheet .seat:last-child,#shell .seat:last-child{border:0}
#ss-sheet .meter,#shell .meter{height:6px;background:var(--rock);border-radius:3px;overflow:hidden;margin:4px 0}#ss-sheet .meter>i,#shell .meter>i{display:block;height:100%}
#ss-sheet select,#shell select{width:100%;min-height:44px;background:var(--rock);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:15px}
#ss-toast{position:fixed;left:12px;right:12px;bottom:calc(120px + env(safe-area-inset-bottom));z-index:43;background:#0b1218;border:1px solid var(--gold);border-radius:10px;padding:10px 12px;font-size:14px;display:none;text-align:center;color:var(--ink)}
` }));
    const sheetEl = h('div', { id: 'ss-sheet', onclick: e => { if (e.target.id === 'ss-sheet') closeSheet(); } });
    document.body.appendChild(sheetEl); document.body.appendChild(h('div', { id: 'ss-toast' }));


    // ---------- the Moot, explained ----------
    // When the Moot is called the player is told, in a scene, what it is and what to do. The plan stays in the Journal until the Moot is counted.
    const MOOT_VOICE = { lords: 'voss', writ: 'voss', petition: 'harrow', wil: 'old_standard', debts: 'crane', ward: 'ilvane', people: 'agathe', second: 'voss' };
    const mootLiveNow = st => { const m = C.mootState(st); return m.called && !m.resolved && !st.world.realm; };
    const primerKey = st => { const r = st.world.moot || {}; return (r.n || 0) + ':' + r.called; };
    const primerDue = st => mootLiveNow(st) && st.world.flags.moot_primer !== primerKey(st);
    function mootJobsOpen(st) { return Object.keys(C.JOBS).filter(id => C.JOBS[id].moot && !C.jobActive(st, id) && !C.jobDone(st, id) && C.NODES[C.JOBS[id].at] && C.isDiscovered(st, C.JOBS[id].at)); }
    function mootSteps(st) {
      const m = C.mootState(st), seats = Object.entries(C.MOOT.seats).filter(([id, s]) => !s.seatedOnly || m.seatedBanner), worked = seats.filter(([id]) => m.canvass[id]).length, jobs = mootJobsOpen(st), out = [];
      const bannerKnown = !!(S.getRank(st, 'broken_banner') || (st.world.jobs && st.world.jobs.old_standards_price) || (S.isMet && S.isMet(st, 'broken_banner')));
      out.push({ done: worked >= seats.length, text: 'Win over the seats: ' + worked + ' of ' + seats.length + ' moved. Visit each one in person; the Moot page says where. Persuade (they must think well of you), bargain (do a favour for them) or pressure (spend proof or a secret; they will not forgive it).' });
      if (jobs.length) out.push({ done: false, text: 'Favours that win a seat are offered at ' + jobs.map(id => node(C.JOBS[id].at)).filter((x, i, a) => a.indexOf(x) === i).join(', ') + '.' });
      if (C.MOOT.seats.banner && !m.seatedBanner && bannerKnown) out.push({ done: false, text: 'The Broken Banner has no seat unless someone vouches for them at the gates.' });
      out.push({ done: false, text: 'When you are ready, stand in Crown Keep and ask the Moot to sit. After that no one can be swayed. You lay your proof before the seats and say whom you stand for.' });
      return out;
    }
    function mootPlanCard(st, withButtons) {
      if (!mootLiveNow(st)) return null; const m = C.mootState(st); if (m.open || (m.hall && m.hall.pending)) return null;
      return h('div', { class: 'card', style: 'border-color:var(--gold)' }, h('b', { text: 'The Moot is called: what to do' }),
        mootSteps(st).map(x => h('div', { class: x.done ? 'dim' : '', style: 'margin-top:4px', text: (x.done ? '✓ ' : '○ ') + x.text })),
        withButtons ? [gap(8), h('div', { class: 'row' }, btn(here() === 'crown_keep' ? 'You are at Crown Keep' : 'Show Crown Keep', () => { if (SH.showOnMap) SH.showOnMap('crown_keep'); }, 'grow', here() === 'crown_keep'), btn('Open the Moot page', () => { if (SH.openJournal) SH.openJournal('moot'); }, 'grow pri'))] : null);
    }
    function mootPrimerCard(st) {
      if (fl().moot_places !== primerKey(st)) { fl().moot_places = primerKey(st); if (C.mootRevealPlaces) C.mootRevealPlaces(st); }   // saves that already had a called Moot get the seats put on the map too
      const m = C.mootState(st), w = MOOT_VOICE[m.by] || 'voss', done = () => { fl().moot_primer = primerKey(st); save(); };
      return h('div', { class: 'card urg' }, h('div', { class: 'who', text: who(w) }),
        h('div', { text: C.MOOT.calls[m.by] || 'The bell has rung at Crown Keep.' }), gap(8),
        h('div', { text: 'The realm has had no king for years. Now five seats will meet at Crown Keep to choose who rules: the Lords, the Syndicate, the Synod, the Hearthwatch and, if someone can bring them through the gates, the Broken Banner. Each votes for its own interest.' }), gap(6),
        h('div', { text: 'The day is yours to choose. Nothing forces it. But if no one moves the seats, the Steward keeps the seal and the Interval goes on for good.' }), gap(8),
        h('b', { text: 'What you can do' }), mootSteps(st).map(x => h('div', { style: 'margin-top:4px', text: '• ' + x.text })), gap(8),
        h('div', { class: 'row' }, btn('Show Crown Keep', () => { done(); closeSheet(); if (SH.showOnMap) SH.showOnMap('crown_keep'); }, 'grow'), btn('Open the Moot page', () => { done(); closeSheet(); if (SH.openJournal) SH.openJournal('moot'); }, 'grow pri')), gap(6),
        btn('I understand', () => { done(); draw(); SH.render(); }, 'full'));
    }
    // the Moot is run in person: each seat at its own place, the sitting at Crown Keep
    function mootHereCard(st) {
      if (!mootLiveNow(st)) return null; const m = C.mootState(st), at = here(), out = []; if (m.hall && m.hall.pending) return null;
      if (!m.open) Object.entries(C.MOOT.seats).forEach(([id, s]) => { if (seatVisible(m, s) && C.seatPlaces(id).includes(at)) out.push(seatCard(st, id)); });
      if (at === 'crown_keep') {
        if (m.open) { out.push(h('div', { class: 'card urg' }, h('b', { text: 'The Moot is sitting' }), h('div', { class: 'dim', text: 'The doors are closed. Lay your proof before the seats, then say whom you stand for.' })), sittingCards(st, m)); }
        else {
          const bannerKnown = !!(S.getRank(st, 'broken_banner') || (st.world.jobs && st.world.jobs.old_standards_price) || (S.isMet && S.isMet(st, 'broken_banner')));
          if (C.MOOT.seats.banner && !m.seatedBanner && bannerKnown) out.push(h('div', { class: 'card' }, h('b', { text: 'Seat the Broken Banner' }), h('div', { class: 'dim', text: 'Outlaws cannot walk into Crown Keep. Someone has to vouch for them.' }), gap(),
            C.bannerSeatOptions(st).map(o => [btn(o.label, () => did(C.seatBanner(st, o.id), 'The Banner is seated'), 'full', !o.ok), why(o.ok ? '' : o.why)])));
          out.push(h('div', { class: 'card urg' }, h('b', { text: 'The Moot waits for you' }), h('div', { class: 'dim', text: 'Once it sits, no one more can be swayed. Visit the seats first if you mean to.' }), gap(),
            btn('See where the seats are', () => { if (SH.openJournal) SH.openJournal('moot'); }, 'full'), gap(), btn('Ask the Moot to sit', () => did(C.mootOpen(st), 'The Moot sits', ['The doors close. Lay any proof before the Lords, then say whom you stand for.']), 'pri full')));
        }
      }
      return out.length ? out : null;
    }

    // ---------- what is waiting ----------
    const sceneFight = st => { const w = st.world.wander; return w && w.kind === 'fight' && w.enc && w.from === w.to ? w : null; };
    function waiting(st) {
      const out = [], m = C.mootState(st), hd = st.world.hold;
      if (sceneFight(st)) out.push('fight:' + sceneFight(st).enc.name + ':' + st.world.day);
      const sc = C.secretScene(st); if (sc) out.push('secret:' + sc.kind + ':' + sc.faction);
      const mv = C.moveBeat(st); if (mv) out.push('move:' + mv.id);
      const cs = C.contractScene(st); if (cs) out.push('contract:' + cs.contract);
      if (primerDue(st)) out.push('moot_primer');
      if (m.hall && m.hall.pending) out.push('hall');
      if (hd && hd.reclaim) out.push('reclaim');
      if (hd && hd.siege && !hd.lost) out.push('siege');
      if (C.holdOffers(st).length) out.push('hold_offer');
      if (news.length) out.push('news:' + news.length);
      if (!m.called && !st.world.realm && C.mootCallReasons(st).some(r => (C.MOOT.manualCalls || ['petition']).includes(r))) out.push('can_call');
      return out;
    }

    // ---------- the sheet ----------
    function openSheet(t) { if (t) tab = t; open = true; draw(); }
    function closeSheet() { const was = open; open = false; flash = null; sheetEl.classList.remove('on'); sheetEl.innerHTML = ''; if (was && SH.render && ST()) SH.render(); tick(); }
    function draw() {
      if (!open) { if (SH && SH.render) SH.render(); return; }
      const st = ST(); if (!st) return closeSheet();
      const prev = sheetEl.querySelector('.pb'), top = prev && !flash ? prev.scrollTop : 0;
      const urgent = urgentCards(st);
      if (!flash && !urgent.length) return closeSheet();
      const body = h('div', { class: 'pb' });
      sheetEl.innerHTML = '';
      sheetEl.appendChild(h('div', { class: 'p' },
        h('div', { class: 'ph' }, h('div', {}, h('h2', { text: urgent.length ? 'Something needs you' : 'What happened' }), h('div', { class: 'dim', text: node(here()) + ' · day ' + st.world.day })), btn('Close', closeSheet, 'sm')), body));
      if (flash) add(body, flashCard());
      add(body, urgent);
      if (urgent.length) add(body, h('div', { class: 'dim', style: 'font-size:12px;margin:6px 2px', text: 'If you close this, it waits for you under Journal.' }));
      sheetEl.classList.add('on'); body.scrollTop = top; takeSnap();
    }
    function flashCard() {
      const f = flash;
      return h('div', { class: 'card urg' }, h('b', { text: f.title }), f.text ? h('div', { style: 'margin-top:4px', text: f.text }) : null, f.lines.map(t => h('div', { class: 'dim', text: t })), gap(), btn('OK', () => { flash = null; draw(); }, 'sm pri'));
    }
    const quote = t => h('div', { class: 'q', text: t });

    // ---------- Now ----------
    function nowTab(st) { return urgentCards(st).concat(placeCards(st)); }
    function urgentCards(st) {
      const out = [], hd = st.world.hold, at = here();
      const f = sceneFight(st); if (f) out.push(fightCard(st, f));
      const sc = C.secretScene(st); if (sc) out.push(secretCard(st, sc));
      const mv = C.moveBeat(st); if (mv) out.push(moveCard(mv));
      const cs = C.contractScene(st); if (cs) out.push(contractSceneCard(cs));
      if (primerDue(st) && !f && !mv && !cs) out.push(mootPrimerCard(st));
      const m = C.mootState(st); if (m.hall && m.hall.pending && !f) out.push(hallCard(m));
      if (hd && hd.reclaim) out.push(h('div', { class: 'card foe' }, h('div', { class: 'who', text: 'A herald at your gate' }), h('div', { text: fname(hd.backer) + ' want ' + node(hd.node) + ' back. You turned on them, they say, and a gift can be taken back.' }), gap(8),
        btn('Hand it over quietly', () => did(C.holdReclaim(st, 'quiet'), 'You give up the hold', ['Your stash is kept safe at any Hearthwatch house.']), 'full'), gap(),
        btn('Refuse (they will lay siege)', () => did(C.holdReclaim(st, 'refuse'), 'You refuse', ['They will come for it. Be at the hold to defend it.']), 'full bad'), gap(),
        btn('Appeal to the crown you made', () => did(C.holdReclaim(st, 'appeal'), 'The ruler remembers', ['Your standing with them is mended to Neutral.']), 'full pri', hd.appealed || C.moot(st).declared !== (st.world.realm || {}).outcome),
        why(hd.appealed ? 'You have appealed once already.' : C.moot(st).declared !== (st.world.realm || {}).outcome ? 'Only if you declared for the ruler.' : '')));
      if (hd && hd.siege && !hd.lost && !f) out.push(h('div', { class: 'card foe' }, h('div', { class: 'who', text: 'Your hold is under siege' }), h('div', { text: fname(hd.siege.by) + ' are at the walls of ' + node(hd.node) + '. Hold out five rounds, or lose it.' }), gap(8),
        at === hd.node ? btn('Defend the walls', () => { const r = C.holdSiegeFight(st); if (!r.ok) return toast(r.reason, true); save(); draw(); }, 'pri full') : h('div', { class: 'dim', text: 'Travel to ' + node(hd.node) + ' to defend it.' })));
      if (hd && hd.lost && at === hd.node && !f) {
        const party = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).primary), sneak = party.some(p => ['rogue', 'scout', 'assassin'].includes(p)) || (S.goodwillTier && S.goodwillTier(st).id === 'trusted');
        out.push(h('div', { class: 'card foe' }, h('div', { class: 'who', text: 'Your old gate' }), h('div', { text: fname(hd.takenBy) + ' hold ' + node(hd.node) + ' now. You could take it back.' }), gap(8),
          btn('Storm the gate (hard)', () => { const r = C.retakeHoldFight(st, 'gate'); if (!r.ok) return toast(r.reason, true); save(); draw(); }, 'full'), gap(),
          btn('The side door', () => { const r = C.retakeHoldFight(st, 'door'); if (!r.ok) return toast(r.reason, true); save(); draw(); }, 'full pri', !sneak), why(sneak ? '' : 'Needs a rogue or scout in the party, or the Hearthwatch\'s trust.')));
      }
      const offers = C.holdOffers(st); if (offers.length) out.push(h('div', { class: 'card urg' }, h('div', { class: 'who', text: 'The Kingmaker\'s reward' }), h('div', { text: 'The new ruler offers you a hold of your own. Pick one.' }), gap(8),
        offers.map(o => [btn(o.name, () => did(C.grantHold(st, o.id), 'A hold of your own', ['It sells at a discount, keeps a stash, and hides you while you lie low.']), 'full'), gap()])));
      if (news.length) out.push(h('div', { class: 'card' }, h('div', { class: 'who', text: 'Word reaches you' }), news.map(n => h('div', { style: 'margin:6px 0' }, n.title ? h('b', { text: n.title }) : null, h('div', { text: n.text }))), gap(), btn('Got it', () => { news.length = 0; draw(); }, 'sm')));
      return out;
    }
    // things you can do where you stand (shown in the place's own sheet on the map)
    function peopleCards(st) {
      const out = [], at = here();
      // people waiting for you here: a scene you closed, put off, or that came due while you stood here
      const f0 = sceneFight(st); if (f0) out.push(h('div', { class: 'card foe' }, h('div', { class: 'who', text: f0.enc.name }), h('div', { class: 'dim', text: 'The fight is still waiting for you here.' }), gap(), btn('Face it', () => openSheet('now'), 'pri full')));
      if (C.movesHere && !f0) C.movesHere(st, at).forEach(m => out.push(h('div', { class: 'card urg' }, h('div', { class: 'who', text: who(m.who) || 'Someone' }), h('div', { class: 'dim', text: m.pending ? 'Is waiting for your answer.' : 'Wants a word with you.' }), gap(),
        btn(m.pending ? 'Answer' : 'Talk', () => { if (!m.pending && !C.startMove(st, m.id)) return toast('Not now', true); save(); openSheet('now'); }, 'pri full'))));
      return out;
    }
    function placeCards(st) {
      const out = [], hd = st.world.hold, at = here();

      const hs = C.holdServices(st, at); if (hs) out.push(holdCard(st, hs));
      if (hd && hd.safe && Object.keys(hd.safe).length && C.ownerOf(st, at) === 'hearthwatch') out.push(h('div', { class: 'card' }, h('b', { text: 'Kept for you' }), h('div', { class: 'dim', text: 'The Hearthwatch saved what was in your hold\'s stash.' }), gap(), btn('Collect it', () => did(C.claimSafe(st), 'Collected'), 'pri full')));
      if (C.ownerOf(st, at) === 'hearthwatch' && (S.listRanks(st) || []).some(r => r.secret)) out.push(h('div', { class: 'card' }, h('b', { text: 'Lie low' }), h('div', { class: 'dim', text: 'Two quiet days in a Hearthwatch house. Both sides of a double life lose the scent a little.' }), gap(), btn('Lie low (2 days)', () => did(C.lieLow(st, 2), 'Two quiet days', ['Suspicion cools on both sides.']), 'full')));
      return out;
    }
    function moveCard(mv) {
      return h('div', { class: 'card urg' }, mv.who ? h('div', { class: 'who', text: who(mv.who) }) : null, h('div', { style: 'margin:4px 0;white-space:pre-line', text: mv.setup }), (mv.lines || []).filter(Boolean).map(quote), gap(8),
        mv.options.map(o => [btn(o.label, () => did(C.chooseMove(ST(), o.id), mv.who ? who(mv.who) : 'It is done'), 'full'), o.hint ? h('div', { class: 'dim', style: 'font-size:12px;margin:3px 4px 8px;font-style:italic', text: o.hint }) : gap()]));
    }
    function contractSceneCard(cs) {
      return h('div', { class: 'card urg' }, h('div', { class: 'who', text: 'Contract: ' + cs.name }), h('div', { style: 'margin:4px 0;white-space:pre-line', text: cs.setup }), gap(8),
        cs.options.map(o => [btn(o.label, () => did(C.contractChoose(ST(), o.id), cs.name), 'full', !o.ok), !o.ok ? why('Not enough gold.') : o.hint ? h('div', { class: 'dim', style: 'font-size:12px;margin:3px 4px 8px;font-style:italic', text: o.hint }) : gap()]));
    }
    function secretCard(st, sc) {
      const F = fname(sc.faction), title = sc.kind === 'test' ? F : sc.side === 'cover' ? F + ': they know' : F + ': found out';
      return h('div', { class: 'card foe' }, h('div', { class: 'who', text: title }), h('div', { style: 'margin:4px 0;white-space:pre-line', text: sc.setup }),
        h('div', { class: 'dim', text: sc.kind === 'test' ? '' : sc.side === 'cover' ? 'If they unmask you, your true allegiance is out in the open.' : 'If this goes badly you lose your secret rank.' }), gap(8),
        sc.options.filter(o => o.ok || o.id !== 'see').map(o => [btn(o.label, () => { const r = C.secretChoose(ST(), o.id); if (!r.ok) return toast(r.reason, true); if (r.fight) { save(); return draw(); }
          did(r, r.kept === false ? 'Unmasked' : r.passed === false ? 'You failed them' : sc.kind === 'test' ? 'Test passed' : 'You got away with it', [].concat(r.revealed ? ['You are known now as ' + fname(r.revealed) + '.'] : [], r.bounty ? ['They have put a price on you.'] : [])); }, 'full', !o.ok), o.ok && o.hint ? h('div', { class: 'dim', style: 'font-size:12px;margin:3px 4px 8px;font-style:italic', text: o.hint }) : why(o.ok ? '' : o.why)]));
    }
    function holdCard(st, hs) {
      const inv = st.inventory.items || {}, stash = hs.stash || {}, iname = g => (D.gear && D.gear[g] ? D.gear[g].name : g);
      return h('div', { class: 'card' }, h('b', { text: C.holdName(st, here()) || 'Your hold' }), h('div', { class: 'dim', text: 'Its shop sells at ' + Math.round(100 - C.MOOT.holdShopMult * 100) + '% off. Recruits come from ' + fname(hs.recruitFrom) + '.' }), gap(),
        btn('Lie low here (3 days)', () => did(C.holdLieLow(st, 3), 'Three quiet days', ['Secret suspicion cools.']), 'full'),
        h('details', { style: 'margin-top:8px' }, h('summary', { class: 'dim', text: 'Stash (' + Object.values(stash).reduce((a, b) => a + b, 0) + ' kept here)' }),
          Object.keys(stash).map(g => h('div', { class: 'row', style: 'margin:4px 0' }, h('span', { class: 'grow', text: iname(g) + (stash[g] > 1 ? ' ×' + stash[g] : '') }), btn('Take', () => { const r = C.holdStash(st, g, 'out'); if (r.ok) { save(); draw(); } }, 'sm'))),
          Object.keys(inv).map(g => h('div', { class: 'row', style: 'margin:4px 0' }, h('span', { class: 'grow dim', text: iname(g) + (inv[g] > 1 ? ' ×' + inv[g] : '') }), btn('Store', () => { const r = C.holdStash(st, g, 'in'); if (r.ok) { save(); draw(); } }, 'sm')))));
    }

    // ---------- story fights ----------
    const LEAVE = { badPaper: 'Back off for now', holdRetake: 'Not today' };
    function fightCard(st, w) {
      C.activeWander(st); const info = C.encounterBuilds('wander', null), party = (st.party || []).map(id => st.roster.find(u => u.id === id)).filter(Boolean);
      const leave = Object.keys(LEAVE).find(k => w.enc[k]);
      return h('div', { class: 'card foe' }, h('div', { class: 'who', text: w.enc.name }), w.text ? h('div', { style: 'margin:4px 0', text: w.text }) : null,
        h('div', { class: 'dim', text: 'Enemies: ' + info.builds.map(b => (b.name ? b.name + ' (' + cname(b.primary) + ')' : cname(b.primary)) + ' Lv ' + b.level).join(', ') }),
        h('div', { class: 'dim', text: 'Your party: ' + party.map(u => u.name + ' Lv ' + u.level).join(', ') }),
        info.objective && C.objectiveText ? h('div', { class: 'gold', text: 'Objective: ' + C.objectiveText(info.objective, info.builds) }) : null,
        info.reward ? h('div', { class: 'dim', text: 'Reward: ' + [info.reward.xp ? info.reward.xp + ' XP' : '', info.reward.gold ? info.reward.gold + ' gold' : ''].filter(Boolean).join(', ') }) : null, gap(8),
        btn('Fight', runFight, 'pri full', !party.length), leave ? [gap(), btn(LEAVE[leave], () => { C.endWander(st); save(); SH.render(); draw(); }, 'full')] : null);
    }
    function shellOn(on) { const s = document.getElementById('shell'); if (s) s.classList.toggle('on', on); document.body.classList.toggle('campaign', on || !!window.__campaignBattle); }
    function runFight() {
      const st = ST(); C.activeWander(st); const w = st.world.wander, info = C.encounterBuilds('wander', null), builds = S.partyBuilds(st);
      takeSnap(); const tag = { hall: w.enc.hall, holdSiege: !!w.enc.holdSiege, holdRetake: !!w.enc.holdRetake, badPaper: !!w.enc.badPaper, exposure: w.enc.exposure, name: w.enc.name };
      open = false; sheetEl.classList.remove('on');
      window.__campaignBattle = true; shellOn(false);
      const top = document.querySelector('#top span');
      if (top && !document.getElementById('sh-retreat')) top.appendChild(h('button', { id: 'sh-retreat', class: 'a sm', text: 'Retreat', onclick: e => { const b = e.currentTarget; if (b.dataset.arm) { window.Battle.abort(); return; } b.dataset.arm = '1'; b.textContent = 'Tap again to retreat (counts as a defeat)'; setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.textContent = 'Retreat'; } }, 3000); } }));
      window.Battle.start({ map: info.map, swapSides: info.swap, objective: info.objective, hideOverlay: true, placement: true, playerBuilds: builds, enemyBuilds: info.builds,
        onEnd: res => { window.__campaignBattle = false; const rb = document.getElementById('sh-retreat'); if (rb) rb.remove(); afterFight(tag, res); } });
    }
    function afterFight(tag, res) {
      const st = ST(), r = C.applyEncounterResult(st, 'wander', null, res) || {}, aw = r.awards || {}, won = !!res.won;
      if (!won) S.advanceDay(st, 1); C.endWander(st); save(); shellOn(true); SH.render();
      const lines = (aw.xpAwards || []).map(x => { const u = st.roster.find(v => v.id === x.unit); return (u ? u.name : x.unit) + ' +' + x.gained + ' XP' + (x.levelUps ? ', now level ' + x.to + '!' : ''); });
      let text = won ? tag.name + ' is won.' : 'You are beaten. A day passes while you recover.';
      if (tag.hall) { const rs = C.mootState(st); text = (won ? 'The hall is yours. ' : 'The hall is lost. ') + 'The Moot\'s result stands as: ' + (st.world.realm ? C.REALM[st.world.realm.outcome].ruler : claimName(rs.result)) + '.'; if (fl().bounty_crown === st.world.day && tag.hall === 'coup' && !won) lines.push('The Crown has outlawed you.'); }
      if (tag.holdSiege) text = won ? 'The walls hold. ' + node(st.world.hold.node) + ' is still yours.' : 'The walls fall. Your hold is lost, though the Hearthwatch saved your stash.';
      if (tag.holdRetake) text = won ? 'Your banner goes back up over ' + node(st.world.hold.node) + '.' : 'They hold the gate. You can try again.';
      if (tag.badPaper) text = won ? 'The notes burn. Dov Quill will file this under "settled".' : 'The guards drive you out. The notes are still there.';
      if (tag.exposure && r.exposure) { const x = r.exposure; text = x.kept ? 'You fight your way clear. They will not say it to your face again, for now.' : 'You get out alive, but it is over: you have lost your place with ' + fname(tag.exposure) + '.'; if (x.revealed) lines.push('You are known now as ' + fname(x.revealed) + '.'); if (x.bounty) lines.push('They have put a price on you.'); }
      (r.drops || []).forEach(i => { const g = window.GAME_DATA.gear[i]; lines.push('Found: ' + (g ? g.name : i)); }); if (r.purse) lines.push('Found: ' + r.purse + ' gold in a dead foe\'s purse');
      lines.push(...changes({ changes: aw.standingChanges }), ...diffLines({ changes: aw.standingChanges, gold: (aw.gold || 0) }));
      flash = { title: won ? 'Victory' : 'Defeat', text, lines }; openSheet('now');
    }
    function hallCard(m) {
      const decl = m.declared;
      return h('div', { class: 'card foe' }, h('div', { class: 'who', text: 'The Hall of Oaths' }), h('div', { text: 'The count says ' + claimName(m.hall.winner) + '. Steel at the back of the hall: Osric\'s men have barred the doors.' }), gap(8),
        btn('Defend the result', () => { const r = C.mootHallFight(ST(), 'defend'); if (!r.ok) return toast(r.reason, true); save(); tab = 'now'; draw(); }, 'pri full'), gap(),
        btn('Join Osric\'s men', () => { const r = C.mootHallFight(ST(), 'coup'); if (!r.ok) return toast(r.reason, true); save(); tab = 'now'; draw(); }, 'bad full', decl !== 'osric'), why(decl !== 'osric' ? 'Only those who declared for Osric can join him.' : 'If you lose, the Crown outlaws you.'));
    }

    // ---------- Moot ----------
    // No spoilers: a seat's leaning shows only once you have learned it (you canvassed it, you hold a rank with them, or they count you a friend).
    // Nobody knows the result until the votes are counted.
    function knowsSeat(st, seat) {
      const s = C.MOOT.seats[seat], f = s.faction; if (C.mootState(st).canvass[seat]) return true;
      if (f === 'hearthwatch') return !!(S.goodwillTier && S.goodwillTier(st).id === 'trusted');
      if (S.getRank(st, f)) return true; const t = S.standingTier(st, f).id; return t === 'friendly' || t === 'allied';
    }
    function tallyBlock(st, t) {
      return h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: 'The seats' }), h('span', { class: 'dim', text: t.need + ' votes win' })),
        t.seats.map(s => { const k = knowsSeat(st, s.seat);
          return h('div', { class: 'seat' }, h('div', { class: 'grow' }, h('div', { text: s.name + ' (' + s.votes + ')' }), h('div', { class: 'dim', style: 'font-size:12px', text: !k ? 'You do not know their mind' : s.how === 'abstain' ? 'Will not vote' : s.how === 'free' ? 'Leaning' : s.how === 'swayed' ? 'Swayed by you' : 'Pressured by you' })),
            h('b', { class: k && s.vote ? '' : 'dim', text: !k ? 'Unknown' : s.vote ? claimName(s.vote) : '—' })); }),
        h('div', { class: 'dim', style: 'font-size:12px;margin-top:6px', text: 'Visit a seat, hold a rank with them, or win their friendship to learn how they lean. No one knows the result until the votes are counted.' }));
    }
    // ---------- the seats, met in person ----------
    const pickClaimant = (st, stand) => { if (!claimant || !stand.includes(claimant)) claimant = stand.includes(C.moot(st).backing) ? C.moot(st).backing : stand[0]; };
    const seatVisible = (m, s) => !s.seatedOnly || m.seatedBanner;
    // the Moot page only says where each seat is and how it stands; the canvassing itself happens at their own place
    function seatsWhere(st, m) {
      return h('div', { class: 'card' }, h('b', { text: 'Where to find the seats' }), Object.entries(C.MOOT.seats).filter(([id, s]) => seatVisible(m, s)).map(([id, s]) => { const done = m.canvass[id], ps = C.seatPlaces(id), p = ps.find(x => C.isDiscovered(st, x)) || ps[0];
        return h('div', { class: 'seat' }, h('div', { class: 'grow' }, h('div', { text: s.name + ' · ' + s.speaker }), h('div', { class: done ? 'good' : 'dim', style: 'font-size:12px', text: done ? (done.how === 'pressure' ? 'Pressured' : done.how === 'bargain' ? 'Bargained with' : 'Persuaded') + ' for ' + claimName(done.for) : 'Not yet worked. Find them at ' + ps.map(node).join(' or ') + '.' })),
          p && C.isDiscovered(st, p) ? btn(here() === p ? 'Open' : 'Show', () => { if (SH.showOnMap) SH.showOnMap(p); }, 'sm') : null); }));
    }
    // a seat's own card, drawn on the sheet of the place where it is met
    function seatCard(st, id) {
      const m = C.mootState(st), s = C.MOOT.seats[id], stand = m.tally.standing, done = m.canvass[id]; pickClaimant(st, stand);
      const head = h('div', { class: 'row' }, h('b', { class: 'grow', text: s.name }), h('span', { class: 'dim', text: s.speaker }));
      if (done) return h('div', { class: 'card' }, head, h('div', { class: 'good', style: 'margin-top:4px', text: (done.how === 'pressure' ? 'Pressured' : done.how === 'bargain' ? 'Bargained with' : 'Persuaded') + ' for ' + claimName(done.for) + '. Their vote is set.' }));
      return h('div', { class: 'card urg' }, head, h('div', { class: 'dim', style: 'margin:4px 0', text: 'Their vote can be worked once before the Moot sits. Persuading nudges them toward your claimant. Bargaining needs a favour done for them first. Pressure takes the vote outright, and they will not forget it.' }),
        h('select', { onchange: e => { claimant = e.target.value; draw(); } }, stand.map(c => h('option', { value: c, selected: c === claimant, text: 'For: ' + claimName(c) }))), gap(8),
        C.canvassOptions(st, id).map(o => Object.assign({}, o, { why: o.id === 'pressure' ? 'You have nothing on them yet.' : o.id === 'bargain' ? 'They want a favour first. Ask at their hall.' : o.why })).map(o => [btn(o.label + (o.id === 'pressure' && o.ok ? (o.proof ? ' (spend proof)' : ' (spend leverage)') : ''), () => {
          const r = C.canvass(st, id, o.id, claimant); if (!r.ok) return toast(r.reason, true);
          r.text = r.text || (o.id === 'pressure' ? s.name + ' give you their vote for ' + claimName(claimant) + '. They will not forgive how you got it.' : s.name + (o.id === 'bargain' ? ' remember the favour and move a step toward ' : ' hear you out and move a step toward ') + claimName(claimant) + '.') + ' This seat is settled now; the others are still open.';
          did(r, s.name + ': ' + o.label, [].concat(r.suspicion ? ['Your secret rank grows uneasy.'] : [], o.id === 'pressure' ? ['They will not forget it.'] : []));
        }, 'full' + (o.id === 'bargain' ? ' pri' : ''), !o.ok), why(o.ok ? '' : o.why)]));
    }
    function sittingCards(st, m) {
      const out = [], stand = m.tally.standing;
      if (!m.declared) {
        const tes = C.mootTestimonyOptions(st);
        if (tes.length) out.push(h('div', { class: 'sh-h', text: 'Lay proof before the Moot' }), tes.map(o => { const X = C.SECRETS[o.sid] || {}, L = C.LORE && X.proof && C.LORE[X.proof]; return h('div', { class: 'card' }, h('b', { text: X.name || o.sid }), L && L.text ? h('div', { class: 'dim', text: L.text }) : null, gap(),
          btn('Testify', () => { const r = C.mootTestify(st, o.sid); if (!r.ok) return toast(r.reason, true); did(r, 'The hall goes quiet'); }, 'full', !o.ok), why(o.ok ? '' : 'Wil will not let you. Not yet.')); }));
        out.push(h('div', { class: 'sh-h', text: 'Declare' }), h('div', { class: 'dim', text: 'Say it out loud, in front of everyone: whom do you stand for? If you wear a secret colour, its seat will notice if you stand against it.' }), gap(),
          stand.map(c => [btn('Declare for ' + claimName(c), () => did(C.mootDeclare(st, c), 'You declare for ' + claimName(c), ['Now the seats vote.']), 'full'), gap()]));
        return out;
      }
      out.push(h('div', { class: 'card' }, h('div', { text: 'You have declared for ' + claimName(m.declared) + '. The hall goes quiet. Then Lord Marshal Voss stands, and the seats rise one by one.' }), gap(),
        btn('Count the votes', () => { const r = C.mootResolve(st); if (!r.ok) return toast(r.reason, true);
          if (!r.hall && !r.text && C.AFTER_MOOT && C.AFTER_MOOT[r.outcome] && C.AFTER_MOOT[r.outcome].board) r.text = C.AFTER_MOOT[r.outcome].board;
          const lines = [].concat(r.kingmaker ? ['You are the Kingmaker.'] : [], r.promoted ? ['You are promoted.'] : [], r.office ? [r.office === 'lords_hand' ? 'Harrow keeps his promise: you are the Lord\'s Hand.' : 'Harrow keeps his promise: a stipend from the Crown.'] : [], r.outlawed ? ['The Crown has outlawed you.'] : [], (r.suspicion || []).map(f => fname(f) + ' noticed how you voted.'));
          did(r, r.hall ? 'The count is taken' : r.outcome === 'broken' ? 'No majority' : claimName(r.outcome) + ' takes the crown', lines.concat(r.hall ? ['The doors at the back of the hall are barred from the inside.'] : [])); }, 'pri full')));
      return out;
    }

    function mootTab(st) {
      const m = C.mootState(st), out = [], at = here(), manual = C.MOOT.manualCalls || ['petition'];
      if (!m.called) {
        out.push(h('div', { class: 'card' }, h('b', { text: 'The Interval' }), h('div', { class: 'dim', text: 'There is no king. Harrow keeps the seal and says the realm is quiet. The Five Seats could still meet at Crown Keep and choose, but nobody has dared to ring the bell. It will take a truth the Lords cannot ignore, or someone with the standing to demand it.' })));
        const calls = C.mootCallReasons(st).filter(r => manual.includes(r));
        calls.forEach(r => out.push(h('div', { class: 'card urg' }, h('div', { text: C.MOOT.calls[r] || r }), gap(), btn('Call the Moot', () => { const x = C.mootCall(st, r); if (!x.ok) return toast(x.reason, true); news.push({ title: 'The Moot is called', text: x.text }); did(x, 'The Moot is called'); }, 'pri full'), at !== 'crown_keep' ? why('Bring it to Crown Keep.') : gap())));
        if (!calls.length) out.push(h('div', { class: 'dim', style: 'margin:8px 2px', text: 'Nothing you hold can call it yet.' }));
        return out;
      }
      if (m.resolved || st.world.realm) {
        const rl = st.world.realm, R = rl && C.REALM[rl.outcome];
        out.push(h('div', { class: 'card urg' }, h('b', { text: rl ? (rl.outcome === 'broken' ? 'The Moot is broken' : R.ruler + ' rules') : 'The Moot has decided' }),
          C.AFTER_MOOT && rl && C.AFTER_MOOT[rl.outcome] ? h('div', { class: 'dim', style: 'margin-top:4px', text: C.AFTER_MOOT[rl.outcome].board }) : null,
          fl().kingmaker ? h('div', { class: 'good', style: 'margin-top:4px', text: 'You are the Kingmaker. The crown you made remembers it.' }) : null,
          m.declared ? h('div', { class: 'dim', text: 'You declared for ' + claimName(m.declared) + '.' }) : null));
        const reasons = C.mootCallReasons(st); if (reasons.includes('second')) out.push(h('div', { class: 'card' }, h('div', { text: C.MOOT.calls.second }), h('div', { class: 'dim', text: 'The Lords will call it again when you next arrive anywhere.' })));
        if (C.holdOffers(st).length) out.push(btn('Choose your hold', () => { tab = 'now'; draw(); }, 'pri full'));
        return out;
      }
      const t = m.tally, stand = t.standing;
      if (!claimant || !stand.includes(claimant)) claimant = stand.includes(C.moot(st).backing) ? C.moot(st).backing : stand[0];
      out.push(h('div', { class: 'card' }, h('b', { text: m.second ? 'The second Moot' : 'The Moot is called' }), h('div', { class: 'dim', text: (C.MOOT.calls[m.by] || '') + ' It sits at Crown Keep. Each seat will vote for its own interest, and you can still move them before the doors close.' }),
        h('div', { style: 'margin-top:6px' }, stand.map(c => h('span', { class: 'shchip', text: claimName(c) })))));
      if (m.hall && m.hall.pending) { out.push(hallCard(m)); return out; }
      out.push(mootPlanCard(st, false));
      out.push(tallyBlock(st, t));
      if (!m.open) {
        out.push(seatsWhere(st, m));
        out.push(h('div', { class: 'card dim' }, h('div', { text: 'Visit each seat in person. When you are done, stand in Crown Keep and ask the Moot to sit: after that no one can be swayed.' }), gap(),
          btn(here() === 'crown_keep' ? 'Open Crown Keep' : 'Show Crown Keep', () => { if (SH.showOnMap) SH.showOnMap('crown_keep'); }, 'full')));
        return out;
      }
      out.push(h('div', { class: 'card urg' }, h('b', { text: 'The Moot is sitting' }), h('div', { class: 'dim', text: 'Go to Crown Keep to lay your proof and say whom you stand for.' }), gap(),
        btn(here() === 'crown_keep' ? 'Open Crown Keep' : 'Show Crown Keep', () => { if (SH.showOnMap) SH.showOnMap('crown_keep'); }, 'pri full')));
      return out;
    }

    // ---------- Work ----------
    function workTab(st) {
      return boardCards(st, here(), true).concat(contractCards(st));
    }
    const rew = r => [r.gold ? r.gold + ' gold' : '', r.standing ? '+' + r.standing + ' standing' : '', r.goodwill ? '+' + r.goodwill + ' goodwill' : ''].filter(Boolean).join(', ');
    // the contract board posted at a place: shown in that place's sheet on the map, beside its jobs
    function boardCards(st, at, always) {
      const board = C.contractBoard(st, at), mine = C.contracts(st), out = [];
      if (!board.length && !always) return out;
      out.push(h('div', { class: 'sh-h', text: 'Contract board' }));
      if (!board.length) out.push(h('div', { class: 'dim', text: 'No work posted here. Faction castles and halls post contracts for their own people; the Hearthwatch post theirs for anyone they trust. Boards change every four days.' }));
      board.forEach(o => out.push(h('div', { class: 'card' + (o.taken ? '' : '') }, h('div', { class: 'row' }, h('b', { class: 'grow', text: o.name }), h('span', { class: 'shchip', text: fname(o.faction) })), h('div', { class: 'dim', style: 'margin:4px 0', text: o.brief }),
        h('div', { class: 'dim', text: 'Pays ' + rew(o.reward) }), gap(),
        o.taken ? h('div', { class: 'good', text: 'Taken' }) : btn('Take the contract', () => { const r = C.takeContract(st, at, o.slot); if (!r.ok) return toast(r.reason, true); (r.contract.steps || []).forEach(x => { if (x.at && C.discoverRoute) C.discoverRoute(st, at, x.at); }); toast('Contract taken: ' + o.name + '. Its places are marked on your map.'); save(); draw(); }, 'pri full', mine.length >= C.MAX_CONTRACTS))));
      if (board.some(o => !o.taken) && mine.length >= C.MAX_CONTRACTS) out.push(why('You can carry ' + C.MAX_CONTRACTS + ' contracts at a time.'));
      return out;
    }
    // finished contracts are handed in here, at the place, never from a menu
    function reportCards(st, at) {
      return C.contractsReportableAt(st, at).map(c => h('div', { class: 'card urg' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: c.name + ' \u2713' }), h('span', { class: 'shchip', text: fname(c.faction) })),
        h('div', { class: 'dim', style: 'margin:4px 0', text: 'All done. Report back for your pay: ' + rew(c.reward) + '.' }), gap(),
        btn('Report back', () => { const r = C.reportContract(st, c.id); if (!r.ok) return toast(r.reason, true); did(r, c.name + ' ✓'); }, 'pri full')));
    }
    function contractTarget(st, c) { const s = c.steps.find(x => !x.done); return c.ready ? c.giver : s && s.at ? s.at : null; }
    // your contracts: listed in the Journal with your other quests
    function contractCards(st, goTo) {
      const mine = C.contracts(st), out = [];
      mine.forEach(c => out.push(h('div', { class: 'card' + (c.ready ? ' urg' : '') }, h('div', { class: 'row' }, h('b', { class: 'grow', text: c.name }), h('span', { class: 'shchip', text: fname(c.faction) })),
        h('div', { class: 'dim', text: 'Contract from ' + node(c.giver) }),
        c.steps.map(s => h('div', { class: s.done ? 'dim' : '', text: (s.done ? '✓ ' : '○ ') + (s.text || ((s.type === 'fight' ? 'Fight at ' : s.type === 'scene' ? 'Deal with it at ' : 'Go to ') + node(s.at))) })),
        c.ready ? h('div', { class: 'good', style: 'margin-top:4px', text: 'All done. Report back at ' + node(c.giver) + '.' }) : null,
        goTo ? goTo(contractTarget(st, c), c) : null,
        gap(), btn(dropArm === c.id ? 'Tap again to drop it (costs standing)' : 'Drop', () => { if (dropArm !== c.id) { dropArm = c.id; draw(); setTimeout(() => { if (dropArm === c.id) { dropArm = null; draw(); } }, 3000); return; } dropArm = null; C.dropContract(st, c.id); save(); draw(); }, 'sm' + (dropArm === c.id ? ' bad' : '')))));
      return out;
    }

    // ---------- Threads ----------
    function threadsTab(st) {
      const out = [], leads = C.leadList(st), lev = C.leverageList(st);
      out.push(h('div', { class: 'sh-h', text: 'Leads' }));
      const live = leads.filter(l => !l.done), done = leads.filter(l => l.done);
      if (!live.length) out.push(h('div', { class: 'dim', text: done.length ? 'Every lead you have has been followed.' : 'No leads yet. People will tell you things worth following, if you stay to listen.' }));
      live.forEach(l => out.push(h('div', { class: 'card' }, h('div', { class: 'who', text: who(l.who) || l.who }), h('b', { text: l.name }), h('div', { class: 'dim', text: l.text }))));
      if (done.length) out.push(h('details', {}, h('summary', { class: 'dim', text: 'Followed up (' + done.length + ')' }), done.map(l => h('div', { class: 'dim', text: '✓ ' + l.name }))));
      const mk = !C.mootKnown || C.mootKnown(st);
      out.push(h('div', { class: 'sh-h', text: 'Leverage' }), h('div', { class: 'dim', text: !mk ? 'A personal secret on someone powerful. Each can be spent once: to stop one of their moves against you, or to call in a favour. A day may come when it is worth more.' : 'A personal secret on someone powerful. Each can be spent once: to pressure their seat at the Moot, to stop one of their moves against you, or to call in a favour.' }), gap());
      if (!lev.length) out.push(h('div', { class: 'dim', text: 'You hold nothing over anyone yet. Powerful people keep secrets, and some of them are overheard.' }));
      lev.forEach(l => out.push(h('div', { class: 'card' }, h('div', { class: 'who', text: l.who }), h('b', { text: l.name }), h('div', { class: 'dim', text: l.text }), mk && l.seat ? h('div', { class: 'dim', style: 'font-size:12px', text: 'Can pressure ' + C.MOOT.seats[l.seat].name + ' at the Moot.' }) : null, gap(),
        h('div', { class: 'row' }, btn('Call in a favour', () => did(C.useLeverage(st, l.id, 'favour'), l.who), 'grow'), btn('Stop their next move', () => did(C.useLeverage(st, l.id, 'cancel'), l.who), 'grow')))));
      return out;
    }

    // ---------- You ----------
    function meter(v, color) { return h('div', { class: 'meter' }, h('i', { style: 'width:' + Math.max(0, Math.min(100, v)) + '%;background:' + color })); }
    function youTab(st) {
      const out = [], rp = C.reputation(st), ranks = S.listRanks(st) || [], secret = ranks.filter(r => r.secret), pub = ranks.filter(r => !r.secret), hd = st.world.hold;
      const side = (v, lo, hi) => v <= -3 ? lo : v >= 3 ? hi : 'Neither';
      out.push(h('div', { class: 'sh-h', text: 'How the realm sees you' }), h('div', { class: 'card' },
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Mercy' }), h('b', { text: rp.mercyTier.name || side(rp.mercy, 'Hard', 'Kind') })), meter(50 + rp.mercy * 4, 'var(--ok)'),
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Honesty' }), h('b', { text: rp.honestyTier.name || side(rp.honesty, 'Sly', 'Honest') })), meter(50 + rp.honesty * 4, 'var(--gold)'),
        h('div', { class: 'dim', style: 'font-size:12px', text: 'Built from what you do. What you do in public counts in full; what you do in private counts for a third.' })));
      if (secret.length) {
        out.push(h('div', { class: 'sh-h', text: 'Your double life' }));
        secret.forEach(r => { const v = S.suspicion(st, r.faction); out.push(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: r.title + ' of ' + fname(r.faction) }), h('span', { class: 'shchip', text: 'secret' })),
          h('div', { class: 'dim', text: 'Do they think you have gone native? ' + v + ' of 100' }), meter(v, 'var(--foe)'))); });
        pub.filter(r => r.faction !== 'hearthwatch').forEach(r => { const v = C.coverSuspicion(st, r.faction); out.push(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: r.title + ' of ' + fname(r.faction) }), h('span', { class: 'shchip', text: 'your cover' })),
          h('div', { class: 'dim', text: 'Do they suspect a spy? ' + v + ' of 100' }), meter(v, 'var(--foe)'))); });
        const ideals = Object.entries(C.IDEALS).filter(([f]) => ranks.some(r => r.faction === f) && C.dossier && C.dossier(st, f).some(e => e.kind === 'ideal')).map(([f, I]) => fname(f) + (I.honesty > 0 ? ' value honesty: lies make them doubt you.' : I.mercy > 0 ? ' value mercy: cruelty makes them doubt you.' : ' scorn mercy: kindness makes them doubt you.'));
        if (ideals.length) out.push(h('div', { class: 'card' }, h('b', { text: 'What they believe' }), ideals.map(t => h('div', { class: 'dim', text: t }))));
        out.push(h('div', { class: 'dim', style: 'font-size:12px;margin:2px 2px 8px', text: 'Hurting a faction, being seen at the other side\'s halls, and going against a faction\'s beliefs all feed these. Lying low at a Hearthwatch house cools both.' }));
      }
      if (hd) out.push(h('div', { class: 'sh-h', text: 'Your hold' }));
      if (hd) out.push(h('div', { class: 'card' }, h('b', { text: node(hd.node) }), h('div', { class: 'dim', text: hd.lost ? 'Lost to ' + fname(hd.takenBy) + '. Go back and take it.' : hd.siege ? 'Under siege by ' + fname(hd.siege.by) + '.' : 'Given by ' + fname(hd.backer) + ' on day ' + hd.granted + '.' })));
      return out;
    }

    // ---------- news from the road ----------
    { const tr = C.travel; C.travel = function (st) { const r = tr.apply(this, arguments);
        if (r && r.ok) { if (r.moot && r.moot.ok) news.push({ title: r.moot.by === 'second' ? 'The Moot is called again' : 'The Moot is called', text: r.moot.text });
          if (r.secret && r.secret.kind === 'hint') news.push({ title: fname(r.secret.faction), text: r.secret.text }); }
        return r; }; }
    { const up = C.useProof; C.useProof = function () { const r = up.apply(this, arguments); if (r && r.ok && r.moot && r.moot.ok) news.push({ title: 'The Moot is called', text: r.moot.text }); return r; }; }

    // ---------- Brielle's road: add "hide her" to the shell's road-fight sheet ----------
    function brielleHook() {
      const st = ST(), w = st && st.world.wander; if (!w || !w.enc || w.enc.intrigue !== 'brielle_patrol') return;
      const pb = document.querySelector('#sh-sheet.on .pb'); if (!pb || pb.querySelector('.ss-hide')) return;
      const party = (st.party || []).map(id => ((st.roster || []).find(u => u.id === id) || {}).primary), ok = party.some(p => ['rogue', 'scout', 'assassin'].includes(p));
      pb.insertBefore(h('div', { class: 'ss-hide' }, btn('Hide Brielle and let them pass', () => { const r = C.hideBrielle(st); if (!r.ok) return toast(r.reason, true); save(); const x = document.querySelector('#sh-sheet .ph button'); if (x) x.click(); SH.render(); flash = { title: 'The patrol rides past', text: r.text, lines: [] }; openSheet('now'); }, 'full pri', !ok),
        why(ok ? 'No fight. If you hold a Synod rank, they may wonder where you were.' : 'Needs a rogue, scout or assassin in the party.')), pb.firstChild ? pb.firstChild.nextSibling : null);
    }

    // ---------- the tick: the Story button, and opening by itself when something waits ----------
    function tick() {
      const st = ST(), show = !!st && inGame() && !shellSheetUp() && !open && !window.__campaignBattle;
      if (st && shellSheetUp()) brielleHook();
      if (st) document.querySelectorAll('#shell .card div').forEach(d => { if (/strike around day \d+/.test(d.textContent)) d.textContent = 'Raiders are massing in the Free Marches. They will strike when you ride into the Marches.'; });
      if (!show) return;
      const w = waiting(st).filter(x => x !== 'can_call');   // being able to call the Moot is shown in the Journal, not pushed at you
      const key = w.join('|');
      if (w.length && key !== lastAuto) { lastAuto = key; openSheet('now'); } else if (!w.length) lastAuto = '';
    }
    setInterval(tick, 400); tick();
    const mootOn = st => { const m = C.mootState(st), manual = C.MOOT.manualCalls || ['petition']; return !!(m.called || st.world.realm || (!m.called && C.mootCallReasons(st).some(r => manual.includes(r)))); };
    // The shell's Journal tab and place sheets draw these cards; actions inside them redraw the shell, and outcomes open the story sheet.
    window.GAME_STORY_SCREENS = { open: openSheet, close: closeSheet, draw, tick, news, isOpen: () => open,
      waiting: st => waiting(st || ST()), urgent: st => urgentCards(st || ST()), place: st => placeCards(st || ST()), people: st => peopleCards(st || ST()),
      board: (st, at) => [].concat(reportCards(st || ST(), at || here()), boardCards(st || ST(), at || here(), false)), contracts: (st, goTo) => contractCards(st || ST(), goTo), contractTarget,
      mootPlan: st => mootPlanCard(st || ST(), true), mootHere: st => mootHereCard(st || ST()), threads: st => threadsTab(st || ST()), moot: st => mootTab(st || ST()), mootOn: st => mootOn(st || ST()), you: st => youTab(st || ST()) };
  }
})();
