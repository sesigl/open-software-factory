import { scenario } from "@opensoftware/testkit";
import { VALUE } from "./store.ts";

scenario("SCN-SECRET-012", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given("a test store that does not answer", async () => {
    // Nothing listens on port 9: a command that sent a request would exit 1 with "does not answer".
    env = { OSF_OPENBAO_ADDR: "http://127.0.0.1:9", OSF_OPENBAO_TOKEN: "osf-test-unknown-token" };
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the client runs "put ../sys/policy", "put team//token", "put team/./token", "put linear token" and "delete team/" with a value on standard input',
    async () => {
      for (const name of ["../sys/policy", "team//token", "team/./token", "linear token"])
        runs = [...runs, await sut.cli(["put", name, "--by", "ada"], { env, stdin: VALUE })];
      runs = [...runs, await sut.cli(["delete", "team/"], { env, stdin: VALUE })];
    },
  );

  await then(
    'each exits with code 2 and the error "name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token"',
    async () => {
      const error =
        "secrets-openbao: name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token\n";
      expect(runs.map((run) => [run.exitCode, run.stderr, run.stdout])).toEqual(Array(5).fill([2, error, ""]));
    },
  );
});
