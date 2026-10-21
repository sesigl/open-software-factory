---
status: accepted
date: 2026-10-21
---

# 0038. One release pull request for all packages

## Context

release-please opened one release pull request per package (ADR 0005). Each of them changes one line of
`.release-please-manifest.json`. When two packages have pending releases on neighboring lines, the second pull
request conflicts as soon as the first one merges. release-please does not rebuild a release branch when nothing new
landed for that package, so the conflict stays until someone resolves it by hand. This happened to scorekit 0.2.0
(#53) after ledger 0.1.0 merged.

## Decision

release-please opens one release pull request for all packages (`"separate-pull-requests": false` in
`release-please-config.json`). Each package still gets its own version, changelog and tag, for example
`scorekit-v0.2.0` (`"include-component-in-tag": true`). The publish workflows still find their own tag on the merge
commit, so nothing else changes.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One release pull request | No manifest conflicts; one review and one verify run per release round. | Packages with pending releases ship together; to hold one back, its commits must wait. |
| Separate pull requests, resolve conflicts by hand | Each package releases on its own schedule. | A conflict after almost every release merge; a person or agent must merge `main` into a bot branch. |
| Separate pull requests, one manifest file per package | No conflicts. | release-please reads one manifest; not supported. |

## Prior art

release-please (Apache-2.0, maintained by Google, active) supports both modes through `separate-pull-requests`.
Changesets (MIT, active) also releases many packages from one "Version Packages" pull request. We keep release-please.

## Consequences

Release rounds are one pull request: verify runs once on it, and it is merged as a whole. A package that must not
release yet needs its commits held back. Revisit when packages need different release schedules.
