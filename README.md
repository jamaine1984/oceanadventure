# Ocean Adventure

A standalone Three.js and Rapier expedition game with a Blender-authored yacht, helm controls, underwater exploration, procedural music, and live sea and weather states.

## Full-Game Expansion

The voyage atlas contains a discovery chart, persistent named waypoints, sixteen selectable contracts, a four-chapter campaign record, three research partners and reputation-based outfitter discounts. Contracts vary between photography, sampling, mapping, recovery, repairs and complete surveys across the existing bay, lagoon and limestone passage. Exploration outside contracts can follow charted waypoints.

The opening expedition and earned reports use an authored radio conversation with questions and persistent decisions. Closing a report does not suppress later earned reports. Supporting harbor NPCs are temporary procedural figures permitted by the user; the existing supplied player remains unchanged. Their named slots support later model replacement.

After archiving The Origin of the Pulse, accept Wake the Array at the harbor. Sail to the service station east of the vault, dive and use Scanner beside the Blender-authored cabinet. Route each source to its receiver frequency and polarity, test the isolated circuits, and commission the feed. The saved commissioning record must return to harbor for its 800-credit payout. Detection and dialogue grant no repair, cargo or payment. The cabinet streams within 180 meters rather than joining initial harbor construction.

The nine image-first visual references and construction briefs are preserved in [the concept folder](assets/concepts/full-game-v1/README.md). They are not implemented destinations or final NPC models.

The underwater Scanner automatically sweeps every seven simulation seconds. Its identification panel lists pending research instruments within 65 m and nearby modeled wildlife within 25 m, with name, range, depth below mean sea level, bearing, field notes and a relevant field action. Moving animals are explicitly last-sweep fixes, not live tracking. Up to five contacts have temporary, depth-tested markers. The Power icon toggles automatic/manual scanning; manual scans retain a separate cooldown so automatic sweeps cannot block them. Menus and reading acquisition pause automatic sweeps; surfacing or choosing another tool clears identification. Scanning never records photographs, completes readings or grants cargo.

Completing Echoes in the Seagrass unlocks the Manta Dive Drive blueprint: fabricate it for 650 credits at the dockside inventory, enable it while diving and gain forward propulsion below the surface. Its battery consumes power while thrusting, recharges aboard and survives local save/export/import. Reverse, normal swimming and the collision resolver remain available; assist does not use powered thrust.

This is the first full-game foundation, not a completed five-region production release. The larger approved scope and release gates are tracked in [the full-game roadmap](docs/FULL_GAME_ROADMAP.md). Ads remain deferred.

`npm run test:unit` runs the focused save, campaign, equipment, movement, player-asset and scanner checks. GitHub Actions runs these checks plus the production build/package check on pushes and pull requests; this does not replace browser or physical-device QA.

Atlas / Saves exports a validated JSON voyage for another computer, imports it with confirmation and retains rolling local recovery checkpoints. Backups are best effort when browser storage is full. These are local saves, not cloud synchronization. Importing an older checkpoint intentionally rolls progress back; review its balance and expedition count before confirming.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5174/`.

## Controls

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

### Environment

- `1`: Calm sea
- `2`: Bluewater sea
- `3`: Storm sea
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
- `assets/characters/ocean-player-diver-legacy-runtime.glb`

Repackage the shared player from the preserved supplied assets:

```powershell
node scripts/package_player_swim.mjs
```

The older vessel/diver assets remain preserved. `npm run make:assets` runs the earlier asset generator, not the active v2 fleet builder. Use the v2 Blender script deliberately when changing the active vessel source.
