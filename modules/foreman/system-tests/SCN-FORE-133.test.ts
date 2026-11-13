import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-133", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "github" at "^0" under "providers.forge" and no "FOREMAN_FORGES"',
    async () => {
      const factory = (readmeFiles(fakes)["factory.yaml"] as string).replace(
        '    acp: "^0"\n',
        '    acp: "^0"\n  forge:\n    github: "^0"\n',
      );
      expect(factory).toContain('  forge:\n    github: "^0"\n');
      server = await serving(sut, fakes, { factory });
    },
  );

  let answer: Awaited<ReturnType<typeof server.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    answer = await server.start(readmeWork(fakes));
  });

  await then('the answer\'s "adapters" holds the harness "acp" at "^0" from "FOREMAN_HARNESSES"', async () => {
    expect(answer.response.status).toBe(201);
    expect(answer.data?.adapters?.[0]).toEqual({
      port: "harness",
      name: "acp",
      version: "^0",
      configured: "FOREMAN_HARNESSES",
    });
  });

  await then(
    'it holds the forge "github" at "^0" with the command line "npx -y @opensoftware/forge-github@^0"',
    async () => {
      expect(answer.data?.adapters?.slice(1)).toEqual([
        { port: "forge", name: "github", version: "^0", command: ["npx", "-y", "@opensoftware/forge-github@^0"] },
      ]);
    },
  );
});
