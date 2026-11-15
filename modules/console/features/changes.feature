@module=console @owner=maintainers
Feature: Changes
  A person with the role "admin" or "factory-engineer" changes the factory on "/changes" (ADR 0144). The console reads
  the newest commit of the main branch of the factory's repository in "CONSOLE_FACTORY_REPOSITORY", runs factory-spec's
  "factory edit" in "CONSOLE_FACTORY_COMMAND" on it, and with the forge port's adapter creates the branch
  "console/<what>-<commit>-<hash of the edit>" from that commit, commits the edited "factory.yaml", opens a pull request
  and asks the forge to merge it when its check "factory" is green. The page asks the forge for the state of each
  change when it is opened; the console keeps no state and runs no loop.

  @id=SCN-CONSOLE-206 @status=implemented
  Scenario: A factory engineer's change opens a pull request from the newest commit that names the person
    Given a factory repository "tester/factory" whose main branch requires the check "factory" and whose agent "triage" may reach "api.github.com", and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"
    When "grace@acme.dev" sends the form "Propose change" with "add-egress", the agent "triage" and the value "api.linear.app"
    Then the console answered 303 to "/changes"
    And the forge has one open pull request titled "factory edit add-egress triage api.linear.app" from a branch "console/add-egress-triage-<the newest commit>-<hash of the edit>", whose body says that "grace@acme.dev" asked for it
    And its one commit starts at the newest commit of "main", holds the factory.yaml that "factory edit" printed for that commit, and ends with the trailer "Requested-by: grace@acme.dev"
    And "/changes" shows the change as "Checking", "The agent triage may reach the host api.linear.app.", and reloads itself

  @id=SCN-CONSOLE-207 @status=implemented @realizes=SCN-FACTORY-RUNTIME-009
  Scenario: A member gets 403 for the form "Propose change", and "/changes" offers a member no form
    Given a factory repository "tester/factory" whose main branch requires the check "factory", and a console behind a sign-in proxy with "varun@acme.dev" as "member"
    When "varun@acme.dev" sends the form "Propose change" and opens "/changes"
    Then the form answers 403 and says "varun@acme.dev has the role member: a change needs the role admin or factory-engineer"
    And the forge has no pull request
    And "/changes" has no form "Propose a change"

  @id=SCN-CONSOLE-208 @status=implemented
  Scenario: A change whose check passes merges and shows "Live" with the new factory version
    Given a change of the console that waits for its check "factory"
    When the check "factory" of its pull request passes, the forge merges it, and a person opens "/changes"
    Then the change shows "Live" and "Live for the next run: factory version <the merge commit>"
    And it has no button

  @id=SCN-CONSOLE-209 @status=implemented
  Scenario: A change whose check fails shows "Failed" with the check and the link to its pull request
    Given a change of the console that waits for its check "factory"
    When the check "factory" of its pull request fails and a factory engineer opens "/changes"
    Then the change shows "Failed" and "The check factory failed."
    And it links its pull request
    And it has the buttons "Try again" and "Discard"

  @id=SCN-CONSOLE-210 @status=implemented
  Scenario: A change made on an older commit shows "Conflict", and the main branch keeps the newer commit
    Given a change of the console that adds "api.linear.app" to the hosts of the agent "triage"
    When another commit on "main" changes the hosts of "triage" and a factory engineer opens "/changes"
    Then the change shows "Conflict"
    And "main" holds the factory.yaml of the other commit
    And it has the buttons "Try again" and "Discard"

  @id=SCN-CONSOLE-211 @status=implemented
  Scenario: "Try again" closes the failed pull request, deletes its branch and makes the change again on the newest commit
    Given a change of the console whose check "factory" failed, and a newer commit on "main"
    When a factory engineer presses "Try again"
    Then the console answered 303 to "/changes"
    And the old pull request is closed and its branch is gone
    And the forge has a new open pull request titled "factory edit add-egress triage api.linear.app" from a branch "console/add-egress-triage-<the newer commit>-<the same hash>"

  @id=SCN-CONSOLE-212 @status=implemented
  Scenario: "Discard" closes the failed pull request and deletes its branch, and the change shows "Discarded"
    Given a change of the console whose check "factory" failed
    When a factory engineer presses "Discard" and opens "/changes"
    Then the console answered 303 to "/changes"
    And the pull request is closed and its branch is gone
    And the change shows "Discarded" and has no button

  @id=SCN-CONSOLE-213 @status=implemented
  Scenario: On a forge that cannot merge when green, a change waits as "Checking", shows "Ready" with "Merge" once its check passes, and "Merge" merges it
    Given a forge adapter that cannot merge a pull request of "tester/factory" when its checks pass, and a change of the console
    When a factory engineer opens "/changes", the check "factory" passes, and the person opens "/changes" again and presses "Merge"
    Then the change showed "Checking" without a button first, and then "Ready" with the button "Merge"
    And the console answered 303 to "/changes", and "main" holds the factory.yaml of the change

  @id=SCN-CONSOLE-214 @status=implemented
  Scenario: "Merge" of a change whose check "factory" failed answers 409 and merges nothing
    Given a forge adapter that cannot merge a pull request of "tester/factory" when its checks pass, and a change of the console whose check "factory" failed
    When a factory engineer sends the form "Merge" of the change
    Then the form answers 409 and says "Not merged: the check factory of #1 is not green"
    And the pull request is still open

  @id=SCN-CONSOLE-215 @status=implemented
  Scenario: A repository whose main branch does not require the check "factory" gets no change, and the console says what is missing
    Given a factory repository "tester/factory" whose main branch has no rules, and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"
    When "grace@acme.dev" sends the form "Propose change"
    Then the form answers 409 and says "Not proposed: the branch main of tester/factory does not require the check factory, so nothing would check the change before it merges. Require the check factory on main first."
    And the forge has no pull request and only the branch "main"

  @id=SCN-CONSOLE-216 @status=implemented
  Scenario: A factory from a local folder offers no change and says why
    Given a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer", without "CONSOLE_FACTORY_REPOSITORY"
    When "grace@acme.dev" opens "/changes" and sends the form "Propose change"
    Then the page says "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge." and has no form "Propose a change"
    And the form answers 404 and says the same

  @id=SCN-CONSOLE-217 @status=implemented
  Scenario: The form takes only a host name as an egress host and names what it refused
    Given a console with a factory repository, and "grace@acme.dev" as "factory-engineer"
    When "grace@acme.dev" sends the form "Propose change" with "add-egress", the agent "triage" and the value "https://api.linear.app/*"
    Then the form answers 400 and says "Not proposed: https://api.linear.app/* is not a host name, like api.linear.app"
    And the console ran no "factory edit"

  @id=SCN-CONSOLE-218 @status=implemented
  Scenario: "Try again" checks the edit in the pull request's title like a form, and refuses a title that a person changed
    Given a change of the console whose check "factory" failed, and whose title a person changed to "factory edit add-egress triage api.linear.app;curl"
    When a factory engineer presses "Try again"
    Then the form answers 400 and says "Not tried again: api.linear.app;curl is not a host name, like api.linear.app"
    And the pull request is still open, with its branch

  @id=SCN-CONSOLE-219 @status=implemented
  Scenario: A pull request from a "console/" branch that another user opened is not a change of the console
    Given a factory repository "tester/factory" with an open pull request from "console/add-egress-triage-1a2b3c4-5e6f7a8b" by "forgejo:tester", and a console whose "CONSOLE_FACTORY_USER" is "forgejo:factory-bot"
    When a factory engineer opens "/changes" and sends the form "Discard" of pull request 1
    Then the page lists no change
    And the form answers 404 and says "no change #1 of the console in tester/factory"
    And the pull request is still open, with its branch

  @id=SCN-CONSOLE-220 @status=implemented @kind=journey
  Scenario: A factory engineer proposes a change in Chromium and sees it checking
    Given a console that signs in with OpenID Connect, an access file with "grace@acme.dev" as "factory-engineer", and a factory repository "tester/factory" whose main branch requires the check "factory"
    And the provider signs in "grace@acme.dev"
    When the person signs in in Chromium, follows "Changes", chooses "Add an egress host", the agent "triage", types "api.linear.app" and presses "Propose change"
    Then the person sees "The agent triage may reach the host api.linear.app." as "Checking" on "/changes"
    And the page passes the accessibility checks, and its screenshot is kept as "changes"
