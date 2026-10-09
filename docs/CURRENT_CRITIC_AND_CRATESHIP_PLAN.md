# Ocean Adventure: current review and CrateShip plan

Reviewed October 3, 2026. Local game: http://localhost:5174/.
Baseline scope: open and assess the current working copy, establish one critic and a fixed 8/10 bar, and plan inventory plus interstitial/rewarded advertising for CrateShipGames.com. The baseline was read-only; approved implementation rounds are recorded below. No deployment is claimed.

## Evidence and limits

The current uncommitted expedition rebuild supersedes the earlier buoy game. Historical AAA scores and historical six-test passes are not current certification.

1. Harbor and yacht: loaded successfully; water reflection, authored vessel, docks and shoreline visible. Initial narrow harbor HUD was 60 FPS; later single-tab harbor HUD was 57 FPS. Screenshots `01-harbor.png`, `08-game-open.png`.
2. Research exchange: opens, shows two fleet options, five equipment upgrade lines, research cargo ledger and captain discoveries. Readable ownership/affordability state, but no dedicated inventory screen or item previews. Screenshot `02-harbor-shop.png`.
3. Reef: visible seabed, coral and animated wildlife; Camera/Sampler/Cutter/Scanner actions and oxygen telemetry. Balanced snapshots read 17-25 FPS; explicitly enabled Quality read 26 FPS with two game tabs open. These are observations, not sustained isolated benchmarks. Screenshots `03-reef.png`, `05-reef-quality.png`.
4. Wildlife journal: the actual Photograph action advanced 0/3 to 1/3 species and recorded a Blue tang photograph plus 120 credits in cargo. Opening the journal pauses simulation and oxygen use. Screenshot `04-journal.png`.
5. Island walking: supplied character visible; actual Walk assist reached the research exchange from the boarding area, stopped and enabled the counter interaction. Walking snapshots read 15-21 FPS with two tabs open. Screenshots `06-island-walk.png`, `07-counter-arrival.png`.

Evidence is saved under `output/current-critic-review/`. Initial cropped harbor capture was rejected and replaced with a complete view. Quality was explicitly selected only for the stated reef view; other captures are observed default/persisted settings.

Current production TypeScript/Vite build passes. Package contains 20 files totaling 45,884,718 bytes (43.76 MiB). Existing automated tests still assert old buoy/beacon objectives and an obsolete impact preset; update them before claiming the rebuilt game passes release QA. Captured underwater logs had no errors, but included Rapier initialization deprecation and shader precision warnings.

This is a partial browser play check, not a complete manual expedition, sustained hardware benchmark, accessibility certification, animation review, or physical controller/touch certification. No audio listening score is claimed. Several disabled shop controls have low contrast and long scroll depth; keyboard focus, touch reach and modal behavior need dedicated checks.

## One-critic protocol

Use ONE independent critic for each round, retaining the same rubric and evidence package. The implementation agent supplies screenshots and test results; the critic returns findings without editing code. Keep the critic agent available for following rounds.

The independent critic is Mill, agent `01a102a3-20db-7861-aac9-5743cf0940e2`. Each category uses five equally weighted 0-2 criteria. Preserve these criteria and weights in subsequent rounds.

| Category | Criteria and current subscores | Total | Verdict |
| --- | --- | ---: | --- |
| Visuals | Composition 1.6; asset coherence 1.4; lighting/materials 1.4; environmental richness 1.3; interface presentation 1.3 | 7.0/10 | Below target |
| Gameplay | Research loop 1.6; controls/guidance 1.6; interaction readability 1.2; depth/replayability 1.1; responsiveness/recovery 1.3 | 6.8/10 | Provisional, below target |
| Rewards/economy | Earn/spend loop 1.6; progression balance 1.1; inventory 0.8; persistence/claim safety 1.1; requested-site ads 0.0 | 4.6/10 | Not release-ready |

The critic confirmed research-counter arrival, photography advancement, cargo valuation and journal imagery. Highest priorities: validate the complete chapter and replace old tests; align photographic targeting with the visible frame; profile underwater scenes and improve habitat/shading/clarity; complete equipped-kit/cargo/photo inventory and varied follow-up surveys; verify the actual site ad integration. Release verdict: HOLD.

Pass requires visuals >=8.0 AND gameplay >=8.0, no unresolved critical gameplay defect, and verified full expedition plus reload/ad recovery. Screenshots may justify visual scores; gameplay remains provisional until the critic receives real play evidence. Scores do not substitute for performance or ad integration tests.

## Existing inventory foundation

- Fleet: Aurora 42 is free; Voyager X costs 1,800 credits. Ownership and active vessel are saved.
- Equipment: engine, air tank, hull, fins and dive light, each with three upgrade levels.
- Research cargo: species photographs, water sample, sediment sample and recovered sensor. Cargo is paid at the research exchange after the completed chapter.
- Collection: seven species, journal photographs and persistent discoveries.
- Sale safety: receipt and credit payment are saved together before updating live state.

Build one accessible inventory with Fleet, Equipment, Cargo and Collection views. Show model/item thumbnails, owned/equipped state, upgrade effects, counts, remaining expedition uses and clear purchase/claim results. Keep permanent upgrades distinct from temporary supplies. Inventory should be available from the pause menu and harbor; stop simulation while inspecting it.

## Proposed reward placements

| Placement | Player reward | When | Initial limits |
| --- | --- | --- | --- |
| Research grant | Extra in-game credits: 50% of sold cargo, capped at 500 | After successful harbor sale | Once per expedition, save the claim receipt |
| Voyager trial | Equip the launch for one expedition, without granting ownership | Fleet shop before departure | One active trial; return to owned boat when expired |
| Expedition supply | One spare air canister OR scanner charge | Harbor preparation | One optional supply claim per expedition |
| Cosmetic unlock | A deterministic boat paint or suit accent unlock | Inventory customization | One selected unlock per successful reward |

Start with Research grant only, then balance and expand. Numbers are proposed tuning values, not verified economy outcomes. Temporary air/scan items require actual inventory and consumption mechanics before offering ads for them. Basic equipment, free rescue and normal progress remain available through play. Do not add a failure penalty simply to sell its removal. Rewards have in-game value only.

Replace the old hidden `doubleReward()` handler: it still pays the old fixed contract reward and tracks the claim in memory. The rebuilt chapter needs the actual sale amount, a persisted receipt keyed by expedition and placement, and an atomic credit/item grant. Save successfully before announcing the reward. Ignore duplicate callbacks, disallow parallel requests, and give no item on cancellation, no-fill or error. Reload must neither erase a confirmed grant nor allow a second claim.

## Interstitial placement and integration

Interpret "interstellar ads" as interstitial ads. Proposed placement: after a completed expedition, when the player selects the next departure. Start with a five-minute spacing target, skip the first departure/tutorial, and suppress an interstitial immediately after a rewarded video. These are experience defaults to tune with playtests, not provider policy limits.

No interstitial while sailing, swimming, walking, using a tool, or opening inventory. Persist progress first. Pause simulation, clear held input and mute audio during the ad, then restore the previous menu/audio state. No-fill, network failure or timeout must allow departure. Keep provider callbacks separate from mission logic.

`src/platform.ts` currently supports standalone, CrazyGames and Poki; no CrateShip adapter or callable interstitial implementation exists in this game. Reward controls are explicitly hidden at initialization. The inspected older local CrateShip checkout did not establish its current production provider or an SDK contract. Provider access/approval and the current site integration remain to be verified.

