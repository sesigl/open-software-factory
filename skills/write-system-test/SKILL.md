---
name: write-system-test
description: Write the one system test that proves a Gherkin scenario from outside the module. Use after write-scenario and before any implementation.
---

# Write a system test

Each scenario has exactly one system test. The test starts the built module as a separate process and talks to
it only through its public surface.

## File and name

- Location: `system-tests/` of the unit, for example `modules/<name>/system-tests/`.
- One file per scenario, named after the ID: `SCN-PROOF-004.test.ts`.

## Example

```ts
import { scenario } from "@opensoftware/testkit";

scenario("SCN-PROOF-004", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();                 // Forgejo container, real API
  const pr = await forge.openPullRequest("demo");

  await given("a pull request with a Playwright trace", async () => {
    await sut.files.put("trace.zip", fakes.fixture("playwright-trace.zip"));
  });

  let run;
  await when('the developer runs "proof attach" for the pull request', async () => {
    run = await sut.cli(["attach", "--pr", pr.url, "--trace", "trace.zip"]);
  });

  await then("the pull request has a comment that links the evidence bundle", async () => {
    expect(run.exitCode).toBe(0);
    expect(await forge.comments(pr)).toContainEqual(expect.stringMatching(/evidence bundle/));
  });

  await then('the pull request has a check named "proof" with the result "success"', async () => {
    expect(await forge.check(pr, "proof")).toMatchObject({ conclusion: "success" });
  });
});
```

Every module is TypeScript (ADR 0009). A plugin written in another language, such as the Harbor agent plugin,
is tested with this same testkit through its CLI or API.

## Rules

- `sut` comes from the testkit. It runs the module's built artifact (CLI, server or container), never the source.
- Reach the module through `sut`: for example `sut.cli`, `sut.http` (generated client from `contracts/`), `sut.mcp`,
  `sut.events`, `sut.files` (only the folders the module documents as input or output), and `fakes.*`. A UI test
  finds elements by role, label or text (UI-QUERY).
- The hard rules of root `AGENTS.md` hold ("Test from the outside only", "No real network, model, clock or
  randomness"). Also: no database driver (BOUNDARY-STATIC), no environment variable that the module's README does
  not document (BOUNDARY-ENV), no `sleep`.
- Outside systems are fakes from the testkit: a scripted model gateway, a scripted ACP harness, fake Slack,
  a real Forgejo container as forge, a PostgreSQL container with a database for each scenario (ADR 0129), NATS and
  Temporal as processes on the host, a container for S3.
- Keep all state inside the scenario. Scenario files share a Vitest worker (ADR 0051), so a test never changes
  `process.env`, the working directory or a global of the test process.
- Keep the scenario cheap: each mutant of a line it reaches reruns it (ADR 0061). Set state up through `$INPUT`
  or a fake, start module processes only through `sut`, inside the scenario, and never wait for time to pass. The
  rules are under "Test speed" in `docs/quality/testing-strategy.md`.
- Every `given`, `when` and `then` label repeats the scenario's step text exactly. `And` steps use the keyword
  of the step before them. When the wording of an implemented scenario changes in place, change the labels in the
  same commit (ADR 0157).
- A Scenario Outline has one test for all its rows; a parameter `<name>` in a step matches any value in the label.
  Write the labels with the parameters as the feature file has them. `scenario()` reads the rows from the feature
  file and runs the body once for each, each with its own workspace, fakes and `sut`; `example` holds the row's
  values. Name the columns to read them as strings:
  `scenario<"entry" | "line">("SCN-X-001", async ({ example, when }) => …)`. The examples share the test's timeout.
- A scenario tagged `@shared=<name>` keeps its own `scenario()` call and steps, and uses the group's one start
  instead of its own (the testkit's API for it comes with T-82). It only reads the shared system, or works under a
  name of its own: a project, a namespace, a key.
- A `then` checks the fact the step states. When the step names a field, assert on that field, not on the whole
  message.
- Each `then` must assert on something the module produced. An assertion on a value the test created itself
  does not count.
- Run the test before you implement: it must fail, and the failure must be about the missing behavior, not a
  setup error. Name the failure line in the commit message that adds the test, not in the pull request description
  (`skills/ship-pull-request`).
