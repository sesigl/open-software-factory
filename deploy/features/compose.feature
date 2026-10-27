@module=deploy @owner=maintainers
Feature: The Compose profile installs a complete factory with one command
  An operator copies ".env.example" to ".env", sets its values and runs "docker compose up" in "deploy/compose/".
  The profile starts PostgreSQL with Temporal and pgvector, SeaweedFS, NATS, Phoenix, LiteLLM, gatekeeper, intake,
  foreman and console, with the reference factory in "deploy/compose/factory/" (ADR 0074).

  @id=SCN-DIST-001 @status=implemented @realizes=SCN-FACTORY-OPEN-006
  Scenario: Every service of the Compose profile is healthy after one command
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "seaweedfs", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0

  @id=SCN-DIST-002 @status=implemented
  Scenario: The Compose profile names the value that .env is missing
    Given the Compose profile with every value of ".env.example" set in ".env" except "FOREMAN_API_TOKEN"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 1
    And the output contains "set FOREMAN_API_TOKEN in .env"

  @id=SCN-DIST-003 @status=implemented
  Scenario: The console of the Compose profile lists the runs of its foreman
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait console"
    Then the console's page "/" answers 200 with the heading "Runs"
    And the page does not say "did not answer"

  @id=SCN-DIST-004 @status=implemented
  Scenario: The console of the Compose profile shows the agents of the reference factory
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait console"
    Then the console's page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"

  @id=SCN-DIST-005 @status=implemented
  Scenario: The plan of the reference factory adds the factory and finds no problems
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-006 @status=implemented
  Scenario: After the reference factory is applied, its plan shows no changes
    Given the Compose profile with every value of ".env.example" set in ".env"
    And the operator ran "docker compose run --rm factory apply --agent implement"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "No changes."

  @id=SCN-DIST-012 @status=planned
  Scenario: The verify stage of the reference factory waits for the check "verify"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-013 @status=planned
  Scenario: The Compose profile takes the module images from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console" and "factory-spec" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"
