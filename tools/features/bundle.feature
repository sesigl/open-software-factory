@module=tools @owner=maintainers
Feature: Bundled CLI packages
  A CLI package that a module starts often ships as one bundled file, so that each start loads one file instead of
  hundreds (ADR 0079). "osf bundle" builds it from the package's src/cli.ts and lists the license of every package in
  the bundle.

  @id=SCN-REPO-066 @status=implemented
  Scenario: osf bundle writes the bin, one bundle with a source map to the sources, and the notice of each bundled package
    Given a package "adapters/demo" whose "src/cli.ts" prints the greeting of the package "greeter" from node_modules
    And "greeter" has the license "MIT" and a LICENSE file
    When the developer runs "osf bundle adapters/demo"
    Then the command exits with code 0
    And "adapters/demo/dist/cli.js" turns on the compile cache and imports "./main.js"
    And the source map of "adapters/demo/dist/main.js" names "src/cli.ts" and holds the code of "greeter"
    And "adapters/demo/dist/THIRD-PARTY-NOTICES.md" names "greeter 1.0.0", its license "MIT" and its license text

  @id=SCN-REPO-067 @status=implemented
  Scenario: osf bundle refuses a bundled package without a license
    Given a package "adapters/demo" whose "src/cli.ts" prints the greeting of the package "greeter" from node_modules
    And "greeter" has no license in its package.json and no LICENSE file
    When the developer runs "osf bundle adapters/demo"
    Then the command exits with code 1
    And the error output says 'greeter 1.0.0 in the bundle of adapters/demo has no license'
