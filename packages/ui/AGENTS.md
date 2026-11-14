# AGENTS.md for `packages/ui`

Adds rules for the design system. The root `AGENTS.md` applies in full. Decisions: ADR 0130, ADR 0133.

## Public surface

The only ways a page, a system test or another program may use the library:

- Library: `files` and `text` of `src/index.ts`, the absolute paths of the tokens and the brand files and their
  text, imported as `@opensoftware/ui`
- Files: `@opensoftware/ui/tokens.css` and `@opensoftware/ui/brand/<file>.svg`
- Components: `.astro` files that a page of the console compiles, once a page of wave 6 needs one (T-56 to T-59)

The library's system tests import it by its package name and read the files it names (ADR 0039).

## Rules

- The values are those of `docs/design/README.md`. A value changes there and here together, for example when
  CONTRAST fails.
- A page names tokens, never a raw colour or a font (TOKENS). The brand files are pictures and keep their colours.
- A component exists only while a page uses it. No dialog in the first release, and no island until T-55.

## Architecture

Layers in `architecture.json` (ADR 0014): `api` (`src/index.ts`). Components join as templates (TEMPLATE).

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 20 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037). Until the first island (T-55) the library's only code is `src/index.ts`,
which names its files; a component holds no logic (TEMPLATE).

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-UI-NNN`