Prefer a separately hosted game origin, such as `ocean-adventure.crateshipgames.com`, embedded by the site's Ocean Adventure play page. Confirm DNS/hosting before deployment. Current assets use absolute `/models` and `/textures` paths; putting the build directly under a nested site path requires Vite base and asset URL changes.

Define a CrateShip bridge for loading, gameplay, save and ad requests. If parent-owned ads are used, validate exact message origins, source window, request IDs and completion status. Use one SDK owner so parent and iframe cannot both trigger the same break. Guest local saves continue to work; account/cloud sync is a separate feature. Do not assume an approved live ad provider merely because an adapter exists.

Google's H5 Ad Placement API is a possible provider if CrateShip uses it. Its documented callbacks distinguish reward availability, completed viewing, dismissal and break completion. Allocate rewards on confirmed `adViewed`; use completion/no-fill callbacks to release the game. Source: https://developers.google.com/ad-placement/apis . This research does not establish CrateShip's actual provider.

## Implementation order

1. Rebuild the regression baseline for the current chapter: briefing, departure, photographs, both samples, wreck cable/sensor, docking, sale, gear purchase and save/reload. Profile one tab at consistent desktop/mobile viewports and graphics settings; record frame-time percentiles for harbor, reef, wreck, storms and walking. Optimize render targets/shadows, visible geometry, skinning, texture sizes and reflection updates according to measured cost.
2. Ship the inventory and preparation loop. Add versioned item ownership/equipment/counts, migration of current saves, deterministic item previews, and transaction receipts. Keep Cargo and spendable credits visibly different.
3. Improve the first expedition: make the first harbor interaction obvious, show a short ordered objective list, make photograph framing and sample range unmistakable, tune swim/boat camera feel and add contextual feedback. Review why a photo credits a species when the image contains several animals.
4. Make visual refinements from the same critic's exact findings: consistent sharpness, more natural coral/plant variety, contact shadows, boat finish, shoreline and cleaner context-sensitive HUD. Judge representative moving views as well as stills.
5. Implement the CrateShip adapter and Research grant with a fake/test provider first. Test completion, cancellation, no-fill, timeout, duplicate/reordered callbacks, save failure, reload and audio/input restoration. Then use the confirmed provider's test ads on the actual embedded play page.
6. Add trial boat/supplies/cosmetics only after reward timing and upgrade pacing are tested. Complete another full critic review with visuals and gameplay both >=8, then prepare the approved production release.

The immediate next build should establish current regression/performance evidence and a clear inventory, rather than enable live ads against obsolete rewards.

## Approved build round 1: inventory and Google H5

The user confirmed Google H5 Games Ads as the first provider on October 3, 2026. Future networks remain behind the platform adapter. The baseline descriptions above intentionally preserve the pre-build findings; they are not the current implementation status.

Implemented:

- Native inventory dialog: Fleet, Equipment, Cargo and Collection, with responsive layout, Lucide icons, authored yacht renders, owned/equipped states, dockside purchases and separate pending cargo versus spendable credits.
- Persistent species photo collection, including migration from the current survey's images.
- Optional research grant after a saved sale: half of the actual cargo payment, capped at 500 credits, one saved claim per survey. Basic progress and recovery remain free.
- Google callback adapter, exact opt-in offer, cancellation/no-fill recovery, pause/input/audio lifecycle, interstitial between completed surveys and a session-persisted five-minute guard. Missing publisher configuration does not load Google or block play. Localhost and default configuration use test mode.
- Transaction repairs from the same critic: late ad startup still pauses after an expired request; vessel loading freezes gameplay without exposing an unsaved vessel; normal local saves have one Web-Lock writer plus stale-write detection; departure saves its proposed chapter before replacing the completed receipt.
- Paused scenes render at most once per second. This reduces background work, but is not evidence of improved active-game frame times.

The critic's source re-review found no remaining blockers in those transaction repairs. The first expanded `npm run qa` passed all 16 checks, production build and portal verification (22 files, 46.76 MB as reported by the verifier). Tests use installed Chrome/D3D11 serially; SwiftShader was too slow for the rebuilt scene. Canvas screenshot pixel checks assert nonblank scenery and movement at desktop/mobile sizes, not a frame-rate target. `npm audit --omit=dev` reported zero vulnerabilities.

Screenshots under `output/inventory-grant-review/`: `01-fleet-desktop.png`, `02-cargo-reef.png`, `03-research-grant.png`, `04-equipment-mobile.png`. The same critic inspected all four and retained the original weights:

| Category | Round 1 subscores | Total | Verdict |
| --- | --- | ---: | --- |
| Visuals | Composition 1.6; asset coherence 1.4; lighting/materials 1.4; environmental richness 1.3; interface presentation 1.6 | 7.3/10 | Below target |
| Gameplay | Research loop 1.6; controls/guidance 1.6; interaction readability 1.4; depth/replayability 1.1; responsiveness/recovery 1.5 | 7.2/10 | Provisional, below target |
| Rewards/economy | Earn/spend loop 1.7; progression balance 1.1; inventory 1.6; persistence/claim safety 1.6; requested-site ads 0.8 | 6.8/10 | Local foundation, not production-ready |

Manual photography revealed a further defect: a small credited blue tang shared the frame with a much larger shark, dominating the thumbnail. `05-wildlife-collection.png` is rejected photographic-fidelity evidence. The follow-up fix raycasts foreground animals, requires an inspectable subject size and crops projected geometry bounds rather than a wide viewport minimum. Final photo QA/evidence is recorded separately after verification; no automatic score increase follows a source edit.

Final follow-up verification: `npm run qa` passed all 19 checks, production build and portal verification (22 files, 46.77 MB as reported). This includes actual Photograph input, a correctly labeled butterflyfish image and exact JPEG survival after reload, plus projected crop containment/aspect-ratio tests. The same critic inspected `06-subject-photo.png` and accepted this photographic example; it does not validate every overlap, rotation or camera-plane case. The three category scores above remain unchanged. `07-game-open.png` records the normal harbor reopened on the original localhost save, with the screenshot HUD at 34 FPS; the earlier live DOM observation was 36 FPS. Neither is a sustained benchmark. No production deployment or live Google ad delivery occurred.

Remaining release gates: complete the whole chapter through actual controls, verify collection after another survey, show full-vessel previews, verify bottom mobile equipment controls and mobile reward offer, profile single-tab frame-time percentiles and optimize the reef/wreck, assess upgrade pacing and varied follow-up surveys, and verify Google provider test delivery on the actual CrateShip embedding. Publisher ID/account approval, hosting and live ads are not established. The release verdict remains HOLD until visuals and gameplay both reach at least 8 and these critical checks are complete.

## Gameplay round 2: ads deferred

The user's newest instruction on October 3, 2026 defers ads. This round does not change any ad integration, configuration, placement or reward offer. Existing monetization notes above are historical/future work, not the current priority.

Implemented:

- Spatial reef LOD batches: retain original coral/rock detail nearby, simplify distant habitat, and cull small spatial regions. Instance placement, tint, shadows and independent collision proxies are preserved. Hysteresis reduces rapid level switching.
- Explicit guided return to the vessel: swim to its surface boarding side rather than the next research site or harbor. Movement, camera drag, controller look and tool selection clear return state consistently. The mode button distinguishes Return, Cancel return and Board.
- Shared nearest-uncollected-sample targeting for HUD readiness, assistance and tool use; either collection order is valid, with consistent three-dimensional range checks.
- Assisted harbor return approaches open water, aligns north, then reverses into the berth. The successful gangway notice requires the actual landing predicate; the maneuver does not teleport the boat into place.
- Desktop notices moved away from the bottom action toolbar, with fully hidden expired notices.
- Fresh-chapter actual-input regression, return-cancellation regression, sample-range/order tests and LOD geometry/placement tests. The fresh chapter uses isolated session storage without seeded mission objectives or intermediate checkpoint jumps.

