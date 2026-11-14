// The library demo of the SURFACE scenarios (ADR 0135): its package.json with one entry point, its entry point and the
// "Public surface" of its AGENTS.md.
type Sut = { files: { put(path: string, content: string): Promise<unknown> } };

/** Puts the library demo with this entry point and the values its AGENTS.md names. */
export async function putLibrary(sut: Sut, index: string[], named: string[]): Promise<void> {
  const manifest = {
    name: "@opensoftware/demo",
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
  };
  await sut.files.put("$INPUT/packages/demo/package.json", `${JSON.stringify(manifest)}\n`);
  await sut.files.put("$INPUT/packages/demo/src/index.ts", `${index.join("\n")}\n`);
  const list = named.map((name) => `\`${name}\``).join(", ");
  await sut.files.put(
    "$INPUT/packages/demo/AGENTS.md",
    `# AGENTS.md for \`packages/demo\`\n\n## Public surface\n\n- Library: ${list}\n\n## Rules\n\n- None.\n`,
  );
}
