// The session file the developer names.
import { readFileSync } from "node:fs";

/** The file's text; throws "cannot read <file>: <reason>". */
export function readSession(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${file}: ${(error as NodeJS.ErrnoException).code}`);
  }
}
