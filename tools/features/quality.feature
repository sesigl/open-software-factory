@module=tools @owner=maintainers
Feature: Quality limits
  DUP limits duplicated code inside a unit and forbids it across units. MUTATION limits the mutants that no system
  test notices, in the lines a change adds and in a module as a whole. Each unit states its limits in its AGENTS.md
  under "Quality limits" (ADR 0037).

  @id=SCN-REPO-044 @status=implemented
  Scenario: DUP rejects a module whose duplicated lines exceed its limit
    Given a module "demo" with the limit "Duplication: at most 3%"
    And "modules/demo/src/sum.ts" holds the same function twice under two names
    When the developer runs "osf check DUP"
    Then the command exits with code 1
    And the output contains "of the lines of modules/demo are duplicated, the limit is 3%"
    And the output contains "duplicate modules/demo/src/sum.ts"

  @id=SCN-REPO-045 @status=implemented
  Scenario: DUP rejects a clone between two modules
    Given the modules "billing" and "payroll" with the limit "Duplication: at most 3%"
    And "modules/billing/src/sum.ts" and "modules/payroll/src/sum.ts" hold the same function
    When the developer runs "osf check DUP"
    Then the command exits with code 1
    And the output contains "duplicate modules/payroll/src/sum.ts"
    And the output contains "move the shared code into a package in packages/ or into contracts/"

  @id=SCN-REPO-046 @status=implemented
  Scenario: DUP rejects a baseline entry whose clone is gone
    Given the modules "billing" and "payroll" with the limit "Duplication: at most 3%" and no clone between them
    And "docs/quality/duplication-baseline.json" lists a clone between their files "src/sum.ts"
    When the developer runs "osf check DUP"
    Then the command exits with code 1
    And the output contains "DUP docs/quality/duplication-baseline.json"
    And the output contains "is gone: remove it from the baseline"

  @id=SCN-REPO-047 @status=implemented
  Scenario: DUP rejects a module without a duplication limit
    Given a module "demo" with a source file and an AGENTS.md without "Quality limits"
    When the developer runs "osf check DUP"
    Then the command exits with code 1
    And the output contains 'DUP modules/demo/AGENTS.md:1 no "Duplication: at most N%" limit for modules/demo'

  @id=SCN-REPO-048 @status=implemented
  Scenario: MUTATION rejects a change whose mutants in changed lines score below the limit
    Given a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 3 lines
    And a change that adds lines 4 to 6 to "src/run.ts"
    And a mutation report with a killed and a survived mutant on line 5 and a survived mutant on line 2
    When the developer runs "osf check MUTATION" against the base commit
    Then the command exits with code 1
    And the output contains "50% of the mutants in changed lines of modules/demo were detected, the limit is 70%"
    And the output contains "MUTATION modules/demo/src/run.ts:5 no test notices the mutant ConditionalExpression"
    And the output does not contain "src/run.ts:2"

  @id=SCN-REPO-049 @status=implemented
  Scenario: MUTATION accepts a change whose mutants in changed lines are all killed
    Given a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 3 lines
    And a change that adds lines 4 to 6 to "src/run.ts"
    And a mutation report with a killed mutant on line 5 and a survived mutant on line 2
    When the developer runs "osf check MUTATION" against the base commit
    Then the command exits with code 0
    And the output contains "MUTATION ok"

  @id=SCN-REPO-050 @status=implemented
  Scenario: MUTATION with --total rejects a module whose total score is below the limit
    Given a module "demo" with the limit "80% in total"
    And a mutation report with 3 killed and 2 survived mutants
    When the developer runs "osf check MUTATION --total"
    Then the command exits with code 1
    And the output contains "60% of the mutants of modules/demo were detected, the limit is 80%"

  @id=SCN-REPO-051 @status=implemented
  Scenario: MUTATION asks for a mutation run when a changed module has no report
    Given a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 3 lines
    And a change that adds lines 4 to 6 to "src/run.ts"
    When the developer runs "osf check MUTATION" against the base commit
    Then the command exits with code 1
    And the output contains "no mutation report reports/mutation/modules-demo.json: run make mutation"

  @id=SCN-REPO-052 @status=implemented
  Scenario: MUTATION rejects a module without a mutation script
    Given a module "demo" with a source file, its quality limits and a package.json without a "mutation" script
    When the developer runs "osf check MUTATION --total"
    Then the command exits with code 1
    And the output contains "MUTATION modules/demo/package.json"
    And the output contains 'has no "mutation" script'

  @id=SCN-REPO-058 @status=implemented
  Scenario: MUTATION rejects a library in packages without a mutation script
    Given a library "packages/money" with a source file, its quality limits and a package.json without a "mutation" script and without a bin
    When the developer runs "osf check MUTATION --total"
    Then the command exits with code 1
    And the output contains "MUTATION packages/money/package.json"
    And the output contains 'has no "mutation" script'

  @id=SCN-REPO-053 @status=implemented
  Scenario: osf mutation lists the line ranges a change adds
    Given a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 5 lines
    And a change that adds lines 4 to 6 and line 9 to "src/run.ts"
    When the developer runs "osf mutation modules/demo --list" against the base commit
    Then the command exits with code 0
    And the output is "src/run.ts:4-6" and "src/run.ts:9-9", one per line
