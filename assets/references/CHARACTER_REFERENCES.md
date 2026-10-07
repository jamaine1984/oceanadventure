# Supplied character references and animation sources

## Character files

- Land original: `assets/characters/ocean-human-source.glb` (user supplied, unchanged).
- Diver original: `assets/characters/ocean-diver-source.glb` (user supplied, unchanged).
- Mesh2Motion export: `assets/characters/ocean-diver-mesh2motion.glb`.
- Initial land motion export: `assets/characters/ocean-human-mesh2motion.glb` (superseded Walk/Jog/Idle Subtle).
- Current land motion export: `assets/characters/ocean-human-mesh2motion-natural.glb`.
- Active walking and swimming character: `public/models/ocean-player-character.glb`.
- Preserved original land runtime: `assets/characters/ocean-human-land-runtime.glb`.
- Preserved diver motion source, not a runtime player download: `public/models/ocean-player-diver.glb`.

On October 4, 2026, the user superseded the earlier separate-model selection: the SAME supplied character must walk and swim, with no procedural player replacement. `scripts/package_player_swim.mjs` retains the original land mesh, texture, rig and three land clips byte-for-byte and adds retargeted prone swimming clips. Both modes clone the same cached runtime GLB. SwimIdle is a slowed prone Swim cycle; the older upright spread-arm idle is not used. Per-mode materials are independent, while geometry and textures are shared. A failed required GLB load blocks startup with Retry instead of substituting another person.

The animation provenance below records the historical source exports. Do not rerun the older preparation scripts over the current shared runtime. Regenerate the combined runtime with `node scripts/package_player_swim.mjs`.

## Animation provenance

On October 1, 2026, used https://app.mesh2motion.org/retarget/ in the browser. Uploaded the supplied diver, chose Human, used Auto-Map (recognized Mixamo and mapped 65 joints), and selected **Swim Fwd** and **Swim Idle**. Arm extension was 0%; no mirroring; full GLB default export. The completed download was `C:/Users/koike/Downloads/retargeted_animations.glb`, despite the browser download-event listener timing out. Both animation tracks were verified in that local file before packaging.

Source clips: `Swim_Fwd_RT` (1.6667 s), `Swim_Idle_RT` (4.1667 s). Runtime names: `Swim` and `SwimIdle`. Retargeted animation channels are attached to the original GLB's bone names without changing its geometry, bind matrices, or joint axes. Horizontal root travel is removed; the game controller owns collision and travel. The texture is reduced from 4K to 2K; separate walking and diving mixers blend by actual movement speed.

Mesh2Motion describes its animation assets as CC0: https://mesh2motion.org/ and https://github.com/Mesh2Motion/mesh2motion-assets/blob/main/LICENSE. This refers to those animation assets, not a new license determination for the user-supplied characters.

The first shore model used authored clips from `scripts/prepare_player_character.py`. Those are superseded; do not run that script over the current land character. The user requested real Mesh2Motion clips, then rejected the first Walk/Jog set as too wide and robotic.

### Current land locomotion

On October 1, 2026, uploaded the unchanged supplied land GLB through Mesh2Motion's existing-rig retarget UI. Human / Auto-Map recognized its 65 Mixamo joints. Current selected clips are **Idle Subtle**, **Walk Formal**, and **Run Female**; the latter is the library's natural running cycle, used on this supplied male rig. Export settings: full GLB, 0% arm extension, no mirroring. Original download: `C:/Users/koike/Downloads/retargeted_animations (2).glb`.

Runtime names/durations: Idle 2.5833 s, Walk 1.6667 s, Run 0.8333 s. `scripts/package_land_motion.py` attaches the clips to the original supplied mesh/skin/rest joints, reuses the prepared 2K texture and removes horizontal hip travel. It calls `scripts/calibrate_land_stride.py` to narrow foot lanes through thigh adduction (Idle 5.5 degrees, Walk 4.5, Run 3.0), with counter-rotation at each ankle preserving the original foot orientation. The user's latest revision makes Run a compact jog: thigh rotation excursion is 55% of the source, knee excursion 58%, and flight height 30%. Hip height is adjusted for the longer supporting leg. This changes animation tracks only. Source GLBs and original mesh/bind buffers remain intact.

