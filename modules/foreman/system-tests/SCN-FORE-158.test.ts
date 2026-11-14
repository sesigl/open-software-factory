import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-158", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "github" at "^0" under "providers.forge" and no "FOREMAN_FORGES"',
    async () => {
      factory = (readmeFiles(fakes)["factory.yaml"] as string).replace(
        '    acp: "^0"\n',
        '    acp: "^0"\n  forge:\n    github: "^0"\n',
      );
      expect(factory).toContain('  forge:\n    github: "^0"\n');
    },
  );

  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    'the committed "factory.lock" pins the forge "github" at "^0" to "0.3.1" and the harness "acp" at "^1" to "1.0.0"',
    async () => {
      const adapters = {
        harness: { acp: { range: "^1", version: "1.0.0" } },
        forge: { github: { range: "^0", version: "0.3.1" } },
      };
      await sut.files.put("$INPUT/factory.lock", `${JSON.stringify({ version: 1, mcp: {}, adapters }, null, 2)}\n`);
      server = await serving(sut, fakes, { factory });
    },
  );

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then(
    'the answer\'s "adapters" holds the forge "github" at "0.3.1" with the command line "npx -y @opensoftware/forge-github@0.3.1"',
    async () => {
      expect(answer.response.status).toBe(201);
      expect(answer.data?.adapters?.[1]).toEqual({
        port: "forge",
        name: "github",
        version: "0.3.1",
        command: ["npx", "-y", "@opensoftware/forge-github@0.3.1"],
      });
    },
  );

  await then('it holds the harness "acp" at its range "^0", since the lock pins another range', async () => {
    expect(answer.data?.adapters?.[0]).toEqual({
      port: "harness",
      name: "acp",
      version: "^0",
      configured: "FOREMAN_HARNESSES",
    });
  });
});
