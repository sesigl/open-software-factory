---
status: accepted
date: 2026-11-15
---

# 0146. Skills of other repositories: the entry `git+<url>#<ref>:<path>`, its pin in `factory.lock`, and its fetch

## Context

T-59: an agent's `skills` entry in `factory.yaml` is a path to a folder of the factory's repository (ADR 0112,
ADR 0140). Sharing a skill between factories means copying its folder. T-59 asks that an entry may name a folder of
another Git repository at a ref, that `factory plan` pins its commit and a hash of its files in `factory.lock`, that the
foreman fetches it at that commit and refuses an entry without a pin, as it does for an MCP server of the registry
(ADR 0112), and that `factory render` links it for a person's checkout. The fetch belongs to
`@opensoftware/factory-source` (ADR 0135, ADR 0142), for the foreman, `factory-spec` and later the console alike.

A skill is instructions and scripts that an agent follows. A skill of another repository is a supply-chain risk: a
run must never follow a branch, and a person must see what an update changes. Open questions:

- The form of the entry, in line with the factory's own `git+<url>#<ref>` (ADR 0124).
- What the lock holds, and how a pin is kept and moved.
- Which hash, so that the foreman, `factory render` and `factory skills` check the same files.
- Where the format's rules of ADR 0140 run for files that `factory lint` cannot read without the network.
- Which token and which cache each program uses.

## Decision

- **The entry is `git+<url>#<ref>:<path>`**, for example
  `git+https://github.com/acme/skills.git#v1.2:skills/release-notes`. `<url>` is any URL Git fetches; `<ref>` is a
  branch, a tag or a commit; `<path>` is the skill's folder below the root of the repository. This is the factory's
  own form with Git's own `<rev>:<path>` (as in `git show v1.2:skills/release-notes`): a ref cannot hold a `:`
  (`git check-ref-format`), so the first `:` after `#` ends the ref. The ref and the path are required. A path that
  leaves the repository (a part `..` or a leading `/`) is refused. The skill's name is the last part of the path, as
  for a local folder. Every entry without the prefix `git+` stays a path of the factory's repository.
- **`factory.lock` gets an optional `skills`**: one pin per skill of another repository, by the skill's name, which is
  unique in a factory (ADR 0140): `{ source, commit, hash }`. `source` is the entry as `factory.yaml` writes it,
  `commit` the full commit (40 hexadecimal characters, 64 in a repository of SHA-256), `hash` the hash of the files.
  The field is optional and no other field changes, so the format stays compatible (SCN-CTR-023); a pin has no
  other fields (`additionalProperties: false`), as an adapter's pin.
- **A pin is kept while its entry is unchanged**, as the pins of the registry's MCP servers and of the adapters are
  (ADR 0020, ADR 0125). `factory plan` resolves the ref of an entry that has no pin, or whose pin's `source` differs
  from the entry, and writes the new pin. It prints each new or moved pin with the line form of its diff, before the
  other lines: `+ factory.lock.skills.review: {"source":…,"commit":…,"hash":…}`, and for a move
  `~ factory.lock.skills.review.commit: "<old commit>" -> "<new commit>"`, with the source and the hash. To move a
  pin, a person changes the entry's ref, for example from `v1.2` to `v1.3`; the review of that change in `factory.yaml`
  and `factory.lock` shows both commits. A branch is resolved once, at `plan`; no program follows it later.
- **The hash is Go's `h1`** (the dirhash of `go.sum`): the SHA-256 of one line `<SHA-256 of the file, in hex>  <path>\n`
  per file below the skill's folder, sorted by the path with `/` between its parts, written `h1:` and its base64. Only
  files count, not symbolic links, as the foreman copies only files (ADR 0112).
- **The library fetches**: `pinnedFolder(reference, { cache, token, pin })` of `@opensoftware/factory-source`, one value
  added to its surface. Without a pin, it fetches the ref and gives `{ folder, commit, hash }`. With a pin, it fetches
  the pin's commit, never the ref, and only when its cache does not hold that commit yet, and it refuses files whose
  hash is not the pin's with a `FetchError`. `cache` holds one folder per repository, named by the first 16
  hexadecimal digits of the SHA-256 of the URL, each with the layout of ADR 0142. A folder that the commit lacks, and a
  reference that is not of the form, are a `FetchError` too.
- **No token for a skill's repository yet.** The library takes a token as for a factory, but neither the foreman nor
  `factory-spec` passes one: `FOREMAN_FACTORY_TOKEN` is for the factory's repository, and sending it to another host
  would give that host the factory's token. A skill of a private repository works with Git's own credentials (a
  credential helper or an SSH key, ADR 0124).
- **Each program keeps its own cache**: the foreman `$OSF_DATA/skills`, `factory-spec` `$OSF_DATA/skills` of its state
  folder (default `.factory/skills`).
- **The foreman** reads the pin of each skill of another repository that a stage's agent uses, from `factory.lock` in
  the folder of `factory.yaml`, whenever it reads the factory: at the start of the server and of each run. An entry
  without a pin, or whose pin's `source` is not the entry, is a usage error that stops the server at the start
  (`factory.lock has no pin of the skill "review" for "<entry>": run "factory plan"`), and a `FetchError` is one too,
  so a hash that does not match stops it. It then copies the fetched folder's files into the session's folder, as for
  a local skill (ADR 0112).
- **`factory render`** links the skill's folder in the cache, fetched at its pin and checked, as it links a local one;
  an entry without a pin fails with the same message.
