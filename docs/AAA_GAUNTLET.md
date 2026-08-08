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
