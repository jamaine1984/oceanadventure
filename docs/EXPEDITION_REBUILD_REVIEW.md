# Ocean Adventure expedition rebuild

Working project: `C:\Users\koike\Downloads\kidsgenuisworld\ocean-adventure-game`.
Local preview: `http://127.0.0.1:4174/`. The preview serves `dist`; rebuild with `npm run build` before reloading.

## Implemented

- Marine research chapter: harbor briefing, reef survey, exterior wreck recovery, safe return and explicit research cargo sale.
- Camera, sampler, cable cutter and scanner, with real range/frame checks and contextual prompts.
- Seven observable species, 25 animated animals, coral forms, contoured seabed, seagrass and limestone formations.
- Supplied rigged land and diving characters, each with separate runtime GLBs. Land uses Idle/Walk/Run; the dedicated diving model uses Mesh2Motion's retargeted Swim Fwd and Swim Idle on its existing 65-joint Mixamo skeleton. First person, chase and diver portrait views share the actual movement controller.
- Grounded island walking: leave the moored boat, use WASD/drag look/Shift run, visit both counters, follow the trail, and board at the west gate. An articulated upright researcher appears in third person. Optional Walk assist plans collision-aware routes, yielding during planning to keep the interface responsive; manual movement/look cancels it.
- Optional cruise and swim assist use the actual movement and collision controllers. Manual input cancels assist. Wildlife assist tracks a subject while the player presses Photograph. Harbor return uses a staging approach outside the piers.
- Original island harbor with authored coves/shore zones, piers/piles/braces/fenders/cleats/rope coils, boardwalk, steps, research exchange, dive outfitter and equipment displays.
- Sample rewards buy engine, tank, hull, fins, dive light and the Voyager vessel. Starting Aurora is free. No real currency, store, advertising or CrateShip connection is active.
- Local progress saves milestones and every 20 seconds. Reload restores the saved island position when ashore, or resumes aboard the vessel at a safe checkpoint. Journal stores unique species and small JPEG photographs. Cargo sale persists credit balance and sale receipt together to prevent a second payout. Gear and boat purchases commit only after successful saving.
- Batched static harbor geometry and instanced foliage/rocks/corals/grass. Quality uses shadows at a bounded resolution and throttled shadow updates. Graphics programs are prepared before releasing the loading overlay.

## Reference-first art process

Original reference images were generated before building the reef, wildlife, wreck, harbor and diver. Additional foliage, limestone and teak textures replaced synthetic-looking materials after critic feedback. Exact prompts and built-in generation mode are saved in `assets/references/EXPEDITION_REFERENCES.md`; references are in the same directory and runtime textures in `public/textures/expedition`.

The boats and supplied animated characters have editable Blender assets; environment, wildlife and mission geometry are authored in Three.js. These are navigable scenes, with foliage cards used for leaf detail. Character source preservation, exact reference prompts and the Mesh2Motion animation workflow are recorded in `assets/references/CHARACTER_REFERENCES.md`. Future character reference images must be separate single-view images, as requested.

## One-critic visual gate

The same independent critic that assessed the boats is judging the island in actual browser screenshots. The requested minimum is 8/10. Review history: V1 5.4; V2 6.4; V4 7.2; V5 7.9; V6 8.0. The same critic accepted V6 after the matching triangular plaster gable closed the wall-to-roof intersection. Final category scores: terrain/shoreline 8.0, buildings/work areas 8.1, docks 8.0, vegetation 7.8, materials/lighting/contact 8.0, composition/readability 8.1. The unchanged weighted result is 8.00/10. No visible structural blocker remained in the supplied Quality captures. Optional polish remains for palm variety, bare hill variation and local prop/plaster wear. Evidence: `output/expedition-review/harbor-stand-v6-quality.png` and `harbor-counter-v6-quality.png`, together with the unchanged V5 approach and shoreline views.

This is an environment visual score. It does not certify gameplay, desktop/mobile performance or the entire game as AAA.

### Walking review on October 1, 2026

