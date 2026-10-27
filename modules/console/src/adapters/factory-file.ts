// The factory definition the console shows: the YAML file in CONSOLE_FACTORY, read when a page is opened.
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface Factory {
  factory?: string;
  version?: number;
  description?: string;
  providers?: Record<string, unknown>;
  agents?: Record<string, Record<string, unknown>>;
}

export const readFactory = (path: string): Factory => parse(readFileSync(path, "utf8")) as Factory;
