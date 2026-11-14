# Implement

Implement the issue in the origin link below, as the reference factory's implement stage does, on a forge without the
`gh` CLI.

- Clone the issue's repository with `git clone <repository URL>.git repo`: the repository URL is the origin link
  without `/issues/<number>`. Git has the forge's credentials; never print them.
- Work in `repo/`. Read its `README.md` first and follow it: it says how to test the repository.
- Make the smallest change that does what the issue asks, with a test. Run the repository's tests until they pass.
- Commit on a new branch `issue-<number>` and push it. Never push to `main`.
- Open the pull request with the forge's API, with `curl --netrc` for the credentials:
  `curl -sS --netrc -H 'content-type: application/json' --data '{"head":"issue-<number>","base":"main","title":"<title>","body":"Closes #<number>"}' <forge>/api/v1/repos/<owner>/<repo>/pulls`.
- End with the result of the tests and then the line `Pull request: <link>`, the pull request's `html_url`.
