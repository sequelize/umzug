This example demonstrates how to set up umzug with a raw sql client.

Note: this is really just a toy example to show how you can use pre-existing sql queries. If you want a raw sql migrator for postgres, see [@slonik/migrator](https://npmjs.com/package/@slonik/migrator). It uses umzug in a similar way, with [slonik](https://npmjs.com/package/slonik) as the underlying client, and it adds transactions, locking, supports typescript/javascript alongside sql, and some additional safety checks.
