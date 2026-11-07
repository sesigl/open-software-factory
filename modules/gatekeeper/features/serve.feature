@module=gatekeeper @owner=maintainers
Feature: Serve the gate API
  "gatekeeper serve" takes requests over HTTP, asks in Slack with buttons, decides on Slack's events and button
  presses without polling, and publishes its events through a PostgreSQL outbox (ADR 0048). With the forge token, it
  asks on the pull request that a request links, and reads the comments of the pull request at an interval (ADR 0080).

  @id=SCN-GATE-041 @status=implemented @realizes=SCN-FACTORY-ORCH-003
  Scenario: A program asks for approval over HTTP and the server asks in Slack with buttons
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When a program posts the README request to "/v1/gates" with the API token
    Then the answer has the status 201 and a gate in the state "pending" that waits for "maintainers"
    And the Slack channel "C0GATES" has a message that asks "maintainers" with the buttons "Approve" and "Reject"

  @id=SCN-GATE-042 @status=implemented
  Scenario: The same request twice answers the same gate and asks only once
    Given the server asked for approval of the README request in the Slack channel "C0GATES"
    When a program posts the README request to "/v1/gates" again
    Then the answer has the status 200 and the same gate ID
    And the Slack channel "C0GATES" has one approval request

  @id=SCN-GATE-043 @status=implemented
  Scenario: A request without a summary gets the status 400 and names the field
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When a program posts a request without "summary" to "/v1/gates"
    Then the answer has the status 400 and a problem whose detail names the field "summary"
    And the Slack channel "C0GATES" has no message

  @id=SCN-GATE-044 @status=implemented
  Scenario: A call without the API token gets the status 401
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When a program posts the README request to "/v1/gates" without the API token
    Then the answer has the status 401
    And the Slack channel "C0GATES" has no message

  @id=SCN-GATE-045 @status=implemented
  Scenario: A gate the server does not know gets the status 404
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When a program gets "/v1/gates/g0123456789abcdef"
    Then the answer has the status 404 and a problem whose detail names "g0123456789abcdef"

  @id=SCN-GATE-046 @status=implemented
  Scenario: A policy that names no approver group approves a request over HTTP at once
    Given the server runs with a policy whose "approvers" is empty for the channel "slack:C0GATES"
    When a program posts a request for a change of "docs/guide.md" to "/v1/gates"
    Then the answer has the status 201 and a gate in the state "approved"
    And the gate's record has the decision "approved" by the trigger "policy:policy.rego"
    And the Slack channel "C0GATES" has no message

  @id=SCN-GATE-047 @status=implemented @realizes=SCN-FACTORY-IMPROVE-003
  Scenario: A member of the approver group presses "Approve"
    Given the server, with a signing key, asked "maintainers" for approval of the README request
    When "slack:U0ADA" of "maintainers" presses "Approve" on the request
    Then "/v1/gates/<gate>" shows the state "approved" and a record approved by the person "slack:U0ADA"
    And the record verifies with "gatekeeper verify" and the public key
    And the thread has the reply "Approved by <@U0ADA>."

  @id=SCN-GATE-048 @status=implemented
  Scenario: A member rejects with a reason in the thread
    Given the server asked "maintainers" for approval of the README request
    When "slack:U0ADA" of "maintainers" replies "reject Needs a security review" in the thread
    Then "/v1/gates/<gate>" shows the state "rejected" and a record with the reason "Needs a security review"
    And the thread has the reply "Rejected by <@U0ADA>: Needs a security review."

  @id=SCN-GATE-049 @status=implemented
  Scenario: A press of "Approve" by a person outside the approver group is refused
    Given the server asked "maintainers" for approval of the README request
    When "slack:U0BEN" of "reviewers" presses "Approve" on the request
    Then "/v1/gates/<gate>" shows the state "pending" that waits for "maintainers"
    And the thread has the reply "<@U0BEN> is not in maintainers, so this decision does not count."

  @id=SCN-GATE-050 @status=implemented
  Scenario: A second press after the decision changes nothing
    Given the server asked "maintainers" for approval of the README request
    And "slack:U0ADA" of "maintainers" pressed "Approve" on the request
    When "slack:U0ADA" presses "Reject" on the request
    Then "/v1/gates/<gate>" shows the state "approved"
    And the thread has one reply, "Approved by <@U0ADA>."

  @id=SCN-GATE-051 @status=implemented
  Scenario: A Slack request with a wrong signature gets the status 401 and decides nothing
    Given the server asked "maintainers" for approval of the README request
    When a "message" event "approve" by "U0ADA" in the thread arrives with a wrong signature
    Then the answer has the status 401
    And "/v1/gates/<gate>" shows the state "pending" that waits for "maintainers"

  @id=SCN-GATE-052 @status=implemented
  Scenario: Slack's URL verification gets its challenge back
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When Slack sends the signed "url_verification" with the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"
    Then the answer has the status 200 and the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"

  @id=SCN-GATE-053 @status=implemented
  Scenario: The server asks the escalation group when it starts after the escalation time
    Given the server asked "maintainers" for approval of the README request at "2026-01-01T00:00:00Z"
    When the server starts again at "2026-01-01T05:00:00Z"
    Then the thread has a reply that asks "leads" after "4h" without a decision
    And "/v1/gates/<gate>" shows the state "pending" that waits for "leads" and "maintainers"

  @id=SCN-GATE-054 @status=implemented
  Scenario: The server expires a gate when it starts after "expire_after"
    Given the server asked "maintainers" for approval of the README request at "2026-01-01T00:00:00Z"
    When the server starts again at "2026-01-03T00:00:01Z"
    Then "/v1/gates/<gate>" shows the state "expired" and a record with the decision "expired"
    And the thread has a reply that starts with "Expired at 2026-01-03T00:00:00.000001Z"

  @id=SCN-GATE-055 @status=implemented
  Scenario: A request over HTTP is published as the event "gate.requested@v1"
    Given the server runs with "GATEKEEPER_NATS_URL" set to a NATS server
    When a program posts the README request to "/v1/gates" with the API token
    Then the event "gate.requested@v1" arrives on "osf.gate.requested.v1" with the approver group "maintainers"

  @id=SCN-GATE-056 @status=implemented
  Scenario: A decision in Slack is published as the event "gate.decided@v1"
    Given the server, with "GATEKEEPER_NATS_URL" set to a NATS server, asked "maintainers" for approval of the README request
    When "slack:U0ADA" of "maintainers" presses "Approve" on the request
    Then the event "gate.decided@v1" arrives on "osf.gate.decided.v1" with the decision "approved" by "slack:U0ADA"

  @id=SCN-GATE-057 @status=implemented
  Scenario: An event of a time when NATS was unreachable is published once the server reaches NATS
    Given the server, with "GATEKEEPER_NATS_URL" set to a port where no NATS listens, asked "maintainers" for approval of the README request
    When the server starts again with "GATEKEEPER_NATS_URL" set to a NATS server
    Then the event "gate.requested@v1" arrives on "osf.gate.requested.v1" once

  @id=SCN-GATE-058 @status=implemented
  Scenario: The server without a database exits with code 2 and names the variable
    Given the README policy and groups
    When the user runs "gatekeeper serve" for the channel "slack:C0GATES" without "GATEKEEPER_DATABASE_URL"
    Then the command exits with code 2
    And the error output says "set GATEKEEPER_DATABASE_URL"

  @id=SCN-GATE-063 @status=implemented
  Scenario: A request that links a pull request is asked in a comment on the pull request
    Given the server runs with "GATEKEEPER_FORGE_TOKEN" and without a Slack channel
    When a program posts a request that links the pull request "acme/web#12" to "/v1/gates"
    Then the answer has the status 201 and a gate in the state "pending" for the channel "https://github.com/acme/web/pull/12"
    And the pull request has a comment that asks "maintainers" to approve with "/approve"
    And the head commit of the pull request has the commit status "gatekeeper" with the state "pending"

  @id=SCN-GATE-064 @status=implemented
  Scenario: An "/approve" comment of a maintainer approves the gate and is published as "gate.decided@v1"
    Given the server, with "GATEKEEPER_NATS_URL" set to a NATS server, asked "maintainers" on the pull request "acme/web#12"
    When "github:sesigl" of "maintainers" comments "/approve" on the pull request
    Then "/v1/gates/<gate>" shows the state "approved" and a record approved by the person "github:sesigl"
    And the event "gate.decided@v1" arrives on "osf.gate.decided.v1" with the decision "approved" by "github:sesigl"
    And the head commit of the pull request has the commit status "gatekeeper" with the state "success" and the description "approved by github:sesigl"

  @id=SCN-GATE-065 @status=implemented
  Scenario: A "/reject" comment of a maintainer rejects the gate with the reason
    Given the server asked "maintainers" on the pull request "acme/web#12"
    When "github:sesigl" of "maintainers" comments "/reject Breaks the release" on the pull request
    Then "/v1/gates/<gate>" shows the state "rejected" and a record with the reason "Breaks the release"
    And the pull request has the comment "Rejected by @sesigl: Breaks the release."
    And the head commit of the pull request has the commit status "gatekeeper" with the state "failure"

  @id=SCN-GATE-066 @status=implemented
  Scenario: A request without a pull request link on a server without Slack gets the status 400
    Given the server runs with "GATEKEEPER_FORGE_TOKEN" and without a Slack channel
    When a program posts a request that links only the issue "acme/web#7" to "/v1/gates"
    Then the answer has the status 400 and a problem whose detail says "the request links no pull request"
    And the forge has no comment and no commit status

  @id=SCN-GATE-067 @status=implemented
  Scenario: The server without a Slack channel and without the forge token exits with code 2
    Given the README policy and groups
    When the user runs "gatekeeper serve" without "--channel" and without "GATEKEEPER_FORGE_TOKEN"
    Then the command exits with code 2
    And the error output says "serve needs a Slack channel, like --channel slack:C0GATES, or GATEKEEPER_FORGE_TOKEN"

  @id=SCN-GATE-068 @status=implemented
  Scenario: A failed read of the pull request's comments keeps the gate pending, and a later read decides it
    Given the server asked "maintainers" on the pull request "acme/web#12"
    And the forge answers the reads of its comments with the status 502
    When the forge answers again and "github:sesigl" of "maintainers" comments "/approve" on the pull request
    Then "/v1/gates/<gate>" shows the state "approved" with a record approved by the person "github:sesigl"

  @id=SCN-GATE-069 @status=implemented
  Scenario: The server goes on serving when its database fails during a check of the pull request gates
    Given the server asked "maintainers" on the pull request "acme/web#12"
    When its database stops
    Then after ten checks of the pull request gates the server still answers "/v1/gates/<gate>", with the status 500

  @id=SCN-GATE-070 @status=implemented
  Scenario: The server goes on serving when its database stops in the middle of a pull request gate's check
    Given the server asked "maintainers" on the pull request "acme/web#12"
    And the forge holds the server's next read of the pull request's comments
    When its database stops
    And the forge answers the read
    Then the server answers "/v1/gates/<gate>" with the status 500

  @id=SCN-GATE-089 @status=implemented
  Scenario: The server with a wrong setting exits with code 2 and names the setting
    Given the README policy and groups
    When the user runs "gatekeeper serve" for the channels "slack:c0gates", "xslack:C0GATES" and "slack:C0GATES#x", and for "slack:C0GATES" without "GATEKEEPER_API_TOKEN", without "GATEKEEPER_SLACK_TOKEN", without "GATEKEEPER_SLACK_SIGNING_SECRET" and with "GATEKEEPER_SIGNING_KEY" set to "not a key"
    Then each command exits with code 2
    And the error outputs say "serve needs a Slack channel, like --channel slack:C0GATES" three times, then "set GATEKEEPER_API_TOKEN", "set GATEKEEPER_SLACK_TOKEN", "set GATEKEEPER_SLACK_SIGNING_SECRET" and "GATEKEEPER_SIGNING_KEY is no private key in PEM"

  @id=SCN-GATE-090 @status=implemented
  Scenario: A call without an Authorization header gets the status 401 and a problem that says how to send the token
    Given the server runs with the README policy and groups for the channel "slack:C0GATES"
    When a program posts the README request to "/v1/gates" without an Authorization header
    Then the answer has the status 401 and a problem whose detail says "send Authorization: Bearer <GATEKEEPER_API_TOKEN>"
