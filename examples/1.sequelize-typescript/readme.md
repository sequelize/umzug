This example shows how migrations can be written in typescript and run with the help of `ts-node`.

Note:
- The entrypoint, `migrate.js`, calls `require('ts-node/register')` before requiring the `umzug.ts` module. This enables loading of typescript modules directly, and avoids the complexity of having a separate compilation target folder.
- `umzug.ts` exports a migration type with `export type Migration = typeof migrator._types.migration;`. This allows typescript migration files to get strongly typed parameters by importing it. See also the [custom template example](../5.custom-template) to see how to setup a template to include this automatically in every new migration.

```bash
node migrate --help # show CLI help

node migrate up # apply migrations
node migrate down # revert the last migration
node migrate down --to 0 # revert all migrations
node migrate up --step 2 # run only two migrations

node migrate create --name my-migration.ts # create a new migration file
```
