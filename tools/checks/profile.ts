// PROFILE: the Compose profile, the Helm chart and the CI pulls of their images stay in step (ADR 0095).
// - compose.yaml, values.yaml and Chart.yaml are as `osf profile-pins` writes them: each package at the workspace's
//   version, each module image at the tag of its packages, the chart's tags equal to the profile's.
// - A module image's tag is the version of its own package, or that version with `-r<n>`.
// - Compared with OSF_BASE: an image whose packages changed has a new tag, and a changed chart has a new version.
// - Compared with OSF_BASE: an image whose stage of deploy/images/Dockerfile changed, or a stage or global ARG it builds
//   on, has a new tag. Comments do not count. Else the publish keeps the old image under the tag, which never changes.
// - Each image of the chart is an image of the profile, pulled or built.
// - The `pull` list of a suite in .github/test-suites.yml holds each image of the Compose files its tests start; any
//   other entry, like the base of a Dockerfile or an image that code starts, is named in a file of the suite's packages
//   or of the workspace packages they depend on. The testkit does not count: a suite names its fakes in `images`.
import { statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { parse } from "yaml";
import type { Context } from "./lib/context.ts";
import { changedFiles, showAt } from "./lib/git.ts";
import { CHART, COMPOSE, pins, services, VALUES } from "./lib/profile.ts";
import type { Finding, Repo } from "./lib/repo.ts";
import { type Unit, workspace } from "./lib/workspace.ts";

const ID = "PROFILE";
const SUITES = ".github/test-suites.yml";
const TESTKIT = "@opensoftware/testkit";
const TAG = /^(\d+\.\d+\.\d+)(?:-r\d+)?$/;

const finding = (file: string, line: number, message: string): Finding => ({ check: ID, file, line, message });

export function profile(context: Context): Finding[] {
  const { repo } = context;
  if (!repo.exists(COMPOSE)) return [];
  return [
    ...written(repo),
    ...ownTags(repo),
    ...chartImages(repo),
    ...moved(context),
    ...rebuilt(context),
    ...pulls(repo),
  ];
}

/** Each line that `osf profile-pins` would change. */
function written(repo: Repo): Finding[] {
  return pins(repo).files.flatMap(([file, text]) => {
    if (!repo.exists(file)) return [];
    const now = repo.read(file).split("\n");
    return text
      .split("\n")
      .flatMap((line, index) =>
        line === now[index]
          ? []
          : [finding(file, index + 1, `is not the released pin; osf profile-pins writes "${line.trim()}"`)],
      );
  });
}

/** A module image's tag is the version of its own package in it. */
function ownTags(repo: Repo): Finding[] {
  return services(repo.read(COMPOSE)).flatMap((service) => {
    if (!service.image) return [];
    const { module, tag } = service.image;
    const own = service.packages.get(module);
    if (!own || TAG.exec(tag)?.[1] === own) return [];
    const message = `the image ${module}:${tag} installs @opensoftware/${module}@${own}: its tag must be ${own} or ${own}-r<n>`;
    return [finding(COMPOSE, service.line, message)];
  });
}

/** The images that the chart's values name, like postgres.image, are images of the profile, also one it builds. */
function chartImages(repo: Repo): Finding[] {
  if (!repo.exists(VALUES)) return [];
  const profile = new Set(imagesOf(repo.read(COMPOSE), true));
  return repo
    .read(VALUES)
    .split("\n")
    .flatMap((line, index) => {
      const image = /^\s+[a-zA-Z]*[iI]mage: "?([^"\s]+)"?$/.exec(line)?.[1];
      if (!image || profile.has(image)) return [];
      return [finding(VALUES, index + 1, `the image ${image} is not an image of ${COMPOSE}`)];
    });
}

/** Compared with the base: new packages need a new image tag, a changed chart a new version. */
function moved(context: Context): Finding[] {
  const { repo } = context;
  const base = context.base(ID);
  if (!base) return [];
  const findings: Finding[] = [];
  const before = new Map(services(showAt(repo.root, base, COMPOSE) ?? "").map((service) => [service.name, service]));
  for (const service of services(repo.read(COMPOSE))) {
    const old = before.get(service.name);
    if (!service.image || !old?.image || service.packages.size === 0) continue;
    const same = service.packages.size === old.packages.size;
    const changed = !same || [...service.packages].some(([name, version]) => old.packages.get(name) !== version);
    if (changed && service.image.tag === old.image.tag) {
      const message = `the packages of the image ${service.image.module} changed, so its tag ${service.image.tag} must change too`;
      findings.push(finding(COMPOSE, service.line, message));
    }
  }
  const chart = changedFiles(repo.root, base).filter((file) => file.startsWith(`${dirname(CHART)}/`));
  const version = (text: string | undefined) => /^version: (\S+)$/m.exec(text ?? "")?.[1];
  if (chart.length > 0 && version(repo.read(CHART)) === version(showAt(repo.root, base, CHART))) {
    findings.push(finding(CHART, 1, `${chart.join(", ")} changed, so the chart's version must change too`));
  }
  return findings;
}

const DOCKERFILE = "deploy/images/Dockerfile";

