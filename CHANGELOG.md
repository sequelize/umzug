# Change Log
All notable changes to this project will be documented in this file.

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
