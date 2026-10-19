import { scenario } from "@opensoftware/testkit";

const SCHEMA = "contracts/factory-definition/factory-definition.schema.json";

scenario("SCN-CTR-005", async ({ sut, fakes, given, when, then }) => {
  const released = fakes.fromRepository("contracts/factory-definition")["factory-definition.schema.json"] ?? "";
  const manifest = (version: string): string =>
    `${JSON.stringify({ name: "@opensoftware/contracts", version }, null, 2)}\n`;

  await given('the release tag "contracts-v1.0.0" of the contracts', async () => {
    await sut.files.put(`$INPUT/${SCHEMA}`, released);
    await sut.files.put("$INPUT/contracts/package.json", manifest("1.0.0"));
    await sut.git.commit("release contracts 1.0.0");
    await sut.git.tag("contracts-v1.0.0");
  });

  await given(
    'a change that removes the agent field "prompt" from the factory definition and sets the version "1.1.0"',
    async () => {
      const schema = JSON.parse(released);
      const agent = schema.properties.agents.unevaluatedProperties;
      delete agent.properties.prompt;
      agent.required = agent.required.filter((field: string) => field !== "prompt");
      await sut.files.put(`$INPUT/${SCHEMA}`, `${JSON.stringify(schema, null, 2)}\n`);
      await sut.files.put("$INPUT/contracts/package.json", manifest("1.1.0"));
      await sut.git.commit("drop the prompt");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts breaking"', async () => {
    run = await sut.cli(["breaking"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "contracts/factory-definition/factory-definition.schema.json: breaking change since contracts-v1.0.0 without a major version"',
    async () => {
      expect(run.stdout).toContain(
        "contracts/factory-definition/factory-definition.schema.json: breaking change since contracts-v1.0.0 without a major version",
      );
    },
  );

  await then('the output contains "removed property agents.*.prompt"', async () => {
    expect(run.stdout).toContain("removed property agents.*.prompt");
  });
});
