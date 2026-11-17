---
status: accepted
topic: install
date: 2026-11-17
---

# 0164. A sandbox that checks this repository

## Context

The agents of this repository's factory (`deploy/dogfood/factory/`, ADR 0080) ran in sandboxes of the agents'
template `harness-claude-code` (ADR 0096): Node, Git, `gh`, `make` and the harness adapter. It has no pnpm, so
`make install` stopped at its first line, and no lychee, which DOCS-LINKS of `make check-fast` runs. Its prompts asked
for `make verify` and `make check`, which start the system tests' containers, and the sandbox has no Docker. So an agent
of the factory could not check its own change before it pushed (TODO.md T-94).

`make check-fast` runs lint, typecheck and the fast repository checks (`osf check` without `--all`, and SPEC, TRACE
and STEPS). Of the pinned tools of `make install` it needs only lychee: oasdiff runs in CONTRACT, which is a check of
`make verify`; opa, temporal, nats-server, bao, helm, kubectl, kind and the agent-sandbox manifest serve the system
tests.

## Decision

- A target `dogfood` of `deploy/images/Dockerfile` builds on the target `agent`: it adds pnpm at the version of
  `packageManager` in `package.json` from npm, and lychee at the version and SHA-256 that
  `tools/scaffold/install-tools.ts` pins for x86_64, from its release on GitHub (the arm64 build of the same release
  for the arm64 image). It sets `TURBO_CONCURRENCY=4`: with turbo's default of ten tasks at a time the typechecks of
  every package ran out of memory with 4 GiB.
- The Compose profile builds it as the service `dogfood-template`, image
  `ghcr.io/sesigl/open-software-factory/dogfood-agent`, in the profile `dogfood`, which `COMPOSE_PROFILES=dogfood`
  turns on next to `FACTORY_DIR=../dogfood/factory`. Its tag moves with `osf profile-pins` as every image's does; as it
  holds no package of its own, a new pin of the harness gives it `<version>-r<n>`. `publish-images` publishes it.
- Every agent of the factory starts from it. The packages come in with `pnpm install --frozen-lockfile` through the
  sandbox's egress, which allows `registry.npmjs.org`: pnpm takes `HTTPS_PROXY` and the egress proxy's CA from the
  sandbox's variables. No pnpm store is baked into the image: the lockfile changes with nearly every pull request, and
  the store of this repository is about 2.7 GB.
- The prompts ask for `pnpm install --frozen-lockfile` and `pnpm turbo run build` after the clone, `make check-fast`
  in place of `make check` and `make verify`, and `make test-scenario` only for a test that starts no container and no
  browser. The stage `verify` waits for the check `verify` of the pull request, which runs every suite, as before.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| pnpm and lychee in the agents' template `harness-claude-code` | One image | Every factory's sandboxes would carry the tools of this repository |
| A target `dogfood` with pnpm and lychee (chosen) | The reference factory's template stays as it is; `make check-fast` runs | One image more to build and publish |
| Every pinned tool of `make install` in the image | `make install` would download nothing | About 530 MB of tools, mostly for suites that cannot run without Docker |
| Docker in the sandbox, for `make verify` | The agent proves everything itself | A Docker daemon in the sandbox breaks its isolation (ADR 0096); CI runs the suites anyway |
| A pnpm store in the image | No download of packages in the sandbox | A 2.7 GB image that is stale after the next change of the lockfile |
| pnpm through corepack | Follows `packageManager` by itself | Downloads pnpm at the first use; corepack leaves Node with version 25 |

## Prior art

- pnpm (MIT, maintained, the package manager of this repository) installed with npm, as the pnpm documentation
  describes for images; corepack (MIT) was the other way, see above.
- lychee (Apache-2.0 or MIT, maintained) from its release files, the same file that `make install` downloads.
- The images of this repository: the target `agent` and its stages, built with `docker buildx bake` from
  `compose.yaml` (ADR 0074, ADR 0156). Nothing is built: the change adds a target.

## Consequences

- An agent of the factory runs `make check-fast` in its sandbox: with 4 CPUs and 8 GiB, the sandbox of the factory,
  `pnpm turbo run build` took 28 s and `make check-fast` of every package 92 s on this repository; with 2 CPUs and
  4 GiB, 52 s and 167 s.
- The image is 1.12 GB, 62 MB more than the agents' template: lychee is 26 MB, pnpm the rest.
- A new version of pnpm in `package.json` or of lychee in `install-tools.ts` has to change the target `dogfood` and
  SCN-DIST-070 with it; no check compares them yet. With an older pnpm in the image, pnpm switches to the version of
  `packageManager` from npm, through the egress.
- The deploy suite builds one image more before its tests, about 40 s on a cold cache.
- Revisit when the sandboxes get a Docker of their own (a rootless daemon or a sibling VM): then `make verify` can run
  in them.
