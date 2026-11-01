import { scenario } from "@opensoftware/testkit";
import { demoPackage, GREETER_LICENSE } from "./bundle.ts";

scenario("SCN-REPO-066", async ({ sut, given, when, then }) => {
  await given(
    'a package "adapters/demo" whose "src/cli.ts" prints the greeting of the package "greeter" from node_modules',
    async () => {
      await demoPackage(sut, true);
    },
  );

  await given('"greeter" has the license "MIT" and a LICENSE file', async () => {
    expect(await sut.files.read("$INPUT/adapters/demo/node_modules/greeter/LICENSE")).toBe(GREETER_LICENSE);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf bundle adapters/demo"', async () => {
    run = await sut.cli(["bundle", "adapters/demo"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"adapters/demo/dist/cli.js" turns on the compile cache and imports "./main.js"', async () => {
    const bin = await sut.files.read("$INPUT/adapters/demo/dist/cli.js");
    expect(bin).toMatch(/^#!\/usr\/bin\/env node\n/);
    expect(bin).toContain("enableCompileCache");
    expect(bin).toContain('await import("./main.js")');
  });

  await then(
    'the source map of "adapters/demo/dist/main.js" names "src/cli.ts" and holds the code of "greeter"',
    async () => {
      const map = JSON.parse(await sut.files.read("$INPUT/adapters/demo/dist/main.js.map")) as {
        sources: string[];
        sourcesContent: string[];
      };
      expect(map.sources).toContain("../src/cli.ts");
      expect(map.sources).toContain("../node_modules/greeter/index.js");
      expect(await sut.files.read("$INPUT/adapters/demo/dist/main.js")).toContain("hello from greeter, ");
    },
  );

  await then(
    '"adapters/demo/dist/THIRD-PARTY-NOTICES.md" names "greeter 1.0.0", its license "MIT" and its license text',
    async () => {
      const notices = await sut.files.read("$INPUT/adapters/demo/dist/THIRD-PARTY-NOTICES.md");
      expect(notices).toContain("## greeter 1.0.0\n\nLicense: MIT\n");
      expect(notices).toContain(GREETER_LICENSE);
    },
  );
});
