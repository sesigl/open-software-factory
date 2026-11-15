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

  @id=SCN-E2E-007 @status=implemented @realizes=SCN-FACTORY-RUNTIME-010
  Scenario: A value that a factory engineer stores in the console reaches the next run's request, with no restart
    Given a factory whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal" and the secret "ref:openbao/linear-token"
    And the scripted harness prints its environment and asks the API at "host.docker.internal" with "Authorization: Bearer $LINEAR_TOKEN" when asked to implement
    And the console with the sign-in of GitHub, where "grace@acme.dev" of the factory's "access.yaml" signed in as "factory-engineer"
    And a first run, whose stage "implement" failed for the reason 'the secret "ref:openbao/linear-token" has no value; store it and run again'
    When the factory engineer stores a value for "linear-token" in the form of the page "/secrets", and a program posts a second work item to foreman's "/v1/runs"
    Then the stage "implement" of the second run succeeded
    And the API got one request, with "Authorization: Bearer" and the stored value
    And the agent's environment holds "LINEAR_TOKEN" as "osf-secret-placeholder-LINEAR_TOKEN" and not the value
    And the page "/secrets" names "linear-token" as "Set" by "grace@acme.dev" and does not hold the value
    And the logs of the console and the foreman do not hold the value

  @id=SCN-E2E-008 @status=implemented @realizes=SCN-FACTORY-CODE-008
  Scenario: A change that a factory engineer proposes in the console merges after its check and is the factory version of the next run
    Given a factory repository on Forgejo whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal", and whose main branch requires the check "factory" and no approval
    And the Compose profile with "FACTORY_REPOSITORY" set to that repository's "main", "FACTORY_TOKEN" and "FACTORY_USER" to a token of the forge and its user, and "FACTORY_FORGE_ADAPTER" to "forge-forgejo", and the scripted harness that answers when asked to implement
    And the console with the sign-in of GitHub, where "grace@acme.dev" of the repository's "access.yaml" signed in as "factory-engineer"
    And a first run, whose stage "implement" succeeded with the newest commit of "main" as its factory version
    When the factory engineer sends the form "Propose change" of the page "/changes" with "add-egress", the agent "implement" and the value "api.linear.app"
    Then the console answered 303 to "/changes", and the forge has one open pull request "factory edit add-egress implement api.linear.app" whose body names "grace@acme.dev"
    When the check "factory" of the pull request's head passes, posted as the factory's workflow posts it, and the factory engineer opens "/changes"
    Then the forge merged the pull request into "main" without another person, and the "factory.yaml" of "main" lets "implement" reach "api.linear.app"
    And the page "/changes" shows the change as "Live" with "Live for the next run: factory version <the merge commit>"
    When a program posts a second work item to foreman's "/v1/runs", with no restart
    Then the stage "implement" of the second run succeeded with the merge commit as its factory version

