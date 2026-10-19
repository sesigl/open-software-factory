import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-021", async ({ sut, given, when, then }) => {
  await given('a hook event for an edit of "contracts/demo/demo.schema.json"', async () => {
    const event = { tool_name: "Edit", tool_input: { file_path: "contracts/demo/demo.schema.json" } };
    await sut.files.put("event.json", JSON.stringify(event));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the guard runs with OSF_APPROVED_PATHS set to "contracts/"', async () => {
    run = await sut.cli(["protect-paths", "event.json"], { env: { OSF_APPROVED_PATHS: "contracts/" } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });
});
