---
covers: [docs/design/**]
---

# Design direction: precise industrial

The look of the factory's UI, approved by the owner on 14 November 2026. `TODO.md` wave 6 builds it: T-54 turns
these values into the design system `@opensoftware/ui`, and T-56 to T-59 build the pages. Until that package exists,
this folder is the reference: build a page so that it looks like its mock-up.

## The mock-ups

Each file is one static HTML page with inline styles and no script. Open it in a browser; read its markup for exact
sizes, spacing and colours. The data in them is invented.

| File | Shows | Size it was drawn for |
| --- | --- | --- |
| [`brand.html`](brand.html) | The icon (A is approved; B and C were the other candidates), the colours of both themes, the faces, the states, the controls | 1280 × 980 |
| [`sign-in.html`](sign-in.html) | The sign-in page, with a person who is refused | 1280 × 800 |
| [`runs.html`](runs.html) | The shell with its navigation, and the runs list | 1280 × 800 |
| [`secrets.html`](secrets.html) | Secrets: one missing, two set, one not used, and the form that stores a value | 1280 × 800 |
| [`skill.html`](skill.html) | One skill: its agents with a switch each, what it needs, a change that is checking, its `SKILL.md` | 1280 × 800 |
| [`runs-phone.html`](runs-phone.html) | The runs on a phone: a top bar, cards in place of the table, the main action at the bottom | 390 × 844 |

The mock-ups load IBM Plex from Google Fonts, so that a file opens without a build. The product does not: the
console serves its fonts itself (T-53).

## The values

| What | Value |
| --- | --- |
| Icon | A sawtooth factory roof with an open door, one shape in one colour, readable at 16 pixels. In a 32-pixel view box: `M4 27V15l8-6v6l8-6v6l8-6v18H4zM14 27v-5h4v5h-4z`, filled with the even-odd rule. |
| Wordmark | "Open Software Factory" in the UI face, weight 600, beside the icon. |
| Faces | IBM Plex Sans for text. IBM Plex Mono for what a person copies or compares: IDs, versions, names of secrets and skills, counts. Both are open-licensed (OFL). |
| Dark theme, the default | Ground `#0C0D0F`, surface `#141619`, raised `#1B1E22`, line `#272B31`, strong line `#3A4048`, text `#E6E8EB`, muted text `#A0A7B1`, subtle text `#808894`. |
| Light theme | Ground `#FAFAF9`, surface `#FFFFFF`, line `#E2E4E8`, text `#111316`, muted text `#555C66`, signal `#C4400A`. Added for the tokens (ADR 0133), so that every text passes CONTRAST: raised `#F2F3F5`, strong line `#C9CDD3`, subtle text `#636A74`, running `#1B64C0`, failed `#C2261F`. |
| Signal colour | `#FF6B1A`. It means two things only: the main action of a page, and work that waits for a person. |
| State colours | Running `#6CB0FF`; waits for a person: the signal colour; failed `#FF8F8A`. Complete and cancelled have no colour (muted and subtle text). Each state is a shape and a word, never colour alone. |
| Shape | A 4-pixel grid, a radius of 4 pixels for controls and 6 for panels, lines instead of shadows, controls 44 pixels high. |
| Type sizes | Page title 24, section title 16, text 14, secondary 13, labels 11 to 12 in mono with capitals and wide spacing. Sentence case everywhere. |
| Layout | A navigation column of about 232 pixels on the left: the icon, the factory's name and version, the pages with a count of what needs attention, the account at the bottom. On a phone: a top bar with a menu button, a list of cards in place of the table, the main action fixed at the bottom. |
| Sign-in page | Two halves. Left: the icon, the name, one sentence and the factory's stages as a line of stations on a fine grid. Right: the provider buttons and a plain refusal message. |

These are the start of the tokens, not their final list. T-54 adds a check of contrast (WCAG 2.2 AA) for every pair
of text and background; when a value fails it, the value changes and this table with it.

## The rules behind the look

- Colour marks what needs attention. A finished run has no colour.
- Dense and calm: a table before cards, a line before a shadow, one weight of emphasis per row.
- Mono shows that a text is exact: an ID, a version, a name.
- Every screen that ships works. No placeholder, and no menu entry for a page that is not there.

## Where the plan differs from the pictures

The plan was reviewed after the mock-ups were drawn. Where they differ, `TODO.md` wins:

- **No script in the first release.** The menu button on the phone is a `details` element, a switch on a skill's
  page is a form, and "Delete" asks on a page of its own (T-54, T-56).
- **The theme** is dark unless a cookie says light; a link in the account area sets it. The mock-ups show no such
  link yet (T-54).
- **Counts in the navigation.** The first release shows a count only for Runs; the mock-ups also show one for
  Secrets and Changes (T-56).
- **The navigation** lists only what works in the console's mode and for the person's role. "Changes" comes with
  T-58, and the group "Classic pages" shrinks as T-60 moves each page.
- **States the mock-ups do not show:** an empty list, a server that does not answer, a form with a wrong value, the
  light theme of a whole page. The page that needs one adds it in the same language and adds a mock-up or a
  screenshot here.
