/* Unit portraits (v2): 64x64 pixel-art busts drawn in code, with real shading.
   PORT.canvas(unitOrBuild, team) -> cached canvas; PORT.url() the same as a data URL. PORT.canvas() returns the middle 44x44 of the grid scaled 3x (132px); show it at 66, 88 or 132px.
   Layers, back to front: backdrop glow, back hair / hood, torso by armour kind, neck, head by race (sphere-shaded, dithered ramps), face (eyes, brows, nose, mouth,
   marks), beard, front hair, headgear by class, then a coloured outline pass.
   Same input = same face: skin tone, sex, hair style and colour, eye colour, brow, marks and age are picked from a hash of race + name, so two units of one race and class differ.
   Visual only. Monsters use a crop of their board sprite (sprites/<team>/monsters.png).
   Named NPCs (Voss, Agathe, Tobb...) use their own busts from portraits/npc/ instead (NPC, matched on the name).
   Add a class: put it in CLS. Add a race: put it in RACE. */
(function () {
  const N = 64, CX = 32;
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const hx = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (c, t) => { const a = rgb(c), k = t < 0 ? 0 : 255, f = Math.abs(t); return hx(a.map(v => v + (k - v) * f)); };
  const lerp = (a, b, t) => hx(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
  // five-tone ramp: shadows drift cool and dark, lights drift warm
  const ramp = c => [lerp(mix(c, -.5), '#1a1840', .22), lerp(mix(c, -.28), '#2a2a60', .14), c, lerp(mix(c, .2), '#fff2cc', .12), lerp(mix(c, .5), '#fffbe8', .25)];
  const BAY = [[0, .5], [.75, .25]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- races (sizes are for the 64 grid)
  const RACE = {
    human: { skins: ['#f0c8a2', '#e6b48c', '#cf9a72', '#a8744f', '#7e5538'], W: 24, H: 29, jaw: .55, ear: 0, eyes: ['#3b6a9a', '#4a8a52', '#6a4526', '#7a8a96'], hair: ['#3b2a1c', '#6a4527', '#c9a45a', '#8a3a22', '#1d1a1a', '#d8d2c4', '#a8602a'], styles: ['short', 'long', 'bob', 'short', 'mohawk', 'ponytail', 'spiky', 'long'] },
    dwarf: { skins: ['#e6a47e', '#d4906a', '#c07e58'], W: 28, H: 25, jaw: .8, ear: 0, eyes: ['#4a3a22', '#3b5f8a', '#4a6a3a'], hair: ['#8a3a22', '#3b2a1c', '#b8742a', '#8a8a8a', '#1d1a1a', '#d8d2c4'], styles: ['short', 'bald', 'topknot', 'short'], beard: true, nose: 3 },
    wood_elf: { skins: ['#e4bc92', '#d2a47a', '#bb8c62'], W: 22, H: 30, jaw: .42, ear: 9, eyes: ['#3d9a4a', '#9a7a2a', '#3b6a9a'], hair: ['#5a3a1c', '#2f4a28', '#8a6a3a', '#2a2420', '#a88a4a', '#8a3a22'], styles: ['long', 'bob', 'ponytail', 'long', 'short'] },
    high_elf: { skins: ['#f6e0c4', '#f0d2b0', '#e8c8a0'], W: 20, H: 31, jaw: .38, ear: 11, eyes: ['#d8b238', '#4a8ac8', '#8a5ac8', '#58c8c8'], hair: ['#f0dc8a', '#e8e4d8', '#d8b46a', '#c8c8e0', '#f4c8a0'], styles: ['long', 'bob', 'long', 'ponytail', 'short'] },
    dark_elf: { skins: ['#8a789e', '#76668c', '#6a5a82', '#9a88ae'], W: 20, H: 31, jaw: .38, ear: 11, eyes: ['#e03a3a', '#e0c030', '#d850d8', '#58e0e0'], hair: ['#eae6f0', '#c8c4d8', '#2a2438', '#b8a8d8', '#d8d0f0'], styles: ['long', 'bob', 'long', 'ponytail', 'mohawk', 'spiky'] },
    orc: { skins: ['#80a85e', '#6e9650', '#8ab868', '#7a9a62'], W: 32, H: 28, jaw: .94, ear: 3, eyes: ['#e0b020', '#d84a2a', '#e0e040'], hair: ['#1d1a1a', '#3b2a1c', '#6a6a6a'], styles: ['topknot', 'bald', 'mohawk', 'ponytail'], tusks: true, brow: 3, nose: 3 },
    goblin: { skins: ['#9cbc4c', '#8aac40', '#aac85c'], W: 24, H: 24, jaw: .5, ear: 13, eyes: ['#f0d030', '#e07a20', '#e04040'], hair: ['#3b2a1c', '#1d1a1a'], styles: ['bald', 'tuft', 'bald', 'spiky'], nose: 4, bigEyes: true }
  };

  // ---- classes: armour kind, main / second colour, headgear, extras
  const CLS = {
    squire: { arm: 'leather', c1: '#8a6a44', c2: '#d8c898', head: 'band' },
    scout: { arm: 'leather', c1: '#6a7a4a', c2: '#c8b070', head: 'hood' },
    acolyte: { arm: 'robe', c1: '#e8e2d0', c2: '#c8a24a', head: 'cowl' },
    apprentice: { arm: 'robe', c1: '#5a6ab0', c2: '#e0c060', head: 'cap' },
    warrior: { arm: 'plate', c1: '#9aa6b4', c2: '#c0392b', head: 'helm' },
    sentinel: { arm: 'plate', c1: '#8895a6', c2: '#4a7ac0', head: 'greathelm' },
    bulwark: { arm: 'plate', c1: '#7a8696', c2: '#8a6a3a', head: 'greathelm', crest: true },
    rogue: { arm: 'leather', c1: '#4a4458', c2: '#8a7a9a', head: 'hood', mask: true },
    monk: { arm: 'cloth', c1: '#c8782a', c2: '#e8d8a8', head: 'band', hair: 'topknot' },
    berserker: { arm: 'fur', c1: '#8a5a3a', c2: '#c0392b', head: 'horns', paint: '#c0392b' },
    archer: { arm: 'leather', c1: '#5a7a3a', c2: '#c8b070', head: 'feathercap' },
    marksman: { arm: 'leather', c1: '#6a5a3a', c2: '#d8c898', head: 'brimhat' },
    tracker: { arm: 'leather', c1: '#4a6a4a', c2: '#a8884a', head: 'hood' },
    cleric: { arm: 'robe', c1: '#f0ecdc', c2: '#e2b24c', head: 'mitre' },
    druid: { arm: 'robe', c1: '#4a7a42', c2: '#a8884a', head: 'leaf' },
    shaman: { arm: 'fur', c1: '#7a5a8a', c2: '#e0d8c0', head: 'feathers', paint: '#e0d8c0' },
    wizard: { arm: 'robe', c1: '#3a4a9a', c2: '#e2b24c', head: 'wizhat' },
    necro: { arm: 'robe', c1: '#2e2a3a', c2: '#7ad8a0', head: 'skullhood' },
    enchanter: { arm: 'robe', c1: '#7a3a9a', c2: '#e8a0e0', head: 'circlet' },
    bard: { arm: 'cloth', c1: '#b8453a', c2: '#e2b24c', head: 'feathercap' },
    shadowknight: { arm: 'plate', c1: '#3a3a4a', c2: '#8a3ad8', head: 'greathelm', horns: true },
    shadowmage: { arm: 'robe', c1: '#2a2a46', c2: '#8a6ad8', head: 'hood' },
    warlord: { arm: 'plate', c1: '#a08a4a', c2: '#c0392b', head: 'crown' },
    assassin: { arm: 'leather', c1: '#25222e', c2: '#b83a3a', head: 'hood', mask: true },
    songweaver: { arm: 'cloth', c1: '#4a9a9a', c2: '#f0e0a0', head: 'circlet' },
    spellbow: { arm: 'leather', c1: '#3a6a8a', c2: '#a8d8e8', head: 'brimhat' },
    paladin: { arm: 'plate', c1: '#e0dccc', c2: '#e2b24c', head: 'winghelm' },
    blood_knight: { arm: 'plate', c1: '#8a2a2a', c2: '#1b1b1b', head: 'greathelm', spikes: true },
    warden: { arm: 'plate', c1: '#5a7a5a', c2: '#c8b070', head: 'leafhelm' },
    siegebreaker: { arm: 'plate', c1: '#6a6a72', c2: '#c8782a', head: 'greathelm', heavy: true },
    zen_archer: { arm: 'cloth', c1: '#d8d0b0', c2: '#3a6a8a', head: 'band', hair: 'topknot' },
    ranger: { arm: 'leather', c1: '#3a6a3a', c2: '#c8b070', head: 'hood' },
    beastlord: { arm: 'fur', c1: '#7a5a3a', c2: '#d8c898', head: 'horns', small: true },
    ascetic: { arm: 'cloth', c1: '#a8987a', c2: '#c8782a', head: 'none', hair: 'bald', beads: true },
    inquisitor: { arm: 'robe', c1: '#3a2a2a', c2: '#d8a030', head: 'brimhat', tall: true },
    stormcaller: { arm: 'robe', c1: '#2a5a9a', c2: '#a8e8ff', head: 'circlet', bolt: true }
  };

  function make(unit, team) {
    const u = unit || {}, b = u.build || u, race = RACE[b.race || u.race] ? (b.race || u.race) : 'human';
    const job = b.primary || u.job || 'squire', name = b.name || u.n || u.name || job;
    const R = RACE[race], K = CLS[job] || CLS.squire, rnd = rng(hash(race + '|' + name));
    const pick = a => a[Math.floor(rnd() * a.length)];
    const skinC = pick(R.skins), hairC = pick(R.hair), eyeC = pick(R.eyes), style = K.hair || pick(R.styles);
    const female = race !== 'orc' && race !== 'goblin' && !R.beard ? rnd() < .5 : (race === 'dwarf' ? rnd() < .3 : race === 'orc' ? rnd() < .25 : rnd() < .4);
    const old = rnd() < .18, scar = rnd() < .22, browMood = Math.floor(rnd() * 3), blush = rnd() < .5;
    const SK = ramp(skinC), HR = ramp(old && race !== 'dark_elf' ? '#c8c4bc' : hairC), TR = team === 'E' ? '#c0483a' : '#3f86c0', TRR = ramp(TR);
    const C1 = ramp(K.c1), C2 = ramp(K.c2);
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const lay = document.createElement('canvas'); lay.width = lay.height = N;
    const g = lay.getContext('2d');
    const P = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
    const Rc = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const SM = (x, y, w, h, c) => { Rc(x, y, w, h, c); Rc(N - x - w, y, w, h, c); };                 // mirrored (absolute x)
    const SC = (dx, y, w, h, c) => { Rc(CX - dx, y, w, h, c); Rc(CX + dx - w, y, w, h, c); };      // mirrored (dx = outer distance from the centre line)
    const SP = (x, y, c) => { P(x, y, c); P(N - 1 - x, y, c); };
    const tone = (l, x, y) => clamp(Math.floor(l * 4 + (BAY[y & 1][x & 1] - .5) * .55 + .5), 0, 4);
    // shaded region: test(x,y) says whether the pixel belongs; light(x,y) is 0 (dark) .. 1 (bright)
    const fill = (x0, y0, x1, y1, test, light, rp) => { for (let y = Math.max(0, y0); y <= Math.min(N - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(N - 1, x1); x++) if (test(x, y)) P(x, y, rp[tone(light(x, y), x, y)]); };
    // shaded ellipse lit from the upper left
    const blob = (cx, cy, rx, ry, rp, o) => { o = o || {}; fill(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(cx + rx), Math.ceil(cy + ry), (x, y) => { const u = (x + .5 - cx) / rx, v = (y + .5 - cy) / ry; return u * u + v * v <= 1 && (!o.clip || o.clip(x, y)); },
      (x, y) => { const u = (x + .5 - cx) / rx, v = (y + .5 - cy) / ry, z = Math.sqrt(Math.max(0, 1 - u * u - v * v)); return clamp(.5 + .5 * (-.5 * u - .6 * v + .62 * z) + (o.bias || 0) - .3, 0, 1) * 1.25; }, rp); };
    const chin = 44, hTop = chin - R.H, eyeY = hTop + Math.round(R.H * .52);
    const hw = j => { const H = R.H, mid = H * .55, w = R.W / 2; if (j < mid) { const t = (mid - j) / mid; return Math.max(3, Math.round(w * Math.sqrt(1 - t * t * .9))); } const t = (j - mid) / (H - mid); return Math.max(3, Math.round(w * (1 - t * (1 - R.jaw)) - t * t * 2)); };
    const hoodW = j => { const rx = R.W / 2 + 6; if (j < 8) { const v = (8 - j) / 14; return v >= 1 ? 0 : rx * Math.sqrt(1 - v * v); } return rx + Math.min(4, (j - 8) * .3); };
    const covers = ['hood', 'skullhood', 'cowl', 'greathelm', 'winghelm', 'leafhelm'].includes(K.head);

    // ============ BACK LAYER ============
    if (!covers && (style === 'long' || style === 'bob')) {
      const len = style === 'long' ? 30 : 14, hwid = R.W / 2 + 4;
      fill(CX - hwid - 1, hTop + 2, CX + hwid, hTop + len + 6, (x, y) => { const j = y - hTop; const w = hwid - (j > len - 4 ? (j - len + 4) : 0) - (j < 8 ? Math.max(0, 6 - j) : 0); return Math.abs(x + .5 - CX) <= w && j >= 2 && j < len + 6; },
        (x, y) => .35 + .25 * Math.sin(x * 1.3) + (x < CX ? .12 : -.08), HR);
    }
    if (!covers && style === 'ponytail') { const sx = CX + R.W / 2 + 1; for (let j = 0; j < 24; j++) { const w = 3 + Math.round(Math.sin(j / 5) * 1.5); Rc(sx + Math.round(Math.sin(j / 4) * 3), hTop + 8 + j, w, 1, HR[j % 3 === 0 ? 3 : 1]); } }
    if (['hood', 'skullhood', 'cowl'].includes(K.head)) {
      const hr = ramp(K.head === 'cowl' ? mix(K.c1, -.12) : K.c1);
      fill(CX - R.W / 2 - 7, hTop - 4, CX + R.W / 2 + 7, 56, (x, y) => { const j = y - hTop; return j >= -6 && Math.abs(x + .5 - CX) <= hoodW(j) - 1; }, (x, y) => .3 + .2 * Math.sin(x * .9 + y * .3) + (x < CX ? .1 : -.1), hr);
    }

    // ============ TORSO ============
    const T0 = 45, shW = K.small ? 19 : 22;
    const bodyW = y => Math.min(30, shW - 6 + (y - T0) * 1.05);
    const bodyTest = y0 => (x, y) => y >= y0 && Math.abs(x + .5 - CX) <= bodyW(y);
    const bodyLight = (k, base) => (x, y) => { const u = (x + .5 - CX) / 30; return base - .3 * u + .1 * Math.sin((x + k) * .9) - (y - T0) * .006; };
    if (K.arm === 'plate') {
      fill(0, T0, N - 1, N - 1, bodyTest(T0 + 2), (x, y) => { const u = (x + .5 - CX) / 30; return .55 - .35 * u - (Math.abs(x + .5 - CX) < 2 ? -.3 : 0) - (y - T0) * .004; }, C1);
      for (let y = T0 + 2; y < N; y += 6) Rc(CX - bodyW(y), y, bodyW(y) * 2, 1, C1[1]);          // plate seams
      fill(CX - 14, T0 + 1, CX + 14, T0 + 8, (x, y) => { const u = (x + .5 - CX) / 14, v = (y - T0 - 4.5) / 4; return u * u + v * v <= 1; }, (x, y) => .5 - .3 * (x + .5 - CX) / 14 - (y - T0) * .02, C1); // gorget
      Rc(CX - 12, T0 + 6, 24, 1, C2[3]);
      Rc(CX - 2, T0 + 9, 4, 18, TRR[2]); Rc(CX - 2, T0 + 9, 1, 18, TRR[4]); Rc(CX + 1, T0 + 9, 1, 18, TRR[1]); Rc(CX - 3, T0 + 12, 6, 1, C2[3]); // tabard stripe
      [-1, 1].forEach(s => { const px = CX + s * 22; blob(px, T0 + 9, 10, 8, C1, { bias: .08 }); Rc(px - 7, T0 + 5, 14, 1, C1[4]); P(px - 5, T0 + 9, C2[3]); P(px, T0 + 13, C2[3]); P(px + 5, T0 + 9, C2[3]); Rc(px - 8, T0 + 14, 16, 1, C1[0]); });
      if (K.heavy) [-1, 1].forEach(s => blob(CX + s * 25, T0 + 6, 7, 7, C1, { bias: .1 }));
    } else if (K.arm === 'robe') {
      fill(0, T0, N - 1, N - 1, bodyTest(T0 + 2), (x, y) => { const u = (x + .5 - CX) / 30; return .55 - .3 * u + .07 * Math.sin((x + y * .15) * .6); }, C1);
      for (let y = T0 + 2; y < N; y++) { const w = Math.min(7, 3 + (y - T0) * .35); for (let x = -w; x < w; x++) { const d = Math.abs(x + .5) / w; P(CX + x, y, d < .5 ? SK[1] : C1[0]); } } // V neck over shadow
      for (let y = T0 + 2; y < N; y++) { const w = Math.min(7, 3 + (y - T0) * .35); P(CX - Math.ceil(w), y, C2[3]); P(CX + Math.floor(w) - 1, y, C2[2]); }
      Rc(CX - 12, T0 + 20, 24, 1, TRR[2]); Rc(CX - 12, T0 + 21, 24, 1, TRR[1]);
      SC(26, T0 + 8, 4, 16, C1[1]);
    } else if (K.arm === 'fur') {
      fill(0, T0, N - 1, N - 1, bodyTest(T0 + 3), (x, y) => .5 - .3 * (x + .5 - CX) / 30 + .1 * Math.sin(x * 1.7), C1);
      for (let x = CX - 22; x < CX + 22; x++) { const d = 2 + (x * 7 % 3 + 3) % 3; fill(x, T0 - 1, x, T0 + 5 + d, () => true, (xx, yy) => .5 + (yy - T0) * -.05 + (x % 2 ? .1 : -.1), ramp(K.c2)); }
      [-1, 1].forEach(s => { const fr = ramp(mix(K.c1, .12)); blob(CX + s * 21, T0 + 4, 9, 7, fr, { bias: .05 }); for (let k = 0; k < 7; k++) P(CX + s * 21 - 6 + k * 2, T0 + 10 + (k % 2), fr[0]); });
      Rc(CX - 2, T0 + 10, 5, 12, C1[0]); Rc(CX - 1, T0 + 12, 3, 2, TRR[2]);
    } else if (K.arm === 'cloth') {
      fill(0, T0, N - 1, N - 1, bodyTest(T0 + 2), (x, y) => .55 - .3 * (x + .5 - CX) / 30 + .08 * Math.sin((x - y) * .8), C1);
      for (let y = T0 + 2; y < N; y++) { const w = Math.min(5, 3 + (y - T0) * .2); for (let x = -w; x < w; x++) P(CX + x, y, SK[x < 0 ? 2 : 1]); P(CX - w - 1, y, C2[3]); P(CX + w, y, C2[2]); }
      Rc(CX - 16, T0 + 3, 32, 2, C2[2]); Rc(CX - 16, T0 + 3, 32, 1, C2[4]);
      if (K.beads) for (let k = 0; k < 13; k++) { const px = CX - 6 + k, py = T0 + 4 + Math.round(Math.sin(k / 12 * Math.PI) * 7); P(px, py, '#6a3a22'); P(px, py + 1, '#3a1a0a'); }
      Rc(CX - 8, T0 + 22, 16, 2, TRR[2]);
    } else { // leather
      fill(0, T0, N - 1, N - 1, bodyTest(T0 + 2), (x, y) => .5 - .3 * (x + .5 - CX) / 30 + .06 * Math.sin(y * 1.2), C1);
      fill(CX - 17, T0 + 1, CX + 17, T0 + 6, (x, y) => Math.abs(x + .5 - CX) <= 17 - Math.max(0, 3 - (y - T0)), (x, y) => .4 - .25 * (x + .5 - CX) / 17, ramp(mix(K.c1, -.25))); // collar
      [-1, 1].forEach(s => blob(CX + s * 20, T0 + 6, 8, 6, C1, { bias: .1 }));
      for (let k = 0; k < 22; k++) { const px = CX - 14 + k, py = T0 + 7 + Math.round(k * .85); P(px, py, C2[2]); P(px, py + 1, C2[1]); P(px + 1, py, C2[3]); }
      Rc(CX + 5, T0 + 14, 4, 4, C2[3]); Rc(CX + 6, T0 + 15, 2, 2, C2[0]);
      Rc(CX - 12, T0 + 22, 20, 2, TRR[2]);
    }
    // neck, with the shadow of the jaw
    const nw = Math.round(R.W * .27); fill(CX - nw, chin - 5, CX + nw, T0 + 3, (x, y) => Math.abs(x + .5 - CX) <= nw + (y > chin ? (y - chin) * .5 : 0), (x, y) => .55 - .3 * (x + .5 - CX) / nw - Math.max(0, 1 - (y - chin + 5) / 6) * .55, SK);

    // ============ HEAD ============
    if (R.ear) { // pointed or drooping ears, behind the head
      const L = R.ear, ey = eyeY - 1;
      [-1, 1].forEach(s => { for (let k = 0; k < L; k++) { const droop = race === 'goblin' ? Math.floor(k * .5) : 0, rise = race === 'goblin' ? 0 : Math.floor(k * (L > 8 ? .55 : .3)), yy = ey - rise + droop, th = Math.max(1, 4 - Math.floor(k * 3 / L)), x = CX + s * (R.W / 2 + k - 1) - (s < 0 ? 0 : 0);
        for (let t = 0; t < th; t++) P(s < 0 ? x - 1 : x, yy + t, SK[t === 0 ? 3 : t === th - 1 ? 1 : 2]); if (k > 1 && k < L - 2 && th > 2) P(s < 0 ? x - 1 : x, yy + 1, mix(skinC, race === 'dark_elf' ? .0 : -.0) && SK[1]); }
        if (R.ear <= 3) {} });
    } else if (race !== 'orc') { [-1, 1].forEach(s => blob(CX + s * (R.W / 2 + 0), eyeY + 2, 2.6, 4, SK, { bias: 0 })); }
    fill(CX - R.W / 2 - 1, hTop - 1, CX + R.W / 2, chin, (x, y) => { const j = y - hTop; return j >= 0 && j < R.H && Math.abs(x + .5 - CX) <= hw(j); },
      (x, y) => { const j = y - hTop, w = hw(j), u = clamp((x + .5 - CX) / Math.max(1, w), -1, 1), v = j / R.H * 2 - 1; return clamp(.74 - .34 * u - .16 * v + .16 * (1 - u * u) - (v > .75 ? .12 : 0) - (u > .8 ? .1 : 0), 0, 1); }, SK);
    // cheek warmth and jaw shade
    if (blush && race !== 'dark_elf' && race !== 'orc' && race !== 'goblin') [-1, 1].forEach(s => { Rc(CX + s * 8 - 2, eyeY + 4, 4, 2, lerp(skinC, '#e06a6a', .3)); });
    Rc(CX - 5, chin - 1, 10, 1, SK[1]);

    // ============ FACE ============
    const ex = race === 'orc' ? 7 : race === 'goblin' ? 6 : race === 'dwarf' ? 7 : 6, big = !!R.bigEyes;
    const ew = big ? 6 : 5, eh = big ? 4 : 3;
    [-1, 1].forEach(s => {
      const x0 = s < 0 ? CX - ex - ew + 1 : CX + ex - 1;
      Rc(x0 - 1, eyeY - 1, ew + 2, 1, SK[0]);                                         // socket shadow
      Rc(x0, eyeY, ew, eh, '#f2eee4'); Rc(x0, eyeY + eh - 1, ew, 1, '#cfc8b8');       // white
      const ix = x0 + (s < 0 ? ew - 3 : 0) + (s < 0 ? 0 : 0) + (big ? 0 : 0);
      Rc(ix, eyeY, 3, eh, eyeC); Rc(ix, eyeY, 3, 1, mix(eyeC, -.45)); Rc(ix + 1, eyeY + 1, race === 'goblin' ? 1 : 1, eh - 1, '#101018'); P(ix, eyeY + 1, mix(eyeC, .45));
      P(ix + (s < 0 ? 2 : 0), eyeY + 1, '#fff'); // catch light
      Rc(x0 - 1, eyeY - 1, ew + 2, 1, mix(skinC, -.62));                               // upper lid / lash line
      if (female && race !== 'orc' && race !== 'goblin') { P(s < 0 ? x0 - 1 : x0 + ew, eyeY - 1, '#1b1420'); P(s < 0 ? x0 - 1 : x0 + ew, eyeY, '#1b1420'); }
      const slant = browMood === 1 ? (s < 0 ? 1 : -1) : browMood === 2 ? (s < 0 ? -1 : 1) : 0, by = eyeY - 3 - (R.brow ? 0 : 0), thick = (R.brow || (female ? 1 : 2)), bc = race === 'dwarf' ? HR[1] : (K.head === 'greathelm' ? '#1b1420' : mix(hairC, -.3));
      for (let k = 0; k < ew + 1; k++) { const dy = Math.round(slant * (s < 0 ? (ew - k) : k) / (ew) * 1.2); Rc(x0 - 1 + k, by + dy, 1, thick, bc); }
      if (race === 'dwarf') Rc(x0 - 1, by - 1, ew + 2, 1, HR[2]);
    });
    // nose
    const nose = R.nose || 2, ny = eyeY + 4;
    Rc(CX, eyeY + 1, 1, nose + 2, SK[1]); Rc(CX - 1, eyeY + 1, 1, nose + 1, SK[3]);
    Rc(CX - 1 - (nose > 2 ? 1 : 0), ny + nose, 2 + (nose > 2 ? 2 : 0) + 0, 1, SK[0]); P(CX - 1, ny + nose - 1, SK[4]);
    if (nose > 2) { P(CX - 2, ny + nose - 1, SK[3]); P(CX + 1, ny + nose - 1, SK[3]); }
    // mouth
    const mY = eyeY + 9 + (nose > 2 ? 1 : 0), lipC = female ? lerp(skinC, '#c04a5a', .55) : mix(skinC, -.28), mw = race === 'orc' || race === 'goblin' ? 9 : 6;
    Rc(CX - mw / 2, mY, mw, 1, mix(lipC, -.42)); Rc(CX - mw / 2 + 1, mY + 1, mw - 2, 1, lipC); P(CX - mw / 2 - 1, mY - 0, SK[1]); P(CX + mw / 2, mY, SK[1]);
    if (female) Rc(CX - 1, mY - 1, 3, 1, lerp(skinC, '#c04a5a', .45));
    Rc(CX - 2, mY + 3, 4, 1, SK[1]);
    if (R.tusks) { [-1, 1].forEach(s => { for (let k = 0; k < 4; k++) P(CX + s * 6 - (s < 0 ? 0 : 0), mY - k, k === 3 ? '#fff6e0' : '#ece4cc'); P(CX + s * 6 + 1, mY - 2, '#b8b098'); }); }
    if (race === 'goblin') { SP(CX - 4, mY, '#f2ecd8'); SP(CX - 3, mY + 1, '#f2ecd8'); }
    if (race === 'orc') Rc(CX - 10, eyeY - 4, 20, 1, SK[0]);                           // heavy brow shadow
    // marks: age lines, scars, paint
    if (old && race !== 'goblin') { SC(ex + 3, eyeY + 3, 3, 1, SK[1]); SC(ex + 2, eyeY + 5, 2, 1, SK[1]); Rc(CX - 4, hTop + 6, 8, 1, SK[1]); }
    if (scar) { const sx = CX + (rnd() < .5 ? -1 : 1) * 6; for (let k = 0; k < 8; k++) P(sx + (k >> 1) - 2, eyeY - 4 + k, k % 3 === 0 ? '#e8c0b0' : '#8a3a3a'); }
    if (K.paint) { SC(ex + 6, eyeY + 4, 7, 1, K.paint); SC(ex + 5, eyeY + 6, 6, 1, K.paint); SC(ex + 6, eyeY + 2, 5, 1, K.paint); }

    // ============ BEARD / MASK ============
    const wantsBeard = R.beard || (race === 'human' && !female && !covers && rnd() < .38 && K.head !== 'greathelm') || (race === 'orc' && rnd() < .3 && false);
    if (wantsBeard) {
      const bh = R.beard ? 16 : 7, bw = R.beard ? R.W / 2 + 2 : 8;
      fill(CX - bw - 1, mY - 3, CX + bw, mY - 3 + bh + 2, (x, y) => { const j = y - (mY - 3); const w = bw - (R.beard ? Math.floor(j * .38) : Math.floor(j * .55)); return j >= 0 && j <= bh && Math.abs(x + .5 - CX) <= w && !(j >= 3 && j <= 4 && Math.abs(x + .5 - CX) <= mw / 2); },
        (x, y) => .5 - .25 * (x + .5 - CX) / bw + (x % 3 === 0 ? -.14 : .08) - (y - mY) * .008, HR);
      Rc(CX - mw / 2, mY, mw, 1, mix(lipC, -.5)); Rc(CX - mw / 2 + 1, mY + 1, mw - 2, 1, lipC);
      if (R.beard) { Rc(CX - 7, mY - 5, 14, 1, HR[3]); if (rnd() < .6) { Rc(CX - 2, mY + bh - 3, 4, 5, HR[1]); Rc(CX - 1, mY + bh + 2, 2, 1, C2[3]); } } // braid tip with a bead
    }
    if (K.mask) { fill(CX - R.W / 2 - 1, eyeY + 4, CX + R.W / 2, chin + 1, (x, y) => { const j = y - hTop; return j > R.H - 14 && Math.abs(x + .5 - CX) <= hw(Math.min(R.H - 1, j)) + 1 && y >= eyeY + 4; }, (x, y) => .4 - .25 * (x + .5 - CX) / 14, ramp(mix(K.c1, -.1))); Rc(CX - R.W / 2, eyeY + 4, R.W, 1, C2[3]); }

    // ============ HAIR (front) ============
    const hl = HR[4];
    const cap = (depth, sweep) => fill(CX - R.W / 2 - 3, hTop - 5, CX + R.W / 2 + 2, hTop + 14, (x, y) => { const j = y - hTop, u = (x + .5 - CX) / (R.W / 2 + 1.5); const edge = hTop - 1 + Math.sqrt(Math.max(0, 1 - u * u)) * -0; const lim = hTop + depth - Math.abs(u) * sweep + (u > 0 ? 0 : 2); return u * u + Math.pow((y + .5 - (hTop + 9)) / 14, 2) <= 1.05 && y < lim && y >= hTop - 3 + Math.abs(u) * 4 && j > -4; },
      (x, y) => { const u = (x + .5 - CX) / (R.W / 2 + 2), v = (y - hTop) / 14; return .62 - .3 * u - .22 * v + (((x + y * 2) % 5 === 0) ? -.16 : 0) + (v < .25 ? .12 : 0); }, HR);
    if (!covers) {
      if (style === 'short') { cap(12, 3); SC(R.W / 2 + 1, hTop + 4, 3, 10, HR[1]); }
      else if (style === 'long' || style === 'bob') { cap(11, 3); SC(R.W / 2 + 2, hTop + 6, 4, style === 'long' ? 34 : 18, HR[2]); SC(R.W / 2 + 2, hTop + 12, 1, style === 'long' ? 26 : 8, HR[3]); }
      else if (style === 'ponytail') { cap(11, 2); Rc(CX + R.W / 2 - 1, hTop + 5, 3, 3, C2[3]); }
      else if (style === 'mohawk') { for (let j = -8; j < 8; j++) { const w = j < -4 ? 2 : 3; Rc(CX - w + 1, hTop + j, w * 2 - 1, 1, j % 3 === 0 ? HR[4] : j % 3 === 1 ? HR[3] : HR[2]); } SC(3, hTop + 1, 1, 6, HR[0]); }
      else if (style === 'topknot') { cap(7, 4); blob(CX, hTop - 6, 5, 5, HR, {}); Rc(CX - 4, hTop - 1, 8, 1, C2[2]); }
      else if (style === 'spiky') { cap(8, 4); for (let k = -3; k <= 3; k++) for (let t = 0; t < 6 - Math.abs(k); t++) P(CX + k * 3, hTop - 2 - t, t % 2 ? HR[3] : HR[2]); }
      else if (style === 'tuft') { Rc(CX - 2, hTop - 3, 4, 4, HR[2]); P(CX - 1, hTop - 4, HR[3]); P(CX, hTop - 5, HR[3]); }
      else if (style === 'bald') { Rc(CX - 5, hTop + 1, 5, 1, SK[4]); Rc(CX - 3, hTop + 2, 2, 1, SK[4]); }
    }

    // ============ HEADGEAR ============
    const hg = K.head, hb = hTop, hr = ramp(K.c1), ac = ramp(K.c2);
    const dome = (depth, rp) => fill(CX - R.W / 2 - 3, hb - 8, CX + R.W / 2 + 2, hb + depth, (x, y) => { const u = (x + .5 - CX) / (R.W / 2 + 2), v = (y + .5 - (hb + 8)) / 15; return u * u + v * v <= 1 && y < hb + depth; },
      (x, y) => { const u = (x + .5 - CX) / (R.W / 2 + 2), v = (y - hb) / 15; return .66 - .36 * u - .3 * v + ((Math.abs(u + .35) < .12 && v < .5) ? .35 : 0); }, rp);
    if (hg === 'helm' || hg === 'winghelm' || hg === 'crown') {
      dome(10, hr); Rc(CX - R.W / 2 - 2, hb + 9, R.W + 4, 2, hr[1]); Rc(CX - R.W / 2 - 2, hb + 9, R.W + 4, 1, hr[3]);
      Rc(CX - 1, hb + 10, 3, 12, hr[3]); Rc(CX, hb + 10, 1, 12, hr[4]);                     // nasal bar
      SC(R.W / 2 + 1, hb + 11, 3, 10, hr[1]);                                              // cheek guards
      for (let k = 0; k < 5; k++) P(CX - 8 + k * 4, hb + 5, hr[4]);
      if (hg === 'winghelm') [-1, 1].forEach(s => { for (let k = 0; k < 14; k++) { const x = CX + s * (R.W / 2 + 3 + Math.floor(k * .8)); Rc(x - (s < 0 ? 1 : 0), hb + 5 - k, 2, 1, '#f4f0e0'); P(x + (s < 0 ? -1 : 2) * (k % 2 ? 1 : 0), hb + 4 - k, '#d0c8a8'); Rc(x, hb + 6 - k, 1, 1, '#b8b098'); } });
      if (hg === 'crown') { for (let k = -3; k <= 3; k++) { Rc(CX + k * 3 - 1, hb - 9 + Math.abs(k) * 1, 3, 6, ac[2]); P(CX + k * 3, hb - 9 + Math.abs(k), ac[4]); } Rc(CX - 11, hb - 4, 22, 3, ac[2]); Rc(CX - 11, hb - 4, 22, 1, ac[4]); P(CX, hb - 3, '#e83a3a'); P(CX - 6, hb - 3, '#3a9ae8'); P(CX + 6, hb - 3, '#3ae88a'); }
      if (hg === 'helm') { for (let k = 0; k < 10; k++) { Rc(CX - 2 + Math.floor(k / 3), hb - 12 + k, 4 - Math.floor(k / 5), 1, k % 2 ? ac[3] : ac[2]); } }
    } else if (hg === 'greathelm') {
      fill(CX - R.W / 2 - 3, hb - 5, CX + R.W / 2 + 2, hb + R.H - 4, (x, y) => { const j = y - hb; const w = j < 4 ? R.W / 2 + 1 - (4 - j) * 1.4 : (j > R.H - 14 ? hw(Math.min(R.H - 1, j)) + 1.5 : R.W / 2 + 1.5); return j >= -3 && Math.abs(x + .5 - CX) <= w; },
        (x, y) => { const u = (x + .5 - CX) / (R.W / 2 + 2); return .6 - .36 * u + (Math.abs(u + .5) < .1 ? .3 : 0) - ((y - hb) % 9 === 0 ? .15 : 0); }, hr);
      Rc(CX - R.W / 2 - 1, hb + 10, R.W + 2, 3, '#14101a'); Rc(CX - 1, hb + 10, 3, 17, '#14101a');       // eye slit and breaths
      for (let k = 0; k < 5; k++) { SC(8 + (k % 2), hb + 16 + k * 2, 2, 1, '#14101a'); }
      Rc(CX - R.W / 2 - 1, hb + 8, R.W + 2, 1, hr[4]); Rc(CX - R.W / 2 - 1, hb + R.H - 8, R.W + 2, 1, hr[0]);
      for (let k = 0; k < 5; k++) P(CX - 8 + k * 4, hb + 6, hr[4]);
      if (K.crest) { for (let k = 0; k < 11; k++) Rc(CX - 2 - (k > 6 ? 1 : 0), hb - 13 + k, 5 + (k > 6 ? 2 : 0), 1, k % 2 ? ac[3] : ac[2]); }
      if (K.horns) [-1, 1].forEach(s => { for (let k = 0; k < 15; k++) { const x = CX + s * (R.W / 2 + 1 + Math.floor(k * .4 + k * k / 30)); Rc(x - (s < 0 ? 2 : 0), hb - k + 1, 3 - Math.floor(k / 6), 1, k % 3 === 0 ? '#b8b098' : '#ece4cc'); } });
      if (K.spikes) for (let k = -2; k <= 2; k++) { for (let t = 0; t < 6 - Math.abs(k); t++) { Rc(CX + k * 4 - (t < 2 ? 1 : 0), hb - 1 - t - Math.abs(k), t < 2 ? 3 : 1, 1, t < 2 ? '#c8b8b8' : '#e8e0e0'); } }
      if (K.heavy) { Rc(CX - R.W / 2 - 3, hb + 2, R.W + 6, 4, hr[0]); Rc(CX - R.W / 2 - 3, hb + 2, R.W + 6, 1, hr[3]); }
      Rc(CX - 4, hb + 8, 8, 1, ac[3]);
    } else if (hg === 'hood' || hg === 'cowl' || hg === 'skullhood') {
      const hrr = ramp(hg === 'cowl' ? mix(K.c1, -.1) : K.c1);
      fill(CX - R.W / 2 - 7, hb - 5, CX + R.W / 2 + 7, hb + R.H - 2, (x, y) => { const j = y - hb; if (j < -6 || Math.abs(x + .5 - CX) > hoodW(j)) return false;
          const inner = j < 7 ? -1 : hw(Math.min(R.H - 1, j)) - (j > R.H - 12 ? 1 : 0); return inner < 0 || Math.abs(x + .5 - CX) > inner; },
        (x, y) => { const u = (x + .5 - CX) / (R.W / 2 + 6); return .6 - .35 * u + .12 * Math.sin(x * .8 + y * .25) - (Math.abs(u) < .85 && Math.abs(u) > .6 ? .1 : 0); }, hrr);
      Rc(CX - R.W / 2, hb + 6, R.W, 1, hrr[4]); fill(CX - R.W / 2, hb + 7, CX + R.W / 2, hb + 9, (x, y) => true, () => .08, SK); // shadow cast on the brow
      if (hg === 'skullhood') { blob(CX, hb + 2, 4, 4, ramp('#e8e4d4'), {}); P(CX - 2, hb + 2, '#14101a'); P(CX + 1, hb + 2, '#14101a'); Rc(CX - 1, hb + 4, 2, 1, '#14101a'); }
      if (hg === 'cowl') Rc(CX - 6, hb - 1, 12, 1, ac[3]);
    } else if (hg === 'wizhat' || hg === 'cap') {
      const tall = hg === 'wizhat' ? 17 : 9, bw = R.W / 2 + 7;
      for (let j = 0; j < tall; j++) { const w = Math.max(1, Math.round((bw - 4) * (1 - j / tall))); const bend = hg === 'wizhat' ? Math.round(Math.pow(j / tall, 2) * 6) : 0; fill(CX - w + bend, hb - 1 - j, CX + w + bend - 1, hb - 1 - j, () => true, (x) => .6 - .4 * (x - CX - bend) / Math.max(w, 1) + (j % 6 === 0 ? .12 : 0), hr); }
      fill(CX - bw, hb - 1, CX + bw, hb + 4, (x, y) => { const u = (x + .5 - CX) / bw, v = (y - hb - 1.5) / 3; return u * u + v * v <= 1; }, (x, y) => .6 - .4 * (x + .5 - CX) / bw - (y - hb) * .06, hr);
      Rc(CX - R.W / 2 - 1, hb - 3, R.W + 2, 3, ac[2]); Rc(CX - R.W / 2 - 1, hb - 3, R.W + 2, 1, ac[4]); P(CX, hb - 2, '#fff');
      if (hg === 'wizhat') { P(CX + 3, hb - 10, '#fff'); P(CX - 4, hb - 6, '#fff'); P(CX + 2, hb - 15, '#fff8c0'); }
    } else if (hg === 'brimhat' || hg === 'feathercap') {
      const bw = hg === 'brimhat' ? R.W / 2 + 9 : R.W / 2 + 4, dh = K.tall ? 14 : 8;
      for (let j = 0; j < dh; j++) { const w = R.W / 2 - 1 - (j === dh - 1 ? 2 : 0); fill(CX - w, hb - j + 1, CX + w, hb - j + 1, () => true, (x) => .6 - .4 * (x + .5 - CX) / w, hr); }
      fill(CX - bw, hb, CX + bw, hb + 4, (x, y) => { const u = (x + .5 - CX) / bw, v = (y - hb - 1.5) / 2.6; return u * u + v * v <= 1; }, (x, y) => .6 - .4 * (x + .5 - CX) / bw - (y - hb) * .05, hr);
      Rc(CX - R.W / 2, hb - 2, R.W, 3, ac[2]); Rc(CX - R.W / 2, hb - 2, R.W, 1, ac[4]);
      if (hg === 'feathercap') for (let k = 0; k < 16; k++) { const x = CX + 6 + Math.floor(k * .55); Rc(x, hb - 4 - k, 2, 1, k % 2 ? '#f0ecd8' : '#e84a4a'); P(x + 2, hb - 3 - k, '#d0c8a8'); }
    } else if (hg === 'circlet') {
      Rc(CX - R.W / 2 - 1, hb + 6, R.W + 2, 2, ac[2]); Rc(CX - R.W / 2 - 1, hb + 6, R.W + 2, 1, ac[4]); Rc(CX - 2, hb + 4, 5, 3, ac[3]); blob(CX, hb + 5, 2, 2, ramp(K.bolt ? '#bff4ff' : '#e83a8a'), {});
      if (K.bolt) { for (let k = 0; k < 5; k++) P(CX + 5 + (k % 2), hb + 2 + k, '#a8e8ff'); for (let k = 0; k < 5; k++) P(CX - 6 - (k % 2), hb + 2 + k, '#a8e8ff'); }
    } else if (hg === 'band') {
      Rc(CX - R.W / 2 - 1, hb + 7, R.W + 2, 3, ac[2]); Rc(CX - R.W / 2 - 1, hb + 7, R.W + 2, 1, ac[4]); Rc(CX - R.W / 2 - 1, hb + 9, R.W + 2, 1, ac[0]);
      Rc(CX + R.W / 2 + 1, hb + 9, 4, 2, ac[2]); Rc(CX + R.W / 2 + 2, hb + 11, 3, 5, ac[1]);
    } else if (hg === 'horns') {
      dome(8, hr); Rc(CX - R.W / 2 - 2, hb + 7, R.W + 4, 2, hr[0]);
      [-1, 1].forEach(s => { for (let k = 0; k < 16; k++) { const x = CX + s * (R.W / 2 + 1 + Math.floor(k * .35 + k * k / 26)); Rc(x - (s < 0 ? 3 : 0), hb + 5 - k, Math.max(1, 4 - Math.floor(k / 4)), 1, k % 3 === 0 ? '#b8b098' : '#ece4cc'); } });
    } else if (hg === 'feathers') {
      Rc(CX - R.W / 2, hb + 6, R.W, 3, hr[2]); Rc(CX - R.W / 2, hb + 6, R.W, 1, hr[4]);
      for (let k = 0; k < 5; k++) { const cc = ['#e8e4d0', '#e84a4a', '#3a9ad8', '#e8c040', '#e8e4d0'][k]; for (let m = 0; m < 14 - Math.abs(k - 2) * 3; m++) { P(CX - 10 + k * 5 + Math.floor((k - 2) * m * .3), hb + 5 - m, cc); P(CX - 9 + k * 5 + Math.floor((k - 2) * m * .3), hb + 5 - m, mix(cc, -.25)); } }
    } else if (hg === 'leaf' || hg === 'leafhelm') {
      if (hg === 'leafhelm') { dome(10, hr); Rc(CX - R.W / 2 - 2, hb + 9, R.W + 4, 2, hr[1]); Rc(CX - 1, hb + 10, 3, 12, hr[3]); }
      for (let k = -4; k <= 4; k++) { const lf = k % 2 ? ramp('#6ab04a') : ramp('#3f8a3a'); const x = CX + k * 4, y = hb + (hg === 'leaf' ? 3 : 0) - Math.round(Math.abs(k) * .7) - (k % 2 ? 2 : 4); fill(x - 2, y - 1, x + 2, y + 3, (xx, yy) => Math.abs(xx - x) + Math.abs(yy - y - 1) <= 3, (xx, yy) => .8 - (yy - y) * .14, lf); }
      if (hg === 'leaf') Rc(CX - R.W / 2, hb + 6, R.W, 1, '#6a4a2a');
    } else if (hg === 'mitre') {
      fill(CX - R.W / 2, hb - 14, CX + R.W / 2, hb + 8, (x, y) => { const j = y - (hb - 14), w = Math.max(2, (R.W / 2 - 1) * Math.min(1, (j + 3) / 16) * (1 - Math.max(0, j - 16) * .0)); return j >= 0 && Math.abs(x + .5 - CX) <= (j < 14 ? 3 + j * .6 : R.W / 2 - 1); }, (x, y) => .7 - .35 * (x + .5 - CX) / 10 - (y - hb) * .004, hr);
      Rc(CX - R.W / 2, hb + 5, R.W, 3, ac[2]); Rc(CX - R.W / 2, hb + 5, R.W, 1, ac[4]); Rc(CX - 1, hb - 10, 3, 9, ac[2]); Rc(CX - 3, hb - 8, 7, 2, ac[2]); Rc(CX, hb - 9, 1, 8, ac[4]);
    }

    // ============ OUTLINE: each edge pixel takes the dark of the pixel it borders ============
    const id = g.getImageData(0, 0, N, N), d = id.data, a = (x, y) => (x >= 0 && y >= 0 && x < N && y < N) ? d[(y * N + x) * 4 + 3] : 0;
    const o = g.createImageData(N, N); o.data.set(d);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (a(x, y) < 40) {
      let best = null; for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (a(x + dx, y + dy) > 40) { const i = ((y + dy) * N + x + dx) * 4; best = [d[i], d[i + 1], d[i + 2]]; break; }
      if (best) { const i = (y * N + x) * 4; o.data[i] = best[0] * .3 + 8; o.data[i + 1] = best[1] * .3 + 5; o.data[i + 2] = best[2] * .3 + 14; o.data[i + 3] = 255; }
    }
    g.putImageData(o, 0, 0);

    // ============ BACKDROP: team glow behind the head, vignette, fine dither ============
    const c = cv.getContext('2d'), bg = team === 'E' ? ['#7a3a38', '#1e1014'] : ['#3f7aa0', '#101a28'];
    const gr = c.createRadialGradient(CX, 26, 4, CX, 30, 46); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); c.fillStyle = gr; c.fillRect(0, 0, N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x + y) & 1) === 0 && ((x >> 1) + (y >> 1)) % 3 === 0) { c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(x, y, 1, 1); }
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(CX - 20, 52, 40, 12); // soft ground shadow so the shoulders sit
    c.drawImage(lay, 0, 0);
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.strokeRect(.5, .5, N - 1, N - 1);
    return cv;
  }

  // ---- monsters: crop of the board sprite (idle, facing down), scaled to fill the card
  const MON = ['dire_wolf', 'cave_bear', 'giant_spider', 'ghoul', 'banshee', 'bone_archer', 'fire_elemental', 'stone_golem', 'storm_elemental', 'drake_whelp', 'basilisk', 'maw_horror', 'elder_drake', 'barrow_king'];
  const sheets = {};
  function monster(job, team) {
    const t = team === 'P' ? 'ally' : 'enemy'; let im = sheets[t];
    if (!im) { im = sheets[t] = new Image(); im.onload = () => { im.ok = true; PORT.onready && PORT.onready(); }; im.src = 'sprites/' + t + '/monsters.png'; }
    if (!im.ok) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
    const gr = c.createRadialGradient(CX, 26, 4, CX, 30, 46); gr.addColorStop(0, team === 'E' ? '#7a3a38' : '#3f7aa0'); gr.addColorStop(1, team === 'E' ? '#1e1014' : '#101a28'); c.fillStyle = gr; c.fillRect(0, 0, N, N);
    const i = MON.indexOf(job), sx = (i % 6) * 128, sy = Math.floor(i / 6) * 640;
    c.imageSmoothingEnabled = false; c.drawImage(im, sx, sy, 32, 32, -8, -6, 80, 80);
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeRect(.5, .5, N - 1, N - 1);
    return cv;
  }

  const CROP = 44, CROP_X = 10, CROP_Y = 7;
  const cache = {};
  // Named NPCs (design/visual_pass.md): hand-made busts in portraits/npc/<id>.png, matched on the unit's or speaker's name.
  const NPC = { voss: /\bVoss\b/, harrow: /\bHarrow\b(?! Farms)/, osric: /\bOsric\b/, corisande: /\bCorisande\b/, ilvane: /\bIlvane\b/, thorne: /\bThorne\b/, crane: /\bCrane\b/,
    agathe: /\bAgathe\b/, old_standard: /\bOld Standard\b/, hask: /\bHask\b/, wil: /\bWil( Fenn)?\b|\bKing Wil\b/, brielle: /\bBrielle\b/, harte: /\bHarte\b/, teodor: /\bTeodor\b/,
    marsh: /\bHester Marsh\b|\bAgent Marsh\b/, vell: /\bCassia Vell\b|\bWarden Vell\b/, rook: /\bMags Rook\b|\bSergeant Rook\b/, kit: /\bKit Ashby\b/, nell: /^Nell\b/, tobin: /\bTobin Reed\b|^Tobin\b/,
    aldo: /\bBrother Aldo\b/, aldric: /\bAldric\b/, corley: /\bCorley\b/, maren: /\bMaren\b/, tobb: /\bTobb\b/, wen: /\bOld Wen\b/, dov: /\bDov Quill\b/, ysolde: /\bYsolde\b/ };
  const NIMG = {};
  const npcOf = name => { if (!name) return null; for (const k in NPC) if (NPC[k].test(name)) return k; return null; };
  function npcImg(k) {
    let i = NIMG[k];
    if (!i) { i = NIMG[k] = new Image(); i.onload = () => { i.ok = true; for (const c in cache) if (npcOf(c.split('|')[3]) === k) delete cache[c]; PORT.onready && PORT.onready(); }; i.src = 'portraits/npc/' + k + '.png'; }
    return i.ok ? i : null;
  }
  function npcCanvas(k, team) {
    const i = npcImg(k); if (!i) return null;
    const o = document.createElement('canvas'); o.width = o.height = 132; const c = o.getContext('2d');
    const gr = c.createRadialGradient(66, 50, 10, 66, 66, 100); gr.addColorStop(0, team === 'E' ? '#5a2a26' : '#3a3424'); gr.addColorStop(1, '#141820');
    c.fillStyle = gr; c.fillRect(0, 0, 132, 132); c.drawImage(i, 0, 0, 132, 132); return o;
  }
  const PORT = {
    ready: true, onready: null, size: 132,
    canvas(u, team) {
      const b = (u && u.build) || u || {}, job = b.primary || u.job;
      team = team || (u && (u.baseTeam || u.team)) || 'P'; if (team !== 'P' && team !== 'E') team = 'P';
      const ck = [team, b.race || u.race || 'human', job, b.name || u.n || u.name].join('|');
      if (cache[ck]) return cache[ck];
      { const nk = npcOf(b.name || u.n || u.name); if (nk) { const nv = npcCanvas(nk, team); if (nv) { cache[ck] = nv; return nv; } npcImg(nk); } }
      let cv = MON.includes(job) ? monster(job, team) : make(u, team);
      if (!cv) return null;
      // tighter crop: keep the middle 48x48 of the 64 grid (head, neck and the top of the shoulders), then scale 3x with hard edges so the card can show it at 72px
      const o = document.createElement('canvas'); o.width = o.height = CROP * 3; const c = o.getContext('2d'); c.imageSmoothingEnabled = false;
      c.drawImage(cv, CROP_X, CROP_Y, CROP, CROP, 0, 0, CROP * 3, CROP * 3);
      cache[ck] = o; return o;
    },
    // Safari refuses toDataURL on a canvas it counts as cross-origin (seen on raw.githack previews); show the unit's letters instead of stopping the battle.
    url(u, team) { const c = PORT.canvas(u, team); if (!c) return ''; if (c.url === undefined) { try { c.url = c.toDataURL(); } catch (e) { c.url = ''; } } return c.url; },
    // the file of a named NPC's bust, or '' (for <img> on story sheets)
    npcSrc(name) { const k = npcOf(name); return k ? 'portraits/npc/' + k + '.png' : ''; },
    classes: () => Object.keys(CLS), races: () => Object.keys(RACE)
  };
  window.PORT = PORT;
  Object.keys(NPC).forEach(npcImg);   // load the NPC busts up front so the first scene or battle already has them
})();
