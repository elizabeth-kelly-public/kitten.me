# kitten.me

A list of things currently holding my attention. The first is a meadow with
four cats in it — a window onto a world that keeps running whether or not
anyone is looking at it.

Each project is a plate: supporting text on the left, its visual on the right.
The plate comes from the design doc *Kitten.me landing page*, composition
**1b** — the world is an object sitting on paper, the paper is what changes
colour, and the only large thing in the block is a number.

## Files

| | |
|---|---|
| `index.html` | the page — a heading and a list of project blocks |
| `styles.css` | the plate, collapsing to one column at 820px |
| `site.js` | keeps the world ticking, draws it, drives the palette |
| `meadow.js` | the world: live client, local fallback simulation, canvas rendering |
| `og.html` | generator for the social card |
| `og.png` | the social card, frozen at golden hour |

No build step and no dependencies. It is static files — serve the directory.

```
python3 -m http.server 8787
```

## How it runs

`meadow.js` connects to `wss://kitties.ai/ws` and renders whatever the server
says. If the socket fails, times out, or is blocked, it falls back to a local
simulation seeded to look like the same meadow, and the dot beside the phase
stops pulsing. Either way the page looks identical; only the dot tells you.

The day is 600 ticks, about ten minutes, in four phases — day, golden hour,
night, dawn. Every colour on the page comes from `paletteAt()` in `meadow.js`,
applied to `:root` as custom properties, so the paper, the ink, the accent and
the canvas all move together. Colours crossfade over the last 46 ticks of a
phase, except paper and ink, which invert and so snap across a shorter window
to avoid passing through mud.

Hover a cat for its name. Hovering a roster row does the reverse and names it
in the window.

## Notes on the source design

Three things were changed against the design doc, all in `meadow.js`:

**Cats were drawn in the wrong coordinate space.** `drawCat` positioned cats at
`k.x * tile * 1.34` while the ground, bushes, bowls, camera and `hitTest` all
used `k.x * tile`. Cats drifted off the sunbeams they were supposedly napping
in, escaped the frame the camera had fitted for them, and landed 66–175px from
where `hitTest` was watching — against a 39px hit radius, so hovering a cat
never once worked. Position now uses the tile grid; `s` is still the drawing
scale, so cats are the same size as before.

**The camera had no zoom ceiling.** `across: 12` was tuned against the 18×11
local fallback. The live world is 24×24 and the cats routinely sit 15 tiles
apart, so the fit zoomed out until they were 24px specks in a field of
shrubbery. `maxAcross` caps it at 1.5× nominal, which holds a cat at ~48px at
worst. Past that ceiling the camera aims at the cat nearest the centre of mass
rather than the midpoint of the bounding box — which, when the group is
scattered, is the one place nobody is standing. A wanderer now sometimes sits
outside the window; the roster still accounts for everyone.

**The server does not tick at `TICK_MS`.** It runs nearer 800ms and jitters
between roughly 730 and 840. `TICK_MS` is 1000, so interpolating over it meant
a cat travelled only 80% of the way to its next position before the frame
landed and it snapped the rest — a stutter on every cat, more than once a
second, on 40 of 41 sampled frames. `site.js` now measures the gap between
server frames and follows that instead. Do not "simplify" it back to a
constant. Biasing the window shorter to finish early is also worse, not
better: the cats stop and restart, and stop-start reads as choppier than a
slight overshoot.

**The counter is polled; the roster is paced.** These are two different kinds of
information and they need different treatment. The tick is a counter — its job
is to be countable, so it is read every 200ms and written whenever it changes,
and it tracks the world exactly. Reading it on a 1000ms timer against an 800ms
world made every fourth read catch two ticks, so a correct sequence looked like
it was skipping.

The roster is prose, and prose carries no ordinal expectation — nobody can tell
whether a sentence is 0.8s or 2s old. It needs pacing, because the world changes
far faster than anyone can read: 68% of lines survive a single tick, 2.7 text
changes a second, and all four lines turned over together on one tick in seven.
Three rules calm it without touching the counter:

- lines change only on a tick edge, so the block advances as one moment rather
  than to a second clock of its own;
- at most `PER_TICK` lines change per tick, longest-waiting first, so the queue
  drains fairly and no line is starved;
- a line rests at least `DWELL` before it may be replaced.

Two properties are worth knowing before tuning. The **cap is itself a floor**:
four cats round-robin at `(4 / PER_TICK) x tick`, so any dwell below that can
never bite. And the **dwell quantises** — changes only happen on tick edges, so
it rounds up to whole ticks, and 1700 / 2000 / 2400 are the same setting. The
dial has five positions, not a range.

