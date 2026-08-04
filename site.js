// kitten.me — composition 1b, wired to the live meadow.
//
// The design doc ran this inside a React harness with nine preview panels.
// Here there is one window, so this file is just: keep a world ticking,
// draw it into the canvas, and let the palette drive the page around it.

import {
  createWorld, connect, step, drawMeadow, hitTest,
  paletteAt, phaseFor, rgb, fmtTick, TICK_MS,
} from './meadow.js';

const WS_URL = 'wss://kitties.ai/ws';
const START_TICK = 618033;
const SEED = 7;
const ART = 'soft';         // full-colour coats — the four cats read as four cats
const ACROSS_WIDE = 12;
const ACROSS_NARROW = 8;    // the phone crops the world tighter
// The camera fits every cat in frame, but the live world is 24x24 and they
// scatter; without a ceiling on the zoom-out they become specks. 1.5x the
// nominal width keeps a cat at ~48px at worst, at the cost of occasionally
// leaving a wanderer outside the window. The roster still accounts for them.
const ZOOM_CEILING = 1.5;
const NARROW = window.matchMedia('(max-width: 820px)');
const CALM = window.matchMedia('(prefers-reduced-motion: reduce)');

const el = {
  root: document.documentElement,
  canvas: document.getElementById('meadow'),
  tick: document.getElementById('tick'),
  phase: document.getElementById('phase'),
  source: document.getElementById('source'),
  roster: document.getElementById('roster'),
};

const world = createWorld(SEED, START_TICK);

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const themeColor = document.querySelector('meta[name="theme-color"]');

let alpha = 0;
let last = performance.now();
let hover = null;         // set by pointing at the canvas
let hoverFromList = null; // set by pointing at a roster row
let size = { w: 0, h: 0 };
let paletteStamp = 0;
let running = null;       // { kind: 'raf' | 'timer', id } — never guess which
let lastStamp = 0;        // when the last server frame landed
let period = TICK_MS;     // and how far apart they have been arriving

/* ── canvas sizing ───────────────────────────────────────────────── */

function measure() {
  const r = el.canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  if (w === size.w && h === size.h) return;
  size = { w, h };
  // drawMeadow only re-syncs the backing store when the width changes, so
  // set both here — the aspect ratio flips between the wide and phone layouts
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.canvas.width = (w * dpr) | 0;
  el.canvas.height = (h * dpr) | 0;
}

new ResizeObserver(measure).observe(el.canvas);
measure();

/* ── visibility ──────────────────────────────────────────────────── */

// The page is a scrolling list now, so the window can sit well off-screen.
// The world keeps ticking either way — only the drawing stops, so the count
// and the roster stay honest while nobody is looking at the meadow.
let onScreen = true;
if (typeof IntersectionObserver === 'function') {
  new IntersectionObserver(
    ([e]) => { onScreen = e.isIntersecting; },
    { rootMargin: '200px' },
  ).observe(el.canvas);
}

/* ── pointing ────────────────────────────────────────────────────── */

function pointAt(e) {
  const r = el.canvas.getBoundingClientRect();
  const t = e.touches && e.touches[0];
  const cx = (t ? t.clientX : e.clientX) - r.left;
  const cy = (t ? t.clientY : e.clientY) - r.top;
  hover = hitTest(el.canvas, world, cx, cy, alpha);
}

el.canvas.addEventListener('mousemove', pointAt);
el.canvas.addEventListener('mouseleave', () => { hover = null; });
el.canvas.addEventListener('touchstart', pointAt, { passive: true });
el.canvas.addEventListener('touchend', () => { hover = null; });

/* ── the world clock ─────────────────────────────────────────────── */

const disconnect = connect(world, WS_URL, (src) => {
  el.source.dataset.state = src;
  el.source.title = src === 'live'
    ? 'live from the meadow'
    : 'simulated locally';
});

/* ── drawing ─────────────────────────────────────────────────────── */

