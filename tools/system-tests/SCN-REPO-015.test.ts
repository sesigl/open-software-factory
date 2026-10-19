import { scenario } from "@opensoftware/testkit";

const schema = (properties: string[]): string =>
  `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: Object.fromEntries(properties.map((name) => [name, { type: "string" }])),
    },
    null,
    2,
  )}\n`;

scenario("SCN-REPO-015", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the schema "contracts/demo/demo.schema.json" at version "1.2.0"', async () => {
    await sut.files.put("$INPUT/contracts/package.json", '{ "name": "@opensoftware/contracts", "version": "1.2.0" }\n');
    await sut.files.put("$INPUT/contracts/demo/demo.schema.json", schema(["id", "name"]));
    base = await sut.git.commit("base");
  });

  await given('a change that removes its property "name" and sets the version "1.3.0"', async () => {
    await sut.files.put("$INPUT/contracts/package.json", '{ "name": "@opensoftware/contracts", "version": "1.3.0" }\n');
    await sut.files.put("$INPUT/contracts/demo/demo.schema.json", schema(["id"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check CONTRACT" against the base commit', async () => {
    run = await sut.cli(["check", "CONTRACT"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "CONTRACT contracts/demo/demo.schema.json"', async () => {
    expect(run.stdout).toContain("CONTRACT contracts/demo/demo.schema.json");
  });

  await then('the output contains "removed property name"', async () => {
    expect(run.stdout).toContain("removed property name");
  });
});