After packaging, run `scripts/ground_land_jog.py` through Blender to remove sole penetration at jog keyframes using evaluated mesh bounds. Then run `scripts/inspect_land_motion.py` to verify poses and update `assets/blender/ocean_player_character.blend`. Set Blender to 30 fps before importing so GLB sample times match evaluation frames. Current maximum forward/backward foot separation is about 0.700 m (about 30% shorter than the previous 0.998 m run), maximum lateral separation is 0.258 m. Walking lateral separation is 0.288 m. These are offline joint measurements, not a claim of perfect ground contact or a subjective animation quality score.

Game pace is 1.4 m/s walking and 2.2 m/s jogging. Animation playback uses approximate grounded-foot motion rates of 0.69 m/s for Walk and 1.64 m/s for the compact jog. Normal movement and Walk assist select Walk; jogging requires holding Shift, the gamepad boost binding or the island's Jog hold button. Releasing the control blends back to walking. The old sticky Run toggle is removed. Run animation selection now follows explicit jog input, not speed alone. The HUD identifies Walking or Jogging during movement. Walking facing now follows resolved travel smoothly and independently of the camera; underwater portrait look orbits independently of swim heading.

`scripts/render_land_motion_review.py` renders the actual runtime clips from a side view, with separate Walk and Run frame folders under `output/character-review/`. The GIFs there are motion review artifacts, not in-game capture.

Run `scripts/prepare_supplied_diver.py` for the supplied diver and its downloaded swimming clips. The diver has a separate editable scene `assets/blender/ocean_supplied_diver.blend`.

## Image references

Built-in image generation was used; no external image API key. The initial sheet preceded the second supplied GLB. The user then requested **separate single-view images for every future reference**, which is the current preference.

### Initial wardrobe sheet

Saved: `assets/references/ocean-character-drysuit-reference.png`.
Reference image: local inspection render `output/character-review/standing-character.png`.
Prompt:

Use case: identity-preserve. Asset type: Ocean Adventure 3D game character dive wardrobe reference sheet. The attached image is a reference of the exact supplied character, not a texture atlas. Preserve precisely his recognizable face, short curly hair, beard, ethnicity and body proportions. Build a premium realistic fitted navy and charcoal research diving drysuit for THIS SAME MAN, replacing only shore clothing. Three full-body views front, side, rear on a pale neutral studio backdrop, centered, no text. Purposeful articulated fabric folds, blue seam piping, sealed rubber neck and wrist cuffs, reinforced knees, no street jacket, no cargo trouser pockets, integrated ankle dive boots snug inside thin dark ribbed fins, anatomically natural hands. Close fitted BCD harness with brushed gold cylinder on back, restrained metal bands and connected breathing hose, properly fitted two lens scuba mask and mouth regulator. High fidelity photoreal game art reference, clear equipment fit and practical construction, no props or other characters.

### Separate rear view

Saved: `assets/references/ocean-character-drysuit-back.png`.
Reference image: the initial wardrobe sheet.
Prompt:

Use case: identity-preserve. Asset type: Ocean Adventure character rear-view reference. Use the attached diving character sheet as the visual identity and exact wardrobe/equipment reference. Generate ONE single image containing ONLY ONE full-body character, turned completely around with his BACK to the camera. Straight-on rear view, head to fin tips fully visible, centered with generous margins, pale neutral studio background. Same male character, exact short curly hair, navy/charcoal research drysuit, thin blue piping, black watertight wrist/ankle seals, fitted BCD shoulder harness, single brushed gold scuba tank held snugly by two dark bands, metal regulator valve and breathing hose routed to his head, integrated dive boots seated in thin ribbed black fins. Both arms resting naturally at sides. Premium photoreal 3D character reference lighting, crisp material detail. ONE person and ONE view only. No front view, no side view, no inset panels, no collage, no text or watermark.

The runtime underwater identity now comes from the same supplied land GLB used ashore. The second GLB remains a preserved swim-motion source. Earlier generated wardrobe geometry experiments are superseded; new dive equipment must retain the current person's identity.
