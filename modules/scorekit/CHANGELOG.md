# Changelog

## [0.7.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.6.1...scorekit-v0.7.0) (2026-11-17)


### ⚠ BREAKING CHANGES

* **cli, testkit, gatekeeper, foreman, console, intake, proof, runlog, scorekit, channel-slack:** a gatekeeper, foreman, console, intake, proof, runlog, scorekit or channel-slack process started with OSF_NOW (or console with OSF_SEED) set and without OSF_TEST_HOOKS=1 now exits 2 instead of running on that clock or seed; unset the variable. gatekeeper serve with a GATEKEEPER_POLL_MS that is no whole number of 1 or more (like 0, -5 or 1s) now exits 2 instead of falling back to 30 s or polling at once.

### Features

* **cli, testkit, gatekeeper, foreman, console, intake, proof, runlog, scorekit, channel-slack:** test hooks need an explicit switch (T-93) ([#400](https://github.com/sesigl/open-software-factory/issues/400)) ([135c9cd](https://github.com/sesigl/open-software-factory/commit/135c9cd66e1423e8159ca5eb06b3a20d43555863))
* **tools, testkit:** BUDGET measures the wall time of a suite (T-74, ADR 0155) ([#379](https://github.com/sesigl/open-software-factory/issues/379)) ([fde5791](https://github.com/sesigl/open-software-factory/commit/fde57913171d572f9aa9b03c93b7048da75b10c0))

## [0.6.1](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.6.0...scorekit-v0.6.1) (2026-11-15)


### Bug Fixes

* **cli:** a command named like toString or constructor names no command ([#335](https://github.com/sesigl/open-software-factory/issues/335)) ([c3bd872](https://github.com/sesigl/open-software-factory/commit/c3bd872b074ea799bc9264f70bbfa7028bed38f1))

## [0.6.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.5.1...scorekit-v0.6.0) (2026-11-11)


### Features

* **checks:** BUDGET takes the speed of the runner into account ([#258](https://github.com/sesigl/open-software-factory/issues/258)) ([051c519](https://github.com/sesigl/open-software-factory/commit/051c5192d5eb04d5718e6d8b7363e6603d130567))

## [0.5.1](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.5.0...scorekit-v0.5.1) (2026-11-05)


### Performance Improvements

* **ci:** pull requests replay the system test results of unchanged suites ([#178](https://github.com/sesigl/open-software-factory/issues/178)) ([fcb60ba](https://github.com/sesigl/open-software-factory/commit/fcb60badf3c0488706721b4e49814d03b5685f9a))

## [0.5.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.4.0...scorekit-v0.5.0) (2026-11-01)


### Features

* **scorekit:** T-21 weekly paid runs: score runs/ on OpenRouter with score --model ([#144](https://github.com/sesigl/open-software-factory/issues/144)) ([92f5d19](https://github.com/sesigl/open-software-factory/commit/92f5d190f6300693c364b4a4a050a5a73bf84751))

## [0.4.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.3.0...scorekit-v0.4.0) (2026-10-21)


### Features

* **cli:** shared libraries for the command line and run records (ADR 0039, 0040, 0041) ([#65](https://github.com/sesigl/open-software-factory/issues/65)) ([5f49dd9](https://github.com/sesigl/open-software-factory/commit/5f49dd9921d5dd086e53ab5c0359e2d4f8f3a1d2))

## [0.3.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.2.0...scorekit-v0.3.0) (2026-10-21)


### Features

* **tools:** mutation testing and duplication limits for every module (ADR 0037) ([#59](https://github.com/sesigl/open-software-factory/issues/59)) ([f62849e](https://github.com/sesigl/open-software-factory/commit/f62849ee318038dc4a0a84b6b3303528c3368f9e))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/scorekit-v0.1.0...scorekit-v0.2.0) (2026-10-21)


### Features

* **scorekit:** T-07 export scorers as Langfuse LLM-as-a-judge evaluators ([#52](https://github.com/sesigl/open-software-factory/issues/52)) ([3d2a022](https://github.com/sesigl/open-software-factory/commit/3d2a022ed3e40fa4e6a8e535e5f62b42f49938a1))

## 0.1.0 (2026-10-21)


### Features

* **scorekit:** T-07 score, calibrate, report and push agent sessions with LLM judges ([#49](https://github.com/sesigl/open-software-factory/issues/49)) ([17f48ef](https://github.com/sesigl/open-software-factory/commit/17f48ef5f65f7d05edc67c04228efa08f1d9db22))
