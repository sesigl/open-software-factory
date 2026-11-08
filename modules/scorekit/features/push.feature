@module=scorekit @owner=maintainers
Feature: Push scores to Langfuse
  "scorekit push" sends score records to Langfuse's score API. Langfuse keeps one score per ID.

  @id=SCN-SCORE-026 @status=implemented
  Scenario: Push sends every score to Langfuse with basic auth
    Given "scores.jsonl" with 2 scores of "redundant-tests"
    And a Langfuse API that accepts scores
    When the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 0
    And Langfuse received the 2 scores at "POST /api/public/scores"
    And each request carries the header "authorization" with "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0"

  @id=SCN-SCORE-027 @status=implemented
  Scenario: A score Langfuse refuses is named and fails the command
    Given "scores.jsonl" with 2 scores of "redundant-tests"
    And a Langfuse API that answers HTTP 401
    When the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 1
    And the error output contains "Langfuse answered HTTP 401"

  @id=SCN-SCORE-058 @status=implemented
  Scenario: Push counts the scores Langfuse took
    Given "scores.jsonl" with 2 scores of "redundant-tests"
    And a Langfuse API at a host with a trailing slash that answers the first score with HTTP 500 and accepts the second
    When the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"
    Then the command exits with code 1
    And the output is "pushed 1 of 2 scores to Langfuse"
    And Langfuse received both scores at "POST /api/public/scores" with the header "content-type" "application/json"

  @id=SCN-SCORE-059 @status=implemented
  Scenario: Push with only the public key is refused
    Given "scores.jsonl" with 2 scores of "redundant-tests"
    When the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and without a secret key
    Then the command exits with code 2
    And the error output is "scorekit: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"
