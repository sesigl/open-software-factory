// A secret's name, as the pattern of SecretReference in contracts/typespec/factory-definition.tsp allows it after
// "ref:openbao/", in folders split by "/". No folder is empty, "." or "..", so a name stays inside the mount: OpenBao's
// paths would read "a/../sys" as "sys".
import { check } from "@opensoftware/cli";

const FOLDER = /^[A-Za-z0-9_.-]+$/;

/** The name, or a usage error. */
export function secretName(name: string | undefined): string {
  const folders = (name ?? "").split("/");
  check(
    folders.every((folder) => FOLDER.test(folder) && folder !== "." && folder !== ".."),
    "name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token",
  );
  return name as string;
}

// OpenBao refuses a value of custom_metadata over 512 bytes or with a control character, after put stored the value. 128
// characters of up to 4 bytes each stay below that and hold an email address or a login.
const PERSON = /^[^\p{Cc}]{1,128}$/u;

/** The person of a change, or a usage error before put calls the store. */
export function personName(by: string | undefined, secret: string): string {
  check(by, `name the person of the change, like put ${secret} --by ada`);
  check(
    PERSON.test(by),
    "name the person in at most 128 characters, without a line break or another control character",
  );
  return by;
}

/** The error of a token without the right. */
export const mayNot = (what: "write" | "delete", name: string): string => `the token may not ${what} "${name}"`;
export const MAY_NOT_LIST = "the token may not list the secrets";

/** The error of a mount that does not exist, is no KV version 2 mount, or that the token may not use. */
export const noMount = (mount: string): string => `OpenBao has no KV version 2 mount "${mount}" that the token may use`;
