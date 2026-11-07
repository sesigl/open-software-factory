@module=gatekeeper @owner=maintainers
Feature: Refuse wrong input
  gatekeeper checks its arguments, the request, the policy's answer, the groups file and the time before it asks
  anyone. Wrong input exits with code 2 and one line that names the file, the field or the rule to fix.

  @id=SCN-GATE-071 @status=implemented
  Scenario: A work item that is no text of 1 to 128 characters exits 2 and names the field
    Given the README policy and groups
    And the requests "number.json" with the work item 7, "empty.json" with an empty work item and "long.json" with a work item of 129 characters
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request
    Then each command exits with code 2
    And each error output says that the field "workItem" of the request file must be a text of 1 to 128 characters

  @id=SCN-GATE-072 @status=implemented
  Scenario: A stage that is no lowercase name exits 2 and names the field
    Given the README policy and groups
    And the requests "upper.json" with the stage "Merge", "sign.json" with the stage "merge!" and "number.json" with the stage 7
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request
    Then each command exits with code 2
    And each error output says that the field "stage" of the request file must be a lowercase name like "merge"

  @id=SCN-GATE-073 @status=implemented
  Scenario: A summary of only spaces exits 2 and names the field
    Given the README policy and groups
    And a request whose "summary" is three spaces
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says 'request.json: the field "summary" must say what to approve'

  @id=SCN-GATE-074 @status=implemented
  Scenario: Links that are no list of URLs exit 2 and name the field
    Given the README policy and groups
    And the requests "text.json" with a text as links, "title.json" with a link without a URL and "null.json" with the link null
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request
    Then each command exits with code 2
    And each error output says that the field "links" of the request file must be a list of { url, title }

  @id=SCN-GATE-075 @status=implemented
  Scenario: A change that is no JSON object exits 2 and names the field
    Given the README policy and groups
    And the requests "list.json" with a list as change, "text.json" with a text as change and "null.json" with the change null
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request
    Then each command exits with code 2
    And each error output says that the field "change" of the request file must be a JSON object

  @id=SCN-GATE-076 @status=implemented
  Scenario: A request file that holds no JSON object exits 2 and names the file
    Given the README policy and groups
    And the request files "list.json" with [], "null.json" with null and "text.json" with "merge"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with each request
    Then each command exits with code 2
    And each error output says that the request file is no JSON object

  @id=SCN-GATE-077 @status=implemented
  Scenario: Approvers or escalation groups that are no group names exit 2 and name the rule
    Given the README groups and request
    And the policies "text.rego" with the approvers "maintainers" as a text, "upper.rego" with the approver "Maintainers", "number.rego" with the approver 7 and "leads.rego" with the escalation group "Leads"
    When the user runs "gatekeeper request" with each policy
    Then each command exits with code 2
    And each error output says that the policy's "approvers" or "escalate_to" must be a set of group names like "maintainers"

  @id=SCN-GATE-078 @status=implemented
  Scenario: A policy without rules in the package "gatekeeper" exits 2 and names the policy
    Given the README groups and request
    And the policies "empty.rego" with only the line "package gatekeeper" and "other.rego" with its rules in the package "other"
    When the user runs "gatekeeper request" with each policy
    Then each command exits with code 2
    And each error output says that the policy has no rules in the package gatekeeper

  @id=SCN-GATE-079 @status=implemented
  Scenario: A policy without approvers exits 2 and names the policy
    Given the README groups and request
    And a policy "policy.rego" that sets only the risk "high"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says "policy.rego sets no approvers"

  @id=SCN-GATE-080 @status=implemented
  Scenario: A risk that is no text exits 2
    Given the README groups and request
    And a policy "policy.rego" that sets the risk 3 and the approvers "maintainers"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says "the policy's risk must be a text"

  @id=SCN-GATE-081 @status=implemented
  Scenario: A policy with "escalate_after" and without "escalate_to" exits 2
    Given the README groups and request
    And a policy "policy.rego" that sets the approvers "maintainers" and "escalate_after" "4h" without "escalate_to"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says "the policy sets escalate_after and escalate_to together or not at all"

  @id=SCN-GATE-082 @status=implemented
  Scenario: A duration that is not like "4h" exits 2 and names the rule
    Given the README groups and request
    And the policies "words.rego" with "escalate_after" "4 hours", "prefix.rego" with "escalate_after" "about 4h", "suffix.rego" with "escalate_after" "4hours" and "days.rego" with "expire_after" "2 days"
    When the user runs "gatekeeper request" with each policy
    Then each command exits with code 2
    And each error output says that the policy's "escalate_after" or "expire_after" must be a duration like "30m", "4h" or "2d"

  @id=SCN-GATE-083 @status=implemented
  Scenario: A groups file that does not map each group to a list of identities exits 2 and names the file
    Given the README policy and request
    And the groups files "null.json" with null, "number.json" with 5, "text.json" with a text as members, "bare.json" with the member "U0BEN" in "reviewers", "mixed.json" with the members "slack:U0ADA" and "U0BEN", "upper.json" with the member "Slack:U0ADA" and "space.json" with the member "slack:U0ADA ada"
    When the user runs "gatekeeper request" with each groups file
    Then each command exits with code 2
    And each error output says that the groups file must map each group to its members, like {"maintainers": ["slack:U0ADA"]}

  @id=SCN-GATE-084 @status=implemented
  Scenario: A time in "OSF_NOW" that is no ISO time exits 2 and names the time
    Given the README policy, groups and request
    When the user runs "gatekeeper request" with "OSF_NOW" set to "2026-01-01 05:00", "2026-01-01T05:00:00Z!" and "2026-13-45T05:00:00Z"
    Then each command exits with code 2
    And each error output says that the time is not a time like 2026-01-01T05:00:00Z

  @id=SCN-GATE-085 @status=implemented
  Scenario: A channel that is not like "slack:C0GATES", or a Slack channel without a token, exits 2
    Given the README policy, groups and request
    When the user runs "gatekeeper request" for the channels "slack:c0gates", "xslack:C0GATES" and "slack:C0GATES#x", and for "slack:C0GATES" without "GATEKEEPER_SLACK_TOKEN"
    Then each command exits with code 2
    And the error outputs say that each of the three channels is no channel like slack:C0GATES, and then "set GATEKEEPER_SLACK_TOKEN for a slack: channel"

  @id=SCN-GATE-086 @status=implemented
  Scenario: "gatekeeper request" with wrong arguments exits 2 and says what to change
    Given the README policy, groups and request
    When the user runs "gatekeeper request" without "--policy", without "--groups", with two request files, with a request file and "--pull-request", without a request file, and without "--channel"
    Then each command exits with code 2
    And the error outputs say "name the policy, like --policy policy.rego", "name the groups, like --groups groups.json", "name one request file", "name a request file or --pull-request, not both", "name a request file, or use --pull-request" and "name the channel, like --channel slack:C0GATES"

  @id=SCN-GATE-087 @status=implemented
  Scenario: "gatekeeper verify" without a public key or with two records exits 2
    When the user runs "gatekeeper verify record.json" and "gatekeeper verify --public-key gatekeeper.pub one.json two.json"
    Then each command exits with code 2
    And the error outputs say "verify takes --public-key, like --public-key key.pub" and "verify takes one record file"

  @id=SCN-GATE-088 @status=implemented
  Scenario: The output of a request names the gate, the groups, the channel and the risk
    Given the README policy, groups and request, and a policy "plain.rego" that asks "maintainers" without a risk
    When the user runs "gatekeeper request" for the channel "slack:C0GATES" with the README files, and with "plain.rego" for a change of "docs/guide.md"
    Then each command exits with code 0
    And the outputs say "gate <gate> asks maintainers in slack:C0GATES (risk high)" and "gate <gate> asks maintainers in slack:C0GATES"
