# Umzug [![Build Status](https://travis-ci.org/sequelize/umzug.svg?branch=master)](https://travis-ci.org/sequelize/umzug) [![npm version](https://badgen.net/npm/v/umzug)](https://www.npmjs.com/package/umzug)

The *umzug* lib is a framework agnostic migration tool for Node.JS. The tool itself is not specifically related to databases but basically provides a clean API for running and rolling back tasks.

* Programmatic API for migrations
* Database agnostic
* Supports logging of migration process
* Supports multiple storages for migration data
  
## Documentation

### Minimal Example

The following example uses a Sqlite database through sequelize and persists the migration data in the database itself through the sequelize storage.

`index.js`:

```javascript

const Sequelize = require('sequelize')
const path = require('path')
const Umzug = require('umzug')

// creates a basic sqlite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db.sqlite'
})

const umzug = new Umzug({
  migrations: {
    // indicates the folder containing the migration .js files
    path: path.join(__dirname, './migrations'),
    // inject sequelize's QueryInterface in the migrations
    params: [
      sequelize.getQueryInterface()
    ]
  },
  // indicates that the migration data should be store in the database
  // itself through sequelize. The default configuration creates a table
  // named `SequelizeMeta`.
  storage: 'sequelize',
  storageOptions: {
    sequelize: sequelize
  }
})

;(async () => {
  // checks migrations and run them if they are not already applied
  await umzug.up()
  console.log('All migrations performed successfully')
})()
```

`migrations/00_initial.js`:

```javascript

const Sequelize = require('sequelize')

// All migrations must provide a `up` and `down` async functions

module.exports = {
  // `query` was passed in the `index.js` file
  up: async (query) => {
    await query.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    })
  },
  down: async (query) => {
    await query.dropTable('users')
  }
}
```

### Usage

#### Installation
The *umzug* lib is available on npm:

```js
npm install umzug
```

#### Umzug instance

It is possible to configure *umzug* instance by passing an object to the constructor. The possible options are:

```js
const Umzug = require('umzug')

const umzug = new Umzug({
  // The storage.
  // Possible values: 'none', 'json', 'mongodb', 'sequelize', an argument for `require()`, including absolute paths
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

  // (advanced) you can pass an array of migrations built with `migrationsList()` instead of the options below
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
    wrap: function (fun) { return fun; },
    
    // A function that maps a file path to a migration object in the form
    // { up: Function, down: Function }. The default for this is to require(...)
    // the file as javascript, but you can use this to transpile TypeScript,
    // read raw sql etc.
    // See https://github.com/sequelize/umzug/tree/master/test/fixtures
    // for examples.
    customResolver: function (sqlPath)  {
        return { up: () => sequelize.query(require('fs').readFileSync(sqlPath, 'utf8')) }
    }
  }
})
```

#### Executing migrations

The `execute` method is a general purpose function that runs for every specified migrations the respective function.

```js
const migrations = await umzug.execute({
  migrations: ['some-id', 'some-other-id'],
  method: 'up'
})
// returns an array of all executed/reverted migrations.
```

#### Getting all pending migrations

You can get a list of pending/not yet executed migrations like this:

```js
const migrations = await umzug.pending()
// returns an array of all pending migrations.
```

#### Getting all executed migrations

You can get a list of already executed migrations like this:

```js
const migrations = await umzug.executed()
// returns an array of all already executed migrations
```

#### Executing pending migrations

The `up` method can be used to execute all pending migrations.

```js
const migrations = await umzug.up()
// returns an array of all executed migrations
```

It is also possible to pass the name of a migration in order to just run the migrations from the current state to the passed migration name (inclusive).

```js
await umzug.up({ to: '20141101203500-task' })
```

You also have the ability to choose to run migrations *from* a specific migration, excluding it:

```js
await umzug.up({ from: '20141101203500-task' })
```

In the above example umzug will execute all the pending migrations found **after** the specified migration. This is particularly useful if you are using migrations on your native desktop application and you don't need to run past migrations on new installs while they need to run on updated installations.

You can combine `from` and `to` options to select a specific subset:

```js
await umzug.up({ from: '20141101203500-task', to: '20151201103412-items' })
```

Running specific migrations while ignoring the right order, can be done like this:

```js
await umzug.up({ migrations: ['20141101203500-task', '20141101203501-task-2'] })
```

There are also shorthand version of that:

```js
await umzug.up('20141101203500-task'); // Runs just the passed migration
await umzug.up(['20141101203500-task', '20141101203501-task-2']);
```

#### Reverting executed migration

The `down` method can be used to revert the last executed migration.

```js
const migration = await umzug.down()
// returns the reverted migration.
```

