// Reads the custom properties of the tokens file: the names and values of `:root` and of the light theme.
export function themes(css: string): { dark: Map<string, string>; light: Map<string, string> } {
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    const body = css.slice(start, css.indexOf("}", start));
    return new Map(
      [...body.matchAll(/(--osf-[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name ?? "", value ?? ""]),
    );
  };
  return { dark: block("\n:root"), light: block(':root[data-theme="light"]') };
}
