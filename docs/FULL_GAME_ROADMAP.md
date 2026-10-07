# Ocean Adventure: full-game production roadmap

Approved October 5, 2026. All work stays inside the standalone Ocean Adventure project. Preserve the ocean rendering, supplied GLB player, detailed boats, music controls, safe recovery and earned-progress semantics. Ads remain deferred. The user subsequently authorized committing and pushing verified deliveries.

## Completion Standard

No feature is complete merely because it has a menu, a catalog entry or a passing build. New destinations must contain inspectable environments, actual traversal, usable interactions and earned rewards. A production release requires full regression, human playtesting, real-device runs, sustained performance samples and hosted/embedded verification. The desired 6-10-hour campaign must be measured with players, not inferred from mission counts. Current release status remains HOLD.

## Approved Scope

| Recommendation | Implementation status |
| --- | --- |
| Five distinct ocean regions | Pending new authored regional environments; current bay, lagoon and passage retained |
| Discovery map | Implemented first-bay chart, proximity discoveries, editable pins and physical navigation; larger regional chart pending |
| Connected campaign | Implemented four linked contract definitions, opening/earned radio conversations and archived debriefs; campaign-wide authored expansion pending |
| Selectable contract board | Implemented sixteen contracts across six activity families in the existing districts; full campaign catalog pending |
| Enterable underwater landmarks | Existing limestone vault retained; additional wreck interiors/facilities pending |
| Wildlife behavior and photography depth | Existing seven species retained; habitat expansion and behavior records pending |
| Capability-unlocking tools | Range-limited sonar and blueprint-unlocked rechargeable Manta dive drive implemented; ROV and broader tool progression pending |
| Distinct boats and useful deck facilities | Existing two supplied vessels retained; fleet expansion pending Blender authoring |
| Research outposts | Pending authored station modules and placement/recovery rules |
| Salvage and blueprint progression | Earned blueprint rewards and credit-based dive-drive fabrication implemented; salvage materials and wider crafting pending |
| Consequential weather and time | Existing sea states retained; forecast, day/night and current systems pending |
| NPC relationships | Implemented three named contract clients, authored radio conversations, permitted temporary NPCs, earned reputation and capped outfitter discounts; final rigged NPCs and deeper mission chains pending |
| Endgame expeditions | Repeatable selectable contracts implemented; multi-stop mastery expeditions pending |
| Reliable saves and recovery | Implemented migration, rolling local recovery and validated export/import; cloud sync pending |
| Streaming and technical release foundation | Pending regional asset streaming; startup profiling retained |

## Delivery Sequence

1. Protect saves and existing routes. Add atlas, contracts, campaign receipts, reputation and recovery controls. Verify earning, pay-once, interrupted save and reload.
2. Prove one new region end to end with Blender-authored geometry, streamed assets and distinctive objectives before duplicating the pipeline to four more regions.
3. Add functional scooter/sonar, blueprints, permitted salvage and one useful outpost. Expand vessel roles and campaign content.
4. Add environmental schedules, habitat behaviors and multi-stop endgame. Balance progression through human playtests.
5. Run all release gates; profile devices and hosted embeds. Only then remove the production HOLD.

Live Blender MCP was unavailable at the start of this pass. Do not describe new Blender assets as authored until creation and gameplay-camera inspection actually occur. No placeholder destination will be exposed as a finished region.

## Current Nine-Area Delivery

The October 7 approval covers all nine production recommendations, not just the opening. Nine separate visual targets were generated first and preserved in `assets/concepts/full-game-v1`, with normalized construction briefs in `PROMPTS.md`. Unused concepts are excluded from the runtime package.

| Approved area | Current state |
| --- | --- |
| Authored campaign | Four linked chapters; opening, earned revelations and archived reports implemented; larger regional story still pending |
| Five playable regions | Three existing districts retained; Wreckward Reach and Pelagic Observatory are visual targets, not playable regions yet |
| Distinct mission mechanics | Existing surveys/recovery/transects plus actual isolated-circuit commissioning; enterable freighter and ROV still pending |
| NPC storytelling | Radio questions, saved decisions and three temporary procedural supporting NPCs; final supplied NPC GLBs and broader chains pending |
| Earned progression | Existing boats/upgrades/blueprints/dive drive retained; materials, outposts and broader capability economy pending |
| Consequential environment | Existing sea states retained; schedules, currents, forecast and day/night pending |
| Discovery and endgame | Existing map/pins/repeat contracts retained; multi-region mastery still pending |
| Playable opening | The Lost Signal conversation launches the real unearned mission; complete normal-play onboarding/retention still needs human assessment |
| Full release verification | Focused automated checks underway; physical-device, sustained performance, long-campaign and hosted gates remain open |

