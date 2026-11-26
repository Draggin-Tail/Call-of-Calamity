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

## Baseline (game build of 2026-11-23)

| Test | Kind | Result |
|---|---|---|
| t83 uniques | node | pass |
| t84 spell weapon share | node | pass |
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

The failing checks look like tests that are older than the game build. They have not been changed.

Not copied yet from the Project: t10 to t82 and the sims (smoke, bal, simrun, trapsim, shapesim, shot, shotsim, ai_vs, ai_usage, unused, story_serve).
