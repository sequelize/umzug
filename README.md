# Migrator
The *migrator* is a framework agnostic migration tool for Node.JS. The tool itself is not specifically related to databases but basically provides a clean API for running and rolling back tasks.

## Persistence 
In order to keep track of already executed tasks, *migrator* logs successfully executed migrations. This is done in order to allow rollbacks of tasks. There are multiple logging strategy presets, from which you can choose. Adding a custom is  super simple as well.

## Logging strategies

### JSON
### Sequelize
### Legacy Sequelize

## Migrations
Migrations are basically files that describe ways of executing and undoing tasks. In order to allow asynchronicity, tasks have return a Promise object which provides a `then` method. 

### Format
A migration file ideally contains an `up` and a `down` method, which represent a function which achieves the task and a function that reverts a task. The file could look like this:

```js
var Bluebird = require('bluebird');

module.exports = {
  up: function () {
    return new Bluebird(function (resolve, reject) {
      // Describe how to achieve the task.
      // Call resolve/reject at some point.
    });
  },
  
  down: function () {
    return new Bluebird(function (resolve, reject) {
      // Describe how to revert the task.
      // Call resolve/reject at some point.
    });
  }
};
```

## Usage

### Installation
The *migrator*  is available on npm:

```js
npm install sequelize-migrator
```

### API
The basic usage of *migrator* is as simple as that:

```js
var Migrator = require('sequelize-migrator');
var migrator = new Migrator({});

migrator.up().then(function (migrations) {
  // "migrations" will be an Array with the names of the 
  // executed migrations.
});
```

### Configuration

## License
MIT