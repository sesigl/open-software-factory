// Tokens files and sources of the CONTRAST and TOKENS scenarios (ADR 0133).
type Sut = { files: { put(path: string, content: string): Promise<unknown> } };

/** A tokens file with these dark values and these light values, one per line from line 2 and after the light rule. */
export function tokensFile(dark: Record<string, string>, light: Record<string, string>): string {
  const lines = (values: Record<string, string>) =>
    Object.entries(values).map(([name, value]) => `  ${name}: ${value};`);
  return [":root {", ...lines(dark), "}", "", ':root[data-theme="light"] {', ...lines(light), "}", ""].join("\n");
}

export const DARK = { "--osf-bg-ground": "#0c0d0f", "--osf-text": "#e6e8eb", "--osf-text-subtle": "#808894" };
export const LIGHT = { "--osf-bg-ground": "#fafaf9", "--osf-text": "#111316", "--osf-text-subtle": "#636a74" };

export const putTokens = (sut: Sut, content: string) => sut.files.put("$INPUT/packages/ui/assets/tokens.css", content);

/** A stylesheet of the console with these lines. */
export const putStyle = (sut: Sut, lines: string[]) =>
  sut.files.put("$INPUT/modules/console/src/web/styles.css", `${lines.join("\n")}\n`);
