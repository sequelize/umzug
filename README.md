# Migrator
The *migrator* is a framework agnostic migration tool for Node.JS. The tool itself is not specifically related to databases but basically provides a clean API for running and rolling back tasks.

## Persistence
In order to keep track of already executed tasks, *migrator* logs successfully executed migrations. This is done in order to allow rollbacks of tasks. There are multiple storage presets available, from which you can choose. Adding a custom is  super simple as well.

## Storages

### JSON
Using the `json` storage will create a JSON file which will contain an array with all the executed migrations. You can specify the path to the file. The default for that is `migrator.json` in the working directory of the process.

#### Options

```js
{
  // The path to the json storage.
  // Defaults to process.cwd() + '/migrations.json';
  path: process.cwd() + '/db/sequelize-meta.json'
}
```

### Sequelize
Using the `sequelize` storage will create a table in your database called `SequelizeMeta` containing an entry for each executed migration. You will have to pass a configured instance of Sequelize. Optionally you can specify the table name.

### Legacy Sequelize
Using the `legacy` storage will create the obsolete `SequelizeMeta` table structure which contains information about executed migration runs which contains a `from` and a `to` column. You will have to pass a configured instance of Sequelize. Please note, that using this storage is not recommended.

### Custom
TBD. Pass an object...

## Migrations
Migrations are basically files that describe ways of executing and reverting tasks. In order to allow asynchronicity, tasks have return a Promise object which provides a `then` method.

### Format
A migration file ideally contains an `up` and a `down` method, which represent a function which achieves the task and a function that reverts a task. The file could look like this:

```js
'use strict';

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

#### Getting all executed migrations
You can get a list of already executed migrations like this:

```js
migrator.executed().then(function (migrations) {
  // "migrations" will be an Array of already executed migrations.
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

It is possible to configure the *migrator* instance via passing an object to the constructor. The possible options are:

```js
{
  // The storage.
  // Defaults to 'json'.
  // Possible values: 'json', 'sequelize', 'legacy', an object
	storage: 'json',

	// The options for the storage.
	// Defaults to {}.
	// Check the available storages for further details.
	storageOptions: { option1: 'value1' },

	// The name of the positive method in migrations.
	// Defaults to 'up'.
	upName: 'run',

	// The name of the negative method in migrations.
	// Defaults to 'down'.
	downName: 'revert',

	// The path to the migrations directory.
	// Defaults to 'migrations' in the working directory.
	migrationsPath: 'db/migrations/',

  // The pattern that determines whether or not a file is a migration.
  // Defaults to /^\d+[\w-]+\.js$/
  migrationsPattern: /^\d{3}\.js$/
}
```

## License
MIT
