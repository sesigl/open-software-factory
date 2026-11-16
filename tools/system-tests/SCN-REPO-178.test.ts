import { scenario } from "@opensoftware/testkit";
import { ENV, EXAMPLE } from "./setup.ts";

scenario("SCN-REPO-178", async ({ sut, given, when, then }) => {
  /** Gives the .env the mode that `cp .env.example .env` leaves under the usual umask: everyone may read it. */
  const readableByEveryone = async () =>
    sut.files.put(`$INPUT/${ENV}`, await sut.files.read(`$INPUT/${ENV}`), { mode: 0o644 });

  await given('a "deploy/compose/.env.example" with "POSTGRES_PASSWORD=" and "OSF_OPENBAO_UNSEAL_KEY="', async () => {
    await sut.files.put(`$INPUT/${EXAMPLE}`, "POSTGRES_PASSWORD=\nOSF_OPENBAO_UNSEAL_KEY=\n");
  });

  await given(
    'a "deploy/compose/.env" with "POSTGRES_PASSWORD=mine" and the mode 0644, as "cp" leaves it',
    async () => {
      await sut.files.put(`$INPUT/${ENV}`, "POSTGRES_PASSWORD=mine\n", { mode: 0o644 });
    },
  );

  // The first run adds OpenBao's key to the .env; the second has nothing to add and writes nothing.
  const runs: { exitCode: number; output: string; mode: string }[] = [];
  let env = "";
  await when(
    'the developer runs "osf init", gives ".env" the mode 0644 again and runs "osf init" once more',
    async () => {
      for (const last of [false, true]) {
        const run = await sut.cli(["init"]);
        runs.push({
          exitCode: run.exitCode,
          output: run.stdout + run.stderr,
          mode: (await sut.files.mode(`$INPUT/${ENV}`)).toString(8),
        });
        if (!last) await readableByEveryone();
      }
      env = await sut.files.read(`$INPUT/${ENV}`);
    },
  );

  await then('both runs exit with code 0, and "deploy/compose/.env" has the mode 0600 after each', async () => {
    expect(
      runs.map((run) => [run.exitCode, run.mode]),
      runs.map((run) => run.output).join(""),
    ).toEqual([
      [0, "600"],
      [0, "600"],
    ]);
  });

  await then(
    '"deploy/compose/.env" still has "POSTGRES_PASSWORD=mine" and sets "OSF_OPENBAO_UNSEAL_KEY" to 64 hex digits',
    async () => {
      expect(env).toMatch(/^POSTGRES_PASSWORD=mine\nOSF_OPENBAO_UNSEAL_KEY=[0-9a-f]{64}\n$/);
    },
  );
});
