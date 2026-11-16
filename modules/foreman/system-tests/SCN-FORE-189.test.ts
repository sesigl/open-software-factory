import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-189", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'the README\'s "factory.yaml" with "FOREMAN_SANDBOX_OWNER" set to "factory-a" and "FOREMAN_SANDBOXES" naming "false" as "docker", a sandbox adapter whose every command fails',
    async () => {
      env = { FOREMAN_SANDBOX_OWNER: "factory-a", FOREMAN_SANDBOXES: JSON.stringify({ docker: "false" }) };
    },
  );

  await when('"foreman serve" starts', async () => {
    await serving(sut, fakes, { env });
  });

  await then('"/v1/health" answers 200', async () => {
    expect((await sut.http.request("GET", "/v1/health")).status).toBe(200);
  });

  await then(
    "the server's output has a line that starts with 'foreman: the sandboxes of \"factory-a\" that a foreman before left stay: the sandbox adapter's list failed: '",
    async () => {
      expect(sut.http.output().stderr).toMatch(
        /^foreman: the sandboxes of "factory-a" that a foreman before left stay: the sandbox adapter's list failed: /m,
      );
    },
  );
});
