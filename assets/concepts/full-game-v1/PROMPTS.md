# Visual Construction Briefs

Created October 7, 2026 using the built-in image generator. These normalized briefs record the construction intent of the prompt set; they are not a verbatim tool transcript. Outputs are concepts, not gameplay evidence. No generation keys or external services are required to view them.

## Shared Direction

Premium realistic ocean-exploration game, physically plausible construction, inspectable materials and clear gameplay access. Preserve the existing ocean, supplied player and yacht silhouette. One coherent view per image, not a collage or multi-view model sheet. Avoid decorative gradients, silhouettes and unrelated fantasy objects.

## Prompt Set

1. `wreckward-reach.png`: underwater research freighter approximately 35 meters long at 22 meters depth. Show a broad hull breach, traversable cargo corridor and a separate exit, a recoverable recorder and salvage locations. Marine corrosion, practical light shafts and readable physical construction. This is a destination concept, not a flat environment asset.
2. `pelagic-observatory.png`: flooded 12-meter pressure-hull observatory at approximately 28 meters depth. Inspection windows, service hatch, three acoustic array towers, disconnected service cable and a supported repair location. Clear entrance and exit, recognizable equipment and believable mounting points.
3. `research-rov.png`: compact 75-centimeter research ROV. Silver and yellow protective cage, four horizontal and two vertical thrusters, forward camera, practical lights, manipulator and tether connection. Show construction and scale clearly, not a stylized icon.
4. `mara-velez.png`: full-body, front-view realistic expedition lead. Dark-haired woman, sea-green field jacket and charcoal trousers, practical research clothing and natural proportions. Neutral presentation suitable for subsequent rigged character authoring.
5. `ivo-chen.png`: full-body, front-view realistic marine systems engineer. East Asian man, gray work shirt, charcoal trousers, practical tools and natural proportions. Neutral presentation suitable for subsequent rigged character authoring.
6. `selene-okoro.png`: full-body, front-view realistic habitat scientist. Black woman with braids, light field jacket, practical sample belt and natural proportions. Neutral presentation suitable for subsequent rigged character authoring.
7. `array-repair-station.png`: underwater supported service platform with three distinct connector channels, blue, white and yellow, isolated switches and readable status lamps. Believable marine housings and cables with clear interaction positions. Show physical supports and repairable components.
8. `story-introduction.png`: compact mission conversation over the existing harbor and expedition yacht, with Mara's portrait and The Lost Signal opening. Keep the world visible, readable dialogue choices and restrained instrument styling. Do not replace the supplied in-world player.
9. `dusk-storm-navigation.png`: existing expedition yacht in dusk storm conditions. Varied wave sets, practical navigation lights, whitecaps and inspectable boat materials. Keep the boat readable rather than hiding it as a silhouette.

## Reference Inputs

The harbor/yacht and environment directions used the existing game captures `output/current-critic-review/01-harbor.png`, `output/expedition-review/wreck-v5-quality.png`, and the existing vessel image `public/textures/inventory/aurora.png`. All nine PNGs were generated before this implementation's gameplay edits. The portraits are currently radio assets; temporary supporting NPC geometry remains explicitly permitted by the user. The existing player GLB is not replaced.

Only the three portraits are imported by the runtime. Unused environment/vehicle concepts remain outside `public` and are not shipped as playable models.
