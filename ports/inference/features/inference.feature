@port=inference @owner=maintainers
Feature: One model endpoint for every harness, with routing, budgets and spend logs
  An inference adapter is a program with the commands start, key, spend-log, stop and list. start runs a gateway
  from the adapter's config and prints its ID and URL. Harnesses call the gateway's OpenAI-compatible chat
  completions API with a routing alias as the model and a key per run; the gateway routes the alias to a model of a
  provider, stops a run at its budget and logs the spend of every call with the run's ID (ADR 0056). The test
  provider is an OpenAI-compatible API at "host.docker.internal" that answers each call with 1000 prompt tokens and
  200 completion tokens.

  @id=SCN-INFER-001 @status=planned @conformance @realizes=SCN-FACTORY-OPEN-004
  Scenario: A call with a routing alias reaches the configured model
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "ft:triage-2026-10"
    When a run calls "routes/triage" with its key
    Then the test provider received a call for the model "ft:triage-2026-10"
    And the run gets the test provider's reply "triaged"

  @id=SCN-INFER-002 @status=planned @conformance @realizes=SCN-FACTORY-OPEN-001
  Scenario: Each routing alias keeps its own model
    Given a gateway started from a config that routes "routes/triage" to "model-c" and "routes/implement" to "model-b"
    When a run calls "routes/implement" with its key
    Then the test provider received a call for the model "model-b" and none for "model-c"

  @id=SCN-INFER-003 @status=planned @conformance @realizes=SCN-FACTORY-BENCH-006
  Scenario: A call with a tag goes to the model of the routing rule for that tag
    Given a gateway started from a config like "taskcapture route" writes, which sends "coder" with the tag "front-end" to "glm-5.3-flash"
    When a run calls "coder" with the tag "front-end"
    Then the test provider received a call for the model "glm-5.3-flash"

  @id=SCN-INFER-004 @status=planned @conformance
  Scenario: A run over its budget is stopped with a clear error
    Given a gateway started from a config that prices "routes/triage" at 0.000001 USD per prompt token and 0 per completion token
    And a key for the run "run-7" with the budget 0.0015 USD
    When the run calls "routes/triage" three times
    Then the first two calls get the status 200
    And the third call gets the status 400 with an error that names the budget 0.0015
    And the test provider received two calls

  @id=SCN-INFER-005 @status=planned @conformance
  Scenario: Every call writes a spend log line with the run's ID
    Given a gateway started from a config that prices "routes/triage" at 0.000001 USD per prompt token and 0 per completion token
    And a key for the run "run-7"
    When the run calls "routes/triage" twice and the client runs "spend-log"
    Then spend-log prints two lines whose "osf.run.id" is "run-7"
    And each line has the spend 0.001 and the model group "routes/triage"

  @id=SCN-INFER-006 @status=planned @conformance
  Scenario: A call with a key the gateway did not give is refused
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When a client calls "routes/triage" with the key "sk-unknown"
    Then the call gets the status 401
    And the test provider received no call

  @id=SCN-INFER-007 @status=planned @conformance
  Scenario: A call for an alias the config does not route is refused with its name
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When a run calls "routes/review" with its key
    Then the call gets the status 400 with an error that names "routes/review"
    And the test provider received no call

  @id=SCN-INFER-008 @status=planned @conformance @realizes=SCN-FACTORY-OPEN-003
  Scenario: The provider key comes from the adapter's environment, never from the config
    Given a gateway started with "COMPANY_GATEWAY_KEY" set to "gw_real_51c2" from a config that routes "routes/triage" to the company gateway with the key "os.environ/COMPANY_GATEWAY_KEY"
    When a run calls "routes/triage" with its key
    Then the company gateway received the call with the header "authorization" "Bearer gw_real_51c2"

  @id=SCN-INFER-009 @status=planned @conformance
  Scenario: stop removes the gateway and its spend log
    Given a gateway started from a config that routes "routes/triage" to the test provider's model "model-c"
    When the client stops the gateway
    Then list does not print the gateway's ID
    And spend-log for the gateway's ID exits with code 1 with the error "no gateway" and the ID
