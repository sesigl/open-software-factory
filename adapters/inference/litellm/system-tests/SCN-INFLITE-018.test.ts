import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-018", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "revoke 0123456789ab"', async () => {
    run = await sut.cli(["revoke", "0123456789ab"]);
  });

  await then(
    'revoke exits with code 2 with the error "inference-litellm: name the run, like revoke <ID> run-7"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe("inference-litellm: name the run, like revoke <ID> run-7\n");
    },
  );
});
