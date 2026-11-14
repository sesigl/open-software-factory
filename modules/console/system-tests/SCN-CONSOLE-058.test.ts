import type { WorkItemView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { foreman, links, open, rows, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-058", async ({ sut, fakes, given, when, then }) => {
  const item: WorkItemView = {
    workItem: runOf("Import reports from CSV").workItem,
    status: "received",
    receivedAt: "2026-01-01T00:00:00Z",
    requests: [],
  };
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  let foremanUrl = "";
  await given(
    'an intake whose inbox\'s first page holds "Import reports from CSV" and names the next cursor "Y3Vyc29y"',
    async () => {
      intake = await fakes.http([
        { path: "/v1/inbox", body: { workItems: [item], next: "Y3Vyc29y" } },
        { path: "/v1/inbox?cursor=Y3Vyc29y", body: { workItems: [] } },
      ]);
      foremanUrl = (await foreman(fakes, [])).url;
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/work"', async () => {
    await serving(sut, [foremanUrl], { CONSOLE_INTAKE_URL: intake.url });
    page = await open(sut, "/work");
  });

  await then(
    'the table lists "Import reports from CSV" and the page links "Next page" to "/work?cursor=Y3Vyc29y"',
    async () => {
      expect(rows(page.html).map((row) => row[0])).toEqual(["Import reports from CSV"]);
      expect(links(page.html)).toContainEqual({ href: "/work?cursor=Y3Vyc29y", text: "Next page" });
    },
  );

  await then('opening that link asks intake for "/v1/inbox?cursor=Y3Vyc29y"', async () => {
    const next = await open(sut, "/work?cursor=Y3Vyc29y");
    expect(next.status).toBe(200);
    expect(links(next.html).map((link) => link.text)).not.toContain("Next page");
    expect(intake.headers().map((request) => request.path)).toEqual(["/v1/inbox", "/v1/inbox?cursor=Y3Vyc29y"]);
  });
});
