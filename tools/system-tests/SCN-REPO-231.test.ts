import { type CliResult, scenario } from "@opensoftware/testkit";

/** The agents of this repository's factory, in the order of factory.yaml. */
const AGENTS = ["triage", "spec", "implement", "review", "ship"];
/** An agent's entry in factory.yaml: its name, harness, model, effort and prompt. */
const ENTRY = /^ {2}(\w+):\n {4}harness: (\S+)\n {4}model: (\S+)\n {4}effort: (\w+)\n {4}prompt: \.\/(\S+)$/gm;
const workflowOf = (text: string): string => text.slice(text.indexOf("\nworkflow:"));

scenario("SCN-REPO-231", async ({ sut, fakes, given, when, then }) => {
  const dogfood = fakes.fromRepository("deploy/dogfood/factory");
  await given(
    'this repository\'s factory "deploy/dogfood/factory/" and the scripted agent\'s files "deploy/dogfood/rehearsal/agent/"',
    async () => {
      for (const [path, text] of Object.entries(dogfood))
        await sut.files.put(`$INPUT/deploy/dogfood/factory/${path}`, text);
      for (const [path, text] of Object.entries(fakes.fromRepository("deploy/dogfood/rehearsal/agent")))
        await sut.files.put(`$INPUT/deploy/dogfood/rehearsal/agent/${path}`, text);
    },
  );

  let run: CliResult;
  await when('the maintainer runs "osf rehearsal factory out --repository acme/scratch --approver ada"', async () => {
    run = await sut.cli(["rehearsal", "factory", "out", "--repository", "acme/scratch", "--approver", "ada"]);
  });

  const original = dogfood["factory.yaml"] as string;
  const written = () => sut.files.read("$INPUT/out/factory/factory.yaml");
  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"out/factory/factory.yaml" has the workflow of "deploy/dogfood/factory/factory.yaml"', async () => {
    expect(workflowOf(await written())).toBe(workflowOf(original));
  });

  await then(
    'each agent of it runs on the harness "acp" without a sandbox and with the prompt of this repository\'s factory',
    async () => {
      const text = await written();
      const agents = text.slice(text.indexOf("\nagents:"), text.indexOf("\nworkflow:"));
      const entries = [...agents.matchAll(ENTRY)];
      expect(entries.map(([, name, harness]) => [name, harness])).toEqual(AGENTS.map((name) => [name, "acp"]));
      expect(agents).not.toMatch(/sandbox|secrets/);
      for (const [, name, , model, effort, prompt = ""] of entries) {
        // The same model, effort and prompt as the agent of this repository's factory, which runs on Claude Code.
        expect(original).toContain(
          `  ${name}:\n    harness: claude-code\n    model: ${model}\n    effort: ${effort}\n    prompt: ./${prompt}\n`,
        );
        expect(await sut.files.read(`$INPUT/out/factory/${prompt}`)).toBe(dogfood[prompt]);
      }
    },
  );

  await then('"out/factory/groups.json" names "github:ada" as the only member of "maintainers"', async () => {
    expect(JSON.parse(await sut.files.read("$INPUT/out/factory/groups.json"))).toEqual({ maintainers: ["github:ada"] });
  });

  await then(
    '"out/harness/script.json" has one turn for the first line of each agent\'s prompt, and the turn of "spec" pushes to "acme/scratch"',
    async () => {
      const script = JSON.parse(await sut.files.read("$INPUT/out/harness/script.json")) as {
        when: string;
        commands: string[];
      }[];
      const firstLines = AGENTS.map((name) => dogfood[`agents/${name}.md`]?.split("\n")[0]);
      expect(script.map((turn) => turn.when)).toEqual(firstLines);
      const spec = script[AGENTS.indexOf("spec")]?.commands.join("\n");
      expect(spec).toContain('git push -q origin "$B"');
      expect(spec).toContain("@github.com/acme/scratch.git");
    },
  );
});
