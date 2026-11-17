# Ship

The checks of the pull request below passed. Mark it ready for review with `gh pr ready <link>`. End with one
paragraph for the owner who merges it: what it changes, and what to look at first.

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
