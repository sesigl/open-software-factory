import { scenario } from "@opensoftware/testkit";

const ACCESS = "contracts/access/access.schema.json";
const PROOF = "contracts/person-proof/person-proof.schema.json";
const KEYS = "contracts/person-keys/person-keys.schema.json";

scenario("SCN-CTR-030", async ({ sut, fakes, given, when, then }) => {
  const schema = (folder: string): string => fakes.fromRepository(`contracts/${folder}`)[`${folder}.schema.json`] ?? "";
  const manifest = (version: string): string =>
    `${JSON.stringify({ name: "@opensoftware/contracts", version }, null, 2)}\n`;

  await given(
    'the release tag "contracts-v2.6.0" of the contracts without the formats "person-proof" and "person-keys"',
    async () => {
      await sut.files.put(`$INPUT/${ACCESS}`, schema("access"));
      await sut.files.put("$INPUT/contracts/package.json", manifest("2.6.0"));
      await sut.git.commit("release contracts 2.6.0");
      await sut.git.tag("contracts-v2.6.0");
    },
  );

  await given('the change that adds both formats and sets the version "2.7.0"', async () => {
    expect(JSON.parse(schema("person-proof")).title).toBe("PersonProof");
    expect(JSON.parse(schema("person-keys")).title).toBe("PersonKeys");
    await sut.files.put(`$INPUT/${PROOF}`, schema("person-proof"));
    await sut.files.put(`$INPUT/${KEYS}`, schema("person-keys"));
    await sut.files.put("$INPUT/contracts/package.json", manifest("2.7.0"));
    await sut.git.commit("add the person proof");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts breaking"', async () => {
    run = await sut.cli(["breaking"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "no breaking change since contracts-v2.6.0"', async () => {
    expect(run.stdout).toContain("no breaking change since contracts-v2.6.0");
  });
});
