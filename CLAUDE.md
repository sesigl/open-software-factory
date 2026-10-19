@AGENTS.md

# Claude Code in this repository

`AGENTS.md` above is the rule set for every agent. This section adds only what is specific to Claude Code.

- Skills live in `skills/`. `make agents-sync` links them into `.claude/skills/` and into the skill folders of
  the other harnesses, so every harness reads the same skills.
- A `Stop` hook in `.claude/settings.json` runs `make check` and shows the result before you end a turn. CI runs
  `make verify` for every harness.
- Use plan mode before a change that touches `contracts/` or more than one module.
- Use subagents for independent modules. Never let two agents change the same module at the same time.
- When `make check` fails, read the check ID in the output (for example `BOUNDARY`) and open
  `docs/quality/checks.md` for the fix. Do not work around a check.