### Local performance comparison

`node scripts/profile-game.mjs before` and `node scripts/profile-game.mjs after-lod`: installed Chrome, AMD Radeon D3D11, 1280x720, Performance mode, five-second warmup and twelve-second sample per scene. These are short relative local measurements, not a sustained performance certification. An old stalled in-app game tab could not be inspected reliably, so complete background-load isolation is not established. Render timing is CPU submission time, not a GPU timer.

| Scene | FPS before / after | p95 frame ms before / after | Triangles before / after |
| --- | ---: | ---: | ---: |
| Harbor | 35.9 / 35.7 | 43.5 / 43.1 | 1,882,112 / 1,882,112 |
| Reef | 37.5 / 45.4 | 43.6 / 33.1 | 3,102,352 / 1,268,302 |
| Wreck | 48.6 / 47.6 | 31.8 / 33.5 | 546,908 / 546,908 |
| Storm | 31.5 / 33.0 | 55.3 / 47.8 | 1,882,112 / 1,882,112 |
| Island | 42.7 / 43.0 | 37.4 / 36.3 | 1,042,257 / 1,042,257 |

Reef throughput improved about 21%, p95 frame time about 24%, and submitted geometry fell about 59%. Reef draw calls increased from 129 to 221 and CPU median render submission from 5.1 to 9.6 ms; watch this tradeoff on other devices. Harbor and wreck have no meaningful measured improvement. Do not claim smooth 60 FPS across the game.

Evidence is under `output/gameplay-round2`: both profile JSON reports and scene images; actual playthrough arrivals, wildlife survey, cable interaction, north-facing mooring and earned dockside sale. The same critic accepted visual preservation in the matched reef images and the first actual mooring/sale/upgrade evidence. The first full-chapter attempt reached the equipment purchase and failed only a test expectation of `1160` versus the correctly formatted `1,160`; the assertion was repaired.

The expanded `npm run qa` then passed **25/25 tests**, build and portal verification (22 files, 46.77 MB), in 10.3 minutes. The fresh actual-input chapter passed in 5.4 minutes: briefing, sailing, three photographs, both samples, guided boarding, wreck recovery, guided boarding, north-facing mooring with the gangway enabled, walking to the counter, earning 1,510 credits, buying a 350-credit tank upgrade, reload and another survey. Credits and all three exact JPEGs survived; repeat sale stayed disabled; new-survey cargo reset to zero. Drag-cancel/restart, desktop/mobile nonblank moving scenes, inventory, save and existing provider regressions also passed. This is automated assisted actual-input play, not a human-feel or mobile whole-chapter playtest.

### Photograph refinement after the full gate

The critic found the earned gallery too soft at Performance resolution. `src/photo-capture.ts` now renders only the existing subject crop at 640x400 into a temporary HDR render target, uses Three.js OutputPass for the renderer's tone mapping and output color space, and downsamples to a 320x200 JPEG. The live camera and continuous render resolution are unchanged. Target, cube face, mip level, viewport, scissor and auto-clear are restored in `finally`; temporary targets and pass are disposed.

Capture failure now awards no observation and explains that the player can retry. The final focused four-test pass includes a blocked canvas capture, no objective credit on failure, continued nonblank moving live rendering, a successful retry, exact JPEG persistence after reload, crop containment/aspect and a cloned camera that does not mutate the live projection. Final build and portal verification passed again (22 files, 46.77 MB). This capture refinement followed the 25-test gate; the complete updated 26-test suite has **not** been rerun. The critic inspected and accepted a sharper butterflyfish in the first capture-refinement run. The fault-injection rerun overwrote `08-sharp-subject-photo.png` with the correctly labeled anthias captured on retry; subject pose varies during live movement.

Same critic, unchanged weights (five criteria scored 0-2):

| Category | Final round 2 subscores | Total |
| --- | --- | ---: |
| Visuals | Composition 1.6; asset coherence 1.4; lighting/materials 1.4; environmental richness 1.3; interface presentation 1.8 | 7.5/10 |
| Gameplay | Research loop 1.8; controls/guidance 1.7; interaction readability 1.6; depth/replayability 1.1; responsiveness/recovery 1.6 | 7.8/10 provisional |

The critic accepted the sharper photograph and capture state restoration. Shutter-time synchronous rendering/readback/JPEG latency remains unprofiled. Neither score reaches the 8/10 target; no production-ready or AAA claim follows from these passes. Ads were excluded from this round's scoring. No commit, push, deployment or live ad activation occurred. The normal localhost server responds HTTP 200, but the existing in-app preview remained unresponsive to screenshot control; real-browser test evidence is independent of that UI-control limitation.

Next quality priorities remain harbor/reflection performance, believable environment and asset finishing, moving LOD transition inspection, manual/mobile sailing and swimming feel, and genuinely varied follow-up surveys with measured upgrade pacing. No new visual or gameplay score is inferred from source changes alone.

## Gameplay round 3: Seagrass Watch

Ads remain deferred. This round changes neither provider code nor ad configuration, placements or offers. The standalone game remains independent of the parent application.

Implemented:

- A distinct second contract, Seagrass Watch: sail west to a shallow lagoon, photograph a green turtle and spotted eagle ray, collect water and sediment, then sail to an acoustic transect and acquire three separate readings before returning to harbor. Later contracts alternate with the original reef/wreck expedition.
- A western seagrass habitat, grouped meadow beds with a clear diagonal sand channel and collection clearings, a shallow northwestern bank and textured limestone ledges. Existing reef geometry remains separate. Grass uses spatial batches and a current-swept vertex shader; new animal populations use the existing articulated models.
- Scanner acquisition requires 2.5 seconds near an unrecorded station while stationary. HUD readiness, activation and ongoing dwell share actual displacement speed and movement intent. Movement, tool/mode change, rescue, assistance or route replacement cancel acquisition; menu pauses freeze it. Completed readings survive reload; unfinished dwell does not.
- Route-aware navigation, checkpoint restoration, sample selection, wildlife eligibility, journal checklist, persistent collection, research ledger and saved sale receipt. Complete lagoon cargo earns 1,540 credits; the original three-photo reef/wreck cargo still earns 1,510.
- Legacy version-2 saves without a route retain their reef expedition, including later run numbers. Invalid/duplicate station indices cannot award completion. Next-contract selection uses the current contract number rather than assuming the lifetime completed count matches it.

The first actual-input lagoon attempt earned both required photographs, both samples and all three readings, including movement interruption, frozen pause time and a reload after one station. Guided western boarding and north-facing harbor mooring worked; sale earned 1,540 credits and reload retained that balance. Its final next-contract assertion found a sequencing defect when the run number and completed count differed. Both the departure implementation and displayed next-contract title were repaired before the expanded release gate.

Final verification for this round is pending below. The serial gate has 31 tests, including the unchanged original actual-input expedition, an expanded lagoon playthrough, strafe/rise readiness, failed-save sale retry, repeat-sale protection, exact gallery persistence, next-contract alternation and desktop/mobile nonblank moving lagoon canvas checks. The lagoon QA preset selects contract 2 at the harbor with zero cargo; it does not pre-complete research or teleport between objectives. Production build and portal package verification passed (22 files, 46.78 MB) before the browser gate.

