import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-005", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report where "SCN-WEB-001" passed and "SCN-WEB-002" has the status "unexpected"',
    async () => {
      await putPlaywright(sut, [
        { title: "SCN-WEB-001 a guest pays with a card" },
        { title: "SCN-WEB-002 a guest pays with a voucher", status: "unexpected" },
      ]);
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the bundle lists the scenario "SCN-WEB-002" with the result "failed"', async () => {
    expect((await manifestOf(sut)).scenarios).toContainEqual(
      expect.objectContaining({ id: "SCN-WEB-002", result: "failed" }),
    );
  });

  await then('the bundle has the result "failed"', async () => {
    expect((await manifestOf(sut)).result).toBe("failed");
  });
});
