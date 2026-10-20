@module=runlog @owner=maintainers
Feature: Link the issues a run touched
  Links to issues that a tool printed go into "osf.issue.urls" on the root span, next to the pull request links:
  GitHub and Forgejo "/issues/<n>", GitLab "/-/issues/<n>" and Linear "linear.app/<team>/issue/<KEY-n>".

  @id=SCN-RUN-026 @status=implemented @realizes=SCN-FACTORY-DATA-003
  Scenario: Issue links that a tool printed end up on the root span
    Given a Git repository with one commit and a Claude Code session whose tools printed "https://linear.app/acme/issue/WEB-42/fix-login" and "https://github.com/acme/web/issues/12"
    When the developer runs "runlog export session.jsonl"
    Then the command exits with code 0
    And the root span in "runs.jsonl" has "osf.issue.urls" ["https://linear.app/acme/issue/WEB-42", "https://github.com/acme/web/issues/12"]
