# Changelog

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.6.0...forge-github-v0.7.0) (2026-11-14)


### Features

* **forge-github:** pr lists the check runs of GitHub Actions next to the commit statuses ([#270](https://github.com/sesigl/open-software-factory/issues/270)) ([23a5f96](https://github.com/sesigl/open-software-factory/commit/23a5f96194eeffba7417d0f60464007613fd9afc))
* **intake, forge:** the requester hears when a run waits at a gate and when it failed (T-45, ADR 0113) ([#282](https://github.com/sesigl/open-software-factory/issues/282)) ([8f49d6b](https://github.com/sesigl/open-software-factory/commit/8f49d6b03cd3de61ed542dda22749756846222f5))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.5.1...forge-github-v0.6.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.5.1](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.5.0...forge-github-v0.5.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.4.0...forge-github-v0.5.0) (2026-10-27)


### Features

* **console:** T-18 the self-improvement inbox and the forge port's prs ([#132](https://github.com/sesigl/open-software-factory/issues/132)) ([8b5cab2](https://github.com/sesigl/open-software-factory/commit/8b5cab270c70391422af414a9907b776904e8076))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.3.0...forge-github-v0.4.0) (2026-10-26)


### Features

* **intake:** T-16 issues labeled factory, one work item across surfaces, Sentry alerts ([#118](https://github.com/sesigl/open-software-factory/issues/118)) ([024c559](https://github.com/sesigl/open-software-factory/commit/024c55986a2c4f4a565e72f3272105d973d0a1ea))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.2.0...forge-github-v0.3.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **gatekeeper:** GATEKEEPER_FORGE_URL for Forgejo is the forge's origin, no longer <origin>/api/v1. Gates pending on an older server are asked again.

### Features

* **gatekeeper:** T-15 approvals and records through the channel and forge ports ([#109](https://github.com/sesigl/open-software-factory/issues/109)) ([65356d1](https://github.com/sesigl/open-software-factory/commit/65356d1ce59c7589c80c9f919ab86dc2cf38f032))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/forge-github-v0.1.0...forge-github-v0.2.0) (2026-10-24)


### Features

* **factory-spec:** T-15 webhooks of forgejo and github automations through the forge port ([#105](https://github.com/sesigl/open-software-factory/issues/105)) ([ba795ad](https://github.com/sesigl/open-software-factory/commit/ba795ad58af71f66174310c1e580d98593139564))

## 0.1.0 (2026-10-24)


### Features

* **forge:** T-15 the github forge adapter and fakes.github ([#101](https://github.com/sesigl/open-software-factory/issues/101)) ([e8cd07c](https://github.com/sesigl/open-software-factory/commit/e8cd07ce9411c635f668a5558febcecf998681b7))