The new repair cabinet is authored through the existing portable Blender 5.2.2 fallback because live MCP connection failed. `scripts/build_array_service.py` preserves a reproducible isolated source and exports `public/models/array_service_station.glb`; the existing boats and player are not regenerated. The unused legacy diver motion-source GLB moved out of the shipped public directory into `assets/characters`, retaining its bytes and updating its packaging scripts. This reduces runtime packaging, not proven loading time or FPS.

### Verified Story and Repair Delivery

All 84 focused Node checks pass, including the supplied player's preserved mesh/rig/clips, story gates, save failure, migration, partial legacy passage resume, repair diagnostics, actual Three GLB loading, and twelve batched NPC meshes across three named slots. The final build and portal package pass at 26 files / 49.32 MB. Twenty selected existing Playwright cases pass in a fresh single run: expedition state, grants, photograph framing and responsive/touch/canvas checks. This is not a fresh full 42-case release gate.

The normal opening was played in an isolated browser through its question, injected save failure, retry, saved departure, reload, partner selection, pause and Escape/inventory paths. Portraits and radio bounds passed at 1280x720, 390x844, 844x390 and 320x568. The published scripts in `scripts/verify-story-browser.cjs` and `scripts/verify-array-browser.cjs` reproduce these checks in a disposable CLI profile.

The fourth mission was accepted at harbor with only three prerequisite receipts seeded, and no credits, repair or cargo pre-earned. Actual controls sailed to the station, descended, withdrew to the vessel, redove, tested incorrect/correct routing and polarity, retried a failed commissioning save, returned to harbor, earned 800 credits, prevented duplicate sale and retained the receipt after reload. The stronger withdrawal probe recorded the last swimming position near the yacht and surface before helm transition. These checks prove the new mission, not an earned four-chapter campaign.

The authored cabinet renders in the arrival capture, and its commissioning panel remains bounded at all four sizes with scrolling in short views. A separately instantiated browser controller verified the actual loaded GLB's amber/green emissive state; it is not an in-world post-repair screenshot. This caught and repaired Three's normalized-node-name lookup. Physical walking reached the research and outfitter counters and opened Mara/Ivo conversations while retaining the real GLB player. Screenshots show the three permitted temporary supporting figures. They are not final character art.

The single critic found no remaining concrete P1/P2 within this scoped delivery after the dismissed-report, landscape, return-routing and migration repairs. Its visual score remains 7.6/10 under the unchanged rubric; gameplay remains provisional. The walkthrough's NPC captures displayed 1 and 18 FPS during non-isolated interaction/loading samples, not benchmark averages. No universal loading improvement, sustained 60 FPS or production certification is claimed. Performance, the two new regions, ROV/material crafting/outposts, environmental schedules, endgame, asset-rights review, human long-campaign play and physical-device/hosted gates remain open. Production remains HOLD.

## First Foundation Verification

The first foundation finished with 42 focused Node checks passing: all fifteen objective configurations, original three-route rewards, campaign prerequisites, reputation discounts, proximity discoveries, pin validation, legacy migration, rolling recovery, archive integrity, import preservation, storage failure and stale-writer protection. Character asset and smooth-turning tests remain included. The next field-tool pass adds fabrication, battery and sonar checks; final results are recorded separately below.

Playwright CLI actual-control sampling contract: depart at harbor with no cargo, sail to the reef, dive, collect both samples, surface/board, cruise and moor, sell for 510 credits, then reload. No photographs, recovered sensor or transect readings were pre-earned. Injected departure and sale failures leave the old expedition/balance unchanged; successful sale records one completion and ten Selene reputation. The receipt, reputation and renamed pin persist. This proves the sampling route, not all fifteen contracts through real play.

Actual UI checks cover export, cancelled and invalid import, confirmed replacement, restoring the pre-import 510-credit voyage, corrupt-primary recovery and free chart cruise to the discovered reef without modifying the sale receipt. Testing exposed an unload-autosave overwrite of imports; the pagehide handler now skips saving during deliberate replacement, and imports update the newest verified recovery checkpoint while retaining the old voyage.

Deterministic material canvases now reuse generated pixels while retaining separate texture repeat/sampler state. Geometry, placement, ocean/sky rendering, supplied GLB player and both existing vessels are unchanged. No universal loading-time or FPS improvement is claimed.

