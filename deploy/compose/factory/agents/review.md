# Review

Check out the pull request below with `gh pr checkout <link>`. Review its diff against its scenarios and the rules of
the repository. Fix what blocks the merge in the same branch, run the repository's checks and push. End with what you
changed and why. Do not comment on the pull request.

## How you work

- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo`. When the origin is not an issue of a repository, clone the
  repository that the work item names; when it names none, end the stage and say that the work item names no
  repository.
- Work in `repo/`. Read its `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and `README.md` first, where they exist, and
  follow them: they say how to install, test and check the repository.
- Never push to the default branch, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would.
