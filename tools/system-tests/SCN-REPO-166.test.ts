import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

const OPENBAO = ["OSF_OPENBAO_UNSEAL_KEY", "OSF_OPENBAO_ROOT_TOKEN", "OSF_OPENBAO_CONSOLE_TOKEN", "OSF_OPENBAO_EGRESS_TOKEN"];

scenario("SCN-REPO-166", async ({ sut, given, when, then }) => {
  await given(
    'a "deploy/compose/.env.example" with "OSF_OPENBAO_UNSEAL_KEY=", "OSF_OPENBAO_ROOT_TOKEN=", "OSF_OPENBAO_CONSOLE_TOKEN=", "OSF_OPENBAO_EGRESS_TOKEN=" and "OSF_OPENBAO_MOUNT="',
    async () => {
      await sut.files.put(`$INPUT/${EXAMPLE}`, [...OPENBAO, "OSF_OPENBAO_MOUNT"].map((name) => `${name}=\n`).join(""));
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
    '"deploy/compose/.env" sets "OSF_OPENBAO_UNSEAL_KEY", "OSF_OPENBAO_ROOT_TOKEN", "OSF_OPENBAO_CONSOLE_TOKEN" and "OSF_OPENBAO_EGRESS_TOKEN" to four different values of 64 hex digits',
    async () => {
      const values = OPENBAO.map((name) => new RegExp(`^${name}=([0-9a-f]{64})$`, "m").exec(env)?.[1]);
      expect(values.every(Boolean), env).toBe(true);
      expect(new Set(values).size).toBe(4);
    },
  );

  await then('"deploy/compose/.env" keeps "OSF_OPENBAO_MOUNT=" empty', async () => {
    expect(env.split("\n")).toContain("OSF_OPENBAO_MOUNT=");
  });
});
