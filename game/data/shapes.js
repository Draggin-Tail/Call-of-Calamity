/* Area-of-effect geometry shared by the game (index.html) and the simulator (sim.html).
   Hex layout: "odd-r" offset coordinates (odd rows shifted right), the same as the board.

   An ability opts in with   area: '<shape>'   plus optional   radius / len / self   keys:
     splash  every tile within `radius` (default 1) of the aimed tile, centre included   (bursts, bombs, blasts)
     ring    every tile within `radius` of the centre EXCLUDING the centre                (shockwaves, novas; use self:1 to centre on the caster)
     line    `len` tiles (default = range) in a straight line from the caster toward the aimed tile, piercing everything on it
     cone    a 60-degree wedge `len` tiles deep (default = range) opening away from the caster toward the aimed tile
     star    the aimed tile plus `len` tiles (default 2) along all six hex axes
     wall    the aimed tile plus the two tiles flanking it, side to side across the line of fire
     arc     the aimed tile plus tiles adjacent to BOTH caster and aimed tile (melee sweeps)
     all     every tile on the board (use with self:1): hits every unit of the side the skill targets, anywhere on the map
     chain   unit-based: the target plus the nearest other enemies (handled by the engines, not by this file)
   self: 1 centres the shape on the caster (no aiming; the player taps themselves to confirm).
   Directional shapes (line, cone, wall) snap the direction to the nearest of the six hex axes. */
(function () {
  const SQ3 = Math.sqrt(3);
  // Axial directions ordered by screen angle: E, SE, SW, W, NW, NE (60 degrees apart).
  const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const toCube = (x, y) => ({ q: x - (y - (y & 1)) / 2, r: y });
  const fromCube = (q, r) => ({ x: q + (r - (r & 1)) / 2, y: r });
  const cdist = (a, b) => { const dq = a.q - b.q, dr = a.r - b.r; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
  const pix = c => ({ x: SQ3 * (c.q + c.r / 2), y: 1.5 * c.r });
  const norm = a => ((a % 360) + 360) % 360;

  // Index (0..5) of the hex axis closest to the line from `from` to `to` (0 when they coincide).
  function dirIndex(from, to) {
    const a = pix(toCube(from.x, from.y)), b = pix(toCube(to.x, to.y));
    const vx = b.x - a.x, vy = b.y - a.y;
    if (Math.abs(vx) < 1e-9 && Math.abs(vy) < 1e-9) return 0;
    return Math.round(norm(Math.atan2(vy, vx) * 180 / Math.PI) / 60) % 6;
  }

  // Tiles [x, y] covered by ability A cast from `caster` at tile `aim`. `inb(x, y)` says whether a tile is on the board.
  function footprint(A, caster, aim, inb) {
    const out = [], seen = new Set();
    const add = (x, y) => { const k = x + ',' + y; if (!seen.has(k) && inb(x, y)) { seen.add(k); out.push([x, y]); } };
    const shape = A.area, centre = A.self ? caster : (aim || caster);
    const cc = toCube(centre.x, centre.y), cu = toCube(caster.x, caster.y);
    const step = (c, d, n) => ({ q: c.q + DIRS[d][0] * n, r: c.r + DIRS[d][1] * n });
    const addC = c => { const o = fromCube(c.q, c.r); add(o.x, o.y); };
    if (shape === 'splash' || shape === 'ring') {
      const R = A.radius || 1;
      for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
        const c = { q: cc.q + dq, r: cc.r + dr };
        const d = cdist(c, cc);
        if (d > R || (shape === 'ring' && d === 0)) continue;
        addC(c);
      }
    } else if (shape === 'line') {
      const d = dirIndex(caster, centre), L = A.len || A.r || 1;
      for (let n = 1; n <= L; n++) addC(step(cu, d, n));
    } else if (shape === 'cone') {
      const d = dirIndex(caster, centre), L = A.len || A.r || 2, ang = d * 60, pc = pix(cu);
      for (let dq = -L; dq <= L; dq++) for (let dr = -L; dr <= L; dr++) {
        const c = { q: cu.q + dq, r: cu.r + dr }, n = cdist(c, cu);
        if (n < 1 || n > L) continue;
        const p = pix(c), a = norm(Math.atan2(p.y - pc.y, p.x - pc.x) * 180 / Math.PI);
        const diff = Math.abs(((a - ang + 540) % 360) - 180);
        if (diff <= 35) addC(c);
      }
    } else if (shape === 'star') {
      addC(cc);
      const L = A.len || 2;
      for (let d = 0; d < 6; d++) for (let n = 1; n <= L; n++) addC(step(cc, d, n));
    } else if (shape === 'wall') {
      const d = dirIndex(caster, centre);
      addC(cc); addC(step(cc, (d + 1) % 6, 1)); addC(step(cc, (d + 5) % 6, 1));
    } else if (shape === 'all') {
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) add(x, y);
    } else if (shape === 'arc') {
      add(centre.x, centre.y);
      for (const [x, y] of neighbours(centre.x, centre.y)) if (cdist(toCube(x, y), cu) === 1) add(x, y);
    }
    return out;
  }
  function neighbours(x, y) { const c = toCube(x, y); return DIRS.map(d => fromCube(c.q + d[0], c.r + d[1])).map(o => [o.x, o.y]); }

  // Shapes that are aimed at a tile on the ground (everything except unit-based chain and summons).
  const isGround = A => !!A.area && A.area !== 'chain' && A.k !== 'summon';
  const NAMES = { splash: 'Burst', ring: 'Ring', line: 'Line', cone: 'Cone', star: 'Star', wall: 'Wall', arc: 'Sweep', all: 'Battlefield', chain: 'Chain' };

  window.GAME_SHAPES = { DIRS, toCube, fromCube, dirIndex, footprint, isGround, NAMES };
})();
