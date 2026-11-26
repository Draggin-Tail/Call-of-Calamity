# Call of Calamity

A tactics game for phones, written in plain JavaScript with no build step.

## Layout

- `game/`: the playable build. Open `game/index.html`, or serve the folder.
  - `game/data/*.js` holds the rules and content. Each file adds to globals: `GAME_DATA`, `GAME_CAMPAIGN`, `GAME_SAVE`, `GAME_LOADOUT`, `GAME_TRIGGERS`.
  - The campaign (`GAME_CAMPAIGN`) is split across five files, loaded in this order: `regions.js` (race lands, territory outlines), `places.js` (every node), `roads_gen.js` (the road network), `encounters.js` (fights, choices, patrols, events, dungeons) and `campaign.js` (the rules; it loads last and publishes `GAME_CAMPAIGN`). Read only the file you need. A new campaign file must be added to `game/index.html` and to the list in `tests/real_ld.js`.
  - `game/shell.js` is the campaign UI. `game/story_screens.js` holds the story screens.
- `tests/`: Node and Playwright tests. See `tests/README.md` for how to run them and the current baseline.

## Design docs

Design docs live in the claude.ai Project "Tactics Game" (`design/*.md`), not in this repo. The Project also holds older copies of game code. Those copies are stale; this repo is the source of truth for code.

## Working rules

- Big changes go in phases. Stop after each phase for review, and don't start the next one until told.
- Decisions recorded in a design doc are agreed. Don't reopen them.
- Don't decide anything listed under "Open questions" in a design doc. Ask.
- If the code and a design doc disagree, tell the user before changing either.
- Keep old saves loading. Add a migration in `GAME_SAVE.repair` when the save shape changes.
- Run the tests before and after a change. A test that fails on the baseline is reported, not silently edited.

## Running tests

```
cd tests
node tfight.js | grep -v ^PASS
node serve.js &   # for browser tests
NODE_PATH=$(npm root -g) node tmap.js
```
