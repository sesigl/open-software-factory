---
name: write-system-test
description: Write the one system test that proves a Gherkin scenario from outside the module. Use after write-scenario and before any implementation.
---

# Write a system test

Each scenario has exactly one system test. The test starts the built module as a separate process and talks to
it only through its public surface.

## File and name

- Location: `modules/<name>/system-tests/`.
- One file per scenario, named after the ID: `SCN-PROOF-004.test.ts` or `test_scn_proof_004.py`.

## TypeScript

```ts
import { scenario } from "@osf/testkit";

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

## Python

```python
from osf_testkit import scenario

@scenario("SCN-SCORE-002")
def test(sut, fakes, given, when, then):
    with given("100 implementation runs in the run log"):
        sut.files.put("runs.jsonl", fakes.fixture("runs-100.jsonl"))
    with when('the developer runs "scorekit score" with a sampling rate of 20 percent'):
        run = sut.cli(["score", "runs.jsonl", "--sample", "0.2", "--seed", "7"])
    with then("about 20 runs are scored"):
        assert 15 <= len(run.json()["scores"]) <= 25
```

## Rules

- `sut` comes from the testkit. It runs the module's built artifact (CLI, server or container), never the source.
- Allowed: `sut.cli`, `sut.http` (generated client from `contracts/`), `sut.mcp`, `sut.events`, `sut.files`
  (only the folders the module documents as input or output), and `fakes.*`.
- Forbidden: imports from `src/`, database drivers, reading the module's data folder, environment variables that
  are not documented in the module's README, `sleep`, real time, real network, real models.
- Outside systems are fakes from the testkit: a scripted model gateway, a scripted ACP harness, fake Slack,
  a real Forgejo container as forge, Testcontainers for Postgres, NATS and S3.
- Every `given`, `when` and `then` label repeats the scenario's step text exactly. `And` steps use the keyword
  of the step before them.
- Each `then` must assert on something the module produced. An assertion on a value the test created itself
  does not count.
- Run the test before you implement: it must fail, and the failure must be about the missing behavior, not a
  setup error. Write the failure line into the pull request description.
