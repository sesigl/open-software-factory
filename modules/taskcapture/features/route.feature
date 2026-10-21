@module=taskcapture @owner=maintainers
Feature: Route tasks to the chosen model
  "taskcapture route" turns a report into a LiteLLM proxy config. Requests for the alias with the tag go to the
  chosen model, through LiteLLM's tag routing.

  @id=SCN-TASK-030 @status=implemented @realizes=SCN-FACTORY-BENCH-006
  Scenario: Route sends the tag to the most efficient model
    Given a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture route --tag front-end --alias coder report.json"
    Then the command exits with code 0
    And "litellm-config.yaml" has the deployment "coder" with the model "glm-5.3-flash" and the tags "front-end"
    And "litellm-config.yaml" sets "router_settings.enable_tag_filtering" to true

  @id=SCN-TASK-031 @status=implemented @realizes=SCN-FACTORY-BENCH-006
  Scenario: The option "--min-correctness" picks the cheapest model that reaches it
    Given a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture route --tag front-end --alias coder --min-correctness 0.95 report.json"
    Then "litellm-config.yaml" has the deployment "coder" with the model "gpt-5.6-sol" and the tags "front-end"
    And the output says "front-end → gpt-5.6-sol (correctness 100.0%, 6.23 USD per trial)"

  @id=SCN-TASK-032 @status=implemented
  Scenario: The option "--model" picks the model
    Given a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture route --tag front-end --alias coder --model llama-9-tiny report.json"
    Then "litellm-config.yaml" has the deployment "coder" with the model "llama-9-tiny" and the tags "front-end"

  @id=SCN-TASK-033 @status=implemented
  Scenario: No model that reaches "--min-correctness" exits 1
    Given a report where "glm-5.3-flash" scores 0.9 at 1.99 USD per trial
    When the user runs "taskcapture route --tag front-end --alias coder --min-correctness 0.95 report.json"
    Then the command exits with code 1
    And the error output says "taskcapture: no model reaches correctness 95.0%; the best is v1 · glm-5.3-flash with 90.0%"
    And the output folder has no file "litellm-config.yaml"

  @id=SCN-TASK-034 @status=implemented
  Scenario: The option "--config" keeps the other deployments of a LiteLLM config
    Given a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    And a LiteLLM config "proxy.yaml" with the deployment "coder" of "gpt-5.6-sol" tagged "default" and the deployment "coder" of "old-model" tagged "front-end"
    When the user runs "taskcapture route --tag front-end --alias coder --config proxy.yaml report.json"
    Then "litellm-config.yaml" has the deployment "coder" with the model "gpt-5.6-sol" and the tags "default"
    And "litellm-config.yaml" has the deployment "coder" with the model "glm-5.3-flash" and the tags "front-end"
    And "litellm-config.yaml" has no deployment with the model "old-model"

  @id=SCN-TASK-035 @status=implemented
  Scenario: Route needs a tag and an alias
    Given a report where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture route report.json"
    Then the command exits with code 2
    And the error output says "taskcapture: route takes --tag and --alias, like --tag front-end --alias coder"

  @id=SCN-TASK-036 @status=implemented
  Scenario: A "--min-correctness" above 1 exits 2
    Given a report where "glm-5.3-flash" scores 0.9 at 1.99 USD per trial
    When the user runs "taskcapture route --tag front-end --alias coder --min-correctness 1.01 report.json"
    Then the command exits with code 2
    And the error output says "taskcapture: --min-correctness takes a share from 0 to 1, like 0.9"
