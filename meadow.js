// CloudKitty meadow — live WS client with a faithful local fallback simulation,
// plus canvas rendering in three cat-art vocabularies.
// Business logic only. No styling decisions live here beyond the palette table.

export const COLS = 18, ROWS = 11, DAY = 600, TICK_MS = 1000;

const PHASE_SPANS = [
  ['day', 0, 268],
  ['golden hour', 268, 360],
  ['night', 360, 512],
  ['dawn', 512, 600],
];

export function phaseFor(tick) {
  const t = ((tick % DAY) + DAY) % DAY;
  for (const [n, a, b] of PHASE_SPANS) if (t >= a && t < b) return n;
  return 'day';
}

const P = {
  day: {
    sky: [200, 220, 186], grassA: [172, 199, 132], grassB: [148, 179, 110],
    dirt: [206, 190, 158], paper: [246, 241, 230], ink: [44, 40, 34],
    inkSoft: [126, 117, 102], rule: [214, 205, 188],
    beam: [255, 250, 214], beamA: 0.3, bush: [104, 138, 88], bushHi: [136, 168, 112],
    water: [154, 194, 208], accent: [193, 118, 72], glow: [255, 255, 255], glowA: 0,
    shX: 0.06, shLen: 1,
    veil: [255, 250, 235], veilA: 0,
  },
  'golden hour': {
    sky: [240, 190, 120], grassA: [194, 180, 96], grassB: [144, 142, 74],
    dirt: [206, 162, 102], paper: [243, 225, 198], ink: [56, 42, 30],
    inkSoft: [140, 116, 90], rule: [216, 196, 168],
    beam: [255, 214, 128], beamA: 0.78, bush: [76, 92, 50], bushHi: [130, 138, 74],
    water: [186, 178, 158], accent: [200, 92, 44], glow: [255, 190, 110], glowA: 0.12,
    veil: [255, 186, 108], veilA: 0.1,
    shX: 0.85, shLen: 1.85,
  },
  night: {
    sky: [42, 48, 68], grassA: [62, 74, 92], grassB: [54, 65, 82],
    dirt: [70, 71, 84], paper: [28, 31, 41], ink: [232, 227, 214],
    inkSoft: [140, 145, 163], rule: [58, 63, 80],
    beam: [140, 168, 220], beamA: 0.14, bush: [48, 62, 74], bushHi: [62, 78, 92],
    water: [78, 104, 132], accent: [214, 152, 104], glow: [120, 150, 220], glowA: 0.1,
    shX: 0, shLen: 1.25,
    veil: [30, 42, 78], veilA: 0.2,
  },
  dawn: {
    sky: [196, 196, 216], grassA: [136, 164, 150], grassB: [120, 148, 136],
    dirt: [178, 172, 172], paper: [235, 232, 236], ink: [48, 44, 52],
    inkSoft: [128, 122, 130], rule: [206, 200, 202],
    beam: [228, 214, 236], beamA: 0.26, bush: [88, 116, 112], bushHi: [112, 140, 134],
    water: [150, 168, 186], accent: [186, 122, 96], glow: [200, 190, 220], glowA: 0.08,
    shX: -0.8, shLen: 1.8,
    veil: [178, 178, 210], veilA: 0.16,
  },
};

const CROSSFADE = 46;
const lerp = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgb = (c, a) => a === undefined
  ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
  : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export function paletteAt(tick) {
  const t = ((tick % DAY) + DAY) % DAY;
  let i = PHASE_SPANS.findIndex(([, a, b]) => t >= a && t < b);
  if (i < 0) i = 0;
  const [name, , end] = PHASE_SPANS[i];
  const next = PHASE_SPANS[(i + 1) % PHASE_SPANS.length][0];
  const into = end - t;
  const k = into < CROSSFADE ? 1 - into / CROSSFADE : 0;
  const A = P[name], B = P[next];
  if (k === 0) return { ...A, name };
  // paper and ink invert between phases; a linear blend passes through mud, so
  // they snap across a short window while everything else fades slowly.
  const kk = Math.max(0, Math.min(1, (k - 0.62) / 0.22));
  const fast = kk * kk * (3 - 2 * kk);
  const FLIP = { paper: 1, ink: 1, inkSoft: 1, rule: 1 };
  const out = { name: k > 0.5 ? next : name };
  for (const key of Object.keys(A)) {
    const m = FLIP[key] ? fast : k;
    out[key] = Array.isArray(A[key]) ? mixc(A[key], B[key], m) : lerp(A[key], B[key], m);
  }
  return out;
}

/* ── deterministic noise ─────────────────────────────────────────── */
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── the roster ──────────────────────────────────────────────────── */
const ROSTER = [
  { id: 1, name: 'Miso', coat: [226, 178, 118], belly: [246, 232, 208], mind: 'policy:trained', tabby: true },
  { id: 2, name: 'Biscuit', coat: [240, 228, 206], belly: [252, 246, 234], mind: 'professor_whiskers', tabby: false },
  { id: 3, name: 'Pumpkin', coat: [214, 128, 66], belly: [246, 220, 190], mind: 'policy:trained', tabby: true },
  { id: 4, name: 'Kittybear', coat: [92, 84, 80], belly: [148, 140, 134], mind: 'needs_driven', tabby: false },
];

const SOLO = [
  ['naps in a sunbeam', 34], ['naps in a sunbeam', 40], ['sits in the sun', 20],
  ['chases a bug', 7], ['pounces on nothing', 4], ['drinks', 5], ['eats', 6],
  ['stretches', 3], ['wanders', 6], ['watches the grass', 12], ['meows', 2],
  ['rolls over', 4], ['kneads the moss', 8],
];

