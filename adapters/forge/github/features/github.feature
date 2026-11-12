@module=forge-github @owner=maintainers
Feature: GitHub's own rules for the forge port
  forge-github passes the forge port's scenarios in ports/forge/features/. These scenarios cover what only GitHub
  asks of it (ADR 0058, ADR 0062). The test forge is the testkit's fake GitHub.

  @id=SCN-FGITHUB-001 @status=implemented
  Scenario: The comments of a GitHub Actions token are its own
    Given an open pull request in "tester/web"
    And the client ran "comment" on it with the text "Evidence: 14 scenarios passed" with a GitHub Actions token
    When the client runs "comments" for it with that token
    Then comments prints the comment with the author "github:github-actions[bot]" and "mine" true

  @id=SCN-FGITHUB-002 @status=implemented
  Scenario: A repository that is not "<owner>/<name>" is a usage error
    Given the repository "tester/web"
    When the client runs "pr tester/web/pulls 1" and "pr @tester/web 1"
    Then both exit with code 2 and the error "forge-github: name the repository as <owner>/<name>, like tester/web"

  @id=SCN-FGITHUB-003 @status=implemented
  Scenario: A pull request number that is not a whole number above 0 is a usage error
    Given an open pull request in "tester/web"
    When the client runs "pr tester/web 0" and "pr tester/web 1.5"
    Then both exit with code 2 and the error "forge-github: name the pull request by its number, like 7"

  @id=SCN-FGITHUB-004 @status=implemented
  Scenario: A command with one word too many is a usage error
    Given an open pull request in "tester/web"
    When the client runs "pr tester/web <number> extra" with one word too many
    Then pr exits with code 2, prints nothing and writes the usage to the error output

  @id=SCN-FGITHUB-005 @status=implemented
  Scenario: pr lists the check runs of the head commit with a state for each status and conclusion
    Given an open pull request in "tester/web" whose head commit has one check run for each status and conclusion of GitHub
    When the client runs "pr" for it
    Then pr lists "success" for success, neutral and skipped, "failure" for failure, "error" for timed_out, cancelled, action_required, stale and startup_failure, and "pending" for queued and in_progress

  @id=SCN-FGITHUB-006 @status=implemented
  Scenario: Of several check runs with one name, the newest counts
    Given an open pull request in "tester/web" whose check run "verify" failed and whose re-run of "verify" succeeded
    When the client runs "pr" for it
    Then pr lists the check "verify" once, with "success"

  @id=SCN-FGITHUB-007 @status=implemented
  Scenario: Of a commit status and a check run with one name, the worse state counts
    Given an open pull request in "tester/web" whose head commit has, for "verify", "lint" and "deploy", the statuses "success", "pending" and "error" and the check runs "failure", "success" and "failure"
    When the client runs "pr" for it
    Then pr lists each name once: "verify" with "failure", "lint" with "pending" and "deploy" with "error"

  @id=SCN-FGITHUB-008 @status=implemented
  Scenario: pr reads every page of check runs
    Given an open pull request in "tester/web" whose head commit has 150 check runs, the last one "verify" with "success"
    When the client runs "pr" for it
    Then pr lists 150 checks, among them "verify" with "success"

  @id=SCN-FGITHUB-009 @status=implemented
  Scenario: A token that may not read check runs names the permission it needs
    Given an open pull request in "tester/web" and a token that may not read check runs
    When the client runs "pr" for it with that token
    Then pr exits with code 1 and an error that names the repository and the permission "Checks: read"
