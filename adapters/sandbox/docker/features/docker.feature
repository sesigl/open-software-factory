@module=sandbox-docker @owner=maintainers
Feature: What the docker adapter checks before it starts a sandbox
  The docker adapter starts each sandbox as a container on a network of its own, next to an iron-proxy container
  that is its only way out (ADR 0054). It checks the spec and the secrets before it starts anything.

  @id=SCN-SDOCKER-001 @status=implemented
  Scenario: A spec that is no valid sandbox spec is refused with the path of the problem
    Given a sandbox spec with the CPU "four"
    When the client runs "create" with the spec
    Then create exits with code 2 and names "/cpu" as invalid

  @id=SCN-SDOCKER-002 @status=implemented
  Scenario: A secret from a provider the adapter does not support is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the provider "openbao" is not supported

  @id=SCN-SDOCKER-003 @status=implemented
  Scenario: A secret whose file is missing is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and no file "linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" has no file "linear-token"

  @id=SCN-SDOCKER-004 @status=implemented
  Scenario: A secret name that leaves the secrets folder is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/../.ssh/id_ed25519"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the name "../.ssh/id_ed25519" leaves OSF_SECRETS_DIR

  @id=SCN-SDOCKER-005 @status=implemented
  Scenario: A sandbox that does not start is removed
    Given a sandbox spec with the template "hello-world", an image without a shell
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the sandbox did not start and was removed
    And the sandbox list does not hold that sandbox
