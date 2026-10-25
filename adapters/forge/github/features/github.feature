@module=forge-github @owner=maintainers
Feature: GitHub's own rules for the forge port
  forge-github passes the forge port's scenarios in ports/forge/features/. These scenarios cover what only GitHub asks
  of it (ADR 0061).

  @id=SCN-FGITHUB-001 @status=implemented
  Scenario: With a GitHub Actions token, comments marks the comments of github-actions[bot] as its own
    Given an open pull request in "tester/web" that "github-actions[bot]" commented "Evidence attached" on
    And the person "reviewer" commented "Looks good" on it
    When the client runs "comments" for it with a GitHub Actions token, which may not read "GET /user"
    Then comments prints "Evidence attached" by "github-actions[bot]" with "mine" true and "Looks good" with "mine" false
