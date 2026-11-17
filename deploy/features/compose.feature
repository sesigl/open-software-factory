@module=deploy @owner=maintainers
Feature: The Compose profile installs a complete factory with one command
  An operator copies ".env.example" to ".env", sets its values and runs "docker compose up" in "deploy/compose/".
  The profile starts PostgreSQL with Temporal and pgvector, NATS, Jaeger, LiteLLM, gatekeeper, intake, foreman and
  console, with the reference factory in "deploy/compose/factory/" (ADR 0074). A module is healthy when its
  "/v1/health" answers 2xx (ADR 0086). The foreman starts the agents' sandboxes from the image of "agent-template",
  through "docker-proxy", its only way to the Docker API (ADR 0096). The scenarios tagged "@shared=compose-profile" only
  read the profile, or work in a sandbox of their own, and share one start of it; every other scenario starts a project
  of its own (ADR 0157).

  @id=SCN-DIST-001 @status=deprecated @realizes=SCN-FACTORY-OPEN-006
  Scenario: Every service of the Compose profile is healthy after one command
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "seaweedfs", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0

  @id=SCN-DIST-016 @status=deprecated @realizes=SCN-FACTORY-OPEN-006 @replaces=SCN-DIST-001
  Scenario: Every service of the Compose profile is healthy after one command, and each server's health checks pass
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0
    And "/v1/health" of "intake", "gatekeeper" and "foreman" answers 200 with the status "ok"
    And "docker compose run --rm console console doctor" exits with code 0 and prints no line that starts with "FAIL"

  @id=SCN-DIST-026 @status=implemented @realizes=SCN-FACTORY-OPEN-006 @replaces=SCN-DIST-016 @shared=compose-profile
  Scenario: Every service of the Compose profile is healthy after one command, Jaeger as the trace store, and each server's health checks pass
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 0
    And the services "postgres", "temporal", "temporal-ui", "nats", "jaeger", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy
    And the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0
    And "/v1/health" of "intake", "gatekeeper" and "foreman" answers 200 with the status "ok"
    And "docker compose run --rm console console doctor" exits with code 0 and prints no line that starts with "FAIL"

  @id=SCN-DIST-017 @status=implemented @realizes=SCN-FACTORY-RUNTIME-004 @shared=compose-profile
  Scenario: The foreman of the Compose profile starts a sandbox from the agents' template through docker-proxy only
    Given the Compose profile with every value of ".env.example" set in ".env"
    And the operator ran "docker compose up --detach --wait"
    When the service "foreman" runs "sandbox-docker create" with a spec of the image of "agent-template" and the egress allowlist "litellm"
    Then the sandbox has the programs "harness-claude-code", "gh", "git" and "make"
    And in the sandbox, "GET http://litellm:4000/health/liveliness" answers 200, and a request to "http://postgres:5432" fails
    And after "sandbox-docker destroy", "sandbox-docker list" in the service "foreman" does not list the sandbox
    And in the service "foreman", "docker version" exits with code 0, and "docker volume ls" and a container with the bind mount "/:/host" fail with "Forbidden"
    And the service "foreman" has no file "/var/run/docker.sock", and "docker-proxy" answers 403 to the service "console"

  @id=SCN-DIST-002 @status=implemented
  Scenario: The Compose profile names the value that .env is missing
    Given the Compose profile with every value of ".env.example" set in ".env" except "FOREMAN_API_TOKEN"
    When the operator runs "docker compose up --detach --wait"
    Then the command exits with code 1
    And the output contains "set FOREMAN_API_TOKEN in .env"

  @id=SCN-DIST-003 @status=implemented @shared=compose-profile
  Scenario: The console of the Compose profile lists the runs of its foreman
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the console's page "/" answers 200 with the heading "Runs"
    And the page does not say "did not answer"

  @id=SCN-DIST-004 @status=implemented @shared=compose-profile
  Scenario: The console of the Compose profile shows the agents of the reference factory
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the console's page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"

  @id=SCN-DIST-036 @status=deprecated
  Scenario: The console of the Compose profile renders its health page from the templates its package ships
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait console"
    Then the console's page "/health" has the heading "Health" and the columns "Check", "State" and "What to do"
    And the page allows only the console's own files and no script

  @id=SCN-DIST-050 @status=implemented @replaces=SCN-DIST-036 @shared=compose-profile
  Scenario: The console of the Compose profile renders its health page from the templates its package ships, and allows only its own files
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose up --detach --wait"
    Then the console's page "/health" has the heading "Health" and the columns "Check", "State" and "What to do"
    And the page allows only the console's own files, its script files too, and no inline script

  @id=SCN-DIST-005 @status=deprecated
  Scenario: The plan of the reference factory adds the factory and finds no problems
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-020 @status=implemented @replaces=SCN-DIST-005
  Scenario: The plan of the reference factory adds the factory and finds no problems, with its inference config
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-006 @status=implemented
  Scenario: After the reference factory is applied, its plan shows no changes
    Given the Compose profile with every value of ".env.example" set in ".env"
    And the operator ran "docker compose run --rm factory apply --agent implement"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "No changes."

  @id=SCN-DIST-015 @status=implemented
  Scenario: The plan of this repository's factory adds the factory and finds no problems
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory plan"
    Then the command exits with code 0
    And the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-012 @status=implemented
  Scenario: The verify stage of the reference factory waits for the check "verify"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-028 @status=implemented
  Scenario: The reference factory asks for approval of the spec after the stage "spec" and before "implement"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "spec" of the resolved factory has no gate
    And the stage "implement" of the resolved factory has the gate of "maintainers" with the policy "./policy/spec.rego"

  @id=SCN-DIST-029 @status=implemented
  Scenario: The ship stage of the reference factory starts only when the checks "verify" and "proof" succeeded
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "ship" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-030 @status=implemented
  Scenario: The ship stage of this repository's factory starts only when the checks "verify" and "proof" succeeded
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "ship" of the resolved factory has the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-031 @status=implemented
  Scenario: The verify stage of the reference factory only waits and runs no agent
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has "wait: true", no agent, the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-032 @status=implemented
  Scenario: The verify stage of this repository's factory only waits and runs no agent
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory resolve"
    Then the command exits with code 0
    And the stage "verify" of the resolved factory has "wait: true", no agent, the checks ["verify"] and the evidence "required"

  @id=SCN-DIST-013 @status=deprecated
  Scenario: The Compose profile takes the module images from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console" and "factory-spec" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-018 @status=deprecated @replaces=SCN-DIST-013
  Scenario: The Compose profile takes the module images and the agents' template from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec" and "harness-claude-code" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-023 @status=deprecated @replaces=SCN-DIST-018
  Scenario: The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec", "harness-claude-code" and "litellm" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"

  @id=SCN-DIST-041 @status=implemented @replaces=SCN-DIST-023
  Scenario: The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry, and OpenBao from its own
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --images"
    Then the command exits with code 0
    And the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec", "harness-claude-code" and "litellm" as "ghcr.io/sesigl/open-software-factory/<name>:<version>", "console" twice: for "console" and for the job "openbao-policies"
    And the output lists "quay.io/openbao/openbao:2.7.2" twice: for "openbao" and for the job "openbao-setup"

  @id=SCN-DIST-027 @status=implemented
  Scenario: The profile's LLM gateway holds no code under BerriAI's enterprise license
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose run --rm --no-deps" in the service "litellm" to look for LiteLLM's enterprise code
    Then the command exits with code 0
    And the output says "no enterprise code"


  @id=SCN-DIST-014 @status=implemented @realizes=SCN-FACTORY-ACCESS-001
  Scenario: The intake of the Compose profile turns a GitHub issue labeled "factory" into a work item
    Given the Compose profile with every value of ".env.example" set in ".env" and "INTAKE_WEBHOOK_SECRET" set
    And the operator ran "docker compose up --detach --wait intake"
    And a GitHub webhook for issues to intake's "/forge/events", signed with the value of "INTAKE_WEBHOOK_SECRET"
    When "tester" adds the label "factory" to the issue "Export reports as CSV"
    Then intake shows a work item "Export reports as CSV" in the state "received" with the issue's link as its dedupe key

  @id=SCN-DIST-034 @status=implemented
  Scenario: The service improve writes the reports of ledger and observer and judges no run without scorers
    Given the Compose profile with every value of ".env.example" set in ".env" and "IMPROVE_INTERVAL" set to "0"
    When the operator runs "docker compose --profile improve run --rm improve"
    Then the command exits with code 0
    And the volume "improve" holds "reports/ledger.json" and "reports/problems.json" and no "scores/scores.jsonl"

  @id=SCN-DIST-037 @status=implemented @realizes=SCN-FACTORY-RUNTIME-011
  Scenario: With the sign-in on, the console of the Compose profile lets in only the people of the factory's access.yaml
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with the client of a GitHub OAuth app, and "CONSOLE_PORT" set to "18080"
    And the operator's factory, whose "access.yaml" lists "ada@acme.dev" as "admin" in place of "admin@example.com"
    And GitHub is a fake on the Docker host, which the console reaches as "host.docker.internal"
    And the operator ran "docker compose run --rm factory-repo", which commits the factory into its volume
    When the operator runs "docker compose up --detach --wait --no-deps console"
    Then the service "console" is running and healthy
    And the console's page "/" sends a person without a session to the sign-in page with the button "Sign in with GitHub"
    And the button sends the person to GitHub with the callback "http://localhost:18080/signin/callback"
    And "ada@acme.dev" comes back from GitHub, the console trades the code with the client of ".env", and the page "/" has the heading "Runs" and the account "ada@acme.dev · admin"
    And "mallory@acme.dev" comes back from GitHub and reads "mallory@acme.dev is not on this factory's access list"

  @id=SCN-DIST-039 @status=implemented
  Scenario: The profile's OpenBao keeps a stored secret over a restart, unseals itself, and a sandbox still sends the value
    Given the Compose profile with every value of ".env.example" set in ".env", OpenBao's unseal key, root token and two token IDs as "osf init" generates them
    And the operator ran "docker compose run --rm openbao-setup" and "docker compose up --detach --wait docker-proxy"
    And the console's secrets adapter stored "linear-token" with the console's token, by "ada@acme.dev"
    When the operator runs "docker compose down" and then the same two commands again
    Then the service "openbao" is running, healthy and unsealed, and no person unsealed it
    And "secrets-openbao list" in the service "console" names "linear-token" in version 1 by "ada@acme.dev"
    And OpenBao refuses the console's token a read of the value of "linear-token" with 403
    And a sandbox that the service "foreman" creates with the egress allowlist "host.docker.internal" and "LINEAR_TOKEN" from "ref:openbao/linear-token" sends "Authorization: Bearer" and the value to the API at "host.docker.internal"
    And the audit log on the volume "openbao" names the read of "secret/data/linear-token" and does not hold the value
    And while the profile runs and nobody calls OpenBao for 5 seconds, its audit log gets no entry: the health check, every second, asks "sys/health", which OpenBao does not audit

  @id=SCN-DIST-042 @status=implemented
  Scenario: The reference factory's workflows post the check "factory" from "factory lint" and "factory plan --check", and both pass on the reference factory
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator reads the workflows "factory" of the reference factory in ".github/workflows/" and ".forgejo/workflows/"
    Then each runs on pull requests and on pushes to the branch "main"
    And the job of GitHub's is named "factory", which is the name of its check
    And the job of Forgejo's posts the commit status "factory" with "forge-forgejo check": "pending" first, then "success" or "failure"
    And each runs "factory lint" and "factory plan --check" with "@opensoftware/factory-spec" at the version that the profile's service "factory" pins
    And "docker compose run --rm factory lint" and "docker compose run --rm factory plan --check" exit with code 0 on the reference factory

  @id=SCN-DIST-043 @status=implemented
  Scenario: With "FACTORY_REPOSITORY", the service factory-repo clones the factory's private repository on a forge at each start, with "FACTORY_TOKEN"
    Given a private repository "tester/factory" on the forge with the reference factory, which the containers reach as "host.docker.internal"
    And the Compose profile with every value of ".env.example" set in ".env", "FACTORY_REPOSITORY" set to "git+<the forge>/tester/factory.git#main" and "FACTORY_TOKEN" to a token of the forge
    When the operator runs "docker compose run --rm factory-repo"
    Then the command exits with code 0
    And the volume "factory" holds the newest commit of "main" with the repository's "factory.yaml" and "policy/spec.rego"
    And no file of the volume "factory" holds the token
    When a person commits a new "groups.json" on "main" and the operator runs "docker compose run --rm factory-repo" again
    Then the volume "factory" holds that commit and its "groups.json"
    When the operator runs "docker compose run --rm factory-repo" with an empty "FACTORY_TOKEN"
    Then the command exits with code 1
    And it prints "factory-repo: cannot clone main of <the forge>/tester/factory.git" and "check FACTORY_REPOSITORY and FACTORY_TOKEN"
    And the volume "factory" still holds that commit

  @id=SCN-DIST-044 @status=implemented
  Scenario: With "FACTORY_REPOSITORY" on Forgejo, the foreman and the console read the factory from the repository with the one token, and the console edits it with the factory-spec of its image
    Given the Compose profile with every value of ".env.example" set in ".env", and "FACTORY_REPOSITORY", "FACTORY_TOKEN", "FACTORY_USER", "FACTORY_FORGE_ADAPTER" and "FACTORY_FORGE_URL" set for a repository on Forgejo
    When the operator runs "docker compose config --format json"
    Then the service "foreman" sets "FOREMAN_FACTORY" to the repository and "FOREMAN_FACTORY_TOKEN" to the token
    And the service "console" sets "CONSOLE_FACTORY_REPOSITORY", "CONSOLE_FACTORY_TOKEN", "CONSOLE_FACTORY_USER", "CONSOLE_FORGE_ADAPTER" and "CONSOLE_FORGE_URL" to the values, and "CONSOLE_FACTORY_COMMAND" to "factory"
    And no service but "factory-repo", "foreman" and "console" gets the token
    And "factory --help" runs in the service "console" and names the command "edit"

  @id=SCN-DIST-046 @status=implemented
  Scenario: With the sign-in and "CONSOLE_SIGNING_KEY", the console signs the proof of the person and foreman, intake and gatekeeper check it with the console's key set
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and "CONSOLE_SIGNING_KEY" set
    When the operator runs "docker compose config --format json"
    Then the service "console" sets "CONSOLE_SIGNING_KEY" to the key, and no other service gets the key
    And the services "foreman", "intake" and "gatekeeper" set "FOREMAN_PERSON_KEYS", "INTAKE_PERSON_KEYS" and "GATEKEEPER_PERSON_KEYS" to "console=http://console:8080/.well-known/jwks.json"
    When the operator runs it again without "CONSOLE_SIGNING_KEY", and again with the key and without "CONSOLE_SIGN_IN"
    Then both times the three settings of the modules are empty, so the modules take the person a caller names, as before

  @id=SCN-DIST-048 @status=deprecated
  Scenario: With the sign-in and "CONSOLE_SIGNING_KEY", the released intake refuses a work item whose made-up person has no proof, and the console publishes its key
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and "CONSOLE_SIGNING_KEY" set
    And the operator ran "docker compose run --rm factory-repo", which commits the factory into its volume
    When the operator runs "docker compose up --detach --wait intake" and "docker compose up --detach --wait --no-deps console"
    And a program posts a work item to intake's "/v1/work-items" with "INTAKE_API_TOKEN" and the requester "varun@acme.dev" of the kind "person", without the header "OSF-Person"
    Then intake answers 401 with "send OSF-Person: the console's proof of the person (ADR 0151)"
    And intake holds no work item with the dedupe key of the post
    And the console's "/.well-known/jwks.json" answers 200 with one key of "kty" "OKP"

  @id=SCN-DIST-049 @status=deprecated
  Scenario: With the sign-in and without "CONSOLE_SIGNING_KEY", "console doctor" of the released console warns that the modules would refuse its actions
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and no "CONSOLE_SIGNING_KEY"
    When the operator runs "docker compose run --rm --no-deps console console doctor"
    Then the output has the line "WARN  person proof: set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs"
    And no line of the output starts with "FAIL  person proof"

  @id=SCN-DIST-053 @status=implemented @images=commit
  Scenario: Each module image that the deploy suite starts installs the packages of the factory from this workspace's packs, not from npm
    Given the module images of the Compose profile built from this workspace with "node scripts/images.ts", at the tags that "compose.yaml" pins
    When the operator runs "npm ls --all --json" in "/opt/osf" of the services "agent-template", "console", "factory", "foreman", "gatekeeper", "improve" and "intake" with "docker compose run --rm --no-deps"
    Then each package of the service's "PACKAGES" is installed at the version that "compose.yaml" pins
    And every "@opensoftware" package in each image is resolved from a pack in "/opt/osf/packs"

  @id=SCN-DIST-054 @status=implemented @replaces=SCN-DIST-048
  Scenario: With the sign-in and "CONSOLE_SIGNING_KEY", intake refuses a work item whose made-up person has no proof, and the console publishes its key
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and "CONSOLE_SIGNING_KEY" set
    And the operator ran "docker compose run --rm factory-repo", which commits the factory into its volume
    When the operator runs "docker compose up --detach --wait intake" and "docker compose up --detach --wait --no-deps console"
    And a program posts a work item to intake's "/v1/work-items" with "INTAKE_API_TOKEN" and the requester "varun@acme.dev" of the kind "person", without the header "OSF-Person"
    Then intake answers 401 with "send OSF-Person: the console's proof of the person (ADR 0151)"
    And intake holds no work item with the dedupe key of the post
    And the console's "/.well-known/jwks.json" answers 200 with one key of "kty" "OKP"

  @id=SCN-DIST-055 @status=implemented @replaces=SCN-DIST-049
  Scenario: With the sign-in and without "CONSOLE_SIGNING_KEY", "console doctor" warns that the modules would refuse its actions
    Given the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and no "CONSOLE_SIGNING_KEY"
    When the operator runs "docker compose run --rm --no-deps console console doctor"
    Then the output has the line "WARN  person proof: set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs"
    And no line of the output starts with "FAIL  person proof"

  @id=SCN-DIST-056 @status=implemented
  Scenario: The foreman of the Compose profile runs no agent outside a sandbox
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --format json"
    Then the service "foreman" sets "FOREMAN_REQUIRE_SANDBOX" to "true"

  @id=SCN-DIST-058 @status=implemented
  Scenario: The foreman of the Compose profile names its sandboxes after the Compose project
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --format json"
    Then the service "foreman" sets "FOREMAN_SANDBOX_OWNER" to the name of the project, which its "OSF_SANDBOX_NETWORK" starts with

  @id=SCN-DIST-061 @status=implemented
  Scenario: The foreman of the Compose profile runs at most 2 stages at once, or the number of "FOREMAN_MAX_STAGES"
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose config --format json", and again with "FOREMAN_MAX_STAGES=4" in ".env"
    Then the service "foreman" sets "FOREMAN_MAX_STAGES" to "2", and then to "4"

  @id=SCN-DIST-072 @status=implemented
  Scenario: No service of the Compose profile sets a test hook or the test switch
    Given the Compose profile with every value of ".env.example" set in ".env"
    When the operator runs "docker compose --profile tools config --format json"
    Then no service sets "OSF_NOW", "OSF_SEED" or "OSF_TEST_HOOKS"
