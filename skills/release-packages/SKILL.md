---
name: release-packages
description: Release the npm packages of this repository and repair failed publishes. Use when a package is new or unpublished, when a release pull request is ready to merge, or when a publish workflow fails with E404 or ETARGET.
---

# Release the packages

release-please opens the release pull request; merging it tags each package, and `publish-<name>.yml` publishes it
to npm through its trusted publisher (`contracts/README.md#releases`). This skill covers what needs a person or an
agent.

## A new package

1. Run `osf release-files`: it writes `.github/workflows/publish-<name>.yml` and the release-please entries. RELEASE
   fails until they are current.
2. Before the release pull request that contains the package merges, the package must exist on npm, with a trusted
   publisher. Otherwise packages that depend on it are published while it is missing.
   - Build and pack it as version `0.0.0`, then run `npm publish <file>.tgz --tag placeholder --access public
     --registry https://registry.npmjs.org` without `--otp`. npm stages the version: the package exists, nothing is
     public. A version `0.0.0-stage` is refused.
   - Add the trusted publisher (step 4 of `contracts/README.md#releases`).
3. Ask the maintainer before each of these: both publish to npm.

## Two-factor authentication for npm

- The maintainer logs in once: `npm login --registry https://registry.npmjs.org`. Always pass that registry; a
  `.npmrc` may point elsewhere.
- A call without a terminal fails with `EOTP` and prints an `authUrl`. Generate the link yourself and give it to the
  maintainer; npm in their terminal masks it as `***`.
- Ask them to select "do not ask again for 5 minutes" when they approve. Then later calls need no `--otp`, and you
  can repair many packages in one run. Without it, each token works for one call only.

## The release pull request

- It never gets the required status `gatekeeper` (`GITHUB_TOKEN` starts no `pull_request_target`), so it merges
  only with `gh pr merge <n> --squash --admin`. Ask the maintainer first: the merge publishes every package in it.
- Its `verify` runs with `workflow_dispatch` and reports a commit status on the pull request.

## After the merge

1. Wait until every `publish-*` run of the release ends.
2. For `E404 Not Found - PUT`: npm refused the trusted publisher, even when `npm trust list` shows a correct entry.
   For each failed package: `npm trust list`, `npm trust revoke --id=<id>` for each entry, `npm trust github ...`
   again, then `gh workflow run publish-<name>.yml --ref main -f tag=<name>-v<version>`.
3. Check every version of `.release-please-manifest.json` with
   `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/<package>/<version>`. A new version can answer
   404 for some minutes ("being processed"); wait, then check again.
