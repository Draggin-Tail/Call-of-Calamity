/* Scenes (design/cinematics.md): key story beats played out on a map, with scripted movement and in-scene choices.
   Part of the campaign data. Load order: regions, places, roads_gen, encounters, scenes, campaign.
   A script only adds staging: who stands where, who walks, who speaks. The words come from the story data where they already live.
   Cast slots {party: n} are filled from the player's party; the runner is Battle.scene in index.html. */
(function () {
  const P = window.__CAMPAIGN_PARTS, C = P.C;
  // split long story text into lines that fit the dialogue box: paragraphs, then sentences, about 230 characters at most
  const chunks = (text, max) => { const out = []; String(text || '').split(/\n\s*\n/).forEach(par => { let cur = ''; (par.match(/[^.!?]+[.!?]+["”']?\s*|[^.!?]+$/g) || [par]).forEach(s => { if (cur && (cur + s).length > (max || 230)) { out.push(cur.trim()); cur = ''; } cur += s; }); if (cur.trim()) out.push(cur.trim()); }); return out; };
  C.sceneChunks = chunks;

  C.SCENES = {
    // The human opening at Kingsway Cross: the party walks up the road and the Crown's toll-clerk steps out to count them.
    opening_human: { map: 'road_plains_b', place: 'Kingsway Cross', time: 'Morning', story: st => st.world.flags.opening,
      cast: [{ party: 0, at: [2, 11], off: true }, { party: 1, at: [3, 11], off: true }, { party: 2, at: [4, 11], off: true },
        { id: 'clerk', name: 'Toll-clerk', primary: 'acolyte', team: 'E', at: [9, 6], face: 'left' }],
      steps: st => { const [first, ...rest] = chunks(st.world.flags.opening); return [
        { narrate: first },
        { enter: 'p0', from: [2, 11], at: [4, 8], wait: false }, { wait: 250 }, { enter: 'p1', from: [3, 11], at: [3, 9], wait: false }, { wait: 250 }, { enter: 'p2', from: [4, 11], at: [5, 9] },
        { emote: 'clerk', mark: '!' }, { walk: 'clerk', to: [5, 7] }, { face: 'clerk', to: 'p0' }, { face: 'p0', to: 'clerk' }, { face: 'p1', to: 'clerk' }, { face: 'p2', to: 'clerk' },
        { say: 'clerk', text: 'A halfpenny a head for the Crown\'s road. Three of you, and six boots. I count the boots.' },
        ...rest.map(t => ({ narrate: t })),
        { walk: 'clerk', to: [7, 6] }, { face: 'clerk', to: 'p0' }, { face: 'p0', to: 'up' }
      ]; } }
  };

  // The script for a scene id, with the party filled in, or null (then the caller shows the old sheet).
  C.sceneScript = function (st, id) {
    const sc = C.SCENES[id]; if (!sc || !window.GAME_DATA.maps[sc.map]) return null;
    const party = (st.party && st.party.length ? st.party : st.roster.map(u => u.id)).map(pid => st.roster.find(u => u.id === pid)).filter(Boolean);
    const cast = []; sc.cast.forEach(c => { if (c.party === undefined) { cast.push(Object.assign({}, c)); return; } const u = party[c.party]; if (u) cast.push(Object.assign({ id: 'p' + c.party, name: u.name, race: u.race, primary: u.primary, team: 'P' }, c)); });
    const ids = new Set(cast.map(c => c.id)), stepsIn = typeof sc.steps === 'function' ? sc.steps(st) : sc.steps;
    const steps = stepsIn.filter(s => { const who = s.say || s.walk || s.face || s.enter || s.exit || s.emote; return !who || typeof who !== 'string' || ids.has(who) || s.narrate !== undefined; });   // a missing party member just isn't in the scene
    return { id, map: sc.map, place: sc.place, time: sc.time, zoom: sc.zoom, cast, steps };
  };
})();
