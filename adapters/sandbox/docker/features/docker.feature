@module=sandbox-docker @owner=maintainers
Feature: What the docker adapter checks before it starts a sandbox
  The docker adapter starts each sandbox as a container on a network of its own, next to an iron-proxy container
  that is its only way out (ADR 0054). It checks the spec and the secrets before it starts anything.

  @id=SCN-SDOCKER-001 @status=planned
  Scenario: A spec that is no valid sandbox spec is refused with the path of the problem
    Given a sandbox spec with the CPU "four"
    When the client runs "create" with the spec
    Then create exits with code 2 and names "/cpu" as invalid

  @id=SCN-SDOCKER-002 @status=planned
  Scenario: A secret from a provider the adapter does not support is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:openbao/linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the provider "openbao" is not supported

  @id=SCN-SDOCKER-003 @status=planned
  Scenario: A secret whose file is missing is refused
    Given a sandbox spec with the secret "LINEAR_TOKEN" from "ref:file/linear-token" and no file "linear-token"
    When the client runs "create" with the spec
    Then create exits with code 2 and says that the secret "LINEAR_TOKEN" has no file "linear-token"
