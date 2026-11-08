@module=inference-litellm @owner=maintainers
Feature: Gateways of a launcher that ended
  "start" labels the gateway with "OSF_INFERENCE_OWNER", a process ID, and its host, and removes the gateways whose
  owner on this host no longer runs, once they are older than "OSF_INFERENCE_ORPHAN_AGE" seconds, so a foreman that
  was killed leaves no gateway behind (ADR 0090).

  @id=SCN-INFLITE-017 @status=implemented
  Scenario: Any start removes the gateway of an owner that no longer runs, also one that fails itself
    Given a gateway started with "OSF_INFERENCE_OWNER" set to a process that ended
    When "start" runs with "OSF_INFERENCE_ORPHAN_AGE" set to "0" and a config that does not exist
    Then "start" exits with code 1
    And "list" does not print the first gateway
