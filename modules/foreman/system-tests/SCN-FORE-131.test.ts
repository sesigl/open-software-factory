import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";

const PROBLEM =
  "factory.yaml: commit the changed files agents/implement.md, agents/plan.md; a run's factory version is its commit";

scenario("SCN-FORE-131", async ({ sut, fakes, given, when, then }) => {
  await given("the README's \"factory.yaml\" is committed in the factory's repository", async () => {
    await committed(sut, fakes);
  });

  await given('"agents/plan.md" has a change that is not committed and "agents/implement.md" is deleted', async () => {
    await sut.files.put("$INPUT/agents/plan.md", "Write a plan, and a changed one\n");
    await sut.files.remove("$INPUT/agents/implement.md");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: commit the changed files agents/implement.md, agents/plan.md; a run\'s factory version is its commit"',
    async () => {
      expect(run.stderr).toContain(PROBLEM);
    },
  );
});
