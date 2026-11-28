/* Unit sprites: animated pixel-art sheets drawn on the board in place of the two-letter glyph tokens.
   Art: sprites/ally/<classId>.png (royal blue) and sprites/enemy/<classId>.png (crimson), 32x32 frames.
   Races: one atlas per team and race, sprites/<team>/<raceId>.png (dwarf, wood_elf, high_elf, dark_elf, orc, goblin).
   Each atlas holds every class sheet (128x640) in a 6-wide grid, in ATLAS_ORDER; a class missing from it falls back to the human sheet.
   Sheet layout (same for every class): 4 columns x 20 rows. Row = animation x direction
     idle 0-3, walk 4-7, attack 8-11, hit 12-15, death 16-19; within each block: down, left, right, up.
   Visual only: it never changes a rule. index.html calls SPR.frame() once per board draw and SPR.draw() per unit;
   attack / hit / death animations are triggered by wrapping the FX hooks (FX.cast, FX.num, FX.death). */
(function () {
  const F = 32, DIRS = { down: 0, left: 1, right: 2, up: 3 };
  const ANIM = { idle: { row: 0, n: 4, ms: 260 }, walk: { row: 4, n: 4, ms: 110 }, attack: { row: 8, n: 4, ms: 105 },
                 hit: { row: 12, n: 2, ms: 140 }, death: { row: 16, n: 4, ms: 190 } };
  const DEATH_HOLD = 700, TWEEN = 170;
  const now = () => performance.now();
  const cache = {}, st = new WeakMap();
  let proj = null, redraw = null, raf = 0, tmr = 0, lastIdle = 0, getUnits = () => [];

  function load(key) {
    let i = cache[key];
    if (!i) {
      // Some hosts (the Claude artifact viewer) only allow pictures from in-page data: if the file will not load directly,
      // fetch it and hand it over as a blob URL; only if that also fails is the sheet missing (and the token is drawn).
      const url = 'sprites/' + key + '.png'; i = new Image(); i.onload = () => { i.ok = true; kick(); };
      i.onerror = () => { if (i.viaBlob || typeof fetch !== 'function') { i.bad = true; kick(); return; } i.viaBlob = true;
        fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b => { i.src = URL.createObjectURL(b); }).catch(() => { i.bad = true; kick(); }); };
      i.src = url; cache[key] = i;
    }
    return i;
  }
  const ATLAS_ORDER = ['squire', 'scout', 'acolyte', 'apprentice', 'warrior', 'sentinel', 'bulwark', 'rogue', 'monk', 'berserker', 'archer', 'marksman',
    'tracker', 'cleric', 'druid', 'shaman', 'wizard', 'necro', 'enchanter', 'bard', 'shadowknight', 'shadowmage', 'warlord', 'assassin',
    'songweaver', 'spellbow', 'paladin', 'blood_knight', 'warden', 'siegebreaker', 'zen_archer', 'ranger', 'beastlord', 'ascetic', 'inquisitor', 'stormcaller'];
  const ATLAS_COLS = 6;
  // monster sheets share one atlas per team: sprites/<team>/monsters.png (same 6-wide grid, in this order)
  const MONSTER_ORDER = ['dire_wolf', 'cave_bear', 'giant_spider', 'ghoul', 'banshee', 'bone_archer', 'fire_elemental', 'stone_golem', 'storm_elemental',
    'drake_whelp', 'basilisk', 'maw_horror', 'elder_drake', 'barrow_king'];
  // returns { im, ox, oy }: the image and where this class's 128x640 sheet starts inside it
  function img(u) {
    if (!u || !u.job) return null;
    const team = u.team === 'P' ? 'ally' : 'enemy', race = (u.build && u.build.race) || u.race || 'human';
    const mi = MONSTER_ORDER.indexOf(u.job);
    if (mi >= 0) {
      const m = load(team + '/monsters');
      if (m.ok) return { im: m, ox: (mi % ATLAS_COLS) * 128, oy: Math.floor(mi / ATLAS_COLS) * 640 };
      return null;
    }
    const idx = ATLAS_ORDER.indexOf(u.job);
    if (race !== 'human' && idx >= 0) {
      const a = load(team + '/' + race);
      if (a.ok) return { im: a, ox: (idx % ATLAS_COLS) * 128, oy: Math.floor(idx / ATLAS_COLS) * 640 };
      if (!a.bad) return null;
    }
    const i = load(team + '/' + u.job);
    return i.ok ? { im: i, ox: 0, oy: 0 } : null;
  }
  function S(u) { let s = st.get(u); if (!s) { s = { phase: Math.random() * 1000 }; st.set(u, s); } return s; }
  function dirOf(dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;
    return Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  function screenOf(x, y) { return proj ? proj(x, y) : null; }

  const SPR = {
    units: () => getUnits() || [],
    setUnits(fn) { getUnits = fn; },
    ready(u) { return !!img(u); },
    dying(u) { const s = st.get(u); return !!(s && s.deathAt && now() < s.deathAt + ANIM.death.n * ANIM.death.ms + DEATH_HOLD); },
    setRedraw(fn) { redraw = fn; },
    frame(projector) { proj = projector; },
    attack(u, t, tile) {
      const s = S(u), aim = t && t !== u ? { x: t.x, y: t.y } : tile || null;
      s.act = { name: 'attack', t0: now(), dur: ANIM.attack.n * ANIM.attack.ms, aim }; kick();
    },
    hit(u, delay) { const s = S(u); s.act = { name: 'hit', t0: now() + (delay || 0), dur: ANIM.hit.n * ANIM.hit.ms + 60 }; kick(); },
    death(u, delay) { const s = S(u); s.deathAt = now() + (delay || 0); s.act = null; kick(); },
    /* draws the unit standing on (cx, cy); returns the y of the sprite's top edge (for the HP bar) */
    draw(g, u, cx, cy, R, top) {
      const sh = img(u); if (!sh) return null; const im = sh.im;
      const s = S(u), t = now();
      // movement: notice tile changes, tween from the old screen spot and play the walk cycle
      if (s.tile && (s.tile[0] !== u.x || s.tile[1] !== u.y) && s.pos) {
        s.from = s.pos.slice(); s.moveT0 = t; s.walkUntil = t + 420;
        const d = dirOf(cx - s.pos[0], cy - s.pos[1]); if (d) s.face = d;
      }
      s.tile = [u.x, u.y]; s.pos = [cx, cy];
      let px = cx, py = cy;
      if (s.from && t - s.moveT0 < TWEEN) { const k = (t - s.moveT0) / TWEEN; px = s.from[0] + (cx - s.from[0]) * k; py = s.from[1] + (cy - s.from[1]) * k; }
      // facing: attack target > recent move > nearest enemy
      let face = null;
      const act = s.act && t >= s.act.t0 && t < s.act.t0 + s.act.dur ? s.act : null;
      if (act && act.aim) { const p = screenOf(act.aim.x, act.aim.y); if (p) face = dirOf(p[0] - cx, p[1] - cy); }
      if (!face && s.walkUntil && t < s.walkUntil) face = s.face;
      if (!face && u.inScene) { const p = u.faceAt && screenOf(u.faceAt.x, u.faceAt.y); face = (p && dirOf(p[0] - cx, p[1] - cy)) || u.sceneFace || s.face || 'down'; }   // scenes: scripted facing, else the way it last walked
      if (!face) {
        let best = null, bd = 1e9;
        for (const v of SPR.units()) {
          if (v === u || v.hp <= 0 || v.team === u.team) continue;
          const p = screenOf(v.x, v.y); if (!p) continue;
          const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (dd < bd) { bd = dd; best = p; }
        }
        face = best ? dirOf(best[0] - cx, best[1] - cy) : null;
      }
      face = face || s.face || (u.team === 'P' ? 'up' : 'down'); s.face = face;
      // choose animation + frame
      let A = ANIM.idle, f = Math.floor((t + s.phase) / A.ms) % A.n;
      if (s.deathAt && t >= s.deathAt) { A = ANIM.death; f = Math.min(A.n - 1, Math.floor((t - s.deathAt) / A.ms)); }
      else if (act) { A = ANIM[act.name]; f = Math.min(A.n - 1, Math.floor((t - act.t0) / A.ms)); }
      else if (s.walkUntil && t < s.walkUntil) { A = ANIM.walk; f = Math.floor((t - s.moveT0) / A.ms) % A.n; }
      const size = R * (top ? 1.25 : 1.7), dx = Math.round(px - size / 2), dy = Math.round(top ? py - size * 0.55 : py - size * 0.94 + R * 0.12);
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      g.drawImage(im, sh.ox + f * F, sh.oy + (A.row + DIRS[face]) * F, F, F, dx, dy, Math.round(size), Math.round(size));
      g.imageSmoothingEnabled = sm;
      return dy + size * 0.12;
    },
    busy() {
      const t = now();
      for (const u of SPR.units()) {
        const s = st.get(u); if (!s) continue;
        if ((s.act && t < s.act.t0 + s.act.dur + 40) || (s.walkUntil && t < s.walkUntil + 40) || SPR.dying(u)) return true;
      }
      return false;
    },
    hook(FX) {
      if (!FX || FX._sprHooked) return; FX._sprHooked = true;
      const SPEED = [0, 0.6, 1], lag = () => { const sp = SPEED[FX.level] || 0; return sp ? (FX.lag || 0) / sp : 0; };
      const oc = FX.cast, on = FX.num, od = FX.death;
      FX.cast = function (u, id, A, t, tile) { const r = oc.apply(this, arguments); try { if (u && A && A.k !== 'self') SPR.attack(u, t, tile); } catch (e) { } return r; };
      FX.num = function (u, amount, o) { try { o = o || {}; if (u && !o.heal && !o.shield && amount > 0) SPR.hit(u, lag()); } catch (e) { } return on.apply(this, arguments); };
      FX.death = function (u) { try { if (u && img(u)) { SPR.death(u, lag() + 120); return; } } catch (e) { } return od.apply(this, arguments); };
    }
  };

  function loop() {
    raf = 0;
    if (!redraw || document.hidden) return;
    const t = now(), busy = SPR.busy();
    if (busy || t - lastIdle > ANIM.idle.ms - 30) { lastIdle = t; try { redraw(); } catch (e) { } }
    if (busy) raf = requestAnimationFrame(loop);
    else tmr = setTimeout(() => { tmr = 0; kick(); }, ANIM.idle.ms);
  }
  function kick() { if (tmr) { clearTimeout(tmr); tmr = 0; } if (!raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  SPR.kick = kick;
  window.SPR = SPR;
})();
