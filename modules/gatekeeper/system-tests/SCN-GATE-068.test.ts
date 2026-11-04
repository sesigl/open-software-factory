import { scenario } from "@opensoftware/testkit";
import { askedOnPullRequest } from "./server.ts";

const COMMENTS = "/repos/acme/web/issues/12/comments?per_page=100";

scenario("SCN-GATE-068", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedOnPullRequest>>;
  await given('the server asked "maintainers" on the pull request "acme/web#12"', async () => {
    server = await askedOnPullRequest(sut, fakes);
  });

  await given("the forge answers the reads of its comments with the status 502", async () => {
    const reads = () => server.http.received().filter((call) => call.method === "GET" && call.path === COMMENTS);
    const before = reads().length;
    server.http.failReads(502);
    // Two failed reads: the server went on polling after a failure.
    await expect.poll(() => reads().length - before, { timeout: 10_000, interval: 20 }).toBeGreaterThanOrEqual(2);
    expect((await server.gate(server.id))?.state).toBe("pending");
  });

  await when(
    'the forge answers again and "github:sesigl" of "maintainers" comments "/approve" on the pull request',
    async () => {
      server.http.failReads();
      server.http.comment({ id: 901, body: "/approve", login: "sesigl", at: "2026-01-01T00:10:00Z" });
    },
  );

  await then(
    '"/v1/gates/<gate>" shows the state "approved" with a record approved by the person "github:sesigl"',
    async () => {
      const gate = await server.decided(server.id);
      expect(gate).toMatchObject({ id: server.id, state: "approved" });
      expect(gate?.record).toMatchObject({ decision: "approved", decidedBy: { kind: "person", id: "github:sesigl" } });
    },
  );
});
