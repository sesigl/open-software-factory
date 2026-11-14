---
status: accepted
date: 2026-11-14
---

# 0133. The design system `@opensoftware/ui`: tokens in plain CSS, the brand, and components as templates

## Context

The console looks like Pico CSS's defaults (ADR 0072). Wave 6 makes it the face of the product, in the direction the
owner approved on 14 November 2026: "precise industrial", with its mock-ups and values in `docs/design/`. Each new page
of T-56 to T-59 needs the same colours, type, shapes and components, or it invents its own. The owner decided that the
design system is code in a shared package, and left Tailwind CSS against plain CSS on the tokens to this decision
(`TODO.md`, T-53 and T-54).

## Decision

- **A library `packages/ui`, `@opensoftware/ui`,** tier optional, prefix `SCN-UI` (ADR 0039). It holds:
  - the tokens, `assets/tokens.css`: CSS custom properties named by meaning (`--osf-bg-*`, `--osf-line*`,
    `--osf-text*`, `--osf-signal`, `--osf-on-signal`, `--osf-state-*`, the faces, the type sizes, the 4-pixel spaces,
    the radii, the control height, the navigation width and the motion). Dark is `:root`; the light theme is
    `:root[data-theme="light"]` and sets every colour again. Reduced motion sets the motion to none;
  - the brand, `assets/brand/`: the icon in the current text colour, the wordmark, and the favicon;
  - `files` and `text` in `src/index.ts`: the paths of these files and their text, for the server that serves them;
  - the components as `.astro` files, built when a page of the wave needs one (T-56 to T-59), never before.
- **Plain CSS on the tokens, no Tailwind.** The pages render on the server from templates that hold no logic
  (ADR 0132), so a few component stylesheets on named tokens are all a page needs. Tailwind adds a build of its own,
  utility classes in every template that TOKENS could not read as tokens, and a second vocabulary beside the tokens.
- **The theme comes from the server.** Dark unless a cookie says light; a link sets the cookie and returns to the
  page, and the server writes `data-theme` on the root element. The system's preference is not followed (the owner's
  decision), so nothing flashes and no script runs.
- **The values are `docs/design/README.md`'s.** Two values the mock-ups do not give were added to pass CONTRAST: the
  light subtle text `#636a74` and the light running state `#1b64c0`; the README lists them.
- **Two checks:**
  - CONTRAST: every text token (`--osf-text*`, `--osf-signal`, `--osf-state-*`) has at least 4.5:1 (WCAG 2.2 AA) on
    every background token (`--osf-bg-*`), and `--osf-on-<name>` on `--osf-<name>`, in both themes.
  - TOKENS: no colour value (a hex colour or a colour function) and no font declaration without a font token appears in
    the sources of `packages/ui/src/` and `modules/console/src/`. The brand files are pictures and keep their colours.
- **How the checks treat the library:** its system tests import it by name (BOUNDARY, ADR 0039) and read its files
  through `text`. Its components are templates: TEMPLATE keeps logic out of them and DUP reads them; REACH and MUTATION
  count `src/index.ts` and, from T-55, the islands. The console compiles the components; their logic stays in the
  console's routes.
- **Fonts and icons, when a page uses them:** IBM Plex Sans and Mono from the Fontsource packages (OFL), served by the
  console from its own origin (ADR 0132); icons from Lucide (ISC) as SVG files.
- **Private until its first publish.** The package is `private` until the maintainer publishes it once and adds its
  trusted publisher (`skills/release-packages`); then `osf release-files` writes its release files and the console
  depends on it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Plain CSS custom properties and a small own set of components (chosen) | No build; names by meaning; TOKENS and CONTRAST read one file; templates stay plain HTML | Each component's CSS is written by hand |
| Tailwind CSS on the tokens | Fast to write; a large community | A build step and its config; class lists in templates; colours as classes that a check cannot tie to a meaning |
| Open Props | Ready custom properties | Values by scale, not by meaning; most of them unused |
| A shadcn-style kit for SolidJS (shadcn-solid, Kobalte, Ark UI, corvu) | Accessible behaviour for dialogs, menus and popovers | Every component is an island with script; the first release has no script. Kobalte, Ark UI or corvu stay the candidates for T-55's first island |
| Keep Pico CSS | Nothing to build | Looks like every Pico site; no tokens of the approved direction |

## Prior art

- **Pico CSS** (MIT): stays for the old pages until T-60 moves each one.
- **Tailwind CSS** 4 (MIT, very active), **Open Props** (MIT, active), **Radix Colors** (MIT): checked; their naming
  by meaning and their contrast pairs informed the tokens.
- **Kobalte**, **Ark UI** and **corvu** (MIT, active, headless SolidJS): checked for islands (T-55).
- **Lucide** (ISC, very active) and **Fontsource** `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3
  (OFL-1.1): adopted when a page first needs an icon or the faces.
- **WCAG 2.2** contrast: the relative luminance formula of the W3C, computed by CONTRAST.

## Consequences

- A page of T-56 to T-59 uses only these tokens and components; TOKENS fails a page that names a colour or a font.
- Changing a colour means changing `docs/design/README.md` and `tokens.css` together, and CONTRAST must still pass.
- The console cannot depend on the package until it is published once.
- Revisit Tailwind when pages need many layouts that components do not cover.
