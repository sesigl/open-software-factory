@module=inference-litellm @owner=maintainers
Feature: Gateways of a launcher that ended
  "start" labels the gateway with "OSF_INFERENCE_OWNER", a process ID, and its host, and removes the gateways whose
  owner on this host no longer runs, once they are older than "OSF_INFERENCE_ORPHAN_AGE" seconds, so a foreman that
  was killed leaves no gateway behind (ADR 0090).

  @id=SCN-INFLITE-017 @status=implemented
  Scenario: Starting a gateway removes the gateway of an owner that no longer runs
    Given a gateway started with "OSF_INFERENCE_OWNER" set to a process that ended
    When a second gateway starts with "OSF_INFERENCE_OWNER" set to a process that runs and "OSF_INFERENCE_ORPHAN_AGE" set to "0"
    Then "list" prints the second gateway and not the first
