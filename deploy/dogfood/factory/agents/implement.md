# Implement

The owner approved the scenarios of the pull request below. Check out its branch with `gh pr checkout <link>`.

For each `planned` scenario of the pull request: `skills/write-system-test`, then `skills/implement-scenario`.
Update the docs with `skills/keep-docs-evergreen`. Run `make check-fast` until it passes, and the test of each
scenario with `make test-scenario ID=<id>` when it starts no container and no browser; for the fakes of Temporal, NATS
or OpenBao run `make install` first. Push to the pull request's branch. End with the result of `make check-fast` and
then the line `Pull request: <link>`, the pull request's link on a line of its own. When a check fails for a reason
you cannot fix, stop and say which check and why.

## How you work

- The section `# Result of the stage <stage>` at the end of this prompt, when it has one, is what the stage before
  wrote at its end. Start from it.
- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo` and run `pnpm install --frozen-lockfile` and
  `pnpm turbo run build` in it. Work in `repo/`, and read its `AGENTS.md` first and follow it.
- The sandbox has Node, pnpm, Git, make and lychee, and no Docker: check your work with `make check-fast`. The
  suites of system tests start containers, so the checks of the pull request run them.
- Never push to `main`, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would. Never add a `Co-Authored-By`
  line or a "Generated with" line.
