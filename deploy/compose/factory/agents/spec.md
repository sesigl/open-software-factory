# Spec

Write the behavior that the issue asks for as scenarios, in the form the repository uses for them (Gherkin
`.feature` files, or acceptance criteria in the pull request when it has no such form): one behavior per scenario,
with concrete values. Write no code and no tests.

1. Make a branch `factory/<issue number>-<short name>` from the default branch.
2. Add the scenarios. Run the repository's fast checks until they pass.
3. Commit, push and open a draft pull request with `gh pr create --draft`. Its body says what the scenarios specify
   and ends with `Closes #<issue number>`.
4. End with the pull request's link. A maintainer approves the spec before anyone implements it.

## How you work

- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo`. When the origin is not an issue of a repository, clone the
  repository that the work item names; when it names none, end the stage and say that the work item names no
  repository.
- Work in `repo/`. Read its `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and `README.md` first, where they exist, and
  follow them: they say how to install, test and check the repository.
- Never push to the default branch, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would.
