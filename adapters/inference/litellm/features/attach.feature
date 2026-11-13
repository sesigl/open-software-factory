@module=inference-litellm @owner=maintainers
Feature: Attach to a LiteLLM proxy that already runs
  inference-litellm passes the inference port's scenarios in ports/inference/features/. These scenarios cover what
  only this adapter does. A config whose top level has "osf.proxy" names a LiteLLM proxy that already runs, such as
  the "litellm" service of the Compose profile, and the variable that holds its master key. start then attaches to
  that proxy and starts no container (ADR 0080). The running LiteLLM proxy is LiteLLM with PostgreSQL in a Compose
  project of the test, with the master key "sk-testkit-master". Its config routes "routes/triage" to the test
  provider's model "model-c". The test provider is an OpenAI-compatible API at "host.docker.internal". The test proxy
  is a fake of LiteLLM's admin API on 127.0.0.1: it answers only the paths that a scenario names. The scenarios from
  SCN-INFLITE-006 on cover the usage of the CLI and the errors of its commands.

  @id=SCN-INFLITE-001 @status=implemented
  Scenario: start attaches to a running proxy without Docker
    Given a test proxy that answers "/key/list" with the status 200
    When the client runs "start" with "DOCKER_HOST" set to "unix:///nonexistent/docker.sock", "OSF_SECRET_PROXY_MASTER_KEY" set to "sk-testkit-master" and a config whose "osf.proxy" names the test proxy's URL and "os.environ/OSF_SECRET_PROXY_MASTER_KEY"
    Then start prints an ID of 12 hex digits and the test proxy's URL with "/v1" at the end
    And the test proxy received "/key/list" with the header "authorization" "Bearer sk-testkit-master"
    And list prints the ID

  @id=SCN-INFLITE-002 @status=implemented
  Scenario: The spend log of an attached gateway has only the calls of its own keys
    Given a gateway attached to the running LiteLLM proxy
    And a key for the run "run-7"
    When the run calls "routes/triage", a client calls "routes/triage" with the proxy's master key, and the client runs "spend-log"
    Then the test provider received two calls for the model "model-c"
    And spend-log prints one line whose "osf.run.id" is "run-7"

  @id=SCN-INFLITE-003 @status=implemented
  Scenario: stop deletes the keys of an attached gateway and leaves the proxy running
    Given a gateway attached to the running LiteLLM proxy
    And a key for the run "run-7"
    When the client stops the gateway
    Then a call of the run to "routes/triage" gets the status 401
    And a call to "routes/triage" with the proxy's master key gets the status 200
    And list does not print the gateway's ID

  @id=SCN-INFLITE-004 @status=implemented
  Scenario: start refuses a master key variable outside "OSF_SECRET_"
    When the client runs "start" with a config whose "osf.proxy" names "http://127.0.0.1:4000" and "os.environ/LITELLM_MASTER_KEY"
    Then start exits with code 2 with an error that names "os.environ/OSF_SECRET_<NAME>"
    And start prints nothing on standard output

  @id=SCN-INFLITE-005 @status=implemented
  Scenario: start refuses a proxy that does not accept the master key
    Given a test proxy that answers "/key/list" with the status 401
    When the client runs "start" with a config whose "osf.proxy" names the test proxy's URL
    Then start exits with code 1 with an error that names the status 401
    And start prints nothing on standard output

  @id=SCN-INFLITE-006 @status=implemented
  Scenario: Without a command the CLI prints its usage
    When the client runs "inference-litellm" without a command
    Then it exits with code 2 and prints "Usage: inference-litellm <command>" and the commands on standard error
    And it prints nothing on standard output

  @id=SCN-INFLITE-007 @status=implemented
  Scenario: key, spend-log and stop refuse an ID that is not 12 hex digits
    When the client runs "key 0123456789a run-7", "spend-log x0123456789ab" and "stop 0123456789abx"
    Then each exits with code 2 with the error "inference-litellm: name a gateway by the 12 hex digits start printed"

  @id=SCN-INFLITE-008 @status=implemented
  Scenario: key refuses a call without a run ID
    When the client runs "key 0123456789ab"
    Then key exits with code 2 with the error "inference-litellm: name the run, like key <ID> run-7"

  @id=SCN-INFLITE-009 @status=implemented
  Scenario: start refuses an "osf.proxy" without a URL
    When the client runs "start" with a config whose "osf.proxy" names only "os.environ/OSF_SECRET_PROXY_MASTER_KEY"
    Then start exits with code 2 with an error that names "osf.proxy.url"
    And start prints nothing on standard output

  @id=SCN-INFLITE-010 @status=implemented
  Scenario: start refuses a master key reference with more text after the variable's name
    When the client runs "start" with a config whose "osf.proxy" names "http://127.0.0.1:4000" and "os.environ/OSF_SECRET_PROXY_MASTER_KEY-2"
    Then start exits with code 2 with an error that names "os.environ/OSF_SECRET_<NAME>"
    And start prints nothing on standard output

  @id=SCN-INFLITE-011 @status=implemented
  Scenario: start refuses to attach when the master key's variable is not set
    When the client runs "start" without "OSF_SECRET_PROXY_MASTER_KEY" and a config whose "osf.proxy" names "http://127.0.0.1:4000" and "os.environ/OSF_SECRET_PROXY_MASTER_KEY"
    Then start exits with code 2 with the error "inference-litellm: set OSF_SECRET_PROXY_MASTER_KEY to the master key of the proxy at http://127.0.0.1:4000"
    And start prints nothing on standard output

  @id=SCN-INFLITE-012 @status=deprecated
  Scenario: stop deletes the run key that key made with the budget 0 on an attached gateway
    Given a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"
    And a gateway attached to the test proxy
    When the client runs "key" for the run "run-7" with "--budget 0", and then "stop" for the gateway
    Then key prints "sk-run-7"
    And the test proxy received "/key/generate" as JSON with "max_budget" 0 and the "osf.run.id" "run-7" in "metadata.spend_logs_metadata"
    And the test proxy received "/key/delete" with the keys "token-7" only
    And stop prints "stopped" and the gateway's ID
    And list does not print the gateway's ID

  @id=SCN-INFLITE-013 @status=implemented
  Scenario: stop of an attached gateway without run keys deletes no key
    Given a test proxy that answers "/key/list" with the status 200
    And a gateway attached to the test proxy
    When the client stops the gateway
    Then stop exits with code 0 and prints "stopped" and the gateway's ID
    And the test proxy received no request after "/key/list"
    And list does not print the gateway's ID

  @id=SCN-INFLITE-014 @status=implemented
  Scenario: stop refuses an ID that no gateway has
    When the client runs "stop 000000000000"
    Then stop exits with code 1 with the error "inference-litellm: no gateway 000000000000"

  @id=SCN-INFLITE-015 @status=implemented
  Scenario: list prints each gateway's ID once, in order, and only the gateways of its data folder
    Given a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"
    And two gateways attached to the test proxy, and a key of the first one for the run "run-7"
    When the client runs "list", and "list" with "OSF_DATA" set to a folder that does not exist
    Then each line of the first list is an ID of 12 hex digits, the lines are in order, and each ID is there once
    And the first list has the IDs of both gateways
    And each line of the second list is an ID of 12 hex digits, and neither of the two IDs is there

  @id=SCN-INFLITE-016 @status=implemented
  Scenario: A command that Docker cannot do shows Docker's own message
    When the client runs "list" with "DOCKER_HOST" set to "unix:///nonexistent/docker.sock"
    Then list exits with code 1 and prints one line on standard error
    And the line starts with "inference-litellm: docker ps: ", names "/nonexistent/docker.sock" and does not have the text "Command failed"

  @id=SCN-INFLITE-018 @status=implemented
  Scenario: revoke refuses a call without a run ID
    When the client runs "revoke 0123456789ab"
    Then revoke exits with code 2 with the error "inference-litellm: name the run, like revoke <ID> run-7"

  @id=SCN-INFLITE-019 @status=implemented
  Scenario: revoke deletes only its run's key of an attached gateway, and stop does not delete it again
    Given a test proxy that answers "/key/list", "/key/generate" with the token "token-7" and then "token-8", and "/key/delete"
    And a gateway attached to the test proxy, with a key for the run "run-7" and one for the run "run-8"
    When the client runs "revoke" for the run "run-7", "revoke" for the run "run-9" without a key, and then "stop" for the gateway
    Then each exits with code 0 and prints nothing but the line of stop
    And the test proxy received "/key/generate" with a different "key" for each run
    And the test proxy received "/key/delete" with the keys "token-7", and then with the keys "token-8"

  @id=SCN-INFLITE-020 @status=implemented @replaces=SCN-INFLITE-012
  Scenario: key makes the run key of an attached gateway with a key and an alias of the run, and stop deletes it
    Given a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"
    And a gateway attached to the test proxy
    When the client runs "key" for the run "run-7" with "--budget 0", and then "stop" for the gateway
    Then key prints "sk-run-7"
    And the test proxy received "/key/generate" as JSON with "max_budget" 0, the "osf.run.id" "run-7" in "metadata.spend_logs_metadata", the "key_alias" "osf-run-<ID>-run-7" and a "key" of "sk-osf-run-" and 48 hex digits
    And the test proxy received "/key/delete" with the keys "token-7" only
    And stop prints "stopped" and the gateway's ID
    And list does not print the gateway's ID

  @id=SCN-INFLITE-021 @status=implemented
  Scenario: key fails with LiteLLM's message when the proxy refuses the key for another reason than its alias
    Given a test proxy that answers "/key/list", and "/key/generate" with the status 400 and the error "max_budget must be a number" for "max_budget"
    And a gateway attached to the test proxy
    When the client runs "key" for the run "run-7"
    Then key exits with code 1 with an error that names "/key/generate", the status 400 and "max_budget must be a number"
    And key prints nothing on standard output

  @id=SCN-INFLITE-022 @status=implemented
  Scenario: spend-log of an attached gateway keeps the calls of a run whose key revoke deleted
    Given a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", "/key/delete", and "/spend/logs" with a call of "token-7" and one of "token-other"
    And a gateway attached to the test proxy, and a key of it for the run "run-7"
    When the client runs "revoke" for the run "run-7", and then "spend-log" for the gateway
    Then spend-log prints one line, whose "api_key" is "token-7"
