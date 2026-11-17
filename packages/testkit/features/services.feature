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

  @id=SCN-TK-125 @status=implemented
  Scenario: A stopped fakes.postgres refuses the module's connection
    Given a module whose CLI sends a PostgreSQL SSL request to "DEMO_DATABASE_URL" and prints the answer
    And its system test stops fakes.postgres before it runs the module and expects the output to say "ECONNREFUSED"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-127 @status=implemented
  Scenario: A test may stop fakes.postgres while a client holds a transaction open
    Given a module whose system test begins a transaction on fakes.postgres and then stops fakes.postgres
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-152 @status=implemented
  Scenario: fakes.postgres gives a later scenario the same PostgreSQL server and a database of its own
    Given a module whose two scenarios in one test file each create the table "notes" in fakes.postgres and expect the answer "CREATE TABLE"
    And its second scenario expects one container with the label "org.opensoftware.run" of its run
    When the developer runs "testkit run --junit report.xml" with OSF_TESTKIT_RUN set to an ID of this test run in the module
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"

  @id=SCN-TK-129 @status=implemented
  Scenario: The containers of the fakes carry the label of the run that OSF_TESTKIT_RUN names
    Given a module whose system test starts fakes.s3 and expects that the label "org.opensoftware.run=r7" finds its container
    When the developer runs "testkit run --junit report.xml" with OSF_TESTKIT_RUN "r7" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-130 @status=implemented
  Scenario: The module's processes reach Docker through the Docker settings of the machine
    Given a module whose CLI prints "DOCKER_HOST" and "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"
    And its system test expects the output "unix:///run/demo/docker.sock /var/run/docker.sock"
    When the developer runs "testkit run --junit report.xml" with DOCKER_HOST "unix:///run/demo/docker.sock" and TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE "/var/run/docker.sock" in the module
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

  @id=SCN-TK-153 @status=implemented
  Scenario: fakes.temporal gives a later scenario the same Temporal server and a namespace of its own
    Given a module whose CLI reads the namespace "DEMO_TEMPORAL_NAMESPACE" from the Temporal HTTP API at "DEMO_TEMPORAL_HTTP" and prints its name
    And its two scenarios in one test file each pass the HTTP URL and the namespace of fakes.temporal and expect that namespace as the output
    And its second scenario expects the address of the first and another namespace
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"

  @id=SCN-TK-142 @status=implemented
  Scenario: fakes.temporal and fakes.nats listen below the range of module ports
    Given a module whose system test starts fakes.temporal and fakes.nats and expects each of their ports between 10000 and 19999
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-177 @status=implemented
  Scenario: fakes.openbao gives the module OpenBao with a KV version 2 mount of the scenario and a token with a policy
    Given a module whose CLI writes "demo" with the value "bao_test_1" to the mount "DEMO_BAO_MOUNT" of OpenBao at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the status and the token's "ttl"
    And its system test passes a token of fakes.openbao whose policy may write the mount, expects the status 200 and reads "demo" back with the value "bao_test_1" and the version 1
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-178 @status=implemented
  Scenario: A token of fakes.openbao has only its policy and lives as long as the test says
    Given a module whose CLI writes "demo" with the value "bao_test_1" to the mount "DEMO_BAO_MOUNT" of OpenBao at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the status and the token's "ttl"
    And its system test passes a token of fakes.openbao whose policy may only read the mount and that lives "10m", and expects the status 403 and a "ttl" of at most 600 seconds and more than 590
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-179 @status=implemented
  Scenario: fakes.openbao gives a later scenario the same server and a mount of its own
    Given a module whose two scenarios in one test file each start fakes.openbao
    And its first scenario writes "demo" into its mount
    And its second scenario expects the address of the first, another mount, and no "demo" in its mount
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"

  @id=SCN-TK-180 @status=implemented
  Scenario: fakes.openbao for containers answers a container at its container URL
    Given a module whose CLI runs curl in a container for the secret "demo" of the mount "DEMO_BAO_MOUNT" at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the body
    And its system test writes "demo" with the value "bao_test_1" to fakes.openbao for containers, passes its container URL and a token whose policy may read the mount, and expects "bao_test_1" in the output
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
    Given a pull request in fakes.forge
    When a module comments "evidence bundle attached" and sets the status "proof" to "success" on it through the forge's API
    Then fakes.forge shows that comment and that status

  @id=SCN-TK-049 @status=implemented
  Scenario: fakes.forge merges a pull request, so a module can read the merge commit
    Given a pull request that the test merged in fakes.forge, and the merge commit it got back
    When a module reads the pull request through the forge's API
    Then the pull request is merged with that merge commit

  @id=SCN-TK-080 @status=implemented
  Scenario: fakes.forge delivers a pull request's webhook to a fake for containers
    Given a fake for containers and the repository "demo" in fakes.forge
    When a module registers a webhook for pull request events of "demo" to the container URL of that fake through the forge's API
    And the test opens a pull request in fakes.forge
    Then the fake for containers gets a "pull_request" delivery

  @id=SCN-TK-081 @status=implemented
  Scenario: fakes.forge creates a branch with a commit and lists the branches and webhooks of a repository
    Given the repository "demo" in fakes.forge, in which the test created the branch "fix" with "notes.md"
    When a module creates the branch "release" from "main" and a webhook to "http://intake.example/forge" through the forge's API
    Then fakes.forge lists the branches "fix", "main" and "release" with their head commits, and that webhook

  @id=SCN-TK-082 @status=implemented
  Scenario: fakes.forge reviews a pull request as the person "reviewer"
    Given a pull request in fakes.forge that the test approved as the person "reviewer"
    When a module reads the reviews of the pull request through the forge's API
    Then the pull request has one review, "reviewer APPROVED"

  @id=SCN-TK-101 @status=implemented
  Scenario: fakes.forge gives a later scenario the same forge without the repositories of the earlier one
    Given a module whose CLI prints the number of pull requests of a repository at "DEMO_FORGE_URL"
    And its two scenarios in one test file each create the repository "demo" in fakes.forge, open a pull request and expect "1"
    And its second scenario expects the forge URL of the first
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"

  @id=SCN-TK-013 @status=implemented
  Scenario: fakes.slack shows the message a module posts
    Given fakes.slack
    When a module posts "hello from demo" to the channel "C1" through the Slack Web API of the fake with its token
    Then "C1" has the message "hello from demo"

  @id=SCN-TK-116 @status=implemented
  Scenario: fakes.slack for containers shows the message a module posts from a container
    Given a module whose CLI runs curl in a container that posts "hello from a container" to the channel "C1" through the Slack Web API at "DEMO_SLACK_URL"
    And its system test passes the container URL and token of fakes.slack for containers and expects that message in "C1"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-051 @status=implemented
  Scenario: fakes.slack answers auth.test with the user of the module's messages
    Given fakes.slack
    When a module gets the "user_id" of "auth.test", posts a message to "C1" and reads the user of that message from "conversations.history"
    Then both name the bot user of fakes.slack

  @id=SCN-TK-052 @status=implemented
  Scenario: fakes.slack delivers a person's reply to the module's Events API signed with its signing secret
    Given fakes.slack that delivers events to a URL of fakes.http
    When a person says "approve" in "C1"
    Then the URL got one "message" event with the text "approve", signed with the signing secret of fakes.slack

  @id=SCN-TK-053 @status=implemented
  Scenario: fakes.slack presses a button of the module's message and delivers the press to its interactivity URL
    Given a message with the button "approve" that a module posted to "C1", and fakes.slack that delivers presses to a URL of fakes.http
    When "U0ADA" presses "approve" in "C1"
    Then the URL got one press of "approve" by "U0ADA", signed with the signing secret of fakes.slack

  @id=SCN-TK-090 @status=implemented
  Scenario: fakes.slack answers users.info with the person's name and chat.getPermalink with a link to the message
    Given fakes.slack
    When a module gets the "real_name" of "users.info" for "U0PERSON" and the "permalink" of the message it posts to "C1"
    Then they are "Varun https://testkit.slack.com/archives/C1/p1767225600000001"

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

  @id=SCN-TK-149 @status=implemented
  Scenario: fakes.traceStore answers Jaeger's query of a trace with the span it received by OTLP, and keeps none with "keep: false"
    Given fakes.traceStore, and fakes.traceStore with "keep: false"
    When a module sends the span "ping" of the service "demo" by OTLP/HTTP to each store and asks Jaeger's query API of that store for its trace
    Then the first store answers with the span "ping" and the second with the status 404, and both received the span

  @id=SCN-TK-050 @status=implemented
  Scenario: fakes.forge shows the pull request a module opens and the files of its branch
    Given the repository "demo" in fakes.forge
    When a module commits "notes.md" with "hello" on the new branch "fix" and opens a pull request "Fix the notes" into "main" through the forge's API
    Then fakes.forge shows the pull request "Fix the notes" from "fix" into "main" and "notes.md" with "hello" only on "fix"

  @id=SCN-TK-097 @status=implemented
  Scenario: fakes.forge comments on a pull request as the person "reviewer"
    Given a pull request in fakes.forge on which the test had "reviewer" say "Looks good"
    When a module reads the comments of the pull request through the forge's API
    Then the pull request has one comment, "reviewer Looks good"

  @id=SCN-TK-100 @status=implemented
  Scenario: fakes.slack lists the messages at the top of a channel newest first, without the replies in threads
    Given fakes.slack
    When a module posts "first" and "second" to "C1", replies "in thread" to "first" and reads the texts of "conversations.history"
    Then the texts are "second first"

  @id=SCN-TK-103 @status=implemented
  Scenario: fakes.forge opens an issue and adds a label to it
    Given the issue "Export reports as CSV" that the test opened in fakes.forge and gave the label "factory"
    When a module reads the issue through the forge's API
    Then issue 1 has the title "Export reports as CSV" and the one label "factory"

  @id=SCN-TK-104 @status=implemented
  Scenario: fakes.sentry sends a module's webhook an alert signed with the integration's client secret
    Given fakes.sentry and a webhook of fakes.http
    When fakes.sentry sends the webhook the alert "TypeError: total is undefined" of level "fatal"
    Then the webhook got one alert "TypeError: total is undefined fatal" whose Sentry-Hook-Signature matches the client secret
