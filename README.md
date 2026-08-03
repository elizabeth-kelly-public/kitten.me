# kitten.me

A meadow with four cats in it. The page is a window onto a world that keeps
running whether or not anyone is looking at it.

Built from the design doc *Kitten.me landing page*, composition **1b** — the
specimen plate: the world is an object sitting on paper, the paper is what
changes colour, and the only large thing on the page is a number.

## Files

| | |
|---|---|
| `index.html` | the page — one window, one tick, one roster |
| `styles.css` | composition 1b, collapsing to the 1e phone layout at 820px |
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

**Roster lines must fit on one line.** The reading column is bottom-aligned
against the window, so a wrapped row grows the block upward and jumps the tick
number by a full line — very visible at 62px. The column is `16rem` (256px) and
the widest line the world can produce is `Kittybear chases something small` at
230px, leaving 26px of headroom. `sleeps in the tall grass` was shortened to
`sleeps in the grass` for the same reason: it was the only one of 188 possible
name/phrase combinations that overflowed, and at night every cat says it. If
you add a phrase or the server sends a longer name, check it against that
budget — 35 characters at 12px IBM Plex Mono, whose advance is 0.6em.

One scale note, since it is easy to be caught out by: `og.png` draws a cat at
134px, because the card is 1200px wide showing 12 tiles. The live window is
640px showing the same 12 tiles, so cats land near 68px, and about 48px when
the camera caps on a scattered group. The markings are tuned to stay legible at
that smaller size rather than to look their best in the card.

## The social card

`og.png` is a frozen frame — golden hour, the fixed pose, tick 306 — because
the card should be the same picture every time it is unfurled. Regenerate it
by opening `og.html` and clicking through, or server-side once a day if you
want it to age.
