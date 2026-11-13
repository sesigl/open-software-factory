import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { waitingFactory } from "./waits.ts";

scenario("SCN-FSPEC-060", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "verify" has "wait: true", the checks ["verify"] and on line 17 the agent "ship"',
    async () => {
      const yaml = waitingFactory(["wait: true", "agent: ship", "checks: [verify]"]);
      expect(yaml.split("\n")[16]).toBe("    agent: ship");
      await sut.files.put("$INPUT/factory.yaml", yaml);
      await sut.files.put("$INPUT/agents/ship.md", prompt("ship"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "factory.yaml:17:5 stage \\"verify\\" only waits, so it names no agent"',
    async () => {
      expect(run.stdout + run.stderr).toContain('factory.yaml:17:5 stage "verify" only waits, so it names no agent');
    },
  );
});
