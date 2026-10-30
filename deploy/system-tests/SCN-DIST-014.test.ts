import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

const SECRET = "whsec-compose-1";
const TOKEN = "intake-token-1";

/** The part of intake's answer to GET /v1/work-items that the scenario reads. */
interface WorkItemView {
  status: string;
  workItem: { title: string; dedupeKey: string };
}

scenario("SCN-DIST-014", async ({ sut, fakes, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env" and "INTAKE_WEBHOOK_SECRET" set',
    async () => {
      compose = await profile(sut, undefined, { INTAKE_WEBHOOK_SECRET: SECRET });
    },
  );

  let intake = "";
  await given('the operator ran "docker compose up --detach --wait intake"', async () => {
    const up = await compose.run(words("docker compose up --detach --wait intake"));
    expect(up.exitCode, up.stderr).toBe(0);
    intake = await compose.url("intake", 8080);
  });

  const github = await fakes.github();
  await given(
    'a GitHub webhook for issues to intake\'s "/forge/events", signed with the value of "INTAKE_WEBHOOK_SECRET"',
    async () => {
      await github.createRepository("web");
      const answer = await fetch(`${github.url}/repos/tester/web/hooks`, {
        method: "POST",
        headers: { authorization: `Bearer ${github.token}`, "content-type": "application/json" },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["issues"],
          config: { url: `${intake}/forge/events`, content_type: "json", secret: SECRET },
        }),
      });
      expect(answer.status).toBe(201);
    },
  );

  let link = "";
  await when('"tester" adds the label "factory" to the issue "Export reports as CSV"', async () => {
    const issue = await github.openIssue("web", { title: "Export reports as CSV", body: "Finance needs it monthly" });
    await github.label("web", issue.number, "factory");
    link = `${github.url}/tester/web/issues/${issue.number}`;
  });

  await then(
    'intake shows a work item "Export reports as CSV" in the state "received" with the issue\'s link as its dedupe key',
    async () => {
      const byKey = () =>
        fetch(`${intake}/v1/work-items?dedupeKey=${encodeURIComponent(link)}`, {
          headers: { authorization: `Bearer ${TOKEN}` },
        });
      await expect.poll(async () => (await byKey()).status, { timeout: 15_000, interval: 100 }).toBe(200);
      const view = (await (await byKey()).json()) as WorkItemView;
      expect(view.status).toBe("received");
      expect(view.workItem).toMatchObject({ title: "Export reports as CSV", dedupeKey: link });
    },
  );
});
