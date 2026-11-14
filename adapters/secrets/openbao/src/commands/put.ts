// put <name> --by <person>: stores the value on standard input as a new version, then names the person in the
// secret's metadata. The value is never an argument or a variable (ADR 0137).
import { text } from "node:stream/consumers";
import { check, type Outcome } from "@opensoftware/cli";
import { openBao } from "../adapters/openbao.ts";
import { mayNot, noMount, secretName } from "../domain/names.ts";

export async function put(name: string | undefined, by: string | undefined): Promise<Outcome> {
  const secret = secretName(name);
  check(by, `name the person of the change, like put ${secret} --by ada`);
  const value = (await text(process.stdin)).replace(/\n$/, "");
  check(value, "put reads the value from standard input, and it was empty");
  const bao = openBao();
  const refused = mayNot("write", secret);
  const written = await bao.call<{ data: { version: number } }>("POST", `${bao.mount}/data/${secret}`, refused, {
    data: { value },
  });
  // A mount of another kind, such as KV version 1, answers without a version.
  const version = written?.data.version;
  if (version === undefined) throw new Error(noMount(bao.mount));
  await bao.call("POST", `${bao.mount}/metadata/${secret}`, refused, { custom_metadata: { changed_by: by } });
  return { lines: [JSON.stringify({ name: secret, version })] };
}
