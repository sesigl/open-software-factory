import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFER-011", async ({ sut, given, when, then }) => {
  await given('a config whose "model_list" is the text "not-a-list"', async () => {
    await sut.files.put("$INPUT/config.yaml", "model_list: not-a-list\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "start" with the config', async () => {
    run = await sut.cli(["start", "config.yaml"]);
  });

  let id = "";
  await then('start exits with code 1 and names the gateway that "did not start and was removed"', async () => {
    expect(run.exitCode, run.stdout).toBe(1);
    id = /the gateway ([0-9a-f]{12}) did not start and was removed/.exec(run.stderr)?.[1] ?? "";
    expect(id, run.stderr).not.toBe("");
  });

  await then("list does not print that gateway's ID", async () => {
    const list = await sut.cli(["list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(id);
  });
});
