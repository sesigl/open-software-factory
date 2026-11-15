import { scenario } from "@opensoftware/testkit";
import { links, open, serving } from "./console.ts";
import { lines, runRecord } from "./improvement.ts";

scenario("SCN-CONSOLE-265", async ({ sut, given, when, then }) => {
  await given('"CONSOLE_IMPROVE_DIR" names a folder with the stage "implement" of "run_a" at 0.25 USD', async () => {
    await sut.files.put("$INPUT/improve/runs.jsonl", lines([runRecord("run_a", "implement", "succeeded", 0.25)]));
    await serving(sut, ["http://127.0.0.1:1"], { CONSOLE_IMPROVE_DIR: sut.files.path("$INPUT/improve") });
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/improvement"', async () => {
    page = await open(sut, "/improvement");
  });

  await then(
    'the page has the title "Cost and scores · Open Software Factory" and marks "Cost and scores" as the current page',
    async () => {
      expect([page.status, page.title]).toEqual([200, "Cost and scores · Open Software Factory"]);
      const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { current: "page" });
      expect([current.attribute("href"), current.text]).toEqual(["/improvement", "Cost and scores"]);
    },
  );

  await then('the run "run_a" links its page "/runs/run_a"', async () => {
    expect(links(page.getByRole("main"))).toEqual([{ href: "/runs/run_a", text: "run_a" }]);
  });
});
