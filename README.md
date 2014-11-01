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

migrator.someMethod().then(function (result) {
  // do something with the result
});
```

#### Executing migrations
The `execute` method is a general purpose function that runs for every specified migrations the respective function.

```js
migrator.execute({
  migrations: ['some-id', 'some-other-id'],
  method: 'up'
}).then(function (migrations) {
  // "migrations" will be an Array of all executed/reverted migrations.
});
```

#### Getting all pending migrations
You can get a list of pending/not yet executed migrations like this:

```js
migrator.pending().then(function (migrations) {
  // "migrations" will be an Array with the names of
  // pending migrations.
});
```

#### Executing pending migrations
The `up` method can be used to execute all pending migrations. 

```js
migrator.up().then(function (migrations) {
  // "migrations" will be an Array with the names of the 
  // executed migrations.
});
```

It is also possible to pass the name of a migration in order to just run the migrations from the current state to the passed migration name.

```js
migrator.up({ to: '20141101203500-task' }).then(function (migrations) {});
```

#### Reverting executed migration
The `down` method can be used to revert the last executed migration.

```js
migrator.down().then(function (migration) {
  // "migration" will the name of the reverted migration.
});
```

It is possible to pass the name of a migration until which the migrations should be reverted. This allows the reverse of multiple migrations at once.

```js
migrator.down({ to: '20141031080000-task' }).then(function (migrations) {
  // "migrations" will be an Array with the names of all reverted migrations.
});
```

### Configuration

## License
MIT