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

## Baseline (game build of 2026-11-23, plus node ownership phases 1 to 4d)

| Test | Kind | Result |
|---|---|---|
| t83 uniques (40 since phase 4d; the strongholds give their leaders' pieces) | node | pass |
| t84 spell weapon share | node | pass |
| t85 node ownership (phase 1) | node | pass |
| t86 one faction at a time, rival markups, Banner capital (phase 2) | node | pass |
| t87 the two new Moot claimants (the Long Ledger, Archon Ilvane) | node | pass |
| t88 relations between factions: drift, wars, alliances, the council, levers, ideals (phase 3a) | node | pass |
| t89 supply and garrisons: supply paths, isolation stages, defection, regrowth (phase 3b) | node | pass |
| t90 AI attacks: marching, the muster and margin, war weariness, the defender's answer, redeployment, warning, cooldown, settling, armies moving in, stepping in, overextension, rallying at home, suing for terms (phase 3c) | node | pass |
| t91 sieges: stages by place type, a roll per stage, stepping in at a stage, the last stand, the capital rule, wiping a faction out (phase 3d) | node | pass |
| t92 human unification: the Moot's coronation, war victories (alone, with an ally, with the Hearthwatch), flavours, places and capitals, standing carried over, ranks ending, the hand-over, closed quest chains, old saves (phase 4a) | node | pass |
| t93 the realm's policy dials: taxes on its shops, patrols and road fights, the toll posts, magic law on apprentices, hedge-mages and the boards, war posture; the boards' hand-over to the realm's land (phase 4b) | node | pass |
| t94 the realm's plotters: cells, finding (rumours, the realm's contract, informers) and clearing them, the reveals, the clock, the rising, the stronghold (shown, foiled, crushed), old saves, sync; the core and flavoured beats (phase 4c) | node | pass |
| t95 the player's wars: ordering an attack, the motion against the Hearthwatch, the Hearthwatch never an AI target, the Priory as its capital, its fall and the refuges, capital gear, the plotters' leaders' pieces, sync, the united realm (phase 4d) | node | pass |
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
| tmap | browser | pass (flaky: a click sometimes times out; rerun) |
| tparty_ui | browser | 2 fail: the outnumbered warning in the briefing |
| thud the full-screen battle HUD, portrait and landscape: no page scrolling, panels on screen, zoom, pan, rotate, skill lists, the ⋯ menu | browser | pass |
| tstatus the Status and Equip screens, portrait and landscape: fit with no scrolling, item icons, tap to select then tap to edit, long press details, the equip preview, Equip, Remove, Best gear, paging | browser | pass |
| tclasses the class tree, portrait and landscape: fit with no scrolling, ? ? ? for classes out of reach, silhouettes, requirement lines, the detail panel, set primary or secondary, long press for the kit, paging, Rename from the name | browser | pass |
| tvictory the victory screen after a real campaign fight, portrait and landscape, plus a defeat: fit with no scrolling, spoils, greatest contribution (kills and damage), XP bars, level-ups with HP gain, newly learnable skills, long press, Status from a unit, Reports, Continue | browser | pass |
| t86ui phase 2 screens | browser | pass |
| t88ui the realm on the Factions tab, speaking in council, the council scene (phase 3a) | browser | pass |
| t89ui the garrison and a cut-off line on the place sheet (phase 3b) | browser | pass |
| t90ui the contested ring, the threat card, stepping in for either side (phase 3c) | browser | pass |
| t91ui a siege's stages on the place sheet, the last stand's briefing (phase 3d) | browser | pass |
| t92ui the opening scene and the oath, the realm's colour on the map, the Factions tab after the union (phase 4a) | browser | pass |
| t93ui the dials in words on the Factions tab, recruit prices per class on the Recruit sheet (phase 4b) | browser | pass |
| t94ui the Plotters lines on the Factions tab, a cell's scene at its place and its fight (phase 4c) | browser | pass |
| t95ui Order an attack and Move against the Hearthwatch on the Factions tab, a refuge's shelter after the fall (phase 4d) | browser | pass |

The failing checks look like tests that are older than the game build. They have not been changed.

With `ARENA=1`, `C.validate()` lists 30 arena fights with unknown maps: the arena maps are not in the loader list. This was so before phase 1.

Not copied yet from the Project: t10 to t82 and the sims (smoke, bal, simrun, trapsim, shapesim, shot, shotsim, ai_vs, ai_usage, unused, story_serve).
