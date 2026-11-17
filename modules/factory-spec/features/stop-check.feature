@module=factory-spec @owner=maintainers
Feature: Stop check
  An agent's "stopCheck" is a command that its harness runs before the agent ends a turn in which it changed files
  (ADR 0168). When the command fails, the agent gets its output once and goes on; a turn that changed nothing, or one
  that the check already sent back, ends as it would without it. "factory render" writes it as the Stop hook of
  Claude Code's ".claude/settings.json" and keeps every other key of that file. The other harnesses get none.

  @id=SCN-FSPEC-132 @status=implemented
  Scenario: Render writes the stop check as the Stop hook of Claude Code and keeps the settings a person wrote
    Given a factory.yaml whose agent "implement" uses the harness "claude-code" and the stop check "make check-fast"
    And ".claude/settings.json" in the output folder allows "Bash(make check)" and has a hand-written Stop hook
    When the factory engineer runs "factory render" twice
    Then both commands exit with code 0 and print "wrote .claude/settings.json"
    And ".claude/settings.json" in the output folder still allows "Bash(make check)"
    And its "Stop" hooks are one command hook that runs "make check-fast", in place of the hand-written one
    And the second render wrote the same ".claude/settings.json" as the first

  @id=SCN-FSPEC-133 @status=implemented
  Scenario: The rendered Stop hook skips a second stop and a clean tree, and ends with code 2 when the check fails
    Given a factory.yaml whose agent "implement" uses the harness "claude-code" and the stop check "make check-fast"
    When the factory engineer runs "factory render"
    Then the command exits with code 0
    And the Stop hook in ".claude/settings.json" exits with code 0 when its input has "stop_hook_active" true
    And it exits with code 0 when "git status --porcelain" prints nothing
    And it runs "make check-fast" with its output on the error output, and exits with code 2 and "the stop check failed: fix it before you report done, or stop and ask" when that fails

  @id=SCN-FSPEC-134 @status=implemented
  Scenario: Render says which harness cannot run the stop check and writes none for it
    Given a factory.yaml that declares the harnesses "claude-code" and "codex"
    And its agent "implement" uses the harness "claude-code" and the stop check "make check-fast"
    When the factory engineer runs "factory render --harness all"
    Then the command exits with code 0
    And the output contains "codex runs no stop check, so factory render writes none for it"
    And ".codex/config.toml" in the output folder does not contain "make check-fast"

  @id=SCN-FSPEC-135 @status=implemented
  Scenario: Lint refuses a stop check without a command
    Given a factory.yaml whose agent "triage" has a stop check whose command is blank, on line 12
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output names "factory.yaml:12:7" and says "/agents/triage/stopCheck/command: must match pattern"

  @id=SCN-FSPEC-136 @status=implemented
  Scenario: Plan reports a Stop hook changed by hand as drift
    Given the factory "web-app" was applied with the agent "triage" and the stop check "make check-fast"
    And a person edited the Stop hook in ".claude/settings.json" in the output folder
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! .claude/settings.json changed outside \"factory apply\""
