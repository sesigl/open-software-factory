---
status: accepted
date: 2026-11-15
---

# 0142. The library `factory-source`: its surface, the token of a private factory and its cache

## Context

ADR 0135 gives `@opensoftware/factory-source` one job: give a factory's folder, from a path or from
`git+<url>#<ref>` with a token for a private repository, the foreman's fetch of ADR 0124. T-56 moves the foreman's
fetch there; the console, `factory render` and the fetch of pinned skills (T-58, T-59) use it later. ADR 0124 let a
private remote use only Git's own credentials (a credential helper or an SSH key of the container). T-56 asks that the
library take a token "from a documented variable" and hand it to Git without writing it to a file or a command line,
in the Basic form that GitHub accepts for Git over HTTPS (ADR 0096). Four things are left open:

- Which variable holds the token, when each program that uses the library has its own settings.
- How the token reaches Git without a file or a command line.
- What the library's surface is, so that later callers need no new value for the same job.
- Where the cache lives when more than one program, or more than one repository (T-59's pinned skills), fetches.

## Decision

- **The surface.** Two values: `factorySource(setting, { cache, token })` gives a source whose `fetch()` gives
  `{ folder, file, commit }`, and `FetchError`, the error of a ref that cannot be fetched. A path gives its file and
  the folder that holds it, with no commit and no Git process: whether a local folder must be clean is the caller's
  rule (the foreman's ADR 0110). A remote is fetched at each call, one fetch at a time per source, and gives the
  commit of the ref (default the remote's `HEAD`) with `factory.yaml` at its root.
- **The variable is the caller's.** The library reads no environment variable. Each program passes the token from its
  own documented setting, named with its own prefix, as its other settings are: the foreman's is
  `FOREMAN_FACTORY_TOKEN`. A program that fetches the same factory with another variable (the console) documents its
  own.
- **The token reaches Git in its environment.** The library runs `git fetch` with `GIT_CONFIG_COUNT`,
  `GIT_CONFIG_KEY_0` and `GIT_CONFIG_VALUE_0` set to `http.<url>.extraHeader` and
  `Authorization: Basic <base64 of x-access-token:<token>>`. Git sends the header only to that URL; nothing is
  written to the bare repository's config or to a credential store, and the command line holds no token. Git never
  asks for a password (`GIT_TERMINAL_PROMPT=0`): a refused fetch fails at once. A message of `FetchError` never
  holds the token, and it names a URL without the user and the password that the URL may carry.
- **The cache is the caller's folder.** A source keeps its bare repository at `<cache>/repository.git` and one folder
  per commit at `<cache>/<commit>/`, the layout of ADR 0124; the foreman passes `$OSF_DATA/factory`. A program that
  fetches several repositories passes one cache folder per repository. A folder that a stopped fetch left half
  written (`<commit>.partial`) is emptied and written again.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The token in the caller's own setting (chosen) | Each program documents and checks its settings in one place, with its prefix | Two programs that fetch one factory name the token twice |
| One variable of the library, like `OSF_FACTORY_TOKEN` | One name in every program | A library that reads the environment; a test sets it for the whole process |
| `GIT_CONFIG_*` in Git's environment (chosen) | No file, no command line; scoped to the URL | Git 2.31 or newer |
| `-c http.extraHeader=…` on the command line (as `observer` does) | Simple | Every process of the host sees the token in its command line |
| `GIT_ASKPASS` with a script | Git's own prompt | A script file to write and to keep without the token |
| A credential helper or a token in the URL | Git's usual way | Writes the token to a file or into the remote's URL in `FETCH_HEAD` |

## Prior art

- **isomorphic-git** (MIT, active): a Git in JavaScript; checked, not adopted: the foreman already runs the Git CLI,
  and its fetch of a bare repository is slower and supports fewer protocols.
- **simple-git** (MIT, active): a wrapper of the Git CLI; checked, not adopted: three Git commands need no wrapper.
- **git-sync** (Apache-2.0, Kubernetes): checked in ADR 0124; a sidecar, not a library.
- **actions/checkout** (MIT): passes its token as `http.<url>.extraheader` with Basic `x-access-token:<token>`, the
  form adopted here; it writes the header to the repository's config, which this library does not.

## Consequences

- A private factory on GitHub, or on a forge that takes a token as the password of Basic credentials, works with a
  token in `FOREMAN_FACTORY_TOKEN`; Git's own credentials still
  work without it (ADR 0124).
- The console (T-58) and the fetch of pinned skills (T-59) call the same `factorySource` with their own cache folder
  and token.
- Revisit when a forge needs a user name other than `x-access-token` for its tokens, or a factory below the root of
  its repository.
