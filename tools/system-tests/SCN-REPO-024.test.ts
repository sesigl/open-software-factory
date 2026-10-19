import { scenario } from "@opensoftware/testkit";

const SCHEMA = `${JSON.stringify(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: { link: { type: "string", format: "uri" } },
  },
  null,
  2,
)}\n`;

scenario("SCN-REPO-024", async ({ sut, given, when, then }) => {
  await given('the schema "contracts/demo/demo.schema.json" whose property "link" has the format "uri"', async () => {
    await sut.files.put("contracts/package.json", '{ "name": "@opensoftware/contracts", "version": "1.0.0" }\n');
    await sut.files.put("contracts/demo/demo.schema.json", SCHEMA);
  });

  await given(
    'the invalid fixture "contracts/demo/fixtures/invalid/relative-link.json" with the link "not a uri"',
    async () => {
      await sut.files.put("contracts/demo/fixtures/invalid/relative-link.json", '{ "link": "not a uri" }\n');
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check CONTRACT" without OSF_BASE', async () => {
    run = await sut.cli(["check", "CONTRACT"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });

  await then('the output does not contain "unknown format"', async () => {
    expect(`${run.stdout}${run.stderr}`).not.toContain("unknown format");
  });
});
