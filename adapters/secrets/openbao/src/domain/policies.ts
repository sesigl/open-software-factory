// The two policies of a factory's mount (ADR 0137), in OpenBao's policy language. The console's token writes and
// deletes values and reads names and metadata, and OpenBao refuses it a value; the egress proxy's token only reads.
// A token also needs OpenBao's policy "default", which every token gets unless it is made without it: it lets a token
// read how long it still lives (`probe`).
import { check } from "@opensoftware/cli";

const path = (pattern: string, capabilities: string[]) =>
  `path "${pattern}" {\n  capabilities = [${capabilities.map((name) => `"${name}"`).join(", ")}]\n}`;

const POLICIES = new Map<string | undefined, (mount: string) => string[]>([
  [
    "write",
    (mount) => [
      `# The console's token for the mount "${mount}": it writes, lists and deletes secrets, and cannot read a value.`,
      path(`${mount}/data/*`, ["create", "update"]),
      path(`${mount}/metadata/*`, ["read", "list", "update", "delete"]),
    ],
  ],
  [
    "read",
    (mount) => [
      `# The egress proxy's token for the mount "${mount}": it reads each secret and its metadata, and nothing else.`,
      path(`${mount}/data/*`, ["read"]),
      path(`${mount}/metadata/*`, ["read"]),
    ],
  ],
]);

/** The lines of the policy `write` or `read` for the mount, or a usage error. */
export function policyLines(which: string | undefined, mount: string): string[] {
  const policy = POLICIES.get(which);
  check(policy, "name the policy, like policy write or policy read");
  return policy(mount);
}
