---
status: accepted
topic: console
date: 2026-11-15
---

# 0141. The console's skills pages: the skills from `factory skills`, their Markdown through markdown-it

## Context

T-59 gives the console the pages `/skills` and `/skills/<name>`: every skill the factory's agents use, with its
description, its source, its agents and what it needs, and a skill's `SKILL.md` as rendered Markdown. This decision
covers the first, read-only slice: skills in folders of the factory's own repository. Skills of other repositories
(pins in `factory.lock`) and the switch per agent come later.

Two questions need an answer:

- **Where the console gets a skill.** ADR 0135 puts the rules of skills in `factory-spec`, which owns `factory.yaml`,
  and has the console run `factory` as a separate program, as it runs a forge adapter (ADR 0073). ADR 0140 made those
  rules: the front matter, the needs in `metadata` and what an agent lacks. The console must not parse a `SKILL.md` a
  second time, or its rules and lint's drift apart. ISOLATION keeps a module from importing another module.
- **How the page shows Markdown from a repository.** A `SKILL.md` is written by whoever may push to the factory's
  repository, or later by another repository's author. The page must show it without raw HTML, without a script,
  without a remote image and without a `javascript:` link. The Content-Security-Policy of every answer already forbids
  scripts and other origins (ADR 0132), but the HTML itself must be safe too: a page is read in browsers and tools
  that may not enforce the policy, and an image of another origin tells it who reads the page.

## Decision

- **`factory skills` prints the skills as JSON**, a command of `factory-spec` (`modules/factory-spec/README.md#the-skills-as-json`).
  It reads every skill an agent uses with the rules of `factory lint` and prints, per skill, its name, description,
  source (`{ "folder": "skills/release-notes" }`, the place for a repository and a commit later), its needs, each agent
  with the reference that gives each needed secret and what the agent lacks, the names of its files, the text of
  `SKILL.md` below its front matter, and the problems of its own files. A skill that lint refuses is printed with its
  problems, so the console can show them; only a `factory.yaml` that does not fit the contract fails the command.
- **The console runs it** as `<CONSOLE_FACTORY_COMMAND> skills --file <CONSOLE_FACTORY>` when a skills page is opened,
  with `CONSOLE_FACTORY_COMMAND` defaulting to `npx -y @opensoftware/factory-spec`. A failure is a note on the page,
  never an exception. The console's system tests give it a small program that prints the JSON the factory-spec
  scenarios prove (SCN-FSPEC-115 to 117), as the foreman's tests give it a fake `npx`: ISOLATION does not let the
  console's tests start another module.
- **The state of a needed secret** comes from what the console already knows for `/secrets` (ADR 0137): the
  reference an agent gives it, and the names in the store when `OSF_OPENBAO_ADDR` is set. A reference of OpenBao is
  "Set", "Missing" or "Unknown" (the store does not answer); without a store it has no state. A reference of another
  provider is "Set outside the UI". A secret that an agent of the skill does not declare is "Not declared", and a host
  that a sandboxed agent of the skill does not allow is "Not allowed": both come from `factory skills`, with or without
  a store. The worst state of a secret's references shows, in the order missing, unknown, set, outside the UI. A
  needed secret's name is no secret value, so both pages show the states in every mode.
- **markdown-it renders the Markdown**, in `src/domain/markdown.ts` of the console, configured to be safe:
  - `html: false`: raw HTML, a `<script>` among it, is text, escaped.
  - A link keeps its anchor only for `https:`, `http:` and `mailto:`, with `rel="nofollow noreferrer"`. Every other
    link, `javascript:`, `data:`, `vbscript:`, a relative path or a fragment, keeps only its text. Every link parses
    first (`validateLink` accepts all), so a refused link shows its words and not its Markdown.
  - An image is never an image: it shows its alternative text, so no image of any origin loads. A skill cannot carry
    a picture anyway: a binary file fails lint (ADR 0140).
  - No linkify, no typographer, and headings two levels down (`#` is an `h3`), below the page's title and the panel's
    heading.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `factory skills` as JSON, run as a program (chosen) | One place for the rules; the console stays apart from `factory-spec` as ADR 0135 asks | A fake program in the console's tests; the JSON is documented in a README, not a contract |
| The JSON as a format of `contracts/` | Both sides tested against one schema | A contract for one command and one reader; can follow when a second reader comes |
| The console parses `SKILL.md` itself | No process per page | The rules twice, as ADR 0135 warns |
| markdown-it, safe by configuration (chosen) | One package and its six small dependencies; its own types; raw HTML off by default; a renderer rule per token, so images and links are a few lines | Its own validator allows `data:` images, so ours replaces it |
| micromark | Safe by default (no HTML, dangerous protocols dropped), from the unified collective | An image or a relative link cannot be changed without writing an HTML extension |
| marked with DOMPurify | Fast and common | marked does not sanitize; DOMPurify needs a DOM on the server (jsdom), many more packages |
| remark and rehype with rehype-sanitize | What Astro's own Markdown uses; a schema per tag | About 60 packages; Astro's own Markdown processor allows raw HTML |
| sanitize-html after any renderer | A proven allowlist | A second parser after the first; markdown-it alone needs no cleanup when it never emits raw HTML |

## Prior art

- **markdown-it** 15.0.3 (MIT, active: releases in August, September and October 2026, a CommonMark parser used by
  VS Code and many documentation tools): adopted. Read its security notes (raw HTML off unless `html: true`;
  `validateLink` refuses `javascript:`, `vbscript:`, `file:` and `data:` but for some images) and its renderer rules.
- **micromark** 4.0.3 (MIT, unified collective, active): checked; safe by default, but the image and link rules above
  would need an extension.
- **marked** 18 (MIT, active) and **DOMPurify** (Apache-2.0 or MPL-2.0, active): checked; together they need a DOM.
- **remark**, **rehype** and **rehype-sanitize** (MIT, unified collective, active), and **`@astrojs/markdown-remark`**:
  checked; many packages, and Astro's processor keeps raw HTML.
- **sanitize-html** 2.18 (MIT, active): checked; not needed when the renderer emits no raw HTML.
- **GitHub's rendering of Markdown** (proprietary): it keeps a list of safe HTML and proxies images; we keep no HTML
  and show no image, which is simpler and enough for a skill's instructions.

## Consequences

- `/skills` and `/skills/<name>` show what lint knows: a skill that fails lint shows its problems, and an agent that
  lacks a secret or a host shows it.
- Each page runs `factory` once, so it costs a process start; `npx` resolves the package once and keeps it.
- A skill's own picture, or a link to another file of the skill, shows as text. When the page shows a skill's other
  files, a link to one can point there.
- Revisit when the page needs images (then served from the skill's own files through the console, never from another
  origin), when a second program reads `factory skills` (then a contract), or when markdown-it is no longer maintained.
