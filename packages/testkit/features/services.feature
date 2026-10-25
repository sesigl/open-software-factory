@module=testkit @owner=maintainers
Feature: Services and outside systems
  The fakes start real services in containers, a real Forgejo forge and a fake Slack. A module reaches each one
  through the URL its configuration documents; the test reads only what the module produced.

  @id=SCN-TK-008 @status=implemented
  Scenario: fakes.postgres gives the module a reachable PostgreSQL
    Given a module whose CLI sends a PostgreSQL SSL request to "DEMO_DATABASE_URL" and prints the answer
    And its system test passes the URL of fakes.postgres and expects the output "postgres answered N"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-009 @status=implemented
  Scenario: fakes.nats gives the module a reachable NATS server
    Given a module whose CLI connects to "DEMO_NATS_URL" and prints the first word the server sends
    And its system test passes the URL of fakes.nats and expects the output "INFO"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-010 @status=implemented
  Scenario: fakes.temporal gives the module a Temporal server with the namespace "default"
    Given a module whose CLI reads the namespace "default" from the Temporal HTTP API at "DEMO_TEMPORAL_HTTP" and prints its name
    And its system test passes the HTTP URL of fakes.temporal and expects the output "default"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-011 @status=implemented
  Scenario: fakes.s3 gives the module an S3 API that stores objects
    Given a module whose CLI creates the bucket "demo", puts "notes.txt" with "hello" at "DEMO_S3_ENDPOINT" and prints the object it reads back
    And its system test passes the endpoint of fakes.s3 and expects the output "hello"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-012 @status=implemented
  Scenario: fakes.forge shows the comment and the commit status a module posts on a pull request
    Given a module whose CLI comments "evidence bundle attached" and sets the status "proof" to "success" on a pull request at "DEMO_FORGE_URL"
    And its system test opens a pull request in fakes.forge and expects that comment and that status
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-049 @status=implemented
  Scenario: fakes.forge merges a pull request, so a module can read the merge commit
    Given a module whose CLI prints whether a pull request at "DEMO_FORGE_URL" is merged and its merge commit
    And its system test merges a pull request in fakes.forge and expects "merged" and the merge commit it got back
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-080 @status=implemented
  Scenario: fakes.forge delivers a pull request's webhook to a fake for containers
    Given a module whose CLI registers a webhook for pull request events of a repository at "DEMO_FORGE_URL" to the URL it is given
    And its system test passes the container URL of a fake for containers, opens a pull request in fakes.forge and expects a delivery with the event "pull_request"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-081 @status=implemented
  Scenario: fakes.forge creates a branch with a commit and lists the branches and webhooks of a repository
    Given a module whose CLI creates the branch "release" from "main" and a webhook to "http://intake.example/forge" at "DEMO_FORGE_URL"
    And its system test creates the branch "fix" with "notes.md" in fakes.forge and expects the branches "fix", "main" and "release" with their head commits and that webhook
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-082 @status=implemented
  Scenario: fakes.forge reviews a pull request as the person "reviewer"
    Given a module whose CLI prints the user and state of each review of a pull request at "DEMO_FORGE_URL"
    And its system test approves a pull request in fakes.forge and expects "reviewer APPROVED"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-013 @status=implemented
  Scenario: fakes.slack shows the message a module posts
    Given a module whose CLI posts "hello from demo" to the channel "C1" through the Slack Web API at "DEMO_SLACK_URL"
    And its system test passes the URL and token of fakes.slack and expects that message in "C1"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-051 @status=implemented
  Scenario: fakes.slack answers auth.test with the user of the module's messages
    Given a module whose CLI prints the "user_id" of "auth.test" and then the user of the message it posts to "C1"
    And its system test expects the bot user of fakes.slack twice
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-052 @status=implemented
  Scenario: fakes.slack delivers a person's reply to the module's Events API signed with its signing secret
    Given a module whose server checks the Slack signature with "DEMO_SLACK_SIGNING_SECRET" and keeps the text of each "message" event
    And its system test passes the signing secret of fakes.slack, says "approve" in "C1" and expects the server to have "approve"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-053 @status=implemented
  Scenario: fakes.slack presses a button of the module's message and delivers the press to its interactivity URL
    Given a module whose server posts a message with the button "approve" to "C1" and keeps the action ID and user of each signed press
    And its system test presses "approve" as "U0ADA" and expects the server to have "approve U0ADA"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-090 @status=implemented
  Scenario: fakes.slack answers users.info with the person's name and chat.getPermalink with a link to the message
    Given a module whose CLI prints the "real_name" of "users.info" for "U0PERSON" and the "permalink" of the message it posts to "C1"
    And its system test expects "Varun https://testkit.slack.com/archives/C1/p1767225600000001"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-055 @status=implemented
  Scenario: Pressing a button that the message does not have fails the test with the button shown
    Given a module whose server posts a message with the button "approve" to "C1" and keeps the action ID and user of each signed press
    And its system test presses "merge" on that message
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "has no such button: merge"

  @id=SCN-TK-031 @status=implemented
  Scenario: fakes.collector runs the Collector config a module wrote and shows what it exported
    Given a module whose CLI prints a Collector config that renames the span "work" to "done"
    And its system test starts fakes.collector with that config, sends the span "work" and expects the exported span "done"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-032 @status=implemented
  Scenario: fakes.collector shows the Collector log when the Collector exports nothing
    Given a module whose CLI prints a Collector config that drops the span "work"
    And its system test sends the span "work" to fakes.collector and expects one export within 1000 ms
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "expected 1 export(s) from the Collector, got 0"
    And the output contains "Collector log:"

  @id=SCN-TK-050 @status=implemented
  Scenario: fakes.forge shows the pull request a module opens and the files of its branch
    Given a module whose CLI commits "notes.md" with "hello" on the new branch "fix" and opens a pull request "Fix the notes" into "main" at "DEMO_FORGE_URL"
    And its system test expects that pull request in fakes.forge and "notes.md" with "hello" only on the branch "fix"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-096 @status=planned
  Scenario: fakes.forge comments on a pull request as the person "reviewer"
    Given a module whose CLI prints the user and text of each comment of a pull request at "DEMO_FORGE_URL"
    And its system test has "reviewer" say "Looks good" on a pull request in fakes.forge and expects "reviewer Looks good"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
