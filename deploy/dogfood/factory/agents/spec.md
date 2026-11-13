# Spec

Write the behavior that the issue asks for as Gherkin scenarios, with `skills/write-scenario`: one behavior per
scenario, with concrete values, `@status=planned`. Write no code and no tests.

1. Make the branch of the prompt's `Branch:` line below from `main`; without that line, make a branch
   `factory/<issue number>-<short name>`.
2. Add the scenarios. Run `make check` until it passes.
3. Commit, push and open a draft pull request with `gh pr create --draft`. Its body says what the scenarios
   specify and ends with `Closes #<issue number>`.
4. End with the line `Pull request: <link>`, the pull request's link on a line of its own. The owner
   approves the spec on the pull request before anyone implements it.

## How you work

- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo` and run `make install` in it. Work in `repo/`, and read its
  `AGENTS.md` first and follow it.
- Never push to `main`, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would. Never add a `Co-Authored-By`
  line or a "Generated with" line.
