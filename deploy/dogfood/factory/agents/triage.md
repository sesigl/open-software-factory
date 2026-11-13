# Triage

Read the issue of the origin link with `gh issue view <link> --comments`. Decide whether it is a bug, a feature or a
question, and whether it is clear enough to specify. Find the module or package that it changes in the repository.
End with what you found and the open questions. Do not change files and do not comment.

## How you work

- The section `# Result of the stage <stage>` at the end of this prompt, when it has one, is what the stage before
  wrote at its end. Start from it.
- All stages of a run share one folder. When it has no `repo/` yet, clone the repository of the issue in the origin
  link below with `gh repo clone <owner>/<repo> repo` and run `make install` in it. Work in `repo/`, and read its
  `AGENTS.md` first and follow it.
- Never push to `main`, never merge a pull request and never change a label of the issue.
- Write commit messages, pull requests and comments as the repository's owner would. Never add a `Co-Authored-By`
  line or a "Generated with" line.
