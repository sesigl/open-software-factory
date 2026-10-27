import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-057", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose stage "verify" names the checks ["verify"], the evidence "required" and the forge "github"',
    async () => {
      await sut.files.put(
        "$INPUT/factory.yaml",
        factoryYaml({
          providers: ["harness:", '  claude-code: "^2"', "forge:", '  github: "^0.5"'],
          agents: agent("verify"),
          rest: ["workflow:", "  - stage: verify", "    checks: [verify]", "    evidence: required"],
        }),
      );
      await sut.files.put("$INPUT/agents/verify.md", prompt("verify"));
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
