import { scenario } from "@opensoftware/testkit";
import { COMMENTS, statuses } from "./gate.ts";
import { linking, prServing } from "./server.ts";

scenario("SCN-GATE-111", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof prServing>>;
  let id = "";
  await given(
    'the server asked "maintainers" on the pull request "acme/web#12" at "2026-01-01T00:00:00Z"',
    async () => {
      server = await prServing(sut, fakes, { OSF_NOW: "2026-01-01T00:00:00Z" });
      const { data, response } = await server.post(linking(server.pr));
      expect(response.status).toBe(201);
      id = data?.id ?? "";
    },
  );

  await given(
    'the pull request no longer has the request\'s comment, and has an "/approve" by "github:sesigl" of "maintainers" from "2025-12-31T23:00:00Z" and one from "2026-01-01T00:10:00Z"',
    async () => {
      server.http.comment({ id: 800, body: "/approve", login: "sesigl", at: "2025-12-31T23:00:00Z" });
      server.http.comment({ id: 901, body: "/approve", login: "sesigl", at: "2026-01-01T00:10:00Z" });
    },
  );

  await when("the server read the pull request's comments twice", async () => {
    const reads = () => server.http.requests().filter((line) => line === `GET ${COMMENTS}&page=1`).length;
    const before = reads();
    await expect.poll(() => reads() - before, { timeout: 10_000, interval: 20 }).toBeGreaterThanOrEqual(2);
  });

  await then('"/v1/gates/<gate>" shows the state "pending"', async () => {
    expect(await server.gate(id)).toMatchObject({ id, state: "pending" });
  });

  await then(
    'the head commit of the pull request has only the commit status "gatekeeper" with the state "pending"',
    async () => {
      expect(statuses(server.http).map(({ state, description }) => ({ state, description }))).toEqual([
        { state: "pending", description: "waiting for maintainers" },
      ]);
    },
  );
});
