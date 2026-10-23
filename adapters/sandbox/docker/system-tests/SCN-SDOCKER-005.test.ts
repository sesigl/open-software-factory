import { scenario } from "@opensoftware/testkit";

const HELLO_WORLD = "hello-world:latest@sha256:11a3eb1597e864c51b3f56733cb2e8a90bf0c284bfc05f9444d81c558bc848aa";

scenario("SCN-SDOCKER-005", async ({ sut, given, when, then }) => {
  await given('a sandbox spec with the template "hello-world", an image without a shell', async () => {
    await sut.files.put("$INPUT/spec.json", JSON.stringify({ template: HELLO_WORLD }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await sut.cli(["create", "spec.json"]);
  });

  let id = "";
  await then("create exits with code 1 and says that the sandbox did not start and was removed", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    id = /the sandbox ([0-9a-f]{12}) did not start and was removed/.exec(run.stderr)?.[1] ?? "";
    expect(id, run.stderr).not.toBe("");
  });

  await then("the sandbox list does not hold that sandbox", async () => {
    const list = await sut.cli(["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(id);
  });
});
