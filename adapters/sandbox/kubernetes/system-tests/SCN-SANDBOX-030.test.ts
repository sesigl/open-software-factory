import { scenario } from "@opensoftware/testkit";
import { reachEach, sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-030", async ({ sut, fakes, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let api: Awaited<ReturnType<typeof fakes.http>> | undefined;
    await given("an API on every address of the host that runs the sandboxes", async () => {
      api = await fakes.http([{ path: "/health", body: { ok: true } }], { containers: true });
    });

    let id = "";
    await given(
      'a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"',
      async () => {
        id = await box.create({ template: TEMPLATE, egress: ["host.docker.internal"] });
      },
    );

    // The runner's addresses once the sandbox runs, among them its address on the cluster's network (the kind gateway,
    // OSF_SANDBOX_HOST_ALIASES): the sandbox's NetworkPolicy lets it reach only its egress pod, never this host.
    let urls: string[] = [];
    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when(
      "the client runs \"curl --noproxy '*'\" for the API at each address of the host in the sandbox",
      async () => {
        urls = api?.hostUrls?.() ?? [];
        run = await box.sh(id, reachEach(urls));
      },
    );

    await then("every request fails", async () => {
      expect(urls.length).toBeGreaterThan(0);
      expect(run.stdout.split("\n").filter(Boolean).sort()).toEqual(urls.map((url) => `failed ${url}`).sort());
    });

    await then("the API received no request", async () => {
      expect(api?.requests()).toEqual([]);
    });
  } finally {
    await box.destroyAll();
  }
});
