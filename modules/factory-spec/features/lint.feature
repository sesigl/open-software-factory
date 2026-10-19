@module=factory-spec @owner=maintainers
Feature: Lint a factory definition
  "factory lint" checks factory.yaml against the factory-definition contract and the rules a schema cannot
  express. Each problem is one line with the file, line and column. Every other command lints first.

  @id=SCN-FSPEC-002 @status=implemented @realizes=SCN-FACTORY-CODE-001
  Scenario: Lint accepts a factory without problems
    Given a factory.yaml whose agent "triage" uses the declared harness "claude-code" and the prompt "agents/triage.md"
    When the factory engineer runs "factory lint"
    Then the command exits with code 0
    And the output is "factory.yaml: no problems"

  @id=SCN-FSPEC-003 @status=implemented @realizes=SCN-FACTORY-CODE-001
  Scenario: Lint names the line of a secret whose provider is not declared
    Given a factory.yaml whose agent "triage" has the secret "ref:vault/linear-token" on line 14
    And providers.secrets declares only "openbao"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:14:9 secret \"ref:vault/linear-token\" uses the provider \"vault\", which providers.secrets does not declare"

  @id=SCN-FSPEC-004 @status=implemented
  Scenario: Lint names the line of a field the format does not know
    Given a factory.yaml whose agent "triage" has the field "modle" on line 9
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:9:5 /agents/triage/modle: unknown field"

  @id=SCN-FSPEC-005 @status=implemented
  Scenario: Lint names the line of YAML that does not parse
    Given a factory.yaml that repeats the key "factory" on line 3
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:3:1 Map keys must be unique"

  @id=SCN-FSPEC-006 @status=implemented
  Scenario: Lint reports an agent whose harness is not declared
    Given a factory.yaml whose agent "triage" uses the harness "codex" on line 8
    And providers.harness declares only "claude-code"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:8:5 harness \"codex\" is not declared under providers.harness"

  @id=SCN-FSPEC-007 @status=implemented
  Scenario: Lint reports a referenced file that does not exist
    Given a factory.yaml whose agent "triage" has the prompt "agents/missing.md" on line 10
    And the working folder has no file "agents/missing.md"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:10:5 the file \"agents/missing.md\" does not exist"

  @id=SCN-FSPEC-008 @status=implemented @realizes=SCN-FACTORY-LOOP-011
  Scenario: Lint reports a stage whose agent is not declared
    Given a factory.yaml whose workflow has the stage "review" on line 13 and no agent "review"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output contains "factory.yaml:13:5 stage \"review\" runs the agent \"review\", which agents does not declare"

  @id=SCN-FSPEC-009 @status=implemented
  Scenario: Render refuses a factory with problems
    Given a factory.yaml whose agent "triage" uses the harness "codex" on line 8
    And providers.harness declares only "claude-code"
    When the factory engineer runs "factory render"
    Then the command exits with code 1
    And the output contains "harness \"codex\" is not declared under providers.harness"
    And the output folder is empty