The same single critic separately reviewed the new close walking views: first package 7.1, V2 Quality 7.7, V3 Quality 8.0. Final trail and counter each scored 8.0. Fixes included curved fuller palm crowns, grounded leaves with stems/veins, photoreal grove-floor material, blended path edges, stones/litter, printed specimen labels, ribbed circular caps and distinct sample contents. No blocking construction defect remained in these supplied views. Optional polish: soften floor texture contrast and vary neighboring palm crowns further. Evidence: `output/expedition-review/island-walk-trail-v3-quality.png` and `island-walk-counter-v3-quality.png`. Quality was explicitly enabled on that load and no reload occurred between captures.

### Underwater review

An actual rendering bug made the reef invisible: caustic shader integration wrote at the wrong output stage. The fixed shader calculates world position with authored/instanced vertices and adds caustics to outgoing light before the opaque fragment. Browser captures now visibly show the seabed, coral and wildlife. The first visible underwater package scored 5.6. V3 improved to 6.8 (reef 7.0, diver/wildlife 6.5, wreck 6.8). V3 filenames say Quality but their mode was not confirmed after preset navigation; treat those as observed captures, not confirmed Quality evidence.

The same single critic reviewed explicitly enabled Quality captures: V4 7.5, V5 7.9, V6 8.0. Final reef and diver/wildlife scores are 8.0; unchanged V5 sampler and wreck each retain 8.0. Changes include curved seagrass, irregular coral branches/plates/fans and embedded varied margins, textured scales/fin rays/spotted ray skin, breached wreck plating/exposed ribs/collapsed roof, a supported mast and UV-matched terrain burial, finished metal sampler hardware/calibration, fitted gloves/continuous pelvis/thigh forms, suit seams and thin ribbed fins. No blocking visual construction defect remained in the supplied gameplay views. Optional future polish: reduce repeated beige branching coral, add natural suit wear and asymmetric wildlife detail. This accepts gameplay-scale still visuals, not animation, physical inputs, performance, or the whole game as AAA.

Final evidence: `reef-v6-quality.png`, `diver-v6-quality.png`, `diver-v6-angle-quality.png`, `sampler-v5-quality.png`, `wreck-v5-quality.png` under `output/expedition-review`. Quality stayed enabled for the V6 reef/diver captures. The attempted `diver-v6-detail-crop.png` contained HUD/rocks and was excluded from the critic review; only the full rear/angled views establish avatar acceptance.

## Verification record

### Supplied character checkpoint on October 1, 2026

- Preserved both original user GLBs unchanged in `assets/characters`. The land runtime is 3,926,296 bytes; the diver runtime is 4,626,876 bytes. Each uses a 2K texture rather than the original 4K texture.
- Used the actual Mesh2Motion retargeting UI, uploaded the rigged diver, auto-mapped its 65 Mixamo joints and downloaded Swim Fwd and Swim Idle. The downloaded animation export is preserved. Packaging retains the supplied mesh, skin and bind transforms and copies mapped animation tracks into them; horizontal hip travel is removed because gameplay owns translation. The clips are 1.667 and 4.167 seconds. No replacement rig or duplicate equipment is added to the supplied diver.
- The same single critic accepted the supplied shore character at 8.2/10 and the supplied dedicated diver at 8.2/10 in actual Quality browser views. The earlier experiment that put diving equipment on the shore clothing was rejected at 7.2 and is superseded by the user's dedicated diver. These are still-image visual scores, not animation or performance certification.
- Actual land Walk assist reached the research counter with the supplied walking character and opened the stand. On the final supplied diver, actual Swim assist reached the water and sediment sites; both collection actions updated the mission. Wildlife assist framed a blue tang, Photograph saved its image, and the journal reported 1/3 species, 2/2 samples and 470 credits in cargo. Save/reload retained both samples and that journal photograph. Free low-air recovery returned aboard with progress retained.
- Live moving capture `output/character-review/supplied-diver-forward-motion-final.png` shows the supplied diver in a prone swimming pose at 5 knots. Settled rear and portrait captures are `supplied-diver-rear-quality-v1.png` and `supplied-diver-portrait-quality-v1.png`. First person, chase and portrait camera selection worked. Offline clip bounds also varied across sampled poses. These checks do not certify every stroke, transition or physical input device.
- Graphics mode now persists across reload; the separate QA session restored Quality as selected. Paused simulation stops advancing world time, resume/visibility changes reset the frame clock, and covered underwater geometry is hidden while the camera is above water. Manual mouse and gamepad look cancel assist. Final captured console warning/error logs for the character QA reload were empty; production TypeScript/Vite build passed.
- Quality-mode HUD snapshots varied roughly 12 to 41 fps during these checks; the art tool and other preview tabs were also open, so these are not isolated or sustained benchmarks. Desktop/mobile profiling and lower-detail character/shadow tuning remain required before release. Normal saves are isolated from localhost QA session saves. Temporary art/QA tabs were closed; the normal live preview restored the user's saved on-foot location and was left open in third person. Its canvas matched the current 1625x884 viewport.

