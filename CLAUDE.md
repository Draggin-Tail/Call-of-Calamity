# Call of Calamity

A tactics game for phones, written in plain JavaScript with no build step.

## Layout

- `game/`: the playable build. Open `game/index.html`, or serve the folder.
  - `game/data/*.js` holds the rules and content. Each file adds to globals: `GAME_DATA`, `GAME_CAMPAIGN`, `GAME_SAVE`, `GAME_LOADOUT`, `GAME_TRIGGERS`.
  - The campaign (`GAME_CAMPAIGN`) is split across five files, loaded in this order: `regions.js` (race lands, territory outlines), `places.js` (every node), `roads_gen.js` (the road network), `encounters.js` (fights, choices, patrols, events, dungeons) and `campaign.js` (the rules; it loads last and publishes `GAME_CAMPAIGN`). Read only the file you need. A new campaign file must be added to `game/index.html` and to the list in `tests/real_ld.js`.
  - `game/shell.js` is the campaign UI. `game/story_screens.js` holds the story screens.
- `tests/`: Node and Playwright tests. See `tests/README.md` for how to run them and the current baseline.

## Where things live

- **Code: this repo.** It is the only source of truth for game code and tests. Older homes are stale and must not be edited or published to: the code copies in the claude.ai Project (`game/`, `tests/`, `tools/`) and the old "Call of Calamity" artifact.
- **Design docs: the claude.ai Project "Tactics Game"** (`design/*.md`). They are not in this repo, and must not be copied into it. The user cannot open Project files (they can only delete them), so every doc change is made by Claude.
  - Start with `design/dev_notes.md` for gotchas and which tests cover what. Its paths are written for the repo.
  - To change a doc: `project_read` it in full, edit a local copy (a folder listed in `.git/info/exclude`, never committed), then `project_write` with `local_path`. A write to an existing path is refused without that read.
  - When a phase of a design doc is built, update that doc's status line and its knock-on checklist, and record any decisions made while building.
- Coding can happen in any session in the Project, including chats started from the Project, as long as the session attaches this repo first (add `Draggin-Tail/Call-of-Calamity` with the add-repo tool, then clone it). Check for the repo before touching code.
- If a session can't reach the repo, it must not edit or publish the Project's old code copies. It can still work on design docs, or write the code change as a plan for the next session that has the repo.

## Git and pull requests

- Work on a branch, never on `main`. One PR per phase or task.
- Push with `git -c push.negotiate=true push -u origin <branch>`.
- `gh pr create` fails here (no GraphQL access). Use the REST API instead:
  `gh api repos/Draggin-Tail/Call-of-Calamity/pulls -f title='...' -f head=<branch> -f base=main -F body=@body.md`
- Merge only when the user says so:
  `gh api -X PUT repos/Draggin-Tail/Call-of-Calamity/pulls/<n>/merge -f merge_method=merge`
- End each session's report with the PR link and what the user should review.

## Working rules

- Big changes go in phases. Stop after each phase for review, and don't start the next one until told.
- In progress: `design/node_ownership_and_land.md`. Phases 1 and 2 are built. Phase 3 is split into 3a (relations), 3b (supply), 3c (AI attacks) and 3d (sieges); 3a is built in `game/data/relations.js`, 3b in `game/data/supply.js`, 3c in `game/data/attacks.js` (with its anti-snowball rules: overextension, rallying at home, suing for terms), and 3d (sieges, wiping a faction out) in the same file. Phase 4 (human unification) is split into 4a to 4d; 4a (the unification routine and the new faction template) is built in `game/data/unification.js`. 4b (the policy dials: taxes, patrols, magic law, war posture) is built in `game/data/policy.js`. 4c (the antagonists' cells and strongholds, the rising, the core and flavoured beats) is built in `game/data/plots.js`. 4d (ordering attacks, the move against the Hearthwatch, its fall and refuges, capital gear) is built in `game/data/conquest.js`. Each step waits for the user.
- Decisions recorded in a design doc are agreed. Don't reopen them.
- Don't decide anything listed under "Open questions" in a design doc. Ask.
- Ask the user for decisions with the question tool (multiple choice, recommended option first), not in plain text.
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
