# Changelog

## [0.2.2](https://github.com/sesigl/open-software-factory/compare/channel-slack-v0.2.1...channel-slack-v0.2.2) (2026-11-03)


### Bug Fixes

* **channel-slack:** the publish job builds the bundle without the repository's other tools ([#167](https://github.com/sesigl/open-software-factory/issues/167)) ([1d27b33](https://github.com/sesigl/open-software-factory/commit/1d27b33a393c5af1f24732bb591487b68cd8f71a))

## [0.2.1](https://github.com/sesigl/open-software-factory/compare/channel-slack-v0.2.0...channel-slack-v0.2.1) (2026-11-01)


### Performance Improvements

* **channel-slack:** ship one bundled file that starts in 70 ms instead of 140 ms ([#164](https://github.com/sesigl/open-software-factory/issues/164)) ([6bd056f](https://github.com/sesigl/open-software-factory/commit/6bd056f266591cd5825fecb564e7e184f7209c23))

## [0.2.0](https://github.com/sesigl/open-software-factory/compare/channel-slack-v0.1.0...channel-slack-v0.2.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **gatekeeper:** GATEKEEPER_FORGE_URL for Forgejo is the forge's origin, no longer <origin>/api/v1. Gates pending on an older server are asked again.

### Features

* **gatekeeper:** T-15 approvals and records through the channel and forge ports ([#109](https://github.com/sesigl/open-software-factory/issues/109)) ([65356d1](https://github.com/sesigl/open-software-factory/commit/65356d1ce59c7589c80c9f919ab86dc2cf38f032))

## 0.1.0 (2026-10-24)


### Features

* **channel:** T-15 the channel port with the slack and github channels ([#103](https://github.com/sesigl/open-software-factory/issues/103)) ([dddee76](https://github.com/sesigl/open-software-factory/commit/dddee7666fab7d60eda91b407e0fab1a20122ae0))
