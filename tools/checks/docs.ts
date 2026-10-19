// DOCS-GEN, DOCS-AFFECTED, DOCS-LINKS and ADR.
import { spawnSync } from "node:child_process";
import { posix } from "node:path";
import picomatch from "picomatch";
import { parse as parseYaml } from "yaml";
import { refreshDocs } from "../scaffold/docs.ts";
import type { Context } from "./lib/context.ts";
import { changedFiles, showAt } from "./lib/git.ts";
import { type Finding, lineOf } from "./lib/repo.ts";
import { findTool } from "./lib/tools.ts";

export function docsGen(context: Context): Finding[] {
  return refreshDocs(context.repo.root, { write: false }).map((section) => ({
    check: "DOCS-GEN",
    file: section.file,
    line: section.line,
    message: `the section generated from ${section.source} is out of date: run make docs`,
  }));
}

export function frontMatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return {};
  try {
    return (parseYaml(match[1] as string) as Record<string, unknown> | null) ?? {};
  } catch {
    return {};
  }
}

export function docsAffected(context: Context): Finding[] {
  const base = context.base("DOCS-AFFECTED");
  if (!base) return [];
  const { repo } = context;
  const changed = changedFiles(repo.root, base);
  const body =
    process.env.OSF_PR_BODY && repo.exists(process.env.OSF_PR_BODY) ? repo.read(process.env.OSF_PR_BODY) : "";
  const reviewed = new Set([...body.matchAll(/^\s*docs-reviewed:\s*(\S+)/gm)].map((match) => match[1] as string));
  const findings: Finding[] = [];

  for (const doc of repo.match("**/*.md")) {
    const covers = frontMatter(repo.read(doc)).covers;
    if (!Array.isArray(covers) || covers.length === 0) continue;
    const isCovered = picomatch(covers.map(String), { dot: true });
    const touched = changed.filter((file) => file !== doc && isCovered(file));
    if (touched.length === 0) continue;
    const shown = touched.slice(0, 3).join(", ") + (touched.length > 3 ? ` and ${touched.length - 3} more` : "");
    if (changed.includes(doc) || reviewed.has(doc)) {
      if (context.list)
        context.notes.push(`${doc}: ${changed.includes(doc) ? "updated" : "marked reviewed"} (${shown})`);
      continue;
    }
    findings.push({
      check: "DOCS-AFFECTED",
      file: doc,
      line: 1,
      message: `covers changed paths (${shown}): update it, or add "docs-reviewed: ${doc}" to the pull request`,
    });
  }
  return findings;
}

