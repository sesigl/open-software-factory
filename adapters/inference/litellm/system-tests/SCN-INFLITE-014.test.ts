import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFLITE-014", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "stop 000000000000"', async () => {
    run = await sut.cli(["stop", "000000000000"]);
  });

  await then('stop exits with code 1 with the error "inference-litellm: no gateway 000000000000"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("inference-litellm: no gateway 000000000000\n");
  });
});
