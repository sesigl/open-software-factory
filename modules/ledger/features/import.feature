@module=ledger @owner=maintainers
Feature: Import pull requests from a forge
  "ledger import" reads the pull requests, reviews and comments of one repository from the API of GitHub or Forgejo
  and writes them as the CloudEvents "pr.opened@v1", "pr.reviewed@v1" and "pr.closed@v1" to a JSON Lines file that
  "ledger ingest" reads. It serves a team that has no forge adapter to publish these events.

  @id=SCN-LEDGER-039 @status=implemented @realizes=SCN-FACTORY-METRIC-003
  Scenario: Import writes the pull requests, reviews, comments and merges of a GitHub repository as events
    Given a GitHub API with the pull request 1 of "acme/web", merged after 1 approval, and the pull request 2, open with 1 comment by a person
    When the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_URL" set to the GitHub API
    Then the command exits with code 0
    And the output says "wrote 5 events of 2 pull requests to"
    And "pr-events.jsonl" holds 2 "pr.opened@v1", 2 "pr.reviewed@v1" and 1 "pr.closed@v1" events

  @id=SCN-LEDGER-040 @status=implemented @realizes=SCN-FACTORY-METRIC-002
  Scenario: The imported events give the report its merges and first human reviews
    Given a GitHub API with a pull request opened at 09:00, approved by a person at 11:00 and merged at 12:00
    When the user runs "ledger import --out pr-events.jsonl https://github.com/acme/web" and then "ledger report pr-events.jsonl"
    Then "report.json" shows 1 pull request opened and 1 merged
    And "report.json" shows the median hours from pull request to first human review 2 and from first human review to merge 1

  @id=SCN-LEDGER-041 @status=implemented
  Scenario: A review by a bot is imported as automated
    Given a GitHub API with a pull request reviewed by the user "renovate[bot]" of type "Bot"
    When the user runs "ledger import https://github.com/acme/web"
    Then "pr-events.jsonl" has a "pr.reviewed@v1" event with "automated" true by the trigger "github:renovate[bot]"

  @id=SCN-LEDGER-042 @status=implemented
  Scenario: Reviews and comments by the author of the pull request are left out
    Given a GitHub API with a pull request by "mona" that "mona" commented on and "hubot" approved
    When the user runs "ledger import https://github.com/acme/web"
    Then "pr-events.jsonl" has 1 "pr.reviewed@v1" event, by "github:hubot"

  @id=SCN-LEDGER-043 @status=implemented
  Scenario: A pull request closed without a merge gives "merged" false
    Given a GitHub API with a pull request closed at 15:00 without a merge
    When the user runs "ledger import https://github.com/acme/web"
    Then "pr-events.jsonl" has a "pr.closed@v1" event at "2026-01-05T15:00:00Z" with "merged" false

  @id=SCN-LEDGER-044 @status=implemented
  Scenario: The option "--since" imports only pull requests updated on or after the day
    Given a GitHub API whose pull requests, newest update first, are the pull request 3 updated on 2026-01-06 and the pull request 2 updated on 2026-01-04
    When the user runs "ledger import --since 2026-01-05 https://github.com/acme/web"
    Then the output says "wrote 1 event of 1 pull request to"
    And the GitHub API received no request for the reviews of the pull request 2

  @id=SCN-LEDGER-045 @status=implemented
  Scenario: Pull requests on more than one page are all imported
    Given a GitHub API with 101 open pull requests, 100 on the first page and 1 on the second
    When the user runs "ledger import https://github.com/acme/web"
    Then the output says "wrote 101 events of 101 pull requests to"

  @id=SCN-LEDGER-046 @status=implemented
  Scenario: The token in "LEDGER_FORGE_TOKEN" is sent with each request
    Given a GitHub API with 1 open pull request
    When the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_TOKEN" set to "test-token"
    Then every request the GitHub API received has the header "authorization" "token test-token"

  @id=SCN-LEDGER-047 @status=implemented
  Scenario: A forge that refuses the token exits 1 without printing the token
    Given a GitHub API that answers 401 to "GET /repos/acme/web/pulls"
    When the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_TOKEN" set to "secret-token"
    Then the command exits with code 1
    And the error output says "ledger: the forge answered 401 to GET /repos/acme/web/pulls"
    And the output and the error output do not contain "secret-token"
    And the output folder has no file "pr-events.jsonl"

  @id=SCN-LEDGER-048 @status=implemented
  Scenario: A Forgejo repository is read through its API v1
    Given a Forgejo repository "tester/web" with the open pull request "Add a sum function"
    When the user runs "ledger import <forge URL>/tester/web"
    Then the command exits with code 0
    And "pr-events.jsonl" has a "pr.opened@v1" event with the pull request's URL, its title "Add a sum function" and its head commit

  @id=SCN-LEDGER-049 @status=implemented
  Scenario: The option "--forge github" reads a GitHub Enterprise repository
    Given a GitHub API with 1 open pull request of "acme/web"
    When the user runs "ledger import --forge github https://github.acme.internal/acme/web" with "LEDGER_FORGE_URL" set to the GitHub API
    Then the command exits with code 0
    And the output says "wrote 1 event of 1 pull request to"

  @id=SCN-LEDGER-050 @status=implemented
  Scenario: A URL that names no repository is refused
    When the user runs "ledger import https://github.com/acme"
    Then the command exits with code 2
    And the error output says "https://github.com/acme: not a repository URL like https://github.com/acme/web"
