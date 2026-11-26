/* Placeholder battle effects: projectiles, impacts, heal/buff pulses, damage numbers, death fade, small screen shake.
   Everything is drawn in code on a transparent canvas laid over the board. No art files.
   Visual only: it never changes a rule, and the headless sim does not load it.

   Hooks (called by index.html):  FX.cast(u, id, A, target, tile)   when a skill resolves (returns flight time in ms)
                                  FX.num(unit, amount, opts)        damage / heal / shield numbers
                                  FX.status(unit, kind)             'buff' | 'debuff' pulse
                                  FX.death(unit)                    fade-out ghost
                                  FX.summon(x, y)
   Setup:  FX.init({ proj(x, y, lift) -> [px, py, R], footprint(u, A, tile) -> [[x,y]..], dist(a, b), host: element })
   Tuning: the STYLE tables below. ELEMENT colours come from ability tags; OVERRIDE changes one ability by id.
   Setting: FX.level = 0 (off) | 1 (fast) | 2 (normal). Saved in localStorage when available. */
(function () {
  const ELEMENT = { fire: '#ff7a33', frost: '#8fd8ff', lightning: '#ffe14d', holy: '#fff0a0', shadow: '#a064d8', nature: '#7cc480', poison: '#8bd04a', arcane: '#c28bff', mind: '#ff8fd0', spirit: '#9fe6e0', bleed: '#d94141', song: '#ffd27a', physical: '#e9e4d3' };
  const ORDER = ['fire', 'frost', 'lightning', 'holy', 'shadow', 'poison', 'nature', 'arcane', 'mind', 'spirit', 'bleed', 'song', 'physical'];
  // proj: arrow | orb | bolt | lob | none (melee and self skills use an impact only). impact: slash | burst | none. Add entries by ability id to change one skill.
  const OVERRIDE = {
    stone_toss: { proj: 'lob', color: '#b9a98a' },
    pocket_sand: { proj: 'lob', color: '#d9c28a', impact: 'puff' }
  };
  const SPEED = [0, 0.6, 1]; // time scale by level: off, fast, normal

  let ctx = null, ov = null, g = null, list = [], raf = 0, lag = 0, shake = null, host = null, curEl = 'physical';
  const now = () => performance.now();
  const FX = { level: 2, lag: 0 };
  try { const v = localStorage.getItem('fxlevel'); if (v !== null && +v >= 0 && +v <= 2) FX.level = +v; } catch (e) { }
  const sp = () => SPEED[FX.level] || 0;

  function styleOf(id, A) {
    const o = OVERRIDE[id] || {}, tags = A.tags || [];
    let el = ORDER.find(t => tags.includes(t)) || 'physical';
    const col = o.color || ELEMENT[el];
    const ranged = tags.includes('ranged') || (A.r || 1) > 1, spell = tags.includes('spell');
    let proj = o.proj;
    if (!proj) {
      if (A.k === 'self' || A.k === 'trap') proj = 'none';
      else if (!ranged) proj = 'none';
      else if (el === 'lightning') proj = 'bolt';
      else if (spell || A.k === 'heal' || A.k === 'buff' || A.k === 'debuff') proj = 'orb';
      else proj = 'arrow';
    }
    let impact = o.impact;
    if (!impact) impact = (A.k === 'dmg' && !spell && !ranged) ? 'slash' : (A.k === 'dmg' && !spell) ? 'hit' : 'burst';
    return { col, proj, impact, el, kind: A.k, spell };
  }

  // times given in ms at normal speed; scaled by the setting (fast = shorter)
  const T = ms => ms * (sp() || 1);
  function addT(delay, dur, draw) { list.push({ t0: now() + T(delay), dur: T(dur), draw }); kick(); }

  function ensure() {
    if (ov || !ctx) return !!ov;
    host = ctx.host; ov = document.createElement('canvas'); ov.id = 'fxc';
    ov.style.cssText = 'position:absolute;pointer-events:none;z-index:3;left:0;top:0';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(ov); g = ov.getContext('2d'); return true;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0; if (!ensure()) return;
    const cv = ctx.canvas(), t = now();
    if (ov.width !== cv.width || ov.height !== cv.height) { ov.width = cv.width; ov.height = cv.height; }
    ov.style.left = cv.offsetLeft + 'px'; ov.style.top = cv.offsetTop + 'px'; ov.style.width = cv.clientWidth + 'px'; ov.style.height = cv.style.height || cv.clientHeight + 'px';
    const dpr = cv.width / (cv.clientWidth || cv.width);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, ov.width, ov.height);
    list = list.filter(e => t < e.t0 + e.dur);
    for (const e of list) { if (t < e.t0) continue; const p = Math.min(1, (t - e.t0) / e.dur); g.save(); try { e.draw(g, p); } catch (err) { e.dur = 0; } g.restore(); }
    // shake
    if (shake) { const q = (t - shake.t0) / shake.dur; if (q >= 1) { host.style.transform = ''; shake = null; } else if (q >= 0) { const a = shake.amp * (1 - q); host.style.transform = `translate(${(Math.random() - .5) * 2 * a}px,${(Math.random() - .5) * 2 * a}px)`; } }
    if (list.length || shake) raf = requestAnimationFrame(frame);
    else { g.clearRect(0, 0, ov.width, ov.height); }
  }
  const pt = (x, y, lift) => ctx.proj(x, y, lift || 0);
  const body = (x, y) => pt(x, y, 0.55 * pt(x, y, 0)[2]);

  // ---------- drawing helpers ----------
  function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1; }
  function tileFlash(x, y, col, p) { const [px, py, R] = pt(x, y, 0), a = (1 - p) * .65; g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.ellipse(px, py, R * .95 * (.6 + .4 * p), R * .95 * (.6 + .4 * p) * .5, 0, 0, 7); g.fill(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; }
  function sparks(g, x, y, R, col, p, n, seed) { g.fillStyle = col; for (let i = 0; i < n; i++) { const an = (i / n) * 6.283 + seed, d = R * (.25 + 1.1 * p) * (.7 + ((i * 37) % 10) / 20); g.globalAlpha = 1 - p; g.beginPath(); g.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * .8, Math.max(.8, R * .09 * (1 - p)), 0, 7); g.fill(); } g.globalAlpha = 1; }

  // ---------- impacts ----------
  // ---- seeded randomness and small shapes (stateless: everything is a function of progress p) ----
  const rr = (i, k) => { const x = Math.sin(i * 127.1 + (k || 0) * 311.7) * 43758.5453; return x - Math.floor(x); };
  const mix = (hex, amt) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, f = c => Math.round(c + (255 - c) * amt); return `rgb(${f(r)},${f(gg)},${f(b)})`; };
  function drop(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s * 1.2); g.quadraticCurveTo(x + s * .9, y + s * .1, x, y + s * .8); g.quadraticCurveTo(x - s * .9, y + s * .1, x, y - s * 1.2); g.fill(); }
  function flame(g, x, y, s, col, col2) { g.fillStyle = col; g.beginPath(); g.moveTo(x, y - s * 1.7); g.quadraticCurveTo(x + s * 1.1, y - s * .2, x + s * .4, y + s * .7); g.quadraticCurveTo(x, y + s * 1.0, x - s * .4, y + s * .7); g.quadraticCurveTo(x - s * 1.1, y - s * .2, x, y - s * 1.7); g.fill(); g.fillStyle = col2; g.beginPath(); g.moveTo(x, y - s * .7); g.quadraticCurveTo(x + s * .5, y + s * .1, x, y + s * .6); g.quadraticCurveTo(x - s * .5, y + s * .1, x, y - s * .7); g.fill(); }
  function shard(g, x, y, len, w, ang) { g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(len, 0); g.lineTo(0, -w); g.lineTo(-len * .25, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore(); }
  function star4(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); }
  function leaf(g, x, y, s, ang) { g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.ellipse(0, 0, s * 1.4, s * .6, 0, 0, 7); g.fill(); g.restore(); }
  function note(g, x, y, s) { g.beginPath(); g.ellipse(x, y, s * .6, s * .42, -.4, 0, 7); g.fill(); g.lineWidth = Math.max(1, s * .16); g.beginPath(); g.moveTo(x + s * .5, y - s * .1); g.lineTo(x + s * .5, y - s * 1.7); g.lineTo(x + s * 1.0, y - s * 1.3); g.stroke(); }
  function ringW(g, x, y, r, w, col, a) { g.globalAlpha = Math.max(0, a); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.ellipse(x, y, r, r * .55, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }

  // One element's impact on a body at (x, y); R = tile radius; p = 0..1
  function elementImpact(el, col, x, y, R, p) {
    const e = 1 - (1 - p) * (1 - p), fade = 1 - p;
    if (el === 'fire') {
      glow(g, x, y, R * (.5 + .9 * e), '#ff8a2b', fade * .9);
      for (let i = 0; i < 4; i++) { const fx = x + (rr(i, 1) - .5) * R * 1.0, fy = y + R * .25 - R * (.1 + 1.0 * e) * (.6 + rr(i, 2) * .6); g.globalAlpha = Math.sin(Math.min(1, p * 1.15) * 3.14); flame(g, fx, fy, R * (.22 + .12 * rr(i, 3)), '#ff6a1e', '#ffd36b'); }
      g.fillStyle = '#ffb347'; for (let i = 0; i < 9; i++) { const an = rr(i, 4) * 6.28, d = R * (.2 + 1.0 * e) * (.5 + rr(i, 5)); g.globalAlpha = fade; g.beginPath(); g.arc(x + Math.cos(an) * d, y - Math.abs(Math.sin(an)) * d * 1.1 - R * .2 * e, Math.max(.8, R * .07 * fade), 0, 7); g.fill(); }
    } else if (el === 'frost') {
      glow(g, x, y, R * (.5 + .7 * e), '#bfe9ff', fade * .7); ringW(g, x, y, R * (.3 + 1.0 * e), 2.5, '#e8f8ff', fade);
      g.fillStyle = '#d6f3ff'; for (let i = 0; i < 9; i++) { const an = i / 9 * 6.28 + .3, d = R * (.15 + .95 * e); g.globalAlpha = Math.min(1, fade * 1.6); shard(g, x + Math.cos(an) * d, y + Math.sin(an) * d * .8, R * (.34 - .12 * p), R * .1, an); }
      g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.globalAlpha = Math.abs(Math.sin(p * 9 + i)) * fade; star4(g, x + (rr(i, 6) - .5) * R * 1.4, y + (rr(i, 7) - .6) * R * 1.2, R * .14); }
    } else if (el === 'lightning') {
      glow(g, x, y, R * (.4 + .9 * Math.sin(p * 3.14)), '#fff6b0', fade); g.strokeStyle = '#fffbe0'; g.lineCap = 'round'; g.lineJoin = 'round';
      const fl = Math.floor(p * 7); for (let i = 0; i < 6; i++) { const an = rr(i + fl, 8) * 6.28, L = R * (.5 + .7 * rr(i, 9)); g.globalAlpha = fade * (.5 + .5 * rr(fl + i, 10)); g.lineWidth = 2.2; g.strokeStyle = i % 2 ? '#ffe14d' : '#fffbe0'; g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let k = 1; k <= 3; k++) { px = x + Math.cos(an) * L * k / 3 + (rr(i * 7 + k + fl, 11) - .5) * R * .35; py = y + Math.sin(an) * L * k / 3 + (rr(i * 5 + k + fl, 12) - .5) * R * .35; g.lineTo(px, py); } g.stroke(); }
    } else if (el === 'holy') {
      const bw = R * .55 * Math.sin(Math.min(1, p * 1.3) * 3.14), gr = g.createLinearGradient(0, y - R * 2.6, 0, y + R * .3); gr.addColorStop(0, 'rgba(255,245,170,0)'); gr.addColorStop(.7, 'rgba(255,245,170,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.globalAlpha = Math.max(0, fade + .2) * .85; g.fillStyle = gr; g.fillRect(x - bw, y - R * 2.6, bw * 2, R * 2.9); g.globalAlpha = 1; ringW(g, x, y + R * .2, R * (.3 + .9 * e), 2.5, '#fff6b8', fade);
      g.fillStyle = '#fff8c8'; for (let i = 0; i < 7; i++) { const ph = (p * 1.2 + i / 7) % 1; g.globalAlpha = Math.sin(ph * 3.14) * fade * 1.4; star4(g, x + (rr(i, 13) - .5) * R * 1.1, y + R * .2 - ph * R * 1.8, R * .13); }
    } else if (el === 'shadow') {
      glow(g, x, y, R * (.6 + .6 * e), '#3a1a5c', fade * .9); glow(g, x, y, R * (.35 + .4 * e), '#a064d8', fade * .55);
      g.strokeStyle = '#b98aff'; g.lineWidth = 2.4; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a0 = i * 1.57 + p * 5, rad = R * (.25 + .8 * e); g.globalAlpha = fade; g.beginPath(); g.arc(x, y, rad, a0, a0 + 1.1); g.stroke(); }
      g.fillStyle = '#7a4cb0'; for (let i = 0; i < 6; i++) { g.globalAlpha = fade * .8; g.beginPath(); g.arc(x + (rr(i, 14) - .5) * R * 1.2, y - R * (.1 + 1.0 * e * rr(i, 15)), R * .08, 0, 7); g.fill(); }
    } else if (el === 'nature') {
      glow(g, x, y, R * (.4 + .6 * e), '#8ed17b', fade * .6); for (let i = 0; i < 9; i++) { const an = i / 9 * 6.28 + p * 3, d = R * (.2 + .9 * e); g.globalAlpha = fade; g.fillStyle = i % 2 ? '#6fbf5a' : '#a7e08a'; leaf(g, x + Math.cos(an) * d, y + Math.sin(an) * d * .75 - R * .2 * e, R * .13, an + p * 4); }
    } else if (el === 'poison') {
      glow(g, x, y, R * (.4 + .6 * e), '#7fc23a', fade * .6); g.strokeStyle = '#c5f07a'; g.lineWidth = 1.8; for (let i = 0; i < 7; i++) { const ph = (p + i / 7) % 1, bx = x + (rr(i, 16) - .5) * R * 1.0, by = y + R * .2 - ph * R * 1.5, br = R * (.07 + .09 * rr(i, 17)) * (1 + ph * .6); g.globalAlpha = Math.sin(ph * 3.14) * fade * 1.5; g.fillStyle = 'rgba(139,208,74,.45)'; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = '#8bd04a'; for (let i = 0; i < 5; i++) { const an = rr(i, 18) * 6.28, d = R * (.2 + .8 * e); g.globalAlpha = fade; drop(g, x + Math.cos(an) * d, y + Math.sin(an) * d * .7 + R * .35 * p * p, R * .09); }
    } else if (el === 'arcane') {
      ringW(g, x, y, R * (.5 + .55 * e), 2.2, '#d9b6ff', fade); ringW(g, x, y, R * (.32 + .35 * e), 1.6, '#c28bff', fade);
      g.save(); g.translate(x, y); g.scale(1, .55); g.rotate(p * 3); g.strokeStyle = '#e6d0ff'; g.lineWidth = 1.8; g.globalAlpha = fade; g.beginPath(); for (let i = 0; i < 6; i++) { const an = i * 1.047, rad = R * (.5 + .55 * e) * .85; g.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } g.closePath(); g.stroke(); g.restore();
      g.fillStyle = '#e6d0ff'; for (let i = 0; i < 7; i++) { const an = rr(i, 19) * 6.28, d = R * (.2 + .9 * e); g.globalAlpha = fade; star4(g, x + Math.cos(an) * d, y + Math.sin(an) * d * .7 - R * .3 * e, R * .1); }
    } else if (el === 'mind') {
      for (let k = 0; k < 3; k++) ringW(g, x, y - R * .3, R * (.25 + .8 * Math.max(0, e - k * .12)), 2, k % 2 ? '#ffb7e6' : '#ff8fd0', fade * (1 - k * .2));
      g.fillStyle = '#ffc9ec'; for (let i = 0; i < 5; i++) { g.globalAlpha = fade; star4(g, x + Math.cos(i * 1.26 + p * 4) * R * .6 * e, y - R * .3 + Math.sin(i * 1.26 + p * 4) * R * .35 * e, R * .1); }
    } else if (el === 'spirit') {
      glow(g, x, y - R * .3, R * (.5 + .5 * e), '#bff7f1', fade * .7); g.strokeStyle = '#d8fffb'; g.lineWidth = 2; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.globalAlpha = fade * .9; g.beginPath(); for (let k = 0; k <= 8; k++) { const q = k / 8, wy = y + R * .3 - q * R * (.8 + e), wx = x + Math.sin(q * 6 + i * 1.6 + p * 4) * R * .22 + (i - 1.5) * R * .22; k ? g.lineTo(wx, wy) : g.moveTo(wx, wy); } g.stroke(); }
    } else if (el === 'bleed') {
      g.fillStyle = '#c42727'; for (let i = 0; i < 9; i++) { const an = -1.57 + (rr(i, 20) - .5) * 3, d = R * (.2 + .9 * e) * (.5 + rr(i, 21)); g.globalAlpha = fade; drop(g, x + Math.cos(an) * d, y + Math.sin(an) * d + R * .8 * p * p, R * (.07 + .05 * rr(i, 22))); }
      g.strokeStyle = '#ff6b6b'; g.lineWidth = Math.max(1.5, R * .09 * fade); g.lineCap = 'round'; g.globalAlpha = fade; g.beginPath(); g.moveTo(x - R * .5, y - R * .5); g.lineTo(x - R * .5 + R * 1.1 * Math.min(1, p * 2.5), y - R * .5 + R * 1.0 * Math.min(1, p * 2.5)); g.stroke();
    } else if (el === 'song') {
      for (let k = 0; k < 3; k++) { const q = Math.max(0, p - k * .14); ringW(g, x, y - R * .2, R * (.2 + 1.3 * q), 2.2, '#ffd27a', (1 - q) * (1 - k * .25)); }
      g.fillStyle = g.strokeStyle = '#fff0c0'; for (let i = 0; i < 2; i++) { const ph = (p + i * .4) % 1; g.globalAlpha = Math.sin(ph * 3.14); note(g, x + (i ? 1 : -1) * R * .45, y - R * (.1 + 1.0 * ph), R * .2); }
    } else { // physical
      glow(g, x, y, R * (.35 + .8 * e), '#fff', fade * .55); g.strokeStyle = '#fff6e0'; g.lineCap = 'round'; g.lineWidth = Math.max(1.5, R * .09 * fade);
      for (let i = 0; i < 8; i++) { const an = i / 8 * 6.28 + .2, r0 = R * (.15 + .35 * e), r1 = R * (.3 + .85 * e); g.globalAlpha = fade; g.beginPath(); g.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * .8); g.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1 * .8); g.stroke(); }
      g.fillStyle = '#d9c9a6'; for (let i = 0; i < 5; i++) { const an = rr(i, 23) * 6.28, d = R * (.2 + .7 * e); g.globalAlpha = fade * .7; g.beginPath(); g.arc(x + Math.cos(an) * d, y + R * .35 + Math.sin(an) * d * .3 - R * .2 * e, R * .07 * (1 + e), 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  // ---------- impacts ----------
  function impactAt(kind, col, tx, ty, delay) {
    if (kind === 'none') return; const el = curEl;
    addT(delay, kind === 'slash' ? 380 : 520, (g, p) => {
      const [x, y, R] = body(tx, ty);
      if (kind === 'slash') {
        g.strokeStyle = col; g.lineCap = 'round'; g.globalAlpha = 1 - p * p;
        for (const k of [0, 1]) { g.lineWidth = R * (.2 - .13 * p); g.beginPath(); const a0 = -2.3 + k * .5, a1 = a0 + 1.5 * Math.min(1, p * 2.2); g.arc(x, y, R * (.8 + k * .18), a0, a1); g.stroke(); }
        g.globalAlpha = 1; if (p > .1) elementImpact(el === 'physical' || !el ? 'physical' : el, col, x, y, R * .8, (p - .1) / .9);
      } else if (kind === 'puff') { g.fillStyle = col; for (let i = 0; i < 9; i++) { const an = i * .7 + p, d = R * (.2 + .9 * p); g.globalAlpha = (1 - p) * .6; g.beginPath(); g.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * .6, R * (.12 + .1 * p), 0, 7); g.fill(); } g.globalAlpha = 1; }
      else elementImpact(el || 'physical', col, x, y, R, p);
    });
  }
  function ringPulse(unitXY, col, up, delay) { // buffs rise, debuffs sink
    addT(delay, 520, (g, p) => {
      const [x, y, R] = pt(unitXY[0], unitXY[1], 0), lift = R * (up ? 1.4 * p : 1.4 * (1 - p)) , a = Math.sin(Math.min(1, p) * 3.14);
      g.strokeStyle = col; g.lineWidth = 3; g.globalAlpha = a; g.beginPath(); g.ellipse(x, y - lift, R * .75, R * .75 * .5, 0, 0, 7); g.stroke();
      g.fillStyle = col; for (let i = 0; i < 6; i++) { const an = i * 1.047 + p * 2, yy = y - lift - (up ? 1 : -1) * R * .5 * p; g.beginPath(); g.arc(x + Math.cos(an) * R * .6, yy + Math.sin(an) * R * .3, R * .07, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    });
  }
  function healMotes(tx, ty, delay) {
    addT(delay, 700, (g, p) => {
      const [x, y, R] = pt(tx, ty, 0); g.fillStyle = '#8ff0a8';
      for (let i = 0; i < 8; i++) { const ph = (p + i / 8) % 1, xx = x + Math.sin(i * 2.1 + p * 4) * R * .55, yy = y - R * (.2 + 1.3 * ph); g.globalAlpha = Math.sin(ph * 3.14) * (1 - p * .5); g.fillRect(xx - R * .04, yy - R * .1, R * .08, R * .2); g.fillRect(xx - R * .1, yy - R * .04, R * .2, R * .08); }
      g.globalAlpha = 1; glow(g, x, y - R * .5, R * .9, '#5fe08a', .35 * (1 - p));
    });
  }

  // ---------- projectiles ----------
  function lerpPos(a, b, p, arc) { const x = a[0] + (b[0] - a[0]) * p, y = a[1] + (b[1] - a[1]) * p - Math.sin(p * 3.14159) * arc; return [x, y]; }
  function flight(style, fx, fy, tx, ty, delay) {
    const A = body(fx, fy), B = body(tx, ty), d = ctx.dist({ x: fx, y: fy }, { x: tx, y: ty }), col = style.col, el = style.el || curEl;
    const ms = Math.min(430, 120 + d * 50);
    if (style.proj === 'bolt') { // lightning: instant jagged line that flickers
      addT(delay, 230, (g, p) => { const a = body(fx, fy), b = body(tx, ty), R = a[2], n = 7; g.strokeStyle = col; g.lineJoin = 'round'; g.globalAlpha = 1 - p; for (const w of [[R * .28, 'rgba(255,225,77,.35)'], [R * .09, '#fffbe0']]) { g.lineWidth = w[0]; g.strokeStyle = w[1]; g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 1; i < n; i++) { const q = i / n, jx = Math.sin(i * 12.9 + Math.floor(p * 6) * 3.1) * R * .35, jy = Math.cos(i * 7.7 + Math.floor(p * 6) * 2.3) * R * .35; g.lineTo(a[0] + (b[0] - a[0]) * q + jx, a[1] + (b[1] - a[1]) * q + jy); } g.lineTo(b[0], b[1]); g.stroke(); } g.globalAlpha = 1; });
      return 160;
    }
    addT(delay, ms, (g, p) => {
      const a = body(fx, fy), b = body(tx, ty), R = a[2], s = R / 22, arc = style.proj === 'lob' ? R * 1.6 : style.proj === 'arrow' ? R * .35 : R * .15;
      const pos = lerpPos(a, b, p, arc), prev = lerpPos(a, b, Math.max(0, p - .04), arc), ang = Math.atan2(pos[1] - prev[1], pos[0] - prev[0]);
      if (style.proj === 'arrow') {
        g.translate(pos[0], pos[1]); g.rotate(ang); g.strokeStyle = '#d9cfae'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-17 * s, 0); g.lineTo(0, 0); g.stroke();
        g.fillStyle = '#f2efe4'; g.beginPath(); g.moveTo(5 * s, 0); g.lineTo(-2 * s, -3.2 * s); g.lineTo(-2 * s, 3.2 * s); g.fill();
        g.strokeStyle = '#9fb7c9'; g.beginPath(); g.moveTo(-17 * s, 0); g.lineTo(-20 * s, -3 * s); g.moveTo(-17 * s, 0); g.lineTo(-20 * s, 3 * s); g.stroke();
      } else {
        if (style.proj === 'lob') { // thrown things keep the simple look
          for (let k = 5; k >= 1; k--) { const q = lerpPos(a, b, Math.max(0, p - k * .035), arc); g.globalAlpha = .45 - k * .07; g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], 5 * s, 0, 7); g.fill(); }
          g.globalAlpha = 1; g.fillStyle = col; g.beginPath(); g.arc(pos[0], pos[1], 4.5 * s, 0, 7); g.fill();
        } else {
          // trail of 8 fading puffs, then an element-shaped head
          for (let k = 8; k >= 1; k--) {
            const q = lerpPos(a, b, Math.max(0, p - k * .03), arc), f = 1 - k / 9; g.globalAlpha = f * .5;
            if (el === 'fire') { g.fillStyle = k % 2 ? '#ff7a2a' : '#ffc14d'; g.beginPath(); g.arc(q[0] + (rr(k, 1) - .5) * 4 * s, q[1] - k * .9 * s, (5.5 - k * .45) * s, 0, 7); g.fill(); }
            else if (el === 'frost') { g.fillStyle = '#d6f3ff'; shard(g, q[0], q[1], (5 - k * .4) * s, 1.6 * s, ang); }
            else if (el === 'shadow') { g.fillStyle = k % 2 ? '#5a2f8a' : '#a064d8'; g.beginPath(); g.arc(q[0] + Math.sin(k * 2 + p * 20) * 3 * s, q[1] + Math.cos(k * 2) * 3 * s, (5 - k * .4) * s, 0, 7); g.fill(); }
            else if (el === 'nature') { g.fillStyle = '#7cc480'; leaf(g, q[0] + Math.sin(k + p * 18) * 3 * s, q[1] + Math.cos(k + p * 18) * 3 * s, (2.6 - k * .15) * s, k + p * 9); }
            else if (el === 'poison') { g.fillStyle = '#8bd04a'; g.beginPath(); g.arc(q[0] + (rr(k, 2) - .5) * 5 * s, q[1] + k * .8 * s, (3.2 - k * .2) * s, 0, 7); g.fill(); }
            else if (el === 'holy' || el === 'arcane' || el === 'mind' || el === 'song') { g.fillStyle = col; star4(g, q[0] + (rr(k, 3) - .5) * 6 * s, q[1] + (rr(k, 4) - .5) * 6 * s, (4 - k * .3) * s); }
            else { g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], (5 - k * .5) * s, 0, 7); g.fill(); }
          }
          g.globalAlpha = 1; glow(g, pos[0], pos[1], 15 * s, col, .85);
          if (el === 'frost') { g.fillStyle = '#f2fcff'; shard(g, pos[0], pos[1], 9 * s, 3 * s, ang); }
          else if (el === 'fire') { flame(g, pos[0], pos[1] + 2 * s, 4.2 * s, '#ff6a1e', '#ffe08a'); }
          else if (el === 'holy' || el === 'arcane' || el === 'mind' || el === 'song') { g.fillStyle = '#fff'; star4(g, pos[0], pos[1], 7 * s); g.fillStyle = col; star4(g, pos[0], pos[1], 4.5 * s); }
          else if (el === 'nature') { g.fillStyle = '#c8f0a0'; leaf(g, pos[0], pos[1], 3.6 * s, ang); }
          else if (el === 'shadow') { g.fillStyle = '#1b0f2a'; g.beginPath(); g.arc(pos[0], pos[1], 4.6 * s, 0, 7); g.fill(); g.strokeStyle = '#c9a0ff'; g.lineWidth = 1.5 * s; g.stroke(); }
          else { g.fillStyle = '#fff'; g.beginPath(); g.arc(pos[0], pos[1], 4 * s, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(pos[0], pos[1], 3 * s, 0, 7); g.fill(); }
        }
      }
    });
    return ms * (sp() || 1);
  }

  // ---------- public hooks ----------
  FX.init = c => { ctx = c; };
  FX.setLevel = n => { FX.level = n; try { localStorage.setItem('fxlevel', n); } catch (e) { } if (!n) { list = []; } };
  FX.cycle = () => { FX.setLevel((FX.level + 1) % 3); return FX.label(); };
  FX.label = () => ['FX off', 'FX fast', 'FX'][FX.level];
  FX.busy = () => list.length > 0;
  FX.clear = () => { list = []; if (host) host.style.transform = ''; shake = null; };

  FX.cast = function (u, id, A, t, tile) {
    FX.lag = 0; if (!ctx || !sp() || !u) return 0;
    const st = styleOf(id, A), from = { x: u.x, y: u.y }; curEl = st.el;
    const aim = tile || (t ? { x: t.x, y: t.y } : A.self || A.k === 'self' ? from : null);
    if (!aim) return 0;
    let fl = 0;
    if (A.k === 'self') { ringPulse([u.x, u.y], st.col, true, 0); fl = 0; }
    else {
      const far = aim.x !== from.x || aim.y !== from.y;
      if (far && st.proj !== 'none') fl = flight(st, from.x, from.y, aim.x, aim.y, 0);
      else if (far && A.k !== 'dmg') fl = flight({ ...st, proj: 'orb' }, from.x, from.y, aim.x, aim.y, 0); // heals and buffs always travel
      if (A.k === 'dmg' || A.k === 'debuff') {
        if (A.area && ctx.footprint) {
          let tiles = []; try { tiles = ctx.footprint(u, A, aim) || []; } catch (e) { }
          if (A.area === 'chain') { // zigzag from the first target out to each other struck foe
            const hit = tiles.filter(([x, y]) => ctx.unitAt && ctx.unitAt(x, y) && (x !== aim.x || y !== aim.y)).slice(0, 4); let prev = aim;
            hit.forEach(([x, y], i) => { const a = prev; prev = { x, y }; flight({ ...st, proj: 'bolt' }, a.x, a.y, x, y, fl / (sp() || 1) + i * 90); impactAt('burst', st.col, x, y, fl / (sp() || 1) + 120 + i * 90); });
            impactAt(st.impact, st.col, aim.x, aim.y, fl / (sp() || 1));
          } else if (A.area === 'all') { // battlefield: one expanding wave from the caster, impacts only where someone stands
            addT(0, 700, (g, p) => { const [px, py, R] = pt(from.x, from.y, 0); ringW(g, px, py, R * (.5 + 9 * p), 4 * (1 - p) + 1, st.col, .8 * (1 - p)); ringW(g, px, py, R * (.3 + 7 * p), 2, '#fff', .5 * (1 - p)); });
            tiles.forEach(([x, y]) => { if (ctx.unitAt && ctx.unitAt(x, y)) impactAt(st.impact === 'slash' ? 'hit' : st.impact, st.col, x, y, ctx.dist({ x, y }, from) * 35); });
          } else tiles.forEach(([x, y]) => { const dd = ctx.dist({ x, y }, aim); addT(fl / (sp() || 1) + dd * 45, 340, (g, p) => tileFlash(x, y, st.col, p)); if (ctx.unitAt && ctx.unitAt(x, y)) impactAt(st.impact === 'slash' ? 'hit' : st.impact, st.col, x, y, fl / (sp() || 1) + dd * 45); });
        } else impactAt(st.impact, st.col, aim.x, aim.y, fl / (sp() || 1));
      } else if (A.k === 'heal') { const col = '#8ff0a8'; let tiles = [[aim.x, aim.y]]; if (A.area && ctx.footprint) { try { tiles = ctx.footprint(u, A, aim) || tiles; } catch (e) { } } tiles.forEach(([x, y]) => { if (!ctx.unitAt || ctx.unitAt(x, y)) healMotes(x, y, fl / (sp() || 1)); }); }
      else if (A.k === 'buff') { let tiles = [[aim.x, aim.y]]; if (A.area && ctx.footprint) { try { tiles = ctx.footprint(u, A, aim) || tiles; } catch (e) { } } tiles.forEach(([x, y]) => { if (!ctx.unitAt || ctx.unitAt(x, y)) ringPulse([x, y], st.col === ELEMENT.physical ? '#8fc8ff' : st.col, true, fl / (sp() || 1)); }); }
    }
    FX.lag = fl; setTimeout(() => { FX.lag = 0; }, 0); // the hit effects, numbers and deaths from this same resolve land when the projectile does
    return fl;
  };
  // ---------- floating numbers ----------
  const qNext = new WeakMap(); // per-unit stagger so simultaneous numbers don't overlap
  function lighten(hex, k) { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255, f = c => Math.round(c + (255 - c) * k); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
  const GLYPH = {
    poison: (g, x, y, s) => { g.fillStyle = '#8bd04a'; drop(g, x, y, s); },
    bleed: (g, x, y, s) => { g.fillStyle = '#e04646'; drop(g, x, y, s); },
    burn: (g, x, y, s) => flame(g, x, y + s * .2, s * .8, '#ff7a33', '#ffd24c'),
    regen: (g, x, y, s) => { g.fillStyle = '#8ff0a8'; g.fillRect(x - s * .25, y - s, s * .5, s * 2); g.fillRect(x - s, y - s * .25, s * 2, s * .5); },
    shield: (g, x, y, s) => { g.fillStyle = '#9fd0ff'; g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y - s); g.lineTo(x + s, y + s * .2); g.quadraticCurveTo(x + s, y + s * 1.1, x, y + s * 1.4); g.quadraticCurveTo(x - s, y + s * 1.1, x - s, y + s * .2); g.closePath(); g.fill(); }
  };
  // lines: [{t, col, k (size factor), glyph}]; first line is the main number
  function floatLines(u, lines, o) {
    o = o || {}; const x = u.x, y = u.y, t = now(), free = qNext.get(u) || 0, wait = Math.max(0, free - t);
    const delay = (FX.lag || 0) / (sp() || 1) + wait / (sp() || 1); qNext.set(u, Math.max(free, t) + T(o.gap || 260));
    const big = o.big || 1, jx = ((x * 7 + y * 13 + (lines[0].t.length * 5)) % 7 - 3) * 2, dur = o.dur || 1000;
    addT(delay, dur, (g, p) => {
      const [px, py, R] = pt(x, y, 0), ease = 1 - Math.pow(1 - Math.min(1, p * 1.15), 3), rise = R * (1.6 + (o.rise || 1.0) * ease);
      const pop = p < .14 ? (p / .14 < .6 ? .5 + (p / .14) / .6 * .85 : 1.35 - .35 * ((p / .14 - .6) / .4)) : 1; // overshoot pop-in
      g.globalAlpha = p < .72 ? 1 : 1 - (p - .72) / .28; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      let yy = py - rise;
      lines.forEach((L, i) => {
        const sz = Math.round(R * (L.k || .7) * big * pop); g.font = `800 ${sz}px system-ui`;
        const w = g.measureText(L.t).width, gl = L.glyph && GLYPH[L.glyph], gs = sz * .42, gw = gl ? gs * 2.2 : 0, cx = px + jx + gw / 2;
        g.lineWidth = Math.max(2, sz * .22); g.strokeStyle = 'rgba(0,0,0,.88)'; g.strokeText(L.t, cx, yy); g.fillStyle = L.col; g.fillText(L.t, cx, yy);
        if (gl) { g.save(); g.lineWidth = 1; gl(g, cx - w / 2 - gs * 1.3, yy, gs); g.restore(); }
        yy += sz * 1.0 + 2;
      });
      g.globalAlpha = 1;
    });
    return delay;
  }
  FX.elementOf = A => { try { return styleOf('', A || {}).el || 'physical'; } catch (e) { return 'physical'; } };
  FX.num = function (u, amount, o) {
    if (!ctx || !sp() || !u) return; o = o || {}; const n = Math.round(amount), ab = Math.round(o.absorbed || 0);
    if (o.blocked) { floatLines(u, [{ t: 'Blocked', col: '#cfd6dd', k: .5 }]); return; }
    const dmgCol = lighten(ELEMENT[o.el] || ELEMENT.physical, o.el && o.el !== 'physical' ? .3 : .0);
    if (o.shield) { if (!n) return; floatLines(u, [{ t: '+' + n + ' Shield', col: '#8fd0ff', k: .62, glyph: 'shield' }], { rise: .9 }); return; }
    if (o.heal || o.regen) { if (!n) return; floatLines(u, [{ t: '+' + n, col: o.regen ? '#b6f5c6' : '#8ff0a8', k: o.regen ? .55 : .72, glyph: o.regen ? 'regen' : null }], { rise: 1.1, big: o.regen ? 1 : 1 + Math.min(.35, n / 80) }); return; }
    if (!n && !ab) return;
    if (!n && ab) { floatLines(u, [{ t: ab + ' (shielded)', col: '#8fd0ff', k: .6 }]); return; } // fully absorbed
    const L = [];
    if (o.dot) L.push({ t: '' + n, col: lighten(ELEMENT[o.dot] || ELEMENT.physical, .25), k: .52, glyph: o.dot });
    else L.push({ t: n + (o.crit ? '!' : ''), col: o.crit ? '#ffd24c' : dmgCol, k: o.crit ? .98 : .74 });
    if (ab) L.push({ t: ab + ' (shielded)', col: '#8fd0ff', k: .42 });
    floatLines(u, L, { big: o.dot ? 1 : 1 + Math.min(.4, n / 60), rise: o.dot ? .8 : 1.1 });
    if (!o.dot && FX.level) {
      const d0 = (FX.lag || 0) / (sp() || 1);
      if (o.crit) { shake = { t0: now() + T(d0), dur: T(240), amp: 4 }; flash(d0, '#fff3c0', .35); kick(); }
      else if (n >= 14) { shake = { t0: now() + T(d0), dur: T(140), amp: 2 }; kick(); }
    }
  };
  function flash(delay, col, a) { addT(delay, 200, (g, p) => { if (!ov) return; g.globalAlpha = a * (1 - p); g.fillStyle = col; g.fillRect(0, 0, ov.width, ov.height); g.globalAlpha = 1; }); }
  FX.flash = flash;
  FX.text = function (u, text, col) {
    if (!ctx || !sp() || !u || !text) return;
    floatLines(u, [{ t: text, col: col || '#e9e4d3', k: .46 }], { rise: .7, dur: 1100, gap: 200 });
  };
  FX.shield = function (u, n) { // dome flash + "+N Shield"
    if (!ctx || !sp() || !u) return; const x = u.x, y = u.y, d = (FX.lag || 0) / (sp() || 1);
    addT(d, 650, (g, p) => { const [px, py, R] = pt(x, y, 0), a = Math.sin(Math.min(1, p) * 3.14) * .8; g.globalAlpha = a * .45; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(px, py - R * .55, R * .6, R * .85, 0, 0, 7); g.fill(); g.globalAlpha = a; g.strokeStyle = '#d6efff'; g.lineWidth = 2.5; g.stroke(); g.globalAlpha = 1; });
    if (n > 0) FX.num(u, n, { shield: 1 });
  };
  // per-status motif drawn over the unit; falls back to the generic rising/sinking ring
  const MOTIF = {
    slow: ['#7fb8ff', 'chev', -1], haste: ['#ffe27a', 'chev', 1], stun: ['#ffe14d', 'stars'], mez: ['#ff8fd0', 'stars'], confused: ['#ffb86b', 'stars'],
    root: ['#6fae5a', 'vines'], pin: ['#6fae5a', 'vines'], burn: ['#ff7a33', 'flames'], poison: ['#8bd04a', 'drips'], bleed: ['#d94141', 'drips'],
    marked: ['#ff6b6b', 'reticle'], thorns: ['#7cc480', 'spikes'], steeled: ['#cfd6dd', 'spikes'], silence: ['#c58bff', 'x'], blind: ['#9a9a9a', 'x'], dontAct: ['#c58bff', 'x'],
    wither: ['#8a6ab0', 'drips'], empowered: ['#ffb347', 'chev', 1], regen: ['#8ff0a8', 'plus'], taunt: ['#ff9b5a', 'ring'], deathSave: ['#fff0a0', 'ring'], intercept: ['#8fc8ff', 'ring'], unmovable: ['#cfd6dd', 'ring'], farsight: ['#ffe27a', 'ring'], zoc: ['#ff9b5a', 'ring'], siege: ['#cfd6dd', 'ring'], charm: ['#ff8fd0', 'hearts']
  };
  FX.status = function (u, kind, name) {
    if (!ctx || !sp() || !u) return; const m = MOTIF[name], d = (FX.lag || 0) / (sp() || 1) + 60;
    if (!m) { ringPulse([u.x, u.y], kind === 'debuff' ? '#c58bff' : '#ffd24c', kind !== 'debuff', d); return; }
    const [col, sh, dir] = m, x = u.x, y = u.y;
    if (sh === 'ring') { ringPulse([x, y], col, kind !== 'debuff', d); return; }
    addT(d, 700, (g, p) => {
      const [px, py, R] = pt(x, y, 0), a = Math.sin(Math.min(1, p) * 3.14); g.fillStyle = col; g.strokeStyle = col; g.globalAlpha = a;
      if (sh === 'chev') for (let i = 0; i < 3; i++) { const ph = (p + i / 3) % 1, yy = py - R * (dir > 0 ? .1 + 1.2 * ph : 1.3 - 1.2 * ph), w = R * .35; g.globalAlpha = a * Math.sin(ph * 3.14); g.lineWidth = 3; g.beginPath(); g.moveTo(px - w, yy + (dir > 0 ? w * .5 : -w * .5)); g.lineTo(px, yy); g.lineTo(px + w, yy + (dir > 0 ? w * .5 : -w * .5)); g.stroke(); }
      else if (sh === 'stars') for (let i = 0; i < 3; i++) { const an = p * 6 + i * 2.094; star4(g, px + Math.cos(an) * R * .55, py - R * 1.35 + Math.sin(an) * R * .2, R * .2); }
      else if (sh === 'vines') { g.lineWidth = 3; for (let i = 0; i < 3; i++) { const bx = px + (i - 1) * R * .4; g.beginPath(); g.moveTo(bx, py); g.quadraticCurveTo(bx + R * .25 * Math.sin(i * 2), py - R * .5 * Math.min(1, p * 2), bx - R * .1, py - R * .9 * Math.min(1, p * 2)); g.stroke(); leaf(g, bx - R * .1, py - R * .9 * Math.min(1, p * 2), R * .12, i); } }
      else if (sh === 'flames') for (let i = 0; i < 4; i++) { const ph = (p * 1.3 + i / 4) % 1; g.globalAlpha = a * (1 - ph); flame(g, px + (i - 1.5) * R * .3, py - R * (.2 + .9 * ph), R * .13, '#ff7a33', '#ffd24c'); }
      else if (sh === 'drips') for (let i = 0; i < 4; i++) { const ph = (p * 1.2 + i / 4) % 1; g.globalAlpha = a * (1 - ph * .6); drop(g, px + (i - 1.5) * R * .28, py - R * (1.2 - .9 * ph), R * .1); }
      else if (sh === 'reticle') { const r = R * (.9 - .25 * p); g.lineWidth = 2.5; g.beginPath(); g.ellipse(px, py - R * .55, r * .8, r, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(px - r, py - R * .55); g.lineTo(px + r, py - R * .55); g.moveTo(px, py - R * .55 - r); g.lineTo(px, py - R * .55 + r); g.stroke(); }
      else if (sh === 'spikes') for (let i = 0; i < 8; i++) { const an = i * .785; shard(g, px + Math.cos(an) * R * .5 * (1 + p * .4), py - R * .5 + Math.sin(an) * R * .55, R * .16, R * .06, an); }
      else if (sh === 'x') { g.lineWidth = 4; const cx = px, cy = py - R * 1.3, s = R * .22 * (.6 + .4 * Math.min(1, p * 3)); g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s); g.stroke(); }
      else if (sh === 'plus') for (let i = 0; i < 3; i++) { const ph = (p + i / 3) % 1; g.globalAlpha = a * Math.sin(ph * 3.14); const cx = px + (i - 1) * R * .4, cy = py - R * (.2 + 1.1 * ph); g.fillRect(cx - R * .04, cy - R * .12, R * .08, R * .24); g.fillRect(cx - R * .12, cy - R * .04, R * .24, R * .08); }
      else if (sh === 'hearts') for (let i = 0; i < 3; i++) { const ph = (p + i / 3) % 1; g.globalAlpha = a * Math.sin(ph * 3.14); const cx = px + (i - 1) * R * .4, cy = py - R * (.4 + 1.0 * ph), s = R * .12; g.beginPath(); g.arc(cx - s * .5, cy, s * .6, 0, 7); g.arc(cx + s * .5, cy, s * .6, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - s * 1.05, cy + s * .2); g.lineTo(cx, cy + s * 1.2); g.lineTo(cx + s * 1.05, cy + s * .2); g.fill(); }
      g.globalAlpha = 1;
    });
  };
  FX.blink = function (x0, y0, x1, y1) { // teleport: vanish puff at the origin, arrival ring + streak at the destination
    if (!ctx || !sp()) return; const d = (FX.lag || 0) / (sp() || 1);
    addT(d, 420, (g, p) => { const [px, py, R] = pt(x0, y0, 0); glow(g, px, py - R * .5, R * (1 - .5 * p), '#c28bff', .7 * (1 - p)); sparks(g, px, py - R * .4, R, '#e0c8ff', p, 10, 1); });
    addT(d + 120, 480, (g, p) => { const [px, py, R] = pt(x1, y1, 0); ringW(g, px, py, R * (.3 + .9 * p), 3, '#e0c8ff', 1 - p); glow(g, px, py - R * .5, R * (.5 + .5 * p), '#c28bff', .6 * (1 - p)); });
    addT(d, 360, (g, p) => { const a = pt(x0, y0, 0), b = pt(x1, y1, 0); g.strokeStyle = '#e0c8ff'; g.globalAlpha = (1 - p) * .6; g.lineWidth = 3; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(a[0], a[1] - a[2] * .5); g.lineTo(b[0], b[1] - b[2] * .5); g.stroke(); g.globalAlpha = 1; });
  };
  FX.shove = function (x0, y0, x1, y1) { // forced move: dust streak along the path and a puff where it lands
    if (!ctx || !sp()) return; const d = (FX.lag || 0) / (sp() || 1);
    addT(d, 360, (g, p) => { const a = pt(x0, y0, 0), b = pt(x1, y1, 0); g.strokeStyle = '#e9e4d3'; g.globalAlpha = (1 - p) * .7; g.lineWidth = 4 * (1 - p) + 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + (b[0] - a[0]) * Math.min(1, p * 1.6), a[1] + (b[1] - a[1]) * Math.min(1, p * 1.6)); g.stroke(); g.globalAlpha = 1; sparks(g, b[0], b[1], b[2] * .8, '#cfc6ad', p, 7, 3); });
  };
  FX.spring = function (x, y, col) { // trap going off
    if (!ctx || !sp()) return; const d = (FX.lag || 0) / (sp() || 1); col = col || '#ffb347';
    addT(d, 480, (g, p) => { const [px, py, R] = pt(x, y, 0); ringW(g, px, py, R * (.4 + 1.1 * p), 3, col, 1 - p); g.fillStyle = col; g.globalAlpha = 1 - p; for (let i = 0; i < 8; i++) { const an = i * .785; shard(g, px + Math.cos(an) * R * .7 * p, py + Math.sin(an) * R * .35 * p - R * .2 * p, R * .22 * (1 - p * .5), R * .06, an); } g.globalAlpha = 1; });
    if (FX.level) { shake = { t0: now() + T(d), dur: T(130), amp: 2 }; kick(); }
  };
  FX.summon = function (x, y) {
    if (!ctx || !sp()) return;
    addT(0, 600, (g, p) => { const [px, py, R] = pt(x, y, 0); g.strokeStyle = '#c28bff'; g.lineWidth = 2.5; g.globalAlpha = 1 - p; for (const k of [0, 1]) { g.beginPath(); g.ellipse(px, py, R * (.4 + .6 * p + k * .25), R * (.4 + .6 * p + k * .25) * .5, 0, 0, 7); g.stroke(); } g.globalAlpha = 1; glow(g, px, py - R * .4, R, '#c28bff', .5 * (1 - p)); });
  };
  FX.death = function (u) {
    if (!ctx || !sp() || !u) return; const x = u.x, y = u.y, team = u.team === 'P' || u.baseTeam === 'P', gl = u.g || '', hold0 = (FX.lag || 0) / (sp() || 1) + 40;
    const hold = hold0, tot = hold + 520;
    addT(0, tot, (g, p) => {
      const ms = p * tot; if (ms < hold) { p = 0; } else p = (ms - hold) / 520;
      const [px, py, R] = pt(x, y, 0), r = R * .5, by = py - r * 1.1 - R * .6 * p;
      g.globalAlpha = (1 - p) * .9; g.fillStyle = team ? '#1f5f7c' : '#7a2f25'; g.strokeStyle = team ? '#4ea5cc' : '#cc6150'; g.lineWidth = 2; g.beginPath(); g.arc(px, by, r * (1 - .3 * p), 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = `700 ${Math.round(R * .4)}px Palatino,Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(gl, px, by);
      g.globalAlpha = 1; sparks(g, px, by, R, '#e9e4d3', p, 8, 2);
    });
    shake = { t0: now() + T(hold), dur: T(160), amp: 2.5 }; kick();
  };
  window.FX = FX;
})();
