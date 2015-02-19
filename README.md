# Umzug [![Build Status](https://travis-ci.org/sequelize/umzug.svg?branch=master)](https://travis-ci.org/sequelize/umzug)
The *umzug* lib is a framework agnostic migration tool for Node.JS. The tool itself is not specifically related to databases but basically provides a clean API for running and rolling back tasks.

## Persistence
In order to keep track of already executed tasks, *umzug* logs successfully executed migrations. This is done in order to allow rollbacks of tasks. There are multiple storage presets available, from which you can choose. Adding a custom is  super simple as well.

## Storages

### JSON
Using the [`json` storage](lib/storages/json.js) will create a JSON file which will contain an array with all the executed migrations. You can specify the path to the file. The default for that is `umzug.json` in the working directory of the process.

#### Options

```js
{
  // The path to the json storage.
  // Defaults to process.cwd() + '/umzug.json';
  path: process.cwd() + '/db/sequelize-meta.json'
}
```

### Sequelize
Using the [`sequelize` storage](lib/storages/sequelize.js) will create a table in your database called `SequelizeMeta` containing an entry for each executed migration. You will have to pass a configured instance of Sequelize or an existing Sequelize model. Optionally you can specify the model name, table name, or column name.

#### Options

```js
{
  // The configured instance of Sequelize.
  // Optional if `model` is passed.
  sequelize: instance,

  // The to be used Sequelize model.
  // Must have column name matching `columnName` option
  // Optional of `sequelize` is passed.
  model: model,

  // The name of the to be used model.
  // Defaults to 'SequelizeMeta'
  modelName: 'Schema',

  // The name of table to create if `model` option is not supplied
  // Defaults to `modelName`
  tableName: 'Schema',

  // The name of table column holding migration name.
  // Defaults to 'name'.
  columnName: 'migration',

  // The type of the column holding migration name.
  // Defaults to `Sequelize.STRING`
  columnType: new Sequelize.STRING(100)
}
```

### Custom
In order to use a custom storage, you can create and publish a module which has to fulfill the following API. You can just pass the name of the module to the configuration and *umzug* will require it accordingly. The API that needs to be exposed looks like this:

```js
var Bluebird = require('bluebird');
var redefine = require('redefine');

module.exports = redefine.Class({
  constructor: function (options) {
    this.options = options;
    this.options.storageOptions = _.extend({
      option1: 'defaultValue1'
    }, this.options.storageOptions)
  },

  logMigration: function (migrationName) {
    return new Bluebird(function (resolve, reject) {
      // This function logs a migration as executed.
      // It will get called once a migration was
      // executed successfully.
    });
  },

  unlogMigration: function (migrationName) {
    return new Bluebird(function (resolve, reject) {
      // This function removes a previously logged migration.
      // It will get called once a migration has been reverted.
    });
  },

  executed: function () {
    return new Bluebird(function (resolve, reject) {
      // This function lists the names of the logged
      // migrations. It will be used to calculate
      // pending migrations. The result has to be an
      // array with the names of the migration files.
    });
  }
});
```

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
The *umzug* lib is available on npm:

```js
npm install umzug
```

### API
The basic usage of *umzug* is as simple as that:

```js
var Umzug = require('umzug');
var umzug = new Umzug({});

umzug.someMethod().then(function (result) {
  // do something with the result
});
```

#### Executing migrations
The `execute` method is a general purpose function that runs for every specified migrations the respective function.

```js
umzug.execute({
  migrations: ['some-id', 'some-other-id'],
  method: 'up'
}).then(function (migrations) {
  // "migrations" will be an Array of all executed/reverted migrations.
});
```

#### Getting all pending migrations
You can get a list of pending/not yet executed migrations like this:

```js
umzug.pending().then(function (migrations) {
  // "migrations" will be an Array with the names of
  // pending migrations.
});
```

#### Getting all executed migrations
You can get a list of already executed migrations like this:

```js
umzug.executed().then(function (migrations) {
  // "migrations" will be an Array of already executed migrations.
});
```

#### Executing pending migrations
The `up` method can be used to execute all pending migrations.

```js
umzug.up().then(function (migrations) {
  // "migrations" will be an Array with the names of the
  // executed migrations.
});
```

It is also possible to pass the name of a migration in order to just run the migrations from the current state to the passed migration name.

```js
umzug.up({ to: '20141101203500-task' }).then(function (migrations) {});
```

Running specific migrations while ignoring the right order, can be done like this:

```js
umzug.up({ migrations: ['20141101203500-task', '20141101203501-task-2'] });
```

There are also shorthand version of that:

```js
umzug.up('20141101203500-task'); // Runs just the passed migration
umzug.up(['20141101203500-task', '20141101203501-task-2']);
```

Running

#### Reverting executed migration
The `down` method can be used to revert the last executed migration.

```js
umzug.down().then(function (migration) {
  // "migration" will the name of the reverted migration.
});
```

It is possible to pass the name of a migration until which the migrations should be reverted. This allows the reverse of multiple migrations at once.

```js
umzug.down({ to: '20141031080000-task' }).then(function (migrations) {
  // "migrations" will be an Array with the names of all reverted migrations.
});
```

Reverting specific migrations while ignoring the right order, can be done like this:

```js
umzug.down({ migrations: ['20141101203500-task', '20141101203501-task-2'] });
```

There are also shorthand version of that:

```js
umzug.down('20141101203500-task'); // Runs just the passed migration
umzug.down(['20141101203500-task', '20141101203501-task-2']);
```

### Configuration

It is possible to configure *umzug* instance via passing an object to the constructor. The possible options are:

```js
{
  // The storage.
  // Possible values: 'json', 'sequelize', an object
  storage: 'json',

  // The options for the storage.
  // Check the available storages for further details.
  storageOptions: {},

  // The logging function.
  // A function that gets executed everytime migrations start and have ended.
  logging: false,

  // The name of the positive method in migrations.
  upName: 'up',

  // The name of the negative method in migrations.
  downName: 'down',

  migrations: {
    // The params that gets passed to the migrations.
    // Might be an array or a synchronous function which returns an array.
    params: [],

    // The path to the migrations directory.
    path: 'migrations',

    // The pattern that determines whether or not a file is a migration.
    pattern: /^\d+[\w-]+\.js$/,

    // A function that receives and returns the to be executed function.
    // This can be used to modify the function.
    wrap: function (fun) { return fun; }
  }
}
```

## License
MIT
