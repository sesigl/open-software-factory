---
status: accepted
topic: console
date: 2026-11-15
---

# 0144. The console's changes: the factory's repository, the pull request's title as the edit, and the states

## Context

T-58 makes a change of the factory from the console a pull request. ADR 0136 gives the forge port what the flow needs
(`commit`, `branch --from <commit>`, `merge --when-green`, `rules`, `close --delete-branch`, `prs --limit`), ADR 0135
puts the edits into factory-spec's `factory edit`, and ADR 0142 lets a program fetch a factory from
`git+<url>#<ref>` with a token of its own variable. They leave open:

- How the console is told the factory's repository on the forge, which token it uses and how it reads the newest
  commit.
- Where the console, which keeps no state, finds the edit of a change again for "Try again": the port's `pr` and `prs`
  print no body of a pull request.
- How the console knows which pull requests are its own: the port has no command that names the token's user.
- How the states of the page `/changes` follow from what `prs` and `pr` print, and when the console asks for a merge.

## Decision

### The repository and the token

- **`CONSOLE_FACTORY_REPOSITORY`** is the factory's repository as `git+<url>#<branch>`, the form of ADR 0124 and the
  library `@opensoftware/factory-source`, like `git+https://github.com/acme/factory.git#main`. `<branch>` is the main
  branch that changes merge into (default `main`), and the repository's `<owner>/<name>` for the forge adapter is the
  last two parts of the URL's path, without `.git`. Without it the factory is a local folder, and `/changes` says that
  the console cannot change it.
- **`CONSOLE_FACTORY_TOKEN`** is the forge token of the changes. The console gives it to the forge adapter in
  `CONSOLE_FORGE_ADAPTER` as `FORGE_TOKEN` (with `CONSOLE_FORGE_URL`), and to `factorySource` for the fetch, which
  sends it to Git as Basic credentials (ADR 0142). It is not the inbox's read-only `CONSOLE_FORGE_TOKEN`. It needs:
  on GitHub, a fine-grained token or an app for the one repository with Contents read and write, Pull requests read
  and write, Commit statuses read, Checks read, Administration read (the branch protection that `rules` reads) and
  Metadata read; on Forgejo, the scopes `write:repository` and `write:issue` of a user who may write the repository.
- **`CONSOLE_FACTORY_USER`** names that token's user as the forge adapter names an author, like `forgejo:factory-bot`
  or `github:acme-factory`. The page lists only the pull requests of that author, so a branch that somebody else pushed
  under `console/` is not a change and gets no button. A later `whoami` of the forge port can replace the setting.
