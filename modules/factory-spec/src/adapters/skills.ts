// The skills of other Git repositories (ADR 0146), fetched with @opensoftware/factory-source into skills/ of the state
// folder OSF_DATA: at a ref to pin one, or at the commit of its pin, whose hash the library checks.
import { join } from "node:path";
import { type Pin, type PinnedFolder, pinnedFolder } from "@opensoftware/factory-source";
import { stateFolder } from "./state.ts";

/** The folder of the entry `git+<url>#<ref>:<path>`, at its ref, or at `pin` when it has one. */
export function fetchSkill(entry: string, pin?: Pin): Promise<PinnedFolder> {
  const cache = join(stateFolder(), "skills");
  return pinnedFolder(entry, pin ? { cache, pin: { commit: pin.commit, hash: pin.hash } } : { cache });
}
