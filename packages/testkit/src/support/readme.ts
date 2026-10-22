// What a module's README documents: the sections the testkit and the checks read.

/** The text of the section `## <heading>` up to the next `## `, or "" when the README has none. */
export function readmeSection(readme: string, heading: string): string {
  return readme.split(/^## /m).find((part) => part.startsWith(heading)) ?? "";
}

/** The environment variables named in backticks in the Configuration section. */
export function documentedEnv(readme: string): Set<string> {
  const names = readmeSection(readme, "Configuration").matchAll(/`([A-Z_][A-Z0-9_]*)`/g);
  return new Set([...names].map((match) => match[1] as string));
}
