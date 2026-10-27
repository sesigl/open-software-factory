import type { WorkItemView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, RUN, runOf, SLACK_THREAD, serving, text } from "./console.ts";

const ISSUE = "https://github.com/acme/web/issues/12";

scenario("SCN-CONSOLE-017", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a foreman with a run from Slack, and intake whose work item has a second request from "github" by "Varun" at "https://github.com/acme/web/issues/12"',
    async () => {
      const run = runOf("Export reports as CSV");
      api = await foreman(fakes, [run]);
      const view: WorkItemView = {
        workItem: run.workItem,
        status: "running",
        runId: RUN,
        receivedAt: "2025-12-31T23:50:00.000Z",
        requests: [
          { requester: run.workItem.requester, origin: run.workItem.origin, receivedAt: "2025-12-31T23:50:00.000Z" },
          {
            requester: { kind: "person", id: "github:varun", displayName: "Varun" },
            origin: { source: "github", url: ISSUE },
            receivedAt: "2025-12-31T23:52:00.000Z",
          },
        ],
      };
      intake = await fakes.http([{ path: `/v1/work-items/${run.workItem.id}`, body: view }]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens the run\'s page with "CONSOLE_INTAKE_URL" set to intake', async () => {
    await serving(sut, [api.url], { CONSOLE_INTAKE_URL: intake.url, CONSOLE_INTAKE_TOKEN: "intake-token-1" });
    page = await open(sut, `/runs/${RUN}`);
  });

  await then('the page lists the requests from "slack" and "github"', async () => {
    expect(text(page.html)).toContain("Origin slack asked by Varun github asked by Varun Evidence");
    expect(intake.headers()[0]?.headers.authorization).toBe("Bearer intake-token-1");
  });

  await then('the page links the origin "https://github.com/acme/web/issues/12" asked by "Varun"', async () => {
    expect(links(page.html)).toEqual(
      expect.arrayContaining([
        { href: SLACK_THREAD, text: "slack" },
        { href: ISSUE, text: "github" },
      ]),
    );
  });
});
