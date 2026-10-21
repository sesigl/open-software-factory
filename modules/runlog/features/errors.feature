@module=runlog @owner=maintainers
Feature: Files runlog cannot export
  runlog names the file it cannot export and why, and writes nothing.

  @id=SCN-RUN-019 @status=deprecated
  Scenario: A file that is no session is refused
    Given a file "notes.txt" with the text "hello"
    When the developer runs "runlog export notes.txt"
    Then the command exits with code 1
    And the output contains "notes.txt is neither a Claude Code nor a Codex session"

  @id=SCN-RUN-020 @status=implemented
  Scenario: A missing session file is named
    When the developer runs "runlog export missing.jsonl"
    Then the command exits with code 1
    And the output contains "cannot read missing.jsonl"

  @id=SCN-RUN-025 @status=implemented @replaces=SCN-RUN-019
  Scenario: A file that is no session of a known harness is refused
    Given a file "notes.txt" with the text "hello"
    When the developer runs "runlog export notes.txt"
    Then the command exits with code 1
    And the output contains "notes.txt is not a Claude Code, Codex or OpenCode session"


  @id=SCN-RUN-079 @status=implemented
  Scenario: A JSON file with messages but without a session ID is refused
    Given a file "chat.json" with the text "{\"messages\": []}"
    When the developer runs "runlog export chat.json"
    Then the command exits with code 1
    And the output contains "chat.json is not a Claude Code, Codex or OpenCode session"
