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
