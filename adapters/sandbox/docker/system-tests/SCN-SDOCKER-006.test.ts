import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

// busybox's nc answers one request per loop; nohup keeps it running after exec returns.
const SERVER =
  "nohup sh -c 'while true; do printf \"HTTP/1.0 200 OK\\r\\nContent-Length: 5\\r\\n\\r\\nhello\" | nc -l -p 8080; done' >/dev/null 2>&1 &";
// The server answers in its own sandbox before the step ends: on a slow runner, nc listened only after the request.
const ANSWERS =
  'i=0; until [ "$(curl -s --noproxy "*" --max-time 1 http://127.0.0.1:8080/)" = hello ]; do i=$((i+1)); [ $i -lt 50 ] || exit 1; sleep 0.1; done';

scenario("SCN-SDOCKER-006", async ({ sut, given, when, then }) => {
  const servers = sandboxes(sut);
  let host = "";
  let box = sandboxes(sut);
  try {
    await given('a sandbox "server" whose container answers "hello" on port 8080', async () => {
      const id = await servers.create({ template: TEMPLATE });
      const started = await servers.sh(id, SERVER);
      expect(started.exitCode, started.stderr).toBe(0);
      const answers = await servers.sh(id, ANSWERS);
      expect(answers.exitCode, "the server did not answer on port 8080 within 5 seconds").toBe(0);
      // Each sandbox's container and its network are named osf-sandbox-<ID> (README, "No state of its own").
      host = `osf-sandbox-${id}`;
    });

    let id = "";
    await given(
      'a second sandbox created with "OSF_SANDBOX_NETWORK" set to the network of "server" and the egress allowlist that names the container of "server"',
      async () => {
        box = sandboxes(sut, { OSF_SANDBOX_NETWORK: host });
        id = await box.create({ template: TEMPLATE, egress: [host] });
      },
    );

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "curl http://<container of server>:8080/" in the second sandbox', async () => {
      // nc serves one request per loop: a request between two loops meets no listener, and the proxy answers 502, which
      // curl retries (run 43586767158).
      run = await box.sh(id, `curl -s --max-time 10 --retry 5 --retry-delay 1 http://${host}:8080/`);
    });

    await then('the request gets the answer "hello"', async () => {
      expect(run.stdout, run.stderr).toBe("hello");
    });
  } finally {
    await box.destroyAll();
    await servers.destroyAll();
  }
});
