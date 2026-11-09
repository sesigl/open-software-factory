@module=e2e @owner=maintainers
Feature: Key use cases across modules
  Deterministic end-to-end scenarios on the Compose profile. Outside systems are fakes, except the forge,
  which is a real Forgejo container. The harness is the scripted ACP agent from the testkit.

  @id=SCN-E2E-001 @status=implemented
  Scenario: A request in chat becomes a pull request with evidence
    Given a factory with the stages "triage", "implement" and "verify"
    And the scripted harness changes "README.md" when asked to implement
    When a person posts "Fix the typo in the README" in the fake Slack channel
    Then a pull request exists in Forgejo that changes "README.md"
    And the pull request has a check named "proof" with the result "success"
    And the fake Slack thread links the pull request

  @id=SCN-E2E-002 @status=implemented
  Scenario: Approval at a human gate releases the waiting work
    Given a factory whose "spec" stage needs approval by the group "maintainers"
    And work waits at the "spec" gate with an approval request in the fake Slack channel
    When a member of "maintainers" approves the request
    Then the work moves to the "implement" stage
    And the approval record names the approver and the time

  @id=SCN-E2E-003 @status=implemented
  Scenario: A repeated failure becomes a pull request to the factory
    Given 30 recorded runs in which the triage agent failed the scorer "research-skill-used"
    When the self-improvement loop runs
    Then a pull request to the factory repository exists
    And its description contains the sections "Problem", "Solution" and "Evidence"

  @id=SCN-E2E-004 @status=implemented
  Scenario: A benchmark result becomes a routing rule
    Given a benchmark suite with 3 tasks captured from merged pull requests
    And the scripted model gateway answers as two models with different cost and correctness
    When the factory engineer runs the benchmark and accepts the cheaper model
    Then the LLM gateway configuration routes those tasks to the cheaper model

  @id=SCN-E2E-005 @status=implemented
  Scenario: A manual change to a running factory is reported as drift
    Given a factory applied from "factory.yaml"
    When a person changes a webhook directly in Forgejo
    Then "factory plan" reports the webhook as drift

  @id=SCN-E2E-006 @status=implemented @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: An agent in a sandbox pushes to the forge with a placeholder, and holds no token of the foreman
    Given a factory whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal" and the secret "ref:env/FORGE_TOKEN"
    And the scripted harness prints its environment and pushes the branch "sandboxed" with "$FORGE_TOKEN" as its password when asked to implement
    When a program posts the work item to foreman's "/v1/runs" with the API token
    Then the stage "implement" succeeded, and Forgejo has the branch "sandboxed"
    And the agent's environment holds "FORGE_TOKEN" as "osf-secret-placeholder-FORGE_TOKEN"
    And it holds none of the forge token, the master key of litellm and the API tokens of foreman, intake and gatekeeper
