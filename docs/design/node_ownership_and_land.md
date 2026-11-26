# Node ownership and race lands (design brainstorm, v12)

Status: design only, nothing built. Supersedes the region-based faction ownership in `world_layout_v3.md`. Builds on `world_map_and_faction_war.md` (hybrid war resolution, telegraphing, anti-snowball), `succession_moot.md` (Moot outcomes, Kingmaker hold) and `human_factions.md` (rivalry table).

Changes since v11: the Hearthwatch keeps its Moot vote; a Corisande win gives the new faction a Hearthwatch flavour; the new faction is built from **one template with flavours** (new section 11, a draft).

## The change in one line
Regions stop meaning "who owns this" and start meaning "what this land is." Ownership lives on every node, so it can flow with events, wars and the player's actions.

## What exists today (so we change as little as needed)
- Nodes already carry an `owner` in state (`C.ownerOf`); shops, recruiting, boards and standing key off it.
- Region `faction` currently decides who patrols the roads; territory polygons are tinted by owning faction.
- Exceptions already break region = faction: Syndicate enclaves in orc country (Greywater Landing, Stilt Market), Banner camps (Outlaw's Rest, Widow's Barrow, Heron Hide), Hearthwatch chapels, Moot place flips, the Kingmaker hold (`owner: player`).
- Relations already exist as symmetric pairs with `relationOverrides` and `shiftRelation`.

## Decisions (agreed)