/* ── the world ───────────────────────────────────────────────────── */
export function createPose() {
  const cat = (i, x, y, face, act) => ({
    ...ROSTER[i], x, y, px: x, py: y, tx: x, ty: y, face, act,
    resting: /nap|sleep|sit|groom|watch/.test(act), left: 999, bob: i * 1.6,
  });
  return {
    tick: 0, cols: 12, rows: 8, source: 'pose', stamp: 0,
    kitties: [
      cat(0, 3.0, 4.25, 1, 'naps in a sunbeam'),
      cat(3, 4.15, 4.55, -1, 'naps in a sunbeam'),
      cat(1, 7.5, 3.15, -1, 'watches the grass'),
      cat(2, 9.3, 5.05, 1, 'chases a bug'),
    ],
    beams: [
      { x: 1.9, y: 3.2, w: 3.4, h: 2.7, skew: 0.6 },
      { x: 8.3, y: 1.5, w: 2.6, h: 2.3, skew: 1.2 },
    ],
    bowls: [{ x: 10.7, y: 6.5, kind: 'water' }, { x: 9.5, y: 6.85, kind: 'food' }],
    bugs: [{ x: 8.7, y: 4.3, k: 0.2 }, { x: 5.4, y: 2.1, k: 0.7 }],
  };
}

export function createWorld(seed = 7, startTick = 618033) {
  const rnd = mulberry(seed);
  const beams = [];
  for (let i = 0; i < 3; i++) {
    beams.push({ x: 1.2 + rnd() * (COLS - 6), y: 0.8 + rnd() * (ROWS - 5), w: 3 + rnd() * 2, h: 2.4 + rnd() * 1.8, skew: 1 + rnd() * 0.7 });
  }
  const bushes = [];
  for (let i = 0; i < 12; i++) bushes.push({ x: rnd() * COLS, y: rnd() * ROWS, r: 0.42 + rnd() * 0.75, s: rnd() });
  const flowers = [];
  for (let i = 0; i < 30; i++) flowers.push({ x: rnd() * COLS, y: rnd() * ROWS, k: rnd() });
  const patches = [];
  for (let i = 0; i < 9; i++) patches.push({ x: rnd() * COLS, y: rnd() * ROWS, r: 0.7 + rnd() * 1.5, k: rnd(), lobes: 4 + (rnd() * 3 | 0) });
  const bowls = [
    { x: COLS - 3.4, y: ROWS - 2.2, kind: 'water' },
    { x: COLS - 5.1, y: ROWS - 1.8, kind: 'food' },
  ];
  const bugs = [];
  for (let i = 0; i < 4; i++) bugs.push({ x: rnd() * COLS, y: rnd() * ROWS, vx: 0, vy: 0, k: rnd() });

  const kitties = ROSTER.map((k, i) => {
    const b = beams[i % beams.length];
    const x = b.x + 1 + rnd() * 2, y = b.y + 1 + rnd();
    return { ...k, x, y, px: x, py: y, tx: x, ty: y, face: rnd() > 0.5 ? 1 : -1, act: 'wanders', left: 4 + (rnd() * 10 | 0), bob: rnd() * 6.28 };
  });

  const w = { tick: startTick, cols: COLS, rows: ROWS, kitties, beams, bushes, flowers, bowls, bugs, patches, rnd, source: 'local', stamp: 0 };
  for (let i = 0; i < 40; i++) step(w);
  w.tick = startTick;
  return w;
}

function nearestBeam(w, k) {
  let best = w.beams[0], d = 1e9;
  for (const b of w.beams) {
    const dd = (b.x + b.w / 2 - k.x) ** 2 + (b.y + b.h / 2 - k.y) ** 2;
    if (dd < d) { d = dd; best = b; }
  }
  return best;
}

function choose(w, k) {
  const night = phaseFor(w.tick) === 'night';
  const r = w.rnd();
  const others = w.kitties.filter(o => o.id !== k.id);
  if (r < (night ? 0.5 : 0.18)) {
    const b = nearestBeam(w, k);
    k.act = night ? 'sleeps in the grass' : 'naps in a sunbeam';
    k.tx = b.x + 0.6 + w.rnd() * (b.w - 1.2);
    k.ty = b.y + 0.6 + w.rnd() * (b.h - 1.2);
    k.left = 24 + (w.rnd() * 22 | 0);
    return;
  }
  if (r < (night ? 0.62 : 0.34)) {
    const o = others[w.rnd() * others.length | 0];
    k.act = `grooms ${o.name}`;
    k.tx = o.x + (w.rnd() > 0.5 ? 0.8 : -0.8);
    k.ty = o.y + 0.2;
    k.left = 8 + (w.rnd() * 8 | 0);
    return;
  }
  if (r < 0.44) {
    const g = w.bugs[w.rnd() * w.bugs.length | 0];
    k.act = w.rnd() < 0.28 ? 'pounces on nothing' : 'chases a bug';
    k.tx = g.x; k.ty = g.y; k.left = 4 + (w.rnd() * 6 | 0);
    return;
  }
  if (r < 0.54) {
    const b = w.bowls[w.rnd() > 0.5 ? 0 : 1];
    k.act = b.kind === 'water' ? 'drinks' : 'eats';
    k.tx = b.x + 0.9; k.ty = b.y + 0.2; k.left = 5 + (w.rnd() * 5 | 0);
    return;
  }
  const pick = SOLO[w.rnd() * SOLO.length | 0];
  k.act = pick[0];
  k.left = 2 + (w.rnd() * pick[1] | 0);
  k.tx = Math.max(0.8, Math.min(w.cols - 0.8, k.x + (w.rnd() - 0.5) * 6));
  k.ty = Math.max(0.8, Math.min(w.rows - 0.8, k.y + (w.rnd() - 0.5) * 4));
}

