import { scenario } from "@opensoftware/testkit";
import { attachConfig, cli, start, testProxy } from "./proxy.ts";

scenario("SCN-INFLITE-001", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof testProxy>>;
  await given('a test proxy that answers "/key/list" with the status 200', async () => {
    proxy = await testProxy(fakes, 200);
  });

  let run: Awaited<ReturnType<typeof start>>;
  await when(
    'the client runs "start" with "DOCKER_HOST" set to "unix:///nonexistent/docker.sock", "OSF_SECRET_PROXY_MASTER_KEY" set to "sk-testkit-master" and a config whose "osf.proxy" names the test proxy\'s URL and "os.environ/OSF_SECRET_PROXY_MASTER_KEY"',
    async () => {
      const env = { DOCKER_HOST: "unix:///nonexistent/docker.sock" };
      run = await start(sut, attachConfig(proxy.url), "sk-testkit-master", env);
    },
  );

  let gateway = { id: "", url: "" };
  await then('start prints an ID of 12 hex digits and the test proxy\'s URL with "/v1" at the end', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    gateway = JSON.parse(run.stdout) as { id: string; url: string };
    expect(gateway.id).toMatch(/^[0-9a-f]{12}$/);
    expect(gateway.url).toBe(`${proxy.url}/v1`);
  });

  await then(
    'the test proxy received "/key/list" with the header "authorization" "Bearer sk-testkit-master"',
    async () => {
      const lists = proxy.headers().filter((request) => request.path.startsWith("/key/list"));
      expect(lists.map((request) => request.headers.authorization)).toEqual(["Bearer sk-testkit-master"]);
    },
  );

  await then("list prints the ID", async () => {
    const list = await cli(sut, ["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).toContain(gateway.id);
  });
});
