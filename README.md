# Ocean Adventure

A standalone Three.js and Rapier expedition game with a Blender-authored yacht, helm controls, underwater exploration, procedural music, and live sea and weather states.

## Full-Game Expansion

After all six campaign payments are archived, Atlas / Voyages unlocks Coastline Comparison (three regions) and The Five Waters (five regions). These are ordered water-column surveys at the existing service moorings, not new physical terminals. Dive with the supplied character, select Scanner and acquire each four-second stable reading before sailing to the next stop. Reports retain time, sea state, measured wind and depth. Normal contracts cannot replace an active mastery voyage.

Return to harbor to archive the full report: the first coastal voyage pays 900 credits and later runs 650; the first five-region voyage pays 1,500 and later runs 1,100. Each archive adds 15 Selene reputation. No payment occurs between stops, and the paid report cannot be claimed again. Repeat itineraries rotate/reverse their order. Abandoning requires returning to harbor and explicitly confirming disposal of unpaid records; other cargo/equipment remains unchanged.

Mastery uses root save version 6. Older game builds refuse these saves rather than drop a voyage or its payment history. Update both computers before transferring. Autosaves and acquisition receipts retain the actual yacht position; a reload resumes aboard that vessel, not at the next unearned stop. Legacy saves keep existing campaign, weather, equipment and material records.

The voyage atlas contains a discovery chart, persistent named waypoints, eighteen selectable contracts, a six-chapter campaign record, three research partners and reputation-based outfitter discounts. Contracts vary between photography, sampling, mapping, recovery, repairs, remote terminal surveys and complete surveys across the bay, lagoon, limestone passage, Wreckward Reach and Pelagic Observatory. Exploration outside contracts can follow charted waypoints.

The opening expedition and earned reports use an authored radio conversation with questions and persistent decisions. Closing a report does not suppress later earned reports. Supporting harbor NPCs are temporary procedural figures permitted by the user; the existing supplied player remains unchanged. Their named slots support later model replacement.

After archiving The Origin of the Pulse, accept Wake the Array at the harbor. Sail to the service station east of the vault, dive and use Scanner beside the Blender-authored cabinet. Route each source to its receiver frequency and polarity, test the isolated circuits, and commission the feed. The saved commissioning record must return to harbor for its 800-credit payout. Detection and dialogue grant no repair, cargo or payment. The cabinet streams within 180 meters rather than joining initial harbor construction.

After commissioning the array, The Freighter Archive opens Wreckward Reach. The Blender-authored Pelagic 05 has two hull openings and a collidable cargo interior. Log the entrance with Scanner, release the recorder latch with Cutter, recover the cassette with Scanner and log the separate port exit. Partial progress survives reload; the 1,100-credit reward requires returning to harbor. Scanning a contact alone does not complete an action.

The wreck has seam-focused corrosion, cargo handles and hinges, wall service valves, cable racks and shaped, smooth-shaded seabed rocks. Hull and structural-steel wear maps bake at 1024 pixels; bridge and rock maps at 512. Nine material batches and 38,580 visible vertices keep the exported asset below 2 MB. These are asset budgets, not a sustained frame-rate guarantee. `scripts/verify-wreckward-materials.cjs` checks actual browser image decoding separately from mission/rendering checks.

The nine image-first visual references and construction briefs are preserved in [the concept folder](assets/concepts/full-game-v1/README.md). They guide construction, not proof that every destination or final NPC model is implemented.

The underwater Scanner automatically sweeps every seven simulation seconds. Its identification panel lists pending research instruments within 65 m and nearby modeled wildlife within 25 m, with name, range, depth below mean sea level, bearing, field notes and a relevant field action. Moving animals are explicitly last-sweep fixes, not live tracking. Up to five contacts have temporary, depth-tested markers. The Power icon toggles automatic/manual scanning; manual scans retain a separate cooldown so automatic sweeps cannot block them. Menus and reading acquisition pause automatic sweeps; surfacing or choosing another tool clears identification. Scanning never records photographs, completes readings or grants cargo.

