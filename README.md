# Umzug [![Build Status](https://travis-ci.org/sequelize/umzug.svg?branch=master)](https://travis-ci.org/sequelize/umzug) [![npm version](https://badgen.net/npm/v/umzug)](https://www.npmjs.com/package/umzug)

Umzug is a framework-agnostic migration tool for Node. It provides a clean API for running and rolling back tasks.

_Note: master represents the next major version of umzug - v3 - which is currently in beta. For the stable version, please refer to the [v2.x branch](https://github.com/sequelize/umzug/tree/v2.x)._

## Highlights

* Written in TypeScript
	* Built-in typings
	* Auto-completion right in your IDE
	* Documentation right in your IDE
* Programmatic API for migrations
* Database agnostic
* Supports logging of migration process
* Supports multiple storages for migration data

## Documentation

### Minimal Example

The following example uses a Sqlite database through sequelize and persists the migration data in the database itself through the sequelize storage.

* **`index.js`**:

```js
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

const sequelize = new Sequelize({ dialect: 'sqlite', storage: './db.sqlite' });

const umzug = new Umzug({
  migrations: {
    path: './migrations',
    params: [
      sequelize.getQueryInterface()
    ]
  },
  storage: new SequelizeStorage({ sequelize })
});

(async () => {
  // Checks migrations and run them if they are not already applied. To keep
  // track of the executed migrations, a table (and sequelize model) called SequelizeMeta
  // will be automatically created (if it doesn't exist already) and parsed.
  await umzug.up();
})();
```

* **`migrations/00_initial.js`**:

```js
const { Sequelize } = require('sequelize');

async function up(queryInterface) {
	await queryInterface.createTable('users', {
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
	});
}

async function down(queryInterface) {
	await queryInterface.dropTable('users');
}

module.exports = { up, down };
```

See [this test](./test/test.ts) for another example of Umzug usage.

### Usage

#### Installation

Umzug is available on npm:

```bash
npm install umzug
```

#### Umzug instance

It is possible to configure an Umzug instance by passing an object to the constructor.

```js
const { Umzug } = require('umzug');
const umzug = new Umzug({ /* ... options ... */ });
```

Detailed documentation for these options are in the `UmzugConstructorOptions` TypeScript interface, which can be found in [src/types.ts](./src/types.ts).

#### Executing migrations

The `execute` method is a general purpose function that runs for every specified migrations the respective function.

```js
const migrations = await umzug.execute({
  migrations: ['some-id', 'some-other-id'],
  method: 'up'
});
// returns an array of all executed/reverted migrations.
```

#### Getting all pending migrations

You can get a list of pending (i.e. not yet executed) migrations with the `pending()` method:

```js
const migrations = await umzug.pending();
// returns an array of all pending migrations.
```

#### Getting all executed migrations

You can get a list of already executed migrations with the `executed()` method:

```js
const migrations = await umzug.executed();
// returns an array of all already executed migrations
```

#### Executing pending migrations

The `up` method can be used to execute all pending migrations.

```js
const migrations = await umzug.up();
// returns an array of all executed migrations
```

It is also possible to pass the name of a migration in order to just run the migrations from the current state to the passed migration name (inclusive).

```js
await umzug.up({ to: '20141101203500-task' });
```

You also have the ability to choose to run migrations *from* a specific migration, excluding it:

```js
await umzug.up({ from: '20141101203500-task' });
```

In the above example umzug will execute all the pending migrations found **after** the specified migration. This is particularly useful if you are using migrations on your native desktop application and you don't need to run past migrations on new installs while they need to run on updated installations.

You can combine `from` and `to` options to select a specific subset:

```js
await umzug.up({ from: '20141101203500-task', to: '20151201103412-items' });
```

Running specific migrations while ignoring the right order, can be done like this:

```js
await umzug.up({ migrations: ['20141101203500-task', '20141101203501-task-2'] });
```

There are also shorthand version of that:

```js
await umzug.up('20141101203500-task'); // Runs just the passed migration
await umzug.up(['20141101203500-task', '20141101203501-task-2']);
```

#### Reverting executed migration

The `down` method can be used to revert the last executed migration.

```js
const migration = await umzug.down();
// reverts the last migration and returns it.
```

It is possible to pass the name of a migration until which (inclusive) the migrations should be reverted. This allows the reverting of multiple migrations at once.

```js
const migrations = await umzug.down({ to: '20141031080000-task' });
// returns an array of all reverted migrations.
```

To revert all migrations, you can pass 0 as the `to` parameter:

```js
await umzug.down({ to: 0 });
```

Reverting specific migrations while ignoring the right order, can be done like this:

```js
await umzug.down({ migrations: ['20141101203500-task', '20141101203501-task-2'] });
```

There are also shorthand versions of that:

```js
await umzug.down('20141101203500-task'); // Runs just the passed migration
await umzug.down(['20141101203500-task', '20141101203501-task-2']);
```

### Migrations

There are two ways to specify migrations: via files or directly via an array of migrations.

#### Migration files

A migration file ideally exposes an `up` and a `down` async functions. They will perform the task of upgrading or downgrading the database.

```js
module.exports = {
  async up() {
    /* ... */
  },
  async down() {
    /* ... */
  }
};
```

Migration files should be located in the same directory, according to the info you gave to the `Umzug` constructor.

#### Direct migrations list

You can also specify directly a list of migrations to the `Umzug` constructor. We recommend the usage of the `Umzug.migrationsList()` function
as bellow:

```js
const { Umzug, migrationsList } = require('umzug');

const umzug = new Umzug({
  migrations: migrationsList(
    [
      {
        // the name of the migration is mandatory
        name: '00-first-migration',
        async up(queryInterface) { /* ... */ },
        async down(queryInterface) { /* ... */ }
      },
      {
        name: '01-foo-bar-migration',
        async up(queryInterface) { /* ... */ },
        async down(queryInterface) { /* ... */ }
      }
    ],
    // an optional list of parameters that will be sent to the `up` and `down` functions
    [
      sequelize.getQueryInterface()
    ]
  )
});
```

### Storages

Storages define where the migration data is stored.

#### JSON Storage

Using `JSONStorage` will create a JSON file which will contain an array with all the executed migrations. You can specify the path to the file. The default for that is `umzug.json` in the working directory of the process.

Detailed documentation for the options it can take are in the `JSONStorageConstructorOptions` TypeScript interface, which can be found in [src/storage/json.ts](./src/storage/json.ts).

#### Memory Storage

Using `memoryStorage` will store migrations with an in-memory array. This can be useful for proof-of-concepts or tests, since it doesn't interact with databases or filesystems.

It doesn't take any options, just import the `memoryStorage` function and call it to return a storage instance:

```typescript
import { Umzug, memoryStorage } from 'umzug'

const umguz = new Umzug({
  migrations: ...,
  storage: memoryStorage(),
})
```

#### Sequelize Storage

Using `SequelizeStorage` will create a table in your SQL database called `SequelizeMeta` containing an entry for each executed migration. You will have to pass a configured instance of Sequelize or an existing Sequelize model. Optionally you can specify the model name, table name, or column name. All major Sequelize versions are supported.

Detailed documentation for the options it can take are in the `_SequelizeStorageConstructorOptions` TypeScript interface, which can be found in [src/storage/sequelize.ts](./src/storage/sequelize.ts).

#### MongoDB Storage

Using `MongoDBStorage` will create a collection in your MongoDB database called `migrations` containing an entry for each executed migration. You will have either to pass a MongoDB Driver Collection as `collection` property. Alternatively you can pass a established MongoDB Driver connection and a collection name.

Detailed documentation for the options it can take are in the `MongoDBStorageConstructorOptions` TypeScript interface, which can be found in [src/storage/mongodb.ts](./src/storage/mongodb.ts).

#### Custom

In order to use a custom storage, you can pass your storage instance to Umzug constructor.

```js
class CustomStorage {
  constructor(...) {...}
  logMigration(...) {...}
  unlogMigration(...) {...}
  executed(...) {...}
}

const umzug = new Umzug({ storage: new CustomStorage(...) })
```

Your instance must adhere to the [UmzugStorage](./src/storages/type-helpers/umzug-storage.ts) interface. If you're using TypeScript you can ensure this at compile time, and get IDE type hints by importing the `UmzugStorage` interface:

```typescript
import { UmzugStorage } from 'umzug'

class CustomStorage implements UmzugStorage {
  /* ... */
}
```

### Events

Umzug is an [EventEmitter](https://nodejs.org/docs/latest-v10.x/api/events.html#events_class_eventemitter). Each of the following events will be called with `name` and `migration` as arguments. Events are a convenient place to implement application-specific logic that must run around each migration:

* `migrating` - A migration is about to be executed.
* `migrated` - A migration has successfully been executed.
* `reverting` - A migration is about to be reverted.
* `reverted` - A migration has successfully been reverted.

## License

See the [LICENSE file](./LICENSE)
