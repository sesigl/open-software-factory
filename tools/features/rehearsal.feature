@module=tools @owner=maintainers
Feature: The rehearsal of this repository's factory on a scratch repository on GitHub
  Before the factory works on this repository's issues with a real model, the rehearsal runs its six stages once on a
  scratch repository on GitHub with the testkit's scripted agent, so no model is called (T-95, ADR 0173).
  "osf rehearsal factory" writes the factory of the rehearsal from deploy/dogfood/factory/ and the scripted agent's
  turns. "osf rehearsal run" opens the issue, hands its "labeled" event to intake as a webhook relay does, follows the
  run's stages at foreman, and writes the summary. The scenarios give it fakes of GitHub's API, intake, foreman and
  gatekeeper; the workflow of the scratch repository runs it against the real ones.

  @id=SCN-REPO-230 @status=implemented
  Scenario: osf rehearsal run refuses this repository and calls nothing
    Given a fake GitHub API that answers no call
    When the maintainer runs "osf rehearsal run --repository sesigl/open-software-factory --out rehearsal"
    Then the command exits with code 2
    And the error output is "osf rehearsal: sesigl/open-software-factory is this repository: the rehearsal runs only on a scratch repository"
    And the fake GitHub API got no call

  @id=SCN-REPO-231 @status=implemented
  Scenario: osf rehearsal factory writes this repository's factory with its workflow, its agents on the scripted agent and the approver as the only maintainer
    Given this repository's factory "deploy/dogfood/factory/" and the scripted agent's files "deploy/dogfood/rehearsal/agent/"
    When the maintainer runs "osf rehearsal factory out --repository acme/scratch --approver ada"
    Then the command exits with code 0
    And "out/factory/factory.yaml" has the workflow of "deploy/dogfood/factory/factory.yaml"
    And each agent of it runs on the harness "acp" without a sandbox and with the prompt of this repository's factory
    And "out/factory/groups.json" names "github:ada" as the only member of "maintainers"
    And "out/harness/script.json" has one turn for the first line of each agent's prompt, and the turn of "spec" pushes to "acme/scratch"

  @id=SCN-REPO-232 @status=implemented
  Scenario: osf rehearsal run opens the issue, hands its labeled event to intake, follows the stages and writes the summary
    Given a fake GitHub API of "acme/scratch" that opens the issue 7 and shows the pull request 8 ready for review
    And a fake intake whose work item of the issue 7 has the run "run_1"
    And a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8, and then is complete
    And a fake gatekeeper whose gate "gate_1" was approved by "github:ada"
    When the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal"
    Then the command exits with code 0
    And the fake GitHub API got the issue "Rehearsal: greet(name)" with the labels "factory" and "rehearsal"
    And intake got the "issues" event "labeled" of the issue 7 with the label "factory", signed with the webhook secret
    And the output asks for "/approve" on the pull request 8 by a member of "maintainers"
    And "rehearsal/summary.md" names the issue, the run, each stage with its state, the gate as approved by "github:ada" on GitHub and the pull request as "ready for review"

  @id=SCN-REPO-233 @status=implemented
  Scenario: With "--gate token", osf rehearsal run comments "/approve" once on the run's pull request and says that no person answered
    Given a fake GitHub API of "acme/scratch" that opens the issue 7 and shows the pull request 8 ready for review
    And a fake intake whose work item of the issue 7 has the run "run_1"
    And a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8, and then is complete
    And a fake gatekeeper whose gate "gate_1" was approved by "github:ada"
    When the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal --gate token"
    Then the command exits with code 0
    And the fake GitHub API got one comment "/approve" on the pull request 8
    And "rehearsal/summary.md" names the gate as answered with REHEARSAL_TOKEN by the workflow, not by a person

  @id=SCN-REPO-234 @status=implemented
  Scenario: osf rehearsal run fails with the name and the reason of the stage that failed
    Given a fake GitHub API of "acme/scratch" that opens the issue 7
    And a fake intake whose work item of the issue 7 has the run "run_1"
    And a fake foreman whose run "run_1" failed at the stage "verify" with the reason "the check verify ended with failure"
    When the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal"
    Then the command exits with code 1
    And the error output is "osf rehearsal: the stage verify failed: the check verify ended with failure"
    And "rehearsal/summary.md" starts its result with "**Failed:**" and lists the stage "verify" as "failed"

  @id=SCN-REPO-238 @status=implemented
  Scenario: osf rehearsal run fails when a stage does not end in time, and names the gate it waits at
    Given a fake GitHub API of "acme/scratch" that opens the issue 7
    And a fake intake whose work item of the issue 7 has the run "run_1"
    And a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8
    When the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal" with "REHEARSAL_WAIT_MS=300"
    Then the command exits with code 1
    And the error output is "osf rehearsal: the stage implement did not end within 300 ms: it is blocked at its gate"
