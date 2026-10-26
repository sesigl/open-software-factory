import { scenario } from "@opensoftware/testkit";
import { eventually, forgeServing, ISSUE } from "./server.ts";

scenario("SCN-INTAKE-021", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof forgeServing>>;
  await given(
    'the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues',
    async () => {
      server = await forgeServing(sut, fakes);
    },
  );

  let issue: { number: number; url: string };
  await when('"tester" adds the label "factory" to the issue "Export reports as CSV"', async () => {
    issue = await server.labeled("factory");
  });

  let view: Awaited<ReturnType<typeof eventually>>;
  await then(
    '"/v1/work-items/<id of the issue\'s link>" shows the work item "Export reports as CSV" in the state "received"',
    async () => {
      view = await eventually(server, issue.url);
      expect(view).toMatchObject({ status: "received" });
      expect(view.workItem).toMatchObject({
        type: "task",
        title: ISSUE,
        description: "Finance needs it monthly",
        dedupeKey: issue.url,
      });
    },
  );

  await then('it shows the requester "github:tester" and the origin "github" with the issue\'s link', async () => {
    expect(view.workItem.requester).toEqual({ kind: "person", id: "github:tester", displayName: "tester" });
    expect(view.workItem.origin).toEqual({
      source: "github",
      url: issue.url,
      externalId: `tester/web#${issue.number}`,
    });
    expect(view.requests).toHaveLength(1);
  });
});
