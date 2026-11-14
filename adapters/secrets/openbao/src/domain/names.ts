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

/** The error of a token without the right. */
export const mayNot = (what: "write" | "delete", name: string): string => `the token may not ${what} "${name}"`;
export const MAY_NOT_LIST = "the token may not list the secrets";

/** The error of a mount that does not exist, is no KV version 2 mount, or that the token may not use. */
export const noMount = (mount: string): string => `OpenBao has no KV version 2 mount "${mount}" that the token may use`;
