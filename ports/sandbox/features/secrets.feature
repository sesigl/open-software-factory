@port=sandbox @owner=maintainers
Feature: Secrets from the adapter's environment and from OpenBao
  A sandbox spec names each secret by reference. Besides "ref:file/<name>", every sandbox adapter resolves
  "ref:env/<NAME>", the adapter's variable OSF_SECRET_<NAME>, and "ref:openbao/<path>", the field "value" of a KV
  secret in OpenBao. The egress proxy gets the value or the means to fetch it; the sandbox gets a placeholder only
  (ADR 0055). The test template is an image with a shell and curl.

  @id=SCN-SANDBOX-016 @status=planned @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from the adapter's environment reaches the API through the egress proxy
    Given the adapter's variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    When the client runs "curl -H 'Authorization: Bearer $LINEAR_TOKEN'" for "/viewer" of the API in the sandbox
    Then the API received "GET /viewer" with the header "Authorization: Bearer lin_env_51c2"

  @id=SCN-SANDBOX-017 @status=planned @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from the adapter's environment never enters the sandbox
    Given the adapter's variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"
    And a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    When the client runs "env" in the sandbox
    Then the output has the variable "LINEAR_TOKEN"
    And the output does not contain "lin_env_51c2"

  @id=SCN-SANDBOX-018 @status=planned @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A secret from OpenBao reaches the API through the egress proxy
    Given OpenBao at "host.docker.internal" that holds "linear-token" with the value "bao_real_93d1" for the token "osf-test-bao-token"
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "curl -H 'Authorization: Bearer $LINEAR_TOKEN'" for "/viewer" of the API in the sandbox
    Then the API received "GET /viewer" with the header "Authorization: Bearer bao_real_93d1"
    And OpenBao received a read of "secret/data/linear-token" with the token "osf-test-bao-token"

  @id=SCN-SANDBOX-019 @status=planned @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: The OpenBao token never enters the sandbox
    Given OpenBao at "host.docker.internal" that holds "linear-token" with the value "bao_real_93d1" for the token "osf-test-bao-token"
    And a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "env" in the sandbox
    Then the output does not contain "osf-test-bao-token"
    And the output does not contain "bao_real_93d1"

  @id=SCN-SANDBOX-020 @status=planned @conformance
  Scenario: A secret from an unset variable is refused before the sandbox starts
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    And the adapter has no variable "OSF_SECRET_LINEAR_TOKEN"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" needs the variable "OSF_SECRET_LINEAR_TOKEN"

  @id=SCN-SANDBOX-021 @status=planned @conformance
  Scenario: A secret from OpenBao without an OpenBao address is refused before the sandbox starts
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    And the adapter has no variable "OSF_OPENBAO_ADDR"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"

  @id=SCN-SANDBOX-022 @status=planned @conformance @replaces=SCN-SDOCKER-002
  Scenario: A secret from a provider no sandbox adapter knows is refused
    Given a sandbox spec with the test template and the secret "LINEAR_TOKEN" from "ref:vault/linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the provider "vault" is not supported
