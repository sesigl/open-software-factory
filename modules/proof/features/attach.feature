@module=proof @owner=maintainers
Feature: Attach a bundle to a pull request
  "proof attach <bundle>" posts one comment with the scenarios and a link to the bundle on the pull request, and sets
  the commit status "proof" on the bundle's commit. A URL with "/pulls/<n>" is a Forgejo pull request, one with
  "/pull/<n>" a GitHub pull request.

  @id=SCN-PROOF-023 @status=deprecated
  Scenario: The evidence bundle is attached to a Forgejo pull request
    Given a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence --pr <pull request> --bundle-url https://ci.example.com/evidence" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge
    Then the command exits with code 0
    And the pull request has a comment that links "https://ci.example.com/evidence" and lists "SCN-WEB-001" as "passed"
    And the head commit has the status "proof" with the state "success" and the description "1 of 1 scenarios passed"

  @id=SCN-PROOF-024 @status=implemented
  Scenario: Attaching again updates the comment instead of adding one
    Given a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed
    And the developer attached the bundle to the pull request once
    When the developer runs "proof attach evidence --pr <pull request>" again with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge
    Then the command exits with code 0
    And the pull request has exactly one comment from proof

  @id=SCN-PROOF-025 @status=implemented
  Scenario: A failed bundle sets the status to failure
    Given a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed and "SCN-WEB-002" failed
    When the developer runs "proof attach evidence --pr <pull request>" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge
    Then the command exits with code 0
    And the head commit has the status "proof" with the state "failure" and the description "1 of 2 scenarios passed"

  @id=SCN-PROOF-026 @status=deprecated
  Scenario: The evidence bundle is attached to a GitHub pull request
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 0
    And the GitHub API received "POST /repos/acme/web/issues/7/comments" with a comment that lists "SCN-WEB-001"
    And the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "success"

  @id=SCN-PROOF-027 @status=implemented
  Scenario: On GitHub the existing proof comment is updated
    Given a GitHub API with the proof comment 42 on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 0
    And the GitHub API received "PATCH /repos/acme/web/issues/comments/42" and no new comment

  @id=SCN-PROOF-028 @status=implemented
  Scenario: The bundle is uploaded to an S3-compatible store and linked
    Given an S3-compatible store with the bucket "evidence"
    And a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed with a screenshot
    When the developer runs "proof attach evidence --store s3://evidence/web" with the store's AWS variables and the GitHub API
    Then the command exits with code 0
    And the store holds "evidence.json" and "artifacts/SCN-WEB-001/checkout.png" below "web/<bundle id>/"
    And the comment on the pull request links the "evidence.json" in the store

  @id=SCN-PROOF-029 @status=implemented
  Scenario: Attach without a token is refused
    Given a bundle for the pull request "https://github.com/acme/web/pull/7" where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" without PROOF_FORGE_TOKEN
    Then the command exits with code 1
    And the error output contains "PROOF_FORGE_TOKEN is not set"

  @id=SCN-PROOF-030 @status=implemented
  Scenario: A forge that refuses the comment fails the attach
    Given a GitHub API that answers 403 to the comments of the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 1
    And the error output contains "the forge answered 403 to GET /repos/acme/web/issues/7/comments"

  @id=SCN-PROOF-031 @status=implemented
  Scenario: Attach without a pull request is refused
    Given a bundle without a pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_TOKEN
    Then the command exits with code 1
    And the error output contains "give the pull request with --pr"

  @id=SCN-PROOF-034 @status=implemented
  Scenario: Attach refuses a manifest that breaks the contract
    Given a bundle whose manifest has the scenario ID "WEB-1"
    When the developer runs "proof attach evidence --pr https://github.com/acme/web/pull/7" with PROOF_FORGE_TOKEN
    Then the command exits with code 1
    And the error output contains "evidence.json /scenarios/0/id"

  @id=SCN-PROOF-047 @status=implemented @replaces=SCN-PROOF-023 @realizes=SCN-FACTORY-LOOP-009
  Scenario: The evidence bundle is attached to a Forgejo pull request with the counts of the results
    Given a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence --pr <pull request> --bundle-url https://ci.example.com/evidence" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge
    Then the command exits with code 0
    And the pull request has a comment that links "https://ci.example.com/evidence" and says "Scenarios: 1 passed, 0 failed, 0 skipped"
    And the comment does not name "SCN-WEB-001"
    And the head commit has the status "proof" with the state "success" and the description "1 of 1 scenarios passed"

  @id=SCN-PROOF-048 @status=implemented @replaces=SCN-PROOF-026
  Scenario: The evidence bundle is attached to a GitHub pull request with the counts of the results
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 0
    And the GitHub API received "POST /repos/acme/web/issues/7/comments" with a comment that says "Scenarios: 1 passed, 0 failed, 0 skipped" and does not name "SCN-WEB-001"
    And the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "success"

  @id=SCN-PROOF-049 @status=implemented
  Scenario: The comment lists only the scenarios that did not pass
    Given a Forgejo pull request and a bundle of its head commit where "SCN-WEB-001" passed and "SCN-WEB-002" failed
    When the developer runs "proof attach evidence --pr <pull request>" with PROOF_FORGE_URL and PROOF_FORGE_TOKEN of the forge
    Then the command exits with code 0
    And the pull request has a comment that says "Scenarios: 1 passed, 1 failed, 0 skipped" and lists "SCN-WEB-002" as "failed"
    And the comment does not name "SCN-WEB-001"

  @id=SCN-PROOF-052 @status=implemented
  Scenario: The comment on GitHub has the counts, the bundle link and one row per scenario that did not pass
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed, "SCN-WEB-002" failed with the screenshot "refund.png" and "SCN-WEB-003" was skipped with the screenshot "coupon.png"
    When the developer runs "proof attach evidence --bundle-url https://ci.example.com/evidence" with PROOF_FORGE_URL of the GitHub API with a trailing slash and PROOF_FORGE_TOKEN "test-token"
    Then the command exits with code 0
    And the output is 'added the comment on https://github.com/acme/web/pull/7; set "proof" to failure on 9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c'
    And the GitHub API received a comment with the marker, the title "### proof: failed", the counts, the commit, the bundle link and the rows of "SCN-WEB-002" and "SCN-WEB-003"
    And the GitHub API received the status with the context "proof", the state "failure", the description "1 of 3 scenarios passed" and the target URL "https://ci.example.com/evidence"
    And each request to the GitHub API has the header "authorization" with the value "token test-token"

  @id=SCN-PROOF-053 @status=implemented
  Scenario: The comment names the bundle ID when the bundle is not uploaded
    Given a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 0
    And the GitHub API received a comment with the marker, the title "### proof: passed", the counts, the commit and "<bundle id> (not uploaded)", and no table

  @id=SCN-PROOF-054 @status=implemented
  Scenario: The proof comment on the second page of comments is updated
    Given a GitHub API with 100 other comments on the first page and the proof comment 42 on the second page of the pull request "https://github.com/acme/web/pull/7"
    And a bundle for that pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN
    Then the command exits with code 0
    And the GitHub API received "PATCH /repos/acme/web/issues/comments/42" and no new comment
    And the output starts with "updated the comment on https://github.com/acme/web/pull/7"

  @id=SCN-PROOF-055 @status=implemented
  Scenario: A pull request URL with more path after the number is refused
    Given a bundle without a pull request where "SCN-WEB-001" passed
    When the developer runs "proof attach evidence --pr https://github.com/acme/web/pull/7/files" with PROOF_FORGE_TOKEN
    Then the command exits with code 1
    And the error output contains "not a GitHub or Forgejo pull request URL: https://github.com/acme/web/pull/7/files"
