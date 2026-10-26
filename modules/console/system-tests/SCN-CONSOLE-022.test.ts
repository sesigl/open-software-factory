import { scenario } from "@opensoftware/testkit";
import { open, serving, text } from "./console.ts";

const UNKNOWN = "run_00000000000000000000";

scenario("SCN-CONSOLE-022", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof fakes.http>>;
  await given('a foreman that answers 404 for the run "run_00000000000000000000"', async () => {
    api = await fakes.http([{ path: `/v1/runs/${UNKNOWN}`, status: 404, body: { title: "No such run" } }]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/runs/run_00000000000000000000"', async () => {
    await serving(sut, [api.url]);
    page = await open(sut, `/runs/${UNKNOWN}`);
  });

  await then('the page answers 404 and says "no run run_00000000000000000000"', async () => {
    expect(page.status).toBe(404);
    expect(text(page.html)).toContain(`Not found no run ${UNKNOWN}`);
  });
});
