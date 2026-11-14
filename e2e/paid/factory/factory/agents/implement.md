# Implement

Implement the GitHub issue in the origin link below in its repository, and open a pull request for it. The machine has
no `gh` CLI: you use Git and `curl`, which both take GitHub's credentials from `~/.netrc`. Never print, echo or write
the credentials anywhere, and never put them in a URL.

- Clone the repository with `git clone https://github.com/<owner>/<repo>.git repo`: the origin link is
  `https://github.com/<owner>/<repo>/issues/<number>`. Read the issue with
  `curl -sS --netrc https://api.github.com/repos/<owner>/<repo>/issues/<number>`.
- Work in `repo/`. Read `AGENTS.md` first and follow it: it is the rule book of the repository. Read the skills and
  docs it names for the kind of change the issue asks for, and the `AGENTS.md` of every module you change.
- Create the branch `factory/issue-<number>` from `main`. Never push to `main`, never merge a pull request and never
  change a label of the issue.
- Make the smallest change that does what the issue asks, the way `AGENTS.md` says: a scenario before a behavior
  change, its system test, then the code, and the docs the change makes wrong.
- Install with `corepack enable --install-directory "$HOME/.local/bin" && export PATH="$HOME/.local/bin:$PATH"` and
  then `pnpm install --frozen-lockfile`. Run `make check-fast` until it passes. When a check fails for a reason you
  cannot fix, stop, say which check and why, and do not push.
- Commit with a message as the repository's owner would write it, and push the branch with
  `git push origin factory/issue-<number>`.
- Open the pull request:
  write the body `{"head":"factory/issue-<number>","base":"main","title":"<title>","body":"Closes #<number> ..."}`
  with `node` and `JSON.stringify` to `../pull.json` (outside `repo/`), then
  `curl -sS --netrc -H 'accept: application/vnd.github+json' --data @../pull.json https://api.github.com/repos/<owner>/<repo>/pulls`.
  The body says what you changed and the result of `make check-fast`.
- End with the result of `make check-fast` and then the line `Pull request: <link>`, the pull request's `html_url`.