function draw(now) {
  if (world.source === 'live') {
    // The server does not tick at TICK_MS — it runs nearer 800ms, and jitters.
    // Interpolating over a fixed 1000ms meant a cat only ever travelled 80% of
    // the way before the next frame landed and it snapped the rest, which is a
    // visible stutter on every cat, more than once a second. Measure the real
    // cadence instead and follow it.
    if (world.stamp !== lastStamp) {
      const gap = world.stamp - lastStamp;
      // ignore catch-up bursts and reconnect gaps; ease toward the rest
      if (lastStamp && gap > 250 && gap < 4000) period += (gap - period) * 0.25;
      lastStamp = world.stamp;
    }
    // Tracking the measured cadence directly beats trying to arrive early:
    // finishing the move ahead of the next frame makes the cats stop and
    // restart, and stop-start motion reads as choppier than a slight overshoot.
    alpha = clamp01((now - world.stamp) / period);
  } else {
    while (now - last >= TICK_MS) { step(world); last += TICK_MS; }
    if (now - last > TICK_MS * 4) last = now;
    alpha = clamp01((now - last) / TICK_MS);
  }

  if (CALM.matches) alpha = 0;

  const across = NARROW.matches ? ACROSS_NARROW : ACROSS_WIDE;

  if (onScreen) {
    drawMeadow(el.canvas, world, {
      w: size.w,
      h: size.h,
      art: ART,
      tick: world.tick,
      across,
      maxAcross: across * ZOOM_CEILING,
      camEase: CALM.matches ? 1 : 0.06,
      follow: true,
      alpha,
      hover: hoverFromList ?? hover,
      vignette: true,
    });

    el.canvas.style.cursor = hover ? 'pointer' : 'default';
  }

  if (now - paletteStamp > 220) {
    paletteStamp = now;
    applyPalette(paletteAt(world.tick));
  }
}

function applyPalette(pal) {
  const s = el.root.style;
  s.setProperty('--paper', rgb(pal.paper));
  s.setProperty('--ink', rgb(pal.ink));
  s.setProperty('--ink-soft', rgb(pal.inkSoft));
  s.setProperty('--accent', rgb(pal.accent));
  s.setProperty('--rule', rgb(pal.rule));
  // keep the browser chrome in step with the paper
  themeColor.setAttribute('content', rgb(pal.paper));
}

/* ── the reading ─────────────────────────────────────────────────── */

// Poll faster than the world ticks and write only on change. The old code read
// once a second against a world that advances every 800ms, so every fourth read
// caught two ticks and the counter appeared to skip. It never actually did —
// the server increments by exactly one, every time — it was being read on a
// clock that did not match.
const POLL = 200;

// The cats change what they are doing far faster than a person can read about
// it: 68% of lines survive a single tick, and all four turned over at once on
// roughly one tick in seven. So a line holds for a beat before it may be
// replaced. This is a floor, not a cadence — a cat that genuinely sleeps for
// twenty seconds simply keeps its line, and nothing moves.
// Note that this quantises: lines only ever change on a tick edge, so the dwell
// rounds up to a whole number of ticks. At an 800ms tick, 1700 / 2000 / 2400 all
// behave identically, and so do 400 / 800. The dial has about five positions,
// not a range — measured on 150 replayed server frames, the rungs run
// 1 tick 89% of lines correct at 1.91 writes/s · 2 ticks 81% / 1.52 ·
// 3 ticks 70% / 1.33 · 4 ticks 62% / 1.06 · 5 ticks 56% / 0.90.
// If this ever reads as too busy, 2000 is the agreed fallback — it drops to the
// 3-tick rung, a third quieter, at the cost of eleven points of accuracy.
const DWELL = 1500;
// unless it did something categorically different, which is worth showing sooner
const DWELL_MAJOR = 1500;
// and no more than this many lines may turn over on any one tick. This is also
// a floor on how often a line may change: four cats round-robin at
// (4 / PER_TICK) x tick, so any DWELL below 1600ms here can never bite.
const PER_TICK = 2;

// The direction a cat wandered is noise to a reader — it changes every tick and
// means nothing. The world still says it; the page just does not repeat it.
const tidy = (act) => act.replace(/^wanders\s+(north|south|east|west|off)$/, 'wanders');

const CLASSES = [
  [/^(naps|sleeps|settles)/, 'sleep'],
  [/^(eats|drinks)/, 'feed'],
  [/^(grooms|cuddles|washes)/, 'social'],
  [/^(plays|pounces|chases|follows)/, 'play'],
  [/^wanders/, 'move'],
];
function classOf(act) {
  for (const [re, name] of CLASSES) if (re.test(act)) return name;
  return 'idle';
}

