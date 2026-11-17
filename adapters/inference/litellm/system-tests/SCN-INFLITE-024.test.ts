import { scenario } from "@opensoftware/testkit";
import { attachConfig, MASTER_KEY_VARIABLE, start } from "./proxy.ts";

scenario("SCN-INFLITE-024", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof start>>;
  await when('the client runs "start" with a config whose "osf.proxy" names "proxy_batch_write_at" "ten"', async () => {
    run = await start(sut, attachConfig("http://127.0.0.1:4000", MASTER_KEY_VARIABLE, "ten"));
  });

  await then('start exits with code 2 with an error that names "osf.proxy.proxy_batch_write_at"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("osf.proxy.proxy_batch_write_at");
  });

  await then("start prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
