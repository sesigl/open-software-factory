---
status: accepted
date: 2026-11-15
---

# 0152. An island's code counts: the active mutant in the page, `.tsx` in the checks, a workbench of Astro pages

## Context

The console renders every page on the server and sends `script-src 'none'` (ADR 0132). Now a page needs its first
island: the work page (`/work`) reloads itself every `CONSOLE_REFRESH` seconds with a `meta refresh`, which throws
away a half-typed "Submit work" form, and axe flags the reload (`meta-refresh`, WCAG 2.2.1; `TODO.md`, T-60). An
island that keeps the list fresh without a reload of the page (T-55, slice 2) is the first code of the product that
runs in the browser.

The checks do not see such code. MUTATION and `osf mutation` count only `.ts` files, REACH matches no `.tsx`, and
Stryker runs a library's tests in Node, where the instrumented code finds the active mutant in `process.env`. A
browser has no `process`. So no check would know whether a test notices a change to an island.

## Decision

### How the active mutant reaches the page

Verified in the installed Stryker 10.0.0 (`@stryker-mutator/core`, `instrumenter` and `api` in `node_modules`):

- `packages/ui` is a library, so `osf mutation` runs Stryker with the command runner, in place, without coverage, and
  every test of the library for each mutant (ADR 0039, `tools/scaffold/mutation.ts`). The command runner starts the
  test command with the environment variable `__STRYKER_ACTIVE_MUTANT__` set to the mutant's ID, a string such as
  `"7"` (`dist/src/test-runner/command-test-runner.js`); the first run has no such variable.
- Every instrumented file starts with a header (`dist/src/util/syntax-helpers.js` of the instrumenter) that keeps its
  state in the global object `globalThis.__stryker__`. A mutant's code runs when `__stryker__.activeMutant` is that
  ID (`stryMutAct_9fa48("7")`, strict equality). The header copies the variable into `activeMutant` only when
  `activeMutant` is undefined and `globalThis.process.env` exists, which is true in Node and false in a browser.
- So a page must have `globalThis.__stryker__ = { activeMutant: "<ID>" }` before its first script. `sut.browser`
  adds exactly this as an init script of the scenario's Chromium context when the test process has a non-empty
  `__STRYKER_ACTIVE_MUTANT__` (Playwright's `addInitScript` runs in every document before its scripts, and a page's
  Content-Security-Policy does not apply to it). Without the variable it adds nothing, and every mutant's switch
  stays off. SCN-TK-187 and SCN-TK-188 prove both with a script instrumented by hand in Stryker 10's shape.
- The header's fallback `new Function("return this")` runs only where `globalThis` is missing; in Chromium the
  expression stops before it, so the instrumented code needs no `'unsafe-eval'`.

### How the island's bundle is built

Stryker 10 instruments the sources in place, runs the `buildCommand` once (`Sandbox.init` in `dist/src/sandbox/`),
and then switches mutants at run time; it has no build step per mutant. So the build of `packages/ui` builds the
workbench from `src/`, and the page loads the instrumented code. One instrumented build with mutant switching is the
only form the installed version supports, and the one we use. Stryker parses `.ts` and `.tsx` (Babel with the
TypeScript and JSX presets) and keeps JSX as it is; it has no parser for `.astro`. So an island's logic lives in
`.tsx` and `.ts` files, never in an Astro `<script>`. `disableTypeChecks` covers `src/**/*.{ts,tsx}`.

Measured on the development container (4 cores, Node 24, the headless Chromium of Playwright 1.56) with a probe library outside the
repository: `src/clock.ts`, bundled and minified by rolldown into a static folder, two scenarios that serve it with
`sut.site` under `script-src 'self'` and read the status with `sut.browser`, and Stryker run as `osf mutation` runs a
library:

| Step | Time |
| --- | --- |
| Bundle with rolldown (the build command) | 9 ms |
| One scenario: the first of a test process, with the start of Chromium / the next one | 476 ms / 112 ms |
| Stryker's first run (Vitest and both scenarios) | 1.5 s |
| Stryker on 7 mutants, 1 runner / 4 runners | 12.8 s / 7.2 s (about 1.4 s per mutant and runner) |
| Result | 6 killed; `hour <= 12` survived, which no scenario tests |
| The same run without the init script of `sut.browser` | all 7 survived |

