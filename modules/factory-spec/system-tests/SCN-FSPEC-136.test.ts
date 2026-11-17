import { scenario } from "@opensoftware/testkit";
import { putStopCheck, settings } from "./stop-check.ts";

scenario("SCN-FSPEC-136", async ({ sut, given, when, then }) => {
  await given(
    'the factory "web-app" was applied with the agent "triage" and the stop check "make check-fast"',
    async () => {
      await putStopCheck(sut, "triage");
      const run = await sut.cli(["apply"]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await given('a person edited the Stop hook in ".claude/settings.json" in the output folder', async () => {
    const edited = await settings(sut);
    edited.hooks = { Stop: [{ hooks: [{ type: "command", command: "true" }] }] };
    await sut.files.put("$OUTPUT/.claude/settings.json", `${JSON.stringify(edited, null, 2)}\n`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "! .claude/settings.json changed outside \\"factory apply\\""', async () => {
    expect(run.stdout).toContain('! .claude/settings.json changed outside "factory apply"');
  });
});
