# Portal Integration

Ocean Adventure routes distributor behavior through `src/platform.ts`. Gameplay code does not call vendor globals directly.

## Standalone

- Default for localhost, Cloudflare, and independent hosting.
- Uses `localStorage` for progression.
- Hides rewarded-ad controls.
- Never blocks gameplay when a portal SDK is unavailable.

## CrazyGames

- Detection: CrazyGames hostname or `?portal=crazygames` during local QA.
- Loads and awaits the HTML5 v3 SDK.
- Reports loading and gameplay start/stop events.
- Uses the CrazyGames Data module as the sole progression store.
- Rewarded ads use callback completion and never grant currency on `adError`.
- Audio and gameplay are stopped while an ad is active.

References:

- https://docs.crazygames.com/sdk/intro/
- https://docs.crazygames.com/sdk/game/
- https://docs.crazygames.com/sdk/data/
- https://docs.crazygames.com/sdk/video-ads/

## Poki

- Detection: Poki hostname or `?portal=poki` during local QA.
- Loads and awaits the Poki HTML5 SDK.
- Reports loading and gameplay start/stop events.
- Continues to use `localStorage`, which Poki synchronizes automatically for logged-in players.
- Rewarded ads use `rewardedBreak` and grant currency only when it resolves `true`.

Reference: https://sdk.poki.com/html5

## QA evidence

- Standalone fallback: reward control hidden, local save active, 60 FPS.
- CrazyGames local SDK: initialization completed without errors, reward control visible, 850-credit reward doubled to 1,700 once.
- Portal ads are offered only in the harbor after mission completion and never during active sailing or diving.
