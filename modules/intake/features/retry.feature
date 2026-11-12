@module=intake @owner=maintainers
Feature: A work item runs again
  A work item follows the newest run of the foreman: a run event that names the work item's run as the run before
  moves the work item to the new run. The label put on the issue of a failed or cancelled work item again asks the
  foreman to run it again with "work.retry-requested@v1" (ADR 0105).

  @id=SCN-INTAKE-050 @status=planned
  Scenario: A new run of a failed work item moves it back to running
    Given the server knows that the run "run_5d41402abc4b2a76b971" of the README's "work.json" completed with the outcome "failed"
    When the foreman publishes "run.started@v1" for the work item with the run "run_0f3c7e91a2b44d6e8c05" and the "retryOf" "run_5d41402abc4b2a76b971"
    Then "/v1/work-items/<id>" shows the status "running" and the run "run_0f3c7e91a2b44d6e8c05"

  @id=SCN-INTAKE-051 @status=planned
  Scenario: A late "run.completed@v1" of the run before leaves the work item with the new run
    Given the server knows that the work item of the README's "work.json" runs again in the run "run_0f3c7e91a2b44d6e8c05" after the run "run_5d41402abc4b2a76b971"
    When the foreman's "run.completed@v1" of "run_5d41402abc4b2a76b971" with the outcome "failed" arrives again
    Then "/v1/work-items/<id>" still shows the status "running" and the run "run_0f3c7e91a2b44d6e8c05"

  @id=SCN-INTAKE-052 @status=planned
  Scenario: A new run's "run.completed@v1" that comes before its "run.started@v1" completes the work item
    Given the server knows that the run "run_5d41402abc4b2a76b971" of the README's "work.json" completed with the outcome "cancelled"
    When the foreman publishes "run.completed@v1" for the work item with the run "run_0f3c7e91a2b44d6e8c05", the "retryOf" "run_5d41402abc4b2a76b971" and the outcome "succeeded"
    And then its "run.started@v1"
    Then "/v1/work-items/<id>" shows the status "complete" and the run "run_0f3c7e91a2b44d6e8c05"

  @id=SCN-INTAKE-053 @status=planned
  Scenario: The label put again on the issue of a failed work item asks the foreman to run it again
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" failed
    When "tester" removes the label "factory" from the issue and adds it again
    Then the event "work.retry-requested@v1" arrives on "osf.work.retry-requested.v1" with the ID "run_5d41402abc4b2a76b971.retry", the work item, the run "run_5d41402abc4b2a76b971" and the requester "github:tester"

  @id=SCN-INTAKE-054 @status=planned
  Scenario: The label put again on the issue of a running work item asks for nothing
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" started
    When "tester" removes the label "factory" from the issue and adds it again
    Then no event arrives on "osf.work.retry-requested.v1"
    And "/v1/work-items/<id>" still shows the status "running"

  @id=SCN-INTAKE-055 @status=planned
  Scenario: The label put again on the issue of a complete work item asks for nothing
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" succeeded
    When "tester" removes the label "factory" from the issue and adds it again
    Then no event arrives on "osf.work.retry-requested.v1"

  @id=SCN-INTAKE-056 @status=planned
  Scenario: The label put again twice on the same failed run asks once
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter, made a work item of the issue "Export reports as CSV" labeled "factory", and its run "run_5d41402abc4b2a76b971" failed
    When "tester" removes the label "factory" from the issue and adds it again, twice
    Then the event "work.retry-requested@v1" arrives on "osf.work.retry-requested.v1" once