The existing complete browser regression first finished at 41/42: touch movement controls intercepted Save in the expanded More menu. That layering bug was fixed; a fresh affected-regression run passed 35/35, including the responsive HUD. The seven long physical-route cases passed in the earlier run, not a single clean final 42-case gate. Follow-up CLI checks passed all four atlas views at desktop, landscape and portrait sizes, touch taps, focus restoration and moving nonblank canvas checks. Seeded recovery/repeat-reward/course cases also passed. They do not prove all fifteen contracts through real play.

Local twelve-second samples ranged from 53.5 to 58 FPS in the existing lagoon/passage views, with 24.7-28.7 ms p95 frames. These were not isolated benchmarks. A later touch startup measured 10.23 seconds, including 4.48 seconds world construction and 3.01 seconds shader preparation. No sustained 60 FPS, universal startup improvement or physical-device certification is claimed. Ads, Git publishing and deployment remain untouched.

## Field Tool Pass

The Manta Dive Drive is authored in `assets/blender/manta_dive_drive.blend` and exported as `public/models/manta_dive_drive.glb` (339,132 bytes, nine material-batched meshes, plus named grip/rotor anchors). `scripts/build_manta_dive_drive.py` reproduces the asset and a review render without altering the boats or shared character. Store Blender could not be launched directly; an existing portable Blender 5.2.2 completed the build. Live MCP connectivity is not claimed.

The lagoon campaign awards the drive blueprint. Fabrication costs 650 credits, requires dockside access, loads the model before purchase and commits ownership/credits together. A rechargeable saved battery enables forward-only manual underwater propulsion; normal/reverse swimming and collision resolution remain active. Assist does not use powered thrust. A free scanner pulse reveals pending instrument contacts within 65 meters, with temporary depth-tested markers and range/depth bearings; it does not grant photographs, samples or readings.

The single critic identified clipped short-landscape controls, hidden fabrication feedback and a nested-version recovery rollback. All three are repaired: constrained scrolling, in-dialog feedback with focus retention, and explicit nested version guards before structural validation. Missing version fields remain recoverable corruption; unsupported versions never fall back to an older compatible checkpoint. The targeted failing nested-version test now passes; the critic's source re-review found no further P1/P2 blocker within this scope.

An initial floating-scooter gameplay image was rejected. The same supplied character now uses Three.js CCD IK against Blender-authored grip anchors, without changing its source mesh, skin indices, bind matrices or land animations. Real-control verification measured 3.099 m/s normal travel versus 5.115 m/s powered travel, battery drain and recharge, bank preservation on model/storage failures, one 650-credit purchase and save/reload retention. Blueprint and starting bank were seeded in an isolated preview save; these checks do not prove the campaign was earned through play. The new contract itself began without pre-earned cargo.

Grip/pose checks passed at four viewport sizes plus actual browser touch taps in short landscape, with no runtime errors. The carried drive's leading end also passes through the collision resolver. Navigation no longer overlaps wrapped desktop commands. The final edge-case check consumed the small charge gained aboard, reached actual zero charge, confirmed automatic shutoff and normal 3.100 m/s swimming, and verified that ascending body pitch follows travel. The separate sonar button revealed three passage contacts while acquisition stayed disabled outside real range/stability and readings remained 0/3. The expanded short-landscape panel stayed bounded and equipment remained reachable by scrolling.

All 57 focused Node checks pass, including original character/turning protection, finite grip chains, authored GLB anchors/batches, archive compatibility and nested-version recovery guards. The final production build/package check passed at 23 files / 47.32 MB; the complete 42-case browser gate is running for the final scanner controls. Tool-review screenshots displayed roughly 17-21 FPS in that non-isolated CLI environment; their frame rates are not acceptance evidence. Performance remains a release risk. These are browser checks, not physical-device, audio-listening or sustained-FPS certification. Full production remains HOLD.

## October 7 Verification Continuation

The persisted prior run reported a counter-arrival timeout while the researcher was still walking. A fresh actual-control check traversed the 95-waypoint pier route and opened the counter in 45.955 seconds, without errors or replacing the supplied character. The former 45-second assertion budget was too short. It is now 90 seconds; the walking pace, collision/path logic, actual arrival, 1,510-credit payment, purchase and reload assertions are unchanged.

