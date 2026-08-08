# Ocean Adventure

A standalone Three.js and Rapier expedition game with a Blender-authored yacht, helm controls, underwater exploration, procedural music, and live sea and weather states.

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

### Environment

- `1`: Calm sea
- `2`: Bluewater sea
- `3`: Storm sea
- `M`: music on or off

The on-screen Dive, weather, music, and touch controls provide the same core actions without a keyboard.

## Build

```powershell
npm run build
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

The active vessel is the 42-meter Aurora explorer yacht. Blender exports both the yacht and the playable diver from one authored source:

- `assets/blender/aurora_explorer_yacht.blend`
- `public/models/aurora_explorer_yacht.glb`
- `public/models/explorer_diver.glb`
- `scripts/create_aurora_assets.py`

Regenerate the assets and studio preview with Blender 5.1:

```powershell
npm run make:assets
```

The original expedition yacht remains in the repository as a previous asset version.
