import { scenario } from "@opensoftware/testkit";
import { TEMPLATE } from "./sandbox.ts";

// A stand-in for a Docker daemon older than 28.0, at DOCKER_HOST: it takes the gateway mode "isolated" without a
// word and still gives the network a gateway. The Docker CLI pings it, then calls it at the API version it names.
const ID = "0123456789ab";
const CONTAINER = `${ID}${"c".repeat(52)}`;
const NAME = `osf-sandbox-${ID}`;
const API = "/v1.47";

scenario("SCN-SDOCKER-007", async ({ sut, fakes, given, when, then }) => {
  let daemon: Awaited<ReturnType<typeof fakes.http>> | undefined;
  await given(
    'a Docker daemon of the API version 1.47 that gives every network the gateways "172.30.0.1" and "fd30::1"',
    async () => {
      daemon = await fakes.http([
        { method: "HEAD", path: "/_ping", body: "OK", contentType: "text/plain", headers: { "Api-Version": "1.47" } },
        { method: "POST", path: `${API}/containers/create`, status: 201, body: { Id: CONTAINER, Warnings: [] } },
        { method: "POST", path: `${API}/containers/${CONTAINER}/rename?name=${NAME}`, status: 204, body: {} },
        { method: "POST", path: `${API}/networks/create`, status: 201, body: { Id: "n1", Warning: "" } },
        {
          path: `${API}/networks/${NAME}`,
          body: {
            Name: NAME,
            Id: "n1",
            IPAM: {
              Config: [
                { Subnet: "172.30.0.0/16", Gateway: "172.30.0.1" },
                { Subnet: "fd30::/64", Gateway: "fd30::1" },
              ],
            },
          },
        },
        { method: "DELETE", path: `${API}/containers/${NAME}?force=1&v=1`, status: 204, body: {} },
        { method: "DELETE", path: `${API}/containers/${NAME}-egress?force=1&v=1`, status: 204, body: {} },
        { method: "DELETE", path: `${API}/networks/${NAME}`, status: 204, body: {} },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with a spec with the test template against that daemon', async () => {
    await sut.files.put("$INPUT/spec.json", JSON.stringify({ template: TEMPLATE }));
    const host = new URL(daemon?.url ?? "").host;
    run = await sut.cli(["create", "spec.json"], { env: { DOCKER_HOST: `tcp://${host}` } });
  });

  await then(
    'the daemon was asked for an internal network with the gateway mode "isolated" for IPv4 and IPv6',
    async () => {
      const create = daemon?.received().find(({ path }) => path === `${API}/networks/create`);
      expect(create?.body).toMatchObject({
        Name: NAME,
        Internal: true,
        Options: {
          "com.docker.network.bridge.gateway_mode_ipv4": "isolated",
          "com.docker.network.bridge.gateway_mode_ipv6": "isolated",
        },
      });
    },
  );

  await then(
    'create exits with code 1 and names the gateways "172.30.0.1, fd30::1" and "Docker 28.0 or later"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(1);
      expect(run.stderr).toContain(
        `the sandbox ${ID} did not start and was removed: its network has the gateways 172.30.0.1, fd30::1 on the Docker host; use Docker 28.0 or later`,
      );
    },
  );

  await then("the daemon was asked to remove the sandbox's container, its egress proxy and its network", async () => {
    expect(daemon?.requests()).toEqual(
      expect.arrayContaining([
        `DELETE ${API}/containers/${NAME}?force=1&v=1`,
        `DELETE ${API}/containers/${NAME}-egress?force=1&v=1`,
        `DELETE ${API}/networks/${NAME}`,
      ]),
    );
  });
});