### Earlier expedition checks

- TypeScript and Vite production builds pass.
- Browser camera capture recorded a blue tang and a saved journal entry.
- Sampler was disabled out of range and enabled after real swim assist reached the water site. Water and sediment collection each updated the actual mission state.
- Low oxygen automatically invoked free recovery while preserving earned survey progress.
- The earned reef record advanced after three unique species photographs and both samples. Actual boat cruise reached the wreck; the diver approached the cable and sensor using the movement controller, released the cable, scanned the bearing and recovered the sensor. Free rescue returned the diver aboard, and actual boat travel used the outer harbor approach before docking.
- The research ledger paid 1,510 credits for three photographs, two samples, the recovered sensor and the completion bonus. Its sale button became disabled. Tank (350), fins (280) and light (320) purchases left 560 credits; reload preserved that balance, level-one equipment, the sale receipt and one completed expedition. Starting another expedition cleared current objectives and retained earned equipment/balance. The explicit Save button reported the harbor checkpoint.
- Quality mode visibly prepared graphics and resumed rendering. Phone portrait and landscape checks exposed control overlap and focus-induced container scrolling; responsive layout and overflow clipping were corrected. Landscape recheck confirmed the mission HUD, sea controls, navigation, dive tools and touch/action controls occupy separate areas. Portrait dive layout hides sea-state controls to keep all telemetry visible. Renderer sizing now changes the drawing buffer without leaving inline pixel widths; initialization and graphics changes refresh the camera aspect ratio, preventing a narrow canvas after viewport restoration. Final DOM checks confirmed the canvas matched 390x844 in phone mode and 1292x884 after desktop restoration, with no fixed inline width/height. Final browser error logs were empty. These are emulated viewport checks, not a physical-phone performance or touch-input certification.
- In separate seeded shop previews, Voyager purchase deducted 1,800 credits from 2,500, equipping the already owned Aurora kept the remaining 700, and an engine upgrade left 250. Reload retained that 250-credit balance and the owned fleet/engine level. A separate 1,600-credit harbor preview verified the 400-credit hull upgrade, leaving 1,200 and level one. All five equipment purchase types were checked; physical effect/balance testing on real hardware remains open.
- Fresh harbor briefing advanced to a new reef survey. Actual cruise departure reached the reef and disabled assist at 28 m with the research-site arrival prompt.
- Actual on-foot assist reached the research counter, island trail, dive outfitter and boarding gate using the grounded controller. Both counters opened in range; boarding was disabled away from the gate and restored Helm at the gate. Normal save/reload restored an island position. These browser checks do not substitute for physical keyboard/controller/touch testing.
- In a separate return preview, the outfitter correctly disabled cargo sale and directed the player to the research counter. Walking there enabled sale; 1,510 credits were paid once. Reload restored the same counter position, 1,510 balance, one completed expedition and disabled sale receipt. A tank purchase while ashore left 1,160 credits and level one; beginning another expedition retained those credits/equipment and cleared current objectives while the player remained on foot.
- Walking HUD was inspected at 390x844 and 740x390: destinations, nearby interaction, touch controls and action dock occupy separate areas. Desktop viewport was restored. Captures: `mobile-walk-portrait.png` and `mobile-walk-landscape.png`. These checks verify layout, not physical touchscreen responsiveness or sustained mobile frame rates.
- After V4 environment additions, actual swim assist reached both water and sediment sites, enabling both collections. At the revised wreck it reached the cable, released it, and approached/recovered the sensor, advancing to return with 7/8 objectives. The later V5/V6 changes are art refinements; collision volumes were unchanged.
- Historical V6 TypeScript/Vite production build passed. Browser logs contained no captured errors; non-fatal Rapier initialization deprecation and graphics precision warnings were observed on that load. A fresh normal preview restored the user's saved on-foot island location. Graphics persistence was added in the later supplied-character checkpoint above.
- Gameplay checks used a localhost reef preset with separate session storage to protect normal saves; survey/tool/travel/reward actions used the actual UI and controllers. This is not a complete hands-on keyboard/controller/touch playthrough from a fresh harbor start.

