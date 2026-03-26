# Changelog

All notable changes to this project will be documented in this file.

The format is based on ["Keep a Changelog"](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.4] - 2026-03-26

### Changed

- (ui): Switched task table filtering from frontend in-memory filtering to backend-driven filtering requests.
- (ui): Updated task table type-filter options to be loaded from backend-provided `task_types` per queue/state/group.
- (ui/api): Extended `PaginationOptions` and list response typings to include backend filtering parameters and metadata.

### Fixed

- (ui): Fixed filtered table updates when Auto-Update is disabled by triggering fetches on filter, page, and pagination dependency changes.

## [0.7.3] - 2026-03-13

### Added

- (ui): Added task table filters for task ID, task type, payload, and last error across queue task views.
- (ui): Added an auto-refresh toggle for queue task tables and aggregating task groups.

### Changed

- (ui): Improved task view layout and table sizing to better use available viewport space and keep large tables scrollable.
- (ui): Updated polling hooks and task table pagination behavior to support filtered result sets and controlled background refresh.
- (deps): Updated Go from 1.16 to 1.25.0 and refreshed core dependencies including `asynq`, `asynq/x`, `go-redis/v9`, `prometheus/client_golang`, `gorilla/mux`, `rs/cors`, and `go-cmp`.

## [0.7.0] - 2022-04-11

Version 0.7 added support for [Task Aggregation](https://github.com/hibiken/asynq/wiki/Task-aggregation) feature

### Added
 
- (ui): Added tasks view to show aggregated tasks

## [0.6.1] - 2022-03-17

### Fixed
- (ui): Show metrics link in sidebar when --prometheus-addr flag is provided

## [0.6.0] - 2022-03-02

### Added

- (cmd): Added `--read-only` flag to specify read-only mode
- (pkg): Added `Options.ReadOnly` to restrict user to view-only mode
- (ui): Hide action buttons in read-only mode
- (ui): Display queue latency in dashboard page and queue detail page.
- (ui): Added copy-to-clipboard button for task ID in tasks list-view page.
- (ui): Use logo image in the appbar (thank you @koddr!)

### Fixed
- (ui): Pagination in ActiveTasks table is fixed

## [0.5.0] - 2021-12-19

Version 0.5 added support for [Prometheus](https://prometheus.io/) integration.

- (cmd): Added `--enable-metrics-exporter` option to export queue metrics.
- (cmd): Added `--prometheus-addr` to enable metrics view in Web UI.
- (pkg): Added `Options.PrometheusAddress` to enable metrics view in Web UI.

## [0.4.0] - 2021-11-06

- Added "completed" state
- Updated to be compatible with asynq v0.19

## [0.3.2] - 2021-10-22

- (ui): Fixed build

## [0.3.1] - 2021-10-21

### Added

- (cmd): Added --max-payload-length to allow specifying number of characters displayed for payload, defaults to 200 chars
- (pkg): DefaultPayloadFormatter is now exported from the package

## [0.3.0]

### Changed

- Asynqmon is now a go package that can be imported to other projects!

## [0.2.1]

### Addded

- Task details view is added
- Search by task ID feature is added

## [0.2]

### Changed

- Updated to depend on asynq 0.18

## [0.1.0-beta1] - 2021-01-31

Initial Beta Release 🎉
