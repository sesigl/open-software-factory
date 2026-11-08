import type { WorkItemView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { foreman, links, navLinks, open, RUN, rows, runOf, serving } from "./console.ts";

/** A work item view of the run's work item with this title, status and run. */
const viewOf = (title: string, status: WorkItemView["status"], runId?: string): WorkItemView => {
  const { workItem } = runOf(title);
  return {
    workItem: { ...workItem, id: `wi_${title.length.toString(16).padStart(20, "0")}` },
    status,
    ...(runId ? { runId } : {}),
    receivedAt: "2026-01-01T00:00:00Z",
    requests: [],
  };
};

scenario("SCN-CONSOLE-043", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  let foremanUrl = "";
  await given(
    'an intake whose inbox holds "Import reports from CSV", received and without a run, and "Export reports as CSV", running in the run "run_5d41402abc4b2a76b971"',
    async () => {
      const intake = await fakes.http([
        {
          path: "/v1/inbox",
          body: {
            workItems: [viewOf("Import reports from CSV", "received"), viewOf("Export reports as CSV", "running", RUN)],
          },
        },
      ]);
      foremanUrl = (await foreman(fakes, [])).url;
      env = { CONSOLE_INTAKE_URL: intake.url, CONSOLE_INTAKE_TOKEN: "intake-token" };
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/work"', async () => {
    await serving(sut, [foremanUrl], env);
    page = await open(sut, "/work");
  });

  await then(
    'the table has the rows "Import reports from CSV", "task", "received", "slack", "Varun", "—" and "Export reports as CSV", "task", "running", "slack", "Varun", "run_5d41402abc4b2a76b971"',
    async () => {
      expect(page.status).toBe(200);
      expect(rows(page.html).map((row) => row.slice(0, 6))).toEqual([
        ["Import reports from CSV", "task", "received", "slack", "Varun", "—"],
        ["Export reports as CSV", "task", "running", "slack", "Varun", RUN],
      ]);
    },
  );

  await then('the run links "/runs/run_5d41402abc4b2a76b971"', async () => {
    expect(links(page.html)).toContainEqual({ href: `/runs/${RUN}`, text: RUN });
  });

  await then('the page\'s navigation links "/work"', async () => {
    expect(navLinks(page.html)).toContainEqual({ href: "/work", text: "Work" });
  });
});
