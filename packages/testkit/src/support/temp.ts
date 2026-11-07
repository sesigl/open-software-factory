// Temporary folders of the testkit, below the real path of the system's temporary folder.
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A new folder `<prefix>XXXXXX` below the real path of the temporary folder. On macOS `/tmp` is a link to
 * `/private/tmp`: a process reports the real path, and the VM of Rancher Desktop shares `/private/tmp` with its
 * containers, not `/tmp`.
 */
export function tempFolder(prefix: string): string {
  return mkdtempSync(join(realpathSync(tmpdir()), prefix));
}
