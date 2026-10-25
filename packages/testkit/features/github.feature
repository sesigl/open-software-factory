@module=testkit @owner=maintainers
Feature: A fake of GitHub's REST API
  fakes.github is an in-process fake of the part of GitHub's REST API that a forge client calls, with the same
  interface as fakes.forge (ADR 0058). It has the user "tester" with a token, keeps repositories with their commits,
  branches, pull requests, commit statuses, comments, reviews, branch protection and webhooks, and delivers signed
  webhook events to URLs on the local host.

  @id=SCN-TK-084 @status=implemented
  Scenario: fakes.github shows the pull request, the status and the comment a module posts
    Given a module whose CLI opens a pull request from "fix", sets the status "proof" to "success" on its head commit and comments "evidence bundle attached" at "DEMO_GITHUB_URL"
    And its system test creates the branch "fix" in fakes.github and expects that pull request, that status and that comment
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-085 @status=implemented
  Scenario: fakes.github squashes a pull request into "main" with the files of its branch
    Given a module whose CLI merges a pull request at "DEMO_GITHUB_URL" with the method "squash" and prints the merge commit
    And its system test opens a pull request in fakes.github that creates "notes.md" and expects "main" at that commit with "notes.md"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-086 @status=implemented
  Scenario: fakes.github refuses a merge that the branch protection of "main" forbids
    Given a module whose CLI protects "main" with the required check "verify" for admins too, merges a pull request at "DEMO_GITHUB_URL" and prints the answer's status and message
    And its system test opens a pull request in fakes.github and expects '405 Required status check "verify" is expected.'
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-087 @status=implemented
  Scenario: fakes.github delivers a signed ping and a pull request event to a webhook a module registers
    Given a module whose CLI registers a webhook for "pull_request" events with a secret to the URL it is given at "DEMO_GITHUB_URL"
    And its system test passes the URL of fakes.http, opens a pull request in fakes.github and expects the events "ping" and "pull_request" with a "sha256=" signature
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-088 @status=implemented
  Scenario: fakes.github answers 401 to a token it did not issue
    Given a module whose CLI reads a repository at "DEMO_GITHUB_URL" with the token "not-a-token" and prints the answer's status and message
    And its system test expects "401 Bad credentials"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-089 @status=implemented
  Scenario: A GitHub call fakes.github does not support fails the test with the call shown
    Given a module whose CLI lists the issues of a repository at "DEMO_GITHUB_URL"
    And its system test only runs it
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "fake GitHub: GET /repos/tester/demo/issues is not supported"

  @id=SCN-TK-091 @status=implemented
  Scenario: fakes.github delivers a person's comment in a pull request's conversation to a module's webhook
    Given a module whose CLI registers a webhook for "issue_comment" events to the URL it is given at "DEMO_GITHUB_URL"
    And its system test passes the URL of fakes.http, has "reviewer" say "@tester fix the typo" on a pull request and expects an "issue_comment" delivery with that author and text
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-092 @status=implemented
  Scenario: fakes.github answers the token's user and the comments of a pull request's conversation
    Given a module whose CLI prints the "login" of "GET /user" and the author and text of each comment of pull request 1 at "DEMO_GITHUB_URL"
    And its system test has "reviewer" say "@tester fix the typo" on pull request 1 and expects "tester reviewer:@tester fix the typo"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-095 @status=implemented
  Scenario: fakes.github removes the webhook a module deletes
    Given a module whose CLI registers a webhook for "push" events and then deletes it at "DEMO_GITHUB_URL"
    And its system test only runs it and expects that fakes.github lists no webhook of the repository
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-097 @status=implemented
  Scenario: fakes.github lists the files that a pull request changes
    Given a module whose CLI prints the "filename" of each file of pull request 1 at "DEMO_GITHUB_URL"
    And its system test opens pull request 1 that adds "notes.md" and changes "README.md" and expects "README.md notes.md"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
