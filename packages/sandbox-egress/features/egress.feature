@module=sandbox-egress @owner=maintainers
Feature: What every sandbox adapter shares about the egress proxy
  The sandbox-egress library turns a sandbox spec into what a sandbox adapter starts: iron-proxy's configuration and
  variables, the sandbox's environment, and the secrets it resolves. It also reads the spec and turns iron-proxy's
  audit lines into the egress log (ADR 0054, ADR 0055).

  @id=SCN-SEGRESS-001 @status=planned
  Scenario: The proxy configuration allows the egress hosts and the hosts of the MCP servers
    Given a sandbox spec with the egress allowlist "api.linear.app" and the MCP server "wiki" at "https://wiki.example.com/mcp"
    When the adapter calls proxyConfig with the spec
    Then the allowlist of the configuration is "api.linear.app" and "wiki.example.com"

  @id=SCN-SEGRESS-002 @status=planned
  Scenario: A secret is swapped only for the hosts of the egress allowlist
    Given a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"
    When the adapter calls proxyConfig with the spec and its resolved secrets
    Then the configuration swaps "osf-secret-placeholder-LINEAR_TOKEN" for the file "/osf/secrets/LINEAR_TOKEN" on requests to "api.linear.app"

  @id=SCN-SEGRESS-003 @status=planned
  Scenario: Without an egress allowlist no secret is swapped
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and no egress allowlist
    When the adapter calls proxyConfig with the spec and its resolved secrets
    Then the configuration has no secrets transform

  @id=SCN-SEGRESS-004 @status=planned
  Scenario: A secret from the environment is read by the proxy from a variable of its own
    Given a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN"
    And the adapter's variable "OSF_SECRET_LINEAR_TOKEN" with the value "lin_env_51c2"
    When the adapter resolves the secrets and calls proxyConfig and proxyEnv
    Then the configuration swaps the placeholder for the proxy's variable "LINEAR_TOKEN"
    And proxyEnv gives the proxy the variable "LINEAR_TOKEN" with the value "lin_env_51c2"

  @id=SCN-SEGRESS-005 @status=planned
  Scenario: A secret from OpenBao is read by the proxy with the adapter's OpenBao address and token
    Given a sandbox spec with the egress allowlist "api.linear.app" and the secret "LINEAR_TOKEN" from "ref:openbao/teams/linear-token"
    And the adapter's variables "OSF_OPENBAO_ADDR" "http://bao:8200" and "OSF_OPENBAO_TOKEN" "osf-test-bao-token"
    When the adapter resolves the secrets and calls proxyConfig and proxyEnv
    Then the configuration swaps the placeholder for the field "value" of "teams/linear-token" in the KV mount "secret"
    And proxyEnv gives the proxy "VAULT_ADDR" "http://bao:8200" and "VAULT_TOKEN" "osf-test-bao-token"

  @id=SCN-SEGRESS-006 @status=planned
  Scenario: The proxy configuration allows only the declared tools of a declared MCP server
    Given a sandbox spec with the MCP server "wiki" at "https://wiki.example.com/mcp" and the tool "search"
    When the adapter calls proxyConfig with the spec
    Then the MCP policy of the configuration allows the server "wiki" at "wiki.example.com" the tool "search" only

  @id=SCN-SEGRESS-007 @status=planned
  Scenario: The sandbox's environment holds the spec's variables, the placeholders and the proxy
    Given a sandbox spec with the variable "CI" set to "true" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"
    When the adapter calls sandboxEnv with the spec and the proxy URL "http://egress:8080"
    Then the environment has "CI" "true" and "LINEAR_TOKEN" "osf-secret-placeholder-LINEAR_TOKEN"
    And "HTTPS_PROXY" is "http://egress:8080" and "SSL_CERT_FILE" is "/etc/osf/egress-ca.crt"

  @id=SCN-SEGRESS-008 @status=planned
  Scenario: The egress log names the host that the allowlist refused
    Given an iron-proxy audit line of a GET to "api.example.invalid:443" "/" rejected by "allowlist"
    When the adapter calls egressEntries with the log
    Then the entry is a request to "api.example.invalid" "/" refused by "allowlist"

  @id=SCN-SEGRESS-009 @status=planned
  Scenario: The egress log names the secrets the proxy put in, never their values
    Given an iron-proxy audit line of an allowed GET to "/viewer" that swapped "LINEAR_TOKEN"
    When the adapter calls egressEntries with the log
    Then the entry is an allowed request to "/viewer" with the secret "LINEAR_TOKEN"

  @id=SCN-SEGRESS-010 @status=planned
  Scenario: The egress log names a tool that the MCP policy refused
    Given an iron-proxy audit line of a call of the tool "delete_page" of "wiki" that the MCP policy denied
    When the adapter calls egressEntries with the log
    Then the entry is a call of the tool "delete_page" of "wiki" refused by "mcp"

  @id=SCN-SEGRESS-011 @status=planned
  Scenario: A spec that is no valid sandbox spec is refused with the path of the problem
    Given the file "spec.json" with a sandbox spec whose CPU is "four"
    When the adapter calls parseSpec with the file
    Then it fails with a usage error that names "spec.json: /cpu"

  @id=SCN-SEGRESS-012 @status=planned
  Scenario: A secret from an unknown provider is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:vault/linear-token"
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says the provider "vault" is not supported

  @id=SCN-SEGRESS-013 @status=planned
  Scenario: A secret name that leaves the secrets folder is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/../.ssh/id_ed25519"
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR

  @id=SCN-SEGRESS-014 @status=planned
  Scenario: A secret whose file is missing is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and an empty secrets folder
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says the secret "LINEAR_TOKEN" has no file "linear-token"

  @id=SCN-SEGRESS-015 @status=planned
  Scenario: A secret from an unset variable is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:env/LINEAR_TOKEN" and no variable "OSF_SECRET_LINEAR_TOKEN"
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says the secret "LINEAR_TOKEN" needs the variable "OSF_SECRET_LINEAR_TOKEN"

  @id=SCN-SEGRESS-016 @status=planned
  Scenario: A secret from the environment whose name is no variable name is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:env/linear.token"
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says "linear.token" is no variable name

  @id=SCN-SEGRESS-017 @status=planned
  Scenario: A secret from OpenBao without an address and a token is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:openbao/linear-token" and no OpenBao variables
    When the adapter calls resolveSecrets with the spec
    Then it fails with a usage error that says the secret "LINEAR_TOKEN" needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"

  @id=SCN-SEGRESS-018 @status=planned
  Scenario: A memory quantity is converted to bytes
    When the adapter calls memoryBytes with "256Mi" and "2Gi"
    Then it gives 268435456 and 2147483648