Evidence directory: `output/gameplay-round3`. Early snapshots caught shutter flash or menu fade and are not visual acceptance evidence. The expanded test replaces them with stable captures and adds a station-ready view and the earned wildlife gallery. A twelve-second local desktop lagoon profile is recorded separately; it is not a sustained frame-rate certification or a comparison against the old reef benchmark.

The same critic found no blocking source defect after the integration repairs. The initial mobile review retained visual 7.5 and gameplay 7.8 provisional, requesting stronger meadow composition, more inspectable animal contrast and less mobile HUD occlusion. Final scores require inspection of the updated evidence and completed gate. No AAA or production-ready verdict, commit, push or deployment follows from this source pass.

### HUD, retry and instrument follow-up

The first 31-test gate passed 30 checks, but the faster lagoon run exposed a ready-state/cooldown mismatch: an immediate reading retry could be rejected even though the button looked enabled. Tool readiness now includes the same 0.65-second cooldown as activation. The test additionally requires visible acquisition after retry, so an ignored click cannot masquerade as a paused reading.

Sea-state controls now follow the mission panel in the HUD grid instead of using a fixed top offset. Portrait secondary actions move behind an accessible More menu; pause, inventory, mode, assisted movement and all touch movement/depth controls remain available. Save, focus return, Escape dismissal without opening pause, responsive sizing, desktop/portrait/landscape nonblank moving canvases and non-overlapping weather positioning have explicit checks. The ray no longer multiplies its spotted texture by an extra dark albedo and has a pale non-emissive underside.

A dropped mobile heading selector briefly caused a CSS syntax warning. It was restored with CSS-only hot replacement during initial chapter loading. The warning-free production build and package verification then passed (22 files, 46.79 MB), and the complete 32-test browser suite passed in 14.2 minutes. Both actual-input expeditions passed: reef/wreck in 5.0 minutes and Seagrass Watch in 5.3. The latter verified interrupted reading/retry, frozen pause time, partial reload, strafe/rise readiness, western boarding, gangway-enabled north-facing mooring, failed-sale save with zero credited balance, successful 1,540-credit retry, duplicate-sale prevention, exact two-JPEG persistence and subsequent reef contract selection despite a divergent run/completed count.

The same critic assessed the updated HUD and current lagoon images at visual **7.7/10**: composition 1.6, asset coherence 1.4, lighting/materials 1.4, environmental richness 1.5, interface presentation 1.8. Gameplay rose to **8.3/10 provisional**: research loop 1.9, controls/guidance 1.7, interaction readability 1.6, depth/replayability 1.4, responsiveness/recovery 1.7. This is a provisional gameplay threshold pass, not a combined pass or production approval.

The final 32-test code's twelve-second stationary lagoon sample recorded 721 frames, 60.0 FPS and 17.1 ms p95 frame time, with 417,936 submitted triangles and 90 draw calls on the final sampled frame. Conditions: installed Chrome/AMD Radeon D3D11, 1280x720, Performance mode, renderer scale 0.65, sampled after two actual photographs. Background-load isolation, sustained thermal behavior and harbor/storm performance are not certified. `output/gameplay-round3/profile-lagoon.json` is overwritten on subsequent full route runs and identifies their current readings.

After that full gate, acoustic station roots were turned toward the usual southern approach to expose their authored panel, ports and label. The existing dive beam now dims within six meters of a visible acoustic station to avoid washing out the casing; reef/wreck routes retain their previous beam output. The expanded 33-test gate, including actual portrait-phone-sized sailing and two wildlife photographs, is pending. No final score is inferred from these two finishing edits.

### Final round 3 verification

The expanded `npm run qa` passed **33/33 tests** in 15.8 minutes, including station orientation/work-beam changes, both complete actual-input expeditions and the new portrait research test. The latter sailed from the harbor and earned turtle/ray photographs with touch-sized controls in 1.2 minutes, with no seeded observations or intermediate checkpoint jumps. `12-mobile-subject-1.png` and `12-mobile-subject-2.png` show actual aligned research frames before capture; `13-mobile-earned-collection.png` and `14-mobile-earned-ray.png` show the resulting photographs. This is automated portrait-viewport play, not real-device or human testing.

The final full-route lagoon sample recorded 721 frames at 60.0 FPS and 17.1 ms p95 over twelve seconds, with 419,112 triangles and 91 draw calls on the last frame. Conditions and limitations above remain unchanged. Instrument images `03-acoustic-reading.png` and `07-station-ready.png` establish the corrected faceplate orientation and reduced close-range washout. The critic raised visuals to 7.9 after these changes, while gameplay remained 8.3 provisional.

Late navigation/touch-layout assertions were not executed by the already-collected 33-test suite. A separate fresh responsive pass verified portrait guide/action spacing, desktop/landscape weather flow, and actual `hasTouch` browser contexts at 1280x720 and 900x720 with explicit tool/action separation from movement buttons. First-page cleanup makes those contexts serial. Evidence: `10-hud-mobile.png`, `11-hud-landscape.png`, `15-hud-touch-desktop.png`, `16-hud-touch-tablet.png`.

The critic then identified remaining short-landscape crowding. A final scoped finishing change extended the existing More menu and its focus behavior to landscape, retained a fixed-width single row of primary actions, and hid only the ancillary NPC line in short viewports. The objective and selected-tool prompt remain visible. Added checks require at least eight pixels between mission/tools and navigation/actions, a primary dock no taller than 44 pixels, and accessible secondary Save/focus restoration. The fresh expanded responsive test passed in 52.1 seconds. This finishing change followed the full 33-test gate; the complete suite was not rerun after it. No mission, physics, photography, progression, sale or ad logic changed in this last finish.

The final production build is warning-free, portal verification reports 22 files / 46.79 MB, `git diff --check` passes and the standalone localhost server returns HTTP 200. One landscape snapshot caught a 12-FPS HUD observation while a build ran concurrently; it is not a steady-state measurement. A final responsive-only repeat, without a concurrent build, is used for the closing captures and critic review. Final rubric outcome is recorded below; no production deployment, commit, push or ad activation occurred.

### Closing critic verdict

The same critic reopened the final responsive evidence after the landscape finish and the responsive-only repeat (37.5 seconds, no concurrent build). The primary landscape dock is one stable row, secondary actions remain accessible through More, and mission/tool and navigation/action spacing passed the explicit bounds checks. Final screenshots are the replacement captures, not the earlier crowded landscape frame.

| Category | Final subscores, five equally weighted 0-2 criteria | Total |
| --- | --- | ---: |
| Visuals | Composition 1.7; asset coherence 1.4; lighting/materials 1.5; environmental richness 1.5; interface presentation 1.9 | **8.0/10** |
| Gameplay | Research loop 1.9; controls/guidance 1.7; interaction readability 1.6; depth/replayability 1.4; responsiveness/recovery 1.7 | **8.3/10 provisional** |

**Both categories >=8: PASS on current evidence.** This closes the requested critic threshold for this local iteration. It does not certify an industry-scale AAA game or approve a production release. The 33-test gate preceded the last scoped landscape finish; two fresh focused responsive passes cover that finish, and the final warning-free build/package include it.

