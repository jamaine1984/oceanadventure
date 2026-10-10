# Portal Integration

Ocean Adventure routes distributor behavior through `src/platform.ts`. Gameplay code does not call vendor globals directly.

Current release state: ads remain deferred and no publisher/network is configured in the verified build. The adapter instructions below describe retained integration code, not permission to enable monetization. Browser provider tests use mocks only. Live ad/audio interruption and public-host acceptance require a separate authorized integration pass.

## Standalone

- Default for localhost, Cloudflare, and independent hosting.
- Uses `localStorage` for progression. Normal sessions hold an origin-scoped Web Lock so another game tab cannot write the same save; close the first tab and reload to transfer control. Each write also compares the last-read/saved value before committing. Browsers without Web Locks have stale-write detection only, not a cross-tab transaction guarantee. QA previews intentionally use isolated session storage.
- Hides rewarded-ad controls.
- Never blocks gameplay when a portal SDK is unavailable.

## CrateShip / Google H5 Games Ads

- Primary provider selected by the user on October 3, 2026.
- Detection: `crateshipgames.com`, its subdomains, or `?portal=google` for local QA.
- `src/google-h5.ts` implements the Google Ad Placement API; `src/platform.ts` remains the provider boundary for later networks.
- Set `VITE_GOOGLE_AD_CLIENT=ca-pub-<16 digits>` in the build environment. The publisher ID is public configuration, not a secret. No placeholder ID is shipped.
- `VITE_GOOGLE_ADS_TEST=on` is the safe default; localhost always uses test mode. Only set `off` for an approved production release. Without a configured ID or ready SDK the game continues and does not offer a video.
- The game owns the ad tag. A parent CrateShip page must not trigger duplicate placements; its iframe should allow autoplay. Parent-owned ad coordination, if desired later, needs a separately implemented origin-checked message bridge.
- Reward placement: `ocean_research_grant`. After a saved cargo sale, the player checks availability. Only `beforeReward` opens the exact offer; Watch ad invokes the provided `showAdFn`. The grant is 50% of the actual sale, capped at 500 in-game credits.
- Only `adViewed` qualifies a grant. Completion persists an earned receipt and then commits the credit balance and claimed receipt together. Repeated callbacks, another click, or reload cannot pay a saved claim twice. If saving fails, the in-memory earned claim remains available to retry before departure. A browser losing all writes cannot guarantee recovery across a forced reload; production durability would require a server receipt.
- Interstitial placement: `ocean_next_expedition`, only after selling a completed survey and choosing another departure. No first-departure ad. A session-persisted five-minute guard also suppresses an interstitial following a recent rewarded video.
- `beforeAd` pauses simulation/input and mutes audio; `afterAd` restores the previous sound state. No-fill/error allows normal departure. A 15-second request watchdog applies before an ad starts, never during a playing video. Since the API exposes no cancellation function, startup arriving after that watchdog still pauses and mutes the game until completion; an expired request does not earn a grant.
- Boat changes freeze simulation until loading and saving finish, without exposing an uncommitted equipped vessel. Starting another survey saves the proposed chapter first; failed storage keeps the existing cargo receipt and harbor open.
- Browser regression tests inject the documented Google callbacks only on localhost. These verify gameplay transactions and failure paths, not live Google ad delivery or account approval.

References:

- https://developers.google.com/ad-placement/docs/example
- https://developers.google.com/ad-placement/apis
- https://developers.google.com/ad-placement/apis/adbreak

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

## Historical QA evidence (old buoy game)

- Standalone fallback: reward control hidden, local save active, 60 FPS.
- CrazyGames local SDK: initialization completed without errors, reward control visible, 850-credit reward doubled to 1,700 once.
- Portal ads are offered only in the harbor after mission completion and never during active sailing or diving.
