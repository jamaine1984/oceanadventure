# Cloudflare Pages Setup

This project is ready for Cloudflare Pages as its own app.

## Recommended Setup

Use GitHub as the source of truth, then connect the GitHub repo to Cloudflare Pages.

Cloudflare Pages settings:

- Project name: `ocean-adventure-game`
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

This gives you automatic Cloudflare deployments every time you push to GitHub.

## Manual Deploy

If you want to deploy from a local computer instead of Git integration:

```powershell
npm install
npm run cf:deploy
```

This uses `wrangler pages deploy dist --project-name ocean-adventure-game --branch main`.

Important: Cloudflare Direct Upload projects cannot later be switched to Git integration. If the goal is to edit from multiple computers, create the Cloudflare Pages project through Git integration after the GitHub repo exists.
