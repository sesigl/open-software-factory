// The path of the scripted ACP agent of fakes.harness(), next to this file in the source tree and in the built package
// alike. A template of sandboxes copies it, with the ACP SDK next to it (ADR 0096).
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESS_AGENT = fileURLToPath(
  new URL(`./harness-agent${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
);
