// @opensoftware/factory-source: give a factory's folder from a path or a Git remote. Programs import only from here.
export { FetchError } from "./git.ts";
export { type Pin, type PinnedFolder, type PinnedOptions, pinnedFolder } from "./pinned.ts";
export { type FactoryFolder, type FactorySource, factorySource, type SourceOptions } from "./source.ts";
