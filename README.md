# Umzug

[![Build Status](https://badgen.net/github/checks/sequelize/umzug/master)](https://github.com/sequelize/umzug/actions?query=workflow%3ACI)
[![npm (stable)](https://badgen.net/npm/v/umzug)](https://www.npmjs.com/package/umzug)
[![npm (beta)](https://badgen.net/npm/v/umzug/beta)](https://www.npmjs.com/package/umzug/v/beta)
[![npm (downloads)](https://badgen.net/npm/dm/umzug)](https://npmjs.com/package/umzug)

Umzug is a framework-agnostic migration tool for Node. It provides a clean API for running and rolling back tasks.

_Note: master represents the next major version of umzug - v3 - which is currently in beta. For the stable version, please refer to the [v2.x branch](https://github.com/sequelize/umzug/tree/v2.x)._

To install the v3-beta package:

```
npm install umzug@beta
```

To install the stable package (v2.x):

```
npm install umzug
```

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

```js
// index.js
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

const sequelize = new Sequelize({ dialect: 'sqlite', storage: './db.sqlite' });

const umzug = new Umzug({
  migrations: { glob: 'migrations/*.js' },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

(async () => {
  // Checks migrations and run them if they are not already applied. To keep
  // track of the executed migrations, a table (and sequelize model) called SequelizeMeta
  // will be automatically created (if it doesn't exist already) and parsed.
  await umzug.up();
})();
```

```js
// migrations/00_initial.js

const { Sequelize } = require('sequelize');

async function up({ context: queryInterface }) {
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

async function down({ context: queryInterface }) {
	await queryInterface.dropTable('users');
}

module.exports = { up, down };
```

Note that we renamed the `context` argument to `queryInterface` for clarity. The `context` is whatever we specified when creating the Umzug instance in `index.js`.

<details>
<summary>You can also write your migrations in typescript by using `ts-node` in the entrypoint:</summary>

```typescript
// index.ts
require('ts-node/register')

import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';

const sequelize = new Sequelize({ dialect: 'sqlite', storage: './db.sqlite' });

const umzug = new Umzug({
  migrations: { glob: 'migrations/*.ts' },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = typeof umzug._types.migration;

(async () => {
  await umzug.up();
})();
```

```typescript
// migrations/00_initial.ts
import type { Migration } from '..';

// types will now be available for `queryInterface`
export const up: Migration = ({ context: queryInterface }) => queryInterface.createTable(...)
export const down: Migration = ({ context: queryInterface }) => queryInterface.dropTable(...)
```
</details>

See [these tests](./test/umzug.test.ts) for more examples of Umzug usage, including:

- passing `ignore` and `cwd` parameters to the glob instructions
- customising migrations ordering
- finding migrations from multiple different directories
- using non-js file extensions via a custom resolver, e.g. `.sql`

### Usage

#### Installation

The beta version of Umzug is available on npm by specifying the correct tag:

```bash
npm install umzug@beta
```

#### Umzug instance

It is possible to configure an Umzug instance by passing an object to the constructor.

```js
const { Umzug } = require('umzug');
const umzug = new Umzug({ /* ... options ... */ });
```

Detailed documentation for these options are in the `UmzugConstructorOptions` TypeScript interface, which can be found in [src/types.ts](./src/types.ts).

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


Running specific migrations while ignoring the right order, can be done like this:

```js
await umzug.up({ migrations: ['20141101203500-task', '20141101203501-task-2'] });
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

Migration files can be located anywhere - they will typically be loaded according to a glob pattern provided to the `Umzug` constructor.

#### Direct migrations list

You can also specify directly a list of migrations to the `Umzug` constructor:

```js
const { Umzug } = require('umzug');

const umzug = new Umzug({
  migrations: [
    {
      // the name of the migration is mandatory
      name: '00-first-migration',
      async up({ context }) { /* ... */ },
      async down({ context }) { /* ... */ }
    },
    {
      name: '01-foo-bar-migration',
      async up({ context }) { /* ... */ },
      async down({ context }) { /* ... */ }
    }
  ],
  context: sequelize.getQueryInterface(),
  logger: console,
});
```

To load migrations in another format, you can use the `resolve` function:

```js
const { Umzug } = require('umzug')
const { Sequelize } = require('sequelize')
const fs = require('fs')

const umzug = new Umzug({
  migrations: {
    glob: 'migrations/*.up.sql',
    resolve: ({ name, path, context: sequelize }) => ({
      name,
      up: async () => {
        const sql = fs.readFileSync(path).toString()
        return sequelize.query(sql)
      },
      down: async () => {
        // Get the corresponding `.down.sql` file to undo this migration
        const sql = fs.readFileSync(path.replace('.up.sql', '.down.sql')).toString()
        return sequelize.query(sql)
      }
    })
  },
  context: new Sequelize(...),
  logger: console,
});
```

You can support mixed migration file types, and use umzug's default resolver for javascript/typescript:

```js
const { Umzug } = require('umzug')
const { Sequelize } = require('sequelize')
const fs = require('fs')

const umzug = new Umzug({
  migrations: {
    glob: 'migrations/*.{js,ts,up.sql}',
    resolve: (params) => {
      if (!params.path.endsWith('.sql')) {
        return Umzug.defaultResolver(params)
      }
      const { context: sequelize } = params
      return {
        name: params.name,
        up: async () => {
          const sql = fs.readFileSync(params.path).toString()
          return sequelize.query(sql)
        },
        down: async () => {
          // Get the corresponding `.down.sql` file to undo this migration
          const sql = fs.readFileSync(params.path.replace('.up.sql', '.down.sql')).toString()
          return sequelize.query(sql)
        }
      }
    },
  },
  logger: console,
  context: new Sequelize(...),
});
```

The glob syntax allows loading migrations from multiple locations:

```js
const { Umzug } = require('umzug')
const { Sequelize } = require('sequelize')

const umzug = new Umzug({
  migrations: {
    glob: '{first-folder/*.js,second-folder-with-different-naming-convention/*.js}',
  },
  context: new Sequelize(...),
  logger: console,
});
```

Note on migration file sorting:

- file matches, found using [glob](https://npmjs.com/package/glob), will be lexicographically sorted based on their paths
  - so if your migrations are `one/m1.js`, `two/m2.js`, `three/m3.js`, the resultant order will be `one/m1.js`, `three/m3.js`, `two/m2.js`
  - similarly, if your migrations are called `m1.js`, `m2.js`, ... `m10.js`, `m11.js`, the resultant ordering will be `m1.js`, `m10.js`, `m11.js`, ... `m2.js`
- The easiest way to deal with this is to ensure your migrations appear in a single folder, and their paths match lexicographically with the order they should run in
- If this isn't possible, the ordering can be customised using `.extend(...)` (see below)

### Upgrading from v2.x

The Umzug class should be imported as a named import, i.e. `import { Umzug } from 'umzug'`.

The `MigrationMeta` type, which is returned by `umzug.executed()` and `umzug.pending()`, no longer has a `file` property - it has a `name` and *optional* `path` - since migrations are not necessarily bound to files on the file system.

The `migrations.glob` parameter replaces `path`, `pattern` and `traverseDirectories`. It can be used, in combination with `cwd` and `ignore` to do much more flexible file lookups. See https://npmjs.com/package/glob for more information on the syntax.

The `migrations.resolve` parameter replaces `customResolver`. Explicit support for `wrap` and `nameFormatter` has been removed - these can be easily implemented in a `resolve` function.

The constructor option `logging` is replaced by `logger` to allow for `warn` and `error` messages in future. NodeJS's global `console` object can be passed to this. To disable logging, replace `logging: false` with `logger: undefined`.

The `Umzug#execute` method is removed. Use `Umzug#up` or `Umzug#down`.

The options for `Umguz#up` and `Umzug#down` have changed:
- `umzug.up({ to: 'some-name' })` and `umzug.down({ to: 'some-name' })` are still valid.
- `umzug.up({ from: '...' })` and `umzug.down({ from: '...' })` are no longer supported. To run migrations out-of-order (which is not generally recommended), you can explicitly use `umzug.up({ migrations: ['...'] })` and `umzug.down({ migrations: ['...'] })`.
- name matches must be exact. `umzug.up({ to: 'some-n' })` will no longer match a migration called `some-name`.
- `umzug.down({ to: 0 })` is still valid but `umzug.up({ to: 0 })` is not.
- `umzug.up({ migrations: ['m1', 'm2'] })` is still valid but the shorthand `umzug.up(['m1', 'm2'])` has been removed.
- `umzug.down({ migrations: ['m1', 'm2'] })` is still valid but the shorthand `umzug.down(['m1', 'm2'])` has been removed.
- `umzug.up({ migrations: ['m1', 'already-run'] })` will throw an error, if `already-run` is not found in the list of pending migrations.
- `umzug.down({ migrations: ['m1', 'has-not-been-run'] })` will throw an error, if `has-not-been-run` is not found in the list of executed migrations.
- `umzug.up({ migrations: ['m1', 'm2'], rerun: 'ALLOW' })` will re-apply migrations `m1` and `m2` even if they've already been run.
- `umzug.up({ migrations: ['m1', 'm2'], rerun: 'SKIP' })` will skip migrations `m1` and `m2` if they've already been run.
- `umzug.down({ migrations: ['m1', 'm2'], rerun: 'ALLOW' })` will "revert" migrations `m1` and `m2` even if they've never been run.
- `umzug.down({ migrations: ['m1', 'm2'], rerun: 'SKIP' })` will skip reverting migrations `m1` and `m2` if they haven't been run or are already reverted.
- `umzug.up({ migrations: ['m1', 'does-not-exist', 'm2'] })` will throw an error if the migration name is not found. Note that the error will be thrown and no migrations run unless _all_ migration names are found - whether or not `rerun: 'ALLOW'` is added.

The `context` parameter replaces `params`, and is passed in as a property to migration functions as an options object, alongs side `name` and `path`. This means the signature for migrations, which in v2 was `(context) => Promise<void>`, has changed slightly in v3, to `({ name, path, context }) => Promise<void>`. The `resolve` function can also be used to upgrade your umzug version to v3 when you have existing v2-compatible migrations:

```js
const { Umzug } = require('umzug');

const umzug = new Umzug({
  migrations: {
    glob: 'migrations/umzug-v2-format/*.js',
    resolve: ({name, path, context}) => {
      // Adjust the migration from the new signature to the v2 signature, making easier to upgrade to v3
      const migration = require(path)
      return { name, up: async () => migration.up(context), down: async () => migration.down(context) }
    }
  },
  context: sequelize.getQueryInterface(),
  logger: console,
});
```

Similarly, you no longer need `migrationSorting`, you can use `Umzug#extend` to manipulate migration lists directly:

```js
const { Umzug } = require('umzug');

const umzug =
  new Umzug({
    migrations: { glob: 'migrations/**/*.js' },
    context: sequelize.getQueryInterface(),
  })
  .extend(migrations => migrations.sort((a, b) => b.path.localeCompare(a.path)));
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

const umzug = new Umzug({
  migrations: ...,
  storage: memoryStorage(),
  logger: console,
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

const umzug = new Umzug({ storage: new CustomStorage(...), logger: console })
```

Your instance must adhere to the [UmzugStorage](./src/storage/contract.ts) interface. If you're using TypeScript you can ensure this at compile time, and get IDE type hints by importing it:

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