It is possible to pass the name of a migration until which (inclusive) the migrations should be reverted. This allows the reverting of multiple migrations at once.

```js
const migrations = await umzug.down({ to: '20141031080000-task' })
// returns an array of all reverted migrations.
```

To revert all migrations, you can pass 0 as the `to` parameter:

```js
await umzug.down({ to: 0 })
```

Reverting specific migrations while ignoring the right order, can be done like this:

```js
await umzug.down({ migrations: ['20141101203500-task', '20141101203501-task-2'] })
```

There are also shorthand version of that:

```js
await umzug.down('20141101203500-task') // Runs just the passed migration
await umzug.down(['20141101203500-task', '20141101203501-task-2'])
```

### Migrations

There are two ways to specify migrations.

#### Migration files

A migration file ideally exposes an `up` and a `down` async functions. They will perform the task of upgrading or downgrading the database.

```js

module.exports = {
  up: async () => {
    ...
  },
  down: async () => {
    ...
  },
};
```

Migration files should be located in the same directory, according to the info you gave to the `Umzug` constructor.

#### Direct migrations list

You can also specify directly a list of migrations to the `Umzug` constructor. We recommend the usage of the `Umzug.migrationsList()` function
as bellow:

```js
const umzug = new Umzug({
  migrations: Umzug.migrationsList([
    {
      // the name of the migration is mandatory
      name: '00-first-migration',
      up: ...,
      down: ...
    }
  ], 
  // a facultative list of parameters that will be sent to the `up` and `down` functions
  [sequelize.getQueryInterface()])
})
```

### Storages

Storages define where the migration data is stored.

#### JSON Storage

Using the `json` storage will create a JSON file which will contain an array with all the executed migrations. You can specify the path to the file. The default for that is `umzug.json` in the working directory of the process.

Options:

```js
{
  // The path to the json storage.
  // Defaults to process.cwd() + '/umzug.json';
  path: process.cwd() + '/db/sequelize-meta.json'
}
```

#### Sequelize Storage

Using the `sequelize` storage will create a table in your SQL database called `SequelizeMeta` containing an entry for each executed migration. You will have to pass a configured instance of Sequelize or an existing Sequelize model. Optionally you can specify the model name, table name, or column name. All major Sequelize versions are supported.

Options:

```js
{
  // The configured instance of Sequelize.
  // Optional if `model` is passed.
  sequelize: instance,

  // The to be used Sequelize model.
  // Must have column name matching `columnName` option
  // Optional if `sequelize` is passed.
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

#### MongoDB Storage

Using the `mongodb` storage will create a collection in your MongoDB database called `migrations` containing an entry for each executed migration. You will have either to pass a MongoDB Driver Collection as `collection` property. Alternatively you can pass a established MongoDB Driver connection and a collection name.

Options:

```js
{
  // a connection to target database established with MongoDB Driver
  connection: MongoDBDriverConnection,

  // name of migration collection in MongoDB
  collectionName: 'migrations',

  // reference to a MongoDB Driver collection
  collection: MongoDBDriverCollection
}
```

#### Custom

In order to use custom storage, you have two options:

##### Method 1: Pass instance to constructor

You can pass your storage instance to Umzug constructor.

```js
class CustomStorage {
  constructor(...) {...}
  logMigration(...) {...}
  unlogMigration(...) {...}
  executed(...) {...}
}
let umzug = new Umzug({ storage: new CustomStorage(...) })
```

##### Method 2: Require external module from npmjs.com

Create and publish a module which has to fulfill the following API. You can just pass the name of the module to the configuration and *umzug* will require it accordingly. The API that needs to be exposed looks like this:

```js
module.exports = class MyStorage {
  constructor({ option1: 'defaultValue1' } = {}) {
    this.option1 = option1;
  },

  async logMigration(migrationName) {
    // This function logs a migration as executed.
    // It will get called once a migration was
    // executed successfully.
  },

  async unlogMigration(migrationName) {
    // This function removes a previously logged migration.
    // It will get called once a migration has been reverted.
  },

  async executed() {
    // This function lists the names of the logged
    // migrations. It will be used to calculate
    // pending migrations. The result has to be an
    // array with the names of the migration files.
  }
}
```

### Events

Umzug is an EventEmitter. Each of the following events will be called with `name, migration` as arguments. Events are a convenient place to implement application-specific logic that must run around each migration:

* *migrating* - A migration is about to be executed.
* *migrated* - A migration has successfully been executed.
* *reverting* - A migration is about to be reverted.
* *reverted* - A migration has successfully been reverted.

## Examples

* [sequelize-migration-hello](https://github.com/abelnation/sequelize-migration-hello)

## License

See the [LICENSE file](./LICENSE)
