# Balanced and Spoken Dialogue - October 9

## Balanced

Balanced now reduces resolution below 58.5 desktop FPS rather than waiting for 48. Detail recovery requires three successive four-second checks above 59.7 FPS and increases scale by only 0.015. This favors frame-time stability rather than aggressively returning to full resolution. The mobile lower threshold remains 32 FPS. Performance and Quality remain manual presets. Ocean, boats, supplied character, shaders and authored geometry are unchanged.

A matched local reef fixture used the supplied third-person character, Scanner, 1280x720 and AMD Radeon / ANGLE D3D11. The previous 48/57-FPS policy was emulated by intercepting only the resolution module in the disposable test browser; all other game code was the same. Both cases used a 30-second warmup excluded from the subsequent 120-second window. Background machine activity was not isolated.

| Policy | Average FPS | p95 | p99 | Sampled Scale |
| --- | ---: | ---: | ---: | --- |
| Previous | 53.33 | 24.0 ms | 31.3 ms | 0.91-1.00 |
| Smooth | 59.55 | 17.8 ms | 21.8 ms | 0.65-0.895 |

The new 30-second blocks measured 58.57, 59.80, 59.93 and 59.90 FPS. This supports approximately 60 FPS after settling for this workload, not a universal strict-60 or real-device guarantee. Lower internal resolution is the tradeoff. This comparison is not like-for-like with the earlier night-time earned-campaign Balanced sample of 58.01 FPS. Both comparison cases reported zero invalid workload frames and retained visible supplied-character scenes.

## Character Audio

The existing WebAudio soundtrack remains available through Music on/off. All authored radio scenes and question replies now support browser-native speech. Character profiles prefer available English local voices and use distinct pacing/pitch; a limited installed voice pack can reuse the same voice for multiple characters. Text remains visible independently of voice support. The radio header offers separate dialogue mute and replay controls; voice preference survives reload without modifying progression. Native speech starts only after an input gesture.

Speech cancels on conversation changes, closing, pagehide and visibility loss. Generation guards reject callbacks from replaced lines. Start/end watchdogs prevent indefinite music ducking if an engine stops responding. Speaking reduces the soundtrack's master gain from 0.2 to 0.045 and restores its previous mute state afterward. Audio does not award credits, observations, story decisions or chapter receipts.

The connected HeyGen voice-generation service returned a reauthentication requirement. No generated recordings, voice clones or paid voice pack were created. This delivery uses installed/browser-provided speech, not professional recorded performances, lip sync or standardized cross-device voices. Browser speech providers may vary; local English voices are preferred when present. See [MDN's speech interface reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) for the underlying API.

Mock-engine browser checks passed opening/reply text, speaker selection, stale completion, cancellation, independent mute, preference reload, real WebAudio gain commands and 44px controls at 1280x720, 390x844, 844x390 and 320x568. These prove orchestration, not audible quality. A separate unmocked Chrome session exposed local Microsoft David, Mark and Zira voices; Replay reached `speaking` and closing returned `ready`. No human listening or physical-device audio assessment is claimed. Unsupported/blocked speech retains subtitles and an unavailable status.

## Reproduction

Use new disposable Playwright CLI sessions, never the user's normal browser profile. `scripts/verify-balanced-policy.cjs` runs the matched preview comparison; `scripts/verify-voice-browser.cjs` tests mocked speech orchestration. They use CLI `run-code --filename`, not new Playwright test specs. Local ignored evidence: `balanced-policy-final.log`, `balanced-policy-{previous,smooth}.png`, `voice-browser-final.log`, `voice-*.png`, `native-voice-final.log` and `native-voice.png` under `output/playwright`.

The current runtime passed all 42 existing browser cases in one uninterrupted 22.0-minute run, all 167 Node tests, the production build and package check (28 files / 48.64 MiB). `voice-quality-full-final.log`, `voice-quality-unit.log`, `voice-quality-build.log` and `voice-quality-package.log` retain those checks locally. Mock provider cases are not live ad tests.

Local production iframe QA passed keyboard movement, diving, inventory pause and a saved zero-credit reef departure, with no runtime errors or ad SDK scripts. The real parent is served by the dev server at localhost:5174; its child is the compiled production preview at localhost:4174. These are cross-origin but same-site loopback origins. Reproduce with `scripts/fixtures/production-embed.html`, `scripts/verify-production-embed.cjs`, a fresh CLI profile, the dev server and `npm run preview -- --port 4174`. `production-embed-repro-final.log` records the final run. An earlier synthetic parent response was blocked by Chrome local-network protection before the game loaded; that failed harness log is retained separately. No browser protection or permission was disabled. Different-site privacy restrictions, public hosting, real distributor SDKs and mobile embeddings were not certified.

The preview comparison is not an earned campaign run. The October 9 fresh six-chapter evidence remains separately documented; the expanded campaign was not re-earned in this rendering/audio pass. Human retention, audible listening, physical-device performance, asset-rights documentation and public-host verification remain open. Ads are still disabled; no publisher or network was configured. The same read-only critic retains visuals 7.6/10, gameplay provisional and production HOLD.
