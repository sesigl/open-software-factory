@module=proof @owner=maintainers
Feature: GitHub Action
  "uses: sesigl/open-software-factory/modules/proof@proof-v<version>" bundles the reports of a workflow run,
  verifies the bundle and, on a pull request, attaches it with a link to the run. It fails when the verification
  failed, after the attach.

  @id=SCN-PROOF-043 @status=implemented @realizes=SCN-FACTORY-LOOP-009
  Scenario: The action attaches the bundle to the pull request of the run
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a JUnit report "reports/web.xml" where "SCN-WEB-001" passed
    When a pull request workflow of "acme/web" runs the action with "junit: reports/*.xml"
    Then the action succeeds
    And the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "success"
    And the comment on the pull request links "https://github.com/acme/web/actions/runs/1"

  @id=SCN-PROOF-044 @status=implemented
  Scenario: A failed verification fails the action after the attach
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a JUnit report "reports/web.xml" where "SCN-WEB-001" passed and "SCN-WEB-002" failed
    When a pull request workflow of "acme/web" runs the action with "junit: reports/*.xml"
    Then the action fails
    And the output contains "SCN-WEB-002 failed"
    And the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "failure"

  @id=SCN-PROOF-045 @status=implemented
  Scenario: A listed scenario without evidence fails the action
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a JUnit report "reports/web.xml" where "SCN-WEB-001" passed
    When a pull request workflow of "acme/web" runs the action with "junit: reports/*.xml" and "scenarios: SCN-WEB-001 SCN-WEB-003"
    Then the action fails
    And the output contains "SCN-WEB-003 has no evidence"

  @id=SCN-PROOF-046 @status=implemented
  Scenario: On a push the action bundles and verifies without a comment
    Given a JUnit report "reports/web.xml" where "SCN-WEB-001" passed
    When a push workflow of "acme/web" runs the action with "junit: reports/*.xml"
    Then the action succeeds
    And the output contains "SCN-WEB-001 passed with 1 artifact"
    And the action names the bundle in its output "bundle"
