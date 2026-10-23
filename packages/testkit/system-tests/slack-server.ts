// A demo server for the fake Slack scenarios: it checks Slack's signature on every POST and keeps what it got.
import { demoModule } from "./module.ts";

/** The server's source: POST /events and /actions with a valid signature are kept, GET /kept lists them. */
export const SIGNED_SERVER = [
  'import { createHmac } from "node:crypto";',
  'import { createServer } from "node:http";',
  "const kept = [];",
  "const signed = (request, body) => {",
  '  const base = `v0:${request.headers["x-slack-request-timestamp"]}:${body}`;',
  '  const mac = createHmac("sha256", process.env.DEMO_SLACK_SIGNING_SECRET).update(base).digest("hex");',
  '  return request.headers["x-slack-signature"] === `v0=${mac}`;',
  "};",
  "createServer(async (request, response) => {",
  '  let body = "";',
  "  for await (const chunk of request) body += chunk;",
  '  if (request.method === "GET") {',
  '    response.writeHead(200, { "content-type": "application/json" });',
  "    return response.end(JSON.stringify(kept));",
  "  }",
  "  if (!signed(request, body)) return response.writeHead(401).end();",
  '  if (request.url === "/events") kept.push(JSON.parse(body).event.text);',
  '  if (request.url === "/actions") {',
  '    const payload = JSON.parse(new URLSearchParams(body).get("payload"));',
  "    kept.push(`${payload.actions[0].action_id} ${payload.user.id}`);",
  "  }",
  "  response.writeHead(200).end();",
  '}).listen(Number(process.env.PORT), "127.0.0.1");',
  "",
];

export const SIGNED_README = [
  "# demo",
  "",
  "## Configuration",
  "",
  "| Variable | Meaning |",
  "| --- | --- |",
  "| `PORT` | Port the server listens on. |",
  "| `DEMO_SLACK_SIGNING_SECRET` | Slack signing secret. |",
  "",
].join("\n");

/**
 * Module demo whose server posts "Approve?" with the button "approve" to "C1" when it starts; its test presses
 * `actionId` as "U0ADA" and expects the server to have kept "approve U0ADA".
 */
export function buttonModule(actionId: string): Record<string, string> {
  const post = [
    'const blocks = [{ type: "actions", elements: [{ type: "button", action_id: "approve", text: { type: "plain_text", text: "Approve" } }] }];',
    "await fetch(`${process.env.DEMO_SLACK_URL}chat.postMessage`, {",
    '  method: "POST",',
    '  headers: { authorization: `Bearer ${process.env.DEMO_SLACK_TOKEN}`, "content-type": "application/json" },',
    '  body: JSON.stringify({ channel: "C1", text: "Approve?", blocks }),',
    "});",
  ];
  return demoModule({
    bin: [...SIGNED_SERVER, ...post, ""].join("\n"),
    readme: SIGNED_README.replace(
      "| `PORT` |",
      "| `DEMO_SLACK_URL` | Slack Web API base URL. |\n| `DEMO_SLACK_TOKEN` | Slack bot token. |\n| `PORT` |",
    ),
    steps: [`When "U0ADA" presses "${actionId}" in "C1"`, 'Then the server has "approve U0ADA"'],
    test: [
      "const slack = await fakes.slack();",
      "const env = { DEMO_SLACK_SIGNING_SECRET: slack.signingSecret, DEMO_SLACK_URL: slack.url, DEMO_SLACK_TOKEN: slack.token };",
      "const url = await sut.http.start([], { env });",
      "slack.deliverTo(`${url}/events`, `${url}/actions`);",
      `await when('"U0ADA" presses "${actionId}" in "C1"', async () => {`,
      '  await expect.poll(() => slack.messages("C1").length).toBe(1);',
      '  const [message] = slack.messages("C1");',
      `  await slack.press({ channel: "C1", ts: message.ts, actionId: "${actionId}", user: "U0ADA" });`,
      "});",
      "await then('the server has \"approve U0ADA\"', async () => {",
      '  expect((await sut.http.get("/kept")).body).toEqual(["approve U0ADA"]);',
      "});",
    ],
  });
}
