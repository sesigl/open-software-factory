import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { API_TOKEN } from "./foreman.ts";

const INFO_REFS = "/acme/factory.git/info/refs?service=git-upload-pack";

scenario("SCN-FORE-167", async ({ sut, fakes, given, when, then }) => {
  let forge: FakeHttp;
  await given('a forge over HTTP whose repository "/acme/factory.git" asks for credentials', async () => {
    forge = await fakes.http([{ path: INFO_REFS, status: 401, body: "", contentType: "text/plain" }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "foreman serve" with "FOREMAN_FACTORY" set to "git+<url>/acme/factory.git#main" and "FOREMAN_FACTORY_TOKEN" set to "factory-token-0001"',
    async () => {
      run = await sut.cli(["serve"], {
        env: {
          FOREMAN_API_TOKEN: API_TOKEN,
          FOREMAN_FACTORY: `git+${forge.url}/acme/factory.git#main`,
          FOREMAN_FACTORY_TOKEN: "factory-token-0001",
          OSF_DATA: sut.files.path("$OUTPUT/data"),
        },
      });
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "FOREMAN_FACTORY: cannot fetch main of <url>/acme/factory.git: " and not the token',
    async () => {
      expect(run.stderr).toContain(`FOREMAN_FACTORY: cannot fetch main of ${forge.url}/acme/factory.git: `);
      expect(run.stdout + run.stderr).not.toContain("factory-token-0001");
    },
  );

  await then(
    'the forge received "Authorization: Basic" with the base64 of "x-access-token:factory-token-0001"',
    async () => {
      const basic = `Basic ${Buffer.from("x-access-token:factory-token-0001").toString("base64")}`;
      expect(forge.headers().map(({ path, headers }) => [path, headers.authorization])).toEqual([[INFO_REFS, basic]]);
    },
  );
});
