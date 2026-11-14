import { scenario } from "@opensoftware/testkit";

scenario("SCN-SOPENBAO-006", async ({ sut, when, then }) => {
  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when('the client runs "policy" and "policy admin"', async () => {
    runs = [await sut.cli(["policy"]), await sut.cli(["policy", "admin"])];
  });

  await then('each exits with code 2 and the error "name the policy, like policy write or policy read"', async () => {
    const error = "secrets-openbao: name the policy, like policy write or policy read\n";
    expect(runs.map((run) => [run.exitCode, run.stderr, run.stdout])).toEqual(Array(2).fill([2, error, ""]));
  });
});