- **The newest commit** is what `factorySource(CONSOLE_FACTORY_REPOSITORY).fetch()` gives at each form, in the cache
  folder `CONSOLE_FACTORY_CACHE` (default one folder per repository below the system's temporary folder). The pages
  that show the factory keep reading `CONSOLE_FACTORY`; reading them from the repository too is the profile's slice of
  T-58.

### The flow of a change

1. Check the form like any form (ADR 0089, ADR 0134), the role `admin` or `factory-engineer`, and the edit (below).
2. Fetch the newest commit and read the branch's rules with `rules`, at the same time. A branch that does not require
   the check `factory` gets no change: the console answers 409 and names the check and the branch.
3. Run `factory edit --file <the fetched factory.yaml> <edit> -- <agent or name> <value>`. An edit that `factory edit`
   refuses answers 400 with its reason; an edit that changes nothing answers 400 and opens nothing.
4. `branch <repo> console/<edit>-<agent or name>-<commit>-<hash> --from <commit>`, where `<commit>` is the first 7
   characters of the commit that was read and `<hash>` the first 8 of the SHA-256 of the edit's three words. So the
   branch starts at the commit that was read, a change that arrived on the main branch in between shows as a conflict,
   and the same edit on the same commit is the same branch, which the forge refuses a second time.
5. `commit` the edited `factory.yaml`, with the trailer `Requested-by: <email>`; `open-pr` with the title and a body
   that says what changes, who asked for it, that the forge merges it when the check `factory` passes, and that a run
   keeps the factory version it started with (ADR 0110).
6. `merge --when-green`. When the forge cannot do it for the repository, the change waits as "Checking" and becomes
   "Ready" (below). The answer is 303 to `/changes` once the pull request is open.

### The title is the line for a program

The pull request's title is the command line of the edit: `factory edit <edit> <agent or name> <value>`, like
`factory edit add-egress triage api.linear.app`. It says exactly what changes, `prs` and `pr` print it, and "Try
again" reads the edit from it. Anyone who may write to the repository can change a title, so the console checks it
exactly like a form, and checks the person's role again. A title that is not such a line shows as it is, and "Try
again" refuses it.

The console checks each value before any program sees it: an egress host is a host name (letters, digits and hyphens
in dot-separated labels, at most 253 characters, no scheme, port, path or wildcard), a secret reference has the form of
the contract (`ref:<provider>/<name>`), a skill is a relative path without `..`, a provider is a name of the contract
and its range has only the characters of a semver range. The body of the pull request writes the person's email with
every Markdown character escaped and each value in a code span; the branch name holds only the edit's word, the
agent's name in lower-case letters, digits and hyphens, and hexadecimal digits.

### The states

The page runs `prs <repo> --state all --limit 50`, keeps the changes of the author `CONSOLE_FACTORY_USER`, and runs
`pr` only for the changes that are still open, at the same time:

| State | When | Buttons (roles only) |
| --- | --- | --- |
| Live | Merged: "Live for the next run: factory version <the first 7 of the merge commit>" | none |
| Discarded | Closed without a merge | none |
| Conflict | Open and not mergeable with its base | "Try again", "Discard" |
| Failed | Open with a check whose state is `failure` or `error`: "The check <name> failed.", with the link to the pull request | "Try again", "Discard" |
| Ready | Open, mergeable, its check `factory` passed and none failed | "Merge" |
| Checking | Any other open change; the page reloads itself every `CONSOLE_REFRESH` seconds while one is checking | none |

"Try again" closes the pull request with `close --delete-branch` and makes the change again on the newest commit;
"Discard" only closes it and deletes its branch; "Merge" runs `merge` without `--when-green`. Each button runs `pr`
first and acts only on a change of the console in a state that offers it: 404 for another pull request, 409 for
another state. So no failed change stays armed to merge later without a person. Where the forge merges when green,
"Ready" lasts only until the forge merges.

### The check comes first

The console asks for a merge only on a branch whose rules require the check `factory`. The port cannot read the checks
of a commit, so the case of the TODO in which the rules do not require the check but the newest commit of the main
branch carries it is not known yet: such a repository gets no change and the console says what is missing. A forge
that cannot merge when green (a GitHub repository without "Allow auto-merge", or a plan without it) still gets
changes: each waits as "Checking" until its check passes, and then a person presses "Merge".

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The title as the edit's line (chosen) | `prs` and `pr` print it: no extra call; it says exactly what changes | A person who renames the pull request breaks "Try again"; checked like a form anyway |
| A line in the body, as the TODO first says | The title stays prose | The port prints no body: a new port output first |
| A comment of the console with the line | `comments` marks the token's own comments (`mine`) | One more write per change and one more read per "Try again" |
| The branch name holds the whole edit | Nobody changes a branch name | A value with `/` or `.` changes the branch's meaning; long names |
| `CONSOLE_FACTORY_USER` (chosen) | Works today | One more setting, until the port has `whoami` |
| Trust every `console/` branch | No setting | A branch of another person gets the buttons, which close and delete it |
| `CONSOLE_FACTORY` takes `git+<url>#<branch>` too | One setting | Every page would fetch; the profile's slice decides that with the foreman's |

## Prior art

- **Renovate** (AGPL-3.0, very active) and **Dependabot** (MIT): bots that open pull requests from branches with a
  fixed prefix and a stable name per update, find their own pull requests again by the branch and the author, and
  recreate a branch on the newest base. The console follows the pattern; it needs no bot of its own.
- **Atlantis** (Apache-2.0, active): changes of infrastructure as pull requests with a check that must pass; checked
  for the order "check, then merge", not adopted.
- **Backstage's scaffolder** (Apache-2.0): its `publish:github:pull-request` action opens a pull request from a web
  form; it holds a Git client of its own, which the forge port makes unnecessary here.

## Consequences

- A factory engineer changes the factory in the console on a repository whose main branch requires the check
  `factory`; the forge merges the pull request when the check passes and the page shows "Live".
- The console needs three more settings for changes, and the console's scenarios of a change start Forgejo
  (`fakes.forge`), so the console's suite runs with the image `forge`.
- Three wishes for the forge port, each of which simplifies the console: `whoami` (in place of
  `CONSOLE_FACTORY_USER`), the checks of a commit (for the case above), and the body of a pull request in `pr`.
- Posting the check `factory` on Forgejo (a runner of Forgejo Actions or the `factory` tools in a job of the profile)
  is decided with the workflow of the reference factory, the next slice of T-58. The scenarios post it as the commit
  status that the port's `check` writes, with Forgejo's API, since a system test starts no program but the module.
- The page lists the newest 50 pull requests of the repository without `--head`, because Forgejo names the head of a
  closed pull request whose branch was deleted `refs/pull/<n>/head`; such a pull request of the token's user counts
  as a change when its title is a line of `factory edit`. A repository with many other pull requests, like
  observer's proposals, may push older changes off the page.
- A change waits as "Conflict" only after `pr` answers, and forge-forgejo's `pr` waits up to 10 seconds for a pull
  request that is not mergeable, so the page of a conflicting change takes that long.
- Revisit when the port gets those operations, or when a change edits more than one file.
