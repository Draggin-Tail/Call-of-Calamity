/* Roads: the generated road network (EDGES, ROUTES) and node links.
   Part of the campaign data, split out of campaign.js. Load order: regions, places, roads_gen, encounters, campaign.
   Each part adds to a shared object; campaign.js loads last and publishes it as window.GAME_CAMPAIGN. */
(function () {
  const P = window.__CAMPAIGN_PARTS, C = P.C, nodeState = P.nodeState;
  const G = () => window.GAME_DATA, S = () => window.GAME_SAVE, LO = () => window.GAME_LOADOUT;
  // ---- roads inside each territory: routes, not a mesh. Two places are joined only if no third place is nearer to both
  //      (a relative neighbourhood graph); a shortcut is added back where the road would otherwise wind 4 or more days
  //      around; pieces left apart are bridged by their closest pair. Every hop takes one day. ----
  C.EDGES = [];
  (function () {
    const zones = {};
    Object.entries(C.NODES).forEach(([id, n]) => { (zones[n.region] = zones[n.region] || []).push(id); });
    const P = id => [C.NODES[id].pos[0] * 1380, C.NODES[id].pos[1] * 752], d2 = (a, b) => { const p = P(a), q = P(b); return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; };
    Object.values(zones).forEach(ids => {
      const gab = [], E = [], adj = {}; ids.forEach(i => { adj[i] = new Set(); });
      const join = (a, b) => { E.push([a, b]); adj[a].add(b); adj[b].add(a); };
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j], dab = d2(a, b); if (Math.sqrt(dab) > 230) continue;
        if (!ids.some(c => c !== a && c !== b && d2(a, c) + d2(c, b) < dab)) gab.push([a, b, dab]);
      }
      gab.forEach(([a, b, dab]) => { if (!ids.some(c => c !== a && c !== b && Math.max(d2(a, c), d2(b, c)) < dab)) join(a, b); });
      const hops = (a, b) => { const seen = { [a]: 0 }, q = [a]; while (q.length) { const x = q.shift(); if (x === b) return seen[x]; adj[x].forEach(y => { if (!(y in seen)) { seen[y] = seen[x] + 1; q.push(y); } }); } return 99; };
      gab.slice().sort((x, y) => x[2] - y[2]).forEach(([a, b]) => { if (!adj[a].has(b) && hops(a, b) >= 4) join(a, b); });
      const comp = {}; ids.forEach(i => { comp[i] = i; }); const find = x => (comp[x] === x ? x : (comp[x] = find(comp[x])));
      E.forEach(([a, b]) => { comp[find(a)] = find(b); });
      for (;;) { // bridge any separate pieces by their closest pair
        const roots = new Set(ids.map(find)); if (roots.size <= 1) break;
        let best = null; ids.forEach(a => ids.forEach(b => { if (find(a) !== find(b)) { const d = d2(a, b); if (!best || d < best[0]) best = [d, a, b]; } }));
        join(best[1], best[2]); comp[find(best[1])] = find(best[2]);
      }
      E.forEach(([a, b]) => C.EDGES.push([a, b, 1]));
    });
  })();

  // ---- roads between regions: always a chain of stops, so no region is ever crossed in one move ----
  // [from, to, [[id, name, region, type, description, shop?], ...]]  (each hop is 1 day)
  C.ROUTES = [
    ["cogsmith_row", "gallows_hill", [["lamp_stairs", "Lamp Stairs", "free_marches", 'road', "A switchback stair cut into the cliff, lit by guild lamps."]]],
    ["giants_tooth", "wolfmothers_den", [["slag_track", "Slag Track", "dwarven_holds", 'road', "A cart track of black slag, lined with spent lamps."]]],
    ["oathstone", "glass_hollow", [["root_stair", "Root Stair", "elven_realms", 'road', "Pine roots make a stair down from the snowline into the Thicket. The dwarves count the steps; the elves do not."]]],
    ["stormbreak_hold", "signal_tower", [["boundary_elm", "Boundary Elm", "crownlands", 'road', "A great elm marking the Crown’s western boundary. Writs are nailed to it."]]],
    ["iceflow_road", "old_toll", [["scribes_post", "Scribe's Post", "iceflow", 'road', "Spire scribes record every traveller who comes up from the river towns."]]],
    ["frozen_ford", "ashen_obelisk", [["ash_verge", "Ash Verge", "orc_lands", 'road', "Red dust blows in drifts here. The Spire and the Legion both claim the road."]]],
    ["starfall_tarn", "skull_quarry", [["saltpan_row", "Saltpan Row", "orc_lands", 'road', "White salt pans glittering below the Spinepeak, raked by silent workers."]]],
    ["greywatch_post", "oath_cairn", [["fallow_gate", "Fallow Gate", "free_marches", 'road', "A broken gate in a field nobody farms any more."]]],
    ["marchwardens_post", "reliquary_hill", [["dry_culvert", "Dry Culvert", "free_marches", 'road', "A stone culvert over a stream that dried up years ago."]]],
    ["carrow_tower", "dewfall_glade", [["kings_mile", "King's Mile", "elven_realms", 'road', "The Crown’s best road, paved for a mile and then not at all."]]],
    ["golden_reach", "orchard_row", [["harvest_road", "Harvest Road", "voldun", 'road', "Granary carts rattle east along here every autumn."]]],
    ["tithe_barn", "silt_wharf", [["willow_flats", "Willow Flats", "crownlands", 'road', "Low ground and drooping willows. The road is mostly mud."]]],
    ["cask_hollow", "wardstone_green", [["arch_mile", "Arch Mile", "voldun", 'road', "A causeway of ancient arches, half of them patched with new stone."]]],
    ["lampwright_street", "cradlepine", [["greenway_ford", "Greenway Ford", "voldun", 'road', "A shallow ford where the fields end and the Thicket begins."]]],
    ["long_stair", "the_sump", [["herb_terrace", "Herb Terrace", "goblin_fens", 'road', "Terraces of herbs where the dry ground gives way to the fen."]]],
    ["drowned_chapel", "rotwood", [["burnt_ford", "Burnt Ford", "goblin_fens", 'road', "A ford of charred timbers, where Syndicate barges and goblin rafts meet to trade and threaten."]]],
    ["thornfield", "bog_beacon", [["brackenway", "Brackenway", "elven_realms", 'road', "Bracken taller than a man, and a path that keeps moving. The forest gives way to the fen here."]]]
  ];
  (function () {
    C.ROUTES.forEach(([a, b, stops]) => {
      const A = C.NODES[a], B = C.NODES[b]; if (!A || !B) throw new Error('route endpoint missing: ' + a + ' ' + b);
      const n = stops.length, W = 1376 / 768, dx = (B.pos[0] - A.pos[0]) * W, dy = B.pos[1] - A.pos[1], len = Math.hypot(dx, dy) || 1;
      const chain = [a].concat(stops.map(x => x[0]), [b]);
      stops.forEach((st, i) => {
        const t = (i + 1) / (n + 1), off = st[3] === 'sea' ? 0 : (i % 2 ? 1 : -1) * 0.012; // roads wiggle a little, sea lanes do not
        const x = A.pos[0] + (B.pos[0] - A.pos[0]) * t + (-dy / len) * off / W, y = A.pos[1] + dy * t + (dx / len) * off;
        if (C.NODES[st[0]]) throw new Error('duplicate stop ' + st[0]);
        C.NODES[st[0]] = { name: st[1], region: st[2], type: st[3], pos: [+x.toFixed(3), +y.toFixed(3)], desc: st[4], route: true };
        if (st[5]) C.NODES[st[0]].shop = st[5];
      });
      for (let i = 0; i < chain.length - 1; i++) C.EDGES.push([chain[i], chain[i + 1], 1]);
    });
  })();
  (function () { // keep road stops clear of the places around them
    const R = 60, stops = Object.keys(C.NODES).filter(i => C.NODES[i].route), all = Object.keys(C.NODES), px = id => [C.NODES[id].pos[0] * 2866, C.NODES[id].pos[1] * 1600];
    for (let it = 0; it < 80; it++) {
      let moved = false;
      stops.forEach(a => all.forEach(b => {
        if (a === b) return;
        const p = px(a), q = px(b), dx = p[0] - q[0] || 0.01, dy = p[1] - q[1] || 0.01, d = Math.hypot(dx, dy);
        if (d < R) { const k = (R - d) / d * (C.NODES[b].route ? 0.5 : 1); C.NODES[a].pos = [(p[0] + dx * k) / 2866, (p[1] + dy * k) / 1600]; moved = true; }
      }));
      if (!moved) break;
    }
    stops.forEach(id => { const p = C.NODES[id].pos; C.NODES[id].pos = [+p[0].toFixed(3), +p[1].toFixed(3)]; });
  })();
  C.applyMapPos();   // border stops sit where the map layout put them
  Object.values(C.NODES).forEach(n => { n.links = {}; });
  C.EDGES.forEach(([a, b, d]) => { C.NODES[a].links[b] = d; C.NODES[b].links[a] = d; });



  // ---- one human land: the roads above were laid out per old territory; from here on the four are one region (human), and each place
  //      keeps its old territory as its area (C.AREAS) ----
  Object.values(C.NODES).forEach(n => { if (C.AREAS[n.region]) { n.area = n.region; n.region = 'human'; } });
})();