To be measured in slice 2, since they need the island and the workbench: the Astro build of the workbench (the
console's Astro build takes about 2 s, ADR 0132), one island scenario of the work page's list, and one mutation shard
of `packages/ui` on the CI runner with its install of Chromium.

### What `.tsx` means, and the island framework

Decided before: an island is SolidJS (ADR 0130, ADR 0132, ADR 0133), and Kobalte, Ark UI or corvu are the candidates
for headless parts (ADR 0133). This ADR does not decide it again. In this repository, `.tsx` is an island's SolidJS
component and its mount script, in `packages/ui/src/islands/`; SolidJS compiles its JSX into DOM code, not into
React. Server code stays in `.ts`, templates stay in `.astro`. The SolidJS packages (`solid-js`, and
`@astrojs/solid-js` or `vite-plugin-solid` for the compiler) come with the first island in slice 2, pinned to a
version at least two weeks old; checked today: `solid-js` 1.9.18 (29 October 2026) and `@astrojs/solid-js` 7.1.2
(28 October 2026, for Astro 7, with `vite-plugin-solid` 2.11), both MIT.

### `.tsx` in the checks

Every check that reads source files counts `.tsx`:

| Place | Before | Now |
| --- | --- | --- |
| `tools/checks/quality.ts`, MUTATION's added lines | `.ts` only | `.ts` and `.tsx` (`mutatedSources`, SCN-REPO-171) |
| `tools/scaffold/mutation.ts`, the lines Stryker mutates | `.ts` only | `.ts` and `.tsx` (SCN-REPO-172; a template's lines are not listed) |
| `tools/scaffold/mutation.ts`, `disableTypeChecks` | `src/**/*.ts` | `src/**/*.{ts,tsx}` |
| `tools/scaffold/mutation-plan.ts`, the lines of a shard | `.ts` only | `.ts` and `.tsx` (SCN-REPO-173) |
| `tools/checks/reach.ts`, REACH | `ts`, `js`, `mjs` | and `tsx` (SCN-REPO-174): a module's `.tsx` that runs only in a browser is reached by no process, so an island belongs in the library `packages/ui`, which REACH leaves to MUTATION |
| `tools/checks/quality.ts`, DUP | `.ts`, `.tsx`, `.js`, `.mjs`, `.astro` | unchanged |
| `tools/checks/arch.ts`, ARCH; `tools/checks/boundary.ts`, ISOLATION and BOUNDARY | already `.tsx` | unchanged; dependency-cruiser reads `.tsx` |
| `tools/checks/design.ts`, TOKENS | already `.tsx` | unchanged |
| `tools/scaffold/mutation-keys.ts` | the sources of `mutation-plan` | unchanged; follows them |
| `tools/checks/surface.ts`, `tools/checks/shipped.ts` | entry points `.js` from `.ts` | unchanged: an island is bundled into the workbench and compiled by the console, never an entry point of the package |
| `tools/checks/templates.ts`, TEMPLATE | imports of `.astro` and `.css` only | unchanged here; slice 2 decides how a component of `packages/ui` includes an island's mount script |

### The workbench

Plain Astro pages in `packages/ui`: one page per island and state, built by `astro build` into a static folder,
served by `sut.site` and opened with `sut.browser`. A page gives the island its properties; an island that loads data
gets the address of a static JSON file of the workbench. Slice 2 builds it.

### The Content-Security-Policy

From the first island the console sends `script-src 'self'` instead of `script-src 'none'`, and nothing else changes
(`default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`): no
`'unsafe-inline'`, no hash, no nonce, no `'unsafe-eval'`. Verified in the installed Astro 7.4.4:

- A `client:*` directive writes inline classic scripts, the directive and the `astro-island` runtime, and an inline
  style (`getPrescripts` in `dist/runtime/server/scripts.js`). `script-src 'self'` refuses them. So an island does not
  use `client:*`.
- A `<script>` of an Astro component is bundled by Vite into `/_astro/*.js` and loaded as an external module script.
  Astro inlines it only when it imports nothing and is smaller than `build.assetsInlineLimit`
  (`shouldInlineScriptChunk` in `dist/core/build/plugins/plugin-scripts.js`). An island's mount script imports
  SolidJS, and slice 2 sets `vite.build.assetsInlineLimit` to 0, so it is never inlined.
- Astro's own `security.csp` hashes inline scripts into a policy of its own. Not used: the console sets its policy in
  Fastify for every answer (ADR 0132), the hashes change with each Astro version, and a page without inline script
  can be checked by its source alone.

So an island is a `<script>` in an Astro component of `packages/ui` that imports the island's mount script; the mount
script renders the SolidJS component into its element with the properties the server wrote on that element. The
page works without the script (ADR 0130): the server renders the same content, and the island only keeps it fresh.

### The static file server

`sut.site.serve(folder, { headers })` in the testkit: a folder of the unit on `127.0.0.1`, with each file's content
type and the headers the test names, a folder's `index.html`, and 404 for anything outside the folder, also through
an encoded `..` or a symbolic link; it refuses a folder outside the unit. `sut.browser.open` then opens paths of that
site. It is about 80 lines on `node:http` (SCN-TK-185, SCN-TK-186).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The active mutant set by `sut.browser` in an init script (chosen) | Works for every island and every page; no change to the island or its build; the page's policy does not apply | Only pages opened through `sut.browser` get it, which every island scenario does |
| An inline script in the workbench's pages that sets `__stryker__` | No testkit change | The build would have to know the mutant, which Stryker sets only for the tests; an inline script breaks `script-src 'self'` |
| A build per mutant with the mutant compiled in | Nothing at run time | Stryker 10 has no build step per mutant; a build of seconds per mutant |
| Coverage analysis per test in the browser | Fewer tests per mutant | Stryker's per-test coverage needs its own test runner in the test process, and a library runs with the command runner (ADR 0039) |
| Workbench: plain Astro pages (chosen) | The island is built exactly as the console builds it; no second dev server; island scenarios read the built folder | No catalogue to browse; each state is a page written by hand |
| Workbench: Storybook 10 with `storybook-solidjs-vite` | A catalogue, controls, a large community | About 22 MB, a builder and a manager UI of its own, parts of Vitest 3.2 (`@vitest/spy`, `@vitest/expect`) beside the repository's Vitest 4, stories that import components from `src/`, and the Solid framework is a community package |
| Workbench: Ladle, Histoire | Lighter than Storybook | Ladle is for React only; Histoire supports Vue and Svelte and is still a beta |
| CSP with Astro's hashes and `client:*` | Astro's islands as documented | Two policies on one answer (Fastify's and Astro's), hashes per Astro version, inline script that a check of the source cannot rule out |
| Custom elements in plain TypeScript instead of SolidJS | No runtime library | Decided against before (ADR 0130, ADR 0133); every island would write its own updates of the DOM |

## Prior art

- **Stryker** 10.0.0 (Apache-2.0, very active): already adopted (ADR 0037); its instrumenter, command runner and
  sandbox were read in `node_modules` for this decision. Its runner for browser tests is the Karma runner, which this
  repository does not use (not installed, not read); the command runner only sets the variable for the test
  process, which is why the testkit carries the mutant into the page.
- **Playwright** 1.56 (Apache-2.0, very active): already adopted (ADR 0131); `BrowserContext.addInitScript`.
- **Storybook** 10.6 (MIT, very active), **storybook-solidjs-vite** 10.7 (MIT, active, SolidJS community),
  **Ladle** 5.1 (MIT, last release November 2025), **Histoire** 1.0 beta (MIT, last release January 2026): checked
  for the workbench, not adopted (see the options).
- **sirv** 3.0 (MIT, maintained, last release September 2025) and **serve-handler** 6.1 (MIT, maintained by Vercel):
  checked for the static file server. Both serve a folder; the testkit needs only a file, its type, the test's
  headers and a refusal of every path outside the folder, which about 80 lines on `node:http` give without a new
  dependency of the published testkit.
- **SolidJS** 1.9 and **@astrojs/solid-js** 7.1 (MIT, very active): decided in ADR 0130; adopted in slice 2.

## Consequences

- A missed mutant in an island's code fails MUTATION like one in server code, once its scenarios run under
  `osf mutation` (slice 2).
- Island scenarios run in Chromium: `packages/ui` gets a suite with `browser: chromium` in `.github/test-suites.yml`,
  and its mutation shards install Chromium (T-52's check). Each mutant reruns every test of the library and starts
  Chromium once per Vitest worker: about 1.4 s per mutant for two small scenarios.
- An island never uses `client:*`. An island scenario serves its page with the console's policy, so a script that the
  policy would refuse fails the scenario through the browser's console error.
- A `.tsx` file in a module must be reached by a system test (REACH); browser code of a module therefore cannot pass,
  and every island stays in `packages/ui` (T-53).
- 15 November 2026, slice 2: the compiler is `vite-plugin-solid` 2.11.15 (30 October 2026, MIT, maintained by the
  SolidJS team; the Solid plugin that `@astrojs/solid-js` itself wraps), pinned beside `solid-js` 1.9.18 in
  `packages/ui` (for the workbench) and in the console (for its build), without `@astrojs/solid-js`: that integration
  also adds a renderer for `client:*` to the server's build, which no island uses. Through the lockfile it brings
  `babel-preset-solid` 1.9.19 and `babel-plugin-jsx-dom-expressions` 0.40.14 (10 November 2026), which only run while
  the build compiles. TEMPLATE now allows a `<script>` without attributes that only imports a `.tsx` file of the
  unit's `src/islands/` (SCN-REPO-175, SCN-REPO-176).
- Revisit when Stryker sets the active mutant for browser runs itself, when Astro emits islands without inline
  scripts, or when the number of islands makes a catalogue worth a second tool.
