@module=deploy @owner=maintainers
Feature: The Compose profile installs a complete factory with one command
  An operator copies ".env.example" to ".env", sets its values and runs "docker compose up" in "deploy/compose/".
  The profile starts PostgreSQL with Temporal and pgvector, NATS, Jaeger, LiteLLM, gatekeeper, intake, foreman and
  console, with the reference factory in "deploy/compose/factory/" (ADR 0074). A module is healthy when its
  "/v1/health" answers 2xx (ADR 0086). The foreman starts the agents' sandboxes from the image of "agent-template",
  through "docker-proxy", its only way to the Docker API (ADR 0096).

  @id=SCN-DIST-001 @status=deprecated @realizes=SCN-FACTORY-OPEN-006
  Scenario: Every service of the Compose profile is healthy after one command
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "seaweedfs", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0

  @id=SCN-DIST-016 @status=deprecated @realizes=SCN-FACTORY-OPEN-006 @replaces=SCN-DIST-001
  Scenario: Every service of the Compose profile is healthy after one command, and each server's health checks pass
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0
    And "/v1/health" of "intake", "gatekeeper" and "foreman" answers 200 with the status "ok"
    And "docker compose run --rm console console doctor" exits with code 0 and prints no line that starts with "FAIL"

  @id=SCN-DIST-026 @status=implemented @realizes=SCN-FACTORY-OPEN-006 @replaces=SCN-DIST-016
  Scenario: Every service of the Compose profile is healthy after one command, Jaeger as the trace store, and each server's health checks pass
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "jaeger", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0
    And "/v1/health" of "intake", "gatekeeper" and "foreman" answers 200 with the status "ok"
    And "docker compose run --rm console console doctor" exits with code 0 and prints no line that starts with "FAIL"

  @id=SCN-DIST-017 @status=implemented @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: The foreman of the Compose profile starts a sandbox from the agents' template through docker-proxy only
    Given the Compose profile with every value of ".env.example" set in ".env"
    And the operator ran "docker compose up --detach --wait"
    When the service "foreman" runs "sandbox-docker create" with a spec of the image of "agent-template" and the egress allowlist "litellm"
    Then the sandbox has the programs "harness-claude-code", "gh", "git" and "make"
    And in the sandbox, "GET http://litellm:4000/health/liveliness" answers 200, and a request to "http://postgres:5432" fails
    And after "sandbox-docker destroy", "sandbox-docker list" in the service "foreman" does not list the sandbox
    And in the service "foreman", "docker version" exits with code 0, and "docker volume ls" and a container with the bind mount "/:/host" fail with "Forbidden"
    And the service "foreman" has no file "/var/run/docker.sock", and "docker-proxy" answers 403 to the service "console"

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

  @id=SCN-DIST-005 @status=deprecated
  Scenario: The plan of the reference factory adds the factory and finds no problems
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-020 @status=implemented @replaces=SCN-DIST-005
  Scenario: The plan of the reference factory adds the factory and finds no problems, with its inference config
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-006 @status=implemented
  Scenario: After the reference factory is applied, its plan shows no changes
    Given the Compose profile with every value of ".env.example" set in ".env"
    And the operator ran "docker compose run --rm factory apply --agent implement"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "No changes."

  @id=SCN-DIST-015 @status=implemented
  Scenario: The plan of this repository's factory adds the factory and finds no problems
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-012 @status=implemented
  Scenario: The verify stage of the reference factory waits for the check "verify"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-028 @status=implemented
  Scenario: The reference factory asks for approval of the spec after the stage "spec" and before "implement"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "spec" of the resolved factory has no gate
    And the stage "implement" of the resolved factory has the gate of "maintainers" with the policy "./policy/spec.rego"

  @id=SCN-DIST-029 @status=implemented
  Scenario: The ship stage of the reference factory starts only when the checks "verify" and "proof" succeeded
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "ship" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-030 @status=implemented
  Scenario: The ship stage of this repository's factory starts only when the checks "verify" and "proof" succeeded
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "ship" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-031 @status=planned
  Scenario: The verify stage of the reference factory only waits and runs no agent
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has "wait: true", no agent, the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-032 @status=planned
  Scenario: The verify stage of this repository's factory only waits and runs no agent
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has "wait: true", no agent, the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-013 @status=deprecated
  Scenario: The Compose profile takes the module images from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console" and "factory-spec" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-018 @status=deprecated @replaces=SCN-DIST-013
  Scenario: The Compose profile takes the module images and the agents' template from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec" and "harness-claude-code" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-023 @status=implemented @replaces=SCN-DIST-018
  Scenario: The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec", "harness-claude-code" and "litellm" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-027 @status=implemented
  Scenario: The profile's LLM gateway holds no code under BerriAI's enterprise license
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm --no-deps" in the service "litellm" to look for LiteLLM's enterprise code
    Then the command exits with code 0
    And the output says "no enterprise code"


  @id=SCN-DIST-014 @status=implemented @realizes=SCN-FACTORY-ACCESS-001
  Scenario: The intake of the Compose profile turns a GitHub issue labeled "factory" into a work item
    Given the Compose profile with every value of ".env.example" set in ".env" and "INTAKE_WEBHOOK_SECRET" set
    And the operator ran "docker compose up --detach --wait intake"
    And a GitHub webhook for issues to intake's "/forge/events", signed with the value of "INTAKE_WEBHOOK_SECRET"
    When "tester" adds the label "factory" to the issue "Export reports as CSV"
    Then intake shows a work item "Export reports as CSV" in the state "received" with the issue's link as its dedupe key
