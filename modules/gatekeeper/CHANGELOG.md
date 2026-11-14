# Changelog

## [0.9.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.8.0...gatekeeper-v0.9.0) (2026-11-14)


### Features

* a first run without guessing (T-47, ADR 0114) ([#284](https://github.com/sesigl/open-software-factory/issues/284)) ([7c5ccfa](https://github.com/sesigl/open-software-factory/commit/7c5ccfaad9bfdffe38bad6fa2cbc9e314ef44092))
* **console, foreman, gatekeeper:** act on runs and gates from the console, as the person (T-28, ADR 0118) ([#288](https://github.com/sesigl/open-software-factory/issues/288)) ([74929e5](https://github.com/sesigl/open-software-factory/commit/74929e51133f8c5c7219eaae2313a4311926fb3f))
* events not lost without a trace (T-49, ADR 0116); vision status lines checked (T-50, ADR 0117) ([#286](https://github.com/sesigl/open-software-factory/issues/286)) ([a737849](https://github.com/sesigl/open-software-factory/commit/a737849cb05f9f07fed193f0884edb28ed7a7a12))
* **forge-github:** pr lists the check runs of GitHub Actions next to the commit statuses ([#270](https://github.com/sesigl/open-software-factory/issues/270)) ([23a5f96](https://github.com/sesigl/open-software-factory/commit/23a5f96194eeffba7417d0f60464007613fd9afc))

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.7.0...gatekeeper-v0.8.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.6.0...gatekeeper-v0.7.0) (2026-11-08)


### Features

* TODO.md wave 5, the v1 gaps (durable events, health, doctor, traces, evidence, console work and actions) ([#226](https://github.com/sesigl/open-software-factory/issues/226)) ([2787352](https://github.com/sesigl/open-software-factory/commit/27873526013a268d71ca9c738e2088a9f22c9b76))


### Bug Fixes

* **ci:** pinned kind and agent-sandbox manifest, release files through the GitHub API ([#215](https://github.com/sesigl/open-software-factory/issues/215)) ([7b9f931](https://github.com/sesigl/open-software-factory/commit/7b9f931d937a2c7348d43abc259561e935d2672a))
* **gatekeeper:** the OPA fallback reads the version without a pipe ([#228](https://github.com/sesigl/open-software-factory/issues/228)) ([3eed9c0](https://github.com/sesigl/open-software-factory/commit/3eed9c04f13feb098520b2542b35af2aa73134e4))


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.5.0...gatekeeper-v0.6.0) (2026-11-05)


### Features

* **deploy:** the Compose profile runs this repository's factory on a Claude subscription ([#175](https://github.com/sesigl/open-software-factory/issues/175)) ([6c4e676](https://github.com/sesigl/open-software-factory/commit/6c4e676dec228f082d2f0b541d48649a38e3b1f2))


### Bug Fixes

* **intake:** pools and transactions come from a shared library that survives a lost connection ([#180](https://github.com/sesigl/open-software-factory/issues/180)) ([ff46542](https://github.com/sesigl/open-software-factory/commit/ff46542f54d271e97a49147e41e7e2a399b9171c))


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.4.1...gatekeeper-v0.5.0) (2026-11-04)


### Features

* **gatekeeper:** the server decides gates on pull requests ([#173](https://github.com/sesigl/open-software-factory/issues/173)) ([70feade](https://github.com/sesigl/open-software-factory/commit/70feadec8c550916d2a08336db012064429eacc2))

## [0.4.1](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.4.0...gatekeeper-v0.4.1) (2026-11-01)


### Performance Improvements

* **gatekeeper:** request, status, keys and verify start without Fastify, pg and NATS ([#161](https://github.com/sesigl/open-software-factory/issues/161)) ([ab635a1](https://github.com/sesigl/open-software-factory/commit/ab635a1e85d399963ddc89325300a0753c4a0825))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.3.0...gatekeeper-v0.4.0) (2026-10-26)


### Features

* **foreman:** T-17 runs of the factory's workflow on Temporal, with gates, steering and cancel ([#122](https://github.com/sesigl/open-software-factory/issues/122)) ([b62d1af](https://github.com/sesigl/open-software-factory/commit/b62d1af7eb33d52db64973a34b8050d69d8adb1d))
* **intake:** T-16 one inbox for agent work over HTTP, Slack and MCP ([#117](https://github.com/sesigl/open-software-factory/issues/117)) ([c4c27bf](https://github.com/sesigl/open-software-factory/commit/c4c27bf5b8c64c88f01005067c35cd030e9684b8))


### Bug Fixes

* **gatekeeper:** decide gates that 0.2 left pending; reject adapter output that is not JSON ([#116](https://github.com/sesigl/open-software-factory/issues/116)) ([c8f12ae](https://github.com/sesigl/open-software-factory/commit/c8f12aed791cfa8957b80731f9d55c00260e8827))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.2.0...gatekeeper-v0.3.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **gatekeeper:** GATEKEEPER_FORGE_URL for Forgejo is the forge's origin, no longer <origin>/api/v1. Gates pending on an older server are asked again.

### Features

* **gatekeeper:** T-15 approvals and records through the channel and forge ports ([#109](https://github.com/sesigl/open-software-factory/issues/109)) ([65356d1](https://github.com/sesigl/open-software-factory/commit/65356d1ce59c7589c80c9f919ab86dc2cf38f032))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.1.0...gatekeeper-v0.2.0) (2026-10-23)


### Features

* **gatekeeper:** T-11 gatekeeper serve with an HTTP API, Slack events and buttons, and a Postgres outbox ([#84](https://github.com/sesigl/open-software-factory/issues/84)) ([d58cfca](https://github.com/sesigl/open-software-factory/commit/d58cfca8009733ff168580fb335a5cbaddf371c3))

## 0.1.0 (2026-10-22)


### Features

* **gatekeeper:** T-11 approvals by a Rego policy in Slack and pull requests, signed records (ADR 0047) ([#82](https://github.com/sesigl/open-software-factory/issues/82)) ([269f633](https://github.com/sesigl/open-software-factory/commit/269f633e78a09675cb14b1f876519962975de7b5))