export function step(w) {
  w.tick++;
  for (const g of w.bugs) {
    if (w.rnd() < 0.35) { g.vx = (w.rnd() - 0.5) * 1.6; g.vy = (w.rnd() - 0.5) * 1.2; }
    g.x = Math.max(0.5, Math.min(w.cols - 0.5, g.x + g.vx));
    g.y = Math.max(0.5, Math.min(w.rows - 0.5, g.y + g.vy));
  }
  for (const k of w.kitties) {
    k.px = k.x; k.py = k.y;
    k.left--;
    if (k.left <= 0) choose(w, k);
    const dx = k.tx - k.x, dy = k.ty - k.y;
    const d = Math.hypot(dx, dy);
    const speed = /naps|sleeps|sits|grooms|watches|kneads/.test(k.act) ? 0.42 : 0.86;
    if (d > 0.06) {
      const m = Math.min(speed, d);
      k.x += (dx / d) * m; k.y += (dy / d) * m;
      if (Math.abs(dx) > 0.12) k.face = dx > 0 ? 1 : -1;
    }
    k.resting = /naps|sleeps|sits|watches|kneads|rolls/.test(k.act);
  }
}

/* ── live connection, local fallback ─────────────────────────────── */
const STATE_PHRASE = {
  sleeping: 'sleeps in the grass',
  eating: 'eats',
  drinking: 'drinks',
  playing: 'plays',
  grooming: 'grooms',
  cuddling: 'cuddles',
  bathing: 'washes',
  pouncing: 'pounces',
  resting: 'rests',
};
const DIRW = { north: 'north', south: 'south', east: 'east', west: 'west' };

function describe(r, tick, byId) {
  const a = r.activity || {};
  const other = (id) => (byId[id] ? byId[id].name : 'a friend');
  const st = a.state;
  if (st && st !== 'idle') {
    if (st === 'sleeping') return a.in_sunbeam ? 'naps in a sunbeam' : 'sleeps in the grass';
    if (a.with_friend != null && (st === 'grooming' || st === 'cuddling' || st === 'playing')) {
      return (STATE_PHRASE[st] || st) + ' ' + other(a.with_friend);
    }
    return STATE_PHRASE[st] || st.replace(/_/g, ' ');
  }
  const p = r.pursuit && r.pursuit.target;
  if (p) {
    if (p.target === 'kitty') return 'follows ' + other(p.id);
    return 'chases something small';
  }
  if (r.purring_until != null && r.purring_until > tick) return 'purrs';
  const la = (r.last_action && r.last_action.action) || '';
  if (la === 'move') return 'wanders ' + (DIRW[r.last_action.direction] || 'off');
  if (la === 'play') return 'pounces on nothing';
  if (la === 'meow') return 'meows about it';
  if (la === 'eat') return 'eats';
  if (la === 'drink') return 'drinks';
  if (la === 'sleep') return 'settles down';
  if (la === 'groom') return 'grooms ' + other(r.last_action.with);
  return 'watches the grass';
}

const RESTING = /sleep|groom|cuddl|rest|purr|settle|watch/;

export function connect(world, url, onStatus) {
  if (!url) return () => {};
  let ws, dead = false, timer;
  const fail = (why) => {
    if (dead || world.source === 'live') return;
    world.source = 'local';
    onStatus && onStatus('local', why);
  };
  try {
    ws = new WebSocket(url.replace(/^http/, 'ws'));
  } catch (e) { fail('blocked'); return () => {}; }
  timer = setTimeout(() => {
    if (world.source !== 'live') { try { ws.close(); } catch (e) {} fail('timeout'); }
  }, 5000);

  ws.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(ev.data); } catch (e) { return; }
    const list = d.kitties;
    if (!Array.isArray(list) || !list.length) return;
    const first = world.source !== 'live';
    world.source = 'live';
    world.stamp = performance.now();
    clearTimeout(timer);
    if (first) onStatus && onStatus('live');

    if (d.width && (world.cols !== d.width || world.rows !== d.height)) {
      world.cols = d.width; world.rows = d.height;
      reseedDecor(world);
    }
    if (typeof d.tick === 'number') world.tick = d.tick;

    const byId = {};
    for (const r of list) byId[r.id] = r;

    // elements: bowls, sunbeams, bugs. greebles are in the payload and stay undrawn.
    const els = d.elements || [];
    const bowls = [], beams = [], bugs = [];
    for (const e of els) {
      const x = e.pos ? e.pos.x : e.x, y = e.pos ? e.pos.y : e.y;
      if (e.kind === 'water' || e.kind === 'chow') bowls.push({ x: x + 0.5, y: y + 0.5, kind: e.kind === 'water' ? 'water' : 'food' });
      else if (e.kind === 'sunbeam') beams.push({ x: x - 0.7, y: y - 0.7, w: 2.4, h: 2.4, skew: 0.7 });
      else if (e.kind === 'bug') bugs.push({ x: x + 0.5, y: y + 0.5, vx: 0, vy: 0, k: (e.id % 97) / 97 });
    }
    world.bowls = bowls;
    world.beams = beams;
    world.bugs = bugs;
    world.dirty = true;

    const seen = [];
    list.forEach((r, i) => {
      let k = world.kitties.find((c) => c.id === r.id);
      if (!k) {
        const t = ROSTER[i % ROSTER.length];
        k = { ...t, id: r.id, x: 0, y: 0, px: 0, py: 0, face: 1, bob: (r.id * 1.7) % 6.28 };
        world.kitties.push(k);
      }
      const nx = (r.pos ? r.pos.x : r.x) + 0.5;
      const ny = (r.pos ? r.pos.y : r.y) + 0.5;
      k.px = k.x; k.py = k.y;
      if (Math.abs(nx - k.x) > 0.12) k.face = nx > k.x ? 1 : -1;
      k.x = nx; k.y = ny;
      if (r.name) k.name = r.name;
      k.mind = r.behavior || k.mind;
      k.act = describe(r, world.tick, byId);
      k.resting = RESTING.test(k.act);
      seen.push(r.id);
    });
    world.kitties = world.kitties.filter((c) => seen.includes(c.id));
  };
  ws.onerror = () => fail('error');
  ws.onclose = () => fail('closed');
  return () => { dead = true; clearTimeout(timer); try { ws.close(); } catch (e) {} };
}

