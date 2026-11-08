import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-007", async ({ sut, when, then }) => {
  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the client runs "key 0123456789a run-7", "spend-log x0123456789ab" and "stop 0123456789abx"',
    async () => {
      runs = await Promise.all([
        sut.cli(["key", "0123456789a", "run-7"]),
        sut.cli(["spend-log", "x0123456789ab"]),
        sut.cli(["stop", "0123456789abx"]),
      ]);
    },
  );

  await then(
    'each exits with code 2 with the error "inference-litellm: name a gateway by the 12 hex digits start printed"',
    async () => {
      for (const run of runs) {
        expect(run.exitCode, run.stderr).toBe(2);
        expect(run.stderr).toBe("inference-litellm: name a gateway by the 12 hex digits start printed\n");
      }
    },
  );
});