const rows = new Map();
let shownTick = null, shownPhase = null;

function readOut() {
  const now = performance.now();

  const tick = fmtTick(world.tick);
  // Roster lines are only allowed to change on this edge. A line turning over
  // while the counter sits still reads as unrelated motion — two things moving
  // to different clocks. Tied to the tick, the whole block advances as one
  // moment and is then still, which is far quieter for the same information.
  const tickMoved = tick !== shownTick;
  if (tickMoved) { el.tick.textContent = tick; shownTick = tick; }
  const phase = phaseFor(world.tick);
  if (phase !== shownPhase) { el.phase.textContent = phase; shownPhase = phase; }

  const seen = new Set();
  const queue = [];
  world.kitties.forEach((k, i) => {
    seen.add(k.id);
    let row = rows.get(k.id);
    if (!row) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const act = document.createElement('span');
      name.className = 'name';
      act.className = 'act';
      li.append(name, document.createTextNode(' '), act);
      li.addEventListener('mouseenter', () => { hoverFromList = k.id; });
      li.addEventListener('mouseleave', () => { hoverFromList = null; });
      // Stagger where each cat sits in its dwell, so the four lines never turn
      // over on the same beat. Four lines changing together reads as the page
      // refreshing; the same number of changes, spread out, reads as four cats.
      row = { li, name, act, shownAct: '', shownAt: now - DWELL * ((k.id * 0.618) % 1) };
      rows.set(k.id, row);
    }
    if (row.name.textContent !== k.name) row.name.textContent = k.name;

    const want = tidy(k.act);
    if (want !== row.shownAct) {
      const held = now - row.shownAt;
      const major = classOf(want) !== classOf(row.shownAct);
      const ready = held >= DWELL || (major && held >= DWELL_MAJOR);
      // the first line for a cat is written straight away; after that it queues
      if (!row.shownAct) {
        row.act.textContent = want;
        row.shownAct = want;
        row.shownAt = now;
      } else if (ready) {
        queue.push({ row, want, held });
      }
    }

    if (el.roster.children[i] !== row.li) el.roster.insertBefore(row.li, el.roster.children[i] ?? null);
  });

  // At most PER_TICK lines turn over per tick, and only on the tick. Tying
  // changes to the tick alone still let three land on the same beat, because
  // quantising onto 1.25 instants a second bunches them up. Capping spreads
  // them back out, and the cats kept waiting longest go first, so the queue
  // drains fairly rather than favouring whoever sits at the top of the roster.
  //
  // The cap is itself a floor on how often a line may change: with four cats
  // all wanting to move, they round-robin, so each line rests
  // (4 / PER_TICK) x 800ms. Any DWELL below that never gets to bite.
  if (tickMoved && queue.length) {
    queue.sort((a, b) => b.held - a.held);
    for (const next of queue.slice(0, PER_TICK)) {
      next.row.act.textContent = next.want;
      next.row.shownAct = next.want;
      next.row.shownAt = now;
    }
  }

  for (const [id, row] of rows) {
    if (seen.has(id)) continue;
    row.li.remove();
    rows.delete(id);
  }
}

el.roster.replaceChildren();
readOut();
const readOutTimer = setInterval(readOut, POLL);

/* ── run ─────────────────────────────────────────────────────────── */

function frame(now) {
  running.id = requestAnimationFrame(frame);
  draw(now);
}

function start() {
  if (running) return;
  last = performance.now();
  if (CALM.matches) {
    // no per-frame animation: redraw on the tick instead, so the meadow
    // reads as a slow sequence of stills rather than a moving picture
    draw(performance.now());
    running = { kind: 'timer', id: setInterval(() => draw(performance.now()), TICK_MS) };
    return;
  }
  running = { kind: 'raf', id: 0 };
  running.id = requestAnimationFrame(frame);
}

function stop() {
  if (!running) return;
  if (running.kind === 'timer') clearInterval(running.id);
  else cancelAnimationFrame(running.id);
  running = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop(); else start();
});

CALM.addEventListener('change', () => { stop(); start(); });
NARROW.addEventListener('change', measure);

window.addEventListener('pagehide', () => {
  stop();
  clearInterval(readOutTimer);
  disconnect();
});

start();
