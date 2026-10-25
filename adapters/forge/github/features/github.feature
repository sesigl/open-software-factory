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
