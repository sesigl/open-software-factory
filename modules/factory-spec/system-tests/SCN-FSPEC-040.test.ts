import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

scenario("SCN-FSPEC-040", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml with the agents "implement" and "self-triage-report" and the automation with the cron "0 10 * * *" that runs "self-triage-report"',
    async () => {
      const rest = ["automations:", '  - cron: "0 10 * * *"', "    run: self-triage-report"];
      const agents = [...agent("implement"), ...agent("self-triage-report")];
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents, rest }));
      await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
      await sut.files.put("$INPUT/agents/self-triage-report.md", prompt("self-triage-report"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render --gh-aw"', async () => {
    run = await sut.cli(["render", "--gh-aw"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  const file = "$OUTPUT/.github/workflows/self-triage-report.md";
  await then(
    '".github/workflows/self-triage-report.md" in the output folder starts on the schedule "0 10 * * *"',
    async () => {
      expect(await sut.files.read(file)).toContain("on:\n  schedule:\n    - cron: 0 10 * * *\n");
    },
  );

  await then('its body is the prompt of "self-triage-report"', async () => {
    expect((await sut.files.read(file)).split("\n---\n\n")[1]).toBe(prompt("self-triage-report"));
  });
});
