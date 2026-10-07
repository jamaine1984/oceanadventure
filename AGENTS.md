# Ocean Adventure Working Agreement

- Keep this game standalone. Do not change or attach the parent Kid Genius World application.
- Preserve the current ocean, authored boats, music toggle and supplied shared GLB player. Do not substitute procedural player characters.
- The user now permits procedural supporting NPC stand-ins while gameplay is built; final NPC GLBs will be supplied later. This exception does not replace the existing GLB player on land or underwater. Use `ResearchPartners.replace` for the later swap.
- Create and inspect visual references before building new environments, characters, tools or interface directions. Current full-game references are in `assets/concepts/full-game-v1`.
- Ads remain deferred until the user supplies the final integration requirements. Do not configure live publisher IDs or enable monetization during gameplay work.
- The user requests verified new changes be committed and pushed to `origin` (`jamaine1984/oceanadventure`) after implementation. Preserve unrelated work and never force-push. Report the commit and any publishing failure truthfully.
- Run `npm run test:unit`, `npm run build`, `npm run verify:portal`, and relevant browser gameplay checks before publishing. CI package checks do not replace visual, touch, performance or complete-play QA.
- Cloudflare configuration names the standalone `ocean-adventure-game` target, but the October 7 account listing did not contain that project. Verify the target before deployment; never overwrite another application.
- One critic reviews visuals and gameplay against the unchanged rubric in `docs/CURRENT_CRITIC_AND_CRATESHIP_PLAN.md`. Do not claim 8/10, AAA quality or production readiness without the required evidence. Release remains HOLD until the roadmap gates are met.
