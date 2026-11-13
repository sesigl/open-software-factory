import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { waitingFactory } from "./waits.ts";

scenario("SCN-FSPEC-059", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "verify" has "wait: true", the evidence "required" and the forge "github", no checks and no agent "verify"',
    async () => {
      const yaml = waitingFactory(["wait: true", "evidence: required"]);
      expect(yaml).not.toMatch(/ {2}verify:\n|checks|gate/);
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/ship.md", prompt("ship"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "factory.yaml: no problems"', async () => {
    expect(run.stdout).toBe("factory.yaml: no problems\n");
  });
});
