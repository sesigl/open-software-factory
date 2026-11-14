---
status: accepted
date: 2026-11-14
---

# 0131. Three kinds of UI test: pages over HTTP, journeys and islands in Chromium

## Context

Wave 6 of `TODO.md` turns the console into the factory's UI (ADR 0130): a sign-in with redirects, forms for secrets,
skills and changes, a layout that must work on a phone, and later islands that run script in the browser. No test of
a module opens a browser today; only proof uses Playwright, to capture evidence (ADR 0029). The console's 86 tests
read a page's HTML with patterns for literal tags: `rows` in `modules/console/system-tests/console.ts` matches
`<tbody>`, `<tr>` and `<td>` without attributes, and 14 test files match tags themselves. A test breaks when the
markup changes although the page still works, and no test can prove a redirect chain with cookies, an island or a
layout.

Every test stays a system test (ADR 0007): one scenario, one test, the built artifact from outside, counted by TRACE,
STEPS, PASS and BUDGET.

## Decision

### Three kinds

| Kind | Runs | Proves | Cost (measured below) |
| --- | --- | --- | --- |
| Page scenario | The built console over HTTP with `sut.pages`; no browser, no script | What a page shows and what a form does. The default. | About 5 ms to parse a page and 20 ms for its queries |
| Journey scenario | The built console with its fakes, in Chromium with `sut.browser` | One main flow of a person from start to end, across pages | A context in 30 to 60 ms, a page and a click in 80 to 100 ms, axe in 200 ms |
| Island scenario | One island of `@opensoftware/ui` on its page of the workbench (T-55), in Chromium | Everything the island does, as a whole | Under a second |

- A behavior is a page scenario unless it needs a browser.
- A journey only for a main flow; a new journey needs its reason in the module's `AGENTS.md`. A journey is marked
  `@kind=journey`, so the mutation runner leaves it out of every mutant's run: server code is noticed by page
  scenarios, and a journey per mutant would start the console and Chromium again (ADR 0061).
- An island scenario for each island, at the level of the island, never one of a component inside it.
- A test finds elements by role, accessible name, label and text, or reads the page reader's facts of the document
  (its title, reload, stylesheets, script and forms). It never names a CSS class, a tag, an XPath or a test ID, never
  waits for time to pass, and uses only the named viewport sizes. A check of `tools/checks` enforces this (T-52).
- No pixel comparison. A journey's screenshots are evidence on the pull request, through proof.

### The page reader: `sut.pages`

`sut.pages.open(path)` fetches a page of the server `sut.http` started, parses it with happy-dom and answers
Testing Library's queries of its DOM package (`getByRole`, `getByText`, `getByLabelText` and their variants). A page
follows a link by its name and sends a form by pressing a button by its name, with fields named by their labels; it
follows redirects and keeps the cookies of the scenario, as a browser does, and sends the headers it was opened with
again, like a sign-in proxy. The testkit's public types name no DOM type: an element found is its accessible name,
its text, its attributes and the same queries inside it. happy-dom runs no script and loads no stylesheet or frame.

### The browser: `sut.browser`

Playwright with Chromium: one browser per test process and a new context per scenario, like the database per
scenario of ADR 0129. The same queries (role, name, label, text). The context has the testkit's clock, reduced
motion, the locale `en-US`, the time zone `UTC` and a named viewport (phone 390 × 844, desktop 1280 × 800). It refuses
every request that does not go to loopback and fails the scenario (NOREAL for the browser); an error in the
browser's console or a failed request fails the scenario too. A helper runs axe-core on the page a journey ends on.
The repository keeps one Playwright version: `playwright-core` at proof's pin. CI installs Chromium only for a suite
with `browser`, through `capture-browser`; a developer installs it with a make target of its own.

### Measured

On the development container (4 cores, Node 24), for a runs page with 50 rows:

| Step | Time |
| --- | --- |
| Import happy-dom and Testing Library, once per test process | 430 ms (jsdom: 510 ms) |
| Parse one page | 5 ms after the first (jsdom: 19 ms) |
| Queries of a page: all rows, a link and a button by name | 20 ms after the first (110 ms for the first) |
| Launch Chromium (headless shell) | 60 ms |
| A new context with a phone viewport, locale and time zone | 30 to 60 ms |
| Open a page and click a link | 80 to 100 ms |
| axe-core on a small page | 200 ms |
| A screenshot | 20 to 30 ms |

A page scenario costs what today's HTTP test costs. A journey of a few pages stays under a second after the browser
started.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| happy-dom with Testing Library's DOM queries (chosen) | Fast parse; the queries people know from Testing Library; role and name as a screen reader reads them | No layout: a page scenario cannot prove what fits a phone (a journey does) |
| jsdom with Testing Library | The most complete DOM outside a browser | Slower to import and parse (19 ms against 5 ms per page) |
| linkedom or a plain HTML parser (parse5, htmlparser2) | Fastest | No `getComputedStyle` and no accessible names, so no queries by role and name |
| A browser for every UI test | One kind of test | Seconds per scenario, a browser in every suite, and the mutation runner would start one per mutant |
| Playwright's own test runner | Fixtures, traces | A second test runner beside Vitest; scenarios would leave the testkit |
| Pixel comparison (Playwright `toHaveScreenshot`) | Catches visual changes | Fails on fonts and antialiasing; the owner decided against it |

## Prior art

- **Testing Library** (`@testing-library/dom` 10.4, MIT, active): queries by role, label and text; adopted with its
  dependency `dom-accessibility-api` 0.5 (MIT) for accessible names.
- **happy-dom** 21 (MIT, very active): a DOM for Node without a browser; adopted.
- **jsdom** 31 (MIT, very active): checked, slower.
- **Playwright** (`playwright-core` 1.56, Apache-2.0, very active): already pinned by proof; adopted for
  `sut.browser`.
- **axe-core** 4 (MPL-2.0, very active): the accessibility rules of a journey's last page; adopted with `sut.browser`.
- **Capybara's rack-test driver and Phoenix's `Phoenix.ConnTest`**: the pattern of reading server-rendered pages over
  HTTP without a browser and switching to a browser only where script runs.

## Consequences

- The console's tests read pages by role and name, so a change of markup that keeps the page working keeps them
  green, and the move to Astro (T-53) needs no change of a scenario.
- A page scenario cannot see layout or script: the phone layout and islands need a journey or an island scenario.
- Two libraries more in the testkit. The browser's cost stays in the suites that name `browser`.
- Revisit when Testing Library's queries or happy-dom fall behind what the pages use (custom elements, popovers).
