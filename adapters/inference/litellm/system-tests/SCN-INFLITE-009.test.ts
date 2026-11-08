import { scenario } from "@opensoftware/testkit";
import { start } from "./proxy.ts";

scenario("SCN-INFLITE-009", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof start>>;
  await when(
    'the client runs "start" with a config whose "osf.proxy" names only "os.environ/OSF_SECRET_PROXY_MASTER_KEY"',
    async () => {
      run = await start(sut, "osf:\n  proxy:\n    master_key: os.environ/OSF_SECRET_PROXY_MASTER_KEY\n");
    },
  );

  await then('start exits with code 2 with an error that names "osf.proxy.url"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("osf.proxy.url");
  });

  await then("start prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