## Practical boundaries

- Browser local saves are device-specific. No cloud save or account sync is implemented.
- Rock collision is an approximate ellipsoid and the wreck has an exterior exclusion volume. Vessel collision is a sized cuboid. Island walking uses circular collision against terrain slopes, deck transitions, counters, railings, props and trees; shoreline/high ledges stop the walker. The wreck mission remains exterior.
- Wildlife follows bounded swimming paths rather than complex ecological AI.
- Real keyboard/controller/touch hardware playtesting, sustained profiling and chapter timing remain required before release. Review screenshots alone are not benchmarks.
- This work is local and uncommitted; no production deployment was requested for Ocean Adventure.

## October 1: boarding and supplied land motion revision

- Land model now uses actual Mesh2Motion retargeted Idle Subtle / Walk Formal / Run Female source clips. The original user GLBs remain unchanged. The first Walk/Jog and wider natural run were rejected by the user and are superseded.
- Run has been calibrated into a compact jog: less thigh reach, less knee flex and lower flight. Runtime maximum fore/aft foot separation is about 0.700 m, versus about 0.998 m in the previous revision. Separate geometry-based hip correction removes sole penetration at jog keyframes. Original geometry and bind data are preserved.
- Walking is the default, at 1.4 m/s. Jogging is 2.2 m/s and requires held Shift / held Jog / gamepad boost. Animation intent is explicit. No sticky Run toggle. HUD shows Walking or Jogging while moving; third-person land view is the default.
- Return to boat follows the collision-aware pier route and boards on arrival. Board boat is immediate near the boarding gate; E works there. Manual movement or dragging cancels the return. The route completion notice now checks actual landmark proximity.
- Browser checks: prior boarding return from the research counter and E at the gate reached Helm with Dive enabled; Dive entered the water. Current revision visibly uses Walk assist at 1.4 m/s with Walking status. Build and offline animation inspection passed. Physical keyboard/touch hold feel still benefits from user play feedback. No new environment or animation quality score is claimed from these checks.
- Asset pipeline: `package_land_motion.py`, Blender `ground_land_jog.py`, Blender `inspect_land_motion.py`; `render_land_motion_review.py` creates separate side-view motion references. The old `prepare_player_character.py` is superseded for land and must not overwrite the runtime.

## Main source files

- `src/main.ts`: control, camera, tools, progression UI and chapter flow.
- `src/expedition-state.ts`: coherent objective/save records and reward calculation.
- `src/expedition-world.ts`: authored terrain, wildlife, reef, wreck, harbor and interaction collision.
- `src/player-character.ts`: supplied model loading, independent skeleton/mixer cloning and movement animation blending.
- `src/research-diver.ts` / `src/research-walker.ts`: recovery characters if supplied assets fail to load.
- `src/island-walk.ts`: grounded island controller and route planning.
- `scripts/package_land_motion.py` / `scripts/calibrate_land_stride.py` / `scripts/ground_land_jog.py`: current supplied land motion packaging.
- `scripts/prepare_supplied_diver.py`: supplied diver packaging.
- `src/progression.ts`: vessels, equipment and backward-compatible local save loading.
- `src/styles.css` / `index.html`: responsive HUD, journal, tools and harbor UI.

`scripts/upgrade_expedition.py` records the initial migration and must not be rerun over the revised source. It assumes the earlier engine layout.





