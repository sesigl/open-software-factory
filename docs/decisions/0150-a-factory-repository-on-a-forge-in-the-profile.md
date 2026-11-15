---
status: accepted
date: 2026-11-15
---

# 0150. A factory repository on a forge in the Compose profile and the chart, the check `factory`, and `console doctor`

## Context

T-58 makes a change of the factory from the console a pull request (ADR 0144). The console, foreman 0.14.0,
factory-spec 0.12.1 (`factory edit`, `factory plan --check`), `@opensoftware/factory-source` 0.1.0 (ADR 0142) and the
forge adapters 0.8.1 are released. Its last slices leave open:

- How the Compose profile and the chart get the factory from a repository on a forge, so gatekeeper's policy and
  groups, the console's pages and groups and the `factory` tools read it, while the foreman and the console fetch it at
  each run and change (`git+<url>#<branch>`, ADR 0124).
- What posts the check `factory` that the console requires on the main branch before it asks for a merge, on GitHub
  and on Forgejo. On Forgejo, ADR 0144 left the choice between a runner of Forgejo Actions and a job of the profile.
- How an operator learns that the repository's settings are wrong before the first change fails.

What was checked:

- GitHub names the check run of a job of GitHub Actions after the job: a job `factory` is the check `factory`
  (`deploy/README.md#your-factory`).
- Forgejo Actions reads `.forgejo/workflows/` and, only when that folder is missing, `.github/workflows/`. It posts one
  commit status per job, named `<workflow> / <job> (<event>)`, like `factory / factory (pull_request)`, not the job's
  name. A branch rule that requires `factory` and the console, which reads the check `factory` by name (ADR 0144),
  would never see it.
- `factory lint` and `factory plan --check` of factory-spec 0.12.1 pass on the reference factory, which pins nothing
  in a `factory.lock`, and need no setting.
- The console of 0.10.1 needs factory-spec's `factory` for `/skills` and for a change; its image had none, so both ran
  `npx` at run time.

## Decision

### The check `factory`

- **Two workflow files in the reference factory's folder**, which an operator copies into the factory's repository
  with the folder: `.github/workflows/factory.yaml` for GitHub and `.forgejo/workflows/factory.yaml` for Forgejo. Each
  runs on pull requests and on pushes to `main`, and runs `npx --yes @opensoftware/factory-spec@<version> lint` and
  `plan --check`.
- **GitHub:** the job `factory` is the check.
- **Forgejo:** a runner of Forgejo Actions runs the workflow, and the job posts the commit status `factory` itself with
  the port's `check` of `@opensoftware/forge-forgejo` and the job's own token: `pending` first, then `success` or
  `failure`, with a link to the run. A pending check counts as present (T-58), and Forgejo's own status of the job is
  ignored. The profile runs no runner: the operator registers one, with the label `ubuntu-latest` and an image with
  Node 24, like `ubuntu-latest:docker://node:24-bookworm`.
- **The pins move with each release.** `osf profile-pins` writes, and PROFILE compares, every
  `@opensoftware/<name>@<version>` of the two workflows at the workspace's version, as for the profile's images.

### The profile

- **A local folder stays the default.** Without `FACTORY_REPOSITORY` nothing changes: `factory-repo` commits
  `FACTORY_DIR` into the volume `factory`, and the console's `/changes` says that a local folder cannot be changed.
- **`FACTORY_REPOSITORY`**, opt-in, is `git+<url>#<branch>`. `factory-repo` then clones the newest commit of the
  branch into the volume `factory` at each start, in place of the folder. Its script is the file
  `compose/factory-repo/factory-repo.sh`, which the chart runs too, through a link in `helm/osf/files/`. A clone that
  fails leaves the volume as it was, names the URL without credentials and Git's message, and stops the services that
  wait for it.
- **One token, `FACTORY_TOKEN`,** for the clone, the foreman's fetch (`FOREMAN_FACTORY_TOKEN`) and the console's
  fetches and changes (`CONSOLE_FACTORY_TOKEN`). `factory-repo` hands it to Git as ADR 0142 does: Basic credentials of
  `x-access-token` in `GIT_CONFIG_*` of Git's environment, for that URL only, never in a file, on a command line or in
  the clone's config. No other service gets it, and nothing secret gets a default.
- **The foreman** gets `FOREMAN_FACTORY=$FACTORY_REPOSITORY`, so each run fetches the newest commit and that commit is
  its factory version. **The console** gets `CONSOLE_FACTORY_REPOSITORY`, `CONSOLE_FACTORY_TOKEN`,
  `CONSOLE_FACTORY_USER` (`FACTORY_USER`), `CONSOLE_FORGE_ADAPTER` (`FACTORY_FORGE_ADAPTER`, default `forge-github`)
  and `CONSOLE_FORGE_URL` (`FACTORY_FORGE_URL`). Its pages, its groups and its access file stay the files of the
  volume, `CONSOLE_FACTORY` and `CONSOLE_ACCESS`, as console 0.10.1 reads them: they change at the next
  `docker compose up`, like gatekeeper's policy and groups.
