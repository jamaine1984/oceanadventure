# Fresh-save Campaign and Performance - October 9

## Result

All six chapters were earned sequentially in a new, disposable Playwright CLI browser profile at the normal `/?profile` URL. No QA route, receipt, credit, equipment, position or simulation-clock fixture was injected. Normal Cruise/Swim/ROV assist, tool controls, cabinet puzzle controls, harbor sale and inventory purchase buttons were used. Sales occurred from the Harbor interface while physically moored; this run did not walk to every counter. The user's normal browser save was untouched. Ads remain deferred; the final profile had no ad SDK scripts loaded.

| Chapter | Payment | Purchase | Persisted Bank |
| --- | ---: | ---: | ---: |
| The Lost Signal | 1,510 | Tank: 350 | 1,160 |
| Echoes in the Seagrass | 1,540 | None | 2,700 |
| The Origin of the Pulse | 1,680 | None | 4,380 |
| Wake the Array | 800 | None | 5,180 |
| The Freighter Archive | 1,100 | Sentry ROV: 900 | 5,380 |
| The Observatory Record | 1,150 | None | 6,530 |

Each chapter's amount, saved sale receipt, disabled duplicate-sale control and reload retention passed. The end record preserves the exact six chapter IDs, nine completed campaign conversations, survey-anchor / scooter-drive / research-rov blueprints, tank level 1 and ROV ownership. The Manta blueprint was earned but its vehicle was not fabricated in this run. Runtime errors: none recorded during the six chapter invocations.

The six sampled chapter windows total approximately 21.6 minutes with navigation assist. They exclude some inter-chapter UI, purchase and reload time. This is automated progression proof, not a measured 6-10-hour human campaign or retention assessment. All fifteen salvage cases, optional contracts, mastery voyages, manual-only navigation and physical-device play remain outside this run.

## Performance

Local AMD Radeon / ANGLE D3D11, 1280x720. Other machine activity was not isolated; these are local observations, not guarantees. Five-second warmups for Performance and fifteen seconds for Balanced preceded, and are excluded from, the timed continuous samples. Every sampled callback checks that the labeled mode/tool/underwater or storm workload remains active and menus do not interrupt it. All three samples reported zero invalid frames. Balanced used the supplied third-person character after the preceding view toggle; its result is not a like-for-like comparison with first-person Performance.

| Continuous Workload | Mode / Scale | Duration | Average FPS | p95 | p99 |
| --- | --- | ---: | ---: | ---: | ---: |
| Storm, stationary yacht at reef | Performance / 0.65 | 120.011 s | 60.00 | 17.1 ms | 17.6 ms |
| Underwater reef, Scanner, first-person | Performance / 0.65 | 120.003 s | 59.97 | 17.0 ms | 17.9 ms |
| Underwater reef, Scanner, supplied third-person | Balanced / adaptive 0.88-1.0 | 120.007 s | 58.01 | 22.1 ms | 28.1 ms |

Continuous Performance samples met approximately 60 FPS in these two workloads; Balanced did not meet the strict 60-FPS target. Actual mission aggregates were more variable: helm 56.4-59.4 FPS over 131-171 active seconds per chapter; swimming 49.5-56.7 over 37-103 seconds; observatory ROV 50.9 over 39.5 seconds. Aggregates include traversal, acquisition, streaming and capture work, and exclude paused frames. They are not uninterrupted steady-state benchmarks. Warm-reload startup reports ranged from about 2.98 to 4.10 seconds; this is not cold-download evidence. All sampling retained the 6,530-credit bank and paid chapter list.

## Reproduction and Evidence

Open a **new disposable** CLI session; never run these against the user's normal browser profile:

```powershell
npx.cmd --yes --package=@playwright/cli playwright-cli -s=fresh-campaign open http://localhost:5174/?profile
# Run this six times in the same session, stopping on any "### Error" result.
npx.cmd --yes --package=@playwright/cli playwright-cli -s=fresh-campaign run-code --filename scripts/verify-campaign-browser.cjs
npx.cmd --yes --package=@playwright/cli playwright-cli -s=fresh-campaign run-code --filename scripts/verify-sustained-browser.cjs
npx.cmd --yes --package=@playwright/cli playwright-cli -s=fresh-campaign run-code --filename scripts/verify-balanced-browser.cjs
npx.cmd --yes --package=@playwright/cli playwright-cli -s=fresh-campaign close
```

Local evidence: `output/playwright/campaign-final-01.log` through `campaign-final-06.log`, `campaign-sustained-final.log`, `campaign-balanced-final.log`, `campaign-final-state.log`, chapter field/paid captures and `sustained-*.png`. Logs/captures are ignored local artifacts, not files included in the Git publication. The helper's source is reproducible and this report retains the measured results.

The same read-only critic caught and closed helper validation gaps in exact payout, purchased ownership, sequential provenance and labeled performance workloads. Chapter 1 ran from the new zero-state profile with the payout/continuity/ownership checks already present; broader pristine-inventory assertions were added after its function was serialized. The later chapters ran the tightened checks. No game-runtime bug was confirmed and no game-runtime code, assets, ad settings or save schema changed. Visuals remain 7.6/10, gameplay provisional, production HOLD. Fresh earned automation is now evidenced; human retention, broader sustained/default/device performance, asset rights and hosted/embed verification remain open.
