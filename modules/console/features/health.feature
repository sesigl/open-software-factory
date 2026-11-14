@module=console @owner=maintainers
Feature: Health
  "console doctor" and the page "/health" check each server of the factory, its token and the factory definition,
  and say what to do for each failure (ADR 0086).

  @id=SCN-CONSOLE-037 @status=implemented
  Scenario: A healthy factory passes every check of "console doctor"
    Given a foreman, an intake and a gatekeeper whose "/v1/health" is ok and that accept their tokens
    And the factory definition with the agent "triage"
    When the user runs "console doctor"
    Then the command exits with code 0
    And it prints "ok" for "foreman temporal", "foreman token", "intake database", "intake token", "gatekeeper opa", "gatekeeper token" and "factory", then "all 7 checks ok"

  @id=SCN-CONSOLE-038 @status=implemented
  Scenario: "console doctor" names each failing check and what to do
    Given a foreman that refuses the console's token
    And an intake whose "/v1/health" answers 503 with the check "nats" failing with "the durable consumer of the run events is not attached: check INTAKE_NATS_URL"
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  foreman token: foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"
    And it prints "FAIL  intake nats: the durable consumer of the run events is not attached: check INTAKE_NATS_URL"

  @id=SCN-CONSOLE-039 @status=implemented
  Scenario: A foreman that does not answer is named with the variable of its URL
    Given "CONSOLE_FOREMAN_URL" names a port where nothing listens
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  foreman: no answer at <URL>: check CONSOLE_FOREMAN_URL and that foreman runs"

  @id=SCN-CONSOLE-040 @status=implemented
  Scenario: The page "/health" shows the checks and answers 503 when one fails
    Given a foreman that refuses the console's token
    When a person opens "/health"
    Then the page answers 503
    And its table has the row "foreman token", "failing", "foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"
    And the page's navigation links "/health"

  @id=SCN-CONSOLE-048 @status=implemented
  Scenario: "console doctor" names a missing foreman URL, a server without "/v1/health" and a factory it cannot read
    Given a console without "CONSOLE_FOREMAN_URL"
    And an intake whose "/v1/health" answers 404
    And "CONSOLE_FACTORY" names a file that does not exist
    When the user runs "console doctor"
    Then it prints "FAIL  foreman: set CONSOLE_FOREMAN_URL to the base URL of the foreman's API"
    And it prints "FAIL  intake: <URL>/v1/health answered 404: update intake to a release with /v1/health"
    And it prints "FAIL  factory: ENOENT: no such file or directory, open '<file>': check CONSOLE_FACTORY"

  @id=SCN-CONSOLE-056 @status=implemented
  Scenario: "console doctor" fails on a group whose only member is the example's
    Given "CONSOLE_GROUPS" names a groups file whose group "maintainers" has only the example's member "slack:U0EXAMPLE" and whose group "leads" has "slack:U0LEO"
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  groups: \"maintainers\" has no member but the example's slack:U0EXAMPLE: put its people in <file>"
    And it prints no line about the group "leads"

  @id=SCN-CONSOLE-059 @status=implemented
  Scenario: "console doctor" fails on a groups file it cannot read
    Given "CONSOLE_GROUPS" names a file that does not exist
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  groups: ENOENT: no such file or directory, open '<file>': check CONSOLE_GROUPS"

  @id=SCN-CONSOLE-064 @status=implemented
  Scenario: "console doctor --deep" calls each model route once and asks the harness to initialize
    Given a foreman whose "/v1/health" is ok and that accepts its token
    And the factory definition with the agent "triage" on the route "routes/triage"
    And a model gateway in "CONSOLE_MODEL_URL" that answers a call to "routes/triage"
    And a harness in "CONSOLE_HARNESS_COMMAND" that speaks ACP
    When the user runs "console doctor --deep"
    Then the command exits with code 0
    And it prints "ok    model routes/triage" and "ok    harness"
    And the gateway received one call, for the model "routes/triage"

  @id=SCN-CONSOLE-065 @status=implemented
  Scenario: "console doctor --deep" names a failing model route and a harness that answers "initialize" with an error
    Given the factory definition with the agent "triage" on the route "routes/triage"
    And a model gateway in "CONSOLE_MODEL_URL" that answers 500 to every call
    And "CONSOLE_HARNESS_COMMAND" is a command that answers ACP initialize with an error
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  model routes/triage: the gateway answered 500: check the route in the gateway's config and its provider key"
    And it prints "FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND"

  @id=SCN-CONSOLE-066 @status=implemented
  Scenario: "console doctor" without "--deep" calls no model
    Given the factory definition with the agent "triage" on the route "routes/triage"
    And a model gateway in "CONSOLE_MODEL_URL"
    When the user runs "console doctor"
    Then it prints no line about a model route or the harness
    And the gateway received no call

  @id=SCN-CONSOLE-067 @status=implemented
  Scenario: "console doctor --deep" names the variables of the gateway and the harness when they are not set
    Given a console without "CONSOLE_MODEL_URL" and "CONSOLE_HARNESS_COMMAND"
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  model: set CONSOLE_MODEL_URL to the gateway's base URL"
    And it prints "FAIL  harness: set CONSOLE_HARNESS_COMMAND to the command that starts the harness"

  @id=SCN-CONSOLE-068 @status=implemented
  Scenario: "console doctor --deep" names a gateway that does not answer and a harness that ends without a word
    Given the factory definition with the agent "triage" on the route "routes/triage"
    And "CONSOLE_MODEL_URL" names a port where nothing listens
    And "CONSOLE_HARNESS_COMMAND" is a command that exits without a word
    When the user runs "console doctor --deep"
    Then it prints "FAIL  model routes/triage: no answer: check CONSOLE_MODEL_URL and that the gateway runs"
    And it prints "FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND"

  @id=SCN-CONSOLE-069 @status=implemented
  Scenario: The page "/health" calls no model
    Given the factory definition with the agent "triage" on the route "routes/triage"
    And a model gateway in "CONSOLE_MODEL_URL"
    When a person opens "/health"
    Then its table has no row about a model route or the harness
    And the gateway received no call

  @id=SCN-CONSOLE-100 @status=implemented
  Scenario: "console doctor --deep" sends one span to the collector and finds it in the trace store
    Given a trace store that takes OTLP at "CONSOLE_OTLP_URL" and answers Jaeger's query API at "CONSOLE_TRACES_URL"
    When the user runs "console doctor --deep"
    Then it prints "ok    traces"
    And the trace store received one span "console doctor" of the service "console"
    And the console asked the trace store for that span's trace

  @id=SCN-CONSOLE-101 @status=implemented
  Scenario: "console doctor --deep" names the path from the collector to the trace store when the span does not arrive
    Given a collector at "CONSOLE_OTLP_URL" that takes the span but whose trace store at "CONSOLE_TRACES_URL" keeps none
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  traces: the span did not reach the trace store in 5 s: check the collector's exporter and CONSOLE_TRACES_URL"

  @id=SCN-CONSOLE-102 @status=implemented
  Scenario: "console doctor --deep" names CONSOLE_OTLP_URL when no collector answers there
    Given "CONSOLE_OTLP_URL" names a port where nothing listens and "CONSOLE_TRACES_URL" names a trace store
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  traces: no collector took the span: check CONSOLE_OTLP_URL and that the collector runs"

  @id=SCN-CONSOLE-120 @status=implemented
  Scenario: "console doctor --deep" asks the sandbox adapter to probe a denied host and finds it refused
    Given a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" whose probe finds the denied host refused
    And "CONSOLE_SANDBOX_TEMPLATE" is "alpine:3"
    When the user runs "console doctor --deep"
    Then it prints "ok    sandbox"
    And the adapter ran one probe of the template "alpine:3" for the host "example.com" and left no sandbox

  @id=SCN-CONSOLE-121 @status=implemented
  Scenario: "console doctor --deep" names the egress proxy when a sandbox reaches the denied host
    Given a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" whose probe reaches the denied host
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  sandbox: a sandbox reached example.com, which its egress does not allow: check the egress proxy of the sandbox adapter"
    And the adapter probed the default template "curlimages/curl:8.17.0"

  @id=SCN-CONSOLE-122 @status=implemented
  Scenario: "console doctor --deep" names the adapter's reason and the variables when no sandbox starts
    Given a sandbox adapter in "CONSOLE_SANDBOX_COMMAND" that has only the template "alpine:3"
    And "CONSOLE_SANDBOX_TEMPLATE" is "node:24"
    When the user runs "console doctor --deep"
    Then the command exits with code 1
    And it prints "FAIL  sandbox: no template node:24: check CONSOLE_SANDBOX_COMMAND and CONSOLE_SANDBOX_TEMPLATE"

  @id=SCN-CONSOLE-123 @status=implemented
  Scenario: "console doctor --deep" without "CONSOLE_SANDBOX_COMMAND" skips the sandbox
    Given a console without "CONSOLE_SANDBOX_COMMAND"
    When the user runs "console doctor --deep"
    Then it prints no line about the sandbox
