import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { waitingFactory } from "./waits.ts";

scenario("SCN-FSPEC-061", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "verify" has "wait: true" on line 16 and no checks, no evidence "required" and no gate',
    async () => {
      const yaml = waitingFactory(["wait: true", "evidence: optional"]);
      expect(yaml.split("\n")[15]).toBe("    wait: true");
      expect(yaml).not.toMatch(/checks|gate|required/);
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
    'the output contains "factory.yaml:16:5 stage \\"verify\\" only waits, so it names checks, the evidence \\"required\\" or a gate"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        'factory.yaml:16:5 stage "verify" only waits, so it names checks, the evidence "required" or a gate',
      );
    },
  );
});
