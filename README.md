# Umzug

[![Build Status](https://badgen.net/github/checks/sequelize/umzug/main)](https://github.com/sequelize/umzug/actions?query=workflow%3ACI)
[![npm](https://badgen.net/npm/v/umzug)](https://www.npmjs.com/package/umzug)
[![npm (downloads)](https://badgen.net/npm/dm/umzug)](https://npmjs.com/package/umzug)

Umzug is a framework-agnostic migration tool for Node. It provides a clean API for running and rolling back tasks.

## Highlights

* Written in TypeScript
	* Built-in typings
	* Auto-completion right in your IDE
	* Documentation right in your IDE
* Programmatic API for migrations
* Built-in [CLI](#cli)
* Database agnostic
* Supports logging of migration process
* Supports multiple storages for migration data
* [Usage examples](./examples)

## Documentation

_Note: these are the docs for the latest version of umzug, which has several breaking changes from v2.x. See [the upgrading section](#upgrading-from-v2x) for a migration guide. For the previous stable version, please refer to the [v2.x branch](https://github.com/sequelize/umzug/tree/v2.x)._

### Minimal Example

The following example uses a Sqlite database through sequelize and persists the migration data in the database itself through the sequelize storage. There are several more involved examples covering a few different scenarios in the [examples folder](./examples). Note that although this uses Sequelize, Umzug isn't coupled to Sequelize, it's just one of the (most commonly-used) supported storages.

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

Umzug is available on npm by specifying the correct tag:

```bash
npm install umzug
```

#### Umzug instance

It is possible to configure an Umzug instance by passing an object to the constructor.

```js
const { Umzug } = require('umzug');
const umzug = new Umzug({ /* ... options ... */ });
```

Detailed documentation for these options are in the `UmzugOptions` TypeScript interface, which can be found in [src/types.ts](./src/types.ts).

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

To limit the number of migrations that are run, `step` can be used:

```js
// This will run the next two migrations
await umzug.up({ step: 2 })
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

To revert more than one migration, you can use `step`:

```js
// This will revert the last two migrations
await umzug.down({ step: 2 });
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

#### Modifying the parameters passed to your migration methods

Sometimes it's necessary to modify the parameters `umzug` will pass to your migration methods when the library calls the `up` and `down` methods for each migration. This is the case when using migrations currently generated using `sequilize-cli`. In this case you can use the `resolve` fuction during migration configuration to determine which parameters will be passed to the relevant method

```js
import { Sequelize } from 'sequelize'
import { Umzug, SequelizeStorage } from 'umzug'

const sequelize = new Sequelize(
    ...
)

const umzug = new Umzug({
    migrations: {
        glob: 'migrations/*.js',
        resolve: ({ name, path, context }) => {
            const migration = require(path)
            return {
                // adjust the parameters Umzug will
                // pass to migration methods when called
                name,
                up: async () => migration.up(context, Sequelize),
                down: async () => migration.down(context, Sequelize),
            }
        },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
});
```

#### Additional migration configuration options

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
- If this isn't possible, the ordering can be customised using a new instance (previously, in the beta release for v3, this could be done with `.extend(...)` - see below for example using a new instance)

### Upgrading from v2.x

The Umzug class should be imported as a named import, i.e. `import { Umzug } from 'umzug'`.

The `MigrationMeta` type, which is returned by `umzug.executed()` and `umzug.pending()`, no longer has a `file` property - it has a `name` and *optional* `path` - since migrations are not necessarily bound to files on the file system.

The `migrations.glob` parameter replaces `path`, `pattern` and `traverseDirectories`. It can be used, in combination with `cwd` and `ignore` to do much more flexible file lookups. See https://npmjs.com/package/glob for more information on the syntax.

The `migrations.resolve` parameter replaces `customResolver`. Explicit support for `wrap` and `nameFormatter` has been removed - these can be easily implemented in a `resolve` function.

The constructor option `logging` is replaced by `logger` to allow for `warn` and `error` messages in future. NodeJS's global `console` object can be passed to this. To disable logging, replace `logging: false` with `logger: undefined`.

Events have moved from the default nodejs `EventEmitter` to [emittery](https://www.npmjs.com/package/emittery). It has better design for async code, a less bloated API surface and strong types. But, it doesn't allow passing multiple arguments to callbacks, so listeners have to change slightly, as well as `.addListener(...)` and `.removeListener(...)` no longer being supported (`.on(...)` and `.off(...)` should now be used):

Before:

```js
umzug.on('migrating', (name, m) => console.log({ name, path: m.path }))
```

After:

```js
umzug.on('migrating', ev => console.log({ name: ev.name, path: ev.path }))
```

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

The `context` parameter replaces `params`, and is passed in as a property to migration functions as an options object, alongs side `name` and `path`. This means the signature for migrations, which in v2 was `(context) => Promise<void>`, has changed slightly in v3, to `({ name, path, context }) => Promise<void>`.

#### Handling existing v2-format migrations

The `resolve` function can also be used to upgrade your umzug version to v3 when you have existing v2-compatible migrations:

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

Similarly, you no longer need `migrationSorting`, you can instantiate a new `Umzug` instance to manipulate migration lists directly:

```js
const { Umzug } = require('umzug');

const parent = new Umzug({
  migrations: { glob: 'migrations/**/*.js' },
  context: sequelize.getQueryInterface(),
})

const umzug = new Umzug({
  ...parent.options,
  migrations: ctx => (await parent.migrations()).sort((a, b) => b.path.localeCompare(a.path))
})
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

This library has been tested with sequelize v6. It may or may not work with lower versions - use at your own risk.

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

Umzug is an [emittery event emitter](https://www.npmjs.com/package/emittery). Each of the following events will be called with migration parameters as its payload (with `context`, `name`, and nullable `path` properties). Events are a convenient place to implement application-specific logic that must run around each migration:

* `migrating` - A migration is about to be executed.
* `migrated` - A migration has successfully been executed.
* `reverting` - A migration is about to be reverted.
* `reverted` - A migration has successfully been reverted.

These events run at the beginning and end of `up` and `down` calls. They'll receive an object containing a `context` property:

- `beforeCommand` - Before any command (`'up' | 'down' | 'executed' | 'pending'`) is run.
- `afterCommand` - After any command (`'up' | 'down' | 'executed' | 'pending'`) is run. Note: this will always run, even if the command throws an error.

The [`FileLocker` class](./src/file-locker.ts) uses `beforeAll` and `afterAll` to implement a simple filesystem-based locking mechanism.

All events are type-safe, so IDEs will prevent typos and supply strong types for the event payloads.

### Errors

When a migration throws an error, it will be wrapped in a `MigrationError` which captures the migration metadata (name, path etc.) as well as the original error message, and _will be rethrown_. In most cases, this is expected behaviour, and doesn't require any special handling beyond standard error logging setups.

If you expect failures and want to try to recover from them, you will need to try-catch the call to `umzug.up()`. You can access the original error from the `.cause` property if necessary:

```js
try {
  await umzug.up();
} catch (e) {
  if (e instanceof MigrationError) {
    const original = e.cause;
    // do something with the original error here
  }
  throw e;
}
```

Under the hood, [verror](https://npmjs.com/package/verror) is used to wrap errors.

### CLI

🚧🚧🚧 The CLI is new to Umzug v3. Feedback on it is welcome in [discussions](https://github.com/sequelize/umzug/discussions) 🚧🚧🚧

Umzug instances provide a `.runAsCLI()` method. When called, this method will automatically cause your program to become a complete CLI, with help text and such:

```js
// migrator.js
const { Umzug } = require('umzug')

const umzug = new Umzug({ ... })

exports.umzug = umzug

if (require.main === module) {
  umzug.runAsCLI()
}
```

#### CLI Usage

A script like the one above is now a runnable CLI program. You can run `node migrator.js --help` to see how to use it. It will print something like:

<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp} -->
```
usage: <script> [-h] <command> ...

Umzug migrator

Positional arguments:
  <command>
    up        Applies pending migrations
    down      Revert migrations
    pending   Lists pending migrations
    executed  Lists executed migrations
    create    Create a migration file

Optional arguments:
  -h, --help  Show this help message and exit.

For detailed help about a specific command, use: <script> <command> -h
```
<!-- codegen:end -->

#### Running migrations

`node migrator up` and `node migrator down` apply and revert migrations respectively. They're the equivalent of the `.up()` and `.down()` methods.

Use `node migrator up --help` and `node migrator down --help` for options (running "to" a specific migration, passing migration names to be run explicitly, and specifying the rerun behavior):

Up:
<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp, action: up} -->
```
usage: <script> up [-h] [--to NAME] [--step COUNT] [--name MIGRATION]
                   [--rerun {THROW,SKIP,ALLOW}]
                   

Performs all migrations. See --help for more options

Optional arguments:
  -h, --help            Show this help message and exit.
  --to NAME             All migrations up to and including this one should be 
                        applied.
  --step COUNT          Run this many migrations. If not specified, all will 
                        be applied.
  --name MIGRATION      Explicity declare migration name(s) to be applied.
  --rerun {THROW,SKIP,ALLOW}
                        Specify what action should be taken when a migration 
                        that has already been applied is passed to --name. 
                        The default value is "THROW".
```
<!-- codegen:end -->

Down:
<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp, action: down} -->
```
usage: <script> down [-h] [--to NAME] [--step COUNT] [--name MIGRATION]
                     [--rerun {THROW,SKIP,ALLOW}]
                     

Undoes previously-applied migrations. By default, undoes the most recent 
migration only. Use --help for more options. Useful in development to start 
from a clean slate. Use with care in production!

Optional arguments:
  -h, --help            Show this help message and exit.
  --to NAME             All migrations up to and including this one should be 
                        reverted. Pass "0" to revert all.
  --step COUNT          Run this many migrations. If not specified, one will 
                        be reverted.
  --name MIGRATION      Explicity declare migration name(s) to be reverted.
  --rerun {THROW,SKIP,ALLOW}
                        Specify what action should be taken when a migration 
                        that has already been reverted is passed to --name. 
                        The default value is "THROW".
```
<!-- codegen:end -->


#### Listing migrations

```bash
node migrator pending # list migrations yet to be run
node migrator executed # list migrations that have already run

node migrator pending --json # list pending migrations including names and paths, in a json array format
node migrator executed --json # list executed migrations including names and paths, in a json array format

node migrator pending --help # show help/options
node migrator executed --help # show help/options
```

<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp, action: pending} -->
```
usage: <script> pending [-h] [--json]

Prints migrations returned by `umzug.pending()`. By default, prints migration 
names one per line.

Optional arguments:
  -h, --help  Show this help message and exit.
  --json      Print pending migrations in a json format including names and 
              paths. This allows piping output to tools like jq. Without this 
              flag, the migration names will be printed one per line.
```
<!-- codegen:end -->

<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp, action: executed} -->
```
usage: <script> executed [-h] [--json]

Prints migrations returned by `umzug.executed()`. By default, prints 
migration names one per line.

Optional arguments:
  -h, --help  Show this help message and exit.
  --json      Print executed migrations in a json format including names and 
              paths. This allows piping output to tools like jq. Without this 
              flag, the migration names will be printed one per line.
```
<!-- codegen:end -->

#### Creating migrations - CLI

Usually, migrations correspond to files on the filesystem. The CLI exposes a way to create migration files easily:

```bash
node migrator create --name my-migration.js
```

This will create a file with a name like `2000.12.25T12.34.56.my-migration.js` in the same directory as the most recent migration file. If it's the very first migration file, you need to specify the folder explicitly:

```bash
node migrator create --name my-migration.js --folder path/to/directory
```

The timestamp prefix can be customized to be date-only or omitted, but be aware that it's strongly recommended to ensure your migrations are lexicographically sortable so it's easy for humans and tools to determine what order they should run in - so the default prefix is recommended.

This will generate a migration file called `<<timestamp>>.my-migration.js` with the default migration template for `.js` files that ships with Umzug.

Umzug also ships with default templates for [`.ts`, `.cjs`, `.mjs` and `.sql` files](./src/templates.ts). Umzug will choose the template based on the extension you provide in `name`.

You can specify a custom template for your project when constructing an umzug instance via the `template` option. It should be a function which receives a filepath string, and returns an array of `[filepath, content]` pairs. Usually, just one pair is needed, but a second could be used to include a "down" migration in a separate file:

```js
const umzug = new Umzug({
  migrations: ...,
	create: {
		template: filepath => [
			[filepath, fs.readFileSync('path/to/your/template/file').toString()],
		]
	}
})
```

The create command includes some safety checks to make sure migrations aren't created with ambiguous ordering, and that they will be picked up by umzug when applying migrations. The first pair is expected to be the "up" migration file, and to be picked up by the `pending` command.

Use `node migrator create --help` for more options:

<!-- codegen:start {preset: custom, source: ./codegen.js, export: cliHelp, action: create} -->
```
usage: <script> create [-h] --name NAME [--prefix {TIMESTAMP,DATE,NONE}]
                       [--folder PATH] [--allow-extension EXTENSION]
                       [--skip-verify] [--allow-confusing-ordering]
                       

Generates a placeholder migration file using a timestamp as a prefix. By 
default, mimics the last existing migration, or guesses where to generate the 
file if no migration exists yet.

Optional arguments:
  -h, --help            Show this help message and exit.
  --name NAME           The name of the migration file. e.g. my-migration.js, 
                        my-migration.ts or my-migration.sql. Note - a prefix 
                        will be added to this name, usually based on a 
                        timestamp. See --prefix
  --prefix {TIMESTAMP,DATE,NONE}
                        The prefix format for generated files. TIMESTAMP uses 
                        a second-resolution timestamp, DATE uses a 
                        day-resolution timestamp, and NONE removes the prefix 
                        completely. The default value is "TIMESTAMP".
  --folder PATH         Path on the filesystem where the file should be 
                        created. The new migration will be created as a 
                        sibling of the last existing one if this is omitted.
  --allow-extension EXTENSION
                        Allowable extension for created files. By default .js,
                         .ts and .sql files can be created. To create txt 
                        file migrations, for example, you could use '--name 
                        my-migration.txt --allow-extension .txt' This 
                        parameter may alternatively be specified via the 
                        UMZUG_ALLOW_EXTENSION environment variable.
  --skip-verify         By default, the generated file will be checked after 
                        creation to make sure it is detected as a pending 
                        migration. This catches problems like creation in the 
                        wrong folder, or invalid naming conventions. This 
                        flag bypasses that verification step.
  --allow-confusing-ordering
                        By default, an error will be thrown if you try to 
                        create a migration that will run before a migration 
                        that already exists. This catches errors which can 
                        cause problems if you change file naming conventions. 
                        If you use a custom ordering system, you can disable 
                        this behavior, but it's strongly recommended that you 
                        don't! If you're unsure, just ignore this option.
```
<!-- codegen:end -->

### Creating migrations - API

Umzug includes an optional helper for generating migration files. It's often most convenient to create files using the [CLI helper](#creating-migrations---cli), but the equivalent API also exists on an umzug instance:

```js
await umzug.create({ name: 'my-new-migration.js' })
```

## License

See the [LICENSE file](./LICENSE)
