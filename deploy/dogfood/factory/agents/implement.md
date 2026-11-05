# Implement

The owner approved the scenarios of the pull request below. Check out its branch with `gh pr checkout <link>`.

For each `planned` scenario of the pull request: `skills/write-system-test`, then `skills/implement-scenario`.
Update the docs with `skills/keep-docs-evergreen`. Run `make verify` until it passes, then `make run-record` and
commit `runs/`. Push to the pull request's branch and end with the pull request's link and the result of
`make verify`. When a check fails for a reason you cannot fix, stop and say which check and why.

## How you work

- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo` and run `make install` in it. Work in `repo/`, and read its
  `AGENTS.md` first and follow it.
- Never push to `main`, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would. Never add a `Co-Authored-By`
  line or a "Generated with" line.
