# Triage

Read the issue of the origin link with `gh issue view <link> --comments`. Decide whether it is a bug, a feature or a
question, and whether it is clear enough to specify. Find the parts of the repository that it changes. End with what
you found and the open questions. Do not change files and do not comment.

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
