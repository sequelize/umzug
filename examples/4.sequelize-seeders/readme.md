This example shows how to use umzug for seeding data into a database.

There's nothing very special about it. It's just two separate umzug instances created - one for migrations, and one for seeders, along with `seed.js` and `migrate.js` scripts to run them.

Usage example:

```bash
# show help for each script
node migrate --help
node seed --help

node seed up || echo failed # will fail, since tables haven't been created yet

node migrate up # creates tables
node seed up # inserts seed data

node seed down --to 0 # removes all seed data

node seed create --name new-seed-data.ts # create a placeholder migration file for inserting more seed data.
```
