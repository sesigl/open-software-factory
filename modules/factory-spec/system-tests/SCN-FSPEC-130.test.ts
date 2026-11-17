import { scenario } from "@opensoftware/testkit";
import { prompt } from "./factory.ts";
import { AGENTS, reworkFactory } from "./rework.ts";

scenario("SCN-FSPEC-130", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "ship" names the checks ["verify"], the forge "github" and "rework: implement", after the stage "implement"',
    async () => {
      const yaml = reworkFactory("ship", "rework: implement");
      expect(yaml).toContain("  - stage: implement\n");
      expect(yaml).toContain("  - stage: ship\n    rework: implement\n    checks: [verify]\n");
      await sut.files.put("$INPUT/factory.yaml", yaml);
      for (const name of AGENTS) await sut.files.put(`$INPUT/agents/${name}.md`, prompt(name));
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
