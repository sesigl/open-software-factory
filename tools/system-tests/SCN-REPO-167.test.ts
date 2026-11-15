import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

scenario("SCN-REPO-167", async ({ sut, given, when, then }) => {
  await given(
    'a "deploy/compose/.env.example" with "POSTGRES_PASSWORD=", "OSF_OPENBAO_UNSEAL_KEY=" and "GH_TOKEN="',
    async () => {
      await sut.files.put(`$INPUT/${EXAMPLE}`, "POSTGRES_PASSWORD=\nOSF_OPENBAO_UNSEAL_KEY=\nGH_TOKEN=\n");
    },
  );

  await given('a "deploy/compose/.env" with "POSTGRES_PASSWORD=mine"', async () => {
    await sut.files.put(`$INPUT/${ENV}`, "POSTGRES_PASSWORD=mine\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf init"', async () => {
    run = await sut.cli(["init"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"deploy/compose/.env" still has "POSTGRES_PASSWORD=mine" and sets "OSF_OPENBAO_UNSEAL_KEY" to 64 hex digits, and has no line "GH_TOKEN="',
    async () => {
      const env = await sut.files.read(`$INPUT/${ENV}`);
      expect(env).toMatch(/^POSTGRES_PASSWORD=mine\nOSF_OPENBAO_UNSEAL_KEY=[0-9a-f]{64}\n$/);
    },
  );

  await then(
    'the output contains "deploy/compose/.env exists: kept it, and added OSF_OPENBAO_UNSEAL_KEY"',
    async () => {
      expect(run.stdout).toContain("deploy/compose/.env exists: kept it, and added OSF_OPENBAO_UNSEAL_KEY\n");
    },
  );
});
