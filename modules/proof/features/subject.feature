@module=proof @owner=maintainers
Feature: The change a bundle proves
  The subject of a bundle is the commit, the repository and the pull request that were verified.

  @id=SCN-PROOF-013 @status=planned
  Scenario: The bundle records the commit of the current Git repository
    Given a Git repository with one commit and a Playwright report for "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web --pull-request https://github.com/acme/web/pull/7"
    Then the bundle's subject has the commit of the repository, the repository "https://github.com/acme/web" and the pull request "https://github.com/acme/web/pull/7"
    And the bundle has the producer "proof" and the creation time "2026-01-01T00:00:00Z"

  @id=SCN-PROOF-014 @status=planned
  Scenario: The commit option names another commit
    Given a Git repository with one commit and a Playwright report for "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web --commit 9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c"
    Then the bundle's subject has the commit "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c"

  @id=SCN-PROOF-015 @status=planned
  Scenario: In GitHub Actions the repository comes from the workflow
    Given a Git repository with one commit and a Playwright report for "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json" with GITHUB_SERVER_URL "https://github.com" and GITHUB_REPOSITORY "acme/web"
    Then the bundle's subject has the repository "https://github.com/acme/web"

  @id=SCN-PROOF-016 @status=planned
  Scenario: A bundle without a repository is refused
    Given a Git repository with one commit and a Playwright report for "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json" without a repository
    Then the command exits with code 1
    And the error output contains "give the repository with --repository"

  @id=SCN-PROOF-017 @status=planned
  Scenario: The same evidence gives the same bundle
    Given a Git repository with one commit and a Playwright report for "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web" twice
    Then both bundles have the same ID
