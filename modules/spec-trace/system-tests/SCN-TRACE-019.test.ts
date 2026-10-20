import { scenario } from "@opensoftware/testkit";
import { block, feature, LABELS, put, test } from "./repo.ts";

scenario("SCN-TRACE-019", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario "SCN-SHOP-001" and a test that calls "spec" instead of "scenario"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001", LABELS, "spec"),
      });
    },
  );

  await given('a spec-trace.json with the function "spec"', async () => {
    await sut.files.put("$INPUT/spec-trace.json", JSON.stringify({ function: "spec" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "TRACE ok"', async () => {
    expect(run.stdout).toContain("TRACE ok");
  });
});
