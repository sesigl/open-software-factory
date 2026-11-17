@module=testkit @owner=maintainers
Feature: A fake of GitHub's REST API
  fakes.github is an in-process fake of the part of GitHub's REST API that a forge client calls, with the same
  interface as fakes.forge (ADR 0058). It has the user "tester" with a token, keeps repositories with their commits,
  branches, pull requests, commit statuses, comments, reviews, branch protection and webhooks, and delivers signed
  webhook events to URLs on the local host. Its Git Data API writes commits without a checkout, and the part of
  GitHub's GraphQL API that auto-merge needs merges a pull request once its merge rules hold (ADR 0136).

  @id=SCN-TK-084 @status=implemented
  Scenario: fakes.github shows the pull request, the status and the comment a module posts
    Given the repository "demo" in fakes.github with the branch "fix"
    When a module opens a pull request from "fix", sets the status "proof" to "success" on its head commit and comments "evidence bundle attached" through GitHub's API
    Then fakes.github shows that pull request, that status and that comment

  @id=SCN-TK-085 @status=implemented
  Scenario: fakes.github squashes a pull request into "main" with the files of its branch
    Given a pull request in fakes.github that creates "notes.md"
    When a module merges it with the method "squash" through GitHub's API
    Then "main" is at the merge commit it got back and holds "notes.md"

  @id=SCN-TK-086 @status=implemented
  Scenario: fakes.github refuses a merge that the branch protection of "main" forbids
    Given a pull request in fakes.github
    When a module protects "main" with the required check "verify" for admins too and merges the pull request through GitHub's API
    Then the answer is '405 Required status check "verify" is expected.' and the pull request is open

  @id=SCN-TK-087 @status=implemented
  Scenario: fakes.github delivers a signed ping and a pull request event to a webhook a module registers
    Given fakes.http and the repository "demo" in fakes.github
    When a module registers a webhook for "pull_request" events with a secret to the URL of fakes.http through GitHub's API
    And the test opens a pull request in fakes.github
    Then fakes.http gets a "ping" and a "pull_request" delivery, each with a "sha256=" signature

  @id=SCN-TK-088 @status=implemented
  Scenario: fakes.github answers 401 to a token it did not issue
    Given the repository "demo" in fakes.github
    When a module reads it through GitHub's API with the token "not-a-token"
    Then the answer is "401 Bad credentials"

  @id=SCN-TK-089 @status=implemented
  Scenario: A GitHub call fakes.github does not support fails the test with the call shown
    Given a module whose CLI lists the issues of a repository at "DEMO_GITHUB_URL"
    And its system test only runs it
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "fake GitHub: GET /repos/tester/demo/issues is not supported"

  @id=SCN-TK-091 @status=implemented
  Scenario: fakes.github delivers a person's comment in a pull request's conversation to a module's webhook
    Given fakes.http and a pull request in fakes.github
    When a module registers a webhook for "issue_comment" events to the URL of fakes.http through GitHub's API
    And "reviewer" says "@tester fix the typo" on the pull request in fakes.github
    Then fakes.http gets an "issue_comment" delivery with that author and text

  @id=SCN-TK-092 @status=implemented
  Scenario: fakes.github answers the token's user and the comments of a pull request's conversation
    Given pull request 1 in fakes.github, on which the test had "reviewer" say "@tester fix the typo"
    When a module reads the "login" of "GET /user" and the comments of pull request 1 through GitHub's API
    Then the answers are "tester" and one comment, "reviewer:@tester fix the typo"

  @id=SCN-TK-095 @status=implemented
  Scenario: fakes.github removes the webhook a module deletes
    Given the repository "demo" in fakes.github
    When a module registers a webhook for "push" events and then deletes it through GitHub's API
    Then the delete answers 204 and fakes.github lists no webhook of the repository

  @id=SCN-TK-098 @status=implemented
  Scenario: fakes.github answers the changed files, the labels and the draft flag of a pull request
    Given pull request 1 in fakes.github that changes "checkout.js"
    When a module reads the files of pull request 1, and its labels and "draft", through GitHub's API
    Then the answers are "checkout.js", no label and "draft" false

  @id=SCN-TK-099 @status=implemented
  Scenario: fakes.github has a token like a GitHub Actions token that may not read its user
    Given pull request 1 in fakes.github and its actions token
    When a module reads "GET /user" and comments on pull request 1 with that token through GitHub's API
    Then "GET /user" answers 403 and the comment is by "github-actions[bot]"

  @id=SCN-TK-102 @status=implemented
  Scenario: fakes.github answers an issue that a test opened and labeled
    Given the issue "Export reports as CSV" that the test opened in fakes.github and gave the label "factory"
    When a module reads issue 1 through GitHub's API
    Then issue 1 has the title "Export reports as CSV" and the one label "factory"

  @id=SCN-TK-145 @status=implemented
  Scenario: fakes.github removes a label from an issue
    Given the issue "Export reports as CSV" that the test opened in fakes.github, gave the label "factory" and took it from again
    When a module reads issue 1 through GitHub's API
    Then issue 1 has the title "Export reports as CSV" and 0 labels

  @id=SCN-TK-113 @status=implemented
  Scenario: fakes.github lists the open pull requests and the reviews of a pull request
    Given pull requests from "fix" and "docs" in fakes.github, of which the test merged "docs" and approved "fix" as "reviewer"
    When a module reads the open pull requests and the reviews of each through GitHub's API
    Then the one open pull request is from "fix", with the one review "APPROVED"

  @id=SCN-TK-143 @status=implemented
  Scenario: fakes.github lists the check runs that a test adds to a pull request's head commit, page by page
    Given a pull request in fakes.github to whose head commit the test added the check runs "lint" queued, "test" failed and "verify" succeeded
    When a module reads page 2 of the check runs of the head commit, 2 per page, through GitHub's API
    Then the answer has the total 3 and the one check run "verify" completed with "success"

  @id=SCN-TK-191 @status=implemented
  Scenario: fakes.github lists the comments of a pull request's conversation page by page, 30 to a page by default
    Given pull request 1 in fakes.github, on which the test had "reviewer" say "Comment 1" to "Comment 102"
    When a module reads the first page of the comments of pull request 1 and page 2 of 100 per page through GitHub's API
    Then the first page has 30 comments and page 2 has "Comment 101" and "Comment 102"

  @id=SCN-TK-144 @status=implemented
  Scenario: fakes.github refuses to list check runs to a token that may not read them
    Given a pull request in fakes.github with a check run on its head commit
    When a module reads the check runs of its head commit through GitHub's API with the token of fakes.github that may not read check runs
    Then the answer's status is 403

  @id=SCN-TK-163 @status=implemented
  Scenario: fakes.github signs in the person a test names with GitHub's OAuth flow and gives their primary email
    Given fakes.github, which signs in "ada" with the email "ada@acme.dev" named "Ada"
    When a module signs in at fakes.github with its OAuth app and reads the state, the login, the name and the primary email with its verification
    Then they come back, the email as verified

  @id=SCN-TK-165 @status=implemented
  Scenario: fakes.github answers the protection of a protected branch, and 404 for a branch without
    Given the repository "demo" in fakes.github with the branch "dev"
    When a module protects "main" with the required check "verify" and one approval, and reads the protection of "main" and of "dev" through GitHub's API
    Then the protection of "main" has the check "verify" and 1 approval, and that of "dev" answers "404 Branch not protected"

  @id=SCN-TK-166 @status=implemented
  Scenario: fakes.github closes a pull request without merging and deletes its branch's ref
    Given a pull request from "fix" in fakes.github
    When a module closes pull request 1 and deletes the ref of its branch twice through GitHub's API
    Then the answers are "closed", not merged, 204 and 422, the pull request is closed and the branch "fix" is gone

  @id=SCN-TK-167 @status=implemented
  Scenario: fakes.github writes one commit of several files with the Git Data API
    Given the repository "demo" in fakes.github with the branch "fix" with "notes.md"
    When a module reads the ref and the commit of "fix", makes a tree on its tree that changes "notes.md" and adds "docs/new.md", a commit of it on the branch's head, and moves "fix" there without force through GitHub's API
    Then the move answers 200 with the new commit, whose parent is the old head, both files are on "fix", "README.md" is kept and "main" is unchanged

  @id=SCN-TK-168 @status=implemented
  Scenario: fakes.github moves a branch back only when the update is forced
    Given the repository "demo" in fakes.github with the branch "fix"
    When a module moves "fix" to the head commit of "main" without force and then with force through GitHub's API
    Then the first answers "422 Update is not a fast forward", the second 200, and "fix" is at the head commit of "main"

  @id=SCN-TK-169 @status=implemented
  Scenario: fakes.github merges a pull request with auto-merge once its required check passes
    Given a pull request in fakes.github whose repository allows auto-merge
    When a module requires the check "verify" on "main", reads the merge state of pull request 1 with GitHub's GraphQL API, enables auto-merge with the method "SQUASH" and posts "verify" as "success" on its head
    Then the merge state was "BLOCKED", the pull request was open before and merged after, with a merge commit of one parent

  @id=SCN-TK-170 @status=implemented
  Scenario: fakes.github refuses auto-merge where the repository does not allow it and for a pull request that can merge now
    Given a pull request in fakes.github whose repository does not allow auto-merge
    When a module reads the merge state of pull request 1 with GitHub's GraphQL API and enables auto-merge, before and after the test allows auto-merge in the repository
    Then GitHub's errors name the setting and the clean status, and the pull request is open

  @id=SCN-TK-171 @status=implemented
  Scenario: fakes.github answers the auto-merge request of a pull request whose auto-merge a module enabled
    Given a pull request in fakes.github whose repository allows auto-merge
    When a module requires the check "verify" on "main" and enables auto-merge of pull request 1 with the method "SQUASH" with GitHub's GraphQL API
    Then the pull request had no auto-merge request before and has one with the merge method "SQUASH" after

  @id=SCN-TK-172 @status=implemented
  Scenario: Enabling auto-merge twice in fakes.github fails the test with the pull request named
    Given a module whose CLI requires the check "verify" on "main" and enables auto-merge of pull request 1 twice with GitHub's GraphQL API at "DEMO_GITHUB_URL"
    And its system test allows auto-merge in the repository of fakes.github, opens the pull request and only runs it
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "fake GitHub: auto-merge of tester/demo#1 is enabled already"

  @id=SCN-TK-173 @status=implemented
  Scenario: fakes.github lists the calls a module made, with their query
    Given the repository "demo" in fakes.github
    When a module reads the repository "tester/demo" and the first page of its pull requests through GitHub's API
    Then fakes.github lists the calls "GET /repos/tester/demo" and "GET /repos/tester/demo/pulls?per_page=1&page=1"

  @id=SCN-TK-174 @status=implemented
  Scenario: fakes.github keeps a blob's bytes and puts it into a tree by its SHA
    Given the repository "demo" in fakes.github with the branch "fix"
    When a module posts the bytes "ff fe 00 80 41 0a c3 28" as a base64 blob, makes a tree on the tree of "fix" with "logo.bin" as that blob, commits it on "fix" and moves "fix" there through GitHub's API
    Then the blob answers 201 with "702e1e879fdef58f4ee3b5229825b123b436cf5d", Git's SHA of these bytes, and "logo.bin" on "fix" has these bytes

  @id=SCN-TK-175 @status=implemented
  Scenario: fakes.github answers the rules of the rulesets that apply to a branch
    Given the repository "demo" in fakes.github with a ruleset that requires the check "factory" and one approval on "main"
    When a module reads the rules for "main" and for "dev" through GitHub's API
    Then the rules for "main" are "required_status_checks factory" and "pull_request 1", and "dev" has none
