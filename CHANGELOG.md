# Change Log
All notable changes to this project will be documented in this file.


## v1.12.0 - 2017-04-21
### Added
- Option `timestamps` to Sequelize storage [#99](https://github.com/sequelize/umzug/pull/99)

### Fixed
- Reject migration if umzug can't find the migration method [#115](https://github.com/sequelize/umzug/pull/115)

## v1.11.0 - 2016-04-29
### Added
- Events `migrating`, `migrated`, `reverting`, and `reverted` #76
- Official support to all major Sequelize versions #73
- Official support to Node.js v0.12, io.js v1-v3, and Node.js v4-v5 #73

### Fixed
- Compatibility issues with Sequelize >= 3.15.1 #67

## v1.10.0 - 2016-04-17
### Added
- Option `from` to `up` and `down` methods #72

### Fixed
- Configurable `up` and `down` methods #70

## v1.9.1 - 2016-03-14
### Fixed
- Call of `down` with empty object

## v1.9.0 - 2016-02-09
### Changed
- Set charset for SequelizeMeta table to  `utf8`

## v1.8.1 - 2016-02-09
### Added
- Print details in error cases

### Changed
- The `options` input object is not modified anymore
- Updated lodash to 4.3.0

## v1.8.0 - 2016-01-05
### Added
- The `none` storage

## v1.7.2 - 2015-12-27
### Fixed
- Migrations on utf8mb4 databases

## v1.7.1 - 2015-12-03
### Changed
- Ensure existence of migration specified by `to` parameter

## v1.7.0 - 2015-11-21
### Added
- Option to define the database schema

### Changed
- Sort table entries when reading currently executed migrations

## 1.6.0
### Changed
- Don't resolve the sequelize library anymore but use the instance's constructor

## 1.5.0
### Added
- ActiveRecord like logging

## 1.4.0
### Added
- Builds for all versions of sequelize

### Changed
- Project is now compatible with all versions of sequelize

## 1.3.1
### Changed
- Update lodash to 3.0

## 1.3.0
### Added
- Possibility to define the column type of the sequelize meta table