export function docsLinks(context: Context): Finding[] {
  const { repo } = context;
  const docs = repo.match("**/*.md");
  if (docs.length === 0) return [];
  const lychee = findTool("lychee");
  if (!lychee) return [{ check: "DOCS-LINKS", message: "lychee is not installed: run make tools" }];
  const run = spawnSync(
    lychee,
    ["--offline", "--include-fragments", "--no-progress", "--format", "json", "--root-dir", repo.root, ...docs],
    { cwd: repo.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  let report: { error_map?: Record<string, { url: string; status: { text: string } }[]> };
  try {
    report = JSON.parse(run.stdout);
  } catch {
    return [{ check: "DOCS-LINKS", message: `lychee failed: ${run.stderr.trim()}` }];
  }
  const findings: Finding[] = [];
  for (const [doc, errors] of Object.entries(report.error_map ?? {})) {
    const text = repo.read(doc);
    for (const { url, status } of errors) {
      const target = decodeURIComponent(url.replace(/^file:\/\//, ""));
      const relativeTarget = target.startsWith(repo.root)
        ? posix.relative(posix.dirname(posix.join(repo.root, doc)), target)
        : target;
      const [path = "", fragment] = relativeTarget.split("#");
      const sameFile = path === posix.basename(doc);
      const needle = sameFile && fragment ? `(#${fragment}` : `(${relativeTarget}`;
      const line = text.includes(needle) ? lineOf(text, needle) : lineOf(text, posix.basename(path));
      findings.push({ check: "DOCS-LINKS", file: doc, line, message: `${status.text}: ${relativeTarget}` });
    }
  }
  return findings;
}

const ADR_STATUS = /^(proposed|accepted|rejected|deprecated|superseded by \d{4})$/;
const TEMPLATE_PRIOR_ART = "Required for every new module";

interface Adr {
  file: string;
  status: string;
  text: string;
  priorArt: string | undefined;
}

export function adr(context: Context): Finding[] {
  const { repo } = context;
  const findings: Finding[] = [];
  const adrs: Adr[] = [];

  for (const file of repo.match("docs/decisions/[0-9][0-9][0-9][0-9]-*.md")) {
    const text = repo.read(file);
    const meta = frontMatter(text);
    const at = (message: string, needle?: string): void => {
      findings.push({ check: "ADR", file, line: needle ? lineOf(text, needle) : 1, message });
    };
    const status = String(meta.status ?? "").trim();
    if (!ADR_STATUS.test(status))
      at(`status "${status}" is not proposed, accepted, rejected, deprecated or superseded by NNNN`);
    if (!meta.date) at("front matter needs a date");
    const number = posix.basename(file).slice(0, 4);
    if (!new RegExp(`^# ${number}\\. `, "m").test(text)) at(`the title must start with "# ${number}. "`);
    if (!/^## Decision\s*$/m.test(text)) at("needs a ## Decision section");
    const priorArt = section(text, "Prior art");
    if (priorArt !== undefined && (priorArt === "" || priorArt.includes(TEMPLATE_PRIOR_ART))) {
      at("the Prior art section is empty: name the projects you checked", "## Prior art");
    }
    adrs.push({ file, status, text, priorArt });
  }

  const justified = (name: string): boolean =>
    adrs.some(
      (entry) =>
        entry.status === "accepted" &&
        entry.priorArt !== undefined &&
        entry.priorArt !== "" &&
        !entry.priorArt.includes(TEMPLATE_PRIOR_ART) &&
        mentions(entry.text, name),
    );

  // Every module, port and adapter has an accepted ADR.
  const units = new Set(
    repo.match("modules/*/**", "ports/*/**", "adapters/*/*/**").map((file) =>
      file
        .split("/")
        .slice(0, file.startsWith("adapters/") ? 3 : 2)
        .join("/"),
    ),
  );
  for (const unit of [...units].sort()) {
    if (!justified(unit)) {
      findings.push({
        check: "ADR",
        file: unit,
        line: 1,
        message: `${unit} needs an accepted ADR with Prior art that names "${unit}"`,
      });
    }
  }

  // Every new dependency since the base has an accepted ADR.
  const base = context.base("ADR");
  if (base) {
    for (const manifest of repo.match("**/package.json", "**/pyproject.toml")) {
      const before = showAt(repo.root, base, manifest);
      const text = repo.read(manifest);
      const old = new Set(before === undefined ? [] : dependencies(manifest, before));
      for (const name of dependencies(manifest, text)) {
        if (old.has(name) || justified(name)) continue;
        findings.push({
          check: "ADR",
          file: manifest,
          line: lineOf(text, manifest.endsWith(".json") ? `"${name}"` : name),
          message: `the new dependency ${name} needs an accepted ADR with Prior art that names it`,
        });
      }
    }
  }
  return findings;
}

function section(text: string, title: string): string | undefined {
  const parts = text.split(/^## /m);
  const found = parts.find((part) => part.startsWith(`${title}\n`) || part.startsWith(`${title}\r\n`));
  return found === undefined ? undefined : found.slice(title.length).trim();
}

function mentions(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s\`(/])${escaped}($|[\\s\`),.;:/])`, "m").test(text);
}

/** External dependencies of a manifest; workspace packages (`@osf/*`, `osf-*`, `workspace:`) are not counted. */
function dependencies(manifest: string, text: string): string[] {
  const names: string[] = [];
  if (manifest.endsWith(".json")) {
    let json: Record<string, Record<string, string> | undefined>;
    try {
      json = JSON.parse(text);
    } catch {
      return [];
    }
    for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, version] of Object.entries(json[key] ?? {})) {
        if (!name.startsWith("@osf/") && !String(version).startsWith("workspace:")) names.push(name);
      }
    }
  } else {
    // Requirement strings inside dependencies = [...], optional-dependencies and dependency-groups.
    const blocks = text.match(/^(?:dependencies|[\w-]+)\s*=\s*\[[^\]]*\]/gm) ?? [];
    const inSections = text
      .split(/^\[/m)
      .filter((part) => /^(project|project\.optional-dependencies|dependency-groups)\]/.test(part));
    for (const part of inSections) {
      for (const block of blocks.filter((candidate) => part.includes(candidate))) {
        for (const match of block.matchAll(/["']([A-Za-z0-9][A-Za-z0-9._-]*)/g)) {
          const name = (match[1] as string).toLowerCase();
          if (!name.startsWith("osf-")) names.push(name);
        }
      }
    }
  }
  return [...new Set(names)];
}
