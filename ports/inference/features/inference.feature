@port=inference @owner=maintainers
Feature: One model endpoint for every harness, with routing, budgets and spend logs
  An inference adapter is a program with the commands start, key, spend-log, stop and list. start runs a gateway
  from the adapter's config and prints its ID and URL. Harnesses call the gateway's OpenAI-compatible chat
  completions API with a routing alias as the model and a key per run; the gateway routes the alias to a model of a
  provider, stops a run at its budget and logs the spend of every call with the run's ID (ADR 0056). The test
  provider is an OpenAI-compatible API at "host.docker.internal" that answers each call with 1000 prompt tokens and
  200 completion tokens. Claude Code calls the Anthropic Messages API and Codex the OpenAI Responses API of the same
  gateway, with the same keys and aliases (ADR 0070); for those, the test provider answers the OpenAI Responses API.

  @id=SCN-INFER-001 @status=implemented @conformance @realizes=SCN-FACTORY-OPEN-004
  Scenario: A call with a routing alias reaches the configured model
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "ft:triage-2026-10"
    When a run calls "routes/triage" with its key
    Then the test provider received a call for the model "ft:triage-2026-10"
    And the run gets the test provider's reply "triaged"

  @id=SCN-INFER-002 @status=implemented @conformance @realizes=SCN-FACTORY-OPEN-001
  Scenario: Each routing alias keeps its own model
    Given a gateway started from a config that routes "routes/triage" to "model-c" and "routes/implement" to "model-b"
    When a run calls "routes/implement" with its key
    Then the test provider received a call for the model "model-b" and none for "model-c"

  @id=SCN-INFER-003 @status=implemented @conformance @realizes=SCN-FACTORY-BENCH-006
  Scenario: A call with a tag goes to the model of the routing rule for that tag
    Given a gateway started from a config like "taskcapture route" writes, which sends "coder" with the tag "front-end" to "glm-5.3-flash"
    When a run calls "coder" with the tag "front-end"
    Then the test provider received a call for the model "glm-5.3-flash"

  @id=SCN-INFER-004 @status=implemented @conformance
  Scenario: A run whose spend passed its budget is stopped with a clear error
    Given a gateway started from a config that prices "routes/triage" at 0.000001 USD per prompt token and 0 per completion token
    And a key for the run "run-7" with the budget 0.0015 USD
    When the run calls "routes/triage" twice, the client runs "spend-log", and the run calls "routes/triage" again
    Then the first two calls get the status 200
    And the third call is refused with the error type "budget_exceeded" and a message that names the budget 0.0015
    And the test provider received two calls

  @id=SCN-INFER-005 @status=implemented @conformance
  Scenario: Every call writes a spend log line with the run's ID
    Given a gateway started from a config that prices "routes/triage" at 0.000001 USD per prompt token and 0 per completion token
    And a key for the run "run-7"
    When the run calls "routes/triage" twice and the client runs "spend-log"
    Then spend-log prints two lines whose "osf.run.id" is "run-7"
    And each line has the spend 0.001 and the model group "routes/triage"

  @id=SCN-INFER-006 @status=implemented @conformance
  Scenario: A call with a key the gateway did not give is refused
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When a client calls "routes/triage" with the key "sk-unknown"
    Then the call gets the status 401
    And the test provider received no call

  @id=SCN-INFER-007 @status=implemented @conformance
  Scenario: A call for an alias the config does not route is refused with its name
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When a run calls "routes/review" with its key
    Then the call gets the status 400 with an error that names "routes/review"
    And the test provider received no call

  @id=SCN-INFER-008 @status=implemented @conformance @realizes=SCN-FACTORY-OPEN-003
  Scenario: The provider key comes from the adapter's environment, never from the config
    Given a gateway started with "OSF_SECRET_COMPANY_GATEWAY_KEY" set to "gw_real_51c2" from a config that routes "routes/triage" to the company gateway with the key "os.environ/OSF_SECRET_COMPANY_GATEWAY_KEY"
    When a run calls "routes/triage" with its key
    Then the company gateway received the call with the header "authorization" "Bearer gw_real_51c2"

  @id=SCN-INFER-009 @status=implemented @conformance
  Scenario: stop removes the gateway and its spend log
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When the client stops the gateway
    Then list does not print the gateway's ID
    And spend-log for the gateway's ID exits with code 1 with the error "no gateway" and the ID

  @id=SCN-INFER-010 @status=implemented @conformance
  Scenario: key refuses a budget that is not an amount
    When the client runs "key 0123456789ab run-7 --budget ten"
    Then key exits with code 2 and prints "--budget takes an amount in USD"

  @id=SCN-INFER-011 @status=implemented @conformance
  Scenario: A gateway that does not start is removed with the reason
    Given a config whose "model_list" is the text "not-a-list"
    When the client runs "start" with the config
    Then start exits with code 1 and names the gateway that "did not start and was removed"
    And list does not print that gateway's ID

  @id=SCN-INFER-012 @status=implemented @conformance
  Scenario: A Messages API call with a routing alias reaches the configured model
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "ft:triage-2026-10"
    When a run calls the Messages API at the gateway's URL without "/v1" with "routes/triage" and its key as "x-api-key"
    Then the test provider received a call for the model "ft:triage-2026-10"
    And the run gets a Messages answer with the text "triaged"
    And the same call with the key "sk-unknown" gets the status 401

  @id=SCN-INFER-013 @status=implemented @conformance
  Scenario: A Responses API call with a routing alias reaches the configured model
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "ft:triage-2026-10"
    When a run calls the Responses API at the gateway's URL with "routes/triage" and its key
    Then the test provider received a call for the model "ft:triage-2026-10"
    And the run gets a Responses answer with the output text "triaged"
    And the same call with the key "sk-unknown" gets the status 401
