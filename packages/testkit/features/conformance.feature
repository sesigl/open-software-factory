@module=testkit @owner=maintainers
Feature: Conformance of an adapter to its port
  A port's shared behavior is a set of @conformance scenarios. "testkit conformance" runs an adapter's system
  tests and reports, for every @conformance scenario of the port, whether the adapter passed it. Community adapters
  in other repositories use it as the conformance kit.

  @id=SCN-TK-021 @status=implemented
  Scenario: testkit conformance names each conformance scenario the adapter does not pass
    Given a port whose features have the implemented @conformance scenarios "SCN-DEMO-001" and "SCN-DEMO-002"
    And an adapter whose system tests pass "SCN-DEMO-001" and have no test for "SCN-DEMO-002"
    When the developer runs "testkit conformance port/features --junit report.xml" in the adapter
    Then the command exits with code 1
    And the output contains "CONFORMANCE SCN-DEMO-001 passed"
    And the output contains "CONFORMANCE SCN-DEMO-002 has no system test"
    And the output contains "1 of 2 conformance scenarios passed"

  @id=SCN-TK-022 @status=implemented
  Scenario: An adapter that passes every conformance scenario of its port conforms
    Given a port whose features have the implemented @conformance scenarios "SCN-DEMO-001" and "SCN-DEMO-002"
    And an adapter whose system tests pass both
    When the developer runs "testkit conformance port/features --junit report.xml" in the adapter
    Then the command exits with code 0
    And the output contains "2 of 2 conformance scenarios passed"