Remaining release work: human playtesting, real-device mobile whole chapters, sustained multi-scene performance profiling (especially harbor/storm and capture latency), and actual hosted/embedded validation. Next visual polish should improve animal body detail and instrument lettering. Release remains HOLD until the required production checks are established. Ads are deferred and excluded from the scores. No commit, push, live deployment or ad activation occurred.

## Round 4: Limestone Passage and underwater wildlife

User approved the proposed next underwater upgrade. Changes remain inside the standalone game; ads, deployment and Git publishing are excluded.

- New contracts now cycle Bluewater Research, Seagrass Watch, Limestone Passage, then repeat. Sanitization preserves the explicit route of existing active saves, even when their run number no longer matches the new cycle. Missing-route legacy records still retain their reef contract.
- Limestone Passage has an eastern coral garden: turtle and blue tang photographs plus water and sediment, followed by a south-to-north survey through an eroded limestone vault. Scanner readings must progress through entrance, interior and north exit. Full cargo earns 1,680 credits through the existing atomic sale receipt; photos remain in the collection.
- The vault is a continuous irregular textured mesh with separate roof/support collision bounds and a clear central corridor. A saved partial passage uses a southern entry descent before assisted travel to the remaining instrument, avoiding a straight-line descent through the roof. The existing free recovery and boarding systems remain available.
- Turtle refinements include mapped central/lateral scutes, separate scaled skin, neck, beak, eyelids, nostrils, mouth seam, rim and tail. Existing rays have a curved wing outline, textured dorsal contrast, snout, eyelids, spiracles and ventral gill detail. Wildlife uses bounded species-specific elliptical paths, differing depth motion, paired flipper strokes and varied school spacing. These are refinements of current code-authored animals, not imported or newly Blender-authored models; no new species or behavioral AI is claimed.
- Passage coral uses spatial instancing/LOD and existing limestone media. Scanner instruments have protected low-emission beacon domes and purpose-sized field-code labels. No additional large external asset downloads were added.

Initial actual-control passage completed in 5.9 minutes: both photographs, two samples, all three ordered readings, physical traversal positions, boarding, harbor sale, persistent 1,680-credit receipt, next reef contract and two retained collection photographs. This initial test preceded final scute/instrument/vault/assist refinements. Its twelve-second exit sample was 51.5 FPS, 28.0 ms p95, 210,506 triangles and 37 calls on local Chrome/AMD D3D11 at 1280x720 Performance, scale 0.65. It is an exploratory sample, not final performance acceptance.

Expanded actual-control regression (movement interruption, partial reload through the southern approach, failed-save sale retry, pay-once and desktop/portrait evidence), matched garden/interior/exit samples, final release gate and sole-critic verdict are pending below. Earlier round 4 screenshots are replaced by later runs. Release remains HOLD for human, real-device, sustained performance and hosted/embedded validation.

### Round 4 regression and return safety

The 39-test `npm run qa` built and verified the portal package, then passed 37 tests. Two expedition tests failed because their next-contract assertions had been edited at the wrong occurrences: the fresh reef test expected the garden, while the lagoon test still expected the reef. Correcting those assertions and freshly rerunning both complete chapters passed in 12.2 minutes. This accounts for all 39 base cases across runs, not one clean 39-test gate. The expanded passage chapter passed in 8.0 minutes, including two partial reloads, an interior vessel return, ordered physical station traversal, interrupted acquisition, failed-save sale retry, exactly one 1,680-credit payout and retained collection images.

Matched twelve-second local samples in `output/gameplay-round4/profile-passage.json` measured garden 46.2 FPS / 36.7 ms p95, interior 54.0 FPS / 30.1 ms p95, and exit 58.8 FPS / 22.7 ms p95. Conditions: local Chrome, AMD Radeon D3D11, 1280x720, Performance at render scale 0.65. These short non-isolated samples do not establish sustained 60 FPS, real-device performance, harbor/storm performance or shutter latency.

A late source review found a boat manually parked above the vault needed an outside ascent before returning inward toward its surface position. Clearance is now derived from the highest roof collision bound, the diver height margin and one meter of additional safety. During the clearance leg, horizontal swim speed/input are explicitly zeroed and normal vertical movement raises the diver; manual movement, including gamepad depth input, cancels assist. Surface guidance resumes above clearance.

The focused north/south tests use a seeded active passage save, not an earned research or upgrade playthrough. They sail a boat above the vault, descend using controls, cancel/retry return during exit/ascent, face inward with residual speed just outside the boundary, then trace ascent and boarding. Frame-timed keyboard-release and pointer-down events exercise the actual controls without teleporting or changing runtime game state. Early fixture attempts overshot the boundary through transport latency or sent click to a pointer-down control; those failed runs are not acceptance evidence. The suite now registers 42 tests. Final focused results and critic acceptance follow below.

### Final round 4 verdict

The final focused run passed **14/14 tests in 2.4 minutes**. An additional fixture correction stopped manual sailing and entered dive mode on the target frame, then asserted the vessel's side of the vault: delayed test input had let the intended southern yacht coast north of the midpoint, making the game correctly select the northern exit. No game safety assertion was weakened to repair that setup.

The final southern vessel was at z=-137.139; the northern vessel at z=-145.320 with fins level 3. Inward-facing retries began at z=-129.255 and z=-151.769 respectively. Ascent traces contain 120 southern and 94 northern frames below the derived -10.336-meter clearance; both have exactly zero X/Z drift, ascend monotonically and reach normal boarding without returning beneath the roof. The same critic reviewed both complete JSON paths and accepted the source repair. The seeded edge cases do not substitute for earned chapter completion.

| Category | Final subscores, five equally weighted 0-2 criteria | Total |
| --- | --- | ---: |
| Visuals | Composition 1.7; asset coherence 1.4; lighting/materials 1.5; environmental richness 1.6; interface presentation 1.9 | **8.1/10** |
| Gameplay | Research loop 1.9; controls/guidance 1.7; interaction readability 1.6; depth/replayability 1.5; responsiveness/recovery 1.7 | **8.4/10 provisional** |

**Both categories >=8: PASS on current evidence.** This is the same sole critic and unchanged rubric. No remaining blocker was identified in the reviewed scope. Residual visual issues include stretched limestone mapping, occasional overlapping tangs, limited portrait arch context and modest animal body detail.

The final production build is warning-free; portal verification reports **22 files / 46.80 MB total and initial**. `git diff --check` passes and the standalone passage endpoint returns HTTP 200. All 39 base cases are accounted for across the earlier gate and corrected chapter reruns; the final 14 focused checks cover the last assist changes. The complete current **42-test suite was not run as one clean gate**, and the full three earned chapters preceded the narrow final assist repair.

Local isolated preview: `http://localhost:5174/?qa=passage`. It starts the third expedition at harbor without pre-earned cargo and uses a separate local session save; it does not overwrite the normal player's progress. Evidence remains in `output/gameplay-round4`, including final north/south path JSON and screenshots. The request to show that URL in the Codex browser returned queued, so visible opening is not confirmed.

Release remains **HOLD** for human playtesting, real-device mobile whole chapters, sustained multi-scene profiling (including harbor, storms and shutter latency), and actual hosted/embedded validation. Internal critic acceptance does not certify AAA scope or production readiness. Ads remain deferred and were neither changed nor activated. No commit, push or deployment occurred in this round.

## Player motion and shared GLB follow-up: October 4

