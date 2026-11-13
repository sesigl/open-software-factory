@module=foreman @owner=maintainers
Feature: Factory definition
  The foreman reads the factory's "factory.yaml" when a run starts. The run keeps that version of the factory until
  it ends.

  @id=SCN-FORE-008 @status=implemented @realizes=SCN-FACTORY-LOOP-011
  Scenario: A run carries the commit of the factory definition
    Given the README's "factory.yaml" is committed in the factory's repository
    And "foreman serve" runs it with a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the factory "hello" and that commit as the factory version

  @id=SCN-FORE-009 @status=implemented @realizes=SCN-FACTORY-LOOP-011
  Scenario: A run keeps its factory version when the factory changes during the run
    Given a run of the README's factory waits at a gate before the stage "implement"
    And a new commit adds the stage "review" to "factory.yaml"
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    Then the run completes with the stages "plan" and "implement" and the first commit as its factory version

  @id=SCN-FORE-010 @status=implemented
  Scenario: A stage that names an unknown agent stops the server at the start
    Given a "factory.yaml" whose stage "review" names the agent "reviewer", which the factory does not declare
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: /workflow/0/agent: no agent \"reviewer\""

  @id=SCN-FORE-011 @status=implemented
  Scenario: The server needs an API token
    Given the README's "factory.yaml"
    When the user runs "foreman serve" without "FOREMAN_API_TOKEN"
    Then the command exits with code 2
    And the output contains "FOREMAN_API_TOKEN"

  @id=SCN-FORE-026 @status=implemented
  Scenario: A factory outside a Git repository stops the server at the start
    Given the README's "factory.yaml" and its prompts in a folder outside any Git repository
    When the user runs "foreman serve" with "FOREMAN_FACTORY" set to that "factory.yaml"
    Then the command exits with code 2
    And the output contains "factory.yaml: commit it in a Git repository"

  @id=SCN-FORE-069 @status=implemented
  Scenario: Each stage's agent gets its agent's effort as "OSF_EFFORT"
    Given "foreman serve" runs the README's "factory.yaml" with the effort "high" for the agent "implement" and a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the "plan" session's agent got "medium" as "OSF_EFFORT"
    And the "implement" session's agent got "high" as "OSF_EFFORT"

  @id=SCN-FORE-131 @status=implemented
  Scenario: A factory with changes that are not committed stops the server at the start
    Given the README's "factory.yaml" is committed in the factory's repository
    And "agents/plan.md" has a change that is not committed and "agents/implement.md" is deleted
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: commit the changed files agents/implement.md, agents/plan.md; a run's factory version is its commit"

  @id=SCN-FORE-132 @status=implemented
  Scenario: A run does not start while the factory has changes that are not committed
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends every turn
    And "factory.yaml" gets a change that is not committed
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the answer has the status 400 and a problem that says "commit the changed files factory.yaml"
    And the scripted harness got no session

  @id=SCN-FORE-133 @status=implemented
  Scenario: The run's view names each adapter's version and the fallback's command line
    Given "foreman serve" runs the README's "factory.yaml" with "github" at "^0" under "providers.forge" and no "FOREMAN_FORGES"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the answer's "adapters" holds the harness "acp" at "^0" from "FOREMAN_HARNESSES"
    And it holds the forge "github" at "^0" with the command line "npx -y @opensoftware/forge-github@^0"

  @id=SCN-FORE-134 @status=implemented
  Scenario: An adapter's command line is a JSON list of arguments, and a path may hold a space
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_HARNESSES" naming "acp" as a JSON list whose program is a script in a folder "with space"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the run completes and the scripted harness got a session for "plan" and for "implement"

  @id=SCN-FORE-135 @status=implemented
  Scenario: A prompt that Git does not track counts as a change, and the error lists the paths sorted
    Given the README's "factory.yaml" is committed in the factory's repository without "agents/plan.md"
    And "agents/plan.md" is written but not added, "factory.yaml" has a change and "notes.md" is not tracked
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: commit the changed files agents/plan.md, factory.yaml; a run's factory version is its commit"

  @id=SCN-FORE-136 @status=implemented
  Scenario: Every adapter without a command line runs its package at the factory's range
    Given "foreman serve" runs a factory with "codex" at "^1" under "providers.harness", "docker" at "^2" under "providers.sandbox", "github" at "^0" under "providers.forge" and "litellm" at "^3" under "providers.inference", with no adapter maps and an "npx" that runs the fake adapters
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the answer's "adapters" holds each adapter at its range with the command line "npx -y @opensoftware/<port>-<name>@<range>", and "run" after it for the harness
    And the run completes, and "npx" ran "@opensoftware/inference-litellm@^3", "@opensoftware/sandbox-docker@^2" and "@opensoftware/harness-codex@^1 run"
