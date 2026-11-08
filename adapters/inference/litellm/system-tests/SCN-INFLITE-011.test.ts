import { scenario } from "@opensoftware/testkit";
import { attachConfig } from "./proxy.ts";

scenario("SCN-INFLITE-011", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the client runs "start" without "OSF_SECRET_PROXY_MASTER_KEY" and a config whose "osf.proxy" names "http://127.0.0.1:4000" and "os.environ/OSF_SECRET_PROXY_MASTER_KEY"',
    async () => {
      await sut.files.put("$INPUT/config.yaml", attachConfig("http://127.0.0.1:4000"));
      run = await sut.cli(["start", "config.yaml"]);
    },
  );

  await then(
    'start exits with code 2 with the error "inference-litellm: set OSF_SECRET_PROXY_MASTER_KEY to the master key of the proxy at http://127.0.0.1:4000"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toBe(
        "inference-litellm: set OSF_SECRET_PROXY_MASTER_KEY to the master key of the proxy at http://127.0.0.1:4000\n",
      );
    },
  );

  await then("start prints nothing on standard output", async () => {
    expect(run.stdout).toBe("");
  });
});
