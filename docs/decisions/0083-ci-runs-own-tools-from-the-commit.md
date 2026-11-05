---
status: accepted
date: 2026-11-06
---

# 0083. CI of this repository runs its own tools from the build of the commit

## Context

ADR 0031 and phase 2 of the bootstrapping plan made CI run spec-trace and proof as released from npm: the version in
each module's `package.json`, through its GitHub Action. That proved the published packages, but it had two costs:

- A release pull request raises a version before it is on npm, so its own verify run failed (`npx` found no
  `@opensoftware/spec-trace@0.3.1`).
- A change to spec-trace or proof took effect on pull requests only after its release, and CI tested the old code
  of the tool, not the code of the commit.

The workspace builds every package of the commit before the checks (turbo, ADR 0081). The gate workflow already
runs gatekeeper and forge-github from that build (ADR 0062).

## Decision

- CI of this repository runs its own tools from the build of the commit: the steps spec-trace and proof pass
  `command: node modules/<module>/dist/cli.js` to their actions, like gatekeeper in the gate workflow.
- The actions keep `npx --yes @opensoftware/<module>@<version>` as their default for other repositories.
- The published packages are proven by their own publish workflows and by the modules' system tests, which run the
  built artifact as a user does.

This replaces the part of ADR 0031 that CI runs the released spec-trace, and the same for proof (ADR 0029).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The build of the commit (chosen) | Always the code under review; no failure before a release | CI does not run the published tarball |
| The release, with a fallback to the build when the version is not on npm | Keeps the dogfood of the release | Two paths in CI; a change to a tool still shows only after its release |
| The release, as before | Proves the published package | Release pull requests fail; changes show late |

## Prior art

No new module, dependency or service. Turborepo's own CI and other pnpm monorepos run workspace tools from the
workspace, not from the registry.

## Consequences

- A release pull request passes its verify run.
- A change to proof's comment or to spec-trace's report shows on its own pull request.
- Revisit when a published package breaks in a way the workspace build does not show; then add a smoke run of the
  published tarball after each release.