User requested smooth full-direction walking, reported slow loading and a procedural recovery character, then required the same GLB player underwater with full turning and face inspection. Fresh local walking showed the supplied GLB, so the specific failure in the user's earlier tab was not reproduced. The loader nevertheless had an automatic procedural substitution on any model/animation validation failure. That runtime path and its procedural-player imports are now removed. A required GLB failure blocks initialization with Retry; no alternate person is shown, and no voyage is written before that failure.

- Walking body facing follows collision-resolved travel independently of camera heading. Backward and diagonal travel turn the body through the shortest smooth angle; idle retains facing. Manual movement has short acceleration/deceleration ramps, while existing exact walk-assist waypoints, collision stepping, first-person view and movement limits are retained.
- `scripts/package_player_swim.mjs` preserves the original shore runtime under `assets/characters/ocean-human-land-runtime.glb`, retains its mesh, embedded texture, bind rig and three land clips byte-for-byte, and retargets prone swim motion onto those canonical bones. Both runtime modes load `/models/ocean-player-character.glb`, now 4,214,452 bytes, through one shared promise. Original source/diver assets remain preserved. The upright spread-arm SwimIdle was replaced with a slowed prone Swim cycle after screenshot review. No new sculpt or procedural human is claimed.
- Per-character materials are cloned while geometry and textures are shared, so swimming light adjustments cannot change the walking instance. Failed asset promises are removed from the load cache, and Retry reloads the page. The former approximately 8.68 MB combined player download becomes one approximately 4.21 MB request; loading is prestarted and boat/character initialization overlaps.
- Underwater A/D turning is unrestricted. In portrait/inspection view, drag or right-stick look orbits the camera through a full circle independently of swimming direction; normal first-person and chase controls remain available. View/C cycles the modes. Inspection drag/right-stick look does not cancel guided travel.
- Identical sky-environment inputs reuse the existing PMREM instead of rebuilding it. Deterministic coral templates share geometry across repeated meshes without changing their material, placement, shape or LOD density. The new local startup profile reports stage timings instead of claiming a universal loading speed.

Verification: ten Node unit checks pass, including exact source-buffer preservation, canonical bone targets, finite unit quaternions, prone underwater clips, eight walking directions, angle-seam turns and acceleration/stop behavior. Playwright CLI actual-control checks pass for backward/forward walking, a complete walking circle, nonblank moving canvas, full swimming turn, more than 360 degrees of independent underwater camera orbit, desktop/portrait screenshots, one shared GLB request, injected network failure and successful Retry. A separate `hasTouch` mobile context uses actual CDP touch input on REV, verifies turning toward travel, checks release stops movement and confirms the supplied GLB; it passes without runtime errors. These viewport/context checks are not physical-device or human playtests. Evidence is in `output/playwright`.

Loading remains partly unresolved: a non-isolated local dive startup measured 10.57 seconds (physics 78 ms, ocean/sky 1.93 s, world construction 4.83 s, models/colliders 1.36 s, controls/settings 27 ms, shaders 2.35 s). The touch-context run measured 15.09 seconds while another game context was alive. Earlier samples varied from 7.72 to 15.35 seconds. These are not controlled before/after benchmarks and do not establish an overall speedup. Duplicate work and downloaded player bytes are reduced, but initial world generation and shader preparation still require optimization on slow computers.

The final focused reruns and build/package results follow below. The complete 42-test Playwright release gate has not been rerun for these changes; no new critic score or production-readiness claim is inferred. Ads, deployment and Git publishing remain untouched.

### Final player verification

After the per-instance material isolation, fresh desktop walking and underwater checks passed, including all four walking-facing quadrants, full swimming turning, independent 429.7-degree inspection-camera orbit, a moving nonblank canvas and fault-injected GLB Retry recovery. The underwater run recorded a 365.9-degree swimmer turn and exactly one 4,214,452-byte player asset request, with no runtime errors. A fresh touch-enabled portrait browser context passed actual REV touch, backward facing, release stopping and supplied-character checks; it is not physical-device verification.

The final ten Node tests pass. The production build is warning-free, and the portal package verifies at 22 files / 46.94 MB. Final local startup samples were 5.81 seconds underwater and 5.59 seconds in the touch context; earlier slower samples remain relevant because these runs are not a controlled performance comparison. World construction still consumed 3.22 and 3.78 seconds respectively. No sustained FPS or universal loading-time improvement is certified. The full 42-test release gate remained unexecuted for that follow-up, and production release remained HOLD.

## October 5 Full-Game Foundation And Field Tools

The user approved the fifteen-recommendation expansion. Current implementation, evidence and unbuilt scope are tracked in `docs/FULL_GAME_ROADMAP.md`; this is not a completed five-region or 6-10-hour production release. The first foundation adds the atlas, fifteen contracts, a linked three-chapter record, research-client reputation, earned blueprint rewards and validated local save recovery/export/import. A subsequent pass adds the Blender-authored rechargeable Manta dive drive, real blueprint fabrication and range-limited sonar. The ocean, both vessels and supplied character identity remain preserved. Ads remain deferred.

Mill's prior agent could not be resumed in this runtime. Euclid (`01a10f29-dfb5-7a92-a997-460b6f93c726`) replaces it as the ONE read-only critic; no second concurrent critic or parallel coding worker was created. Historical category scores above are not silently transferred into a new certification. Euclid found two P2 issues (clipped landscape equipment and hidden fabrication errors), followed by one P1 (nested-version recovery rollback). All three were repaired and source-rechecked; no further concrete P1/P2 blocker was found within this limited scope. Screenshots confirmed that the revised hands reach the authored drive handle area and that short-landscape controls are contained. They do not independently establish physics measurements or a full-game score.

All 57 focused Node checks pass. Actual-control CLI checks verified model/storage fabrication failures without spending credits, one 650-credit purchase, reload retention, normal versus powered travel, grip alignment, battery depletion and recharge, safe normal swimming at zero charge, ascending body pitch, sonar without free station acquisition and reachable equipment at four viewport sizes plus real browser touch taps. Equipment/starting bank were seeded only in isolated preview saves; the campaign itself was not earned in those fixtures. The earlier new sampling-contract playthrough started with no cargo and earned a real 510-credit receipt. No user save was seeded or replaced.

The first complete browser run was 41/42, exposing Save interception in the touch More menu. It was fixed, with a fresh 35/35 affected-regression pass. A new clean 42-case gate is running after the field-tool changes; final build/package checks pass at 23 files / 47.32 MB. Tool screenshots displayed approximately 17-21 FPS in a non-isolated CLI context; performance is still an open release risk. No new AAA score, physical-device certification, hosted deployment, Git publication or live ad delivery is claimed. Release remains HOLD.

## October 7 Critic Continuation

The same critic, Euclid, resumed. No concrete P1/P2 regression was found in Camera-only photographic targeting or the repaired shore-walk test budget. A real pier walk took 45.955 seconds and opened the counter, demonstrating that the former 45-second budget was inadequate at the unchanged calibrated pace. The 90-second budget preserves arrival/payment/purchase/reload assertions. Actual browser instrumentation recorded zero unused target evaluations for Scanner/Sampler/Cutter, while Camera retained targeting and shutter-time validation.

| Visual criterion | Current sampled score |
| --- | ---: |
| Composition | 1.6/2 |
| Asset coherence | 1.5/2 |
| Lighting/materials | 1.5/2 |
| Environmental richness | 1.4/2 |
| Interface presentation | 1.6/2 |
| Total | 7.6/10 |

