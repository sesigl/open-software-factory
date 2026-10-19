import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-022", async ({ sut, given, when, then }) => {
  await given('a hook event for an edit of "contracts/../tools/checks/contract.ts"', async () => {
    const event = { tool_name: "Edit", tool_input: { file_path: "contracts/../tools/checks/contract.ts" } };
    await sut.files.put("event.json", JSON.stringify(event));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the guard runs with OSF_APPROVED_PATHS set to "contracts/"', async () => {
    run = await sut.cli(["protect-paths", "event.json"], { env: { OSF_APPROVED_PATHS: "contracts/" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the error output contains "Protected: tools/checks/contract.ts"', async () => {
    expect(run.stderr).toContain("Protected: tools/checks/contract.ts");
  });
});
