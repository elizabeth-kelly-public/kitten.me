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
    // the server ticks once a second; interpolate between the last two frames
    alpha = clamp01((now - world.stamp) / TICK_MS);
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

const rows = new Map();

function readOut() {
  el.tick.textContent = fmtTick(world.tick);
  el.phase.textContent = phaseFor(world.tick);

  const seen = new Set();
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
      row = { li, name, act };
      rows.set(k.id, row);
    }
    if (row.name.textContent !== k.name) row.name.textContent = k.name;
    if (row.act.textContent !== k.act) row.act.textContent = k.act;
    if (el.roster.children[i] !== row.li) el.roster.insertBefore(row.li, el.roster.children[i] ?? null);
  });

  for (const [id, row] of rows) {
    if (seen.has(id)) continue;
    row.li.remove();
    rows.delete(id);
  }
}

el.roster.replaceChildren();
readOut();
const readOutTimer = setInterval(readOut, 1000);

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
