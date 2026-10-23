import { egressEntries } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-008", async ({ given, when, then }) => {
  let log = "";
  await given(
    'an iron-proxy audit line of a GET to "api.example.invalid:443" "/" rejected by "allowlist"',
    async () => {
      const audit = { host: "api.example.invalid:443", method: "GET", path: "/", action: "reject" };
      log = ["iron-proxy starting", JSON.stringify({ msg: "request", audit, rejected_by: "allowlist" }), ""].join("\n");
    },
  );

  let entries: ReturnType<typeof egressEntries> = [];
  await when("the adapter calls egressEntries with the log", async () => {
    entries = egressEntries(log);
  });

  await then('the entry is a request to "api.example.invalid" "/" refused by "allowlist"', async () => {
    expect(entries).toEqual([
      { host: "api.example.invalid", method: "GET", path: "/", outcome: "refused", refusedBy: "allowlist" },
    ]);
  });
});
