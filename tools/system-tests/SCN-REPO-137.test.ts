import { scenario } from "@opensoftware/testkit";
import { dockerCalls, fakeDocker } from "./setup.ts";

scenario("SCN-REPO-137", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a fake docker that logs its arguments and its folder, prints "FAIL  groups: put a real member" and exits with code 1',
    async () => {
      await sut.files.put("$INPUT/deploy/compose/compose.yaml", "services: {}\n");
      env = await fakeDocker(sut, "FAIL  groups: put a real member", 1);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "FAIL  groups: put a real member"', async () => {
    expect(run.stdout).toContain("FAIL  groups: put a real member");
  });

  await then('the fake docker ran "compose run --rm console console doctor" in "deploy/compose"', async () => {
    expect(await dockerCalls(sut)).toEqual(["deploy/compose|compose run --rm console console doctor"]);
  });
});