Completing Echoes in the Seagrass unlocks the Manta Dive Drive blueprint: fabricate it for 650 credits at the dockside inventory, enable it while diving and gain forward propulsion below the surface. Its battery consumes power while thrusting, recharges aboard and survives local save/export/import. Reverse, normal swimming and the collision resolver remain available; assist does not use powered thrust.

Archiving The Freighter Archive unlocks the Sentry Research ROV, including existing paid freighter receipts. Fabricate it for 900 credits at the outfitter. From a stopped yacht in open water, Launch ROV enters a remote chase/optical camera with search lights, six animated thrusters and automatic/manual sonar identification. Its 120-meter straight tether has a conservative full-body limit; it is not a simulated wrapping cable. Battery drains while deployed and recharges aboard. Normal recall, reserve recovery and free recovery return helm control without awarding cargo. The manipulator is modeled; remote salvage and photographs remain future work.

The Observatory Record follows the paid freighter chapter and requires an owned Sentry before departure. Enter the Blender-authored monitoring hall through its front service opening. Survey assist approaches the next terminal; optical view, position, facing and stability are required for a two-second reading. Read the chronometer, habitat archive and crew deployment log in order. Each successful write preserves partial progress; scanning alone grants nothing. Recall the ROV and return to harbor for the 1,150-credit report and Selene's closing transmission. The hall has collidable walls, a circular pressure ceiling and three physical status lamps. The supplied diver can explore it, but terminal acquisition requires the ROV.

Archiving The Lost Signal unlocks registered service moorings and the Calypso Survey Anchor blueprint. Fifteen distinct marked equipment cases across five regions hold marine alloy, insulated copper and pressure cartridges. Scanner identifies available supplies; select a field target and Approach, then use Cutter to release a case while holding position for two seconds. Each case has one persistent recovery receipt. Wildlife, active instruments and scanning alone award no materials.

Inventory / Materials fabricates Calypso for 250 credits plus 3 alloy, 2 copper and 1 cartridge. Its finite 400 air / 300 power reservoirs refill the diver's air and owned Manta charge, or the deployed ROV's battery, at the actual seabed service connectors. Deploy and pack from a stopped yacht within 14 meters of an unlocked registered mooring. One movable pod is supported; packing and redeployment never refill it. Packed, depleted reservoirs can be resupplied at harbor for 125 credits. An owned Manta and the paid lagoon chapter unlock the 250-credit capacitor retrofit, requiring 2 alloy, 1 copper and 1 cartridge: 25% lower battery drain and 50% faster onboard recharge. Crafting, deployment and service save before updating live state.

This is the first full-game foundation, not a completed five-region production release. The larger approved scope and release gates are tracked in [the full-game roadmap](docs/FULL_GAME_ROADMAP.md). Ads remain deferred.

`npm run test:unit` runs the focused save, campaign, equipment, movement, player-asset and scanner checks. GitHub Actions runs these checks plus the production build/package check on pushes and pull requests; this does not replace browser or physical-device QA.

Atlas / Saves exports a validated JSON voyage for another computer, imports it with confirmation and retains rolling local recovery checkpoints. Backups are best effort when browser storage is full. These are local saves, not cloud synchronization. Paid ROV equipment uses root save version 3 so older, pre-ROV builds refuse it rather than erase ownership; update both computers before importing. Importing an older checkpoint intentionally rolls progress back; review its balance and expedition count before confirming.

