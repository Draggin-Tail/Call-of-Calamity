# Call of Calamity

A tactics game for phones, written in plain JavaScript with no build step.

## Layout

- `game/`: the playable build. Open `game/index.html`, or serve the folder.
  - `game/data/*.js` holds the rules and content. Each file adds to globals: `GAME_DATA`, `GAME_CAMPAIGN`, `GAME_SAVE`, `GAME_LOADOUT`, `GAME_TRIGGERS`.
  - `game/data/campaign.js` is the largest file (world map, nodes, encounters, rules). Read the parts you need, not the whole file.
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
