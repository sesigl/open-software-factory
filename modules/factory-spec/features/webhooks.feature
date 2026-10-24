@module=factory-spec @owner=maintainers
Feature: Forge webhooks for automations
  An automation "forgejo.<object>.<action>(...)" or "github.<object>.<action>(...)" needs the forge to send its
  events to intake. "factory apply" registers one webhook per repository the agents operate on, through the forge
  port's adapter for that forge, and "factory plan" reports a webhook that was changed or deleted on the forge as
  drift (ADR 0060). The fake GitHub has the user "tester" and the repository "tester/web".

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

  @id=SCN-FSPEC-047 @status=deprecated
  Scenario: Apply shows the forge's answer when it refuses the token
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply" with the token "not-a-token"
    Then the command exits with code 1
    And the output contains "Forgejo answered 401 to POST tester/web/hooks"

  @id=SCN-FSPEC-049 @status=implemented @replaces=SCN-FSPEC-047
  Scenario: Apply shows the forge adapter's error when the forge refuses the token
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply" with the token "not-a-token"
    Then the command exits with code 1
    And the output contains "the forge refused the token"

  @id=SCN-FSPEC-050 @status=implemented @realizes=SCN-FACTORY-AUTO-002
  Scenario: Apply registers a webhook on the GitHub repository of a github automation
    Given a GitHub repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" on GitHub has one webhook to "http://intake.example/webhooks/forge" for the events "issues"

  @id=SCN-FSPEC-051 @status=implemented
  Scenario: Plan reports a webhook changed on GitHub as drift
    Given the factory was applied with a webhook on the GitHub repository "tester/web"
    And a person changed the URL of the webhook to "http://elsewhere.example/hook" on GitHub
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! webhook github:tester/web.url: \"http://intake.example/webhooks/forge\" -> \"http://elsewhere.example/hook\""

  @id=SCN-FSPEC-052 @status=implemented
  Scenario: Apply restores a webhook changed on GitHub
    Given the factory was applied with a webhook on the GitHub repository "tester/web"
    And a person changed the URL of the webhook to "http://elsewhere.example/hook" on GitHub
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "tester/web" on GitHub has one webhook to "http://intake.example/webhooks/forge" for the events "issues"

  @id=SCN-FSPEC-053 @status=implemented
  Scenario: Apply asks for the GitHub token when a github automation needs a webhook
    Given a factory.yaml whose agent "triage" operates on "tester/web" and the automation "github.issue.labeled(auto-implement)"
    And FACTORY_GITHUB_TOKEN is not set
    When the factory engineer runs "factory apply"
    Then the command exits with code 1
    And the output contains "set FACTORY_GITHUB_TOKEN to manage the webhooks of github automations"

  @id=SCN-FSPEC-054 @status=implemented
  Scenario: Apply with gh-aw workflows registers no GitHub webhook
    Given a GitHub repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory apply --gh-aw"
    Then the command exits with code 0
    And "tester/web" on GitHub has no webhook

  @id=SCN-FSPEC-055 @status=implemented
  Scenario: Apply asks for the webhook secret when an automation needs a webhook
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    And FACTORY_WEBHOOK_SECRET is not set
    When the factory engineer runs "factory apply"
    Then the command exits with code 1
    And the output contains "set FACTORY_WEBHOOK_SECRET to the secret that signs the webhooks of automations"

  @id=SCN-FSPEC-056 @status=implemented
  Scenario: Apply names the forge adapter it cannot start
    Given a Forgejo repository "tester/web"
    And a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"
    And FACTORY_FORGEJO_ADAPTER is "/opt/missing/forge-forgejo"
    When the factory engineer runs "factory apply"
    Then the command exits with code 1
    And the output contains "could not start the forge adapter /opt/missing/forge-forgejo (ENOENT)"
