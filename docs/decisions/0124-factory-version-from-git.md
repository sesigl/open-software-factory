---
status: accepted
date: 2026-11-14
---

# 0124. The foreman reads the factory from a Git remote at a commit

## Context

T-32 asks that the foreman read `factory.yaml` from a Git remote at a commit. Today `FOREMAN_FACTORY` is a path, the
folder that holds it must be a clean Git checkout, and a run's factory version is its HEAD (ADR 0110). In a container
or a pod, the factory then has to be baked into the image or mounted as a checkout, and an update means a new image
or a manual `git pull` in a volume.

## Decision

`FOREMAN_FACTORY` also takes `git+<url>#<ref>`, like `git+https://forge.example/acme/factory.git#main`. Without
`#<ref>` the foreman takes the remote's default branch (`HEAD`). `factory.yaml` is at the root of the repository.

At the start of the server, of each run and of each retry, the foreman fetches the ref into a bare repository at
`$OSF_DATA/factory/repository.git`, resolves it to a commit and writes that commit's files to
`$OSF_DATA/factory/<commit>/`, once per commit, with `git checkout <commit> -- .` into an empty folder. It reads the
factory there, and the commit is the run's factory version. A run keeps its commit until it ends, as with a local
file. The clean-folder check of ADR 0110 does not apply: a fetched commit has no changes. One fetch runs at a time.

A ref that cannot be fetched is a usage error: the server does not start, and a run does not start, with
`FOREMAN_FACTORY: cannot fetch <ref> of <url>: <Git's message>`. A private remote uses Git's own credentials, like a
credential helper or an SSH key of the container; the setting holds no credential.

## Options considered

- **A separate `FOREMAN_FACTORY_REF`.** Two settings for one thing; `git+<url>#<ref>` is the form npm and pip use.
- **`git show <commit>:<path>` for each file.** The foreman reads prompts, skill folders and the gateway's config by
  path, and the gateway reads its config file itself. A folder per commit keeps one way to read a factory.
- **A sidecar that pulls a checkout (git-sync).** One more container and still a moving checkout; the version would be
  whatever was pulled last, not the commit of each run.

## Consequences

- A factory update is a push to the remote; the next run takes it.
- `$OSF_DATA/factory` grows by one folder per commit that a run used. Old folders can be deleted while no run uses them.
- Tests fetch from a local repository at a `file://` URL: no network.
