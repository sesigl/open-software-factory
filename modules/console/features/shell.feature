@module=console @owner=maintainers
Feature: The shell of the pages in the new look
  The runs page "/" and every page in the look of the design system have the same shell (ADR 0133): the navigation
  with only the pages that work in this console, the factory's name, the account and a link to the other theme. On a
  phone the navigation folds away. Since T-60 every page has the new look, so the navigation has no "Classic pages".

  @id=SCN-CONSOLE-158 @status=deprecated
  Scenario: The navigation of a console without intake, an inbox or cost and scores links only the pages that work
    Given a console without "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR"
    When a person opens "/"
    Then the navigation links "Runs" as the current page and the classic pages "Factory" and "Health"

  @id=SCN-CONSOLE-159 @status=deprecated
  Scenario: The navigation of a console with intake, an inbox and cost and scores links their pages too
    Given a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR" and the factory "acme"
    When a person opens "/"
    Then the navigation links "Runs" and the classic pages "Work", "Factory", "Inbox", "Cost and scores" and "Health"
    And the shell names the factory "acme"
    And the page offers "Submit work" as its main action

  @id=SCN-CONSOLE-203 @status=deprecated @replaces=SCN-CONSOLE-158
  Scenario: The navigation of a console without intake, an inbox or cost and scores links only the pages that work, Skills among them
    Given a console without "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR"
    When a person opens "/"
    Then the navigation links "Runs" as the current page, "Skills" and the classic pages "Factory" and "Health"

  @id=SCN-CONSOLE-204 @status=deprecated @replaces=SCN-CONSOLE-159
  Scenario: The navigation of a console with intake, an inbox and cost and scores links their pages too, Skills among them
    Given a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR" and the factory "acme"
    When a person opens "/"
    Then the navigation links "Runs", "Skills" and the classic pages "Work", "Factory", "Inbox", "Cost and scores" and "Health"
    And the shell names the factory "acme"
    And the page offers "Submit work" as its main action

  @id=SCN-CONSOLE-251 @status=deprecated @replaces=SCN-CONSOLE-204
  Scenario: The navigation of a console with intake, an inbox and cost and scores links Work and Inbox among the pages in the new look
    Given a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR" and the factory "acme"
    When a person opens "/"
    Then the navigation links "Runs", "Work", "Inbox", "Skills" and the classic pages "Factory", "Cost and scores" and "Health"
    And the shell names the factory "acme"
    And the page offers "Submit work" as its main action

  @id=SCN-CONSOLE-258 @status=implemented @replaces=SCN-CONSOLE-203
  Scenario: The navigation of a console without intake, an inbox or cost and scores links only the pages that work, in one list
    Given a console without "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR"
    When a person opens "/"
    Then the navigation links "Runs" as the current page, "Skills", "Factory" and "Health" in one list
    And the navigation has no group "Classic pages"

  @id=SCN-CONSOLE-259 @status=implemented @replaces=SCN-CONSOLE-251
  Scenario: The navigation of a console with intake, an inbox and cost and scores links their pages in one list, the dashboards below it
    Given a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY", "CONSOLE_IMPROVE_DIR", the factory "acme" and the dashboard "Grafana" at "https://grafana.acme.dev"
    When a person opens "/"
    Then the navigation links "Runs", "Work", "Inbox", "Skills", "Factory", "Cost and scores" and "Health" in one list, and "Grafana" in a list below it
    And the shell names the factory "acme"
    And the page offers "Submit work" as its main action

  @id=SCN-CONSOLE-260 @status=implemented
  Scenario: Each problem of a page shows in the shell, with a way back that this console has
    Given a console without "CONSOLE_IMPROVE_DIR", a sign-in, a secret store and a factory repository
    When a person opens "/?state=merged", "/improvement", "/factory/agents/deploy", "/secrets" and "/skills/release-notes/switch?agent=triage", and a program sends the form "Propose change"
    Then the pages answer 400, 404, 404, 404, 404 and 404 in the shell, each with its title as the heading
    And "/factory/agents/deploy" leads back to "Factory" at "/factory", the switch to "Skills" at "/skills", and the others to "Runs" at "/"

  @id=SCN-CONSOLE-261 @status=implemented
  Scenario: A problem of the secrets or the changes leads back to their page for a person who may open it
    Given a console behind a sign-in proxy with a secret store, a factory repository that does not answer, "grace@acme.dev" as "factory-engineer" and "varun@acme.dev" as "member"
    When "grace@acme.dev" opens "/secrets/delete?name=linear-token" and "varun@acme.dev" sends the form "Propose change"
    Then both answer 403 with the title "Forbidden"
    And the page of "grace@acme.dev" leads back to "Secrets" at "/secrets", and the page of "varun@acme.dev" to "Changes" at "/changes"

  @id=SCN-CONSOLE-160 @status=implemented @realizes=SCN-FACTORY-VIS-001
  Scenario: The link "Runs" counts the runs that wait for a person
    Given a foreman with the run "Approve the spec" that waits for a person and the running run "Export reports as CSV"
    When a person opens "/", "/?state=blocked" and "/?state=running"
    Then the link "Runs" says "1 waits" on "/" and on "/?state=blocked"
    And it says no count on "/?state=running", which does not show the runs that wait

  @id=SCN-CONSOLE-161 @status=implemented
  Scenario: A person switches to the light theme and back, and stays on the page
    Given a foreman with no runs
    When a person opens "/?state=failed" and follows "Light theme"
    Then the page "/?state=failed" has the light theme and links "Dark theme"
    And after "Dark theme" the page has the dark theme again

  @id=SCN-CONSOLE-280 @status=implemented
  Scenario: The theme link sends a person back only to a page of the console, also past a tab, a newline or a backslash
    Given a foreman with no runs
    When a program asks for "/theme?to=light" with the next "/%09/evil.example/x", "/%0A/evil.example/x", "/%5Cevil.example/x", "/%5C%09evil.example/x", "https://evil.example/x" and "https://[evil.example", without a next, and with the next "/runs?state=failed#top"
    Then each of the first seven answers 303 to "/"
    And the last answers 303 to "/runs?state=failed#top"

  @id=SCN-CONSOLE-162 @status=implemented
  Scenario: The shell has a skip link to the content and its landmarks
    Given a foreman with no runs
    When a person opens "/"
    Then the page's first link is "Skip to the content", to "#content"
    And the page has the banner, the navigation "Main", the region "Account" and the main content "#content"

  @id=SCN-CONSOLE-163 @status=implemented @kind=journey @realizes=SCN-FACTORY-RUNTIME-011
  Scenario: A person signs in and lands on the runs in the shell (journey)
    Given a console that signs in with OpenID Connect, an access file with "ada@acme.dev" as "admin" and a foreman with the run "Export reports as CSV"
    And the provider signs in "ada@acme.dev"
    When the person opens "/" in Chromium and presses "Sign in"
    Then the person sees the heading "Runs", the run "Export reports as CSV" and "ada@acme.dev · admin" in the navigation
    And the page passes the accessibility checks, and its screenshot is kept as "runs"

  @id=SCN-CONSOLE-164 @status=implemented @kind=journey
  Scenario: On a phone the navigation folds away behind "Menu" (journey)
    Given a foreman with the run "Export reports as CSV"
    When a person opens "/" on a phone
    Then the run "Export reports as CSV" shows and the navigation's link "Health" does not
    And after "Menu" the navigation shows "Runs", "Factory" and "Health"
    And the page passes the accessibility checks, and its screenshot is kept as "phone-menu"
