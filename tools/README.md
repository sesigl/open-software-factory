---
covers: [tools/bin/**, tools/scaffold/**, tools/checks/**, Makefile]
---

# tools

The repository tooling: the deterministic checks from [`docs/quality/checks.md`](../docs/quality/checks.md) and
the helpers behind `make`. SPEC, TRACE, STEPS and PASS are not here: `make` runs them with the module `spec-trace`
and the root `spec-trace.json` ([ADR 0031](../docs/decisions/0031-spec-trace-action-and-dogfood.md)).

## Quick start

```sh
make install     # pnpm dependencies and the pinned lychee, oasdiff, opa, temporal, nats-server, helm, kubectl and kind binaries
make check-fast  # lint, typecheck and the static checks, in seconds: no system test, no container
make check       # the same, and the system tests of the changed units
make verify      # everything: lint, types, all system tests, all checks
```

## Commands

`make` calls `osf`; run it directly with `node tools/bin/osf.ts <command>` from the repository root.

| Command | Make target | What it does |
| --- | --- | --- |
| `osf check [ID ...]` | `make check` | Run the named checks. No ID runs the fast set: NOSKIP, ASSERT, BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, ARCH, DUP, DOCS-GEN, DOCS-LINKS, ADR, AFFECTED, RELEASE, DEPS, PROFILE, VISION, TODO. `make check` also runs `spec-trace check --only SPEC,TRACE,STEPS`. |
| `osf check --all` | `make verify` | Also FLAKE, BUDGET (they read `reports/junit/`), DOCS-AFFECTED and CONTRACT (they compare with `OSF_BASE`; CONTRACT with the last `contracts-v*` tag when there is one), REACH (it reads `reports/coverage/` and compares with `OSF_BASE`) and RUNS (the run records in `runs/`; it compares the commits with `OSF_BASE`). |
| `osf check MUTATION [--total]` | `make mutation` | Score the Stryker reports in `reports/mutation/`: the mutants in the lines changed since `OSF_BASE` against each module's first limit, or with `--total` every mutant against the second limit (ADR 0037). Neither `make check` nor `make verify` runs it. |
| `osf mutation-plan [--all] [--keys]` | `nightly.yml`, `mutation.yml` | Print the shards of a mutation run as JSON, one object per runner with `package`, `folder` and `shard`. With `--keys`, from one `turbo run mutation --dry=json`, also the `key` of the shard's report (turbo's hash of the unit's `mutation` task and its added line ranges), the `guard` of the unit's mutant results (turbo's global inputs, its external dependencies, the builds it depends on and its input files except its TypeScript sources and, for a module or an adapter, its `*.test.ts` files) and `results`, the file name of those results (ADR 0091). Without `--all`, each unit that the change since `OSF_BASE` adds source lines to, one shard per about 100 added lines (at most 10, or `osf.mutationLinesPerShard`). With `--all`, every unit with a mutation script, one shard per about 600 lines (at most 20, or `osf.mutationAllLinesPerShard`) (ADR 0084). |
| `osf mutation <folder> [--all] [--list] [--shard i/n] [--incremental <file>]` | `make mutation` | Run Stryker on one module: the lines of `src/` changed since `OSF_BASE`, or every line with `--all`. `--list` prints the `file:start-end` ranges and runs nothing. `--incremental <file>` reuses the result of each mutant in that earlier report whose code and tests did not change (Stryker's incremental mode); with `--shard`, the file keeps only the shard's own mutants afterwards (ADR 0091). `--shard i/n` mutates the same lines but tests only every n-th mutant (those whose Stryker number modulo n is i - 1) and writes them to `reports/mutation/<unit>.shard-<i>.json`, so that n runners share a large change and a costly file spreads over all of them (ADR 0066). For a module or an adapter, each mutant reruns only the scenarios whose module processes ran it (`tools/scaffold/mutation-runner.ts`, ADR 0061), and each rerun ends by killing what its Vitest left running, such as a module's servers after the run stopped at its first failure, or when it reaches Stryker's timeout; each rerun takes its scenario files shortest first in one Vitest worker, with one Stryker worker per CPU (`osf.mutationConcurrency` and `osf.mutationWorkers` change both, ADR 0084); a library reruns all its tests. Each module's `mutation` script calls it; `make mutation ALL=1` mutates every line. |
| `osf mutation-merge <plan> <folder>` | `mutation.yml` | For each unit of a plan of `osf mutation-plan --keys` whose shards all have a report in `reports/mutation/`, join their mutants into `<folder>/<unit>.<guard>.json` and remove the unit's files of other guards; a unit with a missing shard keeps its earlier file (ADR 0091). |
| `osf collect-reports` | `make verify-tests` | Copy each package's `reports/junit.xml` to `reports/junit/<name>.xml` and its `reports/coverage/` files to `reports/coverage/<name>-<file>`, where the checks read them. Each suite writes into its own `reports/`, which turbo stores and replays on pull requests (ADR 0081). |
| `osf release-files` | after adding, renaming or unpublishing a package | Write `.github/workflows/publish-<name>.yml` of every published package from `tools/scaffold/publish-workflow.yml`, add or correct its `release-please-config.json` entry and its version in `.release-please-manifest.json`, and remove those of packages that are no longer published. RELEASE fails until they are current. |
| `osf docs-affected` | `make docs-affected` | List hand-written docs whose `covers:` paths changed since `OSF_BASE`. |
| `osf docs` | `make docs` | Regenerate every README section below a `generated by make docs` marker: the scenario table from `features/`, the Configuration table from `config.schema.json`, the Commands table from the `Commands:` block of `node <cli> --help` (marker `from src/cli.ts --help`), and the status table of the vision scenarios with the scenarios that realize them in `docs/vision/README.md` (marker `from software-factory.feature`, ADR 0117). |
| `osf new-module <name>` | `make new-module NAME=x` | Copy the working module `modules/_template` without `node_modules/` and `dist/`, rename it and register the scenario prefix (ADR 0015). |
| `osf bundle <package>` | the package's `build` script, through `tools/bin/bundle.ts`, which loads only the bundler, so that a publish job that builds one package needs no other built package | Build a CLI package as one bundled file (ADR 0079): `src/cli.ts` becomes `dist/main.js` with a source map to the sources, `dist/cli.js` turns on Node's compile cache and imports it, and `dist/THIRD-PARTY-NOTICES.md` lists the name, version, license and license text of every package in the bundle. It fails on an import that the bundle cannot hold and on a bundled package without a license. |
| `osf next-id <module>` | `make next-id MODULE=x` | Print the next free scenario ID of a module or prefix. |
| `osf test-scenario <ID>` | `make test-scenario ID=…` | Run the one system test of a scenario. |
| `osf install-tools` | `make install` | Download the checksum-pinned lychee, oasdiff, opa, temporal, nats-server, helm, kubectl and kind, and the agent-sandbox manifest `agent-sandbox.yaml`, into `.tools/bin/`. When github.com fails to send a release file, it comes through the GitHub API, with `GITHUB_TOKEN` when it is set; CI sets it. |

`make run-record` builds `modules/runlog` and runs `runlog export --latest --per-run` with `OUTPUT=runs` on the
Claude Code project folder of this checkout, below `CLAUDE_CONFIG_DIR` when it is set and `~/.claude` when not, and
`~/.codex/sessions` (ADR 0027). `RUN_SESSIONS=<folder>` overrides
the folders.

`make agents-sync` builds `modules/factory-spec` and runs `factory render --harness all` on the repository's
`factory.yaml` (ADR 0020): `CLAUDE.md`, `.mcp.json`, `.codex/config.toml`, `opencode.json` and the skill links in
`.claude/skills/`, `.agents/skills/` and `.opencode/skills/`.

`make` holds no build logic (ADR 0010). `make check` runs the affected `lint`, `typecheck` and `test:system`
Turborepo tasks (`--filter=...[OSF_BASE]`), builds spec-trace, and then runs the fast checks. `make verify` runs those tasks for every
package without the cache, then every check. The checks themselves always run outside the Turborepo cache.
A package's build hash leaves out its Markdown files (`!**/*.md` in `turbo.json`): a change to a library's README or
CHANGELOG does not run the system tests of the packages that depend on it again. The package's own `test:system`
still takes its README as an input, because its tests read the quick start.
`make verify` is three targets that CI runs as parallel jobs: `make verify-static` (lint, typecheck, build),
`make verify-tests` (the system test suites, one at a time; `FILTER="pkg !pkg"` limits them to some packages) and
`make verify-checks` (`spec-trace check` and every `osf` check, on the results in `reports/`).

Each failure prints one line: the check ID, `file:line`, and what to fix. Each check ends with `ID ok` or
`ID failed: N`. The exit code is 1 when any check failed.

## Local machine

`make install` pins its binaries for Linux x86_64 (CI) and macOS arm64. The system tests need Docker, and three
things of it:

- **The daemon.** The module's processes and the fakes use the machine's `DOCKER_HOST`,
  `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` and `TESTCONTAINERS_HOST_OVERRIDE` (SCN-TK-130). Rancher Desktop, for one,
  has no `/var/run/docker.sock` on the host: set `DOCKER_HOST=unix://$HOME/.rd/docker.sock` and
  `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`.
- **The host from a container.** A container reaches the fakes as `host.docker.internal`, which modules and the
  testkit map to `host-gateway`, as Linux needs. On Rancher Desktop, `host-gateway` is the VM, not the Mac, so set
  the daemon's `host-gateway-ip` to the Mac's address in the VM, `192.168.5.2`.
- **Networks.** Parallel scenarios each create a network; Docker's default pools hold about 30. Give the daemon
  larger pools.

On Rancher Desktop, both daemon settings go into
`~/Library/Application Support/rancher-desktop/lima/_config/override.yaml`; restart Rancher Desktop after the change:

```yaml
provision:
  - mode: system
    script: |
      #!/bin/sh
      cat > /etc/docker/daemon.json <<'EOF'
      {
        "min-api-version": "1.41",
        "seccomp-profile": "/etc/rancher-desktop/seccomp.json",
        "features": { "containerd-snapshotter": true },
        "host-gateway-ip": "192.168.5.2",
        "default-address-pools": [{ "base": "10.210.0.0/16", "size": 24 }]
      }
      EOF
```

To check it, serve a port on the host and read it from a container: `docker run --rm --add-host
host.docker.internal:host-gateway alpine:3 wget -qO- http://host.docker.internal:<port>`.

`sut.helm` installs charts only on a local kind cluster: the current context of `KUBECONFIG` must be `kind-*` with a
server on the loopback address (SCN-TK-132), so a scenario never creates namespaces on a shared cluster. Start one
with `kind create cluster --kubeconfig "$HOME/.kube/kind"` and run the tests with `KUBECONFIG=$HOME/.kube/kind`.

## Configuration

| Variable | Meaning |
| --- | --- |
| `OSF_BASE` | Git ref to compare with for DOCS-AFFECTED, REACH, CONTRACT (only without a `contracts-v*` tag in HEAD's history) and the dependency rule of ADR. `make` uses the merge base with `origin/main`. Without it, these comparisons print `skipped` and `osf check --all` (so `make verify`) fails. |
| `OSF_PR_BODY` | File with the pull request description. DOCS-AFFECTED accepts `docs-reviewed: <path>` lines in it. CI passes the description of the pull request, and for a push to `main` the description of the merged pull request. |
| `OSF_JUNIT_DIR` | Folder with JUnit XML results for FLAKE and BUDGET. Default `reports/junit`. spec-trace reads the `junit` folder of `spec-trace.json`. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-REPO-001 | deprecated | A module created from the template passes the fast checks |
| SCN-REPO-002 | deprecated | SPEC rejects a duplicate scenario ID |
| SCN-REPO-003 | deprecated | TRACE rejects an implemented scenario without a system test |
| SCN-REPO-004 | deprecated | STEPS rejects a label that differs from the step |
| SCN-REPO-005 | deprecated | PASS rejects a skipped test |
| SCN-REPO-006 | implemented | BOUNDARY-STATIC rejects an import from src/ |
| SCN-REPO-007 | deprecated | SPECGUARD rejects a changed implemented step without approval |
| SCN-REPO-008 | implemented | DOCS-AFFECTED lists a doc whose covers path changed |
| SCN-REPO-009 | implemented | ISOLATION rejects a module that imports another module |
| SCN-REPO-010 | implemented | BOUNDARY-ENV rejects an environment variable that the README does not document |
| SCN-REPO-011 | implemented | NOSKIP rejects a skipped test |
| SCN-REPO-012 | implemented | ASSERT rejects a then step that asserts only on a value the test created |
| SCN-REPO-013 | implemented | FLAKE rejects a test that passed only on retry |
| SCN-REPO-014 | implemented | BUDGET rejects system tests that take longer than the module budget |
| SCN-REPO-015 | implemented | CONTRACT rejects a removed schema property without a major version |
| SCN-REPO-016 | implemented | DOCS-GEN rejects a generated README section that is out of date |
| SCN-REPO-017 | implemented | DOCS-LINKS rejects a link to a missing file |
| SCN-REPO-018 | implemented | ADR rejects a new dependency without an accepted ADR |
| SCN-REPO-019 | implemented | BOUNDARY-STATIC names the line of a Node built-in import in a system test |
| SCN-REPO-020 | deprecated | Running every check without a base fails and names the skipped comparisons |
| SCN-REPO-023 | implemented | CONTRACT compares with the last contracts release and checks the values of maps |
| SCN-REPO-024 | implemented | CONTRACT checks the formats of fixture values |
| SCN-REPO-025 | implemented | Running every check without a base fails and names the skipped comparisons |
| SCN-REPO-026 | implemented | ARCH rejects an import from a layer above |
| SCN-REPO-027 | implemented | ARCH rejects a source file outside every declared layer |
| SCN-REPO-028 | implemented | ARCH rejects a module without architecture.json |
| SCN-REPO-029 | implemented | ISOLATION finds an import in a file that another file of the module imports |
| SCN-REPO-030 | deprecated | TRACE rejects an adapter without a system test for a conformance scenario of its port |
| SCN-REPO-031 | implemented | REACH rejects added lines that no system test reaches |
| SCN-REPO-032 | implemented | REACH rejects a new source file that no system test loads and skips a file of types only |
| SCN-REPO-033 | implemented | REACH accepts a change whose lines a system test reaches |
| SCN-REPO-034 | implemented | REACH asks for a test run when a changed module has no coverage |
| SCN-REPO-035 | implemented | make docs generates the Commands section from the CLI help |
| SCN-REPO-036 | implemented | DOCS-AFFECTED ignores the files of a release |
| SCN-REPO-037 | implemented | DOCS-AFFECTED lists a doc when package.json changes more than its version |
| SCN-REPO-038 | implemented | RUNS rejects a run record with prompt content |
| SCN-REPO-039 | implemented | RUNS rejects a run record that does not match the run-record contract |
| SCN-REPO-040 | implemented | RUNS rejects agent commits without a run record |
| SCN-REPO-041 | implemented | RUNS accepts agent commits that add a run record |
| SCN-REPO-042 | implemented | RUNS asks no run record of commits without an agent trailer |
| SCN-REPO-043 | implemented | A module created from the template passes the fast checks of osf |
| SCN-REPO-044 | implemented | DUP rejects a module whose duplicated lines exceed its limit |
| SCN-REPO-045 | implemented | DUP rejects a clone between two modules |
| SCN-REPO-046 | deprecated | DUP rejects a baseline entry whose clone is gone |
| SCN-REPO-047 | implemented | DUP rejects a module without a duplication limit |
| SCN-REPO-048 | implemented | MUTATION rejects a change whose mutants in changed lines score below the limit |
| SCN-REPO-049 | implemented | MUTATION accepts a change whose mutants in changed lines are all killed |
| SCN-REPO-050 | implemented | MUTATION with --total rejects a module whose total score is below the limit |
| SCN-REPO-051 | implemented | MUTATION asks for a mutation run when a changed module has no report |
| SCN-REPO-052 | implemented | MUTATION rejects a module without a mutation script |
| SCN-REPO-053 | implemented | osf mutation lists the line ranges a change adds |
| SCN-REPO-054 | implemented | ISOLATION accepts a module that depends on a library in packages |
| SCN-REPO-055 | implemented | DOCS-AFFECTED ignores the version that a release writes into an extra file |
| SCN-REPO-056 | implemented | BOUNDARY-STATIC accepts a library's system test that imports the library |
| SCN-REPO-057 | implemented | BOUNDARY-STATIC rejects a library's system test that imports the library's src/ |
| SCN-REPO-058 | implemented | MUTATION rejects a library in packages without a mutation script |
| SCN-REPO-059 | implemented | ASSERT accepts a library's then step that asserts on what the library returned |
| SCN-REPO-060 | implemented | REACH leaves the lines of a library to MUTATION |
| SCN-REPO-061 | implemented | ASSERT accepts a then step that asserts on what a subpath export of the package returned |
| SCN-REPO-062 | implemented | REACH leaves code that ran only in a transformed form to MUTATION |
| SCN-REPO-063 | deprecated | osf mutation with --shard lists its part of the line ranges a change adds |
| SCN-REPO-064 | implemented | MUTATION scores the reports of all shards of a module together |
| SCN-REPO-065 | implemented | osf mutation with --shard lists every line range a change adds |
| SCN-REPO-066 | implemented | osf bundle writes the bin, one bundle with a source map to the sources, and the notice of each bundled package |
| SCN-REPO-067 | implemented | osf bundle refuses a bundled package without a license |
| SCN-REPO-068 | implemented | AFFECTED accepts a repository that caches its system tests by the rules |
| SCN-REPO-069 | implemented | AFFECTED rejects a system test that starts an adapter its package does not declare |
| SCN-REPO-070 | implemented | AFFECTED rejects a system test that imports a workspace package its package does not declare |
| SCN-REPO-071 | implemented | AFFECTED rejects a system test that reads a file of another package its package does not declare |
| SCN-REPO-072 | deprecated | AFFECTED rejects a package with system tests that no tests job of CI runs |
| SCN-REPO-073 | deprecated | AFFECTED rejects a package with system tests that two tests jobs of CI run |
| SCN-REPO-074 | implemented | AFFECTED rejects a test suite that writes its JUnit results outside its own reports folder |
| SCN-REPO-075 | implemented | AFFECTED rejects a test cache whose inputs leave out files of the package |
| SCN-REPO-076 | implemented | AFFECTED rejects a test cache without a repository-wide file that the tests depend on |
| SCN-REPO-077 | implemented | AFFECTED rejects a workflow that uses the test cache outside pull requests |
| SCN-REPO-078 | implemented | AFFECTED rejects a Makefile that does not give each run of the system tests its own hash by default |
| SCN-REPO-079 | implemented | collect-reports copies the results of each package to the reports folder of the repository |
| SCN-REPO-080 | implemented | ISOLATION accepts a module that declares an adapter in its devDependencies for its system tests |
| SCN-REPO-081 | implemented | ISOLATION rejects a module that declares an adapter in its dependencies |
| SCN-REPO-082 | implemented | AFFECTED rejects a test cache that turbo shares between worktrees |
| SCN-REPO-083 | implemented | AFFECTED rejects a run of the system tests that leaves their dependencies out of the hash |
| SCN-REPO-084 | implemented | AFFECTED rejects a Makefile that does not run lint, typecheck and build without the cache by default |
| SCN-REPO-085 | implemented | RELEASE accepts the release files that osf release-files wrote |
| SCN-REPO-086 | implemented | osf release-files writes the publish workflow and the release entries of a published package |
| SCN-REPO-087 | implemented | RELEASE rejects a published package without its publish workflow |
| SCN-REPO-088 | implemented | RELEASE rejects a publish workflow that differs from the template |
| SCN-REPO-089 | implemented | RELEASE rejects a published package without its release-please entry |
| SCN-REPO-090 | implemented | RELEASE rejects a manifest version that differs from the package's version |
| SCN-REPO-091 | implemented | RELEASE rejects the release files of a package that is no longer published |
| SCN-REPO-092 | implemented | osf mutation-plan with --all cuts every unit with a mutation script into shards by its lines |
| SCN-REPO-093 | implemented | osf mutation-plan cuts each unit that a change adds lines to into shards by the added lines |
| SCN-REPO-094 | implemented | osf mutation-plan with --keys keeps a unit's key while nothing of the unit changes |
| SCN-REPO-095 | implemented | osf mutation-plan with --keys keeps a unit's guard when only its mutated file and its system tests change |
| SCN-REPO-096 | implemented | osf mutation-merge joins the shard reports of each unit whose shards all have a report |
| SCN-REPO-097 | implemented | AFFECTED rejects a package with system tests that no suite of CI runs |
| SCN-REPO-098 | implemented | AFFECTED rejects a package with system tests that two suites of CI run |
| SCN-REPO-099 | implemented | AFFECTED rejects a suite whose filter names no package with system tests |
| SCN-REPO-100 | implemented | AFFECTED rejects a tests job with a list of suites of its own |
| SCN-REPO-101 | implemented | AFFECTED rejects a job plan that does not read the suites |
| SCN-REPO-102 | implemented | AFFECTED rejects a tests job that keeps the turbo cache in a cache of its own |
| SCN-REPO-103 | implemented | DEPS accepts a package that has the exact peer version of its dependency |
| SCN-REPO-104 | implemented | DEPS rejects a package whose dependency needs another version of a peer |
| SCN-REPO-105 | implemented | DEPS rejects a package without the required peer of its dependency and accepts a missing optional one |
| SCN-REPO-106 | implemented | PROFILE accepts a profile and a chart that osf profile-pins wrote |
| SCN-REPO-107 | implemented | PROFILE rejects a profile that does not pin the workspace's version of a package |
| SCN-REPO-108 | implemented | PROFILE rejects a module image whose tag is not the version of its own package |
| SCN-REPO-109 | implemented | PROFILE rejects a chart whose image tag differs from the profile's |
| SCN-REPO-110 | implemented | PROFILE rejects a chart image that the profile does not run |
| SCN-REPO-111 | implemented | PROFILE rejects a suite that starts an image it does not pull and pulls one that its packages do not name |
| SCN-REPO-112 | implemented | PROFILE rejects new packages of an image without a new tag, compared with the base |
| SCN-REPO-113 | implemented | PROFILE rejects a changed chart without a new version, compared with the base |
| SCN-REPO-114 | implemented | osf profile-pins moves a module image to the new version of its module |
| SCN-REPO-115 | implemented | osf profile-pins gives an image the next release tag when only an adapter moved |
| SCN-REPO-116 | implemented | PROFILE rejects a pull that only the testkit names, as a suite names the testkit's fakes in "images" |
| SCN-REPO-117 | implemented | PROFILE rejects a changed stage of the image Dockerfile without a new tag, compared with the base |
| SCN-REPO-118 | implemented | PROFILE accepts a changed comment of the image Dockerfile without a new tag, compared with the base |
| SCN-REPO-119 | implemented | PROFILE rejects new packages of an image without a new tag also when a volume has the name of its service |
| SCN-REPO-120 | implemented | PROFILE rejects a template of the reference factory whose tag differs from the profile's image |
| SCN-REPO-121 | implemented | osf profile-pins moves the template of the reference factory to the tag of the profile's image |
| SCN-REPO-122 | implemented | PROFILE accepts a chart image that the profile builds |
| SCN-REPO-123 | implemented | BUDGET divides the time of a module's system tests by the slowdown of the runner that ran them |
| SCN-REPO-124 | implemented | BUDGET rejects a package whose system tests do not run with "testkit timed" |
| SCN-REPO-125 | implemented | DOCS-AFFECTED ignores the pins that osf profile-pins writes for a release |
| SCN-REPO-126 | implemented | DOCS-AFFECTED lists a doc when the profile changes more than its pins |
| SCN-REPO-127 | implemented | make docs writes the report of the vision scenarios and the module scenarios that realize them |
| SCN-REPO-128 | implemented | VISION rejects a planned vision scenario whose realizing scenarios are all implemented |
| SCN-REPO-129 | implemented | VISION rejects an implemented vision scenario with a planned realizing scenario or none |
| SCN-REPO-130 | implemented | VISION accepts status lines that follow the realizing scenarios and ignores deprecated ones |
| SCN-REPO-131 | implemented | TODO rejects an open item whose slices are all ticked |
