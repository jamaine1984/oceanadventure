# Ocean Adventure playable demo upgrade plan

Ocean Adventure will become a marine research expedition with boating, diving, wildlife photography, sampling, and a small recovery mission. The recommended demo is one detailed bay with a reef and a shallow wreck. Finish a coherent chapter before expanding the world. The target first playthrough is 15 to 20 minutes; that duration needs playtesting.

This is the standalone Ocean Adventure project at `C:\Users\koike\Downloads\kidsgenuisworld\ocean-adventure-game`. CrateShip integration and advertising are deferred. The Last Fisherman stays on the user's Mac.

## Current game and work in progress

The rebuilt chapter now has a contoured reef, seven wildlife species, species photography with saved journal thumbnails, water and sediment sampling, exterior wreck cable/sensor recovery, return-to-harbor cargo trading, five equipment upgrades, two vessels, free rescue and saved safe checkpoints. The former marker-chain missions are no longer the active chapter. Older quality scores in `AAA_GAUNTLET.md` are historical records, not a current assessment of this rebuild.

Island walking is now included: disembark at the mooring, explore the planted trail, visit the research exchange and dive outfitter, and return at the boarding gate. First/third person views, keyboard/controller/touch bindings, grounded collision, optional safe-route Walk assist and saved ashore positions are implemented. The same single critic accepted the trail/counter and underwater gameplay stills at 8.0/10. The supplied land character and dedicated diver now replace the earlier procedural avatars; the same critic rated each 8.2/10. The diver uses real Mesh2Motion Swim Fwd and Swim Idle retargeted to its existing rig. Original source GLBs remain preserved. Motion transitions and hardware performance are separate remaining gates.

The boat upgrade creates original Aurora 42 and Voyager X vessels from the saved reference sheet. Blender supplies hulls, cabins, glazing apertures, rails, stern dive access, and equipment. The browser game supplies the final lighting, reflections, waterline, wake, camera, material tuning, and Aurora's stair stringers and tabletop cap. On October 1, 2026, one independent critic rated each finished in-game boat 8.0 out of 10. This meets the requested boat visual target; it is not a certification of the entire game's quality. See `BOAT_UPGRADE_REVIEW.md` for evidence and practical limits.

## The demo chapter

| Stage | Player activity | What makes it playable |
| --- | --- | --- |
| Harbor departure | Read a brief, board the vessel, sail out, slow near the research area | Short control tutorial with a clear destination and docking practice |
| Reef survey | Dive to 8 to 15 meters, photograph three species, collect water and sediment samples | Tools, readable prompts, fish behavior, lighting, collision, and a field journal |
| Wreck recovery | Locate a damaged research sensor at 20 to 30 meters, enter a safe route, free a snagged cable and retrieve it | A small spatial challenge with a light, sonar clues, limited air, and an exit route |
| Safe return | Board the vessel, return to harbor, upload the journal and samples | A clear debrief, completion reward, and a finished chapter |

Use a sonar bearing and recognizable landmarks to guide travel. Replace chains of floating markers as the main activity. Keep the first wreck accessible and small enough for a new diver to understand. Do not turn collecting wildlife into a task; the samples are water, sediment, and permitted research material.

## Underwater world

Build a contoured seabed with authored rock formations, sand channels, coral patches, seagrass, and the wreck. Use proper silhouettes and varied materials before adding effects. The shallow reef should be readable in clear blue green water, with depth fog, surface light, caustics, suspended particles, and bubbles. Deeper water changes color and visibility gradually.

Start with a small set of distinctive wildlife: reef fish schools, a grazing turtle, a passing ray, and small seabed creatures. Give them different movement and avoidance behavior. Use instancing, distance detail levels, and bounded populations so the scene stays usable on phones. A photograph should require the species to be in frame and reasonably close; a journal records the discovery.

Add a camera, sampler, scanner, and dive light through a compact tool selector. Interactions require range and a clear view of the target. Samples and recovered equipment need visible feedback and objective state, rather than only a text counter.

## Controls and vessel behavior

First align the visual heading with actual travel, correct left and right input, soften acceleration, and make reverse steering predictable. Give Aurora the feel of a large expedition yacht and Voyager the feel of a lighter research launch. Resize collision and wake placement for each hull. Verify slow docking and contact against the actual vessel footprint.

For diving, keep the camera underwater when the diver is submerged. Add mouse or right stick look, clear descend and ascend controls, and stable depth control. Support keyboard, controller, and touch without requiring the player to learn different objective rules. First person diving is the default. The View button switches to a visible third person research diver. Optional swim assist approaches research tools and tracks wildlife; cruise assist steers the actual vessel and uses a harbor approach waypoint.