// client-side decoration only — the server has no opinion about shrubbery
function reseedDecor() {}

/* ── rendering ───────────────────────────────────────────────────
   A camera follows the kitties around a world larger than any frame.
   Ground and shrubbery are procedural from a tile hash, so the meadow
   continues past the world edge and nothing ever letterboxes.        */

export function layoutOf(canvas) { return canvas.__layout; }

function groundTone(g, pal, x, y, tile, ox, oy) {
  const n = hash(x, y, 3);
  g.fillStyle = rgb(mixc(pal.grassA, pal.grassB, 0.3 + n * 0.34));
  g.fillRect(ox + x * tile - 0.5, oy + y * tile - 0.5, tile + 1, tile + 1);
}

function drawGround(g, pal, L, w, h) {
  const { tile, ox, oy } = L;
  g.fillStyle = rgb(pal.sky); g.fillRect(0, 0, w, h);
  const x0 = Math.floor(-ox / tile) - 1, x1 = Math.ceil((w - ox) / tile) + 1;
  const y0 = Math.floor(-oy / tile) - 1, y1 = Math.ceil((h - oy) / tile) + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) groundTone(g, pal, x, y, tile, ox, oy);

  // worn earth and moss
  for (let y = y0 - 2; y <= y1 + 2; y++) {
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      const n = hash(x, y, 23);
      if (n < 0.972) continue;
      const k = hash(x, y, 24);
      const r = (0.9 + k * 1.7) * tile;
      const bx = ox + (x + 0.5) * tile, by = oy + (y + 0.5) * tile;
      const earth = k > 0.6;
      g.fillStyle = rgb(earth ? pal.dirt : mixc(pal.grassB, pal.bush, 0.7), earth ? 0.15 : 0.2);
      g.beginPath(); g.ellipse(bx, by, r, r * 0.66, k * 3, 0, 6.283); g.fill();
    }
  }

  // grass blades
  g.lineWidth = Math.max(1, tile * 0.035);
  g.lineCap = 'round';
  g.strokeStyle = rgb(mixc(pal.grassB, pal.bush, 0.45), 0.55);
  g.beginPath();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const n = hash(x, y, 11);
      if (n < 0.55) continue;
      const bx = ox + (x + hash(x, y, 12)) * tile;
      const by = oy + (y + hash(x, y, 13)) * tile;
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + tile * 0.06, by - tile * 0.17, bx + (n - 0.5) * tile * 0.34, by - tile * 0.32);
    }
  }
  g.stroke();

  // flowers
  const fine = tile > 30;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const n = hash(x, y, 22);
      if (n < 0.93) continue;
      const k = hash(x, y, 25);
      const bx = ox + (x + k) * tile, by = oy + (y + hash(x, y, 26)) * tile;
      const r = tile * 0.055;
      g.fillStyle = rgb(k > 0.5 ? pal.paper : pal.accent, 0.85);
      if (fine) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * 6.283 + k * 3;
          g.beginPath(); g.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r, r * 0.85, 0, 6.283); g.fill();
        }
        g.fillStyle = rgb(pal.beam, 0.9);
        g.beginPath(); g.arc(bx, by, r * 0.7, 0, 6.283); g.fill();
      } else {
        g.beginPath(); g.arc(bx, by, r * 1.15, 0, 6.283); g.fill();
      }
    }
  }
}

function visibleBushes(L, w, h) {
  const { tile, ox, oy } = L;
  const out = [];
  const x0 = Math.floor(-ox / tile) - 2, x1 = Math.ceil((w - ox) / tile) + 2;
  const y0 = Math.floor(-oy / tile) - 2, y1 = Math.ceil((h - oy) / tile) + 2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (hash(x, y, 21) < 0.955) continue;
      out.push({ bush: true, x: x + hash(x, y, 27), y: y + hash(x, y, 28), r: 0.38 + hash(x, y, 29) * 0.85, s: hash(x, y, 30) });
    }
  }
  return out;
}

