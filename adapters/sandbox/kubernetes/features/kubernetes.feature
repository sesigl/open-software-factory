@module=sandbox-kubernetes @owner=maintainers
Feature: What the kubernetes adapter checks before it starts a sandbox
  The kubernetes adapter starts each sandbox as an agent-sandbox SandboxClaim whose pod may reach only its own
  egress pod with iron-proxy (ADR 0055). It checks the spec and the template before it starts anything, and removes
  a sandbox that does not start.

  @id=SCN-SKUBE-001 @status=implemented
  Scenario: A spec that is no valid sandbox spec is refused with the path of the problem
    Given a sandbox spec with the CPU "four"
    When the client runs "create" with the spec
    Then create exits with code 2 and names "/cpu" as invalid

  @id=SCN-SKUBE-002 @status=implemented
  Scenario: A template that names no SandboxTemplate and no image is refused
    Given a sandbox spec with the template "small" and no SandboxTemplate "small" in the namespace
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the namespace has no SandboxTemplate "small"

  @id=SCN-SKUBE-003 @status=implemented
  Scenario: A sandbox that does not start is removed
    Given a sandbox spec with the template "hello-world:latest", an image without a shell
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the sandbox did not start and was removed
    And the sandbox list does not hold that sandbox
