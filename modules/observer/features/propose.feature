@module=observer @owner=maintainers
Feature: Propose a fix as a pull request
  "observer propose" asks the model gateway for a fix of one problem in the instruction files, applies it on a branch
  of its own and opens a pull request with the problem, the solution and the evidence. A person reviews it.

  Background:
    Given a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."
    And "problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"

  @id=SCN-OBS-013 @status=implemented @realizes=SCN-FACTORY-IMPROVE-002
  Scenario: Propose opens a pull request with the sections Problem, Solution and Evidence
    Given the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."
    When the user runs "observer propose --repo <forge URL>/tester/factory problems.json"
    Then the command exits with code 0
    And the repository has one open pull request with the title "observer: research-skill-used failed 30 of 40 runs"
    And its description has the sections "Problem", "Solution" and "Evidence"
    And its Evidence section names the run "run-1" with "Investigated inline." and "https://langfuse.example/trace/1"
    And the output names the URL of the pull request

  @id=SCN-OBS-014 @status=implemented @realizes=SCN-FACTORY-IMPROVE-003
  Scenario: Propose changes only its own branch, never the default branch
    Given the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."
    When the user runs "observer propose --repo <forge URL>/tester/factory problems.json"
    Then "AGENTS.md" on the branch "main" still says "Investigate inline."
    And the pull request's branch starts with "observer/research-skill-used-" and merges into "main"
    And "AGENTS.md" on the pull request's branch says "Use the research skill before you investigate."

  @id=SCN-OBS-015 @status=implemented
  Scenario: A proposal that changes a protected path is marked "needs human"
    Given the model gateway answers a prompt with "Investigated inline." with the solution "Run the research check in CI." and a new file ".github/workflows/research.yml"
    When the user runs "observer propose --repo <forge URL>/tester/factory problems.json"
    Then the command exits with code 0
    And the pull request's title starts with "[needs human] observer: research-skill-used"
    And its description says "needs human: the change touches the protected path .github/workflows/research.yml"

  @id=SCN-OBS-016 @status=implemented
  Scenario: An edit whose old text is not in the file opens no pull request
    Given the model gateway answers a prompt with "Investigated inline." with the solution "Stop running tests twice." and an edit of "AGENTS.md" from "Run tests twice." to "Run tests once."
    When the user runs "observer propose --repo <forge URL>/tester/factory problems.json"
    Then the command exits with code 1
    And the error output says "observer: the edit of AGENTS.md does not apply: the text "Run tests twice." is not in the file"
    And the repository has no pull request

  @id=SCN-OBS-029 @status=implemented
  Scenario: An answer that is no proposal opens no pull request
    Given the model gateway answers a prompt with "Investigated inline." with the text "Tell the agent to use the research skill."
    When the user runs "observer propose --repo <forge URL>/tester/factory problems.json"
    Then the command exits with code 1
    And the error output says "observer: the model's answer is no proposal with "solution" and "edits": Tell the agent to use the research skill."
    And the repository has no pull request
