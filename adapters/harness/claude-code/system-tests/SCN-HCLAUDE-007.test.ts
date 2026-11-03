import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect } from "./claude.ts";

scenario("SCN-HCLAUDE-007", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given(
    'the adapter runs Claude Code with that gateway, the gateway key "sk-run-1" in "ANTHROPIC_API_KEY", the token "sub-token-1" in "CLAUDE_CODE_OAUTH_TOKEN" and "x-team: blue" in "ANTHROPIC_CUSTOM_HEADERS"',
    async () => {
      // "sub-token-1" stands for a token of `claude setup-token`; it is no credential.
      client = await connect(sut, gateway, {
        env: {
          ANTHROPIC_API_KEY: "sk-run-1",
          CLAUDE_CODE_OAUTH_TOKEN: "sub-token-1",
          ANTHROPIC_CUSTOM_HEADERS: "x-team: blue",
        },
      });
    },
  );

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  const promptCall = () =>
    gateway.calls.find((call) => call.path.startsWith("/v1/messages") && call.body.includes("fix the typo"));

  await then('the gateway\'s Messages API call has the header "authorization" "Bearer sub-token-1"', async () => {
    expect(promptCall()?.headers.authorization).toBe("Bearer sub-token-1");
  });

  await then('it has the header "x-litellm-api-key" "Bearer sk-run-1" and no header "x-api-key"', async () => {
    expect(promptCall()?.headers["x-litellm-api-key"]).toBe("Bearer sk-run-1");
    expect(promptCall()?.headers).not.toHaveProperty("x-api-key");
  });

  await then('it still has the header "x-team" "blue"', async () => {
    expect(promptCall()?.headers["x-team"]).toBe("blue");
  });
});