- **The rules of `factory lint`** (ADR 0140), which reads no network:
  - An entry that starts with `git+` and is not of the form, or whose path leaves the repository, is a problem.
  - Two skills with one name, one local and one of another repository, are a problem: the rule "one name, one skill
    folder" counts the entry of another repository as a folder of its own.
  - An entry that `factory.lock` does not pin for it is a warning in `lint`, since `plan`, which lints first, writes the
    pin; `factory plan --check` names it and exits with 1, as for an MCP server.
  - **The format's rules for a fetched skill run at `factory plan`** (and `apply`), which fetches anyway: after it
    pinned, `plan` lints `factory.yaml` again with the files of every skill of another repository, fetched at its pin,
    so the rules of the format, of text files and of the agent's secrets and hosts apply as to a local skill. A problem
    fails `plan` and writes no `factory.lock`. A problem in such a skill's file names the entry and the file, like
    `git+https://…#v1.2:skills/release-notes/SKILL.md:2:1 the skill has no description: …`.
- **`factory skills`** fetches each pinned skill at its pin and prints it as a local one, with `source` holding its
  folder in the other repository, the repository's URL and the commit: two optional fields of the contract
  `skill-catalog` (ADR 0143). A skill without a pin is printed with its URL, no files, no body and the problem of the
  missing pin.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `git+<url>#<ref>:<path>` (chosen) | The factory's form and Git's own `<rev>:<path>`; one text, so `factory edit` and the catalog need no new shape | A `:` inside a ref cannot be written, which Git forbids anyway |
| `git+<url>#<ref>&path:/<path>` (pnpm) | pnpm's form for a package below the root | `&` and `path:` belong to pnpm's parameters, which npm does not read either |
| An object `{ git, ref, path }` (Claude Code's `git-subdir`) | Each part has a field | The contract's `skills` is a list of text; a change of its type is a major version |
| Lock by the entry's text | No name needed | A move is a removal and an addition: `plan` could not show old commit → new commit |
| Lock by the skill's name (chosen) | One pin per name, as one skill per name; a move is one changed value | A rename of the folder is a new pin |
| `plan` follows the ref at each run | A branch updates by itself | `plan` would need the network for every factory with such a skill, and a pin would move without a change of `factory.yaml` to review |
| Go's `h1` dirhash (chosen) | A documented hash of a folder, simple to compute with Node's `crypto` | Not Git's own object ID |
| Git's tree ID (`<commit>:<path>`) | Git computes it | The foreman would need Git's object format to check the files it copies; SHA-1 in most repositories |
| The format's rules in `lint`, fetching | One command finds every problem | `lint` runs on each page of the console and in every editor: it would need the network and a cache |
| The format's rules at `plan` (chosen) | `plan` fetches anyway; a skill is checked before a pin enters `factory.lock` | `lint` alone does not see a problem of a fetched skill |
| The factory's token for every skill | A private skill on the same forge works | The token reaches every host a `factory.yaml` names |

## Prior art

- **Agent Skills specification** (agentskills.io, ADR 0140): says nothing about sources or pins; a skill is a folder.
- **`skills`, the command line of Vercel** (`vercel-labs/skills`, MIT, active): read its README on github.com. It names
  a source as `owner/repo` (and `owner/repo@skill`), and writes `skills-lock.json` (version 2) with a `computedHash` of
  the installed files of each skill and, for a Git source, its `commit`, so that a restore fetches the same revision.
  The same two values, a commit and a hash of the files, are adopted; the tool is not, since the foreman copies skills
  itself (ADR 0112) and the lock of a factory is `factory.lock`.
- **Claude Code's plugin marketplaces** (proprietary; read the marketplace reference on code.claude.com): a plugin's
  source `git-subdir` has `url`, `path`, `ref` and `sha`, the full 40-character commit; with both, Claude Code checks
  out `sha`, and it asks to pin a reviewed marketplace by a full commit so that refreshes do not move it. The parts are
  adopted; their object form is not, since `skills` is a list of text.
- **npm and pnpm** (Artistic-2.0, MIT): a Git dependency is `git+<url>#<ref>`, and the lock file holds the resolved
  commit (`resolved: git+…#<commit>` in `package-lock.json`). pnpm names a folder below the root with
  `#<ref>&path:/<path>`. The `git+` form and the resolved commit are adopted.
- **Go modules** (BSD-3-Clause): `go.sum` holds an `h1:` hash of each module's files, the dirhash `Hash1` of
  `golang.org/x/mod/sumdb/dirhash`. Adopted as the hash, written in Node's `crypto`; no dependency is added. Checked: `dirhash.Hash1` of
  `golang.org/x/mod` 0.20.0 gives the hash that SCN-FSOURCE-012 expects for its two files.
- **Git** (GPL-2.0): `<rev>:<path>` names a folder of a commit, and `git fetch <url> <commit>` fetches a commit by its
  ID on GitHub, GitLab and Git's own `upload-pack` (protocol 2); the library already runs Git (ADR 0142).

## Consequences

- A factory shares a skill with another by naming its repository, a ref and its folder; `factory plan` pins it, and
  the review of `factory.yaml` and `factory.lock` shows each commit a pin takes.
- A run never fetches a ref: the foreman fetches only a pinned commit, from its cache once it holds it, and checks the
  hash at every read, so a changed file in the cache or a rewritten commit stops the server.
- `factory render`, `factory skills` and the foreman need the network once per pinned commit; `factory lint` never.
- `factory-spec` depends on `@opensoftware/factory-source`, so the library is released before `factory-spec`.
- A skill of a private repository needs Git's own credentials until a program has a setting for its token.
- Revisit when a skill's repository needs a token of its own (a setting per host), when people ask for a command
  that moves the pins of branches (like `factory plan --skills`), or when the console adds a skill of another
  repository from the UI.
