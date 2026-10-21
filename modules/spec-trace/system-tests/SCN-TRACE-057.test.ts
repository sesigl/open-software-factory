import { scenario } from "@opensoftware/testkit";
import { baseCommit, block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-057", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the planned scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut, "planned");
  });

  await given('the scenario "SCN-SHOP-001" marked implemented since the base commit', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --summary summary.md --base" with the base commit', async () => {
    run = await sut.cli(["report", "--summary", "summary.md", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the file "summary.md" in the working folder contains "| SCN-SHOP-001 | status planned → implemented |"',
    async () => {
      expect(await sut.files.read("$INPUT/summary.md")).toContain("| SCN-SHOP-001 | status planned → implemented |");
    },
  );
});