function drawBush(g, b, L, pal) {
  const bx = L.ox + b.x * L.tile, by = L.oy + b.y * L.tile, r = b.r * L.tile;
  const shL = pal.shLen === undefined ? 1 : pal.shLen;
  g.fillStyle = rgb(pal.ink, 0.1 / Math.max(1, shL * 0.8));
  g.beginPath(); g.ellipse(bx + (pal.shX || 0) * r, by + r * 0.52, r * 1.02 * shL, r * 0.34, 0, 0, 6.283); g.fill();
  g.fillStyle = rgb(pal.bush);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.283 + b.s * 5;
    g.beginPath(); g.arc(bx + Math.cos(a) * r * 0.42, by + Math.sin(a) * r * 0.3, r * 0.62, 0, 6.283); g.fill();
  }
  g.fillStyle = rgb(pal.bushHi, 0.45);
  g.beginPath(); g.arc(bx - r * 0.22, by - r * 0.3, r * 0.3, 0, 6.283); g.fill();
}

function drawBeams(g, world, pal, L, tick) {
  if (pal.beamA < 0.03) return;
  for (const b of world.beams) {
    const cx = L.ox + (b.x + b.w / 2) * L.tile + Math.sin(tick / 110 + b.skew * 3) * L.tile * 0.16;
    const cy = L.oy + (b.y + b.h / 2) * L.tile;
    const r = Math.max(b.w, b.h) * L.tile * 0.78;
    const grad = g.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    grad.addColorStop(0, rgb(pal.beam, pal.beamA));
    grad.addColorStop(0.5, rgb(pal.beam, pal.beamA * 0.5));
    grad.addColorStop(1, rgb(pal.beam, 0));
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx, cy, r * 1.15, r * 0.82, -0.35, 0, 6.283); g.fill();
  }
}

function drawBowls(g, world, pal, L) {
  for (const b of world.bowls) {
    const bx = L.ox + b.x * L.tile, by = L.oy + b.y * L.tile;
    g.fillStyle = rgb(pal.ink, 0.1);
    g.beginPath(); g.ellipse(bx, by + L.tile * 0.05, L.tile * 0.3, L.tile * 0.15, 0, 0, 6.283); g.fill();
    g.fillStyle = rgb(pal.dirt, 0.85);
    g.beginPath(); g.ellipse(bx, by, L.tile * 0.28, L.tile * 0.15, 0, 0, 6.283); g.fill();
    g.fillStyle = rgb(b.kind === 'water' ? pal.water : pal.accent, 0.75);
    g.beginPath(); g.ellipse(bx, by - L.tile * 0.01, L.tile * 0.19, L.tile * 0.095, 0, 0, 6.283); g.fill();
  }
}

