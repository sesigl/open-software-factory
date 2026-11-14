@port=sandbox @owner=maintainers
Feature: Secrets from the adapter's environment and from OpenBao
  A sandbox spec names each secret by reference. Besides "ref:file/<name>", every sandbox adapter resolves
  "ref:env/<NAME>", the adapter's variable OSF_SECRET_<NAME>, and "ref:openbao/<path>", the field "value" of a KV
  secret in OpenBao. The egress proxy gets the value or the means to fetch it; the sandbox gets a placeholder only
  (ADR 0055). The test template is an image with a shell and curl. "OpenBao for containers" is the testkit's real
  OpenBao with a mount of the scenario, which the egress proxy reaches at "host.docker.internal" (ADR 0139).

  @id=SCN-SANDBOX-016 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from the adapter's environment reaches the API through the egress proxy
    Given the adapter's variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    When the client runs "curl -H 'Authorization: Bearer $LINEAR_TOKEN'" for "/viewer" of the API in the sandbox
    Then the API received "GET /viewer" with the header "Authorization: Bearer lin_env_51c2"

  @id=SCN-SANDBOX-017 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from the adapter's environment never enters the sandbox
    Given the adapter's variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"
    And a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    When the client runs "env" in the sandbox
    Then the output has the variable "LINEAR_TOKEN"
    And the output does not contain "lin_env_51c2"

  @id=SCN-SANDBOX-018 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from OpenBao reaches the API through the egress proxy
    Given OpenBao at "host.docker.internal" that holds "linear-token" with the value "bao_real_93d1" for the token "osf-test-bao-token"
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "curl -H 'Authorization: Bearer $LINEAR_TOKEN'" for "/viewer" of the API in the sandbox
    Then the API received "GET /viewer" with the header "Authorization: Bearer bao_real_93d1"
    And OpenBao received a read of "secret/data/linear-token" with the token "osf-test-bao-token"

  @id=SCN-SANDBOX-019 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: The OpenBao token never enters the sandbox
    Given OpenBao at "host.docker.internal" that holds "linear-token" with the value "bao_real_93d1" for the token "osf-test-bao-token"
    And a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "env" in the sandbox
    Then the output does not contain "osf-test-bao-token"
    And the output does not contain "bao_real_93d1"

  @id=SCN-SANDBOX-020 @status=implemented @conformance
  Scenario: A secret from an unset variable is refused before the sandbox starts
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    And the adapter has no variable "OSF_SECRET_LINEAR_TOKEN"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" needs the variable "OSF_SECRET_LINEAR_TOKEN"

  @id=SCN-SANDBOX-021 @status=implemented @conformance
  Scenario: A secret from OpenBao without an OpenBao address is refused before the sandbox starts
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    And the adapter has no variable "OSF_OPENBAO_ADDR"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"

  @id=SCN-SANDBOX-022 @status=implemented @conformance @replaces=SCN-SDOCKER-002
  Scenario: A secret from a provider no sandbox adapter knows is refused
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:vault/linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the provider "vault" is not supported

  @id=SCN-SANDBOX-028 @status=planned @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: git's Basic credentials with the placeholder of a secret from OpenBao reach the API with the real secret
    Given OpenBao for containers that holds "forge-token" with the value "bao_forge_7c41", and its read token
    And an API at "host.docker.internal" that answers "GET /info/refs"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "GH_TOKEN" from "ref:openbao/forge-token"
    When the client runs "curl -u x-access-token:$GH_TOKEN", as git sends a token, for "/info/refs" of the API in the sandbox
    Then the API received "GET /info/refs" with the header "Authorization: Basic " and base64 of "x-access-token:bao_forge_7c41"

  @id=SCN-SANDBOX-029 @status=planned @conformance
  Scenario: A sandbox keeps the value from OpenBao that it sent first, and a sandbox created after a change sends the new value
    Given OpenBao for containers that holds "forge-token" with the value "bao_old_1d2e", and its read token
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "GH_TOKEN" from "ref:openbao/forge-token", which sent "curl -H 'Authorization: Bearer $GH_TOKEN'" for "/viewer" of the API
    And another client then stored the value "bao_new_8f3a" for "forge-token" in OpenBao
    When the client runs the same curl in that sandbox and in a second sandbox created from the same spec
    Then the API received "Authorization: Bearer bao_old_1d2e" twice, from the first sandbox, and then "Authorization: Bearer bao_new_8f3a" from the second
