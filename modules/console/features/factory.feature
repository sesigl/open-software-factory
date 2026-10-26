@module=console @owner=maintainers
Feature: The factory's configuration, read-only
  The pages "/factory" and "/factory/agents/<name>" show the factory definition in "CONSOLE_FACTORY" and link to the
  file in Git, where it changes (ADR 0072).

  @id=SCN-CONSOLE-023 @status=implemented @realizes=SCN-FACTORY-CODE-002
  Scenario: The factory page lists the agents with their harness and model
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage" on "claude-code" with the model "routes/triage"
    When a person opens "/factory"
    Then the page shows the agent "triage" with the harness "claude-code" and the model "routes/triage"
    And the page links the agent's page "/factory/agents/triage"

  @id=SCN-CONSOLE-024 @status=implemented @realizes=SCN-FACTORY-CODE-002
  Scenario: An agent's page is read-only and links to the file and the branch in Git
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage", "CONSOLE_REPOSITORY_URL" is "https://github.com/acme/factory" and "CONSOLE_BRANCH" is "main"
    When a person opens "/factory/agents/triage"
    Then the page shows the agent's prompt "./prompts/triage.md"
    And the page links "https://github.com/acme/factory/blob/main/factory.yaml" and says "Change it in Git, on the branch main"
    And the page has no form and no input

  @id=SCN-CONSOLE-025 @status=implemented
  Scenario: An agent that the factory does not declare answers 404
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage"
    When a person opens "/factory/agents/deploy"
    Then the page answers 404 and says "no agent deploy in factory.yaml"

  @id=SCN-CONSOLE-026 @status=implemented
  Scenario: A POST to the console answers 405
    Given "console serve" runs
    When a program posts to "/factory"
    Then the answer has the status 405

  @id=SCN-CONSOLE-027 @status=implemented
  Scenario: Every page links the dashboards in "CONSOLE_LINKS"
    Given "CONSOLE_LINKS" is "Grafana=https://grafana.acme.dev,Langfuse=https://langfuse.acme.dev"
    When a person opens "/factory"
    Then the page links "Grafana" to "https://grafana.acme.dev" and "Langfuse" to "https://langfuse.acme.dev"
