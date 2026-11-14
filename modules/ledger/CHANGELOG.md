# Changelog

## [0.8.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.7.0...ledger-v0.8.0) (2026-11-14)


### Features

* **testkit:** fakes.postgres and fakes.temporal start one server per test process (ADR 0129) ([#302](https://github.com/sesigl/open-software-factory/issues/302)) ([a8174b9](https://github.com/sesigl/open-software-factory/commit/a8174b9e6e3ff0b03b39b252cbb4bc9691d3a235))

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.6.1...ledger-v0.7.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/ledger-v0.6.0...ledger-v0.6.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.5.0...ledger-v0.6.0) (2026-10-23)


### Features

* **gatekeeper:** T-11 gatekeeper serve with an HTTP API, Slack events and buttons, and a Postgres outbox ([#84](https://github.com/sesigl/open-software-factory/issues/84)) ([d58cfca](https://github.com/sesigl/open-software-factory/commit/d58cfca8009733ff168580fb335a5cbaddf371c3))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.4.0...ledger-v0.5.0) (2026-10-22)


### Features

* **ledger:** T-08 dogfood: token prices, a static dashboard page, nightly deploy to Vercel ([#73](https://github.com/sesigl/open-software-factory/issues/73)) ([3eb8710](https://github.com/sesigl/open-software-factory/commit/3eb8710e4d2fba071675e975e1203c62c1af2b3f))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.3.0...ledger-v0.4.0) (2026-10-21)


### Features

* **cli:** shared libraries for the command line and run records (ADR 0039, 0040, 0041) ([#65](https://github.com/sesigl/open-software-factory/issues/65)) ([5f49dd9](https://github.com/sesigl/open-software-factory/commit/5f49dd9921d5dd086e53ab5c0359e2d4f8f3a1d2))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.2.0...ledger-v0.3.0) (2026-10-21)


### Features

* **tools:** mutation testing and duplication limits for every module (ADR 0037) ([#59](https://github.com/sesigl/open-software-factory/issues/59)) ([f62849e](https://github.com/sesigl/open-software-factory/commit/f62849ee318038dc4a0a84b6b3303528c3368f9e))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/ledger-v0.1.0...ledger-v0.2.0) (2026-10-21)


### Features

* **ledger:** T-08 import a forge's pull requests and reviews as pr.* events ([#58](https://github.com/sesigl/open-software-factory/issues/58)) ([534776e](https://github.com/sesigl/open-software-factory/commit/534776ee5d56bdfbfb67b8bfdc2ca1e3d7cbcfbe))

## 0.1.0 (2026-10-21)


### Features

* **ledger:** T-08 cost per pull request and flow metrics from spend, runs and forge events ([#54](https://github.com/sesigl/open-software-factory/issues/54)) ([bff015b](https://github.com/sesigl/open-software-factory/commit/bff015be22d45ad59b09b28dc9affb12df4c0d9d))
* **ledger:** T-08 PostgreSQL views, report and query on PostgreSQL, and a Grafana dashboard ([#57](https://github.com/sesigl/open-software-factory/issues/57)) ([c636e92](https://github.com/sesigl/open-software-factory/commit/c636e92de2ceb62fd52f10ff9065a63f4bc88ed4))
