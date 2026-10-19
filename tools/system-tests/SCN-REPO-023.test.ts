import { scenario } from "@opensoftware/testkit";

const schema = (agent: string[]): string =>
  `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        agents: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: Object.fromEntries(agent.map((name) => [name, { type: "string" }])),
          },
        },
      },
    },
    null,
    2,
  )}\n`;

scenario("SCN-REPO-023", async ({ sut, given, when, then }) => {
  await given(
    'the release tag "contracts-v1.2.0" on a commit whose schema "contracts/demo/demo.schema.json" gives every agent the property "prompt"',
    async () => {
      await sut.files.put("contracts/package.json", '{ "name": "@opensoftware/contracts", "version": "1.2.0" }\n');
      await sut.files.put("contracts/demo/demo.schema.json", schema(["model", "prompt"]));
      await sut.git.commit("release 1.2.0");
      await sut.git.tag("contracts-v1.2.0");
    },
  );

  let base = "";
  await given('a later base commit that removes the property "prompt" and sets the version "1.3.0"', async () => {
    await sut.files.put("contracts/package.json", '{ "name": "@opensoftware/contracts", "version": "1.3.0" }\n');
    await sut.files.put("contracts/demo/demo.schema.json", schema(["model"]));
    base = await sut.git.commit("drop prompt");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check CONTRACT" against the later base commit', async () => {
    run = await sut.cli(["check", "CONTRACT"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "CONTRACT contracts/demo/demo.schema.json"', async () => {
    expect(run.stdout).toContain("CONTRACT contracts/demo/demo.schema.json");
  });

  await then('the output contains "since contracts-v1.2.0"', async () => {
    expect(run.stdout).toContain("since contracts-v1.2.0");
  });

  await then('the output contains "removed property agents.*.prompt"', async () => {
    expect(run.stdout).toContain("removed property agents.*.prompt");
  });
});
