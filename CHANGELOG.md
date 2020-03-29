# Change Log

All notable changes to this project until v2.3.0 were documented in this file.

For the change logs for versions above v2.3.0, please refer to the GitHub releases section.

## v2.3.0 - 2020-03-22

### Added
- `migrationsList` helper to easily build a valid list of migrations
  [#199](https://github.com/sequelize/umzug/pull/199)
  
### Changed
- Documentation updates
  [#198](https://github.com/sequelize/umzug/pull/198)
- Updated dependencies
  [#203](https://github.com/sequelize/umzug/pull/203)
- Configure babel to not rely on babel-runtime
  [#202](https://github.com/sequelize/umzug/pull/202)
- Skip logging non-migration files
  [#190](https://github.com/sequelize/umzug/pull/190)

## v2.2.0 - 2018-11-18

### Added
- feat: support passing an array of Migrations
  [#164](https://github.com/sequelize/umzug/pull/164)
  
### Changed
- Doc fixes
  [#155](https://github.com/sequelize/umzug/pull/155)
- Add support for coffeescript 2
  [#157](https://github.com/sequelize/umzug/pull/157)
- throw error if a migration method doesn't return a thenable
  [#158](https://github.com/sequelize/umzug/pull/158)
- Update README.md with respect to MongoDBStorage
  [#165](https://github.com/sequelize/umzug/pull/165)
- fix multiple jsdoc lines related to MongoDBStorage
  [#174](https://github.com/sequelize/umzug/pull/174)
- clarify up/down migrations "to" option
  [#176](https://github.com/sequelize/umzug/pull/176)
- Test isolation by using different sqlite databases in each testsuite
  [#180](https://github.com/sequelize/umzug/pull/180)


## v2.1.0 - 2017-10-23
### Added
- Ability to traverse sub directories
  [#80](https://github.com/sequelize/umzug/pull/80)
  
## v2.0.0 - 2017-05-10
### Added
- Warn about ignored files in migrations directory
  [#108](https://github.com/sequelize/umzug/pull/108)
- Support ES6 default export in migrations
  [#132](https://github.com/sequelize/umzug/pull/132)
- Support custom storage instances
  [#133](https://github.com/sequelize/umzug/pull/133)

### Changed
- Use ES6 classes instead of redefine classes
  [#130](https://github.com/sequelize/umzug/pull/130)
- Pass only storage options to Storage constructor
  [#137](https://github.com/sequelize/umzug/pull/137)
  (Old format is still supported but **deprecated**.)

### Breaking changes
- Migration.migration(), Migration.up(), and Migration.down() returns Promise
  instead of Bluebird [#132](https://github.com/sequelize/umzug/pull/132)

### Deprecations
- Pass only storage options to Storage constructor
  [#137](https://github.com/sequelize/umzug/pull/137)

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
