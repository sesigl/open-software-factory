// `osf protect-paths [EVENT_FILE]`: the PreToolUse guard behind tools/hooks/protect-paths.sh. It reads the hook
// event (from EVENT_FILE, else stdin) and exits 2 with a message on stderr to refuse an edit to a protected path.
// This is a fast local guard. The real guard is CI (CODEOWNERS and the SPECGUARD check), which applies to every
// harness and every author.
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

interface HookEvent {
  tool_name?: string;
  tool_input?: { file_path?: string; old_string?: string };
}

const PROTECTED = [/^contracts\//, /^docs\/quality\//, /^tools\/checks\//, /^\.github\/workflows\//, /^CODEOWNERS$/];
const FEATURE = /(^|\/)features\/[^/]+\.feature$/;
const IMPLEMENTED = "@status=implemented";

export function protectPaths(root: string, args: string[]): number {
  const event = JSON.parse(readFileSync(args[0] ?? 0, "utf8")) as HookEvent;
  const path = event.tool_input?.file_path;
  if (!path) return 0;
  const project = process.env.CLAUDE_PROJECT_DIR || root;
  const full = resolve(project, path);
  // Normalized, so "contracts/../tools/checks/x" is judged as "tools/checks/x".
  const rel = relative(project, full).split(sep).join("/");
  if (rel.startsWith("../") || rel === "..") return 0;
  if (approved(rel)) return 0;

  const refuse = (reason: string): number => {
    process.stderr.write(`Protected: ${rel}. ${reason} Ask a person (AGENTS.md, Hard rules).\n`);
    return 2;
  };
  if (PROTECTED.some((pattern) => pattern.test(rel))) {
    return refuse("This path changes the rules or the contracts.");
  }
  if (FEATURE.test(rel) && existsSync(full) && readFileSync(full, "utf8").includes(IMPLEMENTED)) {
    // New files and new planned scenarios are allowed. Rewriting a file with implemented scenarios, or an edit
    // that touches an implemented scenario, is not.
    if (event.tool_name === "Write") return refuse("The file contains implemented scenarios.");
    if (event.tool_input?.old_string?.includes(IMPLEMENTED)) return refuse("The edit touches an implemented scenario.");
  }
  return 0;
}

/** OSF_APPROVED_PATHS: comma-separated path prefixes a person approved when starting the session. */
function approved(rel: string): boolean {
  return (process.env.OSF_APPROVED_PATHS ?? "")
    .split(",")
    .map((prefix) => prefix.trim().replace(/^\.\//, "").replace(/\/+$/, ""))
    .filter((prefix) => prefix !== "" && prefix !== "." && !prefix.split("/").includes(".."))
    .some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}
