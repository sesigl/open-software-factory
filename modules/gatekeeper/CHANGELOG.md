# Changelog

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/gatekeeper-v0.6.0...gatekeeper-v0.6.1) (2026-11-07)


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([b5557bf](https://github.com/sesigl/open-software-factory/commit/b5557bfaf795918749db1e9ff413384bfcf1d537))

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
