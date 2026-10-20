import { scenario } from "@opensoftware/testkit";
import { runRecord } from "./repo.ts";

scenario("SCN-REPO-041", async ({ sut, given, when, then }) => {
  let base = "";
  await given("a base commit", async () => {
    await sut.files.put("$INPUT/README.md", "# Demo\n");
    base = await sut.git.commit("base");
  });

  await given(
    'a later commit with the trailer "Co-Authored-By: Claude <noreply@anthropic.com>" that adds the run record "runs/run-1.jsonl"',
    async () => {
      await sut.files.put("$INPUT/README.md", "# Demo\n\nA demo.\n");
      await sut.files.put("$INPUT/runs/run-1.jsonl", runRecord());
      await sut.git.commit("docs: describe the demo\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check RUNS" against the base commit', async () => {
    run = await sut.cli(["check", "RUNS"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "RUNS ok"', async () => {
    expect(run.stdout).toContain("RUNS ok");
  });
});
