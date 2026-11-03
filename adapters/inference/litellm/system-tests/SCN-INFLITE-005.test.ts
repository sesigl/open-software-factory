import { scenario } from "@opensoftware/testkit";
import { attachConfig, start, testProxy } from "./proxy.ts";

scenario("SCN-INFLITE-005", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof testProxy>>;
  await given(
    'a test proxy that answers the readiness check with a connected database and "/key/list" with the status 401',
    async () => {
      proxy = await testProxy(fakes, 401);
    },
  );

  let run: Awaited<ReturnType<typeof start>>;
  await when('the client runs "start" with a config whose "osf.proxy" names the test proxy\'s URL', async () => {
    run = await start(sut, attachConfig(proxy.url));
  });

  await then("start exits with code 1 with an error that names the status 401", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toContain("401");
  });

  await then("start prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
