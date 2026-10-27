import { scenario } from "@opensoftware/testkit";
import { factoryYaml, type Smoke, smoke } from "./profile.ts";

/** Where `factory apply` points the webhook: intake's forge events inside the profile. */
const INTAKE = "http://intake:8080/forge/events";
const ELSEWHERE = "http://elsewhere.example/hook";

scenario("SCN-E2E-005", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  const hooksApi = (path = "", init: RequestInit = {}) =>
    fetch(`${forge.url}/api/v1/repos/${forge.owner}/web/hooks${path}`, {
      ...init,
      headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    });

  let profile: Smoke;
  await given('a factory applied from "factory.yaml"', async () => {
    await forge.createRepository("web");
    const factory = factoryYaml(["triage"], {
      harness: "claude-code",
      providers: ["forge:", '  forgejo: "^0"'],
      agent: [`repositories: [${forge.owner}/web]`],
      tail: ["automations:", "  - on: forgejo.issue.labeled(factory)"],
    });
    profile = await smoke(sut, fakes, factory, [], forge);
    await profile.run(["run", "--rm", "factory", "apply"]);
    expect(await forge.hooks("web")).toEqual([{ url: INTAKE, events: ["issue_label"], active: true }]);
  });

  await when("a person changes a webhook directly in Forgejo", async () => {
    const [hook] = (await (await hooksApi()).json()) as { id: number; events: string[] }[];
    const changed = await hooksApi(`/${hook?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ config: { url: ELSEWHERE, content_type: "json" }, events: hook?.events, active: true }),
    });
    expect(changed.status).toBe(200);
  });

  await then('"factory plan" reports the webhook as drift', async () => {
    const plan = await profile.run(["run", "--rm", "factory", "plan"]);
    expect(plan).toContain(`! webhook ${forge.owner}/web.url: "${INTAKE}" -> "${ELSEWHERE}"`);
    expect(plan).toContain("Plan: 0 to add, 0 to change, 0 to remove, 1 drifted.");
  });
});
