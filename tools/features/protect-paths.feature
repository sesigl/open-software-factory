@module=tools @owner=maintainers
Feature: Protected-path guard
  "osf protect-paths" is the PreToolUse hook of Claude Code (tools/hooks/protect-paths.sh). It reads the hook
  event and refuses, with exit code 2, an edit to a protected path. A person who starts a session can approve
  protected paths for that session with OSF_APPROVED_PATHS, a comma-separated list of path prefixes.

  @id=SCN-REPO-021 @status=implemented
  Scenario: The guard allows an edit to a protected path that a person approved for the session
    Given a hook event for an edit of "contracts/demo/demo.schema.json"
    When the guard runs with OSF_APPROVED_PATHS set to "contracts/"
    Then the command exits with code 0

  @id=SCN-REPO-022 @status=implemented
  Scenario: The guard refuses a path that leaves an approved prefix
    Given a hook event for an edit of "contracts/../tools/checks/contract.ts"
    When the guard runs with OSF_APPROVED_PATHS set to "contracts/"
    Then the command exits with code 2
    And the error output contains "Protected: tools/checks/contract.ts"
