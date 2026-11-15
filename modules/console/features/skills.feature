@module=console @owner=maintainers
Feature: Skills
  The page "/skills" lists every skill that the factory's agents use from the folders of its repository, and
  "/skills/<name>" shows one skill: its SKILL.md as Markdown, its files, its agents and what it needs (ADR 0141). The
  console runs factory-spec's "factory skills" in "CONSOLE_FACTORY_COMMAND" for them and never reads a SKILL.md
  itself. With a store at "OSF_OPENBAO_ADDR", each secret a skill needs has the state the page "/secrets" knows. Both
  pages are read-only and exist in every mode of the console. The Markdown comes from a repository, so the page shows
  no raw HTML, no script, no image and no link but to the web or an email address.

  @id=SCN-CONSOLE-191 @status=implemented
  Scenario: "/skills" lists each skill with its description, source, agents and needs, and the state of each secret
    Given a factory whose agent "triage" declares "ref:openbao/linear-token" and "ref:openbao/sentry-token", whose agent "review" declares "ref:env/GH_TOKEN", and a store with only "linear-token"
    And the skills "release-notes" of "triage", "changelog" of "review" and "sentry-triage" of "triage" and "review", which need "LINEAR_TOKEN" and the host "api.linear.app", "GH_TOKEN" and "SENTRY_TOKEN"
    When the admin opens "/skills"
    Then the list shows "changelog", "release-notes" and "sentry-triage" in this order, each with its description, its folder in the factory's repository and its agents
    And "release-notes" needs the secret "LINEAR_TOKEN", "Set", and the host "api.linear.app", "changelog" needs "GH_TOKEN", "Set outside the UI", and "sentry-triage" needs "SENTRY_TOKEN", "Not declared"
    And the navigation's link "Skills" is the current page
    And the console ran the factory program with "skills --file <CONSOLE_FACTORY>"

  @id=SCN-CONSOLE-192 @status=implemented
  Scenario: In the open mode and without a store, both pages answer, and a secret of OpenBao has no state
    Given a console without "CONSOLE_SIGN_IN", "CONSOLE_USER_HEADER" and "OSF_OPENBAO_ADDR"
    And the skill "release-notes" whose agent gives "LINEAR_TOKEN" with "ref:openbao/linear-token", and the skill "changelog" whose agent gives "GH_TOKEN" with "ref:env/GH_TOKEN"
    When a person opens "/skills" and "/skills/release-notes"
    Then both answer 200, and the navigation of each links "/skills"
    And "release-notes" needs the secret "LINEAR_TOKEN" without a state, and "changelog" needs "GH_TOKEN", "Set outside the UI"

  @id=SCN-CONSOLE-193 @status=implemented
  Scenario: A store that does not answer is named on "/skills", and the secret's state is "Unknown"
    Given the skill "release-notes" whose agent "triage" gives "LINEAR_TOKEN" with "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens
    When the admin opens "/skills"
    Then the page says "The secrets could not be listed: the store at <address> does not answer"
    And "release-notes" needs the secret "LINEAR_TOKEN", "Unknown"

  @id=SCN-CONSOLE-194 @status=implemented
  Scenario: A skill's page shows its SKILL.md as Markdown, its files, its agents and what it needs
    Given the skill "release-notes" with the files "SKILL.md", "scripts/issue.sh" and "teams.md", whose SKILL.md has the heading "Steps", a numbered list and the code "scripts/issue.sh"
    And whose agents "triage" and "review" give "LINEAR_TOKEN" with "ref:openbao/linear-token", a store without it, and "review" lacks the host "api.linear.app"
    When the admin opens "/skills/release-notes"
    Then the page has the heading "release-notes", the way back "Skills", the description and "skills/release-notes in the factory's repository"
    And the panel "SKILL.md" shows the heading "Steps" below the page's headings, the numbered list and the code "scripts/issue.sh"
    And the list "Files" names "SKILL.md", "scripts/issue.sh" and "teams.md"
    And the list "Agents" says "review" "Lacks api.linear.app" and "triage" "Has what the skill needs"
    And the list "This skill needs" says "LINEAR_TOKEN" "From ref:openbao/linear-token" is "Missing" with the link "Store a value LINEAR_TOKEN" to "/secrets?name=linear-token", and "api.linear.app" "Not in the egress of the agent review" is "Not allowed"

  @id=SCN-CONSOLE-195 @status=implemented
  Scenario: The page of a skill that no agent uses answers 404
    Given a factory whose agent "triage" uses the skill "release-notes"
    When a person opens "/skills/changelog"
    Then the page answers 404 and says "no skill changelog: no agent of the factory uses it"

  @id=SCN-CONSOLE-196 @status=implemented
  Scenario: A skill that lint refuses shows its problems, and a folder without a SKILL.md says so
    Given the skill "release-notes" whose SKILL.md has no description, and the skill "missing" whose folder has no SKILL.md
    When a person opens "/skills", "/skills/release-notes" and "/skills/missing"
    Then the list says "release-notes" has "1 problem" and "No description: SKILL.md names none."
    And the page of "release-notes" says "factory lint: skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it"
    And the page of "missing" says "factory lint: the skill \"./skills/missing\" has no SKILL.md" and "The folder has no SKILL.md that the console can show."

  @id=SCN-CONSOLE-197 @status=implemented
  Scenario: Raw HTML in a SKILL.md is shown as text
    Given the skill "release-notes" whose SKILL.md holds a link, a frame, a form and a bold word as raw HTML
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" shows each as its text, like "<a href=\"https://evil.example\">Sign in</a>"
    And the panel has no link, no frame, no form and no bold word

  @id=SCN-CONSOLE-198 @status=implemented
  Scenario: A script in a SKILL.md is shown as text and never runs
    Given the skill "release-notes" whose SKILL.md holds a script block, a script inside a line and an element with "onclick"
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" shows "<script>alert(1)</script>" and the other two as text
    And the page has no script

  @id=SCN-CONSOLE-199 @status=implemented
  Scenario: An image in a SKILL.md is shown as its text, so no remote image loads
    Given the skill "release-notes" whose SKILL.md holds the image "![Team chart](https://cdn.example/chart.png)", a data image and an image as raw HTML
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" has no image
    And it shows "Team chart" in place of the first

  @id=SCN-CONSOLE-200 @status=implemented
  Scenario: A link of a SKILL.md keeps its anchor only to the web or an email address
    Given the skill "release-notes" whose SKILL.md links "Docs" to "https://docs.example/notes", "Mail" to "mailto:ada@acme.dev", and "Run", "Open" and "Teams" to "javascript:alert(1)", "data:text/html,hi" and "teams.md"
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" links only "Docs" and "Mail", each with "rel" "nofollow noreferrer"
    And it shows "Run", "Open" and "Teams" as text

  @id=SCN-CONSOLE-201 @status=implemented
  Scenario: A factory program that fails is named on both pages
    Given a console whose factory program exits with code 1 and the error "factory.yaml:7:3 /agents/triage/model: missing required field"
    When a person opens "/skills" and "/skills/release-notes"
    Then "/skills" answers 200 and says "The skills could not be read: factory.yaml:7:3 /agents/triage/model: missing required field" and "No skills yet"
    And "/skills/release-notes" answers 502 and says the same

  @id=SCN-CONSOLE-202 @status=implemented
  Scenario: With the own sign-in a member opens both pages, without the link to store a value
    Given a console that signs in with OpenID Connect, an access file with "varun@acme.dev" as "member", a store, and the skill "release-notes" whose agent gives "LINEAR_TOKEN" with "ref:openbao/linear-token" without a value
    And the provider signs in "varun@acme.dev"
    When the person signs in and opens "/skills" and "/skills/release-notes"
    Then both answer 200, and the navigation links "/skills" and not "/secrets"
    And the page of "release-notes" says "LINEAR_TOKEN" is "Missing" without the link "Store a value"