- **The console's image installs factory-spec**, and `CONSOLE_FACTORY_COMMAND=factory`, so no page and no change runs
  `npx`. The image's packages change and no module's version does, so its tag is `console:0.10.1-r1`.
- **`osf up`** refuses a `FACTORY_REPOSITORY` that is not `git+<url>`, and one without `FACTORY_TOKEN` or `FACTORY_USER`,
  since the console does not start without the user and opens no change without the token.

### The chart

- The values `factory.repository`, `factory.user`, `secrets.factoryToken` (key `factory-token`) and
  `console.forgeUrl` make the same choice. The foreman fetches the repository itself and loses its init container
  that commits the chart's files; gatekeeper, the console and the test of `helm test` clone it with
  `factory-repo.sh` in an init container `factory-repo` into the volume of the files; the ConfigMap of the reference
  factory is not rendered.

### `console doctor`

With `CONSOLE_FACTORY_REPOSITORY`, `console doctor` and `/health` add two checks after `factory`: `factory repository`,
the fetch of the newest commit with the token; and `factory check`, the forge adapter's `rules` of the branch, which
must require the check `factory` and no approval. Each failure names what to do. The rules that cannot be read name
the token and the adapter's variables. A required approval fails too: the token's user cannot approve its own pull
request, so the forge would never merge a change.

## Options considered

| Option for Forgejo's check | For | Against |
| --- | --- | --- |
| A Forgejo workflow whose job posts the status `factory` with the port's `check` (chosen) | Forgejo's own runner; the same commands as on GitHub; the status has the name the rule and the console read | The operator runs a runner; two lines of `check` per run |
| The GitHub workflow alone, read by Forgejo from `.github/workflows/` | One file | Forgejo's status is `factory / factory (pull_request)`, which no rule named `factory` matches |
| A job of the profile that watches the pull requests and posts the status | No runner | A loop of our own, with state and a token that writes statuses, in a profile that runs no loop (ADR 0144) |
| A runner of Forgejo Actions in the profile | The profile is complete | A runner needs Docker for its jobs, beside the agents' sandboxes, and registers with a token of the forge |

| Option for the profile | For | Against |
| --- | --- | --- |
| `factory-repo` clones into the volume, the foreman and the console fetch (chosen) | gatekeeper and the tools read files as today; a run takes the newest commit | gatekeeper's policy and the console's pages change only at a restart |
| Every service fetches the repository itself | No volume | gatekeeper reads its policy from a path; the console's pages read `CONSOLE_FACTORY` as a path |
| A sidecar that pulls (git-sync) | Updates without a restart | One more image and a moving checkout (ADR 0124) |

| Option for the token | For | Against |
| --- | --- | --- |
| One `FACTORY_TOKEN` (chosen) | One value to make and to rotate | The foreman's fetch holds a token that writes |
| A read-only token for the clone and the foreman | Least privilege | Two tokens for one repository; a GitHub fine-grained token for both is the same work |

## Prior art

- **Forgejo Actions** (GPL-3.0, Codeberg e.V., active) and **forgejo-runner**: adopted as the way to run the workflow
  on Forgejo; its naming of a job's status and its fallback to `.github/workflows/` were read in Forgejo's
  documentation, not run here.
- **GitHub Actions**: adopted; `actions/checkout` and `actions/setup-node` (MIT) at the tags this repository's own
  workflows use.
- **git-sync** (Apache-2.0, Kubernetes): checked in ADR 0124; not adopted, for the same reason.
- **actions/checkout's token handling** (MIT): the `extraheader` form that ADR 0142 adopted; the script sets it in
  Git's environment, not in the clone's config.

## Consequences

- An operator moves a factory to a repository on a forge with five values in `.env` and the two workflow files, and
  `console doctor` names what the repository still lacks (`deploy/README.md#a-factory-on-a-forge`).
- The end-to-end scenario of T-58 can use the profile through `.env` and `e2e/compose/override.yaml`, which already
  maps `host.docker.internal` for every service of the workspace's image.
- `console doctor`'s two checks need the console's next release; the profile's scenarios use only released packages,
  in the image `console:0.10.1-r1`.
- The workflow on Forgejo is not run by a scenario here: no scenario starts a runner. A Forgejo whose Actions token
  may not post commit statuses would leave every change "Checking".
- Revisit when the console reads its pages and its access file from the repository at each request, when the forge
  port names a job's check the same on both forges, or when gatekeeper reads its policy from a commit.
