// The demo module of the fakes.openbao scenarios: its CLI writes "demo" with the value "bao_test_1" to the mount
// DEMO_BAO_MOUNT of OpenBao at DEMO_BAO_ADDR with the token DEMO_BAO_TOKEN, and prints the status and the token's ttl.

/** The CLI, plain JavaScript; its output is `<status> <ttl>`. */
export const BAO_CLI = [
  "const { DEMO_BAO_ADDR: addr, DEMO_BAO_TOKEN: token, DEMO_BAO_MOUNT: mount } = process.env;",
  'const headers = { "x-vault-token": token };',
  "const body = JSON.stringify({ data: { value: 'bao_test_1' } });",
  'const written = await fetch(`${addr}/v1/${mount}/data/demo`, { method: "POST", headers, body });',
  "const self = await (await fetch(`${addr}/v1/auth/token/lookup-self`, { headers })).json();",
  "process.stdout.write(`${written.status} ${self.data.ttl}`);",
  "",
].join("\n");

export const BAO_README = [
  "# demo",
  "",
  "## Configuration",
  "",
  "| Variable | Meaning |",
  "| --- | --- |",
  "| `DEMO_BAO_ADDR` | OpenBao's address. |",
  "| `DEMO_BAO_TOKEN` | OpenBao token. |",
  "| `DEMO_BAO_MOUNT` | KV version 2 mount. |",
  "",
].join("\n");

/** Lines of a demo test: runs the CLI with the address, the mount and the token `token` of the fake `bao`. */
export const RUN_BAO = [
  "let run: Awaited<ReturnType<typeof sut.cli>>;",
  "await when('the user runs \"demo\"', async () => {",
  "  run = await sut.cli([], { env: { DEMO_BAO_ADDR: bao.url, DEMO_BAO_MOUNT: bao.mount, DEMO_BAO_TOKEN: token } });",
  "});",
];
