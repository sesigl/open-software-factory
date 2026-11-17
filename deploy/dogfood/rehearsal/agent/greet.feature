Feature: Greet a person

  @id=SCN-GREET-001 @status=planned
  Scenario: greet("Ada") says hello to Ada
    When a program calls greet("Ada")
    Then it gets "Hello, Ada!"