### 1. Land vs ownership
- **Region = race land.** Keeps painted art, terrain, danger, zoom view and battle-map terrain. The four human territories (Crownlands, Marches, River Cities, Vol'Dun) merge into one **human land**. Other races keep their land.
- **Node = ownership.** Every node has an owner faction and a garrison strength.
- **Every node type can be owned**: capitals, castles, markets, towns, villages, hamlets, POIs, zones, roads, dungeons. Neutral ground (wilderness, outlaws, monsters) is a valid owner value.
- Region no longer decides road patrols; the owner of the nearby nodes does.

### 2. Capitals
- **Every war faction has a capital.** That includes the Banner. Proposal: promote its anchor, Outlaw's Rest. This changes the "No capital" line in `human_factions.md`.
- **A capital can only be attacked when the faction holds no other node.** Until then it cannot be besieged. The attacker has to flip every other node the faction owns, including roads, POIs and enclaves in other lands.
- **Rebuilding is allowed.** A faction down to its capital can retake a node and become unsiegeable again. We accept that cat-and-mouse; the AI's attack constraints (section 6) are what keep it fair.
- **Losing the capital wipes the faction out.** It is gone as a war participant, its nodes are gone, and it cannot be rebuilt by ordinary play. This replaces the earlier "factions cannot be wiped out" rule.
- **Capturing a capital gives that faction's unique gear** (gear only that faction can supply). Gear the player already owns stays when a faction is wiped or absorbed.
- Supply (section 4) is anchored on the capital, but a faction down to its capital has no other nodes to starve.
- The capital is the hardest siege in the game (section 5), with named defenders.
- **The Hearthwatch is the exception** (section 10): AI factions cannot touch it, and only the player's faction can conquer it.

### 3. Cross-race conquest is core
- Any faction can take nodes in any land.
- **A conquered node switches entirely to the owner's race**: recruits, shop stock, race traits on units and boards follow the new owner. Terrain, battle maps and region art stay with the land.
- **Node-bound NPCs relocate** to the nearest node still held by their original side (their capital if none). Their node quests become "retake my home" hooks, so conquest feeds story rather than deleting it.

### 4. Supply and isolation
- A node is **connected** if there is a path to its owner's capital through nodes held by the owner or an ally. Neutral and enemy nodes break the path.
- Recomputed only when ownership changes, then cached.
- **Isolation ramps up over time**, not instant decay. Per-node counter rises daily while disconnected; stages: thinner shops, shrinking garrison, defection risk. Reconnecting drains it slowly.
- Tuning warning: roads and POIs are one-battle captures, so cutting a road is the cheapest way to starve a node. The ramp must be slow enough that one raid cannot collapse a region.
- **Enclaves need an exemption** (trade route or port link) or the Syndicate's holdings inside orc land decay at once.
- **Hearthwatch nodes are exempt** from isolation while neutral. If the player's faction allies with it, supply runs through its nodes like any ally's.

### 5. Capture: siege depth scales with node type
| Node | How it is taken |
|---|---|
| Hamlet, tiny village | One easy garrison battle |
| Village, market, town | Two stages: outer defence, then a hold-out |
| Castle | Three stages: walls, gate, keep |
| Capital | Deepest siege: more stages than a castle, named defenders (count to decide). Only available when the faction holds no other node |
| POI, zone, road, dungeon | A single battle |

- Player-involved fights are normal playable battles; AI-vs-AI resolves the same stages abstractly (hybrid system from `world_map_and_faction_war.md`).
- Key fights with named leaders can still run through the headless simulator.

### 6. Dynamic relations, alliances and AI attacks (wars need not be scripted)
- Relation values per faction pair drift, using the existing `shiftRelation`.
- **Drivers:** shared borders add friction; recent node flips add anger; shared enemies add warmth; Calamity pressure pushes others against the strongest; player actions ripple; a small deck of random incidents (border raid, trade dispute, marriage) nudges pairs.
- **The player can influence relations** through actions (contracts that help or hurt a faction, donations, battles won or lost for a side) and **dialogue** (persuasion and diplomacy at halls and with envoys). Exact levers are still to design.
- **Thresholds:** pair crosses hostile threshold -> incident -> war declared -> fronts. War weariness and truce timers bring pairs back down.
- **One ally at most, for every war faction including the AI's.** The ally is picked by the **faction-to-faction relation value**: the faction with the highest relation, above an alliance threshold. Allies do not attack each other, and supply paths run through allied nodes.
  - Because relations drift, an alliance can weaken and break on its own. Betrayal emerges from the same system rather than needing a script.
  - Add a buffer (the same idea as the rivalry table) so an alliance does not flip with small swings.
  - **The Hearthwatch is the one exception**: only the player's faction can take it as its ally. AI factions never ally with it.
- **Who decides:**
  - **Between AI factions it is automatic.** Alliances form and wars are declared by the relation thresholds, with no player input.
  - **If the player is sworn to a faction, that faction needs the player's input** before it joins an ally or enters a war. "Sworn" means holding a rank in it. The player is sworn to **at most one faction**, so only one faction ever asks. It reaches the player as a summons or council scene, and the player's answer decides.
  - **An unanswered or refused summons counts as "decline."** The faction does not join the alliance or start the war, and the player loses no standing for not being around.
  - Working assumption: being attacked is not a choice. The input covers alliances and wars the faction would *start or join*; a defensive war against an attacker happens regardless.
- **The AI has constraints and requirements before it attacks a node.** The aim is that wars feel earned and readable, not random raids. Candidate list, to be narrowed:
  - the two factions are at war (relation past the hostile threshold);
  - the target is next to a node the attacker holds, so wars have fronts;
  - the attacker's node is supply-connected;
  - attacker strength beats the garrison by a set margin;
  - a per-faction cooldown between attacks and a limit on concurrent fronts;
  - every attack is telegraphed a few days ahead (existing rule), so the player can intervene;
  - war weariness raises the margin needed after repeated losses;
  - capitals are only valid targets under the section 2 rule;
  - **the Hearthwatch is never a valid target for an AI faction.**
- **Civil war vs faction war is one system.** The only difference is whether the two sides share a race (Crown vs Synod is civil; Crown vs Ironbound is cross-race). Mechanics are identical; standing ripple and story flavour differ.
- **Keep the player-facing rivalry table separate** (Open / Uneasy / Opposed). It changes only at war or peace thresholds, with a buffer, so its effects do not flicker with drift.

### 7. Human unification: a new faction is born
**Two ways to unite the humans:**
1. **A complete faction war victory.** This is reached when **only one human war faction remains**. Rival factions are removed by capturing their capitals (section 2). **The victor's ally survives the elimination and joins it**: when the other factions are gone, the two become the united faction. The Hearthwatch is not counted unless the player's faction has conquered or allied it (see questions).
2. **The Moot.** The winning claimant decides the outcome. The Moot is scripted, so it flips nodes and capitals directly without sieges. **The Hearthwatch keeps its Moot vote** as a neutral seat.

**What unification does:**
- **The human war factions become one new faction.** It is a new faction with its own name, identity, rank ladder and **storyline, shaped by who won**. It is built from one template with a flavour per outcome (section 11). The new faction has its own id.
- Every node held by the old human factions flips to it, and their members and NPCs follow. **Crown Keep becomes its capital**, whoever won. The old anchors and capitals become ordinary nodes.
- **Absorbed ranks go away.** A player sworn to an absorbed faction loses the rank and has no faction until they take an invitation from the new one. **Ranks in the new faction start fresh from rank 1.**
- **Gear stays**, and the war path also yields the capital-captured unique gear from section 2.
- **The game's focus moves.** After unification the internal same-race struggle is over, and the story, wars and diplomacy become about the **racial factions of the world**: the united humans against dwarves, elves, orcs, goblins and the rest. Civil wars from here on come from the antagonists below, and from the other races' internal factions.
- **Antagonists remain.** Hardliners from the absorbed or wiped factions (Synod Inner Circle, Banner holdouts, Syndicate ledger-lords, Osric's loyalists) hold hidden cells (hidden nodes on the map) the player has to find and clear. If left alone, they can reawaken a dormant faction as a rebel faction and start a real civil war. A reawakened faction would need a hidden stronghold as its capital. These are map content, not spy play (section 9).
- **Rework needed:** the *Broken Moot* outcome currently creates a new faction, the Aldermere Crown. It should unite nobody. Aldermere's nodes go to an existing or dormant faction, or become neutral contested ground.
- **Rework needed:** `succession_moot.md` outcomes currently only change the rivalry table and a few places. Each outcome that crowns a claimant now also triggers unification, with the new faction flavoured by that claimant.
- The same rule could apply to other races (Ironbound vs Gilded Anvil, Blood-Iron vs Ash-Speaker, Mire-Born vs Bilge-Rat). Not decided; the human case comes first.

### 8. Map rendering
- **Land colour grows around controlled nodes**: each map pixel takes the colour of its nearest owned node.
- **Borders may spill into water** (no gameplay effect), so no coastline mask is needed.
- **Bold owner-coloured ring around each node symbol**; capitals get a heavier ring.
- **Contested nodes** (telegraphed attack) get a split or pulsing ring.
- Recompute only when ownership changes, so it stays cheap on mobile.
- Borders are drawn in code over the art (already decided), because territory changes during play.

### 9. One faction at a time; secret ranks and spy gameplay are cut
The player is sworn to **one faction at a time**. Secret ranks, Suspicion and spy play are cut, because with one rank there is nothing left to hide.

**What goes (all of it currently exists in design and in built code, and nothing is removed yet):**
- The 3-rank cap and the "at most 2 public" rule (`human_factions.md`, `ranks_and_suspicion_rules.md`).
- Secret ranks, the hidden **Suspicion** meter and its hint tiers, loyalty tests and exposure scenes (`story_world.js`, `t45.js`, `t69.js`).
- The "double lives" (Crown knight and secret Banner rider, and so on) and the cover-faction side of them.
- "Harm and Suspicion" in contracts (`faction_work.js`): harming a faction still costs standing there, but never raises Suspicion.
- Canvassing in the Moot adding +10 Suspicion, and declaring against a secret faction's vote adding +40 (`succession_moot.md`, `intrigue.js`).
- Lying low at a Hearthwatch chapel to lower Suspicion. Sanctuary for healing stays.
- The `needsSecret` flag on invitations, and the rule that Opposed pairs force one rank secret.

**What stays:**
- Standing with every faction (the ladder and Hearthwatch goodwill), and the rivalry table's effect on standing: serving one faction still drains standing with its Uneasy rivals, and it still sets how factions treat each other.
- Invitations, ranks, rank-2 scenes, faction gear.
- **Swapping factions** keeps its existing costs (30-day cooldown, leaving costs standing, betraying costs more). Leaving is how you take another faction's invitation. **Rejoining a faction you left restarts your rank** at the bottom.
- The hidden cells from section 7 (if you want those cut as well, say so).

### 10. The Hearthwatch is the free neutral
- **The Hearthwatch is not your one faction.** It sits outside the one-rank rule: you can always hold its goodwill and use its chapels, whatever faction you are sworn to or have left.
- **Its nodes are safe for the player by default**: sanctuary, healing and a place to rebuild, whoever you have wronged. No quest should make them permanently hostile (existing rule; there must be a penance path).
- **It never declares wars.**
- **AI factions cannot attack it, conquer it or ally with it.** Its chapels stay on the map through every AI war.
- **Only the player's faction can conquer it or ally with it:**
  - **Allied:** it is the player's faction's one ally. Supply runs through its nodes, and its goodwill meter keeps working.
  - **Conquered:** the player's faction captures its nodes like any other faction's, and taking the Priory ends the Hearthwatch. That is a deliberate dark choice with a real cost: the neutral safe nodes disappear, so the player loses their sanctuary and fallback (see questions).
- If the player is not sworn to a faction, nobody can ally with or conquer it.
- **It keeps its Moot vote.** Corisande, its claimant, can win the Moot even though the Hearthwatch is not a war faction.

### 11. The new human faction: one template, several flavours (draft, proposal)
One faction structure is written once and filled in per outcome, so there is a single storyline spine and a small amount of hand-written content per flavour.

**Flavours and what picks them:**
| Flavour | Picked by | Working name |
|---|---|---|
| Crown | Crown war victory; Moot: Regency or Osric | The Restored Throne |
| Syndicate | Syndicate war victory | The Ledger Concord |
| Synod | Synod war victory | The Ascendancy |
| Banner | Banner war victory; Moot: Wil | The Free Banner Realm |
| Hearthwatch | Moot: Corisande (the Hearthwatch cannot win by war) | The Hearth Commonwealth |

Names are placeholders. Five flavours cover all eight outcomes.

**The template fills these slots per flavour:**
1. **Identity:** name, motto, colours, ruler title, a Crown Keep dressing (banners, guards), opening notice-board and dossier lines.
2. **Rank ladder:** four ranks. The shared template already says what each rank unlocks (services, recruits, gear tier, a rumour pool); the flavour supplies the titles. The old ladders carry over (Crown: Sworn Sword, Knight, Banneret, Lord's Hand; Syndicate: Runner, Agent, Factor, Partner; Synod: Novice, Warden, Inquisitor, Adept; Banner: Cutpurse, Rider, Captain, Banner-Bearer), so the existing writing is not wasted. The Hearthwatch flavour needs a new ladder.
3. **Recruit lean:** the existing discounts (Crown squires, Syndicate scouts, Synod apprentices, Banner all entry classes at 85%, Hearthwatch acolytes).
4. **Policy dials:** a few settings that change how the world plays under it:
   - **Taxes:** shop prices and gold rewards.
   - **Magic law:** how mages are recruited, and whether hedge-mages are hunted or sheltered.
   - **Patrols:** road danger and bandit encounters.
   - **War posture:** how readily its AI allies, declares wars and accepts truces.
5. **Antagonists:** which remnant is the main plotter (the strongest losing faction's hardliners), plus a shorter list of lesser ones.

**A first pass at the dials:**
| Flavour | Taxes | Magic law | Patrols | War posture |
|---|---|---|---|---|
| Crown | medium | licensed | heavy | defensive, honour-bound |
| Syndicate | low (cheap shops) | open, for sale | tolled | opportunistic, trade first |
| Synod | medium | controlled, hedge-mages hunted | medium | cautious |
| Banner | low | sheltered | loose roadwardens | aggressive when provoked |
| Hearthwatch | low | free | light | peace-leaning, long truces |

**The shared storyline spine** (three acts, each with a slot the flavour fills):
1. **Consolidation:** the war or Moot is over, but the losers' hardliners are not. The player finds and clears the hidden cells (section 7).
2. **The new face:** the united humans meet the other races as one. The first contact scene with a neighbouring land (envoy, trade or a border war) is flavoured: a Crown envoy, a Syndicate trade mission, a Synod warning, a Banner raid, a Hearthwatch plea.
3. **The union's test:** a crisis (the Calamity, or a cross-race war) that asks whether the union holds.

**Hand-written content per flavour, only at key ranks** (the existing rule): an opening scene, two beats at ranks 2 and 4, and the antagonist's reveal. Roughly five flavours times three beats. The old rank-2 scenes (Voss, Crane, Ilvane, Old Standard) are the natural seeds for the rank-2 beats.

## Open questions
1. **If the player's faction conquers the Hearthwatch, what is left of the fallback?** The safe-node rule says the player should always have somewhere to rebuild. Options: a hidden remnant network survives, the player can only conquer it late in the game after another fallback exists, or the loss is accepted as the price. Which?
2. **If the player's faction allies with it and wins, what happens to the Hearthwatch at unification?** A normal ally joins the united faction. A neutral should probably stay a neutral, so the ally slot gives benefits but no merge. Is that right?
3. **Are five flavours right?** Regency and Osric both land on the Crown flavour (one is a steward, one a hard king). Do they need distinct variants, or is a shared Crown flavour with a different opening line enough?
4. **Policy dials:** are those four the right ones, and should they change the world's rules or only the flavour text?
5. **The Hearthwatch flavour's rank ladder and tone,** since there is no old ladder to reuse.
6. **Do the other races get the same unification rule?** Dwarves, orcs and goblins each have two factions, so they could end the same way, with the same shift from internal to world conflict.
7. **What does the rivalry table do now?** It no longer decides who you can join. Proposal: it only sets standing drain (Uneasy as today, Opposed stronger) and how factions treat each other. Is that enough?
8. **What are the player's levers on relations?** Which actions and dialogue options move which pairs, and by how much?
9. **Which AI attack constraints** from section 6 do we keep, and what are the first numbers (margin, cooldown, concurrent fronts)? Also the first numbers for the alliance threshold and the buffer.
10. **Moot and allies:** do the factions that backed the winning claimant count as the ally, and what happens to the ones that voted against?
11. **Titles and standing:** ranks go away and gear stays. Do titles and standing from an absorbed faction stay as flavour?
12. **Broken Moot:** where do Aldermere's nodes go?
13. **Rewrite of the rivalry table** after unification (the Moot doc already plans a replacement).
14. **Neutral ownership details:** do outlaw and monster nodes respawn after being cleared, and how fast?
15. **Garrison numbers, the isolation ramp and the capital siege stages** need a first tuning pass once the strength model is defined.

## Knock-on work (not started)
- Merge the four human territories in `C.TERRITORIES` and `C.REGIONS`; move patrol logic from region to nodes.
- Give every node an owner default, including roads and POIs.
- Give the Banner a capital; mark the Hearthwatch as a neutral that AI factions cannot target, with player-only conquest and alliance; update `human_factions.md`.
- Set the rank cap to one faction; remove secret ranks, Suspicion and double-life content; update `human_factions.md`, `ranks_and_suspicion_rules.md`, `faction_middle.md` and `succession_moot.md`; retire or rewrite the tests that cover them.
- Relation-drift engine, incident deck, player relation levers (actions and dialogue), one-ally rule, war declaration, AI attack constraints and truce rules.
- Player-input summons for alliances and wars when the player is sworn to a faction.
- Isolation counter and supply-graph cache.
- Multi-stage siege encounters per node type, with a capital siege gated on "no other nodes."
- Faction wipe routine and capital-captured unique gear drops.
- Unification routine: flip nodes, remove absorbed ranks, create the new faction from the template with the winner's flavour, move the capital to Crown Keep, set old ids dormant. Plus dormant-faction cells for the antagonists.
- The new faction template: five flavours, rank ladders, policy dials, spine and the per-flavour beats.
- Border and ring renderer.
- Update `world_layout_v3.md` and `succession_moot.md` to match.
