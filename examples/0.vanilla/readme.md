This example shows the simplest possible, node-only setup for Umzug. No typescript, no database, no dependencies.

Note:
- The `context` for the migrations just contains a (gitignored) directory.
- The example migration just writes an empty file to the directory

```bash
node migrate --help # show CLI help

node migrate up # apply migrations
node migrate down # revert the last migration
node migrate create --name new-migration.js # create a new migration file

node migrate up # apply migrations again
node migrate down --to 0 # revert all migrations
```
