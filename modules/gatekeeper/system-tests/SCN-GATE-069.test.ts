import type { paths } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { AUTH, askedOnPullRequest } from "./server.ts";

// prServing checks the pull request gates every 20 ms.
const TEN_CHECKS_MS = 200;

scenario("SCN-GATE-069", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedOnPullRequest>>;
  await given('the server asked "maintainers" on the pull request "acme/web#12"', async () => {
    server = await askedOnPullRequest(sut, fakes);
  });

  await when("its database stops", async () => {
    await server.db.stop();
  });

  await then(
    'after ten checks of the pull request gates the server still answers "/v1/gates/<gate>", with the status 500',
    async () => {
      await new Promise((resolve) => setTimeout(resolve, TEN_CHECKS_MS));
      const { response } = await sut.http
        .client<paths>()
        .GET("/v1/gates/{gateId}", { params: { path: { gateId: server.id } }, headers: AUTH });
      expect(response.status).toBe(500);
    },
  );
});
