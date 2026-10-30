@module=scorekit @owner=maintainers
Feature: Score runs
  "scorekit score" asks an LLM judge about each sampled run and appends one score per run to scores.jsonl. A score
  follows the score contract: 1 for pass, 0 for fail, the judge's reason as comment.

  @id=SCN-SCORE-003 @status=implemented @realizes=SCN-FACTORY-SCORE-001
  Scenario: A run the judge passes gets the score 1 with the reason
    Given the runs file "runs.jsonl" with the run "run-01"
    And a model gateway that answers the judge call for "run-01" with the result "pass" and the reason "Each test proves a new behavior."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the command exits with code 0
    And "scores.jsonl" holds a score for "run-01" with the name "redundant-tests", the value 1, the data type "BOOLEAN" and the comment "Each test proves a new behavior."
    And the score carries the trace ID of "run-01", the source "API" and the judge model "judge"

  @id=SCN-SCORE-004 @status=implemented @realizes=SCN-FACTORY-SCORE-001
  Scenario: A run the judge fails gets the score 0
    Given the runs file "runs.jsonl" with the run "run-01"
    And a model gateway that answers the judge call for "run-01" with the result "fail" and the reason "The second test repeats the first."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the command exits with code 0
    And "scores.jsonl" holds a score for "run-01" with the value 0 and the comment "The second test repeats the first."

  @id=SCN-SCORE-005 @status=implemented @realizes=SCN-FACTORY-CODE-006
  Scenario: The judge gets the scorer's prompt, its pass criterion and the run's tool calls
    Given the scorer file "scorers/slow-tests.md" with the pass criterion "No test waits longer than one second." and the prompt "Look for sleep calls in tests."
    And the runs file "runs.jsonl" with the run "run-01" whose tool call "Bash" ran "sleep 5 && npm test"
    And a model gateway that answers every judge call with the result "fail" and the reason "A test sleeps."
    When the user runs "scorekit score --scorer scorers/slow-tests.md runs.jsonl"
    Then the judge call's system message contains "Look for sleep calls in tests." and "No test waits longer than one second."
    And the judge call's user message contains "run-01", "Bash" and "sleep 5 && npm test"
    And "scores.jsonl" holds a score for "run-01" with the name "slow-tests"

  @id=SCN-SCORE-006 @status=implemented
  Scenario: The judge gets the run's messages when the run carries prompt content
    Given the runs file "runs.jsonl" with the run "run-01" whose user message is "Add a login page" and whose answer is "Done, I added two tests."
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the judge call's user message contains "Add a login page" and "Done, I added two tests."

  @id=SCN-SCORE-007 @status=implemented @realizes=SCN-FACTORY-SCORE-002
  Scenario: A scorer with a sampling rate of 20 percent scores the runs its seed picks
    Given the runs file "runs.jsonl" with the 10 runs "run-01" to "run-10"
    And the scorer file "scorers/sampled.md" with the sampling rate 0.2
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer scorers/sampled.md --seed 42 runs.jsonl"
    Then the command exits with code 0
    And "scores.jsonl" holds scores for exactly the runs "run-03" and "run-07"
    And the output contains "scored 2 of 10 runs"

  @id=SCN-SCORE-008 @status=implemented
  Scenario: The seed picks the same runs when the runs file lists them in another order
    Given the runs file "runs.jsonl" with the 10 runs "run-10" down to "run-01"
    And the scorer file "scorers/sampled.md" with the sampling rate 0.2
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer scorers/sampled.md --seed 42 runs.jsonl"
    Then "scores.jsonl" holds scores for exactly the runs "run-03" and "run-07"

  @id=SCN-SCORE-009 @status=implemented
  Scenario: The option "--sample" overrides the scorer's sampling rate
    Given the runs file "runs.jsonl" with the 10 runs "run-01" to "run-10"
    And the scorer file "scorers/sampled.md" with the sampling rate 0.2
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer scorers/sampled.md --sample 1 runs.jsonl"
    Then "scores.jsonl" holds 10 scores

  @id=SCN-SCORE-010 @status=implemented @realizes=SCN-FACTORY-SCORE-002
  Scenario: The judge cost is recorded from the token usage and the scorer's price
    Given the scorer file "scorers/priced.md" with the price 3 USD per million input tokens and 15 USD per million output tokens
    And the runs file "runs.jsonl" with the run "run-01"
    And a model gateway that answers the judge call for "run-01" with 1000 prompt tokens and 200 completion tokens
    When the user runs "scorekit score --scorer scorers/priced.md runs.jsonl"
    Then the score for "run-01" has the judge cost 0.006
    And the output contains "cost 0.006 USD"

  @id=SCN-SCORE-011 @status=implemented
  Scenario: A run that already has a score of the scorer is not judged again
    Given the runs file "runs.jsonl" with the runs "run-01" and "run-02"
    And "scores.jsonl" already holds a score of "redundant-tests" for "run-01"
    And a model gateway that answers the judge call for "run-02" with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the model gateway received 1 judge call
    And "scores.jsonl" holds one score for "run-01" and one score for "run-02"

  @id=SCN-SCORE-012 @status=implemented
  Scenario: An answer that is not a verdict gives no score and fails the command
    Given the runs file "runs.jsonl" with the run "run-01"
    And a model gateway that answers the judge call for "run-01" with "Verdict: {pass}"
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the command exits with code 1
    And the error output contains "run-01: the judge's answer is not a verdict"
    And "scores.jsonl" holds no score

  @id=SCN-SCORE-013 @status=implemented
  Scenario: A failed judge call is named and the other runs are still scored
    Given the runs file "runs.jsonl" with the runs "run-01" and "run-02"
    And a gateway that answers the first judge call with HTTP 503 and the second with the result "pass"
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"
    Then the command exits with code 1
    And the error output contains "run-01: the judge call failed with HTTP 503"
    And "scores.jsonl" holds scores for exactly the runs "run-02"

  @id=SCN-SCORE-014 @status=implemented
  Scenario: A transcript longer than the scorer's limit loses its middle
    Given the scorer file "scorers/short.md" with the transcript limit 2000 characters
    And the runs file "runs.jsonl" with the run "run-01" whose tool call "Bash" ran a command of 5000 characters
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer scorers/short.md runs.jsonl"
    Then the judge call's user message has at most 2000 characters
    And the judge call's user message starts with "Run: run-01" and contains "characters cut"

  @id=SCN-SCORE-015 @status=implemented
  Scenario: A scorer file with an unknown key is refused
    Given the scorer file "scorers/typo.md" with the front matter key "sampel"
    And the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer scorers/typo.md runs.jsonl"
    Then the command exits with code 2
    And the error output names the file "scorers/typo.md" and the unknown key "sampel"

  @id=SCN-SCORE-016 @status=implemented
  Scenario: Without an inference URL the command names the missing variable
    Given the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl" without "SCOREKIT_INFERENCE_URL"
    Then the command exits with code 2
    And the error output contains "SCOREKIT_INFERENCE_URL"

  @id=SCN-SCORE-017 @status=implemented
  Scenario: The inference key is sent as a bearer token
    Given the runs file "runs.jsonl" with the run "run-01"
    And a gateway that answers every judge call with the result "pass"
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl" with "SCOREKIT_INFERENCE_KEY" set to "test-key"
    Then the judge call carries the header "authorization" with "Bearer test-key"

  @id=SCN-SCORE-018 @status=implemented
  Scenario: A folder of runs files is read
    Given the runs file "runs/a.jsonl" with the run "run-01"
    And the runs file "runs/b.jsonl" with the run "run-02"
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 runs"
    Then "scores.jsonl" holds scores for exactly the runs "run-01" and "run-02"

  @id=SCN-SCORE-029 @status=implemented
  Scenario: An unknown scorer name is refused with the names of the pack
    Given the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer slow-tests runs.jsonl"
    Then the command exits with code 2
    And the error output names the unknown scorer "slow-tests" and the pack scorer "redundant-tests"

  @id=SCN-SCORE-032 @status=implemented
  Scenario: A runs file line that is not JSON is named with its file and line
    Given the runs file "runs.jsonl" whose second line is "not json"
    When the user runs "scorekit score --scorer redundant-tests runs.jsonl"
    Then the command exits with code 2
    And the error output contains "runs.jsonl:2: not a JSON line"

  @id=SCN-SCORE-046 @status=implemented
  Scenario: The option "--model" overrides the scorer's judge model
    Given the runs file "runs.jsonl" with the run "run-01"
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit score --scorer redundant-tests --sample 1 --model deepseek/deepseek-v4.1-flash-1017 runs.jsonl"
    Then the judge call asks the gateway for the model "deepseek/deepseek-v4.1-flash-1017"
    And the score for "run-01" carries the judge model "deepseek/deepseek-v4.1-flash-1017"
