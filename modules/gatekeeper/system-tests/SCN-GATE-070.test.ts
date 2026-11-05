import type { paths } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { AUTH, askedOnPullRequest } from "./server.ts";

const COMMENTS = "/repos/acme/web/issues/12/comments?per_page=100";

scenario("SCN-GATE-070", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedOnPullRequest>>;
  await given('the server asked "maintainers" on the pull request "acme/web#12"', async () => {
    server = await askedOnPullRequest(sut, fakes);
  });

  // The server reads the comments inside the transaction that locks the gate, so the held read keeps it open.
  let answer = () => {};
  await given("the forge holds the server's next read of the pull request's comments", async () => {
    const reads = () => server.http.requests().filter((line) => line === `GET ${COMMENTS}`).length;
    const before = reads();
    answer = server.http.holdReads();
    await expect.poll(reads).toBeGreaterThan(before);
  });

  await when("its database stops", async () => {
    await server.db.stop();
  });

  await when("the forge answers the read", async () => {
    answer();
  });

  await then('the server answers "/v1/gates/<gate>" with the status 500', async () => {
    const { response } = await sut.http
      .client<paths>()
      .GET("/v1/gates/{gateId}", { params: { path: { gateId: server.id } }, headers: AUTH });
    expect(response.status).toBe(500);
  });
});
