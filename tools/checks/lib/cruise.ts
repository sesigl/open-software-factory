// One run of dependency-cruiser for BOUNDARY-STATIC, ISOLATION and ARCH: the import graph of the system tests and of
// the source files of every unit, with the forbidden rules of BOUNDARY-STATIC and ISOLATION. The three checks read
// the same files; a run of `osf check` cruises them once.
import { posix } from "node:path";
import type { ICruiseResult, IForbiddenRuleType, IReporterOutput } from "dependency-cruiser";
import type { Context } from "./context.ts";
import type { Repo } from "./repo.ts";
import { SYSTEM_TEST_SOURCES } from "./tests.ts";

/** What every system test may import besides its own folder. */
const TEST_IMPORTS = [
  "^@opensoftware/(testkit|contracts)(/|$)",
  "^vitest(/|$)",
  "^packages/(testkit|contracts)/",
  "^contracts/",
  "(^|/)node_modules/(@opensoftware/(testkit|contracts)|vitest|@vitest)/",
];

/**
 * A system test imports only files in its own system-tests folder, @opensoftware/testkit, generated contract clients
 * (@opensoftware/contracts) and the test framework. The tests of a library in packages/ also import the library by
 * its package name, which resolves to its built entry point (ADR 0039). Workspace packages resolve to their folders.
 */
const BOUNDARY_RULES: IForbiddenRuleType[] = [
  {
    name: "BOUNDARY-STATIC",
    severity: "error",
    from: { path: "^(.+/system-tests)/", pathNot: "^packages/" },
    to: { pathNot: ["^$1/", ...TEST_IMPORTS] },
  },
  {
    name: "BOUNDARY-STATIC",
    severity: "error",
    from: { path: "^packages/([^/]+)/system-tests/" },
    to: {
      pathNot: [
        "^packages/$1/system-tests/",
        "^@opensoftware/$1$",
        "^packages/$1/dist/index\\.(js|d\\.ts)$",
        "(^|/)node_modules/@opensoftware/$1/dist/index\\.(js|d\\.ts)$",
        ...TEST_IMPORTS,
      ],
    },
  },
];

/** No module imports another module; adapters do not import other adapters; ports import no module or adapter. */
const ISOLATION_RULES: IForbiddenRuleType[] = [
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^modules/([^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/", pathNot: "^modules/$1/" },
  },
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^adapters/([^/]+/[^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/", pathNot: "^adapters/$1/" },
  },
  {
    name: "ISOLATION",
    severity: "error",
    from: { path: "^ports/([^/]+)/", pathNot: "/system-tests/" },
    to: { path: "^(modules|adapters)/" },
  },
];

/** Folders whose packages are units with their own architecture (ARCH). */
export const UNIT_MANIFESTS = ["modules/*/package.json", "packages/*/package.json", "adapters/*/*/package.json"];
/** The source files of a unit, relative to its folder (ARCH). */
export const UNIT_SOURCE = /^(src|bin)\/.+\.(ts|tsx|js|mjs|cjs)$/;

/** The files of BOUNDARY-STATIC: every file in a system-tests folder. */
export const testFiles = (repo: Repo): string[] => repo.match(...SYSTEM_TEST_SOURCES);

/** The files of ISOLATION: the files of modules, ports and adapters outside their system tests. */
export const isolatedFiles = (repo: Repo): string[] =>
  repo
    .match("{modules,ports}/*/**/*.{ts,tsx,js,mjs,cjs}", "adapters/*/*/**/*.{ts,tsx,js,mjs,cjs}")
    .filter((file) => !file.includes("/system-tests/") && !file.includes("/node_modules/"));

/** The files of ARCH: the source files of each unit, by its folder. */
export function unitSources(repo: Repo): Map<string, string[]> {
  const units = new Map<string, string[]>();
  for (const manifest of repo.match(...UNIT_MANIFESTS)) {
    const root = posix.dirname(manifest);
    const sources = repo
      .files()
      .filter((file) => file.startsWith(`${root}/`) && UNIT_SOURCE.test(file.slice(root.length + 1)));
    units.set(root, sources);
  }
  return units;
}

const cruises = new WeakMap<Context, Promise<ICruiseResult>>();

/** The import graph of the files of the three checks, with the violations of BOUNDARY-STATIC and ISOLATION. */
export function cruised(context: Context): Promise<ICruiseResult> {
  let result = cruises.get(context);
  if (!result) {
    result = cruiseAll(context);
    cruises.set(context, result);
  }
  return result;
}

async function cruiseAll(context: Context): Promise<ICruiseResult> {
  const { repo } = context;
  const files = [
    ...new Set([...testFiles(repo), ...isolatedFiles(repo), ...[...unitSources(repo).values()].flat()]),
  ].sort();
  if (files.length === 0) return { modules: [], summary: { violations: [] } } as unknown as ICruiseResult;
  // Loaded here: the other checks of the tests need no import graph.
  const { cruise } = await import("dependency-cruiser");
  const output = (await cruise(files, {
    baseDir: repo.root,
    validate: true,
    // Only the listed files, each with its own imports. maxDepth 1 skipped the imports of a listed file that
    // another listed file reached first.
    doNotFollow: { path: ".+" },
    tsPreCompilationDeps: true,
    ruleSet: { forbidden: [...BOUNDARY_RULES, ...ISOLATION_RULES] },
  })) as IReporterOutput;
  return output.output as ICruiseResult;
}
