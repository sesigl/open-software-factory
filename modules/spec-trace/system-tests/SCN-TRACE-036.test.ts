import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-036", async ({ sut, given, when, then }) => {
  await given('a repository with the scenario ID "REQ-SHOP-0001"', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=REQ-SHOP-0001 @status=planned")) });
  });

  await given('a file "ci/trace.json" with the ID pattern "^REQ-([A-Z]+)-\\d{4}$"', async () => {
    await sut.files.put("$INPUT/ci/trace.json", JSON.stringify({ id: "^REQ-([A-Z]+)-\\d{4}$" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC --config ci/trace.json"', async () => {
    run = await sut.cli(["check", "--only", "SPEC", "--config", "ci/trace.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "SPEC ok"', async () => {
    expect(run.stdout).toContain("SPEC ok");
  });
});
