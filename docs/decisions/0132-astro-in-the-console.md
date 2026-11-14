---
status: accepted
date: 2026-11-14
---

# 0132. Astro renders the console's templates inside its Fastify server

## Context

ADR 0130 makes the console the factory's UI, with pages rendered on the server and islands only where the browser
must react. The owner chose Astro (`TODO.md`, wave 6). Today the pages are Preact components written with htm in
`src/pages/`, which Fastify routes render (ADR 0072), and the repository's checks read only `.ts` files: DUP, REACH,
MUTATION, ARCH and ISOLATION would let a `.astro` file pass without looking at it.

## Decision

### The stack

- **Astro 7 with `@astrojs/node` in middleware mode** inside the Fastify server of `console serve`. Fastify keeps the
  CLI, the static files, every old page, the forms and, for a new page, the route: it checks the request, loads the
  page's data with the code of `commands`, `adapters` and `domain`, computes the values the page shows in `pages`,
  and calls Astro's handler with them as `locals.page`, with the status and its text as `locals.status` and
  `locals.statusText` (`src/adapters/web.ts`). Astro writes the response.
- **Templates in `src/web/`**, Astro's `srcDir`: `src/pages/` is the layer of `.ts` files that compute a page's data,
  and Astro would take each of them for a route. `src/web/pages/<path>.astro` is the template of the route at that
  path; `src/web/components/` holds its parts, like the frame. The build writes `dist/web/`; `tsc` still builds the
  `.ts` files to `dist/`, with their source maps, so REACH and MUTATION read the logic as before.
- **A template holds no logic.** Its frontmatter holds imports of components, type imports, the page's data
  (`Astro.locals.page` or `Astro.props`) and its status (`Astro.response.status = Astro.locals.status`, and its text);
  an expression of its markup reads a property, maps a list with an arrow that returns markup, or switches with `?:`
  or `&&` on a value the route computed. The check TEMPLATE enforces exactly this with Astro's own parser
  (`@astrojs/compiler-rs`), and that a type import stays in the unit and reaches no layer above `templates`.
- **No script and no other origin.** Every answer of the console carries the Content-Security-Policy
  `default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self';
  frame-ancestors 'none'`, set in Fastify's `onRequest` hook so that Astro's answers have it too. The build writes no
  inline stylesheet (`build.inlineStylesheets: "never"`). T-55 loosens `script-src` for the first island.
- **Styles stay Pico CSS** until the design system (T-54); the frame of an Astro page is the frame of the old pages.
  Tailwind CSS against plain CSS on the tokens is T-54's decision.
- No client-side router, no SolidJS yet: the SolidJS integration comes with the first island (T-55).

### How each check treats `.astro` and `.tsx`

| Check | `.astro` (this ADR) | `.tsx` |
| --- | --- | --- |
| TEMPLATE | Its frontmatter and markup hold no logic; type imports stay in the unit and at or below its layer | — |
| ARCH | `src/web/` is the layer `templates`, below `commands` and above `pages`; TEMPLATE checks a template's imports by the layers of `architecture.json`, since dependency-cruiser does not read `.astro` | T-55 |
| ISOLATION | TEMPLATE refuses an import that leaves the unit | T-55 |
| DUP | Counted: jscpd reads `.astro` and names its markup `<file>:html`, which DUP maps to the file | Counted, as before |
| REACH, MUTATION | Not counted: a template holds no logic, which TEMPLATE proves; the logic is in `.ts` files, which both count | T-55 |
| Typecheck | `astro-check` (`@astrojs/check`) after `tsc`, with `tsconfig.astro.json` | `tsc` |
| Lint | Biome reads the frontmatter only; it cannot see a variable that the markup uses, so `noUnusedVariables` and `noUnusedImports` are off for `.astro` | Biome |

### Measured

On the development container (4 cores, Node 24), before and after the health page moved to Astro:

| Step | Before | After |
| --- | --- | --- |
| `pnpm run build` of the console | 2.2 s (`tsc`) | 4.2 s (`tsc` and `astro build`) |
| `pnpm run typecheck` | 4.0 s (`tsc`) | 6.6 s (`tsc`, then `astro-check` in about 2.6 s) |
| Start of `console serve` until it answers | 190 to 320 ms | 240 to 320 ms: Astro loads at the first page that needs it |
| The first `/health` after the start | — | 70 to 90 ms; loading Astro's build takes about 90 ms once, while the doctor's checks run |
| The console's suite, 86 and then 88 scenarios | 16.5 s wall, 43.5 s in tests | 17.5 s wall, 46.6 s in tests |

Stryker builds the mutated module once (ADR 0061); the build is 2 s longer.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Astro in middleware mode behind Fastify (chosen) | The owner's choice; templates in HTML with typed data; islands when needed; Fastify keeps the routes and the forms | A build step, a second type checker, a check of its own for templates |
| Astro's standalone server | No Fastify | Every route, form and check of the request would move into Astro's endpoints, built by Vite: REACH and MUTATION lose the logic |
| Astro's container API (`experimental_AstroContainer`) | Render a component to a string from a Fastify route | Experimental; still needs the Vite build of the components |
| Preact with hand-made islands (today) | No build | Islands, a design system and typed templates by hand |
| SvelteKit, React Router | Full frameworks with routing and data loading | A client router and a second server runtime; more than pages on the server need |
| Hono with JSX | Small, typed JSX on the server | JSX in `.tsx` files; islands by hand |
| htmx with Alpine | No build for small interactions | Script in every page; the owner decided against client script without need |

## Prior art

- **Astro** 7.4 (MIT, very active), **`@astrojs/node`** 11.1 (MIT): adopted, pinned exactly (`astro` 7.4.4,
  `@astrojs/node` 11.1.9, both two weeks old). Astro's docs of the middleware mode and of `locals` describe this setup.
- **`@astrojs/check`** 0.9 (MIT): adopted for the typecheck of templates.
- **`@astrojs/compiler-rs`** 0.5 (MIT): Astro's own parser, already a dependency of Astro; adopted by TEMPLATE for the
  tree of a template.
- **Express + Astro middleware** examples in Astro's docs: the pattern of a server that owns the routes and hands
  data to Astro.

## Consequences

- One existing page, `/health`, renders through Astro; its scenarios kept their text, and SCN-CONSOLE-136 proves that
  it has the navigation of every page. The other pages move one at a time (T-60).
- Every answer has a Content-Security-Policy without script (SCN-CONSOLE-135).
- The npm package of the console must ship `dist/web/` (T-53's last slice), and the image installs it from npm.
- A template that needs a value computes it in its route: the rule keeps REACH and MUTATION honest.
- Revisit when Astro's middleware mode no longer takes `locals`, or when a page needs Astro's own endpoints.
