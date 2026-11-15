---
covers: [packages/factory-source/src/**]
---

# factory-source

Give the folder of a factory, from a path or from a Git remote at a ref, and a folder of another Git repository at the
commit of its pin, like a skill of `factory.yaml`. The foreman reads its factory and its pinned skills with this
library, and `factory plan`, `factory render` and `factory skills` fetch the pinned skills with it; the console
follows (T-58, T-59). A library: it has no
command of its own, and its only state is the cache folder its caller names. Decisions:
[ADR 0124](../../docs/decisions/0124-factory-version-from-git.md),
[ADR 0135](../../docs/decisions/0135-one-job-and-a-listed-surface.md),
[ADR 0142](../../docs/decisions/0142-factory-source-library-and-its-token.md),
[ADR 0146](../../docs/decisions/0146-skills-of-other-repositories-pinned-in-factory-lock.md).

## Quick start

```ts
import { readFileSync } from "node:fs";
import { FetchError, factorySource } from "@opensoftware/factory-source";

const source = factorySource("git+https://forge.example/acme/factory.git#main", {
  cache: "/var/lib/osf/factory",
  token: process.env.MY_FACTORY_TOKEN, // for a private repository; your program documents the variable
});
try {
  const { folder, file, commit } = await source.fetch();
  console.log(commit, folder, readFileSync(file, "utf8"));
} catch (failure) {
  if (failure instanceof FetchError) console.error(failure.message); // cannot fetch main of https://…: <Git's message>
  else throw failure;
}
```

## API

| Export | What it does |
| --- | --- |
| `factorySource(setting, { cache, token })` | A source with one method, `fetch()`. `setting` is a path to the factory's file, or, when it starts with `git+`, `git+<url>#<ref>` (without `#<ref>`: the remote's `HEAD`) with `factory.yaml` at the root of the commit. `fetch()` gives `{ folder, file, commit }`: for a path, its folder and the path itself, no commit and no Git process; for a remote, the ref's commit, fetched again at each call, and its files in `<cache>/<commit>/`. The fetches of one source run one at a time. Paths stay as given: pass absolute ones for absolute folders. |
| `pinnedFolder(reference, { cache, token, pin })` | The folder that `reference` names, `git+<url>#<ref>:<path>`: a folder of the repository at a ref (a branch, a tag or a commit). Without `pin`, it fetches the ref and gives `{ folder, commit, hash }`. With `pin` (`{ commit, hash }`, as `factory.lock` holds it), it fetches the pin's commit, never the ref, and only when the cache does not hold that commit yet; files whose hash is not the pin's are a `FetchError`. `cache` holds one folder per repository. |
| `FetchError` | What `fetch()` and `pinnedFolder` throw for a remote whose ref cannot be fetched: `cannot fetch <ref> of <url>: <Git's message>`, the URL without a user and a password it carries. |

## The cache

The bare repository is `<cache>/repository.git`, and each commit's files are `<cache>/<commit>/`, written once with
`git checkout <commit> -- .` (ADR 0124). The folder of an old commit stays until the caller deletes it. A folder that
a stopped fetch left half written, `<commit>.partial`, is emptied and written again. One cache folder per remote.

`pinnedFolder` takes one cache folder for every repository it fetches: each repository has the layout above in
`<cache>/<first 16 hex digits of the SHA-256 of its URL>/`, and the folder is below its commit's files. Its fetches of
one repository run one at a time in a process. A reference whose path leaves the repository (`..`, or a leading `/`)
is a `FetchError`.

## The hash of a folder

`hash` is the form of Go's modules (`h1:` of `go.sum`, ADR 0146): the SHA-256 of one line
`<SHA-256 of the file, in hex>  <path>\n` per file below the folder, sorted by the path with `/` between its parts,
written as `h1:` and its base64. Only files count; a symbolic link does not.

## A private repository

With `token`, `git fetch` gets the header `Authorization: Basic <base64 of x-access-token:<token>>` for the remote's
URL only, the form GitHub takes for Git over HTTPS (ADR 0096). The header reaches Git in its environment
(`GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_0`, `GIT_CONFIG_VALUE_0`), never in a file or on its command line, so no file of
the cache holds the token (ADR 0142). Git never asks for a password: a refused fetch is a `FetchError` at once.
Without `token`, Git's own credentials apply, like a credential helper or an SSH key. Needs Git 2.31 or newer.

## Releases

release-please opens a release pull request from the Conventional Commits under `packages/factory-source/`. Merging it
creates the tag `factory-source-v<version>`. The workflow `.github/workflows/publish-factory-source.yml` then builds
`dist/` with `pnpm build` and publishes the package to npm. The first release is `0.1.0`; until `1.0.0`, a breaking
change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../contracts/README.md#releases)).

## Configuration

This library reads no environment variables: its caller passes the cache folder and the token from its own settings.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-FSOURCE-001 | implemented | A factory in a Git remote gives the files of the commit of its ref |
| SCN-FSOURCE-002 | implemented | A remote without a ref gives the commit of its HEAD |
| SCN-FSOURCE-003 | implemented | A ref that the remote does not have is a FetchError with Git's message |
| SCN-FSOURCE-004 | implemented | A path, also one with "git+" inside it, gives its file and its folder, with no commit and nothing in the cache |
| SCN-FSOURCE-005 | implemented | A new commit on the ref gives a new folder, and the folder of the old commit stays as it was |
| SCN-FSOURCE-006 | implemented | A folder that a stopped fetch left half written is written again from nothing |
| SCN-FSOURCE-007 | implemented | Two fetches at once of one source both give the folder of the commit |
| SCN-FSOURCE-008 | implemented | A remote over HTTP gets the token as Git's Basic credentials, and no file of the cache holds it |
| SCN-FSOURCE-009 | implemented | A private remote without the token is a FetchError at once, with no prompt for a password |
| SCN-FSOURCE-010 | implemented | A remote without a ref and without a commit is a FetchError that names HEAD |
| SCN-FSOURCE-011 | implemented | A URL that carries a user and a password is named without them in a FetchError |
| SCN-FSOURCE-012 | implemented | A folder of a Git remote at a ref gives its commit, its folder in the cache and the hash of its files |
| SCN-FSOURCE-013 | implemented | A folder with a pin gives the pinned commit after its ref moved, and from the cache once the remote is gone |
| SCN-FSOURCE-014 | implemented | A pin whose hash is not the hash of the fetched files is a FetchError that names both hashes |
| SCN-FSOURCE-015 | implemented | A reference without "git+" or a folder, a folder outside the repository and a folder that the commit lacks are each a FetchError |
