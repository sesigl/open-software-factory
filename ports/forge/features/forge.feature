@port=forge @owner=maintainers
Feature: Branches, pull requests, checks, merge rules and webhooks on any forge
  A forge adapter is a program with the commands branch, open-pr, pr, prs, check, comment, protect, merge, webhook,
  hooks, unhook, comments and event. It reaches the forge at FORGE_URL with the token FORGE_TOKEN, and signs and checks webhooks with
  FORGE_WEBHOOK_SECRET. A repository is "<owner>/<name>". event turns one webhook delivery into a pr.opened@v1,
  pr.reviewed@v1 or pr.closed@v1 CloudEvent from contracts (ADR 0057), and a label added to an issue into an
  issue.labeled@v1 (ADR 0065). The test forge has the user "tester" and the
  repository "tester/web", whose branch "main" holds one commit: a real Forgejo for the forgejo adapter, and the
  testkit's fake GitHub for the github adapter (ADR 0058). webhook takes the port's event names, such as
  "issue.labeled" or "push", and each adapter maps them to its forge's events (ADR 0060). pr names the author,
  labels and changed files, and comments lists a pull request's conversation, which gatekeeper reads (ADR 0062). prs
  lists the pull requests whose branch starts with a prefix, with their review state, which the console's inbox reads
  (ADR 0073).

  @id=SCN-FORGE-001 @status=implemented @conformance
  Scenario: A branch starts at the head commit of the default branch
    Given the repository "tester/web"
    When the client runs "branch tester/web fix-checkout"
    Then the test forge has the branch "fix-checkout" at the head commit of "main"
    And branch prints the branch "fix-checkout" with that commit

  @id=SCN-FORGE-002 @status=implemented @conformance
  Scenario: A branch that exists is refused
    Given the repository "tester/web" with the branch "fix-checkout"
    When the client runs "branch tester/web fix-checkout"
    Then branch exits with code 1 and the error "branch fix-checkout exists"

  @id=SCN-FORGE-003 @status=implemented @conformance @realizes=SCN-FACTORY-OPEN-005
  Scenario: A pull request opens from a branch into the default branch
    Given the repository "tester/web" with the branch "fix-checkout" that changes "checkout.js"
    When the client runs "open-pr tester/web fix-checkout" with the title "Fix checkout button on Safari" and the body "Closes #12"
    Then the test forge has an open pull request from "fix-checkout" into "main" with that title and body
    And open-pr prints its number, its URL and the head commit of "fix-checkout"

  @id=SCN-FORGE-004 @status=implemented @conformance
  Scenario: A check is posted on a commit
    Given an open pull request in "tester/web"
    When the client runs "check" on its head commit with the name "verify", the state "failure" and the description "2 scenarios failed"
    Then the test forge shows the status "verify" with "failure" and "2 scenarios failed" on the pull request's head commit

  @id=SCN-FORGE-005 @status=implemented @conformance
  Scenario: A comment is posted on a pull request
    Given an open pull request in "tester/web"
    When the client runs "comment" on it with the text "Evidence: 14 scenarios passed"
    Then the test forge shows the comment "Evidence: 14 scenarios passed" on the pull request
    And comment prints the comment's ID and URL

  @id=SCN-FORGE-006 @status=implemented @conformance
  Scenario: pr reads the merge state of an open pull request with its checks
    Given an open pull request in "tester/web" whose head commit has the status "verify" with "success"
    When the client runs "pr" for it
    Then pr prints the state "open", "mergeable" true, the head commit and the check "verify" with "success"

  @id=SCN-FORGE-007 @status=implemented @conformance
  Scenario: pr reads the merge commit of a merged pull request
    Given a pull request in "tester/web" that a person merged
    When the client runs "pr" for it
    Then pr prints the state "merged" and the merge commit

  @id=SCN-FORGE-008 @status=implemented @conformance
  Scenario: A merge is refused while a required check fails
    Given the client ran "protect tester/web main --check verify"
    And an open pull request in "tester/web" whose head commit has the status "verify" with "failure"
    When the client runs "merge" for it
    Then merge exits with code 1 and an error that names the pull request's number
    And the pull request is still open on the test forge

  @id=SCN-FORGE-009 @status=implemented @conformance @realizes=SCN-FACTORY-LOOP-009
  Scenario: A pull request whose required check passed is merged
    Given the client ran "protect tester/web main --check verify"
    And an open pull request in "tester/web" whose head commit has the status "verify" with "success"
    When the client runs "merge" for it with the method "squash"
    Then merge prints the merge commit
    And the test forge shows the pull request merged with that commit
    And "main" on the test forge holds the pull request's change

  @id=SCN-FORGE-010 @status=implemented @conformance
  Scenario: A merge rule that asks for an approval refuses a pull request nobody approved
    Given the client ran "protect tester/web main --approvals 1"
    And an open pull request in "tester/web"
    When the client runs "merge" for it
    Then merge exits with code 1
    And the pull request is still open on the test forge

  @id=SCN-FORGE-011 @status=implemented @conformance
  Scenario: A webhook is registered for pull request events
    When the client runs "webhook tester/web http://intake.example/forge"
    Then the test forge has one active webhook of "tester/web" to "http://intake.example/forge" for pull request events

  @id=SCN-FORGE-012 @status=implemented @conformance
  Scenario: Registering the same webhook URL twice keeps one webhook
    Given the client ran "webhook tester/web http://intake.example/forge"
    When the client runs "webhook tester/web http://intake.example/forge" again
    Then the test forge has one webhook of "tester/web" to "http://intake.example/forge"

  @id=SCN-FORGE-013 @status=implemented @conformance
  Scenario: A delivery of an opened pull request becomes a pr.opened event
    Given a webhook the client registered for "tester/web" at a receiver with the secret "whsec-51c2"
    When "tester" opens the pull request "Fix checkout button on Safari" from "fix-checkout"
    And the client runs "event" on the delivery the receiver got
    Then event prints a "pr.opened@v1" CloudEvent that the contract accepts
    And its data names the number, the title, "fix-checkout", "main", the head commit and the author "tester"

  @id=SCN-FORGE-014 @status=implemented @conformance
  Scenario: A delivery of an approval becomes a pr.reviewed event
    Given a webhook the client registered for "tester/web" at a receiver with the secret "whsec-51c2"
    And an open pull request in "tester/web"
    When the person "reviewer" approves the pull request
    And the client runs "event" on the review's delivery
    Then event prints a "pr.reviewed@v1" CloudEvent with the state "approved" and the reviewer "reviewer"

  @id=SCN-FORGE-015 @status=implemented @conformance
  Scenario: A delivery of a merged pull request becomes a pr.closed event
    Given a webhook the client registered for "tester/web" at a receiver with the secret "whsec-51c2"
    And an open pull request in "tester/web"
    When a person merges the pull request
    And the client runs "event" on the delivery of the close
    Then event prints a "pr.closed@v1" CloudEvent with "merged" true and the merge commit

  @id=SCN-FORGE-016 @status=implemented @conformance
  Scenario: A delivery whose signature does not match the secret is refused
    Given a delivery the receiver got from a webhook with the secret "whsec-51c2"
    When the client runs "event" on it with "FORGE_WEBHOOK_SECRET" set to "whsec-other"
    Then event exits with code 1 and an error that names the signature
    And event prints no event

  @id=SCN-FORGE-017 @status=implemented @conformance
  Scenario: A delivery about a comment gives no event
    Given a webhook the client registered for "tester/web" at a receiver with the secret "whsec-51c2"
    And an open pull request in "tester/web"
    When "tester" comments on the pull request
    And the client runs "event" on the comment's delivery
    Then event exits with code 0 and prints nothing

  @id=SCN-FORGE-018 @status=implemented @conformance
  Scenario: A token the forge refuses is named in the error
    Given the repository "tester/web"
    When the client runs "pr tester/web 1" with the token "not-a-token"
    Then pr exits with code 1 and the error "the forge refused the token"

  @id=SCN-FORGE-019 @status=implemented @conformance
  Scenario: A repository the forge does not have is named in the error
    When the client runs "branch tester/shop fix-checkout"
    Then branch exits with code 1 and the error "no repository tester/shop"

  @id=SCN-FORGE-020 @status=implemented @conformance
  Scenario: Setting the merge rules of a branch again replaces them
    Given the client ran "protect tester/web main --check verify"
    And an open pull request in "tester/web" whose head commit has the status "verify" with "failure"
    When the client runs "protect tester/web main" with no check
    And the client runs "merge" for the pull request
    Then merge prints the merge commit

  @id=SCN-FORGE-021 @status=implemented @conformance
  Scenario: A pull request that conflicts with its base is not mergeable and is not merged
    Given the branch "fix-checkout" of "tester/web" that creates "checkout.js"
    And a person merged another pull request into "main" that creates "checkout.js" with other content
    And the client opened a pull request from "fix-checkout"
    When the client runs "pr" and "merge" for it
    Then pr prints "mergeable" false
    And merge exits with code 1 and an error that names the conflict
    And the pull request is still open on the test forge

  @id=SCN-FORGE-022 @status=implemented @conformance @realizes=SCN-FACTORY-AUTO-002
  Scenario: A webhook is registered for the events the client names
    When the client runs "webhook tester/web http://intake.example/forge --event issue.labeled --event push"
    Then the test forge has one active webhook of "tester/web" to "http://intake.example/forge" for the label events of issues and for pushes
    And webhook prints the webhook's ID, its URL, the forge's names of these events and that it is active

  @id=SCN-FORGE-023 @status=implemented @conformance
  Scenario: Registering a webhook URL again with other events replaces its events
    Given the client ran "webhook tester/web http://intake.example/forge --event push"
    When the client runs "webhook tester/web http://intake.example/forge --event issue_comment"
    Then the test forge has one webhook of "tester/web" to "http://intake.example/forge" for comment events only

  @id=SCN-FORGE-024 @status=implemented @conformance
  Scenario: hooks lists the webhooks of a repository
    Given the client ran "webhook tester/web http://intake.example/forge --event push"
    When the client runs "hooks tester/web"
    Then hooks prints one line with the same ID, URL, events and active flag that webhook printed

  @id=SCN-FORGE-025 @status=implemented @conformance
  Scenario: unhook removes a webhook
    Given the client ran "webhook tester/web http://intake.example/forge"
    When the client runs "unhook" with the ID that webhook printed
    Then unhook prints the ID and "removed" true
    And the test forge has no webhook of "tester/web"

  @id=SCN-FORGE-026 @status=implemented @conformance
  Scenario: Removing a webhook the repository does not have is not an error
    Given the repository "tester/web" without webhooks
    When the client runs "unhook tester/web 424242"
    Then unhook exits with code 0 and prints the ID 424242 and "removed" false

  @id=SCN-FORGE-027 @status=implemented @conformance
  Scenario: pr names the author, the labels, the draft flag and the changed files of a pull request
    Given the repository "tester/web" with the branch "fix-checkout" that changes "checkout.js"
    And the client opened a pull request from "fix-checkout"
    When the client runs "pr" for it
    Then pr prints the author "tester" behind the adapter's name, no labels and "draft" false
    And pr prints the paths "checkout.js"

  @id=SCN-FORGE-028 @status=implemented @conformance
  Scenario: comments lists the conversation of a pull request, oldest first
    Given an open pull request in "tester/web"
    And the client ran "comment" on it with the text "Evidence: 14 scenarios passed"
    And the person "reviewer" commented "Looks good" on it later
    When the client runs "comments" for it
    Then comments prints two lines with the texts "Evidence: 14 scenarios passed" and "Looks good" in that order
    And the first line has the author "tester" behind the adapter's name and "mine" true
    And the second line has the author "reviewer" behind the adapter's name and "mine" false
    And each line has the comment's ID, URL and time

  @id=SCN-FORGE-029 @status=implemented @conformance
  Scenario: A pull request the repository does not have is named in the error
    Given the repository "tester/web" without pull requests
    When the client runs "comments tester/web 42"
    Then comments exits with code 1 and the error "no pull request tester/web#42"

  @id=SCN-FORGE-030 @status=implemented @conformance @realizes=SCN-FACTORY-ACCESS-001
  Scenario: A delivery of a label on an issue becomes an issue.labeled event
    Given a webhook the client registered for "tester/web" with "--event issue.labeled" at a receiver with the secret "whsec-51c2"
    And the issue "Export reports as CSV" in "tester/web" with the body "Finance needs the monthly report as CSV"
    When "tester" adds the label "factory" to the issue
    And the client runs "event" on the delivery of the label
    Then event prints an "issue.labeled@v1" CloudEvent that the contract accepts
    And its data names the issue's link, number, title, body, the author "tester" and the labels "factory"

  @id=SCN-FORGE-031 @status=planned @conformance
  Scenario: prs lists the open pull requests whose branch starts with a prefix, newest first
    Given open pull requests in "tester/web" from "observer/triage-inline-1a2b3c4d", "fix-checkout" and "observer/review-scope-5e6f7a8b" in this order
    When the client runs "prs tester/web --head observer/"
    Then prs prints two lines with the branches "observer/review-scope-5e6f7a8b" and "observer/triage-inline-1a2b3c4d" in that order
    And each line has the pull request's number, URL, title, base "main", the state "open", "draft" false and the author "tester" behind the adapter's name
    And each line has the time the pull request was opened

  @id=SCN-FORGE-032 @status=planned @conformance
  Scenario: prs names the review state of each pull request
    Given open pull requests in "tester/web" from "observer/triage-inline-1a2b3c4d", "observer/review-scope-5e6f7a8b" and "observer/ship-notes-9c0d1e2f"
    And the person "reviewer" approved the first and asked for changes on the second
    When the client runs "prs tester/web --head observer/"
    Then prs prints the review "approved" for the first, "changes_requested" for the second and "none" for the third

  @id=SCN-FORGE-033 @status=planned @conformance
  Scenario: A merged pull request is listed only with "--state all"
    Given a pull request in "tester/web" from "observer/triage-inline-1a2b3c4d" that a person merged
    When the client runs "prs tester/web" and "prs tester/web --state all"
    Then the first prints nothing
    And the second prints the pull request with the state "merged"
