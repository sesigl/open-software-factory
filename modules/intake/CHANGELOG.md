# Changelog

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/intake-v0.5.0...intake-v0.6.0) (2026-11-14)


### Features

* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))
* events not lost without a trace (T-49, ADR 0116); vision status lines checked (T-50, ADR 0117) ([#286](https://github.com/sesigl/open-software-factory/issues/286)) ([a737849](https://github.com/sesigl/open-software-factory/commit/a737849cb05f9f07fed193f0884edb28ed7a7a12))
* **foreman, intake, console:** lists that stay fast (T-48, ADR 0115) ([#285](https://github.com/sesigl/open-software-factory/issues/285)) ([5e6f432](https://github.com/sesigl/open-software-factory/commit/5e6f432304710cdcab351089fc4a3e1ba312c8d6))
* **foreman, intake:** a second run's events, and the label put on again runs a failed work item again ([#274](https://github.com/sesigl/open-software-factory/issues/274)) ([f6c9151](https://github.com/sesigl/open-software-factory/commit/f6c91516d5916b2b01b0cc5b7360c8af2cc29c5f))
* **intake, forge:** the requester hears when a run waits at a gate and when it failed (T-45, ADR 0113) ([#282](https://github.com/sesigl/open-software-factory/issues/282)) ([8f49d6b](https://github.com/sesigl/open-software-factory/commit/8f49d6b03cd3de61ed542dda22749756846222f5))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/intake-v0.4.1...intake-v0.5.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.4.1](https://github.com/sesigl/open-software-factory/compare/intake-v0.4.0...intake-v0.4.1) (2026-11-08)


### Performance Improvements

* **intake:** new embedded databases start from PGlite's empty data folder ([#235](https://github.com/sesigl/open-software-factory/issues/235)) ([d42f3c6](https://github.com/sesigl/open-software-factory/commit/d42f3c660fccdd6350dcc65c07f3957403a93dc7))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/intake-v0.3.1...intake-v0.4.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.3.1](https://github.com/sesigl/open-software-factory/compare/intake-v0.3.0...intake-v0.3.1) (2026-11-05)


### Bug Fixes

* **intake:** pools and transactions come from a shared library that survives a lost connection ([#180](https://github.com/sesigl/open-software-factory/issues/180)) ([ff46542](https://github.com/sesigl/open-software-factory/commit/ff46542f54d271e97a49147e41e7e2a399b9171c))


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/intake-v0.2.0...intake-v0.3.0) (2026-10-27)


### Features

* **e2e:** T-20 the end-to-end smoke suite on the Compose profile ([#138](https://github.com/sesigl/open-software-factory/issues/138)) ([3d5f563](https://github.com/sesigl/open-software-factory/commit/3d5f563ff52c62626295efc49d4d61616a3bdbed))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/intake-v0.1.0...intake-v0.2.0) (2026-10-26)


### Features

* **foreman:** T-17 runs listed by state, work item status follows its run, and the evidence tool ([#128](https://github.com/sesigl/open-software-factory/issues/128)) ([3e6fea6](https://github.com/sesigl/open-software-factory/commit/3e6fea63d297e818f06c25a2370a9408172d872c))

## 0.1.0 (2026-10-26)


### Features

* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
* **intake:** T-16 issues labeled factory, one work item across surfaces, Sentry alerts ([#118](https://github.com/sesigl/open-software-factory/issues/118)) ([024c559](https://github.com/sesigl/open-software-factory/commit/024c55986a2c4f4a565e72f3272105d973d0a1ea))
* **intake:** T-16 one inbox for agent work over HTTP, Slack and MCP ([#117](https://github.com/sesigl/open-software-factory/issues/117)) ([c4c27bf](https://github.com/sesigl/open-software-factory/commit/c4c27bf5b8c64c88f01005067c35cd030e9684b8))