The counter/camera screenshots are current October 7 captures; the retained grip views remain representative of unchanged equipment art. Simplified coral forms, shoreline/material transitions and canopy-heavy counter framing limit visual polish. Gameplay remains unscored: current complete-play verification, earned expanded campaign/blueprint progression and sustained responsiveness evidence are incomplete. Do not silently raise historical gameplay scores or force an 8/10 result.

The fresh build/package and all 57 Node checks pass. The persistent browser log `output/playwright/oct7-full-qa.log` records 35 completed checks before the runner stopped; the remaining seven passed separately (7/7 in 10.2 minutes). All 42 existing cases passed across two sequential runs of unchanged game code, not one uninterrupted invocation. The twelve-second lagoon sample measured 59.8 FPS with 17.9 ms p95 on local AMD/D3D11, 1280x720, Performance scale 0.65; passage samples were 41.9-53.7 FPS with 26.9-30.2 ms p95. These are not isolated improvement claims or physical-device guarantees. Larger authored regions, actual earned blueprint verification and sustained performance remain the next priorities. Ads and publishing remain deferred; production remains HOLD.

## October 7 Scanner and Publishing Round

The user now authorizes pushing or deploying verified changes; this supersedes the earlier publishing deferral, not the ad deferral. Automatic underwater sweeps and selectable identification show actual pending instruments and modeled wildlife, with range/depth/bearing, last-fix labeling, notes and an appropriate field action. Detection grants no mission progress. The same sole critic caught manual-pulse starvation; a separate manual timestamp repaired it. Its re-review closed that issue and the portrait/touch-fit scope without a remaining concrete P1/P2. The rubric and sampled 7.6/10 visual score remain unchanged; gameplay is provisional and production remains HOLD.

Evidence: `output/playwright/scan-desktop.png`, `scan-wildlife.png`, `scan-touch-top.png`, `scan-touch-bottom.png` and four touch viewport captures. Emulated touch reached both landscape scroll ends and operated Power/manual controls; `selectOption` checked contact selection, not native physical-picker behavior. The 320x568 panel stays below the measured wrapped HUD. Canvas color/brightness and motion checks pass across all four sizes. All 62 Node tests and the final build/package pass. Twenty-six existing state/gameplay/responsive cases pass across scoped runs; this is not a fresh 42-case release gate. Initial passage/responsive whole-test deadline failures are retained in the log; only total budgets changed, not per-action waits or assertions. Both reruns pass. Complete-route play earned the three actual payouts and retained progress after reload.

Current non-isolated twelve-second Performance samples remain variable (lagoon 55 FPS; passage 45.8-54.1), not sustained guarantees. Publishing uses the standalone GitHub repository; the connected Cloudflare listing contains no `ocean-adventure-game` project. No unrelated site will be overwritten. Full authored expansion, normal-play blueprint progression, sustained/device QA and asset-rights review remain open.

## October 8 Wreckward Round

The same sole read-only critic reviewed the authored freighter integration and four fresh captures. Earlier scoped concerns were repaired: hull clearance before carried-drive ascent, persistent mobile save-failure feedback and the distinction between recoverable incomplete routes and unsupported future routes. No new concrete P1/P2 was found in this scoped source/capture review. Flat-looking wear, sparse corridor dressing and faceted rocks remain below the concept target. The sampled visual score stays 7.6/10, gameplay provisional and production HOLD.

Fresh author-run evidence: 97/97 Node checks; 20/20 selected existing browser regressions; production build/package pass at 24 files / 49.55 MB. `output/playwright/reach-browser-final.log` reports no runtime errors, actual field actions, failed-write retry, drive withdrawal, legitimate partial reload, deck collision, separate port exit, 1,100-credit harbor payment, duplicate-sale protection and persisted receipt. Four viewport pixel checks and embedded-image loading pass. Four prerequisite chapter receipts and drive ownership were seeded; no freighter cargo or starting credits were pre-earned. This is new-mission proof, not an earned five-chapter/full-release or sustained-performance assessment. The full roadmap retains all outstanding regional, progression, art and release gates.

## October 8 Wreck Material Review

The same read-only critic rejected an initial all-over rust iteration because large mottled patches obscured close-up structure. The final 09:54:45 interior capture repairs that regression: paint is dominant, seam rust separates panels, and beams, fittings and cargo hardware read more clearly. The nearest wall/ceiling remain soft and the corridor still falls short of the concept's material richness. No new concrete P1/P2 was found in the final visual scope. Visuals remain 7.6/10, gameplay provisional and production HOLD; captured 60 FPS is not a sustained benchmark.

The accepted model is 1,805,324 bytes with nine visible batches and 38,580 visible vertices. Browser decoding confirms 1024-pixel hull/steel maps and 512-pixel enamel/stone maps. The final 98 Node checks, production build and 49.36 MB package pass. Twenty selected existing browser cases pass. Final mission replay evidence is recorded in `output/playwright/polish-final-wreckward.log`; the same four prerequisites and drive ownership are seeded, not normally earned expanded-campaign proof.

## October 8 Sentry ROV Review

The same sole read-only critic reviewed the Blender-built scout and integration. Scoped fixes preserve paid ownership through incomplete/null/falsy records, sweep the full vehicle radius against the legacy wreck, retain unique diver-panel identity, make small-screen free recovery reachable, and route ROV emergency recovery through the same body/cable/light/sensor cleanup as recall. Paid equipment uses root save version 3 to protect it from pre-ROV writers. A final P1 review caught recoverable missing equipment masking explicit future nested schemas; all explicit version/route guards now run first, with combined backup regressions.

Author-run evidence: 114 Node checks, successful production build/package at 26 files / 49.84 MB, 20 selected existing browser cases, and an actual-control ROV walkthrough with model/storage failure protection, one 900-credit fabrication, stationary yacht, motion/turning/depth, both views, sonar/manual cooldown, pause freeze, conservative 118.88-meter center limit, recall/reserve recovery, unchanged cargo and saved ownership/bank. Five prerequisite receipts and 1,100 credits were seeded; acquisition/piloting are real, not proof of an earned expanded campaign. Separate emulated-touch checks exercise depth holds, lamps, sonar and normal/emergency recovery at three compact sizes. Captured FPS is not sustained performance; a straight visual tether is not physical cable wrapping, and the modeled manipulator does not yet collect salvage. Visuals remain 7.6/10, gameplay provisional and production HOLD.

## October 8 Observatory Round

The same sole read-only critic reviewed the sixth chapter. Scoped repairs route rear/depth approaches around the hull, prioritize explicit diver withdrawal over terminal navigation, continue diver assistance through intermediate entrance waypoints, and separate narrow-screen ROV controls from the action dock using measured clearance. Active pilot feedback moved into the scrollable ROV panel; terminal buttons retain a 44-pixel touch height. Fresh three-size touch captures close the overlap finding. The restrained shared-wear paint improves the rejected full-map corrosion pass, but plain terminal faces, sparse dressing and softer detail remain below the reference target. The rubric and sampled visual score remain 7.6/10; gameplay stays provisional and production HOLD.

Author-run scoped evidence: 122 Node checks, successful production build/package at 27 files / 49.97 MiB, and 20 selected existing browser cases. The core ROV replay earned three terminal records, retried failed storage, resumed a partial checkpoint, rejected wrong-facing acquisition, returned for 1,150 credits and retained a pay-once receipt. Subsequent UI and diver-specific refinements have separate three-size emulated-touch and physical GLB-player entry/withdrawal checks; missing-equipment acceptance and automatic departure are also checked. Prerequisite receipts and ROV ownership are seeded fixtures, not normal-play six-chapter proof. Evidence is in `pelagic-browser-published.log`, `pelagic-touch-published.log`, `pelagic-withdrawal-published.log`, `pelagic-equipment-gate.log`, `pelagic-unit-release.log`, `pelagic-build-release.log` and `pelagic-regression-release.log` under `output/playwright`. Complete campaign, sustained performance, physical-device, hosted/embed and rights gates remain open.

