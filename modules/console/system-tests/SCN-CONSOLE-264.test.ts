import { scenario } from "@opensoftware/testkit";
import { open, serving } from "./console.ts";
import { factoryOf } from "./secrets.ts";

scenario("SCN-CONSOLE-264", async ({ sut, given, when, then }) => {
  await given(
    '"CONSOLE_FACTORY" names a "factory.yaml" with the agent "implement", whose "secrets" list "ref:openbao/linear-token" and whose "sandbox" has the template "node-24" and the egress "api.linear.app"',
    async () => {
      const env = await factoryOf(sut, {
        implement: { secrets: ["ref:openbao/linear-token"], egress: ["api.linear.app"] },
      });
      await serving(sut, ["http://127.0.0.1:1"], env);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/factory/agents/implement"', async () => {
    page = await open(sut, "/factory/agents/implement");
  });

  /** Each term of the agent's facts with the text of its definition. */
  const facts = () => {
    const terms = page.getAllByRole("term").map((term) => term.text);
    const definitions = page.getAllByRole("definition").map((definition) => definition.text);
    return Object.fromEntries(terms.map((term, index) => [term, definitions[index]]));
  };

  await then(
    'the agent\'s "secrets" show the YAML "- ref:openbao/linear-token" and its "sandbox" the YAML "template: node-24 egress: - api.linear.app"',
    async () => {
      expect(page.status).toBe(200);
      expect([facts().secrets, facts().sandbox]).toEqual([
        "- ref:openbao/linear-token",
        "template: node-24 egress: - api.linear.app",
      ]);
    },
  );

  await then('its "harness" shows "claude-code" and its "effort" "high"', async () => {
    expect([facts().harness, facts().effort]).toEqual(["claude-code", "high"]);
  });
});
