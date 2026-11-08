@module=scorekit @owner=maintainers
Feature: Scorer pack
  scorekit ships scorers for common failure modes of coding agents. "--scorer" takes a pack name or a file.

  @id=SCN-SCORE-028 @status=implemented @realizes=SCN-FACTORY-SCORE-004
  Scenario: The pack lists five scorers with their sampling rate and description
    When the user runs "scorekit scorers"
    Then the command exits with code 0
    And the output lists the scorers "redundant-tests", "change-requested", "scope-creep", "skipped-checks" and "needless-human-question"
    And each line shows the scorer's sampling rate and description

  @id=SCN-SCORE-030 @status=implemented
  Scenario: A scorer file without a pass criterion is refused
    Given the scorer file "scorers/vague.md" without the key "pass"
    And the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer scorers/vague.md runs.jsonl"
    Then the command exits with code 2
    And the error output names the file "scorers/vague.md" and the missing key "pass"

  @id=SCN-SCORE-031 @status=implemented
  Scenario: A scorer file whose front matter is not YAML is refused
    Given the scorer file "scorers/broken.md" whose front matter is "pass: [The run is fine."
    And the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer scorers/broken.md runs.jsonl"
    Then the command exits with code 2
    And the error output names the file "scorers/broken.md" and says the front matter is not YAML

  @id=SCN-SCORE-055 @status=implemented
  Scenario: A scorer file with a wrong value or a wrong form is refused with the reason
    Given the runs file "runs.jsonl" with the run "run-01"
    And the scorer file "scorers/wrong-<row>.md" for each row of this table, with the row's text
      | row | text                                                                    | error                                                |
      | 1   | ---\nname: 1st\npass: Fine.\n---\nJudge.                                | "name" must be lowercase letters, digits and hyphens |
      | 2   | ---\nname: twins!\npass: Fine.\n---\nJudge.                             | "name" must be lowercase letters, digits and hyphens |
      | 3   | ---\ndescription: 5\npass: Fine.\n---\nJudge.                           | "description" must be a text                         |
      | 4   | ---\ndescription: "  "\npass: Fine.\n---\nJudge.                        | "description" must be a text                         |
      | 5   | ---\nmodel: ""\npass: Fine.\n---\nJudge.                                | "model" must be a text                               |
      | 6   | ---\nsample: "0.5"\npass: Fine.\n---\nJudge.                            | "sample" must be a number from 0 to 1                |
      | 7   | ---\nsample: -0.1\npass: Fine.\n---\nJudge.                             | "sample" must be a number from 0 to 1                |
      | 8   | ---\nsample: 1.1\npass: Fine.\n---\nJudge.                              | "sample" must be a number from 0 to 1                |
      | 9   | ---\nmax_chars: "300"\npass: Fine.\n---\nJudge.                         | "max_chars" must be a whole number of at least 200   |
      | 10  | ---\nmax_chars: 250.5\npass: Fine.\n---\nJudge.                         | "max_chars" must be a whole number of at least 200   |
      | 11  | ---\nmax_chars: 199\npass: Fine.\n---\nJudge.                           | "max_chars" must be a whole number of at least 200   |
      | 12  | ---\nprice: 3\npass: Fine.\n---\nJudge.                                 | "price" must have the numbers "input" and "output"   |
      | 13  | ---\nprice: null\npass: Fine.\n---\nJudge.                              | "price" must have the numbers "input" and "output"   |
      | 14  | ---\nprice: {input: "3", output: 15}\npass: Fine.\n---\nJudge.          | "price" must have the numbers "input" and "output"   |
      | 15  | ---\nprice: {input: -1, output: 15}\npass: Fine.\n---\nJudge.           | "price" must have the numbers "input" and "output"   |
      | 16  | ---\nprice: {input: 3, output: "15"}\npass: Fine.\n---\nJudge.          | "price" must have the numbers "input" and "output"   |
      | 17  | ---\nprice: {input: 3, output: -1}\npass: Fine.\n---\nJudge.            | "price" must have the numbers "input" and "output"   |
      | 18  | ---\nprice: {input: 3, output: 15, cached: 1}\npass: Fine.\n---\nJudge. | "price" must have the numbers "input" and "output"   |
      | 19  | Judge.                                                                  | no front matter between "---" lines                  |
      | 20  | x\n---\npass: Fine.\n---\nJudge.                                        | no front matter between "---" lines                  |
      | 21  | ---\n- pass\n---\nJudge.                                                | the front matter is not a mapping                    |
      | 22  | ---\njust text\n---\nJudge.                                             | the front matter is not a mapping                    |
      | 23  | ---\npass: Fine.\n---\n   \n                                            | the judge prompt after the front matter is empty     |
    When the user runs "scorekit score --scorer scorers/wrong-<row>.md runs.jsonl" for each row
    Then each command exits with code 2
    And the error output of each command is "scorekit: scorers/wrong-<row>.md: " and the error of its row

  @id=SCN-SCORE-056 @status=implemented
  Scenario: A scorer file with the lowest values allowed is accepted
    Given the scorer file "scorers/lowest.md" with the sampling rate 0, the transcript limit 200 characters and the price 0 USD for input and output tokens
    And the runs file "runs.jsonl" with the run "run-01"
    And a model gateway without a scripted answer
    When the user runs "scorekit score --scorer scorers/lowest.md runs.jsonl"
    Then the command exits with code 0
    And the output is "scored 0 of 1 runs with lowest: 0 pass, 0 fail"

  @id=SCN-SCORE-057 @status=implemented
  Scenario: The pack list puts the sampling rates of all scorers in one column
    When the user runs "scorekit scorers"
    Then the command exits with code 0
    And each line has the sampling rate two spaces after the longest scorer name
