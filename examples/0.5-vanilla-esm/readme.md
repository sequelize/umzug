This example shows the simplest possible, node-only setup for Umzug. No typescript, no database, no dependencies.

Note:
- The `context` for the migrations just contains a (gitignored) directory.
- The example migration just writes an empty file to the directory

```bash
node migrate.mjs --help # show CLI help

node migrate.mjs up # apply migrations
node migrate.mjs down # revert the last migration
node migrate.mjs create --name new-migration.mjs # create a new migration file

node migrate.mjs up # apply migrations again
node migrate.mjs down --to 0 # revert all migrations
```
