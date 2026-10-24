@port=forge @owner=maintainers
Feature: Branches, pull requests, checks, merge rules and webhooks on any forge
  A forge adapter is a program with the commands branch, open-pr, pr, check, comment, protect, merge, webhook and
  event. It reaches the forge at FORGE_URL with the token FORGE_TOKEN, and signs and checks webhooks with
  FORGE_WEBHOOK_SECRET. A repository is "<owner>/<name>". event turns one webhook delivery into a pr.opened@v1,
  pr.reviewed@v1 or pr.closed@v1 CloudEvent from contracts (ADR 0057). The test forge is a real Forgejo with the user
  "tester" and the repository "tester/web", whose branch "main" holds one commit.

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
