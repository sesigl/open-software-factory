@module=scorekit @owner=maintainers
Feature: Export scorers as Langfuse evaluators
  "scorekit export" turns scorers into Langfuse LLM-as-a-judge evaluators, each with an evaluation rule for the
  root observations "invoke_agent". It writes them to a file, or with "--push" creates or updates them in Langfuse.

  @id=SCN-SCORE-033 @status=implemented @realizes=SCN-FACTORY-SCORE-004
  Scenario: Export writes the five scorers of the pack as evaluators
    When the user runs "scorekit export"
    Then the command exits with code 0
    And "evaluators.json" holds the evaluators "change-requested", "needless-human-question", "redundant-tests", "scope-creep" and "skipped-checks"
    And the output says "wrote 5 evaluators to"

  @id=SCN-SCORE-034 @status=implemented
  Scenario: An exported evaluator carries the judge prompt and the pass criterion as a boolean score
    Given the scorer file "scorers/slow-tests.md" with the pass criterion "No test waits longer than one second." and the prompt "Look for sleep calls."
    When the user runs "scorekit export --scorer scorers/slow-tests.md"
    Then the command exits with code 0
    And the evaluator "slow-tests" has a system message with "Look for sleep calls." and "Pass criterion: No test waits longer than one second."
    And the evaluator "slow-tests" has a user message with the variables "input" and "output"
    And the evaluator "slow-tests" maps "input" to the source "input" and "output" to the source "output"
    And the evaluator "slow-tests" has the output type "BOOLEAN" with "No test waits longer than one second." in its value instructions

  @id=SCN-SCORE-035 @status=implemented
  Scenario: The evaluation rule samples the scorer's share of the runs and starts disabled
    Given the scorer file "scorers/slow-tests.md" with the sampling rate 0.2
    When the user runs "scorekit export --scorer scorers/slow-tests.md"
    Then the command exits with code 0
    And the rule of "slow-tests" is named "scorekit slow-tests" with the sampling 0.2
    And the rule of "slow-tests" filters the observation name "invoke_agent"
    And the rule of "slow-tests" is disabled

  @id=SCN-SCORE-036 @status=implemented
  Scenario: The options "--provider" and "--model" set the evaluator's model
    When the user runs "scorekit export --scorer redundant-tests --provider anthropic --model claude-haiku-5-5"
    Then the command exits with code 0
    And the evaluator "redundant-tests" has the model "claude-haiku-5-5" of the provider "anthropic"

  @id=SCN-SCORE-037 @status=implemented
  Scenario: Without "--model" the evaluator uses the project's default evaluation model
    When the user runs "scorekit export --scorer redundant-tests"
    Then the command exits with code 0
    And the evaluator "redundant-tests" has no model

  @id=SCN-SCORE-038 @status=implemented
  Scenario: The option "--model" without "--provider" is refused
    When the user runs "scorekit export --scorer redundant-tests --model claude-haiku-5-5"
    Then the command exits with code 2
    And the error output says "--provider and --model go together"

  @id=SCN-SCORE-039 @status=implemented
  Scenario: Push creates a missing evaluator and its disabled rule in Langfuse with basic auth
    Given a Langfuse project without evaluators
    When the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received the evaluator "redundant-tests" at "POST /api/public/v2/evaluators"
    And Langfuse received the disabled rule "scorekit redundant-tests" for the evaluator "ev-1" at "POST /api/public/v2/evaluation-rules"
    And each request carries the header "authorization" with "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0"
    And the output says "created redundant-tests"

  @id=SCN-SCORE-040 @status=implemented
  Scenario: Push with "--enable" creates the rule enabled
    Given a Langfuse project without evaluators
    When the user runs "scorekit export --push --enable --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received the enabled rule "scorekit redundant-tests" at "POST /api/public/v2/evaluation-rules"

  @id=SCN-SCORE-041 @status=implemented
  Scenario: Push leaves an evaluator alone when Langfuse already holds the same definition
    Given a Langfuse project with the evaluator "redundant-tests" exported from the same scorer file and a rule
    When the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received only "GET /api/public/v2/evaluators?limit=100"
    And the output says "unchanged redundant-tests"

  @id=SCN-SCORE-042 @status=implemented
  Scenario: Push updates a changed evaluator and keeps its rule
    Given a Langfuse project with the evaluator "redundant-tests" whose prompt is "An older prompt." and a rule
    When the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received the new definition of "redundant-tests" at "PATCH /api/public/v2/evaluators/ev-7"
    And Langfuse received no request to "/api/public/v2/evaluation-rules"
    And the output says "updated redundant-tests"

  @id=SCN-SCORE-043 @status=implemented
  Scenario: Push finds an evaluator on the second page of Langfuse's list
    Given a Langfuse project whose first page of evaluators has the cursor "page-2" and whose second page holds the evaluator "redundant-tests" exported from the same scorer file
    When the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received "GET /api/public/v2/evaluators?limit=100&cursor=page-2"
    And the output says "unchanged redundant-tests"

  @id=SCN-SCORE-044 @status=implemented
  Scenario: An evaluator Langfuse refuses is named and fails the command
    Given a Langfuse project without evaluators that answers HTTP 400 to a new evaluator
    When the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 1
    And the error output says "evaluator redundant-tests: Langfuse answered HTTP 400"

  @id=SCN-SCORE-045 @status=implemented
  Scenario: Push without Langfuse keys names the missing variables
    When the user runs "scorekit export --push --scorer redundant-tests" without Langfuse keys
    Then the command exits with code 2
    And the error output says "set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"
