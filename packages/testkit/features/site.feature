@module=testkit @owner=maintainers
Feature: A folder served as a static site, and the active mutant in the browser
  sut.site serves a folder of the unit on loopback, such as the workbench of an island scenario, and nothing outside
  it. During a mutation run, sut.browser gives every page Stryker's active mutant before its first script, so a mutant
  in an island's code is active in Chromium (ADR 0152).

  @id=SCN-TK-185 @status=implemented
  Scenario: sut.site serves each file of a folder with its content type and the headers the test names
    Given a library whose folder "site" holds "index.html", "app.js", "style.css", "data.json", "icon.svg" and "notes.bin"
    And its system test serves "site" with sut.site and the header "Content-Security-Policy: script-src 'self'", fetches "/", "/app.js", "/style.css", "/data.json", "/icon.svg" and "/notes.bin", and expects each file's text, its content type and the header
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-186 @status=implemented
  Scenario: sut.site answers 404 for a path outside its folder and serves no folder outside the unit
    Given a library with the file "secret.txt" beside its folder "site", and in "site" the page "index.html" and the link "leak.txt" to "../secret.txt"
    And its system test serves "site" with sut.site, expects "/" to answer 200 and "/%2e%2e%2fsecret.txt", "/leak.txt" and "/missing.js" to answer 404, and expects sut.site to refuse to serve ".." and "site/index.html"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-187 @status=implemented
  Scenario: A page that sut.browser opens during a mutation run runs the active mutant's branch of an instrumented script
    Given a library whose folder "site" holds a page with an external script, instrumented as Stryker 10 emits it, that shows "morning", and "afternoon" while the mutant "7" is active
    And its system test serves "site" with sut.site and the header "Content-Security-Policy: script-src 'self'", opens "/" with sut.browser and expects the status "afternoon"
    When the developer runs "testkit run --junit report.xml" in the module with "__STRYKER_ACTIVE_MUTANT__" set to "7"
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-188 @status=implemented
  Scenario: A page that sut.browser opens without an active mutant runs the original branch of an instrumented script
    Given a library whose folder "site" holds a page with an external script, instrumented as Stryker 10 emits it, that shows "morning", and "afternoon" while the mutant "7" is active
    And its system test serves "site" with sut.site and the header "Content-Security-Policy: script-src 'self'", opens "/" with sut.browser and expects the status "morning"
    When the developer runs "testkit run --junit report.xml" in the module without an active mutant
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-189 @status=implemented
  Scenario: A page that sut.browser opens with its clock paused runs its timers only when the test runs the clock
    Given a library whose folder "site" holds a page with an external script that shows "waiting", and "done" one second later
    And its system test serves "site" with sut.site, opens "/" with sut.browser and the clock "paused", and expects "waiting", "waiting" after 999 milliseconds of page.clock.runFor, and "done" after one more
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
