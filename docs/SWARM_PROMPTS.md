# STAR BASE: DEAD ORBIT — Swarm Build Rules

These instructions are for every coding, design, QA, economy, server, monetization, and release agent working on this project.

## Core rule
Build only what is documented or directly implied by the STAR BASE design. Do not invent lore, currencies, factions, missions, systems, story beats, AI dialogue, or mechanics just to fill space.

## Game loop
The first release must prove this loop:
1. Enter the Star Base HQ.
2. Inspect and upgrade real base systems.
3. Deploy into a combat mission.
4. Fight infected enemies.
5. Manage oxygen, filter life, ammunition, infection, and carry capacity.
6. Recover useful resources.
7. Reach exfil alive.
8. Return recovered resources to the base.
9. Spend resources on upgrades that change future runs.

If a feature does not strengthen that loop, defer it.

## Current systems
- Star Base HQ overhead management screen
- Command, Power, Med Bay, Armory, Storage, and Air/Filter buildings
- Upgrade costs paid from recovered alloy
- Combat deployment map
- Infected enemies
- Twin-stick mobile movement/aim structure
- Ammunition
- Oxygen pressure
- Filter pressure in toxic zones
- Infection from enemy contact or filter failure
- Alloy, data, orange goo, and purple goo mission resources
- Carry capacity
- Exfil and return-to-base rewards
- Local progression persistence

## Future systems that must not be faked
- Real account service
- Real server assignment
- Real factions
- Real cross-server state
- Wipeout mode
- Lost Mode / portal missions
- Alliance or faction warfare
- Live events
- Real cloud save
- Real leaderboards
- Real entitlement verification

Show future systems as unavailable or staged. Never populate them with pretend player counts, pretend factions, pretend events, or invented server results.

## Monetization
- No pay-to-win.
- No loot boxes.
- Paid content may be cosmetic, convenience, season access, or catch-up only.
- Monthly player spending cap target: $25, with room for parental/family controls.
- Rewarded ads must be optional.
- Purchases must not grant combat dominance.
- Production purchases must be server-verified before entitlements are granted.

## Technical priorities
1. Stable Android build.
2. Fast startup.
3. Responsive controls on phones.
4. Offline-capable core game where possible.
5. Deterministic progression.
6. Small, testable systems.
7. Remote configuration only for real tunable values.
8. Server authority for purchases, accounts, and competitive results when those systems are activated.

## Writing and prompts
- Use plain English.
- Use direct labels in the game UI.
- Do not write AI-sounding filler text.
- Do not describe features as complete if they are placeholders.
- Do not invent technical results, user metrics, revenue, retention, or server activity.
- When uncertain, leave a clear TODO instead of making something up.

## QA pass
Every build should test:
- fresh install
- game launch
- menu navigation
- base building selection
- base upgrade resource deduction
- mission start
- movement
- aim/fire
- enemy damage
- ammo consumption
- oxygen drain
- filter drain in toxic zones
- infection increase
- pickup carry limit
- exfil
- reward transfer to base
- app relaunch and save recovery

## Release principle
Ship the smallest honest version that works. Expand only after the core loop is stable and fun.
