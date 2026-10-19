@module=factory-spec @owner=maintainers
Feature: Forge webhooks for automations
  An automation "forgejo.<object>.<action>(...)" needs the forge to send its events to intake. "factory apply"
  registers one webhook per repository the agents operate on, and "factory plan" reports a webhook that was
  changed or deleted on the forge as drift.

  @id=SCN-FSPEC-033 @status=implemented @realizes=SCN-FACTORY-AUTO-002
  Scenario: Apply registers a webhook on the repository of an automation
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" has one webhook to "http://intake.example/webhooks/forge" for the events "issue_label"

  @id=SCN-FSPEC-034 @status=implemented
  Scenario: Plan reports a webhook changed on the forge as drift
    Given the factory was applied with a webhook on the Forgejo repository "tester/web"
    And a person changed the URL of the webhook to "http://elsewhere.example/hook" in Forgejo
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! webhook tester/web.url: \"http://intake.example/webhooks/forge\" -> \"http://elsewhere.example/hook\""
    And the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."

  @id=SCN-FSPEC-035 @status=implemented
  Scenario: Apply restores a webhook changed on the forge
    Given the factory was applied with a webhook on the Forgejo repository "tester/web"
    And a person changed the URL of the webhook to "http://elsewhere.example/hook" in Forgejo
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" has one webhook to "http://intake.example/webhooks/forge" for the events "issue_label"

  @id=SCN-FSPEC-036 @status=implemented
  Scenario: Plan reports a webhook deleted on the forge as drift
    Given the factory was applied with a webhook on the Forgejo repository "tester/web"
    And a person deleted the webhook in Forgejo
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! webhook tester/web was deleted outside \"factory apply\""

  @id=SCN-FSPEC-037 @status=implemented
  Scenario: Apply recreates a webhook deleted on the forge
    Given the factory was applied with a webhook on the Forgejo repository "tester/web"
    And a person deleted the webhook in Forgejo
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" has one webhook to "http://intake.example/webhooks/forge" for the events "issue_label"

  @id=SCN-FSPEC-038 @status=implemented
  Scenario: Apply removes the webhook when the factory drops the automation
    Given the factory was applied with a webhook on the Forgejo repository "tester/web"
    And the factory engineer removed the automation from factory.yaml
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" has no webhook

  @id=SCN-FSPEC-039 @status=implemented
  Scenario: Apply asks for the forge when an automation needs a webhook
    Given a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    And FACTORY_FORGE_URL is not set
    When the factory engineer runs "factory apply"
    Then the command exits with code 1
    And the output contains "set FACTORY_FORGE_URL to manage the webhooks of forgejo automations"

  @id=SCN-FSPEC-047 @status=implemented
  Scenario: Apply shows the forge's answer when it refuses the token
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply" with the token "not-a-token"
    Then the command exits with code 1
    And the output contains "Forgejo answered 401 to POST tester/web/hooks"
