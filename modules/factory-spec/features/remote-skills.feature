@module=factory-spec @owner=maintainers
Feature: Skills of other Git repositories
  An agent's skills entry may name a folder of another Git repository at a ref: "git+<url>#<ref>:<path>" (ADR 0146).
  "factory plan" pins its commit and the hash of its files in factory.lock under "skills", by the skill's name, and
  keeps the pin while the entry is unchanged. It checks the fetched skill with the rules of lint before it writes the
  lock. "factory render" links the skill fetched at its pin, and "factory skills" prints it with its repository and
  commit. "factory lint" reads no network: it refuses an entry of another form and a second skill of one name, and
  warns about an entry that factory.lock does not pin.

  @id=SCN-FSPEC-120 @status=implemented
  Scenario: Plan pins a skill of another repository with its commit and the hash of its files
    Given the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL
    And a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review"
    When the factory engineer runs "factory plan", then "factory plan --check" and "factory lint"
    Then the command exits with code 0
    And the output starts with "+ factory.lock.skills.review: " and the pin
    And factory.lock pins the skill "review" for its entry at the commit of "main", with the hash "h1:" of its files, a valid factory-lock of the contracts
    And "factory plan --check" prints "factory.lock is current." and "factory lint" prints "factory.yaml: no problems"

  @id=SCN-FSPEC-121 @status=implemented
  Scenario: Plan keeps a pin while its entry is unchanged, also when its branch moves, and shows the old and the new commit when its ref changes
    Given the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL
    And a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review", which "factory plan" pinned
    And a newer commit of "shared/review/SKILL.md" on "main" is tagged "v2"
    When the factory engineer runs "factory plan" again, and then once more with the entry "git+<url>#v2:shared/review"
    Then the first run names no change of factory.lock, and factory.lock still pins the first commit
    And the second run's output contains "~ factory.lock.skills.review.commit: \"<first commit>\" -> \"<commit of v2>\""
    And factory.lock pins the commit of "v2"

  @id=SCN-FSPEC-122 @status=implemented
  Scenario: Plan refuses a fetched skill that the rules of lint refuse, names the file by its entry, and writes no factory.lock
    Given the skill "review" without a description and with the metadata "opensoftware/secrets: LINEAR_TOKEN" is committed in "shared/review" of a Git repository at a "file://" URL
    And a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review" on line 14 and no secret
    When the factory engineer runs "factory plan"
    Then the command exits with code 1
    And the output names "factory.yaml:14:14 agent \"triage\" lacks the secret LINEAR_TOKEN that its skill \"review\" needs" and "git+<url>#main:shared/review/SKILL.md:2:1 the skill has no description"
    And the folder of factory.yaml has no factory.lock

  @id=SCN-FSPEC-123 @status=implemented
  Scenario: Lint refuses a local skill and a skill of another repository with one name
    Given a factory.yaml whose agent "triage" has the skills "./skills/review" and "git+https://forge.example/acme/skills.git#v1:skills/review" on line 14
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output starts with "factory.yaml:14:31 the skill \"git+https://forge.example/acme/skills.git#v1:skills/review\" has the name \"review\" of the skill \"./skills/review\": a factory uses one skill of a name"
    And it ends with "factory.yaml: 1 problems, 1 warning"

  @id=SCN-FSPEC-124 @status=implemented
  Scenario: Lint names an entry of another repository without a folder or outside it, and warns about one without a pin
    Given a factory.yaml whose agent "triage" has the skills "git+https://forge.example/acme/skills.git#main", "git+https://forge.example/acme/skills.git#main:../review", "git+https://forge.example/acme/skills.git#main:/review" and "git+https://forge.example/acme/skills.git#v1:skills/review" on line 14
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output names the first entry as "is no git+<url>#<ref>:<path>: name a ref and the skill's folder", the second and the third as "names a folder outside its repository"
    And it warns "factory.lock has no pin of the skill \"review\" for \"git+https://forge.example/acme/skills.git#v1:skills/review\": run \"factory plan\"" at the fourth

  @id=SCN-FSPEC-125 @status=implemented
  Scenario: "factory plan --check" names a skill of another repository that factory.lock does not pin, and writes nothing
    Given a factory.yaml whose agent "triage" has the skill "git+https://forge.example/acme/skills.git#v1:skills/review" and no factory.lock
    When the factory engineer runs "factory plan --check"
    Then the command exits with code 1
    And the output is "factory.lock has no pin of the skill \"review\" for \"git+https://forge.example/acme/skills.git#v1:skills/review\": run \"factory plan\""
    And the folder of factory.yaml has no factory.lock

  @id=SCN-FSPEC-126 @status=implemented
  Scenario: Render links a skill of another repository at the commit of its pin, also after its branch moved
    Given the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL
    And a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review", which "factory plan" pinned
    And "main" has a newer commit of "shared/review/SKILL.md"
    When the factory engineer runs "factory render"
    Then the command exits with code 0
    And ".claude/skills/review/SKILL.md" in the output folder is the text of the pinned commit

  @id=SCN-FSPEC-127 @status=implemented
  Scenario: Render refuses a skill of another repository that factory.lock does not pin
    Given a factory.yaml whose agent "triage" has the skill "git+https://forge.example/acme/skills.git#v1:skills/review" and no factory.lock
    When the factory engineer runs "factory render"
    Then the command exits with code 1
    And the output contains "factory.lock has no pin of the skill \"review\" for \"git+https://forge.example/acme/skills.git#v1:skills/review\": run \"factory plan\""

  @id=SCN-FSPEC-128 @status=implemented
  Scenario: "factory skills" prints a pinned skill with its repository and commit, and one without a pin with its problem
    Given the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL
    And a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review", which "factory plan" pinned
    And whose agent "spec" has the skill "git+https://forge.example/acme/skills.git#v1:./skills//changelog/", which factory.lock does not pin
    When the factory engineer runs "factory skills"
    Then the command exits with code 0
    And the skill "review" has the source folder "shared/review", the repository "file://<path>" and the pinned commit, its description, its files and its body
    And the skill "changelog" has the source folder "skills/changelog" and the repository "https://forge.example/acme/skills.git" without a commit, no files, no body and the problem "factory.lock has no pin of the skill \"changelog\" for \"git+https://forge.example/acme/skills.git#v1:./skills//changelog/\": run \"factory plan\""
    And the output is a valid skill catalog of the contracts
