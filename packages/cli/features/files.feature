@module=cli @owner=maintainers
Feature: Input and output files
  A command reads the files and folders named on its command line and writes its output into $OUTPUT.

  @id=SCN-CLI-009 @status=implemented
  Scenario: readInputs reads a file and the matching files below a folder, sorted by path
    Given the file "$INPUT/one.jsonl" with the text "1"
    And the folder "$INPUT/runs" with the files "b/c.jsonl", "a.jsonl" and "notes.md"
    When the module reads the inputs "one.jsonl" and "runs" with the pattern "\.jsonl$"
    Then it gets "one.jsonl", "runs/a.jsonl" and "runs/b/c.jsonl" in this order, each with its text

  @id=SCN-CLI-010 @status=implemented
  Scenario: readInputs refuses a path that does not exist
    When the module reads the input "missing.jsonl"
    Then it gets the usage error "<path of $INPUT>/missing.jsonl: no such file or folder"

  @id=SCN-CLI-011 @status=implemented
  Scenario: writeText creates the folder of the file
    When the module writes the text "done" to "$OUTPUT/reports/2026/summary.md"
    Then "$OUTPUT/reports/2026/summary.md" has the text "done"

  @id=SCN-CLI-012 @status=implemented
  Scenario: outputPath puts the file into $OUTPUT
    Given the environment variable "OUTPUT" is "/work/output"
    When the module asks for the output path of "report.json"
    Then it gets "/work/output/report.json"

  @id=SCN-CLI-013 @status=implemented
  Scenario: outputPath takes --out when the user gave it
    Given the environment variable "OUTPUT" is "/work/output"
    When the module asks for the output path of "report.json" with --out "custom.json"
    Then it gets "custom.json"

  @id=SCN-CLI-016 @status=implemented
  Scenario: outputPath puts the file into the current folder without $OUTPUT
    Given no environment variable "OUTPUT"
    When the module asks for the output path of "report.json"
    Then it gets "report.json"

  @id=SCN-CLI-014 @status=implemented
  Scenario: packageVersion reads the version of a package.json
    Given the file "$INPUT/package.json" with the version "1.4.2"
    When the module reads the package version of "$INPUT/package.json"
    Then it gets "1.4.2"
