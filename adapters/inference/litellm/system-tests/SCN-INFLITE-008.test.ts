import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-008", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "key 0123456789ab"', async () => {
    run = await sut.cli(["key", "0123456789ab"]);
  });

  await then(
    'key exits with code 2 with the error "inference-litellm: name the run, like key <ID> run-7"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe("inference-litellm: name the run, like key <ID> run-7\n");
    },
  );
});
