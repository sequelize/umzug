This example shows how ECMAScript modules can be used with umzug. See the `migrations.resolve` option passed to the Umzug constructor.

Note that `.mjs` migrations are resolved using `import(...)` and others are resolved using `require(...)`. If you're using a setup like this one, it's recommended to use either the `.cjs` or `.mjs` extensions rather than `.js` to make sure there's no ambiguity.

Also note that you may not need to use `createRequire` like this example does, depending on which dependencies you're using.

Usage example:

```bash
node umzug.mjs --help

node umzug.mjs up
node umzug.mjs down

node umzug.mjs create --name my-new-migration.mjs
node umzug.mjs create --name my-new-migration.cjs
```
