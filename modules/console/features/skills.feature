@module=console @owner=maintainers
Feature: Skills
  The page "/skills" lists every skill that the factory's agents use, from the folders of its repository and of other
  repositories pinned in factory.lock, and "/skills/<name>" shows one skill: its SKILL.md as Markdown, its files, the
  factory's agents and what it needs (ADR 0141). The console runs factory-spec's "factory skills" in
  "CONSOLE_FACTORY_COMMAND" for them and never reads a SKILL.md itself. With a store at "OSF_OPENBAO_ADDR", each secret
  a skill needs has the state the page "/secrets" knows. Both pages exist in every mode of the console. With a factory
  repository in "CONSOLE_FACTORY_REPOSITORY", an admin or a factory engineer switches the skill on or off for each
  agent: a change of the factory (ADR 0144) that also adds what the agent lacks of the skill's needs, which the page
  "/skills/<name>/switch" lists before the person confirms (ADR 0149). The Markdown comes from a repository, so the
  page shows no raw HTML, no script, no image and no link but to the web or an email address.

  @id=SCN-CONSOLE-191 @status=implemented
  Scenario: "/skills" lists each skill with its description, source, agents and needs, and the state of each secret
    Given a factory whose agent "triage" declares "ref:openbao/linear-token" and "ref:openbao/sentry-token", whose agent "review" declares "ref:env/GH_TOKEN", and a store with only "linear-token"
    And the skills "release-notes" of "triage", "changelog" of "review" and "sentry-triage" of "triage" and "review", which need "LINEAR_TOKEN" and the host "api.linear.app", "GH_TOKEN" and "SENTRY_TOKEN"
    When the admin opens "/skills" and "/skills/sentry-triage"
    Then the list shows "changelog", "release-notes" and "sentry-triage" in this order, each with its description, its folder in the factory's repository and its agents
    And "release-notes" needs the secret "LINEAR_TOKEN", "Set", and the host "api.linear.app", "changelog" needs "GH_TOKEN", "Set outside the UI", and "sentry-triage" needs "SENTRY_TOKEN", "Not declared"
    And the page of "sentry-triage" says "SENTRY_TOKEN" "From ref:openbao/sentry-token · Not declared by the agent review" is "Not declared"
    And the page "Skills" is the navigation's current page
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
    Then the page "changelog" answers 404 and says "no skill changelog: no agent of the factory uses it"

  @id=SCN-CONSOLE-196 @status=implemented
  Scenario: A skill that lint refuses shows its problems, and a folder without a SKILL.md says so
    Given the skill "release-notes" whose SKILL.md has no description, and the skill "missing" whose folder has no SKILL.md
    When a person opens "/skills", "/skills/release-notes" and "/skills/missing"
    Then the list says "release-notes" "Fails factory lint" and "No description: SKILL.md names none.", and names no need
    And the page of "release-notes" says "factory lint: skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it" and "No secret and no host."
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
    Given the skill "release-notes" whose SKILL.md links "Docs" to "https://docs.example/notes", "Plain" to "http://plain.example", "Mail" to "mailto:ada@acme.dev", and "Run", "Trick", "Open" and "Teams" to "javascript:alert(1)", "javascript:void(0)//https://evil.example", "data:text/html,hi" and "teams.md"
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" links only "Docs", "Plain" and "Mail", each with "rel" "nofollow noreferrer"
    And it shows "Run", "Trick", "Open" and "Teams" as text

  @id=SCN-CONSOLE-205 @status=implemented
  Scenario: A link by reference, an autolink and a link in a list or a quote follow the same rule
    Given the skill "release-notes" whose SKILL.md holds the link "Ref" by reference to "javascript:alert(1)", the autolink "<javascript:alert(2)>", the link "Item" to "javascript:alert(3)" in a list and the link "Quote" to "javascript:alert(4)" in a quote
    When a person opens "/skills/release-notes"
    Then the panel "SKILL.md" has no link
    And it shows "Ref", "javascript:alert(2)", "Item" and "Quote" as text

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

  @id=SCN-CONSOLE-234 @status=implemented
  Scenario: A factory engineer switches a skill on for an agent, and the change lists the added provider, secret and host
    Given a factory repository "tester/factory" whose main branch requires the check "factory", and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"
    And a factory that declares the secrets provider "env", whose agent "triage" uses the skill "release-notes", which needs "LINEAR_TOKEN" and the host "api.linear.app", and whose agent "review" has a sandbox that reaches only "api.github.com" and declares no secret
    When "grace@acme.dev" opens "/skills/release-notes", presses "Switch on for review" and then "Propose change"
    Then the page that asked first said "Switch on release-notes for review?" and that an admin stores the value of each added secret on Secrets
    And it listed "The factory declares the secrets provider openbao at ^0.", "The agent review gets the secret reference ref:openbao/linear-token.", "The agent review may reach the host api.linear.app." and "The agent review gets the skill ./skills/release-notes."
    And the console answered 303 to "/changes"
    And the forge has one open pull request titled "factory edit add-secrets-provider openbao ^0; add-secret review ref:openbao/linear-token; add-egress review api.linear.app; add-skill review ./skills/release-notes" from a branch "console/add-skill-review-<the newest commit>-<hash of the edits>", whose body lists the four edits in these words
    And its one commit holds the factory.yaml that "factory edit" printed after the four edits, each run on the text of the one before
    And "/skills/release-notes" shows "review" "Switching on", "Checking" and the link to the pull request in place of the switch, and "triage" with "Switch off for triage"

  @id=SCN-CONSOLE-235 @status=implemented @kind=journey
  Scenario: A factory engineer switches a skill on in Chromium and sees the change checking, then live
    Given a console that signs in with OpenID Connect, an access file with "grace@acme.dev" as "factory-engineer", a factory repository "tester/factory" whose main branch requires the check "factory", and a factory whose agent "triage" uses the skill "release-notes" and whose agent "review" lacks what it needs
    And the provider signs in "grace@acme.dev"
    When the person signs in in Chromium, follows "Skills" and "release-notes", presses "Switch on for review" and "Propose change"
    Then the person sees the change as "Checking" on "/changes", and "Switching on" and "Checking" beside "review" on "/skills/release-notes"
    And the skill's page passes the accessibility checks, and its screenshot is kept as "skill-switch"
    When the check "factory" of the pull request passes, the forge merges it, and the person opens "/changes"
    Then the person sees the change as "Live"

  @id=SCN-CONSOLE-236 @status=implemented
  Scenario: A member sees whether each agent has the skill and why there is no switch, and a forge that does not answer is named
    Given a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, "grace@acme.dev" as "factory-engineer" and "varun@acme.dev" as "member"
    And a factory whose agent "triage" uses the skill "release-notes" and whose agent "review" does not
    When "grace@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=spec", and "varun@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=review"
    Then the factory engineer's page has an alert that starts with "The changes could not be listed:" and offers "Switch on for review" and "Switch off for triage"
    And the page for "spec" answers 404 and says "spec is not an agent of the factory"
    And the member's list "Agents" says "review Does not have the skill" and "triage Has what the skill needs", without a button, and the page says "varun@acme.dev has the role member: a change needs the role admin or factory-engineer"
    And the member's page that asks first answers 403 and says the same

  @id=SCN-CONSOLE-237 @status=implemented
  Scenario: A factory from a local folder shows no switch on a skill's page and says why
    Given a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer", without "CONSOLE_FACTORY_REPOSITORY"
    When "grace@acme.dev" opens "/skills/release-notes" and "/skills/release-notes/switch?agent=review"
    Then the skill's page has no button and says "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge."
    And the page that asks first answers 404 and says the same

  @id=SCN-CONSOLE-238 @status=implemented
  Scenario: Switching a skill off only removes the agent's entry
    Given a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"
    And a factory whose agent "triage" uses the skill "release-notes" as "./skills/release-notes" with what it needs
    When "grace@acme.dev" presses "Switch off for triage" on "/skills/release-notes" and then "Propose change"
    Then the page that asked first said "Switch off release-notes for triage?" and "The console opens a pull request with these edits on the factory's repository. The forge merges it when its check factory passes, and triage no longer has the skill from its next run."
    And it listed only "The agent triage no longer has the skill ./skills/release-notes."
    And the form answered 502 and said "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git": its edit passed the checks of a form

  @id=SCN-CONSOLE-239 @status=implemented
  Scenario: A skill of another repository whose needs an agent meets adds nothing but the skill's entry
    Given a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"
    And the skill "release-notes" of "git+https://github.com/acme/skills.git#v1.2:skills/release-notes", used by "triage", which needs "LINEAR_TOKEN" and the host "api.linear.app"
    And the agent "review", whose sandbox reaches "api.linear.app" and which declares "ref:env/LINEAR_TOKEN", and the agent "spec" without a sandbox, which declares "ref:env/linear-token"
    When "grace@acme.dev" opens the pages that ask first for "review" and for "spec", and presses "Propose change" on the first
    Then each lists only "The agent <agent> gets the skill git+https://github.com/acme/skills.git#v1.2:skills/release-notes."
    And each says "The console opens a pull request with these edits on the factory's repository. The forge merges it when its check factory passes, and <agent> has the skill from its next run."
    And the form answered 502 and said "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git": its edit passed the checks of a form

  @id=SCN-CONSOLE-240 @status=implemented
  Scenario: A skill of another repository shows its repository and pinned commit, and one without a pin says so
    Given the skill "release-notes" of "https://github.com/acme/skills.git" pinned at "7c2e91d4f0b3a8c6e5d2f1a0b9c8d7e6f5a4b3c2", and the skill "changelog" of the same repository without a pin, with its problem
    When a person opens "/skills", "/skills/release-notes" and "/skills/changelog"
    Then the list says "skills/release-notes in https://github.com/acme/skills.git at 7c2e91d" and "skills/changelog in https://github.com/acme/skills.git, not pinned in factory.lock" with "Fails factory lint"
    And the page of "release-notes" says "skills/release-notes in https://github.com/acme/skills.git at 7c2e91d"
    And the page of "changelog" says "skills/changelog in https://github.com/acme/skills.git, not pinned in factory.lock" and its problem
