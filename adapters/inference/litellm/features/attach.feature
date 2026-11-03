@module=inference-litellm @owner=maintainers
Feature: Attach to a LiteLLM proxy that already runs
  inference-litellm passes the inference port's scenarios in ports/inference/features/. These scenarios cover what
  only this adapter does. A config whose top level has "osf.proxy" names a LiteLLM proxy that already runs, such as
  the "litellm" service of the Compose profile, and the variable that holds its master key. start then attaches to
  that proxy and starts no container (ADR 0080). The running LiteLLM proxy is LiteLLM with PostgreSQL in a Compose
  project of the test, with the master key "sk-testkit-master". Its config routes "routes/triage" to the test
  provider's model "model-c". The test provider is an OpenAI-compatible API at "host.docker.internal". The test proxy
  is a fake of LiteLLM's key list ("/key/list") on 127.0.0.1.

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
