@module=foreman @owner=maintainers
Feature: Sandboxes
  A stage whose agent declares a sandbox runs in a fresh sandbox through the sandbox port: the foreman creates it from
  the agent's definition, copies the run's folder in, runs the harness adapter in it, copies the folder out, and
  destroys the sandbox (ADR 0068). The scenarios use the testkit's fake sandbox adapter in place of Docker.

  @id=SCN-FORE-032 @status=planned @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: A stage whose agent declares a sandbox runs in a sandbox created from it
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the sandbox adapter got a spec with the template "node:24", the CPU 2, the memory "4Gi" and the egress hosts "registry.npmjs.org" and "api.anthropic.com"
    And the harness adapter ran in the sandbox of each stage
    And "/v1/runs/<id>" shows the state "complete"

  @id=SCN-FORE-033 @status=planned @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: The sandbox spec holds the agent's secret as a reference under its variable
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the spec of the "plan" stage's sandbox holds the secret "ANTHROPIC_API_KEY" from "ref:file/anthropic-api-key"

  @id=SCN-FORE-034 @status=planned @realizes=SCN-FACTORY-LOOP-011
  Scenario: A stage's sandbox carries the run in its environment
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the spec of the "plan" stage's sandbox sets "OTEL_RESOURCE_ATTRIBUTES" to name the run, the work item, the stage "plan" and the factory version

  @id=SCN-FORE-035 @status=planned
  Scenario: A file a stage writes in its sandbox reaches the run's folder and the next stage's sandbox
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness whose "plan" turn writes "plan.md"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the run's folder holds the "plan.md" the agent wrote
    And the harness adapter of the "implement" stage started in a sandbox that held "plan.md"

  @id=SCN-FORE-036 @status=planned @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: Each stage's sandbox is destroyed when the stage ends
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token and the run completes
    Then the sandbox adapter created 2 sandboxes
    And its sandbox list is empty

  @id=SCN-FORE-037 @status=planned
  Scenario: A cancel destroys the sandbox of the running stage
    Given a run of the README's "sandboxed/factory.yaml" whose "plan" stage runs in a sandbox of a fake sandbox adapter and waits
    When a program posts the signal "cancel" to "/v1/runs/<id>/signals"
    Then "/v1/runs/<id>" shows the state "cancelled"
    And the sandbox adapter's sandbox list is empty

  @id=SCN-FORE-038 @status=planned
  Scenario: A sandbox the adapter cannot create fails the run
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" that knows only the template "alpine:3"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"
    And the harness never received the prompt "Write a plan"

  @id=SCN-FORE-039 @status=planned
  Scenario: The sandbox adapter is the one the factory names under "providers.sandbox"
    Given the README's "sandboxed/factory.yaml" with "kubernetes" in place of "docker" under "providers.sandbox"
    And "foreman serve" runs it with "FOREMAN_SANDBOXES" naming a fake sandbox adapter as "kubernetes" only
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete"
    And the fake sandbox adapter created 2 sandboxes

  @id=SCN-FORE-040 @status=planned
  Scenario: A factory that names two sandbox adapters stops the server at the start
    Given the README's "sandboxed/factory.yaml" with "kubernetes" added under "providers.sandbox"
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: /providers/sandbox: name one sandbox adapter, not 2"

  @id=SCN-FORE-041 @status=planned
  Scenario: A stage whose agent declares no sandbox runs on the foreman's machine
    Given "foreman serve" runs the README's "factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete"
    And the sandbox adapter created no sandbox
