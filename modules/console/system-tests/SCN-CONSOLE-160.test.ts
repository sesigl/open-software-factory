import { scenario } from "@opensoftware/testkit";
import { foreman, open, runOf, serving } from "./console.ts";

/** The text of the navigation's link to the runs. */
const runsLink = (page: Awaited<ReturnType<typeof open>>) =>
  page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Runs/ }).text;

scenario("SCN-CONSOLE-160", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a foreman with the run "Approve the spec" that waits for a person and the running run "Export reports as CSV"',
    async () => {
      const waits = runOf("Approve the spec", { runId: "run_00000000000000000001", state: "blocked" });
      const running = runOf("Export reports as CSV");
      const api = await foreman(
        fakes,
        [waits, running],
        [
          { path: "/v1/runs?state=blocked", body: { runs: [waits] } },
          { path: "/v1/runs?state=running", body: { runs: [running] } },
        ],
      );
      await serving(sut, [api.url]);
    },
  );

  let pages: Awaited<ReturnType<typeof open>>[] = [];
  await when('a person opens "/", "/?state=blocked" and "/?state=running"', async () => {
    pages = [await open(sut, "/"), await open(sut, "/?state=blocked"), await open(sut, "/?state=running")];
  });

  await then('the link "Runs" says "1 waits" on "/" and on "/?state=blocked"', async () => {
    expect(pages.slice(0, 2).map(runsLink)).toEqual(["Runs 1 waits", "Runs 1 waits"]);
  });

  await then('it says no count on "/?state=running", which does not show the runs that wait', async () => {
    expect(runsLink(pages[2] as Awaited<ReturnType<typeof open>>)).toBe("Runs");
  });
});
