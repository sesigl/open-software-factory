import { scenario } from "@opensoftware/testkit";
import { demoPackage } from "./bundle.ts";

scenario("SCN-REPO-067", async ({ sut, given, when, then }) => {
  await given(
    'a package "adapters/demo" whose "src/cli.ts" prints the greeting of the package "greeter" from node_modules',
    async () => {
      await demoPackage(sut, false);
    },
  );

  await given('"greeter" has no license in its package.json and no LICENSE file', async () => {
    expect(await sut.files.list("$INPUT/adapters/demo/node_modules/greeter")).not.toContain("LICENSE");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf bundle adapters/demo"', async () => {
    run = await sut.cli(["bundle", "adapters/demo"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then("the error output says 'greeter 1.0.0 in the bundle of adapters/demo has no license'", async () => {
    expect(run.stderr).toContain("greeter 1.0.0 in the bundle of adapters/demo has no license");
  });
});