/** The text of each stage of a Dockerfile without comments, with the global ARGs and the stages it builds on. */
function stages(text: string): Map<string, { text: string; on: string[] }> {
  const found = new Map<string, { text: string; on: string[] }>();
  let global = "";
  let current: { name: string; lines: string[]; on: string[] } | undefined;
  const close = () => current && found.set(current.name, { text: current.lines.join("\n"), on: current.on });
  for (const line of text.split("\n").filter((entry) => entry.trim() && !entry.trim().startsWith("#"))) {
    const from = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from) {
      close();
      current = { name: from[2] ?? from[1] ?? "", lines: [line], on: [from[1] ?? ""] };
    } else if (current) {
      current.lines.push(line);
      current.on.push(...[...line.matchAll(/--from=(\S+)/g)].map((copy) => copy[1] as string));
    } else {
      global += `${line}\n`;
    }
  }
  close();
  for (const stage of found.values()) stage.on.push("");
  found.set("", { text: global, on: [] });
  return found;
}

/** Each image whose stage changed since the base has a new tag. */
function rebuilt(context: Context): Finding[] {
  const { repo } = context;
  const base = context.base(ID);
  if (!base || !repo.exists(DOCKERFILE)) return [];
  const now = stages(repo.read(DOCKERFILE));
  const before = stages(showAt(repo.root, base, DOCKERFILE) ?? "");
  const changed = (name: string, seen = new Set<string>()): boolean => {
    const stage = now.get(name);
    if (!stage || seen.has(name)) return false;
    seen.add(name);
    return before.get(name)?.text !== stage.text || stage.on.some((on) => changed(on, seen));
  };
  const old = new Map(services(showAt(repo.root, base, COMPOSE) ?? "").map((service) => [service.name, service]));
  return services(repo.read(COMPOSE)).flatMap((service) => {
    const target = /^\s+target: (\S+)$/m.exec(service.text)?.[1];
    const tag = old.get(service.name)?.image?.tag;
    if (!service.image || !target || !tag || service.image.tag !== tag || !changed(target)) return [];
    const message = `the stage ${target} of ${DOCKERFILE} changed, so the tag ${tag} of the image ${service.image.module} must change too`;
    return [finding(COMPOSE, service.line, message)];
  });
}

/** The images of a Compose file that it does not build itself, or with `built` all of them. */
function imagesOf(compose: string, built = false): string[] {
  const parsed = (parse(compose, { logLevel: "error" }) ?? {}) as {
    services?: Record<string, { image?: string; build?: unknown }>;
  };
  return Object.values(parsed.services ?? {}).flatMap((service) =>
    service.image && (built || !service.build) ? [service.image] : [],
  );
}

/** What starting a Compose file pulls: its images and those of the files it includes. */
function pulledBy(repo: Repo, file: string, seen = new Set<string>()): string[] {
  if (seen.has(file) || !repo.exists(file)) return [];
  seen.add(file);
  const text = repo.read(file);
  const parsed = (parse(text, { logLevel: "error" }) ?? {}) as { include?: (string | { path?: string | string[] })[] };
  const included = (parsed.include ?? []).flatMap((entry) => {
    const paths = typeof entry === "string" ? [entry] : [entry.path ?? []].flat();
    return paths.flatMap((path) => pulledBy(repo, normalize(join(dirname(file), path)), seen));
  });
  return [...imagesOf(text), ...included];
}

/** Each suite pulls what its Compose files need, and nothing that its packages do not name. */
function pulls(repo: Repo): Finding[] {
  if (!repo.exists(SUITES)) return [];
  const text = repo.read(SUITES);
  const all = workspace(repo);
  const units = all.filter((unit) => unit.tested);
  const plain = (image: string) => image.replace(/@sha256:[0-9a-f]+$/, "");
  return ((parse(text) ?? []) as { suite?: string; filter?: string; pull?: string }[]).flatMap((suite) => {
    const parts = (suite.filter ?? "").split(/\s+/).filter(Boolean);
    const only = parts.filter((part) => !part.startsWith("!"));
    const not = new Set(parts.filter((part) => part.startsWith("!")).map((part) => part.slice(1)));
    const mine = units.filter((unit) => (only.length > 0 ? only.includes(unit.name) : !not.has(unit.name)));
    const tests = mine.flatMap((unit) => repo.match(`${unit.dir}/system-tests/**/*`)).map((file) => repo.read(file));
    const used = (unit: Unit) => unit.name !== TESTKIT && mine.some((own) => own.declared.has(unit.name));
    const named = [...mine, ...all.filter(used)];
    const regular = (file: string) => statSync(join(repo.root, file)).isFile();
    const files = named.flatMap((unit) => repo.match(`${unit.dir}/**`)).filter(regular);
    const sources = files.map((file) => repo.read(file)).join("\n");
    const composes = [...tests.join("\n").matchAll(/sut\.compose\("([^"]+)"\)/g)].flatMap((call) =>
      mine.map((unit) => normalize(join(unit.dir, call[1] as string))).filter((file) => repo.exists(file)),
    );
    const needed = new Set(composes.flatMap((file) => pulledBy(repo, file)).map(plain));
    const pulled = (suite.pull ?? "").split(/\s+/).filter(Boolean);
    const line = text.split("\n").findIndex((entry) => entry.includes(`suite: ${suite.suite}`)) + 1;
    const findings: Finding[] = [];
    for (const image of needed) {
      if (!pulled.includes(image)) {
        findings.push(finding(SUITES, line, `the suite ${suite.suite} starts the image ${image} but does not pull it`));
      }
    }
    for (const image of pulled) {
      if (!needed.has(image) && !sources.includes(image)) {
        findings.push(
          finding(SUITES, line, `the suite ${suite.suite} pulls ${image}, which none of its packages names`),
        );
      }
    }
    return findings;
  });
}
