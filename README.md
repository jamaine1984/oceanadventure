# Ocean Adventure Game

Standalone Three.js and Rapier ocean adventure game.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5174/`.

## Build

```powershell
npm run build
```

## Work From Another Computer

After this project is pushed to GitHub:

```powershell
git clone https://github.com/jamaine1984/ocean-adventure-game.git
cd ocean-adventure-game
npm install
npm run dev
```

GitHub should be the source of truth for editing. Cloudflare Pages should be connected to that GitHub repo for hosting and automatic deploys.

Cloudflare Pages build settings:

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

## Assets

The yacht is authored by `scripts/create_assets.py` through Blender and exported as `public/models/expedition_yacht.glb`. The editable Blender source is kept at `assets/blender/ocean_adventure_yacht.blend`.

To regenerate the asset:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --python scripts\create_assets.py
```
