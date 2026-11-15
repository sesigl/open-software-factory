# Changelog

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.7.0...sandbox-docker-v0.8.0) (2026-11-15)


### Features

* **sandbox-egress:** the library is the egress proxy of a sandbox and no longer exports readSpec, copyEnds, WORKSPACE, memoryBytes, placeholder, envVariable and the proxy's five constants, which are the fields of EGRESS_PROXY; contracts gets readDocument, copyEnds and SANDBOX_WORKSPACE (T-62, ADR 0147) ([4eb088b](https://github.com/sesigl/open-software-factory/commit/4eb088b43fe3c74e11694fd5db6100faa65d90b9))


### Bug Fixes

* **cli:** a command named like toString or constructor names no command ([#335](https://github.com/sesigl/open-software-factory/issues/335)) ([c3bd872](https://github.com/sesigl/open-software-factory/commit/c3bd872b074ea799bc9264f70bbfa7028bed38f1))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.6.0...sandbox-docker-v0.7.0) (2026-11-15)


### Features

* **secrets:** a secret from OpenBao works for Git, and a stage fails first when its secret has no value (T-57, ADR 0139) ([#329](https://github.com/sesigl/open-software-factory/issues/329)) ([4256e99](https://github.com/sesigl/open-software-factory/commit/4256e99e09eb40f212eb0f8dc958c2d8b02cf916))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.5.0...sandbox-docker-v0.6.0) (2026-11-14)


### Features

* **e2e:** the paid factory run implements a factory issue of this repository (T-21) ([#301](https://github.com/sesigl/open-software-factory/issues/301)) ([81db796](https://github.com/sesigl/open-software-factory/commit/81db796a747da7e7eb06ca78862b9192f7c29ed8))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.4.0...sandbox-docker-v0.5.0) (2026-11-14)


### Features

* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.3.0...sandbox-docker-v0.4.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.2.0...sandbox-docker-v0.3.0) (2026-11-10)


### Features

* **sandbox:** the egress proxy swaps a secret's placeholder also in git's Basic credentials ([#240](https://github.com/sesigl/open-software-factory/issues/240)) ([e8a1c74](https://github.com/sesigl/open-software-factory/commit/e8a1c745a9b75160d1ddc1b4cd7599651da64982))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.1.1...sandbox-docker-v0.2.0) (2026-11-08)


### Features

* **sandbox-docker:** OSF_SANDBOX_NETWORK, a network the egress proxy also joins ([#221](https://github.com/sesigl/open-software-factory/issues/221)) ([d0b2810](https://github.com/sesigl/open-software-factory/commit/d0b2810857b3f46e409092e392eb3e6806b4e284))


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.1.1](https://github.com/sesigl/open-software-factory/compare/sandbox-docker-v0.1.0...sandbox-docker-v0.1.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## 0.1.0 (2026-10-23)


### Features

* **sandbox:** T-13 sandbox port and the docker adapter with an iron-proxy egress proxy ([#95](https://github.com/sesigl/open-software-factory/issues/95)) ([cf14d21](https://github.com/sesigl/open-software-factory/commit/cf14d21be6548ea35451650db2dc3f5f3df92141))
* **sandbox:** T-13 the kubernetes adapter, env and OpenBao secrets, and render --k8s SandboxTemplates ([#97](https://github.com/sesigl/open-software-factory/issues/97)) ([d43ab12](https://github.com/sesigl/open-software-factory/commit/d43ab12203ef984e3a24f02f3ae6f01f8250c9b7))
