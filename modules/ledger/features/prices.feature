@module=ledger @owner=maintainers
Feature: Prices for token usage
  A team without an LLM gateway still knows what its runs cost. "--prices" names a LiteLLM price table
  (model_prices_and_context_window.json). A run without spend rows and without its own cost then costs its token
  usage at the table's prices. Input tokens include the cached tokens, as runlog writes them.

  @id=SCN-LEDGER-051 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: A run without cost costs its token usage at the prices of its model
    Given "prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token, 0.000015 per output token, 0.0000003 per cache-read token and 0.00000375 per cache-write token
    And the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens, of them 500000 cache-read and 200000 cache-write, and 100000 output tokens
    When the user runs "ledger report --prices prices.json data.jsonl"
    Then the command exits with code 0
    And "report.json" shows a total spend of 3.30 USD

  @id=SCN-LEDGER-052 @status=implemented
  Scenario: A run's own cost comes before the price table
    Given "prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token
    And the run "run-01" of "claude-sonnet-5-5" with the cost 1.25 USD and 1000000 input tokens
    When the user runs "ledger report --prices prices.json data.jsonl"
    Then "report.json" shows a total spend of 1.25 USD

  @id=SCN-LEDGER-053 @status=implemented
  Scenario: A model the price table does not know is named in the output
    Given "prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token
    And the run "run-01" of "claude-mystery-1" with 1000000 input tokens
    When the user runs "ledger report --prices prices.json data.jsonl"
    Then the command exits with code 0
    And the output says 'no price in prices.json for the model "claude-mystery-1": 1 run without cost'
    And "report.json" shows a total spend of 0.00 USD

  @id=SCN-LEDGER-054 @status=implemented
  Scenario: Cached tokens of a model without cache prices cost the input price
    Given "prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token
    And the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens, of them 500000 cache-read and 200000 cache-write, and 0 output tokens
    When the user runs "ledger report --prices prices.json data.jsonl"
    Then "report.json" shows a total spend of 3.00 USD

  @id=SCN-LEDGER-055 @status=implemented
  Scenario: A price that is no number is refused before anything is written
    Given "prices.json" prices "claude-sonnet-5-5" at "cheap" per input token
    And the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens
    When the user runs "ledger ingest --prices prices.json data.jsonl"
    Then the command exits with code 2
    And the error output names "prices.json", "claude-sonnet-5-5" and "input_cost_per_token"
    And "ledger query 'SELECT count(*) AS runs FROM run_cost'" prints {"runs":0}

  @id=SCN-LEDGER-064 @status=implemented
  Scenario: A price table that is no JSON is refused
    Given "prices.json" with the text "not json"
    And the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens
    When the user runs "ledger report --prices prices.json data.jsonl"
    Then the command exits with code 2
    And the error output says "prices.json: not a LiteLLM price table: an object with one entry per model"
