import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";
import { BAO_README } from "./openbao.ts";

scenario("SCN-TK-180", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI runs curl in a container for the secret "demo" of the mount "DEMO_BAO_MOUNT" at "DEMO_BAO_ADDR" with the token "DEMO_BAO_TOKEN", and prints the body',
    async () => {
      bin = [
        'import { spawnSync } from "node:child_process";',
        "const { DEMO_BAO_ADDR: addr, DEMO_BAO_TOKEN: token, DEMO_BAO_MOUNT: mount } = process.env;",
        "const args = ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway', 'curlimages/curl:8.17.0',",
        "  '-sS', '-H', `x-vault-token: ${token}`, `${addr}/v1/${mount}/data/demo`];",
        "const run = spawnSync('docker', args, { encoding: 'utf8' });",
        "process.stdout.write(run.stdout);",
        "process.stderr.write(run.stderr);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test writes "demo" with the value "bao_test_1" to fakes.openbao for containers, passes its container URL and a token whose policy may read the mount, and expects "bao_test_1" in the output',
    async () => {
      const module = demoModule({
        bin,
        readme: BAO_README,
        steps: ['When the user runs "demo"', 'Then the output holds "bao_test_1"'],
        test: [
          "const bao = await fakes.openbao({ containers: true });",
          'await bao.write("demo", { value: "bao_test_1" });',
          'const token = await bao.token(`path "${bao.mount}/data/*" { capabilities = ["read"] }`);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_BAO_ADDR: bao.containerUrl ?? '', DEMO_BAO_MOUNT: bao.mount, DEMO_BAO_TOKEN: token };",
          "  run = await sut.cli([], { env });",
          "});",
          "await then('the output holds \"bao_test_1\"', async () => {",
          "  expect(bao.containerUrl).toMatch(/^http:\\/\\/host\\.docker\\.internal:\\d+$/);",
          "  expect(JSON.parse(run.stdout).data.data, run.stderr).toEqual({ value: 'bao_test_1' });",
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
