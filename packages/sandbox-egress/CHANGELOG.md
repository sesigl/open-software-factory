# Changelog

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.6.0...sandbox-egress-v0.7.0) (2026-11-17)


### Features

* **tools, testkit:** BUDGET measures the wall time of a suite (T-74, ADR 0155) ([#379](https://github.com/sesigl/open-software-factory/issues/379)) ([fde5791](https://github.com/sesigl/open-software-factory/commit/fde57913171d572f9aa9b03c93b7048da75b10c0))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.5.0...sandbox-egress-v0.6.0) (2026-11-15)


### Features

* **sandbox-egress:** the library is the egress proxy of a sandbox and no longer exports readSpec, copyEnds, WORKSPACE, memoryBytes, placeholder, envVariable and the proxy's five constants, which are the fields of EGRESS_PROXY; contracts gets readDocument, copyEnds and SANDBOX_WORKSPACE (T-62, ADR 0147) ([4eb088b](https://github.com/sesigl/open-software-factory/commit/4eb088b43fe3c74e11694fd5db6100faa65d90b9))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.4.0...sandbox-egress-v0.5.0) (2026-11-15)


### Features

* **secrets:** a secret from OpenBao works for Git, and a stage fails first when its secret has no value (T-57, ADR 0139) ([#329](https://github.com/sesigl/open-software-factory/issues/329)) ([4256e99](https://github.com/sesigl/open-software-factory/commit/4256e99e09eb40f212eb0f8dc958c2d8b02cf916))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.3.0...sandbox-egress-v0.4.0) (2026-11-14)


### Features

* **tools:** one job and a listed surface for every package, and osf ready for the sign-in (ADR 0135, T-56) ([#318](https://github.com/sesigl/open-software-factory/issues/318)) ([00743d6](https://github.com/sesigl/open-software-factory/commit/00743d651d2a3a910b8d155959c0742847a7bab0))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.2.0...sandbox-egress-v0.3.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.1.1...sandbox-egress-v0.2.0) (2026-11-10)


### Features

* **sandbox:** the egress proxy swaps a secret's placeholder also in git's Basic credentials ([#240](https://github.com/sesigl/open-software-factory/issues/240)) ([e8a1c74](https://github.com/sesigl/open-software-factory/commit/e8a1c745a9b75160d1ddc1b4cd7599651da64982))

## [0.1.1](https://github.com/sesigl/open-software-factory/compare/sandbox-egress-v0.1.0...sandbox-egress-v0.1.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## 0.1.0 (2026-10-23)


### Features

* **sandbox:** T-13 the kubernetes adapter, env and OpenBao secrets, and render --k8s SandboxTemplates ([#97](https://github.com/sesigl/open-software-factory/issues/97)) ([d43ab12](https://github.com/sesigl/open-software-factory/commit/d43ab12203ef984e3a24f02f3ae6f01f8250c9b7))
