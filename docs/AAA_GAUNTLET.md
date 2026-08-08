# Ocean Adventure AAA Gauntlet

## Product bar

Ocean Adventure targets premium browser-game quality: immediate play, excellent vehicle and swimming feel, high-end ocean presentation, a complete progression loop, and reliable desktop/mobile delivery.

## Round 0 baseline

Date: 2026-08-08

| Judge | Score | Primary evidence | Blocking gaps |
| --- | ---: | --- | --- |
| Gameplay Director | 5.8/10 | Yacht controls, three cameras, swimming, oxygen, five signal route | No complete mission/reward loop, limited interaction, no controller support |
| Visual and Audio Director | 7.2/10 | GPU ocean, Blender yacht/diver, underwater biome, three sea states, procedural music | Limited animation, no harbor environment, sparse underwater landmarks |
| Product Director | 3.5/10 | Clear objective HUD and mission progress | No economy, shop, persistence, onboarding, campaign, or retention loop |
| Technical Director | 6.4/10 | Vite/Three.js/Rapier build, responsive controls, compact asset footprint | Monolithic runtime, no automated browser suite, no quality presets or portal adapters |

Weighted baseline: 56/100. Verdict: fail.

## Pass gates

- Overall score at least 88/100 and no judge below 8/10.
- No critical or major gameplay defect in two consecutive rounds.
- Stable 60 FPS desktop target and at least 30 FPS mobile target during storms and underwater transitions.
- Keyboard, touch, and controller paths complete the same core loop.
- Mission, reward, upgrade, save, failure, and restart states are complete.
- Game remains playable when portal ads, identity, or cloud save are unavailable.

## Round 1 target

A first-time player can complete Bluewater Survey, earn credits, purchase an upgrade that changes gameplay, launch the next expedition, and retain progress after reload.

### Acceptance criteria

- The fifth signal grants exactly one reward.
- Reloading cannot duplicate the reward.
- Engine, tank, and hull upgrades have visible levels and measurable effects.
- Unaffordable and maximum-level upgrades are disabled.
- The next expedition resets all five signals without resetting progression.
- Harbor UI works at 390x844 and 1440x900 without overlap.

## Round 1 result

Pass. The five-signal expedition now awards persistent credits, opens a responsive harbor debrief, supports three functional upgrade lines, and launches a repeatable expedition. Production build and desktop/mobile visual checks passed.

## Round 2 target

Close immersion and input gaps: require a physical marina return before rewards, support standard gamepads across helm and swimming modes, and adapt render resolution when frame rate falls below the device target.

## Round 2 result

Pass. Aurora Marina is now a physical departure and return location, rewards require a low-speed docking approach, standard gamepads control helm/swimming/camera actions, and adaptive resolution protects frame pacing on slower devices.

## Round 3 target

Make underwater play part of the core expedition rather than an optional visual mode. The final route signal must lead to a modeled seabed objective that the diver physically recovers before the return-to-harbor stage unlocks.

## Round 3 result

Pass. Bluewater Survey now requires a dive at the final signal, provides live range guidance to a modeled illuminated research beacon, completes only on physical contact, and then unlocks the marina return. Keyboard, touch, and gamepad mappings include forward, turn, rise, dive, and boost actions.

## Round 4 target

Increase replay value without diluting quality. Rotate authored expedition contracts across calm, bluewater, and storm conditions with distinct briefings and payouts while preserving the complete sail, dive, dock, reward, and upgrade loop.

## Round 4 result

Pass. Expeditions now rotate through Bluewater Survey, Storm Relay, and Golden Reef Research, automatically selecting sea state and applying distinct briefings and rewards.

## Round 5 target

Meet the production usability gate with a true pause state and player-selectable performance, balanced, and quality rendering profiles. Pausing must stop simulation and clear held input without interrupting the renderer.

## Round 5 result

Pass. The pause overlay stops simulation, clears held controls, remains visually responsive, and exposes verified performance, balanced, and quality render profiles without reloading the expedition.

## Current judge checkpoint

| Judge | Round 0 | Round 5 | Remaining veto |
| --- | ---: | ---: | --- |
| Gameplay Director | 5.8 | 7.4 | More mission interactions and stronger collision feedback |
| Visual and Audio Director | 7.2 | 7.8 | Better harbor assets, animation, and richer sound effects |
| Product Director | 3.5 | 6.9 | Onboarding, achievements, boat ownership, and portal monetization adapter |
| Technical Director | 6.4 | 7.7 | Automated gameplay tests, code modularization, platform SDK adapters |

Weighted checkpoint: 74/100. Verdict: continue. The 88/100 AAA browser-quality gate has not been reached.

## Round 6 target

Deliver real fleet ownership. A second Blender-authored vessel must use its own GLB, handling profile, purchase price, owned state, and equip state. Ownership and the active vessel must survive reload without breaking older saves.

## Round 6 result

Pass. Aurora 42 and Voyager X are separate model assets with distinct speed and handling. The responsive fleet shop supports affordability, purchasing, equipping, model hot-swapping, save migration, and reload persistence. Desktop and 390x844 browser checks passed at 60 FPS with no runtime errors.