Shipped at `PER_TICK 2`, `DWELL 1500`: 81% of lines correct at any instant, mean
lag 0.17s, worst case 1.6s, 1.5 writes/s, never more than two lines at once.
Unconstrained would be 100% correct at 2.4 writes/s, with three or four lines
turning over together on a third of ticks — which is information a reader cannot
take in anyway. `DWELL 2000` is the fallback if it reads as too busy.

**The tail flicks; it does not wag.** The first version ran a continuous sine at
fixed amplitude on one frequency for every cat, varying only the phase, so four
tails beat together and none of them ever rested — in motion 81% of the time.
It now bursts: quiet for most of a cycle, then one flick, on a tempo that
differs per cat. Measured share of time in motion is 11% active, 7% resting.
The curve is a cubic rather than a quadratic because two control points are the
least it takes to hold two phases at once, which is what lets the motion travel
from the base out to the tip instead of the whole tail pivoting at once. The
root rides the body radii, so it follows the loaf and standing shapes.

**The camera used to cut.** It had a rule that snapped instantly when the
target moved more than 7 tiles. That was survivable when the target was the
midpoint of the group, but once the zoom ceiling made it follow whichever cat
was most central, the target began jumping between cats and the rule fired
several times a minute as a hard cut. The snap is now first-frame only, the
anchor cat is sticky until another is 1.5x more central, and the easing rates
are rescaled by real frame time so a 120Hz display does not ease twice as fast
as a 60Hz one.

**The mat is paper, not white.** The `inset ... rgba(255,255,255,.5)` ring in
the doc sat behind the canvas and never rendered. Drawn properly it ringed the
night window in a bright frame, so it is now a translucent tint of the current
paper colour and stays quiet in every phase.

## Art direction

The doc paired each composition with its own cat vocabulary so the two could be
judged at once — 1b got `ink`, the OG card got `soft`. That was a device for the
study, not a constraint on what ships, and the page uses **`soft`** everywhere.
The reason is not taste: the roster names four cats as individuals, and `ink`
draws all four as the same pale wash inside heavy black outlines, so only the
tail and ear silhouette tell them apart. In `soft` the coats do that work and
the window agrees with the text beside it. `soft` also survives the night
inversion better than expected — `ink` flips every outline to near-white and
turns the four into the same ghost.

The tabby markings are **mackerel**: four ribs off the spine, swept back toward
the tail and tapering, clipped to the body silhouette. The doc's original
markings were arcs struck from a centre inside the body, so they bowed the
wrong way and nested into each other — closer to a curl than a stripe. The
direction of the stroke is the whole difference.

**Roster lines must fit on one line.** The column is `16rem` (256px) and the
widest line the world can produce is `Kittybear chases something small` at
230px, leaving 26px of headroom. `sleeps in the tall grass` was shortened to
`sleeps in the grass` for the same reason: it was the only one of 188 possible
name/phrase combinations that overflowed, and at night every cat says it. If
you add a phrase or the server sends a longer name, check it against that
budget — 35 characters at 12px IBM Plex Mono, whose advance is 0.6em.

This mattered more when the reading column was bottom-aligned against the
window, as 1b specifies: a wrapped row grew the block upward and jumped the
62px tick by a full line. The list layout top-aligns the two columns instead,
so a wrap now pushes downward and the tick holds still. Worth keeping the lines
short regardless — the rows below a wrap still shift once a second.

One scale note, since it is easy to be caught out by: `og.png` draws a cat at
134px, because the card is 1200px wide showing 12 tiles. The live window is
640px showing the same 12 tiles, so cats land near 68px, and about 48px when
the camera caps on a scattered group. The markings are tuned to stay legible at
that smaller size rather than to look their best in the card.

## Adding a project

Copy one `<li class="project">` block in `index.html` and change the title line
and the body. Nothing else needs touching: the rule and the spacing between
blocks come from a `.project + .project` selector, so they appear only once
there are two, and a single project still sits on the page as if there were no
list at all.

The body is a two-column grid — `.reading` on the left, `.project-visual` on
the right — that collapses to one column below 820px with the visual leading.
The visual can be anything; only the cats carry a live canvas. If you drop in a
plain `<img>`, keep the `.window` class for the frame and mat, or leave it off
for something that should sit flat on the paper.

Two things are wired specifically to the cats and would need generalising if a
second project wanted them: `site.js` looks up `#meadow`, `#tick`, `#phase`,
`#source` and `#roster` by id, and the palette that drives the whole page comes
from the meadow's clock. A second project inherits those colours whether or not
it has anything to do with cats.

## The social card

`og.png` is a frozen frame — golden hour, the fixed pose, tick 306 — because
the card should be the same picture every time it is unfurled. Regenerate it
by opening `og.html` and clicking through, or server-side once a day if you
want it to age.
