import { type SandboxOptions, scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

/** The sandboxes the fake holds from its start, with their IDs in this order (fakes.sandbox's "held"). */
const HELD = [
  { template: "node:24", labels: { "osf.owner": "factory-a", "osf.run": "run_0a1b2c3d4e5f60718293" } },
  { template: "node:24", labels: { "osf.owner": "factory-b", "osf.run": "run_0a1b2c3d4e5f60718293" } },
  { template: "node:24" },
];

scenario("SCN-FORE-188", async ({ sut, fakes, given, when, then }) => {
  let sandbox: SandboxOptions = {};
  await given(
    'a fake sandbox adapter as "docker" that holds a sandbox with the label "osf.owner" "factory-a", one with "osf.owner" "factory-b" and one without labels',
    async () => {
      // The fake starts with the server below and holds these from its start.
      sandbox = { held: HELD };
    },
  );

  let server: Awaited<ReturnType<typeof serving>>;
  await when(
    '"foreman serve" starts with the README\'s "factory.yaml" and "FOREMAN_SANDBOX_OWNER" set to "factory-a"',
    async () => {
      server = await serving(sut, fakes, {
        sandbox,
        env: { FOREMAN_SANDBOX_OWNER: "factory-a" },
      });
    },
  );

  await then(
    'the sandbox adapter\'s list holds the sandbox of "factory-b" and the one without labels, and not the one of "factory-a"',
    async () => {
      expect(server.sandbox?.list()).toEqual(["000000000002", "000000000003"]);
    },
  );

  await then(
    "the server's output has the line 'foreman: destroyed the sandbox 000000000001 of \"factory-a\" that a foreman before left'",
    async () => {
      expect(sut.http.output().stderr.split("\n")).toContain(
        'foreman: destroyed the sandbox 000000000001 of "factory-a" that a foreman before left',
      );
    },
  );
});
