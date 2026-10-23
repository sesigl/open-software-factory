import { scenario } from "@opensoftware/testkit";
import { AUTH, readmeRequest, serving } from "./server.ts";

scenario("SCN-GATE-055", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  const nats = await fakes.nats();
  await given('the server runs with "GATEKEEPER_NATS_URL" set to a NATS server', async () => {
    server = await serving(sut, fakes, { env: { GATEKEEPER_NATS_URL: nats.url } });
  });

  const events = await sut.events.watch(nats, "osf.gate.>");
  let id: string | undefined;
  await when('a program posts the README request to "/v1/gates" with the API token', async () => {
    id = (await server.api().POST("/v1/gates", { body: readmeRequest(fakes), headers: AUTH })).data?.id;
  });

  await then(
    'the event "gate.requested@v1" arrives on "osf.gate.requested.v1" with the approver group "maintainers"',
    async () => {
      const [event] = await events.received("gate.requested@v1");
      expect(event).toMatchObject({ id: `${id}.requested`, source: "/osf/gatekeeper", subject: id });
      expect(event?.data).toMatchObject({
        gateId: id,
        approvers: ["maintainers"],
        stage: "merge",
        expiresAt: "2026-01-03T00:00:00.000001Z",
      });
    },
  );
});
