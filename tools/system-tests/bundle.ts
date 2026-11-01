// The package of the "osf bundle" scenarios: adapters/demo, whose CLI prints the greeting of the package "greeter".
import type { Sut } from "@opensoftware/testkit";

export const GREETER_LICENSE = "MIT License\n\nCopyright (c) the greeter authors\n";

/** adapters/demo with src/cli.ts and the package "greeter" in its node_modules, with or without a license. */
export async function demoPackage(sut: Sut, license: boolean): Promise<void> {
  await sut.files.put(
    "$INPUT/adapters/demo/package.json",
    JSON.stringify({ name: "demo", version: "0.1.0", type: "module", bin: { demo: "dist/cli.js" } }),
  );
  await sut.files.put(
    "$INPUT/adapters/demo/src/cli.ts",
    'import { greeting } from "greeter";\n\nconst name: string = "demo";\nconsole.log(greeting(name));\n',
  );
  const greeter = "$INPUT/adapters/demo/node_modules/greeter";
  await sut.files.put(
    `${greeter}/package.json`,
    JSON.stringify({
      name: "greeter",
      version: "1.0.0",
      type: "module",
      main: "index.js",
      ...(license && { license: "MIT" }),
    }),
  );
  await sut.files.put(`${greeter}/index.js`, 'export const greeting = (name) => "hello from greeter, " + name;\n');
  if (license) await sut.files.put(`${greeter}/LICENSE`, GREETER_LICENSE);
}
