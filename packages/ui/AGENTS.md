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

- System tests: 45 seconds of wall time on the CI runner.
- Most of it: the first island scenario's start of Chromium; the build before it is not timed.

## Quality limits

Checked by DUP and MUTATION (ADR 0037). The library's code is `src/index.ts`, which names its files, and the `.tsx`
files of its islands, which MUTATION counts like any source (ADR 0152); a component holds no logic (TEMPLATE). Each
mutant reruns every scenario of the library and finds the active mutant in the page through `sut.browser`.

- One Vitest worker, so one Chromium per run: Stryker runs one mutant per CPU, and with a Chromium per worker a run
  took up to 8 seconds next to 2.2 alone, past Stryker's timeout of 1.5 times the first run and 5 seconds, so a mutant
  that changed nothing counted as Timeout, which is detected. With one worker a run takes 3.0 seconds alone and 4.5
  with four at once, and such a mutant survives as it should.
- A mutant that stops the list from refreshing makes a scenario wait for a row or an alert until Stryker stops it:
  Timeout, which is detected.
- Measured on the development container (4 cores) on 16 November 2026 with `OSF_BASE=origin/main make mutation`: 22
  mutants in the lines of the first island, 8 killed and 14 timed out, 100 %, in 46 seconds with the build and the
  first run. Three lines planted on purpose that no scenario reads (data attributes) gave 20 missed mutants, 52.4 %,
  and MUTATION failed and named each; then they were removed.

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-UI-NNN`
