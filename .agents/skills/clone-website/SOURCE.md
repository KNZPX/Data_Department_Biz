# Source

Vendored from https://github.com/JCodesMore/ai-website-cloner-template
(commit f50066df3f4bdca057d3b239be6f49f17724bb13, 2026-09-26), MIT licensed — see LICENSE.

Only the skill and its Claude Code command bridge are copied
(`.agents/skills/clone-website/`, `.claude/commands/clone-website.md`), not the
template's Next.js scaffold — this repo is already a Next.js app.

## Using it in this repo

- Run `/clone-website <url>` in Claude Code. It needs browser automation
  (Playwright is available in cloud sessions) and network access to the target.
- The skill writes research to `docs/research/<site-key>/<page-key>/`,
  screenshots to `docs/design-references/...`, and by default builds a new route.
  When the goal is to improve an existing feature (e.g. the Whiteboard against
  Miro), say so: use the research/spec phases, then apply the findings to
  `src/features/whiteboard/` instead of creating a new route.
- Don't copy third-party logos, brand assets or licensed fonts into the app.
