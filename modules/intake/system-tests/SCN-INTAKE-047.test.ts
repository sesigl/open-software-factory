import type { WorkItemList } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { AUTH, following, readmeWork, runEvent } from "./server.ts";

scenario("SCN-INTAKE-047", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await given('the foreman published "run.started@v1" for the work item', async () => {
    await server.publish(runEvent(server.id));
    await server.until("running");
  });

  await given('the server received a submission with the title "Import reports from CSV"', async () => {
    const other = { ...readmeWork(fakes), title: "Import reports from CSV", dedupeKey: "idea:import-csv" };
    expect((await server.submit(other)).response.status).toBe(201);
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/inbox?status=running" with the API token', async () => {
    answer = await sut.http.request("GET", "/v1/inbox?status=running", { headers: AUTH });
  });

  await then('the answer lists only the work item "Export reports as CSV"', async () => {
    expect(answer.status).toBe(200);
    expect((answer.body as WorkItemList).workItems.map(({ workItem }) => workItem.title)).toEqual([
      "Export reports as CSV",
    ]);
  });
});
