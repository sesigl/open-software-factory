@module=console @owner=maintainers
Feature: The factory's configuration, read-only
  The pages "/factory" and "/factory/agents/<name>" show the factory definition in "CONSOLE_FACTORY" and link to the
  file in Git, where it changes (ADR 0072).

  @id=SCN-CONSOLE-023 @status=deprecated @realizes=SCN-FACTORY-CODE-002
  Scenario: The factory page lists the agents with their harness and model
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage" on "claude-code" with the model "routes/triage"
    When a person opens "/factory"
    Then the page shows the agent "triage" with the harness "claude-code" and the model "routes/triage"
    And the page links the agent's page "/factory/agents/triage"

  @id=SCN-CONSOLE-036 @status=implemented @replaces=SCN-CONSOLE-023 @realizes=SCN-FACTORY-CODE-002
  Scenario: The factory page lists the agents with their harness, model and effort
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage" on "claude-code" with the model "routes/triage" and the effort "high"
    When a person opens "/factory"
    Then the page shows the agent "triage" with the harness "claude-code", the model "routes/triage" and the effort "high"
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

  @id=SCN-CONSOLE-263 @status=implemented @realizes=SCN-FACTORY-CODE-002
  Scenario: The factory page and an agent's page show in the shell, with "Factory" as the current page
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage"
    When a person opens "/factory" and "/factory/agents/triage"
    Then both pages have the title of their heading, "acme" and "triage", and mark "Factory" as the current page
    And the agent's page leads back to "Factory" at "/factory" above its heading

  @id=SCN-CONSOLE-264 @status=implemented @realizes=SCN-FACTORY-CODE-002
  Scenario: An agent's page shows a list or a map of the agent as YAML
    Given "CONSOLE_FACTORY" names a "factory.yaml" with the agent "implement", whose "secrets" list "ref:openbao/linear-token" and whose "sandbox" has the template "node-24" and the egress "api.linear.app"
    When a person opens "/factory/agents/implement"
    Then the agent's "secrets" show the YAML "- ref:openbao/linear-token" and its "sandbox" the YAML "template: node-24 egress: - api.linear.app"
    And its "harness" shows "claude-code" and its "effort" "high"

  @id=SCN-CONSOLE-266 @status=implemented @kind=journey
  Scenario: On a phone a person reads the health, the factory and the cost and scores as cards (journey)
    Given a console with the factory "acme" and its agent "triage", a healthy foreman, and a folder of cost and scores with the stage "implement" of "run_a" and the scorer "redundant-tests"
    When a person opens "/health" on a phone
    Then the check "foreman token" is a card across the screen with its state "ok" above its name, and the page passes the accessibility checks; its screenshot is kept as "health-phone"
    And after "Menu" and "Factory" the agent "triage" is a card across the screen, and the page passes the accessibility checks; its screenshot is kept as "factory-phone"
    And a tap on the card opens "/factory/agents/triage", whose facts stand inside the screen, and the page passes the accessibility checks
    And on "/improvement" the scorer and the stage are cards across the screen, the stage's outcome above its run, and the page passes the accessibility checks; its screenshot is kept as "improvement-phone"
