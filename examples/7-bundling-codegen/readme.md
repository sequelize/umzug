This example shows how Umzug can be used with a bundler like tsup, webpack, parcel, turbopack, microbundle, ncc, bun, esbuild, swc, etc. This scenario isn't really what Umzug was designed for, so it depends on the help of codegen tool.

Since we're going to be bundling this package, (maybe with the purpose of running migrations in another environment), we can't rely on "globbing" the filesystem. Here, [eslint-plugin-codegen](https://npmjs.com/package/eslint-plugin-codegen) is used to glob for the files when the linter runs, and barrel them into an object (see [barrel.ts](./barrel.ts)). That object can then be passed to the Umzug constructor directly as a list of migrations (see [umzug.ts](./umzug.ts)).

When a new migration file is added, the linter can ensure it is added to the barrel by running `eslint . --fix`.

To try out this example, which uses `tsup`, first install dependencies, then bundle and run the migrator:

```bash
npm install
npm run lint -- --fix # makes sure barrel is up to date
npm run build

node dist/umzug up # apply migrations

node dist/umzug create --name new-migration.ts --skip-verify # create a new migration file
npm run lint -- --fix # makes sure barrel is up to date
```

Since the codegen lint plugin just creates a simple JavaScript object using regular imports, the same technique can be used with any other bundling library (e.g. webpack, pkg etc.).
