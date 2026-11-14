// The npm registry, read only by "factory plan --adapters" to pin an adapter's package (ADR 0125).

/** The base URL of the npm registry: FACTORY_NPM_REGISTRY, or the public registry. */
function npmUrl(): string {
  return (process.env.FACTORY_NPM_REGISTRY ?? "https://registry.npmjs.org").replace(/\/$/, "");
}

/** Every published version of a package, from its packument; a scoped name keeps its "@" and encodes its "/". */
export async function packageVersions(name: string): Promise<string[]> {
  const url = `${npmUrl()}/${name.replace("/", "%2f")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the npm registry answered ${response.status} for ${url}`);
  const body = (await response.json()) as { versions: Record<string, unknown> };
  return Object.keys(body.versions);
}