## Save and mission state

Save the contract stage, collected samples, photographs, recovered sensor, vessel, upgrades, and a safe resume position. Resume from a suitable checkpoint rather than spawning inside geometry. Award completion credits once. Keep a free low oxygen rescue route so a player can finish the demo without an advertisement or purchase.

## Build order

1. Completed: finish both vessels in the actual browser game and have the single critic review them. Control corrections are implemented; sustained driving, reverse docking, and contacts still need hands-on playtesting.
2. Implemented: first/third person dive cameras, underwater visibility, depth input and rock/wreck collision.
3. Implemented: contoured reef, coral forms, seagrass, seven wildlife species and authored island harbor. The same single critic accepted the island/harbor at 8.0/10 in actual Quality browser views on October 1, 2026; see `EXPEDITION_REBUILD_REVIEW.md`.
4. Implemented: photography with thumbnails, samples, journal, contextual tool prompts and milestone/checkpoint saves.
5. Implemented: exterior wreck recovery, one-time cargo receipt, repeat expeditions and harbor gear/vessel purchases.
6. Play through the entire chapter with keyboard, controller, and touch; profile real mobile hardware and revise the scene budget.
   - Walking routes, nearby shops, saved ashore positions, boarding, sampling, cable release and recovery were checked through actual browser UI/controllers. The same single critic accepted the final island walking and underwater gameplay views at 8.0/10. Physical input hardware, full chapter pacing and sustained performance remain open; still-image acceptance does not certify the whole demo as AAA.
   - Supplied characters, moving swim pose, both sample tools, a wildlife photograph and journal/save reload were checked in the browser. Quality snapshots were variable and sometimes below 30 fps. Next: measure sustained frame times, tune avatar/shadow detail, review strokes and motion transitions, and check real keyboard/gamepad/touch input. Graphics preference now persists across reload.
7. Decide pricing and optional advertisements only after the demo is enjoyable and reliable.

## Acceptance targets

- Both boats meet the requested critic score using in game views as well as close geometry views.
- The player can see the reef, wildlife, tools, and objective targets clearly underwater.
- The complete chapter can be understood and finished without a developer explaining each step.
- Boat and diver motion match their facing direction; collisions do not leave the player stuck.
- HUD and touch controls do not cover essential objectives or overlap each other.
- Save and reload restore the chapter without granting duplicate rewards.
- Target 60 frames per second on an appropriate desktop and 30 on representative mobile hardware. These are targets, not verified performance claims.

## Later full game

Expand to several authored regions with distinct habitats, a deeper research mystery, night dives, restoration work, permitted salvage, and more equipment and vessels. Consider an ROV for deeper exploration only after the diver chapter works. The full game should provide new missions and environments beyond the demo, rather than stretching the same navigation tasks.

Optional rewarded ads may later double earned harbor credits, grant an extra optional sonar scan, or unlock a cosmetic photo feature. They should be clearly voluntary and grant the advertised reward only after verified completion. Essential rescue, mission completion, and saving should remain dependable. A paid edition can be offered without ads. No ad provider or store connection is activated by this plan.

## Asset and build locations

- Reference image: `assets/references/ocean-boats-v2-reference.png`
- Original boat builder: `scripts/build_ocean_boats_v2.py`
- Editable boat source: `assets/blender/ocean_boats_v2_full.blend`
- Browser vessels: `public/models/aurora_explorer_yacht_v2.glb` and `public/models/voyager_research_launch_v2.glb`
- Review images: `output/boats-v2/`
- Existing earlier vessel assets remain available for recovery.

Rebuild with `npm run build` after exporting assets. The local preview serves `dist`, so source or GLB changes are not visible there until rebuilt. Preview: `http://127.0.0.1:4174/`.

## Current locomotion checkpoint (October 1)

Supplied land character uses Mesh2Motion clips, refined to default walking and a small jog with shorter backswing, reduced heel kick and lower flight. Walk 1.4 m/s; hold Shift or Jog for 2.2 m/s. Release returns to walking. Swimming is the accepted supplied diver animation and has been preserved. The first authored land clips and the wide Jog export are superseded. See `assets/references/CHARACTER_REFERENCES.md` for reproducible packaging and calibration.

Return to boat now guides along a safe pier route and boards on arrival; direct E boarding works within the gate trigger. Browser and build checks are recorded in `docs/EXPEDITION_REBUILD_REVIEW.md`. Next play feedback should focus on the walk-to-jog transition and compact jog feel with physical keyboard or touch holds, then resume the wider demo roadmap.

