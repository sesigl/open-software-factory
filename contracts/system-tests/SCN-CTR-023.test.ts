import { scenario } from "@opensoftware/testkit";

const SCHEMA = "contracts/factory-lock/factory-lock.schema.json";

scenario("SCN-CTR-023", async ({ sut, fakes, given, when, then }) => {
  const current = fakes.fromRepository("contracts/factory-lock")["factory-lock.schema.json"] ?? "";
  const manifest = (version: string): string =>
    `${JSON.stringify({ name: "@opensoftware/contracts", version }, null, 2)}\n`;

  await given(
    'the release tag "contracts-v2.5.0" of the contracts with the factory lock without "skills"',
    async () => {
      const released = JSON.parse(current);
      delete released.properties.skills;
      await sut.files.put(`$INPUT/${SCHEMA}`, `${JSON.stringify(released, null, 2)}\n`);
      await sut.files.put("$INPUT/contracts/package.json", manifest("2.5.0"));
      await sut.git.commit("release contracts 2.5.0");
      await sut.git.tag("contracts-v2.5.0");
    },
  );

  await given(
    'the change that adds the optional "skills" to the factory lock and sets the version "2.6.0"',
    async () => {
      expect(JSON.parse(current).required).toEqual(["version", "mcp"]);
      await sut.files.put(`$INPUT/${SCHEMA}`, current);
      await sut.files.put("$INPUT/contracts/package.json", manifest("2.6.0"));
      await sut.git.commit("pin skills");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts breaking"', async () => {
    run = await sut.cli(["breaking"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "no breaking change since contracts-v2.5.0"', async () => {
    expect(run.stdout).toContain("no breaking change since contracts-v2.5.0");
  });
});
