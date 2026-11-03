import { scenario } from "@opensoftware/testkit";
import { statuses } from "./gate.ts";
import { askedOnPullRequest } from "./server.ts";

scenario("SCN-GATE-065", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedOnPullRequest>>;
  await given('the server asked "maintainers" on the pull request "acme/web#12"', async () => {
    server = await askedOnPullRequest(sut, fakes);
  });

  await when('"github:sesigl" of "maintainers" comments "/reject Breaks the release" on the pull request', async () => {
    server.http.comment({ id: 901, body: "/reject Breaks the release", login: "sesigl", at: "2026-01-01T00:10:00Z" });
  });

  await then(
    '"/v1/gates/<gate>" shows the state "rejected" and a record with the reason "Breaks the release"',
    async () => {
      const gate = await server.decided(server.id);
      expect(gate).toMatchObject({ state: "rejected" });
      expect(gate?.record).toMatchObject({
        decision: "rejected",
        decidedBy: { kind: "person", id: "github:sesigl" },
        reason: "Breaks the release",
      });
    },
  );

  await then('the pull request has the comment "Rejected by @sesigl: Breaks the release."', async () => {
    const posted = server.http.received().filter((call) => call.method === "POST" && call.path.endsWith("/comments"));
    expect(posted.map((call) => (call.body as { body: string }).body)[1]).toBe(
      `Rejected by @sesigl: Breaks the release.\n\n<!-- gatekeeper ${server.id} decided -->`,
    );
  });

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "failure"',
    async () => {
      expect(statuses(server.http).at(-1)).toMatchObject({
        state: "failure",
        context: "gatekeeper",
        description: "rejected by github:sesigl: Breaks the release",
      });
    },
  );
});
