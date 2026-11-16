# AGENTS.md for `packages/ui`

Adds rules for the design system. The root `AGENTS.md` applies in full. Decisions: ADR 0130, ADR 0133, ADR 0152.

## Public surface

The only ways a page, a system test or another program may use the library:

- Library: `files` and `text` of `src/index.ts`, the absolute paths of the tokens and the brand files and their
  text, imported as `@opensoftware/ui`
- Files: `@opensoftware/ui/tokens.css` and `@opensoftware/ui/brand/<file>.svg`
- Components: `src/components/*.astro` and `src/styles/*.css`, which a page of the console compiles into its build:
  `Page` and `Brand`, for the sign-in page, and `Shell` with the type `ShellData`, for the runs page (T-56), the
  secrets pages (T-57), the skills pages (T-59), the changes page (T-58), the run page, the work page and the inbox, the factory pages, the cost and scores and the health page (T-60), whose list, form and fields are classes of `src/styles/base.css`;
  the skills pages add the way back (`osf-crumbs`), an exact line (`osf-meta`), a panel with a label (`osf-section`),
  the needs of a record (`osf-needs`) and Markdown rendered on the server (`osf-prose`); the changes page adds panels
  one below the other (`osf-stack`), and `osf-button` serves a link and a button of a form alike; the runs page
  adds a table's rows as cards on a phone (`osf-cards`) and the main action at the bottom (`osf-dock`) (T-60); the run
  page adds a record's facts (`osf-facts`), its forms below them (`osf-toolbar`), a field with its button in one line
  (`osf-inline`), cards whose name is no link (`osf-card-name`, `osf-card-wide`) and the states of a stage (T-60); the work page and the inbox add a `select` and a `textarea` as `osf-input`, and the states of a work item and
  of a proposal (T-60); the factory pages, the cost and scores and the health page add an exact text of several lines
  (`osf-code`), a fact across the panel (`osf-fact-wide`), a card's cell that names its column (`data-label`) and the
  states of a check (T-60). Since T-60 the shell has no group "Classic pages": `ShellData` lists `pages` and `tools`; `refreshWithoutScript`
  reloads a page only in a browser without script, inside `<noscript>` (T-55)
- Islands (T-55, ADR 0152): `WorkList` with the type `WorkListData` (and `WorkListProps`, `WorkListItems`,
  `WorkListRow`, `LinkText`), for the work page: the list of work items that the island `src/islands/work-list.tsx`
  keeps fresh

The library's system tests import it by its package name and read the files it names (ADR 0039).

## Rules

- The values are those of `docs/design/README.md`. A value changes there and here together, for example when
  CONTRAST fails.
- A page names tokens, never a raw colour or a font (TOKENS). The brand files are pictures and keep their colours.
- A component exists only while a page uses it. No dialog in the first release.
- An island (ADR 0152) is a SolidJS component in `src/islands/<name>.tsx` and its mount script
  `src/islands/<name>.mount.tsx`, which renders it into each element `[data-island="<name>"]` with the properties of
  its `data-props`. Its Astro component renders the same content on the server and includes the island with a
  `<script>` that only imports the mount script (TEMPLATE): no `client:*` directive, no inline script. The server
  computes every property, also each text the island shows, so the island decides as little as it can.
- Each island has a page of the workbench (`workbench/pages/<name>/<state>.astro`) for each of its states, with
  static JSON in `workbench/public/` where it loads data, and island scenarios that open them in Chromium under the
  console's policy, with the browser's clock paused (`system-tests/workbench.ts`). The build writes the workbench to
  `dist/workbench/` from `src/`, so the page loads what Stryker instrumented.

## Architecture

Layers in `architecture.json` (ADR 0014), top to bottom: `islands` (`src/islands/`) → `api` (`src/index.ts`, whose
types an island imports). Components join as templates (TEMPLATE).

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 20 seconds in total on the CI runner. Measured on the development container on 16 November 2026 with
  the first island: the suite takes 1.8 seconds (3.3 seconds of test time) for 9 scenarios; an island scenario takes
  0.1 to 0.3 seconds, the first of a worker about 0.6 with the start of Chromium, and SCN-UI-007 1.2 with axe. The
  build before it takes 3 seconds, 0.7 of them for the workbench's Astro build. No new budget is needed.

## Quality limits

Checked by DUP and MUTATION (ADR 0037). The library's code is `src/index.ts`, which names its files, and the `.tsx`
files of its islands, which MUTATION counts like any source (ADR 0152); a component holds no logic (TEMPLATE). Each
mutant reruns every scenario of the library, which starts Chromium once per Vitest worker and finds the active mutant
in the page through `sut.browser`. Measured on the development container (4 cores) on 16 November 2026 with
`OSF_BASE=origin/main make mutation`: 22 mutants in the lines of the first island, 9 killed and 13 timed out (each a
change that stops the list from refreshing, so a scenario waits until Stryker stops it), 100 %, in 45 seconds with
the build and the first run; a mutant planted on purpose that no scenario notices failed MUTATION.

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-UI-NNN`
