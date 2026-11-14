@module=testkit @owner=maintainers
Feature: A module's pages, read without a browser
  sut.pages opens the pages of the server that sut.http started, as a person reads them: it finds elements by role,
  accessible name, label and text, follows links, sends forms and keeps the cookies of the scenario, without a
  browser and without script (ADR 0131). A test never names a tag, a class or a test ID.

  @id=SCN-TK-154 @status=implemented
  Scenario: sut.pages reads a page by role, name and text
    Given a module whose server answers "GET /" with the page "Runs": a heading, the link "Export" to "/runs/1" in a table row with "running", the stylesheet "/site.css" and a reload after 10 seconds
    And its system test opens "/" with sut.pages and expects that title, heading, link, row, stylesheet and reload, and no script
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-155 @status=implemented
  Scenario: sut.pages sends a form, follows its redirect and keeps the cookies and the headers
    Given a module whose form "Save" sets the cookie of the field "Name" and redirects to a page that greets the cookie and the header "x-demo-proxy", and whose link "Sign out" clears the cookie
    And its system test opens "/" with the header "x-demo-proxy" "proxy", sends "Save" with "Name" "Ada" once without following its redirect and once following it, then follows "Sign out", and sends the field "name" "Bob" to "/name" as a program
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-156 @status=implemented
  Scenario: A query that finds no element fails the test and names the role and the name it looked for
    Given a module whose server answers "GET /" with a page without a link
    And its system test expects the link "Export" on "/" with sut.pages
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains 'Unable to find an accessible element with the role "link" and name "Export"'

  @id=SCN-TK-157 @status=implemented
  Scenario: sut.browser opens a page in Chromium with the testkit's clock, one locale, one time zone and a named viewport
    Given a module whose page "/" shows the time, the time zone, the language, the width and the reduced motion of the browser in a status, and links "Next" to a page with the heading "Next"
    And its system test opens "/" with sut.browser on a "phone", expects "2026-01-01T00:00:00.000Z UTC en-US 390 reduce", follows "Next", checks the page's accessibility and keeps the screenshot "next"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
    And the module has the screenshot "reports/screenshots/SCN-DEMO-001/next.png"

  @id=SCN-TK-158 @status=implemented
  Scenario: A request of the browser that leaves loopback fails the scenario and names the address
    Given a module whose page "/" loads the image "https://example.com/logo.png"
    And its system test opens "/" with sut.browser
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "the browser refused a request that leaves loopback: https://example.com/logo.png"

  @id=SCN-TK-159 @status=implemented
  Scenario: An error in the browser's console fails the scenario
    Given a module whose page "/" writes the error "the chart has no data" to the browser's console
    And its system test opens "/" with sut.browser
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "an error in the browser's console: the chart has no data"

  @id=SCN-TK-160 @status=implemented
  Scenario: A page with an accessibility violation fails the accessibility check
    Given a module whose page "/" has a button without a name
    And its system test opens "/" with sut.browser and checks the page's accessibility
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "button-name"
