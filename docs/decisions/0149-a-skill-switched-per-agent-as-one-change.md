---
status: accepted
date: 2026-11-15
---

# 0149. A skill switched on or off per agent as one change of several edits

## Context

T-59 puts one switch per agent on the console's page `/skills/<name>`. A switch is a change of T-58 (ADR 0144): a pull
request on the factory's repository. Switching a skill on for an agent that lacks a secret, its secrets provider or a
host that the skill needs (the catalog's `needs`, ADR 0143) must add them too, since `factory edit` refuses a skill
whose secret or host the agent lacks (ADR 0135). So one switch can be up to four kinds of edits, and the person must
see each added secret and host before the change is made.

ADR 0144 made one change one edit: the pull request's title is the line `factory edit <edit> <agent> <value>`, which
"Try again" reads back and checks like a form, and names "a change of more than one edit" as a point to revisit. The
console keeps no state, so whatever several edits a change holds must be readable again from what the forge port
prints. Open questions:

- How one pull request carries several edits, so that "Try again", "Discard", the states and the checks of a title
  keep working.
- Where the switch computes what to add, which reference a missing secret gets, and how the person confirms it.
- How the page shows a change that is not live yet beside the skill's agent.
- How a skill of another repository (ADR 0146) is switched on for one more agent.

## Decision

### The title holds every edit

- The title is `factory edit ` and then the edits, each as its three words, separated by `; `:
  `factory edit add-secret review ref:openbao/linear-token; add-egress review api.linear.app; add-skill review
  ./skills/release-notes`. A change of one edit keeps the title of ADR 0144, so the changes that exist stay changes.
- "Try again" and the page split the title at `; ` and check each part exactly like a form: three words, an edit of
  `factory edit`, an agent's name and a value of its kind. No value the console takes holds a space or `;`, so a part
  that holds either fails the check, as a renamed title does today.
- The branch is `console/<the last edit>-<its agent>-<commit>-<hash>`, and the hash is the SHA-256 of every edit's
  three words. For one edit both are those of ADR 0144. The last edit of a switch is the skill's.
- The console runs `factory edit` once per edit, in the title's order, each on the text the one before printed, and
  commits the last text in one commit. An edit that changes nothing on its own, such as a provider that the newest
  commit already declares, is no error; a change whose whole text is unchanged is refused as before.
- The body lists the sentence of each edit as an item, like "The agent `review` may reach the host
  `api.linear.app`.", so the pull request names each added host and secret in plain words. A change of one edit keeps
  its sentence as a paragraph.
- `POST /changes` takes the edits of such a line in the field `edits`, besides the fields of one edit, with the same
  guard, roles and checks. A person with the role may already propose any edit one by one, so the field gives no new
  power.

### The switch

- `/skills/<name>` lists every agent of the factory: whether it has the skill, and a button "Switch on" or "Switch
  off". The button is a form with `GET` to `/skills/<name>/switch?agent=<agent>`, a page that asks first, like the
  delete page of the secrets: it lists each edit of the change in plain words and holds the form "Propose change", which
  posts the edits to `/changes` in the field `edits`. So the person sees what the change adds before it exists, and
  the console proposes exactly what the page showed.
- Switching on adds, in this order: the secrets provider `openbao` at `^0` when the factory declares none of that name
  and the agent lacks a secret; for each secret the agent lacks, the reference `ref:openbao/<name>`, the secret's
  variable in lower case with `-` for `_`, which gives back the variable (ADR 0140) and is the name an admin stores on
  `/secrets` (ADR 0137); for each host the agent's sandbox lacks, the host; then the skill. An agent without a sandbox
  reaches every host and gets no host. What the agent lacks comes from `factory.yaml` in `CONSOLE_FACTORY`, by the
  rule of factory-spec: the variable of a reference is its name in upper case with `_` for every character outside
  `A-Z` and `0-9`.
- Switching off removes only the skill: a secret or a host may serve another skill of the agent.
- The skill's value is the entry of `factory.yaml` that names it, as an agent that has it writes it: `./skills/x` or
  `git+<url>#<ref>:<path>`. So a skill of another repository is switched on for one more agent with the entry and the
  pin it already has; adding a new skill of another repository stays a change in Git. The console takes such an entry
  only with `https`, `http` or `ssh`, host, path, ref and folder of letters, digits and `._~/-`, and without `..`.
- The switches need a factory repository on a forge and the role admin or factory-engineer. Without them the page
  shows whether each agent has the skill, no button, and why, with the words of `/changes`; the page that asks first
  answers 404 or 403 like the forms of `/changes`.

### A change beside its agent

With a factory repository, `/skills/<name>` reads the console's changes as `/changes` does, keeps the open ones whose
title adds or removes this skill for an agent, and runs `pr` only for those. Beside that agent it shows "Switching on"
or "Switching off", the change's state ("Checking", "Failed", "Conflict" or "Ready") and the link to the pull request,
in place of the button. A change that is live shows nothing here: the page reads `factory.yaml` from
`CONSOLE_FACTORY`, which has the skill once the profile reads the new commit.

### The source of a skill

`/skills` and `/skills/<name>` name a skill of another repository by its folder, the repository's URL and the first 7
characters of its pinned commit, like "skills/release-notes in https://github.com/acme/skills.git at 7c2e91d", and one
without a pin as "not pinned"; its problem is the catalog's.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| All edits in the title, separated by `; ` (chosen) | `prs` and `pr` print it; "Try again" and the checks stay one rule; a change of one edit is unchanged | A long title; a forge refuses one over 255 characters, which takes about six edits |
| The title names the skill only, and "Try again" works the needs out again | Short title | "Try again" could add a host the person never saw; it needs `factory skills` on the newest commit |
| A line per edit in the body | No length limit | The port prints no body (ADR 0144); a new port output first |
| One pull request per edit | No new form | A skill's edit fails until the others merge; three pull requests for one switch |
| The switch posts only the agent, and the console works the edits out again | Smaller form | What the console proposes can differ from what the page showed |
| A switch that posts at once, with no page that asks first | One click | The person sees an added host only after the pull request exists |

## Prior art

- **Renovate's grouped updates** (AGPL-3.0, very active): one pull request for several updates, its title naming the
  group and its body listing each. The console lists each edit in the body and keeps the edits in the title, since
  the port prints no body.
- **Backstage's software templates** (Apache-2.0): a review step that shows what the template will do before it opens
  a pull request. The page that asks first is that step, as a page without script.
- **GitHub's permission screens of apps**: an install lists each permission it adds before the person confirms; the
  console lists each added host and secret the same way.

No new dependency.

## Consequences

- A factory engineer switches a skill on for an agent in two clicks, sees the added secret and host first, and the
  change goes live like any other change.
- A change of several edits takes one run of `factory edit` per edit, each a start of a program.
- `/skills/<name>` with a factory repository runs `prs` at each opening, and `pr` for each open change of the skill;
  without one it reads no forge.
- The console now knows factory-spec's rule of a secret's variable. If the catalog gives each agent's lacks for every
  agent, not only for those that use the skill, the console can drop it.
- Revisit when the forge port prints the body of a pull request, or when a switch needs more than a forge's title
  holds.
