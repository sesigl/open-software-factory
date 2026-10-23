import { scenario } from "@opensoftware/testkit";
import { HELLO_WORLD, sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-003", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  let spec: Record<string, unknown> = {};
  await given('a sandbox spec with the template "hello-world:latest", an image without a shell', async () => {
    spec = { template: HELLO_WORLD };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "create" with the spec', async () => {
    run = await box.run(spec);
  });

  let id = "";
  await then("create exits with code 1 and says that the sandbox did not start and was removed", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    id = /the sandbox ([0-9a-f]{12}) did not start and was removed/.exec(run.stderr)?.[1] ?? "";
    expect(id, run.stderr).not.toBe("");
  });

  await then("the sandbox list does not hold that sandbox", async () => {
    const list = await box.cli(["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(id);
  });
});
