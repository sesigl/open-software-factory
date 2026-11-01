---
status: accepted
date: 2026-11-01
---

# 0079. A CLI package that starts often ships as one bundled file

## Context

A port adapter is a program (ADR 0060, ADR 0062): the module starts it once for each call, for example once for each
Slack message that gatekeeper reads or posts. The start of such a program is part of every call.

`@opensoftware/channel-slack` is built with `tsc`, so its `dist/` has one file for each source file, and Node loads its
dependencies from `node_modules`. One start loads 381 modules, 350 of them from `node_modules` (the Chat SDK with its
markdown parser, the Slack Web API, `ws`). It takes about 140 ms, against about 35 ms for an empty Node process. Most
of the difference is module resolution and reading files. Measured on macOS arm64 with Node 24, median of 21 starts:

| Start of channel-slack | Time |
| --- | --- |
| As built today | 139 ms |
| Node 25.9 | 136 ms |
| Bun 1.3.1 | 134 ms |
| Node's compile cache only | 139 ms |
| One bundled file | 75 ms |
| One bundled file and Node's compile cache | 58 ms |

gatekeeper's system tests call the Slack adapter 164 times, and the suite was near its time budget. A user pays the same
cost, and `npx @opensoftware/channel-slack` also installs the more than 100 packages of its dependency tree.

## Decision

- **Bundled build.** A CLI package that a module starts often, starting with `@opensoftware/channel-slack`, builds
  with rolldown instead of `tsc`. The input is `src/cli.ts`. The output is `dist/main.js` with its source map, which
  maps to the TypeScript sources, so REACH and MUTATION read the coverage as before. `tsc --noEmit` still checks the
  types (`pnpm typecheck`).
- **Compile cache.** The bin `dist/cli.js` is a small entry. It turns on Node's compile cache
  (`module.enableCompileCache`), then imports `dist/main.js`. Node keeps the cache in its temporary folder, so the
  second start and every start after it skip the compile step.
- **No runtime dependencies.** The bundled packages move to `devDependencies`. The published package has no
  `dependencies`, so `npx` installs one package.
- **License notices.** The build writes `dist/THIRD-PARTY-NOTICES.md` with the name, version, license and license
  text of each package in the bundle, from that package's `package.json` and license file. The package publishes it.
- **One build tool for the repository.** `osf bundle <package>` in `tools/` runs rolldown with these settings, so every
  bundled package builds the same way. rolldown is a direct `devDependency` of the repository, at the version that
  Vite already brings.
- **When to bundle.** A package is bundled when its start time matters, measured, as for gatekeeper's budget. A
  package with few dependencies, like `forge-github` (17 modules, about 40 ms), stays on `tsc`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Keep `tsc` and raise the budget | No change | Every call and every user pays about 100 ms more than needed; against the rule for a suite near its budget |
| A newer Node or Bun | No build change | Measured: no gain for this package (136 and 134 ms); Bun is not the runtime users run with `npx` |
| Node's compile cache only | One line in the entry | Measured: no gain without a bundle (139 ms); resolution and file reads stay |
| Lazy imports in the adapter | No new tool | The heavy modules (Chat SDK, Slack Web API) are needed for every call |
| Bundle with rolldown (chosen) | 139 → 58 ms with the compile cache; one package to install; source maps to `src/` | A new build step; license notices to keep; a bug in a bundled package is fixed only with our new release |
| Bundle with esbuild | Mature, fast | A second bundler next to the one Vite already brings |
| Node single executable application | No `node_modules` at all | One binary for each platform; users already have Node |

## Prior art

- **rolldown** (MIT, by VoidZero, the bundler of Vite 8; version 1.2.14 of 2026-10-14, active, releases every few
  weeks). Already in the lockfile through Vite. Adopted: it bundles TypeScript without a plugin, writes ESM for Node
  with a `require` shim for CommonJS dependencies, and gives the module list of each chunk for the license notices.
- **esbuild** (MIT, 0.28.2, active). Equal for this use. Not adopted, so that the repository has one bundler.
- **tsdown** (MIT, 0.23.4, active, on rolldown). A library bundler with declarations and many defaults. Not adopted:
  an adapter needs no declarations, and `osf bundle` is a few lines on rolldown.
- **@vercel/ncc** (MIT, 0.45.0, on webpack, few changes). Not adopted: slower builds and a second bundler.
- **Node's compile cache** (`module.enableCompileCache`, Node 22.1 and later). Adopted, together with the bundle.

## Consequences

- channel-slack starts in about 58 ms instead of 139 ms. gatekeeper's suite and every module that runs the adapter get
  faster without a change to their tests, and `npx` installs one package.
- The adapter's own system tests run the bundled bin, the artifact that users run (BOUNDARY-RUNTIME).
- A security fix in a bundled package reaches users only with a new release of the adapter: update the lockfile,
  and release-please releases the adapter. A user can no longer update such a package without us.
- `THIRD-PARTY-NOTICES.md` must list every bundled package; the build fails when a package has no license.
- Revisit when Node resolves `node_modules` fast enough that a bundle gives less than 20 ms, or when a package needs a
  dependency that cannot be bundled, like a native addon.
