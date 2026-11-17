@module=testkit @owner=maintainers
Feature: Shared starts
  Scenarios that only read a system that is slow to start, like a Compose profile or an installed Helm chart, share one
  start of it in a test run. Each scenario of the group carries the tag "@shared=<name>" and keeps its own scenario()
  call, its own steps and its own test case. The first scenario of the group that runs starts the system; the others
  of the run use it; the testkit takes it down when the run ends (ADR 0157).

  @id=SCN-TK-210 @status=implemented
  Scenario: Two scenarios with the same tag @shared use one start of the Compose project, which goes down when the run ends
    Given a Docker configuration folder whose plugin "cli-plugins/docker-compose" writes each call to "compose.log"
    And a module whose scenarios "SCN-DEMO-001" and "SCN-DEMO-002" carry the tag "@shared=profile", each with a test file of its own
    And each test runs "up" with sut.compose in the shared start "profile" and then "ps" on the shared project
    When the developer runs "testkit run --junit report.xml" in the module with "DOCKER_CONFIG" set to that folder
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"
    And "compose.log" has one "up" and two "ps" of one project, and after them one "down" of that project

  @id=SCN-TK-211 @status=implemented
  Scenario: When the shared start fails, each scenario of the group fails with the failure of the start, and the project goes down
    Given a Docker configuration folder whose plugin "cli-plugins/docker-compose" writes each call to "compose.log" and fails "up" with "no such image"
    And a module whose scenarios "SCN-DEMO-001" and "SCN-DEMO-002" carry the tag "@shared=profile", each with a test file of its own
    And each test runs "up" with sut.compose in the shared start "profile" and fails the start when "up" fails
    When the developer runs "testkit run --junit report.xml" in the module with "DOCKER_CONFIG" set to that folder
    Then the command exits with code 1
    And "report.xml" has the failed test cases "SCN-DEMO-001" and "SCN-DEMO-002"
    And the failure of each of the two test cases says 'the shared start "profile" failed' with "no such image"
    And "compose.log" has one "up", and after it one "down" of its project

  @id=SCN-TK-212 @status=implemented
  Scenario: A scenario without the tag @shared cannot use a shared start, and a scenario with the tag must use it
    Given a module whose scenario "SCN-DEMO-001" has no tag @shared and whose test uses the shared start "profile"
    And whose scenario "SCN-DEMO-002" carries the tag "@shared=profile" and whose test does not use it
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And "report.xml" has the failed test cases "SCN-DEMO-001" and "SCN-DEMO-002"
    And the output says 'SCN-DEMO-001 uses sut.shared("profile") but has no tag @shared=profile'
    And the output says 'SCN-DEMO-002 has the tag @shared=profile but did not use sut.shared("profile")'

  @id=SCN-TK-213 @status=implemented
  Scenario: Two scenarios with the same tag @shared use one install of the chart in one namespace, which is deleted when the run ends
    Given a module whose chart "chart" has the ConfigMap "greeting"
    And its scenarios "SCN-DEMO-001" and "SCN-DEMO-002" carry the tag "@shared=chart", each with a test file of its own
    And each test installs the chart with sut.helm in the shared start "chart", which counts its starts, and then reads the ConfigMap in the shared namespace
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"
    And the shared start ran once, both tests read the same namespace, and that namespace is deleted or in deletion