## October 8 Weather Round

The same sole read-only critic reviewed the saved voyage clock, six scheduled fronts, forecast, finite overrides, night/underwater lighting, harbor rest and root-v5 recovery guards. Its midnight azimuth P2 is repaired with a continuous daily-periodic direction and boundary-vector tests. Final source/capture review found no remaining scoped P1/P2. Author emulated-touch QA caught the inherited landscape 32px sea-state rule; forecast buttons now remain 44px and all three touch layouts pass. No score increase: visuals 7.6/10, gameplay provisional, production HOLD.

Author evidence: 146 Node tests; actual opening/retry/reload and four layouts; six nonblank weather/time fixtures and four forecast layouts; actual setting failure/reload/auto, night throttle/dive and supplied third-person player; disabled rest while diving, failed harbor rest preserving the clock and successful 07:00 rest preserving credits/cargo/equipment; three emulated-touch sizes with actual weather/close taps. Clock acceleration and copied opening receipt are fixtures. These checks do not establish a normally earned full campaign, long open-water night navigation, physical-device performance, sustained FPS or hosted delivery. Final package/build/selected regression logs are recorded separately in the roadmap. Ads remain deferred.

## October 8 Calypso Round

The same sole read-only critic reviewed material recovery, crafting, finite pod service and current-version save protection. Scoped repairs clear cancelled field-navigation intent even after reading stops cruise, relocate work areas without removing original rocks, stage rear/side pod approaches above the cabinet, cap desktop/landscape panels below measured HUD bounds, move old boat feedback out of the narrow dock, and account for chart borders before drawing separated markers. The final manual inspection also exposed and repaired pitch-inverted chase framing: both downward and near-floor upward captures now keep the supplied diver fully in frame. No outstanding P1/P2 remains within the reviewed source/capture scope. Kit components are recognizable, but plain material detail and sparse surrounding dressing do not justify a score increase. Visuals remain 7.6/10, gameplay provisional and production HOLD.

Author-run evidence: 137 Node tests, 20 selected existing browser regressions after the final camera change, successful build/package at 28 files / 48.62 MiB, actual core recovery/crafting/service/resupply/reload, three emulated-touch ROV-service fixtures, and four final diver layouts. The core replay recovers four cases across two regions and spends 625 of a seeded 1,000-credit bank, retaining 375, with no-refill pack/redeploy and five failed-write protections. Extra old chapter receipts, Manta ownership and initial bank are fixtures; the ROV touch check seeds its unlocks/ownership/charge while copying the earned material/kit record. This does not establish normally earned whole-campaign play or all fifteen cases by actual traversal. Full kit/player inspection, fully visible 44-pixel controls, nonblank canvas and current source/schema checks are scoped proofs, not sustained FPS, physical-device, hosted/embed or asset-rights certification.

Evidence under `output/playwright`: `salvage-browser-release.log`, `calypso-touch-final.log`, `calypso-layout-final-camera.log`, `salvage-unit-published.log`, `salvage-build-published.log`, `salvage-regression-release-final.log`, `salvage-portrait-encoding.log`, and the fresh `calypso-runtime-inspection.png`, `calypso-player-inspection.png`, `calypso-floor-chase.png` and viewport layout captures. No Cloudflare deployment or live ad delivery is implied by these local checks.

## October 8 Mastery Round

The same sole read-only critic reviewed two ordered post-campaign water-column voyages, root-v6 protection, saved yacht anchors, actual field acquisition and harbor payment. Its P2 about assist remaining disabled after a completed campaign is repaired. Subsequent source/capture reviews accepted mastery-first sonar ordering, leg-change context invalidation, prominent report status, clock labels and the native-click input repair. Final scoped verdict: no outstanding P1/P2. Visuals remain 7.6/10, gameplay provisional, production HOLD.

Author replay recorded three actual coastal stations and five actual regional stations, retained an actual yacht checkpoint after reload, retried failed start/reading/payment writes, prevented normal contracts from replacing a voyage, confirmed abandonment and paid 900 then 1,500 credits only at harbor. A seeded 500-credit bank ends at 2,900. The five-region route crossed naturally from calm to bluewater. All eight station records were acquired through actual controls; six prior chapter receipts, normal paid-contract metadata and ROV ownership were fixtures, not an earned whole campaign.

Final emulated touch covers 390x844, 844x390 and 320x568 board layouts, 44px controls, nonblank native canvas samples and an actual underwater reading with a declared near-stop yacht checkpoint. It exposed pointer-down mode switching retargeting the touch click into Inventory; discrete mode/music commands now use native click. Desktop Enter activation, physical return to helm, nonblank canvas and the supplied third-person player also pass. This is not real-device or audio-listening assurance.

Evidence: `mastery-opening.log`, `mastery-browser.log`, `mastery-five.log`, `mastery-touch-final.log`, `mastery-input-final.log`, `mastery-unit-final.log`, `mastery-build-final.log`, `mastery-package-final.log`, `mastery-regression-final.log` and corresponding station/board/diver captures under `output/playwright`. The full release suite, sustained performance, long human campaign/retention assessment, asset rights and hosted/embed gates remain open; ads stay deferred.

## October 9 Full Existing Regression Gate

The baseline completed 40/42 in 20.2 minutes. Both failures were initial swim-mode assertions in the above-vault fixtures: they still dispatched pointerdown after discrete mode commands changed to native click. Exactly two fixture events now dispatch click. Runtime code, action deadlines and all inward-momentum, clearance, path, physical boarding and pay-once assertions remain unchanged. The same sole read-only critic found no scoped P1/P2 in this repair or the historical-report clarification. This is not a new gameplay feature or a rating increase.

A fresh uninterrupted run passed all 42 existing cases in 20.8 minutes, with no retries. Actual controls completed the reef, lagoon and limestone-passage routes, both vault-return probes, purchase/save/recovery protections, photo framing, responsive HUD and spatial LOD checks. Reward-provider cases use mocks only; live ads remain deferred. The final 158 Node checks, production build and package check pass at 28 files / 48.64 MiB. Evidence under `output/playwright`: `release-full-baseline.log`, `release-full-final.log`, `release-unit-final.log`, `release-build-final.log` and `release-package-final.log`; fresh route captures/path records are under `output/gameplay-round4`.

Twelve-second final samples on local AMD/D3D11, 1280x720, Performance scale 0.65 measured lagoon 59.6 FPS / 18.6 ms p95 and passage garden/interior/exit 60.0/59.9/60.0 FPS with 17.2/17.6/17.3 ms p95. Samples are not isolated, sustained benchmarks or physical-device guarantees. The existing 42-case suite does not normally earn all six newer chapters, every material case, equipment unlock or mastery voyage. Those systems retain separately declared scoped fixture evidence; full fresh-save campaign, human retention, sustained performance, physical-device, asset-rights and hosted/embed gates remain open. The old multi-judge `AAA_GAUNTLET.md` report is explicitly superseded. Visuals remain 7.6/10, gameplay provisional, production HOLD. Git publication is not Cloudflare deployment.
