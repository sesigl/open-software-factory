@module=testkit @owner=maintainers
Feature: Fake inference adapter
  fakes.inference is a program with the commands start, key, spend-log, stop and list of the inference port. It serves
  no gateway: start prints the URL from its options. It shows what a module asks of the port without LiteLLM and
  Docker (ADR 0070).

  @id=SCN-TK-110 @status=implemented
  Scenario: The fake inference adapter starts a gateway from a config and prints its ID and URL
    Given a module whose CLI writes "model_list: []" to "litellm.yaml", starts a gateway from it with the adapter in "DEMO_INFERENCE_COMMAND", and prints what start printed and the list
    And its system test starts fakes.inference with the URL "http://127.0.0.1:4100/v1" and expects the ID "000000000001", that URL, the list "000000000001" and the config "model_list: []"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-111 @status=implemented
  Scenario: The fake inference adapter makes one key per call and forgets a stopped gateway
    Given a module whose CLI starts a gateway with the adapter in "DEMO_INFERENCE_COMMAND", asks for a key for the run "run-7" with the budget "5" and one for "run-8" without a budget, stops the gateway, and prints the keys and the list
    And its system test expects the keys "sk-fake-1" and "sk-fake-2", the runs and the budget the fake recorded, and an empty list
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-112 @status=implemented
  Scenario: The fake inference adapter fails every command with its message
    Given a module whose CLI starts a gateway with the adapter in "DEMO_INFERENCE_COMMAND" and prints the exit code and the error
    And its system test starts fakes.inference failing with "docker is not running" and expects the exit code 1 and that message
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
