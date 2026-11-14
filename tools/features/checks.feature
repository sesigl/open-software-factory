@module=tools @owner=maintainers
Feature: Repository checks
  The checks of docs/quality/checks.md run as "osf check" in a repository. Each failure prints its check ID and
  the file and line to fix. Checks that compare against a base read the Git ref from OSF_BASE. SPEC, TRACE, STEPS
  and PASS moved to the module spec-trace (ADR 0031); its scenarios SCN-TRACE-001 to -049 cover them.

  @id=SCN-REPO-001 @status=deprecated
  Scenario: A module created from the template passes the fast checks
    Given a repository with the module template and an accepted ADR for the module "demo"
    And the developer ran "osf new-module demo"
    When the developer runs "osf check"
    Then the command exits with code 0
    And the output contains "SPEC ok"

  @id=SCN-REPO-002 @status=deprecated
  Scenario: SPEC rejects a duplicate scenario ID
    Given a repository with two scenarios with the ID "SCN-DEMO-001"
    When the developer runs "osf check SPEC"
    Then the command exits with code 1
    And the output contains "SPEC modules/demo/features/b.feature:5 duplicate ID SCN-DEMO-001"

  @id=SCN-REPO-003 @status=deprecated
  Scenario: TRACE rejects an implemented scenario without a system test
    Given a repository with the implemented scenario "SCN-DEMO-001" and no system test
    When the developer runs "osf check TRACE"
    Then the command exits with code 1
    And the output contains "TRACE modules/demo/features/a.feature:5 SCN-DEMO-001 is implemented but has no system test"

  @id=SCN-REPO-004 @status=deprecated
  Scenario: STEPS rejects a label that differs from the step
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test labels the step 'When the user runs "demo run"' as "the user runs demo"
    When the developer runs "osf check STEPS"
    Then the command exits with code 1
    And the output contains "STEPS modules/demo/system-tests/SCN-DEMO-001.test.ts:7"
    And the output contains "differs from the step"

  @id=SCN-REPO-005 @status=deprecated
  Scenario: PASS rejects a skipped test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" was skipped
    When the developer runs "osf check PASS"
    Then the command exits with code 1
    And the output contains "PASS modules/demo/features/a.feature:5 SCN-DEMO-001 was skipped"

  @id=SCN-REPO-006 @status=implemented
  Scenario: BOUNDARY-STATIC rejects an import from src/
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test imports "../src/run.ts"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains "BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2"

  @id=SCN-REPO-056 @status=implemented
  Scenario: BOUNDARY-STATIC accepts a library's system test that imports the library
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test imports "@opensoftware/money"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 0
    And the output contains "BOUNDARY-STATIC ok"

  @id=SCN-REPO-057 @status=implemented
  Scenario: BOUNDARY-STATIC rejects a library's system test that imports the library's src/
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test imports "../src/index.ts"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains "BOUNDARY-STATIC packages/money/system-tests/SCN-MONEY-001.test.ts:2"

  @id=SCN-REPO-007 @status=deprecated
  Scenario: SPECGUARD rejects a changed implemented step without approval
    Given a base commit with the implemented scenario "SCN-DEMO-001"
    And a change to the text of its "Then" step
    And no approval from a code owner
    When the developer runs "osf check SPECGUARD" against the base commit
    Then the command exits with code 1
    And the output contains "SPECGUARD modules/demo/features/a.feature:5 SCN-DEMO-001 changed its steps"
    And the output contains "@maintainer"

  @id=SCN-REPO-008 @status=implemented
  Scenario: DOCS-AFFECTED lists a doc whose covers path changed
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/src/**"
    And a change to "modules/demo/src/run.ts"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED docs/how-to/demo.md:1"

  @id=SCN-REPO-009 @status=implemented
  Scenario: ISOLATION rejects a module that imports another module
    Given a repository with the modules "demo" and "other"
    And "modules/demo/src/run.ts" imports "../../other/src/index.ts"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 1
    And the output contains "ISOLATION modules/demo/src/run.ts:1"

  @id=SCN-REPO-054 @status=implemented
  Scenario: ISOLATION accepts a module that depends on a library in packages
    Given a repository with the module "demo" and the library "packages/money" named "@opensoftware/money"
    And "modules/demo/package.json" depends on "@opensoftware/money"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 0
    And the output contains "ISOLATION ok"

  @id=SCN-REPO-080 @status=implemented
  Scenario: ISOLATION accepts a module that declares an adapter in its devDependencies for its system tests
    Given a repository with the module "demo" and the adapter "adapters/forge/github" named "@opensoftware/forge-github"
    And "modules/demo/package.json" declares "@opensoftware/forge-github" in its "devDependencies"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 0
    And the output contains "ISOLATION ok"

  @id=SCN-REPO-081 @status=implemented
  Scenario: ISOLATION rejects a module that declares an adapter in its dependencies
    Given a repository with the module "demo" and the adapter "adapters/forge/github" named "@opensoftware/forge-github"
    And "modules/demo/package.json" declares "@opensoftware/forge-github" in its "dependencies"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 1
    And the output contains "ISOLATION modules/demo/package.json:5 @opensoftware/forge-github is another module"

  @id=SCN-REPO-010 @status=implemented
  Scenario: BOUNDARY-ENV rejects an environment variable that the README does not document
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test passes the environment variable "DEMO_SECRET_MODE" to the module
    When the developer runs "osf check BOUNDARY-ENV"
    Then the command exits with code 1
    And the output contains "BOUNDARY-ENV modules/demo/system-tests/SCN-DEMO-001.test.ts"
    And the output contains "DEMO_SECRET_MODE"

  @id=SCN-REPO-147 @status=implemented
  Scenario: CONTRAST accepts tokens whose texts meet WCAG 2.2 AA on every background in both themes
    Given the tokens file "packages/ui/assets/tokens.css" with a ground, a text and a subtle text for each theme
    When the developer runs "osf check CONTRAST"
    Then the command exits with code 0
    And the output contains "CONTRAST ok"

  @id=SCN-REPO-148 @status=implemented
  Scenario: CONTRAST rejects a text token below WCAG 2.2 AA in the light theme
    Given the tokens file "packages/ui/assets/tokens.css" whose light subtle text is "#8a9099" on the ground "#fafaf9"
    When the developer runs "osf check CONTRAST"
    Then the command exits with code 1
    And the output contains "CONTRAST packages/ui/assets/tokens.css:10 --osf-text-subtle on --osf-bg-ground in the light theme has 3.08:1, WCAG 2.2 AA needs 4.5:1"

  @id=SCN-REPO-149 @status=implemented
  Scenario: TOKENS rejects a colour value in a stylesheet of the console
    Given the console's stylesheet "src/web/styles.css" sets "color: #ff6b1a" on line 2
    When the developer runs "osf check TOKENS"
    Then the command exits with code 1
    And the output contains "TOKENS modules/console/src/web/styles.css:2 the colour #ff6b1a is no token: name a token of packages/ui/assets/tokens.css"

  @id=SCN-REPO-150 @status=implemented
  Scenario: TOKENS rejects a font named outside the tokens
    Given the console's stylesheet "src/web/styles.css" sets "font-family: Inter, sans-serif" on line 2
    When the developer runs "osf check TOKENS"
    Then the command exits with code 1
    And the output contains "TOKENS modules/console/src/web/styles.css:2 a font is named outside the tokens: use var(--osf-font-sans) or var(--osf-font-mono)"

  @id=SCN-REPO-151 @status=implemented
  Scenario: TOKENS accepts a stylesheet that names only tokens
    Given the console's stylesheet "src/web/styles.css" sets its colours and its font with tokens
    When the developer runs "osf check TOKENS"
    Then the command exits with code 0
    And the output contains "TOKENS ok"

  @id=SCN-REPO-142 @status=implemented
  Scenario: TEMPLATE accepts a template that only shows the data of its route
    Given the module "demo" whose template "src/web/pages/runs.astro" imports a component and a type, reads the page's data and its status, maps the runs and switches on a value
    When the developer runs "osf check TEMPLATE"
    Then the command exits with code 0
    And the output contains "TEMPLATE ok"

  @id=SCN-REPO-143 @status=implemented
  Scenario: TEMPLATE rejects a template that computes in its frontmatter
    Given the module "demo" whose template "src/web/pages/runs.astro" counts the runs in its frontmatter
    When the developer runs "osf check TEMPLATE"
    Then the command exits with code 1
    And the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:6 the frontmatter holds only imports, the page's data and its status: compute in the route"

  @id=SCN-REPO-144 @status=implemented
  Scenario: TEMPLATE rejects a template whose markup computes
    Given the module "demo" whose template "src/web/pages/runs.astro" filters the runs in its markup
    When the developer runs "osf check TEMPLATE"
    Then the command exits with code 1
    And the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:7 the markup computes: an expression reads a property, maps a list or switches on a value"

  @id=SCN-REPO-145 @status=implemented
  Scenario: TEMPLATE rejects a template that imports a layer above its own
    Given the module "demo" whose template "src/web/pages/runs.astro" imports a type of "src/commands/serve.ts"
    When the developer runs "osf check TEMPLATE"
    Then the command exits with code 1
    And the output contains "TEMPLATE modules/demo/src/web/pages/runs.astro:2 imports ../../commands/serve.ts of the layer commands, above its layer templates"

  @id=SCN-REPO-140 @status=implemented
  Scenario: UI-QUERY rejects a UI test that finds an element by a CSS selector
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test clicks the element "button.primary" of a page that sut.browser opened
    When the developer runs "osf check UI-QUERY"
    Then the command exits with code 1
    And the output contains "UI-QUERY modules/demo/system-tests/SCN-DEMO-001.test.ts:12 locator finds or waits by something other than role, label or text"

  @id=SCN-REPO-141 @status=implemented
  Scenario: UI-QUERY accepts a UI test that finds elements by role, label and text
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test clicks the button "Save" of a page that sut.browser opened, fills the field "Name" and reads the text "Saved"
    When the developer runs "osf check UI-QUERY"
    Then the command exits with code 0
    And the output contains "UI-QUERY ok"

  @id=SCN-REPO-011 @status=implemented
  Scenario: NOSKIP rejects a skipped test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test file contains "test.skip"
    When the developer runs "osf check NOSKIP"
    Then the command exits with code 1
    And the output contains "NOSKIP modules/demo/system-tests/SCN-DEMO-001.test.ts"

  @id=SCN-REPO-012 @status=implemented
  Scenario: ASSERT rejects a then step that asserts only on a value the test created
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test's then step asserts only on a constant
    When the developer runs "osf check ASSERT"
    Then the command exits with code 1
    And the output contains "ASSERT modules/demo/system-tests/SCN-DEMO-001.test.ts"

  @id=SCN-REPO-059 @status=implemented
  Scenario: ASSERT accepts a library's then step that asserts on what the library returned
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test asserts on the value that "cents" from "@opensoftware/money" returned
    When the developer runs "osf check ASSERT"
    Then the command exits with code 0
    And the output contains "ASSERT ok"

  @id=SCN-REPO-061 @status=implemented
  Scenario: ASSERT accepts a then step that asserts on what a subpath export of the package returned
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test asserts on the value that "cents" from "@opensoftware/money/rates" returned
    When the developer runs "osf check ASSERT"
    Then the command exits with code 0
    And the output contains "ASSERT ok"

  @id=SCN-REPO-013 @status=implemented
  Scenario: FLAKE rejects a test that passed only on retry
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed after 1 retry
    When the developer runs "osf check FLAKE"
    Then the command exits with code 1
    And the output contains "FLAKE modules/demo/features/a.feature:5 SCN-DEMO-001 passed only after 1 retry"

  @id=SCN-REPO-014 @status=implemented
  Scenario: BUDGET rejects system tests that take longer than the module budget
    Given a repository whose module "demo" has a budget of 10 seconds
    And a JUnit report in which the system tests of "demo" took 12.5 seconds
    When the developer runs "osf check BUDGET"
    Then the command exits with code 1
    And the output contains "BUDGET modules/demo/AGENTS.md"
    And the output contains "12.5 s"

  @id=SCN-REPO-123 @status=implemented
  Scenario: BUDGET divides the time of a module's system tests by the slowdown of the runner that ran them
    Given a repository whose module "demo" has a budget of 10 seconds and runs its system tests with "testkit timed"
    And a JUnit report in which the system tests of "demo" took 12.5 seconds, on a runner whose slowdown was 1.5
    When the developer runs "osf check BUDGET"
    Then the command exits with code 0

  @id=SCN-REPO-124 @status=implemented
  Scenario: BUDGET rejects a package whose system tests do not run with "testkit timed"
    Given a repository whose module "demo" has system tests and runs them with "vitest run"
    When the developer runs "osf check BUDGET"
    Then the command exits with code 1
    And the output contains "BUDGET modules/demo/package.json" and "testkit timed"

  @id=SCN-REPO-015 @status=implemented
  Scenario: CONTRACT rejects a removed schema property without a major version
    Given a base commit with the schema "contracts/demo/demo.schema.json" at version "1.2.0"
    And a change that removes its property "name" and sets the version "1.3.0"
    When the developer runs "osf check CONTRACT" against the base commit
    Then the command exits with code 1
    And the output contains "CONTRACT contracts/demo/demo.schema.json"
    And the output contains "removed property name"

  @id=SCN-REPO-016 @status=implemented
  Scenario: DOCS-GEN rejects a generated README section that is out of date
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the module README lists no scenarios under its generated marker
    When the developer runs "osf check DOCS-GEN"
    Then the command exits with code 1
    And the output contains "DOCS-GEN modules/demo/README.md"

  @id=SCN-REPO-017 @status=implemented
  Scenario: DOCS-LINKS rejects a link to a missing file
    Given a repository with the doc "docs/guide.md" that links "missing.md"
    When the developer runs "osf check DOCS-LINKS"
    Then the command exits with code 1
    And the output contains "DOCS-LINKS docs/guide.md:3"

  @id=SCN-REPO-018 @status=implemented
  Scenario: ADR rejects a new dependency without an accepted ADR
    Given a base commit without dependencies
    And a change that adds the dependency "left-pad" to "modules/demo/package.json"
    And the only ADR that names "left-pad" is proposed
    When the developer runs "osf check ADR" against the base commit
    Then the command exits with code 1
    And the output contains "ADR modules/demo/package.json"
    And the output contains "left-pad"

  @id=SCN-REPO-019 @status=implemented
  Scenario: BOUNDARY-STATIC names the line of a Node built-in import in a system test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test imports "node:fs"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains 'BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2 import "node:fs"'

  @id=SCN-REPO-020 @status=deprecated
  Scenario: Running every check without a base fails and names the skipped comparisons
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed
    When the developer runs "osf check --all" without OSF_BASE
    Then the command exits with code 1
    And the output contains "SPECGUARD skipped: OSF_BASE is not set"
    And the output contains "DOCS-AFFECTED skipped: OSF_BASE is not set"

  @id=SCN-REPO-023 @status=implemented
  Scenario: CONTRACT compares with the last contracts release and checks the values of maps
    Given the release tag "contracts-v1.2.0" on a commit whose schema "contracts/demo/demo.schema.json" gives every agent the property "prompt"
    And a later base commit that removes the property "prompt" and sets the version "1.3.0"
    When the developer runs "osf check CONTRACT" against the later base commit
    Then the command exits with code 1
    And the output contains "CONTRACT contracts/demo/demo.schema.json"
    And the output contains "since contracts-v1.2.0"
    And the output contains "removed property agents.*.prompt"

  @id=SCN-REPO-024 @status=implemented
  Scenario: CONTRACT checks the formats of fixture values
    Given the schema "contracts/demo/demo.schema.json" whose property "link" has the format "uri"
    And the invalid fixture "contracts/demo/fixtures/invalid/relative-link.json" with the link "not a uri"
    When the developer runs "osf check CONTRACT" without OSF_BASE
    Then the command exits with code 0
    And the output does not contain "unknown format"

  @id=SCN-REPO-025 @status=implemented @replaces=SCN-REPO-020
  Scenario: Running every check without a base fails and names the skipped comparisons
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed
    When the developer runs "osf check --all" without OSF_BASE
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED skipped: OSF_BASE is not set"
    And the output contains "check --all needs OSF_BASE"

  @id=SCN-REPO-026 @status=implemented
  Scenario: ARCH rejects an import from a layer above
    Given a module "demo" whose architecture.json lists the layer "cli" with "src/cli/" above the layer "domain" with "src/domain/"
    And "modules/demo/src/domain/rules.ts" imports "../cli/main.ts"
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/src/domain/rules.ts:1 layer domain imports ../cli/main.ts from layer cli above it"

  @id=SCN-REPO-027 @status=implemented
  Scenario: ARCH rejects a source file outside every declared layer
    Given a module "demo" whose architecture.json lists the layer "cli" with "src/cli/" above the layer "domain" with "src/domain/"
    And the file "modules/demo/src/util.ts"
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/src/util.ts:1 is in no layer of modules/demo/architecture.json"

  @id=SCN-REPO-028 @status=implemented
  Scenario: ARCH rejects a module without architecture.json
    Given a module "demo" with the file "modules/demo/src/index.ts" and no architecture.json
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/package.json:1 has no architecture.json"

  @id=SCN-REPO-029 @status=implemented
  Scenario: ISOLATION finds an import in a file that another file of the module imports
    Given a repository with the modules "demo" and "other"
    And "modules/demo/src/a.ts" imports "./run.ts"
    And "modules/demo/src/run.ts" imports "../../other/src/index.ts"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 1
    And the output contains "ISOLATION modules/demo/src/run.ts:1"

  @id=SCN-REPO-030 @status=deprecated
  Scenario: TRACE rejects an adapter without a system test for a conformance scenario of its port
    Given a port "forge" with the implemented @conformance scenario "SCN-FORGE-001" and the adapters "a" and "b"
    And only the adapter "a" has a system test for "SCN-FORGE-001"
    When the developer runs "osf check TRACE"
    Then the command exits with code 1
    And the output contains "TRACE ports/forge/features/a.feature:5 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/system-tests/, has 0"

  @id=SCN-REPO-031 @status=implemented
  Scenario: REACH rejects added lines that no system test reaches
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change that adds the function "unused", whose body is lines 5 and 6
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/src/run.ts:5 no system test reaches lines 5 to 6"

  @id=SCN-REPO-032 @status=implemented
  Scenario: REACH rejects a new source file that no system test loads and skips a file of types only
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change that adds "modules/demo/src/extra.ts" with a function and "modules/demo/src/types.ts" with an interface
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/src/extra.ts:1 no system test loads this file"
    And the output does not contain "types.ts"

  @id=SCN-REPO-060 @status=implemented
  Scenario: REACH leaves the lines of a library to MUTATION
    Given a base commit with the library "packages/money" named "@opensoftware/money"
    And a change that adds "packages/money/src/extra.ts" with a function
    And no coverage report
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 0
    And the output contains "REACH ok"

  @id=SCN-REPO-062 @status=implemented
  Scenario: REACH leaves code that ran only in a transformed form to MUTATION
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change that adds the function "unused", whose body is lines 5 and 6
    And a coverage report of "run.ts" as a tool like Vitest transformed it, longer than the file
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 0
    And the output contains "REACH ok"

  @id=SCN-REPO-033 @status=implemented
  Scenario: REACH accepts a change whose lines a system test reaches
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change to the body of "used"
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 0
    And the output contains "REACH ok"

  @id=SCN-REPO-034 @status=implemented
  Scenario: REACH asks for a test run when a changed module has no coverage
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change to the body of "used"
    And no coverage report
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/package.json:1 no coverage in reports/coverage/ for this module: run its system tests first"

  @id=SCN-REPO-035 @status=implemented
  Scenario: make docs generates the Commands section from the CLI help
    Given a module whose "src/cli.ts --help" lists the command "demo run" as "Run the demo."
    And its README has the marker "generated by make docs from src/cli.ts --help" under "## Commands"
    When the developer runs "osf docs"
    Then the command exits with code 0
    And the module README has the row "| `demo run` | Run the demo. |"

  @id=SCN-REPO-036 @status=implemented
  Scenario: DOCS-AFFECTED ignores the files of a release
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a change that adds "modules/demo/CHANGELOG.md" and sets "version" in "modules/demo/package.json" to "0.2.0"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-037 @status=implemented
  Scenario: DOCS-AFFECTED lists a doc when package.json changes more than its version
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a change that sets "version" to "0.2.0" and adds the dependency "yaml" in "modules/demo/package.json"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED docs/how-to/demo.md:1"

  @id=SCN-REPO-055 @status=implemented
  Scenario: DOCS-AFFECTED ignores the version that a release writes into an extra file
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a release-please config whose package "modules/demo" lists the extra file "openapi.json" with the jsonpath "$.info.version"
    And a change that sets "info.version" in "modules/demo/openapi.json" to "0.2.0"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-125 @status=implemented
  Scenario: DOCS-AFFECTED ignores the pins that osf profile-pins writes for a release
    Given a base commit with a doc "docs/how-to/deploy.md" that covers "deploy/**" and a Compose profile and Helm chart that pin "demo" 0.2.0 as osf profile-pins writes them
    And a change that sets the workspace's version of "demo" to 0.3.0 and runs "osf profile-pins"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-126 @status=implemented
  Scenario: DOCS-AFFECTED lists a doc when the profile changes more than its pins
    Given a base commit with a doc "docs/how-to/deploy.md" that covers "deploy/**" and a Compose profile and Helm chart that pin "demo" 0.2.0 as osf profile-pins writes them
    And a change that sets the workspace's version of "demo" to 0.3.0, runs "osf profile-pins" and adds a comment to "deploy/compose/compose.yaml"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 1
    And the output names "docs/how-to/deploy.md" and "deploy/compose/compose.yaml"

  @id=SCN-REPO-038 @status=implemented
  Scenario: RUNS rejects a run record with prompt content
    Given a run record "runs/run-1.jsonl" whose chat span has the attribute "gen_ai.input.messages"
    When the developer runs "osf check RUNS"
    Then the command exits with code 1
    And the output contains "RUNS runs/run-1.jsonl:1 has content gen_ai.input.messages"

  @id=SCN-REPO-039 @status=implemented
  Scenario: RUNS rejects a run record that does not match the run-record contract
    Given a run record "runs/run-1.jsonl" without the resource attribute "osf.run.id"
    When the developer runs "osf check RUNS"
    Then the command exits with code 1
    And the output contains "RUNS runs/run-1.jsonl:1 does not match the run-record contract"
    And the output contains "osf.run.id"

  @id=SCN-REPO-040 @status=implemented
  Scenario: RUNS rejects agent commits without a run record
    Given a base commit
    And a later commit with the trailer "Co-Authored-By: Claude <noreply@anthropic.com>" that changes no file in "runs/"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 1
    And the output contains "no run record in runs/ changed: run make run-record and commit runs/"

  @id=SCN-REPO-041 @status=implemented
  Scenario: RUNS accepts agent commits that add a run record
    Given a base commit
    And a later commit with the trailer "Co-Authored-By: Claude <noreply@anthropic.com>" that adds the run record "runs/run-1.jsonl"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 0
    And the output contains "RUNS ok"

  @id=SCN-REPO-042 @status=implemented
  Scenario: RUNS asks no run record of commits without an agent trailer
    Given a base commit
    And a later commit without a "Co-Authored-By:" trailer that changes no file in "runs/"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-043 @status=implemented @replaces=SCN-REPO-001
  Scenario: A module created from the template passes the fast checks of osf
    Given a repository with the module template and an accepted ADR for the module "demo"
    And the developer ran "osf new-module demo"
    When the developer runs "osf check"
    Then the command exits with code 0
    And the output contains "ARCH ok"

  @id=SCN-REPO-068 @status=implemented
  Scenario: AFFECTED accepts a repository that caches its system tests by the rules
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 0
    And the output contains "AFFECTED ok"

  @id=SCN-REPO-069 @status=implemented
  Scenario: AFFECTED rejects a system test that starts an adapter its package does not declare
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the adapter "adapters/forge/github" named "@opensoftware/forge-github"
    And "modules/demo/system-tests/SCN-DEMO-001.test.ts" starts the adapter "forge/github"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 starts the adapter "forge/github", which modules/demo/package.json does not declare"

  @id=SCN-REPO-070 @status=implemented
  Scenario: AFFECTED rejects a system test that imports a workspace package its package does not declare
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "modules/demo/system-tests/SCN-DEMO-001.test.ts" imports "@opensoftware/other"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:1 imports "@opensoftware/other", which modules/demo/package.json does not declare"

  @id=SCN-REPO-071 @status=implemented
  Scenario: AFFECTED rejects a system test that reads a file of another package its package does not declare
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "modules/demo/system-tests/SCN-DEMO-001.test.ts" reads "../../other/features/a.feature"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 reads "../../other/features/a.feature" outside its package: declare the package or list the file in globalDependencies of turbo.json"

  @id=SCN-REPO-072 @status=deprecated
  Scenario: AFFECTED rejects a package with system tests that no tests job of CI runs
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the tests job "rest" of ".github/workflows/verify.yml" has the filter "!@opensoftware/demo !@opensoftware/other"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/other/package.json:1 no tests job of .github/workflows/verify.yml runs the system tests of @opensoftware/other"

  @id=SCN-REPO-073 @status=deprecated
  Scenario: AFFECTED rejects a package with system tests that two tests jobs of CI run
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the tests job "rest" of ".github/workflows/verify.yml" has the filter "!@opensoftware/other"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/package.json:1 the tests jobs demo and rest of .github/workflows/verify.yml both run the system tests of @opensoftware/demo"

  @id=SCN-REPO-097 @status=implemented @replaces=SCN-REPO-072
  Scenario: AFFECTED rejects a package with system tests that no suite of CI runs
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the suite "rest" of ".github/test-suites.yml" has the filter "!@opensoftware/demo !@opensoftware/other"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/other/package.json:1 no suite of .github/test-suites.yml runs the system tests of @opensoftware/other"

  @id=SCN-REPO-098 @status=implemented @replaces=SCN-REPO-073
  Scenario: AFFECTED rejects a package with system tests that two suites of CI run
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the suite "rest" of ".github/test-suites.yml" has the filter "!@opensoftware/other"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/package.json:1 the suites demo and rest of .github/test-suites.yml both run the system tests of @opensoftware/demo"

  @id=SCN-REPO-138 @status=implemented
  Scenario: AFFECTED rejects a package whose system tests open pages in a browser in a suite without one
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "modules/demo/system-tests/SCN-DEMO-001.test.ts" opens a page with "sut.browser"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/test-suites.yml:1 the system tests of @opensoftware/demo open pages with sut.browser: the suite demo needs "browser: chromium""

  @id=SCN-REPO-139 @status=implemented
  Scenario: AFFECTED accepts a package whose system tests open pages in a browser in a suite with Chromium
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "modules/demo/system-tests/SCN-DEMO-001.test.ts" opens a page with "sut.browser"
    And the suite "demo" of ".github/test-suites.yml" has "browser: chromium"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 0
    And the output contains "AFFECTED ok"

  @id=SCN-REPO-099 @status=implemented
  Scenario: AFFECTED rejects a suite whose filter names no package with system tests
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the suite "rest" of ".github/test-suites.yml" has the filter "!@opensoftware/demo !@opensoftware/gone"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/test-suites.yml:3 the suite rest names @opensoftware/gone, which is no package with system tests"

  @id=SCN-REPO-100 @status=implemented
  Scenario: AFFECTED rejects a tests job with a list of suites of its own
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the tests job of ".github/workflows/verify.yml" runs the suites "demo" and "rest" from its own matrix
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/workflows/verify.yml:13 the tests job must run the suites of the job plan: include: ${{ fromJSON(needs.plan.outputs.suites) }}"

  @id=SCN-REPO-101 @status=implemented
  Scenario: AFFECTED rejects a job plan that does not read the suites
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the job plan of ".github/workflows/verify.yml" reads no file
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/workflows/verify.yml:4 the job plan must read the suites of .github/test-suites.yml"

  @id=SCN-REPO-102 @status=implemented
  Scenario: AFFECTED rejects a tests job that keeps the turbo cache in a cache of its own
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the tests job of ".github/workflows/verify.yml" restores ".turbo/cache" from the cache "turbo-demo-"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/workflows/verify.yml:13 the job tests must keep .turbo/cache in the cache turbo-tests-"

  @id=SCN-REPO-103 @status=implemented
  Scenario: DEPS accepts a package that has the exact peer version of its dependency
    Given a lockfile in which "modules/demo" depends on "pair" 1.0.0, which needs its peer "base" exactly at 2.0.0
    And "modules/demo" depends on "base" 2.0.0
    When the developer runs "osf check DEPS"
    Then the command exits with code 0
    And the output contains "DEPS ok"

  @id=SCN-REPO-104 @status=implemented
  Scenario: DEPS rejects a package whose dependency needs another version of a peer
    Given a lockfile in which "modules/demo" depends on "pair" 1.0.0, which needs its peer "base" exactly at 2.0.0
    And "modules/demo" depends on "base" 2.0.1
    When the developer runs "osf check DEPS"
    Then the command exits with code 1
    And the output contains "DEPS modules/demo/package.json:1 pair 1.0.0 needs base 2.0.0 exactly; the package has 2.0.1"

  @id=SCN-REPO-105 @status=implemented
  Scenario: DEPS rejects a package without the required peer of its dependency and accepts a missing optional one
    Given a lockfile in which "modules/demo" depends on "pair" 1.0.0, which needs its peer "base" exactly at 2.0.0
    And "pair" 1.0.0 also needs the optional peer "extra" exactly at 3.0.0
    When the developer runs "osf check DEPS"
    Then the command exits with code 1
    And the output contains "DEPS modules/demo/package.json:1 pair 1.0.0 needs base 2.0.0 exactly; the package does not declare it"
    And the output does not contain "extra"

  @id=SCN-REPO-106 @status=implemented
  Scenario: PROFILE accepts a profile and a chart that osf profile-pins wrote
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 0
    And the output contains "PROFILE ok"

  @id=SCN-REPO-107 @status=implemented
  Scenario: PROFILE rejects a profile that does not pin the workspace's version of a package
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the workspace's version of "adapter" is 0.3.1
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/compose.yaml:8 is not the released pin; osf profile-pins writes "PACKAGES: "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.1"""
    And the output contains "PROFILE deploy/compose/compose.yaml:5 is not the released pin; osf profile-pins writes "image: ghcr.io/sesigl/open-software-factory/demo:0.2.0-r1""

  @id=SCN-REPO-108 @status=implemented
  Scenario: PROFILE rejects a module image whose tag is not the version of its own package
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the image of "demo" in the Compose profile has the tag 0.1.0
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/compose.yaml:4 the image demo:0.1.0 installs @opensoftware/demo@0.2.0: its tag must be 0.2.0 or 0.2.0-r<n>"

  @id=SCN-REPO-109 @status=implemented
  Scenario: PROFILE rejects a chart whose image tag differs from the profile's
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the Helm chart's tag of "demo" is 0.1.0
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE deploy/helm/osf/values.yaml:2 is not the released pin; osf profile-pins writes "demo: "0.2.0"""

  @id=SCN-REPO-110 @status=implemented
  Scenario: PROFILE rejects a chart image that the profile does not run
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the Helm chart's PostgreSQL image is "postgres:17-alpine"
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE deploy/helm/osf/values.yaml:4 the image postgres:17-alpine is not an image of deploy/compose/compose.yaml"

  @id=SCN-REPO-122 @status=implemented
  Scenario: PROFILE accepts a chart image that the profile builds
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the Compose profile builds the image "litellm" with the tag 1.106.2, and the Helm chart's LiteLLM image is that image
    When the developer runs "osf check PROFILE"
    Then the command exits with code 0

  @id=SCN-REPO-111 @status=implemented
  Scenario: PROFILE rejects a suite that starts an image it does not pull and pulls one that its packages do not name
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the suite "deploy" of ".github/test-suites.yml" pulls "nats:2.11.9-alpine"
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE .github/test-suites.yml:1 the suite deploy starts the image postgres:18-alpine but does not pull it"
    And the output contains "PROFILE .github/test-suites.yml:1 the suite deploy pulls nats:2.11.9-alpine, which none of its packages names"

  @id=SCN-REPO-116 @status=implemented
  Scenario: PROFILE rejects a pull that only the testkit names, as a suite names the testkit's fakes in "images"
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the suite "deploy" of ".github/test-suites.yml" pulls "postgres:18-alpine chrislusf/seaweedfs:3.97", which only the testkit names
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE .github/test-suites.yml:1 the suite deploy pulls chrislusf/seaweedfs:3.97, which none of its packages names"

  @id=SCN-REPO-112 @status=implemented
  Scenario: PROFILE rejects new packages of an image without a new tag, compared with the base
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And a change that moves "adapter" to 0.3.1 in the workspace and in the image of "demo", with its tag unchanged
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/compose.yaml:4 the packages of the image demo changed, so its tag 0.2.0 must change too"

  @id=SCN-REPO-113 @status=implemented
  Scenario: PROFILE rejects a changed chart without a new version, compared with the base
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And a change that adds the file "deploy/helm/osf/templates.yaml" to the chart
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 1
    And the output contains "PROFILE deploy/helm/osf/Chart.yaml:1 deploy/helm/osf/templates.yaml changed, so the chart's version must change too"

  @id=SCN-REPO-117 @status=implemented
  Scenario: PROFILE rejects a changed stage of the image Dockerfile without a new tag, compared with the base
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with the image of "demo" built from the target "demo" of "deploy/images/Dockerfile"
    And a change that adds a line to the stage "base" that the stage "demo" builds on, with the tag of "demo" unchanged
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/compose.yaml:4 the stage demo of deploy/images/Dockerfile changed, so the tag 0.2.0 of the image demo must change too"

  @id=SCN-REPO-118 @status=implemented
  Scenario: PROFILE accepts a changed comment of the image Dockerfile without a new tag, compared with the base
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with the image of "demo" built from the target "demo" of "deploy/images/Dockerfile"
    And a change that adds a comment to the stage "demo", with the tag of "demo" unchanged
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-119 @status=implemented
  Scenario: PROFILE rejects new packages of an image without a new tag also when a volume has the name of its service
    Given a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, and the volume "demo"
    And a change that moves "adapter" to 0.3.1 in the workspace and in the image of "demo", with its tag unchanged
    When the developer runs "osf check PROFILE" against the base commit
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/compose.yaml:4 the packages of the image demo changed, so its tag 0.2.0 must change too"

  @id=SCN-REPO-120 @status=implemented
  Scenario: PROFILE rejects a template of the reference factory whose tag differs from the profile's image
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the reference factory names the template "ghcr.io/sesigl/open-software-factory/demo:0.1.0"
    When the developer runs "osf check PROFILE"
    Then the command exits with code 1
    And the output contains "PROFILE deploy/compose/factory/factory.yaml:4 is not the released pin; osf profile-pins writes "template: ghcr.io/sesigl/open-software-factory/demo:0.2.0""

  @id=SCN-REPO-121 @status=implemented
  Scenario: osf profile-pins moves the template of the reference factory to the tag of the profile's image
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the reference factory names the template "ghcr.io/sesigl/open-software-factory/demo:0.1.0"
    When the developer runs "osf profile-pins"
    Then the command exits with code 0
    And the reference factory names the template "ghcr.io/sesigl/open-software-factory/demo:0.2.0"

  @id=SCN-REPO-114 @status=implemented
  Scenario: osf profile-pins moves a module image to the new version of its module
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the workspace's version of "demo" is 0.3.0
    When the developer runs "osf profile-pins"
    Then the command exits with code 0
    And "deploy/compose/compose.yaml" pins the image "demo:0.3.0" with the packages "@opensoftware/demo@0.3.0 @opensoftware/adapter@0.3.0"
    And the Helm chart's tag of "demo" is "0.3.0" and its version is 0.1.1

  @id=SCN-REPO-115 @status=implemented
  Scenario: osf profile-pins gives an image the next release tag when only an adapter moved
    Given a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them
    And the image of "demo" has the tag 0.2.0-r1 with "adapter" 0.3.1, and the workspace's version of "adapter" is 0.3.2
    When the developer runs "osf profile-pins"
    Then the command exits with code 0
    And "deploy/compose/compose.yaml" pins the image "demo:0.2.0-r2" with the packages "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.2"
    And the Helm chart's tag of "demo" is "0.2.0-r2" and its version is 0.1.1

  @id=SCN-REPO-074 @status=implemented
  Scenario: AFFECTED rejects a test suite that writes its JUnit results outside its own reports folder
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "modules/demo/vitest.config.ts" writes its JUnit results to "../../reports/junit/demo.xml"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED modules/demo/vitest.config.ts:1 writes its JUnit results elsewhere than "reports/junit.xml", which turbo stores and replays"

  @id=SCN-REPO-075 @status=implemented
  Scenario: AFFECTED rejects a test cache whose inputs leave out files of the package
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "turbo.json" gives "test:system" the inputs "$TURBO_DEFAULT$" and "!features/**"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED turbo.json:1 test:system must cache with the inputs ["$TURBO_DEFAULT$"], the outputs ["reports/**"] and the env ["OSF_TEST_RUN"]"

  @id=SCN-REPO-076 @status=implemented
  Scenario: AFFECTED rejects a test cache without a repository-wide file that the tests depend on
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "turbo.json" leaves "tools/scaffold/install-tools.ts" out of its "globalDependencies"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED turbo.json:1 globalDependencies leave out "tools/scaffold/install-tools.ts", which every system test depends on"

  @id=SCN-REPO-082 @status=implemented
  Scenario: AFFECTED rejects a test cache that turbo shares between worktrees
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And "turbo.json" sets no "cacheDir"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED turbo.json:1 cacheDir must be ".turbo/cache": results hold absolute paths, so a worktree must not replay those of another"

  @id=SCN-REPO-083 @status=implemented
  Scenario: AFFECTED rejects a run of the system tests that leaves their dependencies out of the hash
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the target "verify-tests" of "Makefile" runs "turbo run test:system --only"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED Makefile:2 runs test:system with --only, which leaves its dependencies out of the hash"

  @id=SCN-REPO-084 @status=implemented
  Scenario: AFFECTED rejects a Makefile that does not run lint, typecheck and build without the cache by default
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the target "verify-static" of "Makefile" runs lint, typecheck and build without "--force"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED Makefile:3 verify-static must run lint, typecheck and build with $(if $(OSF_TEST_CACHE),,--force)"

  @id=SCN-REPO-077 @status=implemented
  Scenario: AFFECTED rejects a workflow that uses the test cache outside pull requests
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And ".github/workflows/verify.yml" sets "OSF_TEST_CACHE: 1" for every event
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED .github/workflows/verify.yml:3 sets OSF_TEST_CACHE outside pull requests: only a pull request may replay test results"

  @id=SCN-REPO-078 @status=implemented
  Scenario: AFFECTED rejects a Makefile that does not give each run of the system tests its own hash by default
    Given a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081
    And the target "verify-tests" of "Makefile" runs the system tests without "OSF_TEST_RUN"
    When the developer runs "osf check AFFECTED"
    Then the command exits with code 1
    And the output contains "AFFECTED Makefile:1 verify-tests must give each run its own test hash with $(if $(OSF_TEST_CACHE),,OSF_TEST_RUN=$$$$-$$(date +%s))"

  @id=SCN-REPO-079 @status=implemented
  Scenario: collect-reports copies the results of each package to the reports folder of the repository
    Given a repository with the modules "demo" and "other"
    And "modules/demo/reports/junit.xml" and the coverage file "modules/demo/reports/coverage/coverage-7-1-0.json"
    When the developer runs "osf collect-reports"
    Then the command exits with code 0
    And "reports/junit/demo.xml" and "reports/coverage/demo-coverage-7-1-0.json" have the content of the package's files

  @id=SCN-REPO-085 @status=implemented
  Scenario: RELEASE accepts the release files that osf release-files wrote
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    When the developer runs "osf check RELEASE"
    Then the command exits with code 0
    And the output contains "RELEASE ok"

  @id=SCN-REPO-086 @status=implemented
  Scenario: osf release-files writes the publish workflow and the release entries of a published package
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    When the developer runs "osf release-files"
    Then the command exits with code 0
    And ".github/workflows/publish-demo.yml" publishes "@opensoftware/demo" from "modules/demo"
    And "release-please-config.json" has the entry "modules/demo" with the component "demo" and the initial version "0.1.0"
    And ".release-please-manifest.json" gives "modules/demo" the version "0.3.0"
    And no release file names "other"

  @id=SCN-REPO-087 @status=implemented
  Scenario: RELEASE rejects a published package without its publish workflow
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    And ".github/workflows/publish-demo.yml" is deleted
    When the developer runs "osf check RELEASE"
    Then the command exits with code 1
    And the output contains "RELEASE modules/demo/package.json:2 @opensoftware/demo has no .github/workflows/publish-demo.yml: run osf release-files"

  @id=SCN-REPO-088 @status=implemented
  Scenario: RELEASE rejects a publish workflow that differs from the template
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    And ".github/workflows/publish-demo.yml" gets one more line
    When the developer runs "osf check RELEASE"
    Then the command exits with code 1
    And the output contains "RELEASE .github/workflows/publish-demo.yml:1 differs from tools/scaffold/publish-workflow.yml: run osf release-files"

  @id=SCN-REPO-089 @status=implemented
  Scenario: RELEASE rejects a published package without its release-please entry
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    And "release-please-config.json" has no packages
    When the developer runs "osf check RELEASE"
    Then the command exits with code 1
    And the output contains "RELEASE release-please-config.json:1 has no entry for modules/demo with"

  @id=SCN-REPO-090 @status=implemented
  Scenario: RELEASE rejects a manifest version that differs from the package's version
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    And "modules/demo/package.json" has the version "0.4.0"
    When the developer runs "osf check RELEASE"
    Then the command exits with code 1
    And the output contains "RELEASE .release-please-manifest.json:2 does not give modules/demo its version 0.4.0: run osf release-files"

  @id=SCN-REPO-091 @status=implemented
  Scenario: RELEASE rejects the release files of a package that is no longer published
    Given a repository with the published module "demo" at version "0.3.0" and the private module "other"
    And the developer ran "osf release-files"
    And "modules/demo/package.json" is private
    When the developer runs "osf check RELEASE"
    Then the command exits with code 1
    And the output contains "RELEASE .github/workflows/publish-demo.yml:1 publishes no published package of the workspace: run osf release-files"
    And the output contains "RELEASE release-please-config.json:3 modules/demo is no published package: run osf release-files"

  @id=SCN-REPO-127 @status=implemented
  Scenario: make docs writes the report of the vision scenarios and the module scenarios that realize them
    Given a vision scenario "SCN-FACTORY-DEMO-001" with the status "planned" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "planned"
    And the implemented module scenario "SCN-DEMO-001" and the planned module scenario "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"
    And "docs/vision/README.md" has the marker "generated by make docs from software-factory.feature"
    When the developer runs "osf docs"
    Then the command exits with code 0
    And "docs/vision/README.md" has the row "| SCN-FACTORY-DEMO-001 | planned | SCN-DEMO-001 (implemented), SCN-DEMO-002 (planned) |"
    And "docs/vision/README.md" has the row "| SCN-FACTORY-DEMO-002 | planned | none |"

  @id=SCN-REPO-128 @status=implemented
  Scenario: VISION rejects a planned vision scenario whose realizing scenarios are all implemented
    Given a vision scenario "SCN-FACTORY-DEMO-001" with the status "planned" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "planned"
    And the implemented module scenarios "SCN-DEMO-001" and "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"
    When the developer runs "osf check VISION"
    Then the command exits with code 1
    And the output contains "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is planned, but the scenarios that realize it make it implemented: set @status=implemented"
    And the output does not name "SCN-FACTORY-DEMO-002"

  @id=SCN-REPO-129 @status=implemented
  Scenario: VISION rejects an implemented vision scenario with a planned realizing scenario or none
    Given a vision scenario "SCN-FACTORY-DEMO-001" with the status "implemented" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "implemented"
    And the implemented module scenario "SCN-DEMO-001" and the planned module scenario "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"
    When the developer runs "osf check VISION"
    Then the command exits with code 1
    And the output contains "VISION docs/vision/software-factory.feature:5 SCN-FACTORY-DEMO-001 is implemented, but the scenarios that realize it make it planned: set @status=planned"
    And the output contains "VISION docs/vision/software-factory.feature:9 SCN-FACTORY-DEMO-002 is implemented, but the scenarios that realize it make it planned: set @status=planned"

  @id=SCN-REPO-130 @status=implemented
  Scenario: VISION accepts status lines that follow the realizing scenarios and ignores deprecated ones
    Given a vision scenario "SCN-FACTORY-DEMO-001" with the status "implemented" and a vision scenario "SCN-FACTORY-DEMO-002" with the status "planned"
    And the implemented module scenario "SCN-DEMO-001" and the deprecated module scenario "SCN-DEMO-002" realize "SCN-FACTORY-DEMO-001"
    When the developer runs "osf check VISION"
    Then the command exits with code 0
    And the output contains "VISION ok"

  @id=SCN-REPO-131 @status=implemented
  Scenario: TODO rejects an open item whose slices are all ticked
    Given a "TODO.md" with the open item "T-01" whose two slices are ticked, the open item "T-02" with one open slice and the open item "T-03" without slices
    When the developer runs "osf check TODO"
    Then the command exits with code 1
    And the output contains "TODO TODO.md:3 T-01 is open, but every slice is ticked: tick the item, or add the slice that is left"
    And the output names neither "T-02" nor "T-03"
