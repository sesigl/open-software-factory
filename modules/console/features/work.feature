@module=console @owner=maintainers
Feature: Work
  The page "/work" shows intake's latest work items, also the ones that wait without a run, and the form "Submit work"
  when the console takes actions (ADR 0089). It is a page in the new look, in the shell of the design system (T-60):
  on a phone each work item is a card and the form's fields stand in one column.

  @id=SCN-CONSOLE-043 @status=implemented
  Scenario: The work page lists each work item with its status and its run
    Given an intake whose inbox holds "Import reports from CSV", received and without a run, and "Export reports as CSV", running in the run "run_5d41402abc4b2a76b971"
    When a person opens "/work"
    Then the table has the rows "Import reports from CSV", "task", "received", "slack", "Varun", "—" and "Export reports as CSV", "task", "running", "slack", "Varun", "run_5d41402abc4b2a76b971"
    And the run links "/runs/run_5d41402abc4b2a76b971"
    And the page's navigation links "/work"

  @id=SCN-CONSOLE-044 @status=implemented
  Scenario: Without intake the work page answers 404 and names the variable
    Given a console without "CONSOLE_INTAKE_URL"
    When a person opens "/work"
    Then the page answers 404 and says "no work items: set CONSOLE_INTAKE_URL to the base URL of intake's API"

  @id=SCN-CONSOLE-045 @status=implemented
  Scenario: A signed-in person submits work from the work page
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions
    When the person "ada@acme.dev" sends the form "submit work" of "/work" with the title "Add a dark mode" and the type "idea"
    Then the answer redirects to "/work"
    And intake received the submission "Add a dark mode" of the type "idea" from the person "ada@acme.dev" with the origin "console"

  @id=SCN-CONSOLE-046 @status=implemented
  Scenario: A form without the signed-in person submits nothing
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions
    When a program sends the form "submit work" of "/work" without the header "X-Forwarded-Email"
    Then the answer has the status 401 and says "sign in first: the console needs x-forwarded-email"
    And intake received no submission

  @id=SCN-CONSOLE-047 @status=implemented
  Scenario: Without "CONSOLE_USER_HEADER" the console stays read-only
    Given a console with an intake but without "CONSOLE_USER_HEADER"
    When a person opens "/work" and a program sends the form "submit work" of "/work"
    Then the page has no form
    And the form gets the status 405

  @id=SCN-CONSOLE-049 @status=implemented
  Scenario: A form from another site submits nothing
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions
    When the person "ada@acme.dev" sends the form "submit work" of "/work" with the origin "https://evil.example"
    Then the answer has the status 403 and says "the form came from another site"
    And intake received no submission

  @id=SCN-CONSOLE-058 @status=implemented
  Scenario: The work page links the next page of intake's inbox
    Given an intake whose inbox's first page holds "Import reports from CSV" and names the next cursor "Y3Vyc29y"
    When a person opens "/work"
    Then the table lists "Import reports from CSV" and the page links "Next page" to "/work?cursor=Y3Vyc29y"
    And opening that link asks intake for "/v1/inbox?cursor=Y3Vyc29y"

  @id=SCN-CONSOLE-252 @status=implemented
  Scenario: The work page is in the shell of the new look and offers a signed-in person the form "Submit work"
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake whose inbox is empty
    When the person "ada@acme.dev" opens "/work"
    Then the page has the title "Work", the navigation "Main" with "Work" as the current page, and does not link "/pico.css"
    And the page says "No work items yet."
    And the form "Submit work" has the field "Title", the field "Type" with "task", "bug", "idea" and "automation", the field "Description" and the button "Submit"

  @id=SCN-CONSOLE-253 @status=implemented
  Scenario: A submission that intake refuses shows intake's answer in the shell of the new look
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that answers a submission with 400
    When the person "ada@acme.dev" sends the form "submit work" of "/work" with the title "Add a dark mode"
    Then the answer has the status 502 with the title "Not submitted" and says that intake did not answer with 400
    And the page has the navigation "Main" with "Work" as the current page and the way back "Work"

  @id=SCN-CONSOLE-254 @status=implemented
  Scenario: An intake that does not answer is named on the work page
    Given an intake whose inbox answers 503
    When a person opens "/work"
    Then the page answers 200 and says that intake did not answer with 503
    And the page lists no work item and does not say "No work items yet."

  @id=SCN-CONSOLE-255 @status=implemented
  Scenario: A form the console refuses shows the reason in the shell of the new look, with the way back to its page
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email", an intake and a foreman with the running run "Export reports as CSV"
    When a program sends the form "submit work" of "/work" without the header "X-Forwarded-Email", and the person "ada@acme.dev" sends the form "Cancel" of the run's page with the origin "https://evil.example"
    Then the first answer has the status 401, the title "Sign in", the navigation "Main" with "Work" as the current page and the way back "Work"
    And the second answer has the status 403, the title "Forbidden", the navigation "Main" with "Runs" as the current page and the way back "Runs"

  @id=SCN-CONSOLE-274 @status=implemented
  Scenario: The work page's list is the island "work-list", and only a browser without script reloads the page
    Given an intake whose inbox holds "Import reports from CSV", received two days ago, and a console with "CONSOLE_REFRESH" 10
    When a person opens "/work"
    Then the region "Work items" lists "Import reports from CSV" and holds the island's properties: the route "/work/items", the interval 10000 milliseconds and the same row
    And the page loads one script, a module script of "/_astro/" that the console answers as JavaScript, and has no inline script
    And the page asks only a browser without script to reload it after 10 seconds

  @id=SCN-CONSOLE-275 @status=implemented
  Scenario: "/work/items" answers the rows of the work page, ready to show, for the same page of intake's inbox
    Given an intake whose inbox holds "Import reports from CSV", received two days ago, and "Export reports as CSV", running in the run "run_5d41402abc4b2a76b971", and whose page at the cursor "Y3Vyc29y" is empty
    When a program asks "/work/items" and "/work/items?cursor=Y3Vyc29y"
    Then the first answer is 200 with the two rows as JSON, each with its title, type, status and its classes, source, requester, run and age, and "empty" false
    And the second answer is 200 with no row and "empty" true, and intake was asked for "/v1/inbox" and "/v1/inbox?cursor=Y3Vyc29y"

  @id=SCN-CONSOLE-276 @status=implemented
  Scenario: "/work/items" answers 502 when intake does not answer, and 404 without intake
    Given an intake whose inbox answers 503, and a second console without "CONSOLE_INTAKE_URL"
    When a program asks "/work/items" of each console
    Then the first answer is 502 with the title "Not refreshed" and says that intake did not answer with 503
    And the second answer is 404 with the title "No work items" and names "CONSOLE_INTAKE_URL"

  @id=SCN-CONSOLE-277 @status=implemented
  Scenario: "/work/items" asks a person who is signed out to sign in first, like the work page
    Given a console that signs in with OpenID Connect, with an intake
    When a person who is signed out asks "/work/items"
    Then the answer redirects to "/signin?next=%2Fwork%2Fitems" and intake was asked for nothing

  @id=SCN-CONSOLE-278 @status=implemented
  Scenario: "/work/items" refuses a person who is not on the access list, like the work page
    Given a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email", an access file with "ada@acme.dev" as "admin", and an intake
    When the proxy sends "leo@acme.dev" to "/work/items"
    Then the answer has the status 403 and says "leo@acme.dev is not on this factory's access list", and intake was asked for nothing

  @id=SCN-CONSOLE-279 @status=implemented @kind=journey
  Scenario: The list of work items refreshes while a person types into "Submit work", and the page passes axe (journey)
    Given a console behind a sign-in proxy with "CONSOLE_REFRESH" 10 and an intake whose inbox holds "Import reports from CSV", and "Add a dark mode" too from its second answer on
    When the person "ada@acme.dev" opens "/work" in Chromium and types "Add a dark mode" into the field "Title"
    Then 10 seconds later the list shows "Add a dark mode" above "Import reports from CSV", the page was not loaded again, and the field "Title" still holds "Add a dark mode"
    And the work page passes the accessibility checks with the refresh on, and its screenshot is kept as "work-refreshed"

  @id=SCN-CONSOLE-257 @status=implemented @kind=journey
  Scenario: On a phone a person reads the inbox as cards and submits work from the work form (journey)
    Given a console behind a sign-in proxy with an intake whose inbox holds "Import reports from CSV", received two days ago, and the inbox of "tester/web" with the proposal "Triage asks before it investigates"
    When the person "ada@acme.dev" opens "/inbox" on a phone
    Then each proposal is a card across the screen with its state and age above its title, and the page passes the accessibility checks; its screenshot is kept as "inbox-phone"
    And on "/work" the work item is a card with its status and the age "2 d" above its title, and the fields "Title", "Type" and "Description" stand in one column inside the screen
    And the work page passes the accessibility checks, and its screenshot is kept as "work-phone"
    And after "Submit" with the title "Add a dark mode" and the type "idea" the browser is back on "/work"
    And intake received the submission "Add a dark mode" of the type "idea" from the person "ada@acme.dev"
