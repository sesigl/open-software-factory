import { scenario } from "@opensoftware/testkit";
import { attachConfig, start } from "./proxy.ts";

scenario("SCN-INFLITE-004", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof start>>;
  await when(
    'the client runs "start" with a config whose "osf.proxy" names "http://127.0.0.1:4000" and "os.environ/LITELLM_MASTER_KEY"',
    async () => {
      run = await start(sut, attachConfig("http://127.0.0.1:4000", "LITELLM_MASTER_KEY"));
    },
  );

  await then('start exits with code 2 with an error that names "os.environ/OSF_SECRET_<NAME>"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("os.environ/OSF_SECRET_<NAME>");
  });

  await then("start prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
