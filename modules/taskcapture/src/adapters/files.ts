// Files taskcapture reads and writes: task folders, Harbor's result.json files, the report and the LiteLLM config.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeFile(path: string, content: string | Buffer): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

/** Writes the files below `dir`, after removing what the folder held before. */
export function replaceFolder(dir: string, files: Record<string, string | Buffer>): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) writeFile(join(dir, path), content);
}

export const readText = (path: string): string => readFileSync(path, "utf8");
export const exists = existsSync;

/** Every file named `name` below the paths: a path is a folder to search, or such a file itself. */
export function findFiles(paths: string[], name: string): string[] {
  const found: string[] = [];
  const walk = (path: string): void => {
    if (!statSync(path).isDirectory()) {
      if (path.endsWith(name)) found.push(path);
      return;
    }
    for (const entry of readdirSync(path).sort()) walk(join(path, entry));
  };
  for (const path of paths) walk(path);
  return found;
}

/** The folders right below `suite` that hold a task.toml: the tasks of a Harbor suite. */
export function taskFolders(suite: string): string[] {
  if (!existsSync(suite)) return [];
  return readdirSync(suite).filter((entry) => existsSync(join(suite, entry, "task.toml")));
}
