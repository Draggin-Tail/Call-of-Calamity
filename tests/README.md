# Tests

All tests run from this folder with Node 22. They load the game from `../game` (set `GAME_DIR` to use another copy).

## Node tests (no browser)

```
cd tests
node tbench.js | grep -v ^PASS
```

Each prints `PASS`/`FAIL` lines and ends with `ALL PASS` (or `ALL OK`), or a count of failures.

- `real_ld.js` loads the real game files into a fake `window` and returns it. Env switches: `NOGOLD=1`, `NOLOOT=1` leave out the gold and loot layers; `ARENA=1` adds the arena.
- `stub_ld.js` is the older stand-in loader some tests use via `LD=./stub_ld.js`.
- `tjp.js` loads only `classes`, `abilities` and `gamestate` with `vm`.

## Browser tests (Playwright)

Start the server, then run the test:

```
node serve.js &            # serves ../game on http://localhost:8766
NODE_PATH=$(npm root -g) node tparty_ui.js
```

`tload.js` starts its own server, so stop `serve.js` first. `GAME_URL` overrides the page address.

## Baseline (game build of 2026-11-23, plus node ownership phases 1 and 2)

| Test | Kind | Result |
|---|---|---|
| t83 uniques | node | pass |
| t84 spell weapon share | node | pass |
| t85 node ownership (phase 1) | node | pass |
| t86 one faction at a time, rival markups, Banner capital (phase 2) | node | pass |
| t87 the two new Moot claimants (the Long Ledger, Archon Ilvane) | node | pass |
| t88 relations between factions: drift, wars, alliances, the council, levers, ideals (phase 3a) | node | pass |
| t89 supply and garrisons: supply paths, isolation stages, defection, regrowth (phase 3b) | node | pass |
| t90 AI attacks: marching, the muster and margin, war weariness, the defender's answer, redeployment, warning, cooldown, settling, armies moving in, stepping in (phase 3c) | node | pass |
| tbands | node | pass |
| tbench | node | pass |
| tfight | node | pass |
| tgold | node | pass |
| tjp | node | 2 fail: Tier 2 unlock range, Tier 3 gate split |
| tloot | node | pass |
| tmaps | node | pass |
| tparty | node | pass |
| tdungeon | browser | pass |
| tledge | browser | pass |
| tload | browser | pass |
| tmap | browser | pass |
| tparty_ui | browser | 2 fail: the outnumbered warning in the briefing |
| t86ui phase 2 screens | browser | pass |
| t88ui the realm on the Factions tab, speaking in council, the council scene (phase 3a) | browser | pass |
| t89ui the garrison and a cut-off line on the place sheet (phase 3b) | browser | pass |
| t90ui the contested ring, the threat card, stepping in for either side (phase 3c) | browser | pass |

The failing checks look like tests that are older than the game build. They have not been changed.

With `ARENA=1`, `C.validate()` lists 30 arena fights with unknown maps: the arena maps are not in the loader list. This was so before phase 1.

Not copied yet from the Project: t10 to t82 and the sims (smoke, bal, simrun, trapsim, shapesim, shot, shotsim, ai_vs, ai_usage, unused, story_serve).
