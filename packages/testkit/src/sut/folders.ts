// The folders of a scenario's workspace, or of a shared start's: $INPUT, $OUTPUT, the module's data and NOREAL's log.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface Folders {
  input: string;
  output: string;
  /** The module's private data folder, `OSF_DATA`. The test has no path into it. */
  data: string;
  /** Where the network guard logs refused connections. */
  noreal: string;
}

/** The folders of a workspace that exist already. */
export function foldersOf(workspace: string): Folders {
  return {
    input: join(workspace, "input"),
    output: join(workspace, "output"),
    data: join(workspace, "data"),
    noreal: join(workspace, "noreal.log"),
  };
}

/** Makes the folders of a new workspace. */
export function folders(workspace: string): Folders {
  const dirs = foldersOf(workspace);
  mkdirSync(dirs.input);
  mkdirSync(dirs.output);
  mkdirSync(dirs.data);
  return dirs;
}
