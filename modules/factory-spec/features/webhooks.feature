@module=factory-spec @owner=maintainers
Feature: Forge webhooks
  "factory apply" gives every repository of the factory one webhook to the intake for the automations that a
  Forgejo event starts, and "factory plan" reports a webhook changed by hand as drift. Decision: ADR 0022.

  @id=SCN-FSPEC-043 @status=implemented @realizes=SCN-FACTORY-AUTO-002
  Scenario: Apply registers a webhook for a forge automation
    Given a Forgejo repository "tester/web-app"
    And a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply" with the intake URL "http://intake.example.invalid/hooks"
    Then the command exits with code 0
    And the output contains "webhook of tester/web-app: created"
    And the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "issue_label"

  @id=SCN-FSPEC-044 @status=implemented
  Scenario: Applying again keeps one webhook per repository
    Given the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"
    When the factory engineer runs "factory apply" again
    Then the command exits with code 0
    And the output contains "webhook of tester/web-app: updated"
    And the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "issue_label"

  @id=SCN-FSPEC-045 @status=implemented @realizes=SCN-FACTORY-AUTO-002
  Scenario: Apply changes the events of the webhook when the automations change
    Given the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"
    And the factory engineer changed the automation to "forgejo.push"
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And the repository "tester/web-app" has one webhook to "http://intake.example.invalid/hooks" for the event "push"

  @id=SCN-FSPEC-046 @status=implemented
  Scenario: Plan reports a webhook changed by hand as drift
    Given the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"
    And a person deactivated the webhook of "tester/web-app" in Forgejo
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! webhook of tester/web-app changed outside \"factory apply\""
    And the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."

  @id=SCN-FSPEC-047 @status=implemented
  Scenario: Plan reports a deleted webhook as drift
    Given the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"
    And a person deleted the webhook of "tester/web-app" in Forgejo
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! webhook of tester/web-app was deleted outside \"factory apply\""

  @id=SCN-FSPEC-048 @status=implemented
  Scenario: Apply deletes the webhook when the factory no longer has a forge automation
    Given the factory with the automation on "forgejo.issue.labeled(auto-implement)" was applied to "tester/web-app"
    And the factory engineer removed the automation from factory.yaml
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And the output contains "webhook of tester/web-app: deleted"
    And the repository "tester/web-app" has no webhook

  @id=SCN-FSPEC-049 @status=implemented
  Scenario: Apply asks for the forge when a forge automation needs a webhook
    Given a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply" without FACTORY_FORGE_URL
    Then the command exits with code 1
    And the error output contains "set FACTORY_FORGE_URL"

  @id=SCN-FSPEC-050 @status=implemented
  Scenario: Apply refuses a forge event it cannot map to a webhook event
    Given a factory.yaml whose agent "implement" works on "tester/web-app" and has the automation on "forgejo.wiki.edited"
    When the factory engineer runs "factory apply"
    Then the command exits with code 1
    And the error output contains "no Forgejo webhook event for \"forgejo.wiki.edited\""