function drawBugs(g, world, pal, L, t) {
  for (const b of world.bugs) {
    const x = L.ox + b.x * L.tile + Math.sin(t / 220 + b.k * 9) * L.tile * 0.34;
    const y = L.oy + b.y * L.tile + Math.cos(t / 170 + b.k * 5) * L.tile * 0.26;
    g.fillStyle = rgb(pal.paper, 0.8);
    g.beginPath(); g.ellipse(x - L.tile * 0.05, y, L.tile * 0.055, L.tile * 0.035, -0.5, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(x + L.tile * 0.05, y, L.tile * 0.055, L.tile * 0.035, 0.5, 0, 6.283); g.fill();
  }
}

function drawFireflies(g, pal, L, t, w, h) {
  if (pal.glowA < 0.02) return;
  for (let i = 0; i < 24; i++) {
    const n = hash(i, 1, 5), m = hash(i, 2, 6);
    const x = ((n * w) + Math.sin(t / 900 + i) * 40 + w) % w;
    const y = ((m * h) + Math.cos(t / 1100 + i * 2) * 30 + h) % h;
    const a = (0.35 + 0.65 * Math.abs(Math.sin(t / 500 + i * 1.7))) * pal.glowA * 6;
    g.fillStyle = rgb(pal.glow, Math.min(0.85, a));
    g.beginPath(); g.arc(x, y, 1.7, 0, 6.283); g.fill();
  }
}

/* A tail is still most of the time, and then it flicks. The first version ran a
   continuous sine at fixed amplitude on one frequency for every cat — only the
   phase differed — so four tails beat together like metronomes and none of them
   ever rested. This is quiet, with an occasional burst on a tempo of its own.

   lagMs is how far down the tail we are asking about: the base leads and the
   tip answers a beat later, which is what makes the motion travel outward
   instead of the whole curve pivoting at once. */
function tailWave(t, bob, rest, lagMs) {
  const tempo = 0.75 + ((bob * 37) % 1) * 0.5;
  const period = (rest ? 5200 : 3400) * tempo;
  const u = (((t - lagMs) / period + bob / 6.283) % 1 + 1) % 1;
  const win = rest ? 0.13 : 0.2;   // the share of each cycle spent flicking
  let burst = 0;
  if (u < win) {
    const q = u / win;
    // out, a bigger swing back, then settle — and zero at both ends, so the
    // flick begins and finishes at rest rather than snapping into place
    burst = Math.sin(q * Math.PI) * Math.sin(q * Math.PI * 2.6);
  }
  // a slow drift underneath, so a tail at rest is quiet rather than dead
  return burst + Math.sin((t - lagMs) / 2600 + bob) * 0.12;
}

/* Mackerel tabby markings: ribs off the spine, swept back toward the tail and
   tapering as they go. The direction is the whole point — struck from a centre
   inside the body the same strokes bow the other way and nest into each other,
   which reads as a curl rather than a stripe. Clipped to the body so a rib can
   never escape the silhouette. */
function drawStripes(g, s, bodyR, outline, tilt) {
  g.save();
  g.beginPath(); g.ellipse(0, 0, bodyR[0], bodyR[1], tilt, 0, 6.283); g.clip();
  g.strokeStyle = rgb(outline, 0.32);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = s * 0.055;
  const top = -bodyR[1] * 0.95, len = bodyR[1] * 0.95;
  for (let i = 0; i < 4; i++) {
    const x = -s * 0.24 + i * s * 0.15;
    g.beginPath();
    g.moveTo(x, top);
    g.quadraticCurveTo(x - s * 0.035, top + len * 0.6, x - s * 0.085, top + len);
    g.stroke();
  }
  g.restore();
}

/* three cat vocabularies */
function drawCat(g, k, L, pal, art, t, hovered) {
  // s is how big a cat is (1.34 tiles), not where it sits — position uses the
  // tile grid, same as the ground, the bushes, the bowls, the camera fit and
  // hitTest. Multiplying position by s too put cats in a coordinate space 34%
  // wider than the world they stand in: they drifted off their own sunbeams,
  // escaped the frame the camera had fitted for them, and landed 60–175px from
  // the spot hitTest was watching, which is well past its 0.8-tile radius.
  const s = L.tile * 1.34;
  const bob = k.resting ? Math.sin(t / 700 + k.bob) * s * 0.02 : Math.sin(t / 160 + k.bob) * s * 0.05;
  const x = L.ox + k.x * L.tile, y = L.oy + k.y * L.tile + bob;
  const f = k.face;
  const rest = k.resting;
  const coat = k.coat, belly = k.belly;
  const outline = art === 'ink' ? pal.ink : mixc(coat, [20, 16, 12], 0.45);

  g.save();
  g.translate(x, y);
  // shadow — stretches and leans with the sun
  const shL = pal.shLen === undefined ? 1 : pal.shLen;
  const shX = (pal.shX === undefined ? 0 : pal.shX) * s * 0.5;
  g.fillStyle = rgb(pal.ink, (art === 'flat' ? 0.1 : 0.16) / Math.max(1, shL * 0.8));
  g.beginPath(); g.ellipse(shX, s * 0.34, s * 0.44 * shL, s * 0.13, 0, 0, 6.283); g.fill();
  g.scale(f, 1);

  const bodyR = rest ? [s * 0.5, s * 0.3] : [s * 0.44, s * 0.33];
  const headX = rest ? s * 0.32 : s * 0.28;
  const headY = rest ? -s * 0.12 : -s * 0.3;
  const headR = s * 0.27;

  const fill = art === 'ink' ? rgb(mixc(pal.paper, coat, 0.34), 0.92) : rgb(coat);
  const stroke = rgb(outline, art === 'flat' ? 0 : 1);
  g.lineWidth = art === 'ink' ? Math.max(1.7, s * 0.07) : Math.max(1, s * 0.03);
  g.lineJoin = 'round'; g.lineCap = 'round';

  // tail — drawn before the body so it sits behind. The root rides the body
  // rather than sitting at a fixed point, so it follows the loaf/stand shapes.
  const rootX = -bodyR[0] * 0.86, rootY = bodyR[1] * 0.32;
  const swing = s * (rest ? 0.18 : 0.38);
  const lag = rest ? 150 : 95;
  const wBase = tailWave(t, k.bob, rest, 0);
  const wMid = tailWave(t, k.bob, rest, lag * 0.45);
  const wTip = tailWave(t, k.bob, rest, lag);
  g.strokeStyle = art === 'ink' ? rgb(pal.ink) : rgb(coat);
  g.lineWidth = art === 'ink' ? Math.max(1.4, s * 0.055) : art === 'flat' ? s * 0.2 : s * 0.16;
  g.beginPath();
  g.moveTo(rootX, rootY);
  // a cubic, not a quadratic: two control points is the least it takes to hold
  // two different phases at once, which is what a travelling wave needs
  g.bezierCurveTo(
    rootX - s * 0.253 + wBase * swing * 0.09, rootY - s * 0.033 + wBase * swing * 0.28,
    rootX - s * 0.353 + wMid * swing * 0.20, rootY - s * 0.160 + wMid * swing * 0.66,
    rootX - s * 0.300 + wTip * swing * 0.30, rootY - s * 0.380 + wTip * swing * 1.0,
  );
  g.stroke();
  if (art !== 'flat' && art !== 'ink') {
    g.strokeStyle = rgb(outline, 0.5); g.lineWidth = s * 0.03; g.stroke();
  }

  // body
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(0, 0, bodyR[0], bodyR[1], rest ? 0 : -0.06, 0, 6.283); g.fill();
  if (art !== 'flat') { g.strokeStyle = stroke; g.lineWidth = art === 'ink' ? Math.max(1.7, s * 0.07) : Math.max(1, s * 0.028); g.stroke(); }

  // belly / haunch
  if (art === 'soft') {
    g.fillStyle = rgb(belly, 0.85);
    g.beginPath(); g.ellipse(s * 0.06, s * 0.12, bodyR[0] * 0.5, bodyR[1] * 0.45, 0, 0, 6.283); g.fill();
    if (k.tabby) drawStripes(g, s, bodyR, outline, rest ? 0 : -0.06);
  }

  // head
  g.save();
  g.translate(headX, headY);
  if (rest) g.rotate(0.18);
  // ears
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(-headR * 0.72, -headR * 0.5); g.lineTo(-headR * 0.5, -headR * 1.28); g.lineTo(-headR * 0.05, -headR * 0.72);
  g.closePath(); g.fill(); if (art !== 'flat') { g.strokeStyle = stroke; g.stroke(); }
  g.beginPath();
  g.moveTo(headR * 0.68, -headR * 0.52); g.lineTo(headR * 0.52, -headR * 1.3); g.lineTo(headR * 0.06, -headR * 0.74);
  g.closePath(); g.fill(); if (art !== 'flat') g.stroke();
  if (art === 'soft') {
    g.fillStyle = rgb(mixc(belly, [230, 160, 160], 0.4), 0.9);
    g.beginPath(); g.moveTo(-headR * 0.56, -headR * 0.6); g.lineTo(-headR * 0.46, -headR * 1.06); g.lineTo(-headR * 0.2, -headR * 0.72); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(headR * 0.54, -headR * 0.62); g.lineTo(headR * 0.46, -headR * 1.08); g.lineTo(headR * 0.2, -headR * 0.74); g.closePath(); g.fill();
  }
  // skull
  if (art === 'flat') {
    g.strokeStyle = rgb(pal.sky, 0.55); g.lineWidth = s * 0.06;
    g.beginPath(); g.ellipse(0, 0, headR, headR * 0.9, 0, 0, 6.283); g.stroke();
    g.fillStyle = rgb(mixc(coat, [255, 252, 244], 0.16));
  } else {
    g.fillStyle = fill;
  }
  g.beginPath(); g.ellipse(0, 0, headR, headR * 0.9, 0, 0, 6.283); g.fill();
  if (art !== 'flat') { g.strokeStyle = stroke; g.stroke(); }
  // face
  const eyeY = -headR * 0.06;
  const inkc = art === 'flat' ? rgb(mixc(belly, [255, 255, 255], 0.5), 0.95) : art === 'ink' ? rgb(pal.ink) : rgb(outline);
  g.strokeStyle = inkc; g.fillStyle = inkc;
  g.lineWidth = Math.max(1.2, s * 0.04);
  if (rest) {
    g.beginPath(); g.arc(-headR * 0.36, eyeY, headR * 0.2, 0.2, Math.PI - 0.2); g.stroke();
    g.beginPath(); g.arc(headR * 0.36, eyeY, headR * 0.2, 0.2, Math.PI - 0.2); g.stroke();
  } else {
    const er = art === 'flat' ? 0.17 : 0.11;
    g.beginPath(); g.ellipse(-headR * 0.36, eyeY, headR * er, headR * (er + 0.04), 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(headR * 0.36, eyeY, headR * er, headR * (er + 0.04), 0, 0, 6.283); g.fill();
  }
  if (art !== 'flat') {
    g.beginPath();
    g.moveTo(-headR * 0.1, headR * 0.3); g.lineTo(0, headR * 0.4); g.lineTo(headR * 0.1, headR * 0.3);
    g.stroke();
  }
  if (art !== 'flat') {
    g.strokeStyle = rgb(art === 'ink' ? pal.ink : outline, 0.4);
    g.lineWidth = Math.max(0.8, s * 0.018);
    for (let i = -1; i <= 1; i++) {
      g.beginPath(); g.moveTo(headR * 0.3, headR * 0.26 + i * headR * 0.1); g.lineTo(headR * 1.05, headR * 0.12 + i * headR * 0.22); g.stroke();
      g.beginPath(); g.moveTo(-headR * 0.3, headR * 0.26 + i * headR * 0.1); g.lineTo(-headR * 1.05, headR * 0.12 + i * headR * 0.22); g.stroke();
    }
  }
  g.restore();

  // z's
  if (rest && /nap|sleep/.test(k.act)) {
    const zp = (t / 1400 + k.bob) % 1;
    g.globalAlpha = 0.55 * (1 - zp);
    g.fillStyle = rgb(art === 'ink' ? pal.ink : pal.paper);
    g.font = `${(s * 0.34) | 0}px ui-monospace, monospace`;
    g.fillText('z', headX + s * 0.34, headY - s * 0.42 - zp * s * 0.6);
    g.globalAlpha = 1;
  }
  g.restore();

  if (hovered) {
    const label = k.name;
    g.font = `600 ${Math.max(11, s * 0.34) | 0}px "IBM Plex Mono", ui-monospace, monospace`;
    const tw2 = g.measureText(label).width;
    const px = x - tw2 / 2 - s * 0.18, py = y - s * 0.95;
    const hgt = Math.max(18, s * 0.5);
    g.fillStyle = rgb(pal.ink, 0.9);
    g.beginPath();
    if (g.roundRect) { g.roundRect(px, py - hgt, tw2 + s * 0.36, hgt, hgt / 2); } else { g.rect(px, py - hgt, tw2 + s * 0.36, hgt); }
    g.fill();
    g.fillStyle = rgb(pal.paper);
    g.textBaseline = 'middle';
    g.fillText(label, px + s * 0.18, py - hgt / 2 + 1);
    g.textBaseline = 'alphabetic';
  }
}

export function drawMeadow(canvas, world, opts) {
  const { w, h, art = 'soft', tick, alpha = 0, hover = null, vignette = true, across = 15, follow = true } = opts;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== (w * dpr | 0)) { canvas.width = w * dpr | 0; canvas.height = h * dpr | 0; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pal = paletteAt(tick);

  let need = across, cx = world.cols / 2, cy = world.rows / 2;
  if (follow && world.kitties.length) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const k of world.kitties) {
      const kx = lerp(k.px, k.x, alpha), ky = lerp(k.py, k.y, alpha);
      if (kx < x0) x0 = kx; if (kx > x1) x1 = kx;
      if (ky < y0) y0 = ky; if (ky > y1) y1 = ky;
    }
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
    if (opts.fit === false) {
      let sx = 0, sy = 0;
      for (const k of world.kitties) { sx += lerp(k.px, k.x, alpha); sy += lerp(k.py, k.y, alpha); }
      cx = sx / world.kitties.length; cy = sy / world.kitties.length;
    } else {
      // the frame must hold every kitty; the group is sometimes at opposite
      // corners of the world, so this can zoom well past the nominal setting.
      const marg = 2.6;
      const fitX = (x1 - x0) + marg * 2;
      const fitY = ((y1 - y0) + marg * 2) * (w / h);
      need = Math.max(across * 0.9, fitX, fitY);
      // The live world is 24x24 and the cats routinely sit 15 tiles apart, so
      // an uncapped fit zooms out until they are 30px specks in a field of
      // shrubbery. This is a window, not a map: hold a legible scale and let
      // a wanderer leave the frame — the roster still says where everyone is.
      if (opts.maxAcross && need > opts.maxAcross) {
        need = opts.maxAcross;
        // Once the frame can no longer hold everyone, the midpoint of the
        // bounding box is the one place nobody is standing — and the centre
        // of mass can be just as empty when the group is evenly scattered.
        // Aim at the cat closest to that centre: a real occupied spot, so the
        // window is never pointed at nothing, and it still sits inside the
        // largest cluster whenever there is one.
        let sx = 0, sy = 0;
        for (const k of world.kitties) { sx += lerp(k.px, k.x, alpha); sy += lerp(k.py, k.y, alpha); }
        const mx = sx / world.kitties.length, my = sy / world.kitties.length;
        let best = null, bd = Infinity, held = null, hd = Infinity;
        for (const k of world.kitties) {
          const kx = lerp(k.px, k.x, alpha), ky = lerp(k.py, k.y, alpha);
          const d = (kx - mx) ** 2 + (ky - my) ** 2;
          if (d < bd) { bd = d; best = { id: k.id, x: kx, y: ky }; }
          if (k.id === canvas.__anchor) { hd = d; held = { id: k.id, x: kx, y: ky }; }
        }
        // Stay with whoever we are already watching until someone else is
        // clearly more central — 2.25 is 1.5x in distance, these are squared.
        // Re-picking every frame made the camera flick between cats standing
        // at opposite ends of the meadow.
        const pick = held && hd < bd * 2.25 ? held : best;
        if (pick) { canvas.__anchor = pick.id; cx = pick.x; cy = pick.y; }
      }
    }
  }
  cy += opts.camOffsetY || 0;

  // The easing rates below were written as "fraction per frame" at 60Hz, which
  // means a 120Hz display eases twice as fast and a stuttering one lurches.
  // Rescale them by the real frame time so the motion is the same everywhere.
  const now = performance.now();
  const dt = canvas.__t ? Math.min(120, now - canvas.__t) : 1000 / 60;
  canvas.__t = now;
  const perFrame = (rate) => 1 - Math.pow(1 - rate, dt / (1000 / 60));

  const targetTile = w / need;
  const prevTile = canvas.__tile;
  const tile = prevTile === undefined ? targetTile : prevTile + (targetTile - prevTile) * perFrame(0.05);
  canvas.__tile = tile;

  const cam = canvas.__cam || (canvas.__cam = { x: cx, y: cy });
  // Only the first frame cuts. There used to be a "if the target moved more
  // than 7 tiles, snap" rule, and once the camera started following whichever
  // cat was most central it fired several times a minute — the camera visibly
  // cutting between cats. However far the target jumps, ease to it instead.
  const ease = canvas.__seen ? perFrame(opts.camEase || 0.06) : 1;
  canvas.__seen = true;
  cam.x += (cx - cam.x) * ease; cam.y += (cy - cam.y) * ease;

  const L = { tile, ox: w / 2 - cam.x * tile, oy: h / 2 - cam.y * tile };
  canvas.__layout = L;
  canvas.__pal = pal;

  const t = now;
  drawGround(g, pal, L, w, h);
  drawBeams(g, world, pal, L, tick + alpha);
  drawBowls(g, world, pal, L);
  drawBugs(g, world, pal, L, t);

  const layer = visibleBushes(L, w, h);
  for (const k of world.kitties) {
    layer.push({ cat: k, x: lerp(k.px, k.x, alpha), y: lerp(k.py, k.y, alpha) });
  }
  layer.sort((a, b) => a.y - b.y);
  for (const item of layer) {
    if (item.bush) drawBush(g, item, L, pal);
    else drawCat(g, { ...item.cat, x: item.x, y: item.y }, L, pal, art, t, hover === item.cat.id);
  }

  drawFireflies(g, pal, L, t, w, h);

  if (pal.veilA > 0.01) { g.fillStyle = rgb(pal.veil, pal.veilA); g.fillRect(0, 0, w, h); }
  if (vignette) {
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, rgb(pal.name === 'night' ? [0, 0, 10] : [60, 44, 20], 0.13));
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }
}

export function hitTest(canvas, world, cx, cy, alpha = 0) {
  const L = canvas.__layout;
  if (!L) return null;
  let best = null, bd = 1e9;
  for (const k of world.kitties) {
    const x = L.ox + lerp(k.px, k.x, alpha) * L.tile;
    const y = L.oy + lerp(k.py, k.y, alpha) * L.tile;
    const d = Math.hypot(cx - x, cy - y);
    if (d < L.tile * 0.8 && d < bd) { bd = d; best = k.id; }
  }
  return best;
}

export const fmtTick = (n) => n.toLocaleString('en-US');
