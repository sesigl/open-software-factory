# Changelog

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.6.1...foreman-v0.7.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))


### Bug Fixes

* no leaked containers from local runs ([#227](https://github.com/sesigl/open-software-factory/issues/227)) ([4d8afbc](https://github.com/sesigl/open-software-factory/commit/4d8afbc71d49366071f021731db3fec69b08567f))


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/foreman-v0.6.0...foreman-v0.6.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.5.0...foreman-v0.6.0) (2026-11-04)


### Features

* **foreman:** a stage's prompt names the work item's origin, and a gate request links the run's pull request ([#171](https://github.com/sesigl/open-software-factory/issues/171)) ([82aa0bd](https://github.com/sesigl/open-software-factory/commit/82aa0bde47d28924b27f979fe39051f314d59d76))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.4.1...foreman-v0.5.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **contracts:** a factory definition without effort on each agent is invalid. Add effort to every agent before you use contracts 2.0.0.

### Features

* **contracts:** every agent declares its effort level ([#156](https://github.com/sesigl/open-software-factory/issues/156)) ([3c67f65](https://github.com/sesigl/open-software-factory/commit/3c67f651bd691f1b6b4db1088efd1c4b65bb7591))

## [0.4.1](https://github.com/sesigl/open-software-factory/compare/foreman-v0.4.0...foreman-v0.4.1) (2026-11-01)


### Bug Fixes

* **foreman:** stop without waiting for the harness timer ([#152](https://github.com/sesigl/open-software-factory/issues/152)) ([fca6b88](https://github.com/sesigl/open-software-factory/commit/fca6b8852cb46a6e84e240e7a8d1faf58af6655a))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.3.0...foreman-v0.4.0) (2026-10-26)


### Features

* **foreman:** T-17 runs listed by state, work item status follows its run, and the evidence tool ([#128](https://github.com/sesigl/open-software-factory/issues/128)) ([3e6fea6](https://github.com/sesigl/open-software-factory/commit/3e6fea63d297e818f06c25a2370a9408172d872c))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.2.0...foreman-v0.3.0) (2026-10-26)


### Features

* **foreman:** T-17 an inference gateway per factory, and a person takes over a run ([#126](https://github.com/sesigl/open-software-factory/issues/126)) ([f5a672e](https://github.com/sesigl/open-software-factory/commit/f5a672e6a25cd42b0c1afcbc08d7bde1b6114394))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/foreman-v0.1.0...foreman-v0.2.0) (2026-10-26)


### Features

* **foreman:** T-17 a failing CI check stops the stage that waits for it ([#124](https://github.com/sesigl/open-software-factory/issues/124)) ([dbb239b](https://github.com/sesigl/open-software-factory/commit/dbb239b86ccaa2f9b8dfafd1191666d8ea6003e6))

## 0.1.0 (2026-10-26)


### Features

* **foreman:** T-17 each stage runs in a sandbox through the sandbox port ([#123](https://github.com/sesigl/open-software-factory/issues/123)) ([70aae93](https://github.com/sesigl/open-software-factory/commit/70aae93f2d5cf76d226bce184855bf30376efc13))
* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
