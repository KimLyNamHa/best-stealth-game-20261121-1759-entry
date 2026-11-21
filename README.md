# Wren — Night Courier

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/KimLyNamHa/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/KimLyNamHa/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Built for the [make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759) bounty
"Make the best stealth game".

An original top-down stealth game that plays offline in a desktop browser
from static files — no network requests, no libraries, keyboard and mouse.
You are Wren, a night courier slipping through three guarded grounds after
dark. All art is drawn as original vector art in code, and all sound is
WebAudio tones, so there are no asset files at all.

## How it plays

- **Move** with WASD or the arrow keys. Hold **Shift** to sneak: slower,
  but silent and half as easy to spot.
- **Guards** patrol fixed routes with vision cones. Stand inside a cone
  in line of sight and the detection meter fills — faster up close, slower
  while you sneak or stand in shadow. Over 35 a guard stares at you, over
  70 it gives chase, at 100 you are caught and the level restarts.
- **Running makes noise**: guards nearby turn toward the sound.
- **Cover**: crates and walls block sight, bushes hide you completely
  while you are inside one, shadows halve detection.
- **Goal**: reach the glowing exit gate unseen. Each level hides three
  moonstones as optional loot.
- **Levels**: 1. The Garden Wall (2 guards, wide paths), 2. The Lantern
  Court (4 guards and a dog that hears running), 3. The Vault of Bells
  (6 guards and two rotating searchlights).
- **Keys**: R restarts the level, M mutes, Enter starts and plays again.
  Clicking a spot on the floor walks Wren there.

## Running it

Open `game/index.html` in a desktop browser — that is all. No build step,
no server, no network.

The screenshots in `screenshots/` are real renders of the game running in
headless Chrome (one per level, plus the victory screen); the first by
name is the cover. `main.ts` hands the game in: it copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored make.fun library.
