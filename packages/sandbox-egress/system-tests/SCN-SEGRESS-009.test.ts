import { egressEntries } from "@opensoftware/sandbox-egress";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SEGRESS-009", async ({ given, when, then }) => {
  let log = "";
  await given('an iron-proxy audit line of an allowed GET to "/viewer" that swapped "LINEAR_TOKEN"', async () => {
    log = JSON.stringify({
      msg: "request",
      audit: { host: "api.linear.app", method: "GET", path: "/viewer", action: "allow" },
      request_transforms: [
        { name: "allowlist" },
        { name: "secrets", annotations: { swapped: [{ secret: "/osf/secrets/LINEAR_TOKEN" }] } },
      ],
    });
  });

  let entries: ReturnType<typeof egressEntries> = [];
  await when("the adapter calls egressEntries with the log", async () => {
    entries = egressEntries(log);
  });

  await then('the entry is an allowed request to "/viewer" with the secret "LINEAR_TOKEN"', async () => {
    expect(entries).toEqual([
      { host: "api.linear.app", method: "GET", path: "/viewer", outcome: "allowed", secrets: ["LINEAR_TOKEN"] },
    ]);
  });
});
