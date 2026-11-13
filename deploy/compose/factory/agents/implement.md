# Implement

A maintainer approved the scenarios of the pull request below. Check out its branch with `gh pr checkout <link>`.

For each scenario, write its test first and watch it fail for the right reason, then change the code until it passes.
Update the docs that the change makes wrong. Run the repository's checks, as its instructions name them, until they
pass. Push to the pull request's branch. End with the result of the checks and then the line `Pull request: <link>`,
the pull request's link on a line of its own. When a check fails for a reason you cannot fix, stop and say which
check and why.

## How you work

- The section `# Result of the stage <stage>` at the end of this prompt, when it has one, is what the stage before
  wrote at its end. Start from it.
- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo`. When the origin is not an issue of a repository, clone the
  repository that the work item names; when it names none, end the stage and say that the work item names no
  repository.
- Work in `repo/`. Read its `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and `README.md` first, where they exist, and
  follow them: they say how to install, test and check the repository.
- Never push to the default branch, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would.