Photographic targeting now runs only with Camera selected. A local profiling counter verified zero target evaluations while Scanner, Sampler and Cutter were selected, and thirteen evaluations over a 1.5-second Camera sample. Shutter-time subject validation remains intact. This removes unnecessary work; no universal FPS or loading improvement is inferred.

All 57 Node checks freshly pass. The fresh production build and portal package pass at 23 files / 47.32 MB. `output/playwright/oct7-full-qa.log` retained 35 completed browser checks before the runner stopped, including the repaired earned reef expedition, lagoon survey, purchases/reload, writer protection and both above-vault boarding cases. The seven remaining passage/framing/LOD/responsive checks passed separately in `output/playwright/oct7-remaining-qa.log` (7/7, 10.2 minutes). All 42 existing browser cases are therefore covered successfully across two sequential runs of the same unchanged game code, not one uninterrupted 42-case invocation.

The one critic found no P1/P2 regression in the scoped October 7 changes. Its sampled visual score is 7.6/10 using the unchanged five equal criteria; gameplay remains unscored pending earned expanded-campaign/blueprint assessment and sustained performance. Existing three-route complete-play evidence is now refreshed. The lagoon's twelve-second sample measured 59.8 FPS / 17.9 ms p95 on the local AMD/D3D11 configuration at 1280x720, Performance scale 0.65. Separate passage samples measured 41.9 FPS / 29.4 ms p95 in the garden, 46.8 / 26.9 in the interior, and 53.7 / 30.2 at the exit. These are not isolated comparisons or sustained/physical-device guarantees. The 8/10 target and full-production bar have not been reached.

## October 7 Scanner Identification and Publishing

The user now explicitly authorizes pushing or deploying new verified changes. Ads remain deferred. Automatic underwater Scanner sweeps identify actual pending instruments (65 m) and modeled wildlife (25 m), bounded to five contacts and one nearest fix per species. The existing tool surface now shows selectable subject names, range, depth below mean sea level, bearing, notes and the relevant field action. Wildlife coordinates are last-sweep fixes. Menus and acquisition suppress sweeps; surfacing/tool changes clear them. A separate manual timestamp prevents automatic scheduling from starving manual controls; the Power toggle also permits manual-only use. No mission progress is awarded by detection.

All 62 focused Node tests pass; the final production build and portal package pass at 23 files / 47.33 MB. Twenty-one existing state/framing/LOD regressions freshly pass. The actual-control reef, lagoon and passage routes, camera-return control and responsive HUD cases also pass, totaling 26 distinct existing cases across scoped runs, not a new complete 42-case invocation. Reef and lagoon earned their 1,510/1,540-credit payouts and preserved purchases/photos on reload. Passage earned 1,680 credits with ordered readings and both vault-return probes. The initial passage and responsive runs exhausted whole-test budgets (600/120 seconds), not individual wait limits. Total budgets are now 900/180 seconds; all per-action docking, boarding and loading limits remain unchanged. Reruns passed in 9.7/1.9 minutes. No gameplay pace was changed to make these tests pass.

A private-browser actual-control scanner check passed repeated sweeps, separate manual cooldown, pause freeze, automatic/manual toggle, identification selection, surface/tool clearing and no unearned photos/samples/readings. `scripts/verify-scanner-browser.cjs` makes the compact-layout checks reproducible through Playwright CLI. Emulated touch swipes reached the landscape tool panel's exact scroll maximum of 241 px; Power/manual actions worked through touch taps. Contact selection was tested with `selectOption`, not a physical/native touch picker. Canvas pixels and motion passed at 1280x720, 390x844, 844x390 and 320x568. Portrait tools now use the measured HUD bottom to stay below wrapped telemetry. The one critic found no remaining P1/P2 in this scoped repair. These are browser checks, not physical-device or sustained-FPS evidence. Sampled visual score remains 7.6/10; gameplay remains provisional.

The latest twelve-second, non-isolated Performance-mode samples on the local AMD/D3D11 device were 55 FPS for the lagoon, and 45.8/46.5/54.1 FPS for passage garden/interior/exit. Their p95 frame times were 25.5/31.7/34.5/30.3 ms. These are observations, not universal improvement or sustained 60-FPS claims. Startup and rendering performance remain release risks.

The connected Cloudflare account has no `ocean-adventure-game` Pages project; unrelated projects will not be changed. GitHub Actions now verifies focused unit tests and the production package on pushes/PRs. This package gate is not AAA certification. Expanded authored regions, normal-play earned blueprints, sustained performance, asset-rights review and full release QA remain open; production HOLD remains in effect.
