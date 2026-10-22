// A record that gatekeeper status wrote for the README request, approved by slack:U0ADA, in $INPUT/record.json, and
// the key pair of gatekeeper keys in $INPUT.
import type { Fakes, Sut } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

export async function signedRecord(sut: Sut, fakes: Fakes, signed: boolean) {
  const keys = await sut.cli(["keys", "--out", "."]);
  expect(keys.exitCode, keys.stderr).toBe(0);
  const setup = await requested(sut, fakes);
  await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0ADA", threadTs: setup.message.ts });
  const key = await sut.files.read("$INPUT/gatekeeper.pem");
  const env = signed ? { ...setup.env, GATEKEEPER_SIGNING_KEY: key } : setup.env;
  const status = await sut.cli(["status", ...GATE, "--record", "record.json"], { env });
  expect(status.exitCode, status.stderr).toBe(0);
  return status;
}