Earned salvage, material crafting and pod state use root save version 4. Older builds refuse these saves rather than erase materials or equipment; update the game on both computers before transfer. Counts reconcile against unique recovery receipts and known recipes. Missing current records may recover a compatible checkpoint, but explicit future schemas/cache IDs/moorings block silent rollback. New economy types or recipes must update the schema, not reinterpret this ledger.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5174/`.

## Controls

Voyage time advances only during active play: one 24-hour day lasts 36 sailing minutes. Six scheduled fronts cycle between bluewater, calm and storm. Forecast shows the next fronts, wind, local time and safety advice. Night lighting and sun-dependent underwater caustics preserve the existing water and supplied player. Reflection environment generation remains startup-only; the continuous clock changes uniforms, not a per-frame PMREM bake.

Weather keys/buttons save a three-sailing-minute override; Forecast / Scheduled weather returns to the current front. Forecast pauses simulation. At dusk or night, moor at the harbor or visit its research/outfitter stand to rest until 07:00. Rest changes only voyage time/weather, not credits, cargo, oxygen or equipment charge. A failed setting/rest save leaves the voyage unchanged.

Active voyage clocks use root save version 5. Update both computers before transferring saves; older builds refuse these records rather than discard weather, salvage or equipment. Legacy saves migrate with their earned progress intact, beginning the new clock at 09:00. No offline fast-forward or cloud synchronization is implied.

### Yacht

- `W` / `S`: throttle and reverse
- `A` / `D`: steer
- `Shift`: boost
- `C`: change chase camera
- `E`: enter dive mode
- `R`: reset Aurora

### Diver

- `W` / `S`: swim forward and backward
- `A` / `D`: turn
- `Space`: rise
- `Ctrl`: descend
- `Shift`: swim boost
- `E`: return to the helm
- `C`: cycle first-person, chase and portrait views
- Drag in portrait view: orbit the same GLB character independently of swimming direction

### Research ROV

- `W` / `S`: fixed-speed forward/reverse thrust
- `A` / `D`: turn
- `Space` / `Ctrl`: rise/descend
- Drag the scene: aim the vehicle
- `F`: sonar pulse, with a separate manual cooldown
- `C`: external/optical camera
- `E`: recall to the vessel
- Controller sticks/triggers/bumpers and touch movement controls provide equivalent pilot input; boost is unavailable in ROV mode.
- Observatory: Survey assist approaches the current terminal; C switches to optical view; F or Read terminal acquires its archive. Manual movement/look interrupts acquisition and cancels assist.

### Environment

- `1`: Calm sea override (three sailing minutes)
- `2`: Bluewater sea override (three sailing minutes)
- `3`: Storm sea override (three sailing minutes)
- `M`: music on or off

The on-screen Dive, weather, music, and touch controls provide the same core actions without a keyboard.

## Build

```powershell
npm run build
npm run verify:portal
npm run test:unit
npm run qa
```

Optional isolated scanner touch/pixel checks with the local server running:

```powershell
npx --yes --package=@playwright/cli playwright-cli -s=scanner open http://localhost:5174/ --headed
npx --yes --package=@playwright/cli playwright-cli -s=scanner run-code --filename scripts/verify-scanner-browser.cjs
npx --yes --package=@playwright/cli playwright-cli -s=scanner close
```

Opening and fourth-chapter checks use a separate, disposable browser profile. The first script clears that profile's game storage; never run it in your playing browser. Run these sequentially in the same CLI session. The repair script seeds only the three prerequisite receipts, then plays the new mission through actual controls, including withdrawal, puzzle verification, failed-save retry, harbor payment and reload. This does not prove an earned four-chapter campaign or physical-device performance.

```powershell
npx --yes --package=@playwright/cli playwright-cli -s=story-check open http://localhost:5174/ --headed
npx --yes --package=@playwright/cli playwright-cli -s=story-check run-code --filename scripts/verify-story-browser.cjs
npx --yes --package=@playwright/cli playwright-cli -s=story-check run-code --filename scripts/verify-array-browser.cjs
npx --yes --package=@playwright/cli playwright-cli -s=story-check close
```

To verify the fifth chapter instead, run `scripts/verify-story-browser.cjs` then `scripts/verify-wreckward-browser.cjs` in the same disposable session. It seeds four prerequisite receipts and dive-drive ownership, then earns the freighter mission through controls. It checks failed-save feedback, partial reload, both breaches, drive withdrawal, solid-deck collision, mobile rendering, the 1,100-credit payment and pay-once/reload protection. It does not prove a normally earned five-chapter campaign.

ROV verification uses `verify-story-browser.cjs`, `verify-rov-browser.cjs`, then `verify-rov-touch.cjs` in the same disposable CLI session. Five prerequisite receipts and a 1,100-credit bank are seeded; the scripts then purchase the actual vehicle, test model/storage failures, pilot it, identify contacts, exercise the tether/reserve limits and verify reload. The touch script copies that acquired equipment into an isolated emulated-touch context with a full-charge fixture. It does not establish physical-device performance or a normally earned campaign.

Observatory verification uses `verify-story-browser.cjs`, then `verify-pelagic-browser.cjs` in an isolated CLI session. Five prerequisite receipts and ROV ownership are seeded, with zero credits and no observatory archives. Actual controls earn three readings, retry failed storage, resume a partial checkpoint and earn the 1,150-credit harbor receipt. `verify-pelagic-touch.cjs` uses separate terminal fixtures to check real emulated-touch taps, interrupted acquisition and non-overlapping controls at three compact sizes. `verify-pelagic-withdrawal.cjs` checks the supplied diver's physical entry and vessel return without remote records; `verify-pelagic-equipment-gate.cjs` verifies that unowned equipment cannot trigger automatic chapter departure. These are focused checks, not a normally earned six-chapter or full release gate.

Material verification uses `verify-story-browser.cjs`, then `verify-salvage-browser.cjs`. Two prior receipts, owned Manta and a 1,000-credit bank are fixtures; no materials or pod are pre-earned. Actual controls recover four cases across two regions, fabricate/deploy/service/pack/resupply the pod, fabricate the capacitor and reload at 375 credits. Injected model/storage failures and interrupted recovery must leave receipts intact. `verify-calypso-touch.cjs` copies that earned kit into separate three-size emulated-touch fixtures with seeded ROV ownership, verifying actual field charging and save failures. `verify-calypso-layout.cjs` checks four diver layouts and manually framed runtime geometry. These are not physical-device, full-campaign or sustained-performance certification.

## Work From Another Computer

```powershell
git clone https://github.com/jamaine1984/oceanadventure.git
cd oceanadventure
npm install
npm run dev
```

GitHub is the source of truth for editing. Cloudflare Pages can connect to the repository for automatic hosting deployments.

Cloudflare Pages settings:

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

## Blender Assets

The active fleet uses the Blender-authored v2 vessels. Walking and swimming use the same supplied, rigged human GLB, with retargeted prone swim clips and no procedural substitution:

- `assets/blender/ocean_boats_v2_full.blend`
- `public/models/aurora_explorer_yacht_v2.glb`
- `public/models/voyager_research_launch_v2.glb`
- `public/models/ocean-player-character.glb`
- `assets/characters/ocean-human-land-runtime.glb`
- `scripts/build_ocean_boats_v2.py`
- `scripts/package_player_swim.mjs`
- `assets/blender/manta_dive_drive.blend`
- `public/models/manta_dive_drive.glb`
- `scripts/build_manta_dive_drive.py`
- `assets/blender/array_service_station.blend`
- `public/models/array_service_station.glb`
- `scripts/build_array_service.py`
- `assets/blender/sentry_research_rov.blend`
- `public/models/sentry_research_rov.glb`
- `scripts/build_research_rov.py`
- `assets/blender/wreckward_freighter.blend`
- `assets/blender/textures/wreckward/`
- `public/models/wreckward_freighter.glb`
- `scripts/build_wreckward_freighter.py`
- `assets/characters/ocean-player-diver-legacy-runtime.glb`

Repackage the shared player from the preserved supplied assets:

```powershell
node scripts/package_player_swim.mjs
```

The older vessel/diver assets remain preserved in `assets/legacy-models`, outside the shipped public directory. `npm run make:assets` runs the earlier asset generator into that archive, not the active v2 fleet builder. Use the v2 Blender script deliberately when changing the active vessel source.
