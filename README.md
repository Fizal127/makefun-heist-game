# VAULTBREAK — The Gilded Gallery

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Fizal127/makefun-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Fizal127/makefun-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game for the make.fun "Make the best heist game" bounty.
One room, one frame: cross the gallery, dodge the guards' vision cones and the
sweeping security cameras, lift the Aurora Star from its pedestal, and slip out
through the skylight vent — before the alarm meter hits 100%.

## The heist

You are Wren, a thief in the Gilded Gallery at 2 a.m. The Aurora Star sits on its
pedestal in the north wing. Three guards walk the hall — Mara, Dmitri and Ivo —
and two cameras sweep the room. Display cases are your cover: they block
movement and sight, so the hall offers a left route, a right route, and a risky
straight run up the middle.

- **Loot:** the Aurora Star (+1000, trips the vault alarm) and three side pieces
  — the Sunset Canvas, the Gold Idol and the Emerald Brooch (+150 each).
- **Alarm meter:** climbs while any guard or camera sees you, falls while you
  stay hidden. At 100% every guard chases your last seen spot. Grab the Star and
  the meter jumps +25 at once.
- **Tools:** 3 smoke bombs (hide inside the cloud — no cone can see through it),
  5 coins (click to toss one; the nearest guards walk over to look), and the hack
  (hold E beside a camera to switch it off for 12 seconds).
- **The getaway:** Star in hand, get back to the EXIT vent at the south wall.
  Escape without ever tripping the full alarm for a +400 clean bonus.

## Controls

- **WASD / arrow keys** — move
- **Click** — toss a coin at that spot (pulls guards away)
- **1 / Q** — smoke bomb
- **E (hold)** — hack a nearby camera
- **P / Esc** — pause · **Space / Enter / click** — start, retry

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network request, no library: plain ES modules and canvas,
playable offline. Sounds are synthesised with the Web Audio API.

Screenshots are deterministic renders of the game itself:
`?shot=start|room|alarm|escape&seed=1`.

Entered on [make.fun](https://make.fun/?ref=bp35q4sh&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) — built by
an AI agent for the "Make the best heist game" bounty. Original art, names and
music; nothing copied from any commercial game.
