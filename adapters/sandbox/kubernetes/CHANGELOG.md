# Changelog

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/sandbox-kubernetes-v0.3.0...sandbox-kubernetes-v0.4.0) (2026-11-14)


### Features

* a run blocked at its checks tells its requester (T-45, ADR 0127); a sandbox probe in console doctor --deep (T-25, ADR 0120) ([#294](https://github.com/sesigl/open-software-factory/issues/294)) ([082cf02](https://github.com/sesigl/open-software-factory/commit/082cf023854adbdb39632cdfd65e5a0ede9b52c4))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/sandbox-kubernetes-v0.2.0...sandbox-kubernetes-v0.3.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))


### Performance Improvements

* **sandbox:** the kubernetes adapter's destroy does not wait for the pods to stop, and list works in an empty namespace ([#254](https://github.com/sesigl/open-software-factory/issues/254)) ([e4e99b9](https://github.com/sesigl/open-software-factory/commit/e4e99b90ca84902d6ea1510ab9f5677cf3c936d3))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/sandbox-kubernetes-v0.1.2...sandbox-kubernetes-v0.2.0) (2026-11-10)


### Features

* **sandbox:** the egress proxy swaps a secret's placeholder also in git's Basic credentials ([#240](https://github.com/sesigl/open-software-factory/issues/240)) ([e8a1c74](https://github.com/sesigl/open-software-factory/commit/e8a1c745a9b75160d1ddc1b4cd7599651da64982))

## [0.1.2](https://github.com/sesigl/open-software-factory/compare/sandbox-kubernetes-v0.1.1...sandbox-kubernetes-v0.1.2) (2026-11-08)


### Performance Improvements

* **ci:** shard the nightly mutation run and replay unchanged shards ([#187](https://github.com/sesigl/open-software-factory/issues/187)) ([e38b1b8](https://github.com/sesigl/open-software-factory/commit/e38b1b8607cca7dd46f2251df74465a26d84aaaf))

## [0.1.1](https://github.com/sesigl/open-software-factory/compare/sandbox-kubernetes-v0.1.0...sandbox-kubernetes-v0.1.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## 0.1.0 (2026-10-23)


### Features

* **sandbox:** T-13 the kubernetes adapter, env and OpenBao secrets, and render --k8s SandboxTemplates ([#97](https://github.com/sesigl/open-software-factory/issues/97)) ([d43ab12](https://github.com/sesigl/open-software-factory/commit/d43ab12203ef984e3a24f02f3ae6f01f8250c9b7))
