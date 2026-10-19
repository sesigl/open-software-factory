import { scenario } from "@opensoftware/testkit";

const SCHEMA = "contracts/factory-definition/factory-definition.schema.json";

scenario("SCN-CTR-009", async ({ sut, fakes, given, when, then }) => {
  const released = fakes.fromRepository("contracts/factory-definition")["factory-definition.schema.json"] ?? "";
  const manifest = (version: string): string =>
    `${JSON.stringify({ name: "@opensoftware/contracts", version }, null, 2)}\n`;

  await given('the release tag "contracts-v1.0.0" of the contracts', async () => {
    await sut.files.put(SCHEMA, released);
    await sut.files.put("contracts/package.json", manifest("1.0.0"));
    await sut.git.commit("release contracts 1.0.0");
    await sut.git.tag("contracts-v1.0.0");
  });

  await given(
    'a change that makes "timezone" required for scheduled automations and sets the version "1.1.0"',
    async () => {
      const schema = JSON.parse(released);
      const scheduled = schema.properties.automations.items.oneOf[1];
      scheduled.required = [...scheduled.required, "timezone"];
      await sut.files.put(SCHEMA, `${JSON.stringify(schema, null, 2)}\n`);
      await sut.files.put("contracts/package.json", manifest("1.1.0"));
      await sut.git.commit("require a timezone");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts breaking"', async () => {
    run = await sut.cli(["breaking"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "made automations[]|2.timezone required"', async () => {
    expect(run.stdout).toContain("made automations[]|2.timezone required");
  });
});
