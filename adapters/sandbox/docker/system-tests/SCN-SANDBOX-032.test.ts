import { scenario } from "@opensoftware/testkit";

// A stand-in for a Docker daemon behind a socket proxy at DOCKER_HOST: the sandbox's containers go, but its network
// stays, and the proxy refuses its removal with 403, as docker-proxy of the Compose profile refuses a path it does not
// allow. The Docker CLI pings it, then calls it at the API version it names.
const ID = "0123456789ab";
const NAME = `osf-sandbox-${ID}`;
const API = "/v1.47";
const REFUSAL = "the socket proxy refuses DELETE /networks";

scenario("SCN-SANDBOX-032", async ({ sut, fakes, given, when, then }) => {
  let daemon: Awaited<ReturnType<typeof fakes.http>> | undefined;
  await given("a sandbox that the platform refuses to remove", async () => {
    daemon = await fakes.http([
      { method: "HEAD", path: "/_ping", body: "OK", contentType: "text/plain", headers: { "Api-Version": "1.47" } },
      { path: `${API}/containers/${NAME}/json`, body: { Id: `${ID}${"c".repeat(52)}`, Name: `/${NAME}` } },
      { method: "DELETE", path: `${API}/containers/${NAME}?force=1&v=1`, status: 204, body: {} },
      { method: "DELETE", path: `${API}/containers/${NAME}-egress?force=1&v=1`, status: 204, body: {} },
      { method: "DELETE", path: `${API}/networks/${NAME}`, status: 403, body: { message: REFUSAL } },
      { path: `${API}/networks/${NAME}`, body: { Name: NAME, Id: "n1" } },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when("the client destroys the sandbox", async () => {
    const host = new URL(daemon?.url ?? "").host;
    run = await sut.cli(["destroy", ID], { env: { DOCKER_HOST: `tcp://${host}` } });
  });

  await then(
    'destroy exits with code 1 and writes "the sandbox <ID> was not removed: " and the platform\'s error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(1);
      expect(run.stderr).toContain(`the sandbox ${ID} was not removed: the network ${NAME}: `);
      expect(run.stderr).toContain(REFUSAL);
      // The containers went, so the error names only the network.
      expect(run.stderr).not.toContain(`the container ${NAME}`);
    },
  );

  await then('it does not print "destroyed <ID>"', async () => {
    expect(run.stdout).not.toContain(`destroyed ${ID}`);
  });
});
