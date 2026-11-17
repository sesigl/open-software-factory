import { scenario } from "@opensoftware/testkit";
import { acceptedAdr } from "./repo.ts";

scenario("SCN-REPO-192", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit without the package "packages/rates"', async () => {
    await sut.files.put("$INPUT/README.md", "# demo\n");
    base = await sut.git.commit("base");
  });

  await given(
    'a change that adds "packages/rates/package.json" for the published package "@opensoftware/rates"',
    async () => {
      await sut.files.put(
        "$INPUT/packages/rates/package.json",
        '{\n  "name": "@opensoftware/rates",\n  "version": "0.1.0"\n}\n',
      );
    },
  );

  await given(
    'the only ADR that names "packages/rates" is accepted, has Prior art and an empty "Why a package" section',
    async () => {
      const adr = acceptedAdr("0001", "the library `packages/rates`").replace(
        "## Consequences",
        "## Why a package\n\n## Consequences",
      );
      await sut.files.put("$INPUT/docs/decisions/0001-rates.md", adr);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ADR" against the base commit', async () => {
    run = await sut.cli(["check", "ADR"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains \'ADR packages/rates/package.json:1 @opensoftware/rates is a new published package: it needs an accepted ADR that names "packages/rates" and answers "## Why a package" (ADR 0159)\'',
    async () => {
      expect(run.stdout).toContain(
        'ADR packages/rates/package.json:1 @opensoftware/rates is a new published package: it needs an accepted ADR that names "packages/rates" and answers "## Why a package" (ADR 0159)',
      );
    },
  );

  await then('the output contains "the Why a package section is empty: answer the bar of ADR 0159"', async () => {
    expect(run.stdout).toContain("the Why a package section is empty: answer the bar of ADR 0159");
  });
});
