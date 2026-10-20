@module=runlog @owner=maintainers
Feature: Attribute a run
  The resource of the run carries the run-record attributes (contracts/run-record). The launcher sets them in
  OTEL_RESOURCE_ATTRIBUTES; runlog fills the ones it is missing from the session and the Git repository in the
  current folder, and refuses a run that breaks the contract.

  @id=SCN-RUN-011 @status=implemented @realizes=SCN-FACTORY-RUNTIME-008
  Scenario: The attributes in OTEL_RESOURCE_ATTRIBUTES from the launch end up on every span
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl" with OTEL_RESOURCE_ATTRIBUTES "osf.run.id=01JABCDRUN00000000000000001,osf.work_item.id=01JABCDWORK0000000000000001,osf.factory.version=3f2a9c1,osf.stage=implement,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"
    Then the command exits with code 0
    And every span in "runs.jsonl" has the resource attributes "osf.run.id" "01JABCDRUN00000000000000001", "osf.stage" "implement" and "osf.requester.id" "slack:U024BE7LH"

  @id=SCN-RUN-012 @status=implemented @realizes=SCN-FACTORY-RUNTIME-008
  Scenario: A run without launch attributes is attributed to the Git author and the commit of the current folder
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then the resource in "runs.jsonl" has "osf.run.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d", "osf.requester.id" "git:test@example.invalid" and "osf.source" "cli"
    And the resource has "osf.factory.version" set to the commit of the repository

  @id=SCN-RUN-013 @status=implemented
  Scenario: A run that breaks the run-record contract is not exported
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl" with OTEL_RESOURCE_ATTRIBUTES "osf.requester.kind=robot"
    Then the command exits with code 1
    And the output contains "the run does not match the run-record contract: /resource/osf.requester.kind"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-021 @status=implemented
  Scenario: A run outside a Git repository with a commit has no factory version and is not exported
    Given a Git repository without a commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then the command exits with code 1
    And the output contains "the run does not match the run-record contract: /resource/osf.factory.version missing required field"
