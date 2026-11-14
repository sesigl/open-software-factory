import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

scenario("SCN-REPO-132", async ({ sut, given, when, then }) => {
  await given(
    'a "deploy/compose/.env.example" with "POSTGRES_PASSWORD=", "LITELLM_MASTER_KEY=sk-", "FOREMAN_API_TOKEN=", "GATEKEEPER_FORGE_TOKEN=" and a comment',
    async () => {
      await sut.files.put(
        `$INPUT/${EXAMPLE}`,
        "# Copy this file to .env.\nPOSTGRES_PASSWORD=\nLITELLM_MASTER_KEY=sk-\nFOREMAN_API_TOKEN=\nGATEKEEPER_FORGE_TOKEN=\n",
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  let env = "";
  await when('the developer runs "osf init"', async () => {
    run = await sut.cli(["init"]);
    env = await sut.files.read(`$INPUT/${ENV}`);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"deploy/compose/.env" sets "POSTGRES_PASSWORD" and "FOREMAN_API_TOKEN" to two different values of 64 hex digits',
    async () => {
      const password = /^POSTGRES_PASSWORD=([0-9a-f]{64})$/m.exec(env)?.[1];
      const token = /^FOREMAN_API_TOKEN=([0-9a-f]{64})$/m.exec(env)?.[1];
      expect(password, env).toBeDefined();
      expect(token, env).toBeDefined();
      expect(password).not.toBe(token);
    },
  );

  await then('"deploy/compose/.env" sets "LITELLM_MASTER_KEY" to "sk-" and 64 hex digits', async () => {
    expect(env).toMatch(/^LITELLM_MASTER_KEY=sk-[0-9a-f]{64}$/m);
  });

  await then('"deploy/compose/.env" has the line "GATEKEEPER_FORGE_TOKEN=" and the comment', async () => {
    expect(env.split("\n")).toContain("GATEKEEPER_FORGE_TOKEN=");
    expect(env.split("\n")[0]).toBe("# Copy this file to .env.");
  });

  await then('the output names "GATEKEEPER_FORGE_TOKEN" and "factory/groups.json" as what to set next', async () => {
    expect(run.stdout).toContain("set in deploy/compose/.env what your factory uses: GATEKEEPER_FORGE_TOKEN\n");
    expect(run.stdout).toContain("put your approvers in deploy/compose/factory/groups.json");
  });
});
