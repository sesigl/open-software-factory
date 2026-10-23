@module=harness-acp @owner=maintainers
Feature: What the acp adapter adds to the harness port
  The acp adapter runs any ACP agent named on its command line behind the harness proxy (ADR 0050, ADR 0051).

  @id=SCN-HACP-001 @status=implemented
  Scenario: The run record names the harness "acp" and the version of the agent
    Given the adapter ran a session of a harness whose ACP agent has the version "0.0.0"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "service.name" "harness-acp", "osf.harness.name" "acp" and "osf.harness.version" "0.0.0"

  @id=SCN-HACP-002 @status=implemented
  Scenario: "run" without an agent command is a usage error
    When the developer runs "run" without an agent command
    Then the command exits with code 2 and writes "harness-acp: name the ACP agent to run after --" to standard error
