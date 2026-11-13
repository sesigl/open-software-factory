@module=foreman @owner=maintainers
Feature: Inference gateway
  A factory that names an inference adapter under "providers.inference" gets one gateway while the foreman serves:
  the foreman starts it from the factory's "inference.config", asks it for one key per run with the run's budget, and
  hands each stage's agent the gateway's URL, the run's key and the agent's model (ADR 0070). The scenarios use the
  testkit's fake inference adapter in place of LiteLLM on Docker.

  @id=SCN-FORE-050 @status=implemented @realizes=SCN-FACTORY-OPEN-003
  Scenario: A stage's agent calls the factory's gateway with the run's key
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm" whose gateway has the URL "http://127.0.0.1:4000/v1"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the "plan" session's agent got "OPENAI_BASE_URL" "http://127.0.0.1:4000/v1" and "ANTHROPIC_BASE_URL" "http://127.0.0.1:4000"
    And it got the run's key as "OPENAI_API_KEY" and as "ANTHROPIC_API_KEY"
    And "/v1/runs/<id>" shows the state "complete"

  @id=SCN-FORE-051 @status=implemented @realizes=SCN-FACTORY-OPEN-001
  Scenario: Each stage's agent calls the gateway with its own model
    Given "foreman serve" runs the README's "gateway/factory.yaml" with the model "routes/strong" for the agent "implement" and a fake inference adapter as "litellm"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the "plan" session's agent got "routes/default" as "OPENAI_MODEL" and as "ANTHROPIC_MODEL"
    And the "implement" session's agent got "routes/strong" as "OPENAI_MODEL" and as "ANTHROPIC_MODEL"

  @id=SCN-FORE-052 @status=implemented
  Scenario: The foreman starts one gateway from the factory's inference config
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm"
    When a program posts two work items to "/v1/runs" and both runs complete
    Then the inference adapter started one gateway from the text of "inference/litellm.yaml"
    And its list shows the gateway "000000000001"

  @id=SCN-FORE-053 @status=implemented
  Scenario: Each run gets its own key with the factory's budget
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm"
    When a program posts two work items to "/v1/runs" and both runs complete
    Then the inference adapter made one key for each run, with the run's ID and the budget "5"
    And both stages of a run got the same key, and the two runs got different keys

  @id=SCN-FORE-054 @status=implemented
  Scenario: A sandboxed stage gets the gateway in its sandbox's environment
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a sandbox "node:24" for the agent "plan", a fake sandbox adapter as "docker" and a fake inference adapter as "litellm"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the spec of the "plan" stage's sandbox sets "OPENAI_BASE_URL", "OPENAI_API_KEY" and "OPENAI_MODEL" to the gateway's URL, the run's key and "routes/default"

  @id=SCN-FORE-055 @status=implemented
  Scenario: The foreman stops the gateway when it stops serving
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm"
    When the server gets the signal SIGTERM
    Then the inference adapter's list is empty

  @id=SCN-FORE-056 @status=deprecated
  Scenario: A gateway that does not start stops the server at the start
    Given the README's "gateway/factory.yaml" with an inference adapter "litellm" that fails every command with "docker is not running"
    When the developer runs "foreman serve"
    Then the command exits with code 1 and names "docker is not running"

  @id=SCN-FORE-057 @status=implemented
  Scenario: A factory with an inference adapter but without its config stops the server at the start
    Given the README's "gateway/factory.yaml" without "inference"
    When the developer runs "foreman serve"
    Then the command exits with code 2 and names "/inference" and "inference.config"

  @id=SCN-FORE-086 @status=implemented @replaces=SCN-FORE-056
  Scenario: Until the factory's gateway starts, the server serves and its health names the failure
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm" whose start fails with "LiteLLM is not ready"
    When a program reads "/v1/health" without a token
    Then the answer is 503 with the check "inference" failing with "LiteLLM is not ready"
    And after the adapter is ready, "/v1/health" answers 200 with the check "inference" ok, and the adapter started one gateway

  @id=SCN-FORE-121 @status=implemented
  Scenario: A run keeps its key and its spent budget when the foreman restarts during a stage
    Given a run of the README's "gateway/factory.yaml" with a fake inference adapter as "litellm", whose stage "implement" runs a turn that waits for "never"
    When the foreman stops and starts again
    Then within 20 seconds the harness received the prompt "Implement plan.md" a second time
    And every turn of the run got the key "sk-fake-1" as "OPENAI_API_KEY"
    And the inference adapter started one gateway and made one key, for the run with the budget "5"

  @id=SCN-FORE-122 @status=implemented
  Scenario: The foreman revokes the run's key when the run completed
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm"
    When a program posts the README's "work.json" to "/v1/runs" with the API token and the run completes
    Then the inference adapter revoked the key of the run once, on the gateway "000000000001"

  @id=SCN-FORE-123 @status=implemented
  Scenario: The foreman revokes the run's key when the run was cancelled
    Given a run of the README's "gateway/factory.yaml" with a fake inference adapter as "litellm", whose stage "implement" runs a turn that waits for "never"
    When a program cancels the run
    Then "/v1/runs/<id>" shows the state "cancelled"
    And the inference adapter revoked the key of the run once

  @id=SCN-FORE-124 @status=implemented
  Scenario: A revoke that fails is a warning and the run completes all the same
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm" whose revoke fails with "LiteLLM is down"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete"
    And the server warned that it could not revoke the run's key, with "LiteLLM is down"

  @id=SCN-FORE-125 @status=implemented
  Scenario: The foreman stops the gateway when it stops serving after every run's key was revoked
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm", and its run of the README's "work.json" completed
    When the server gets the signal SIGTERM
    Then the inference adapter's list is empty
