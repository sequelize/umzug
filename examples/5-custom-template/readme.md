This example shows how to use the filesystem to get a custom project-specific template, since the template included with umzug is pretty basic.

The implementation simply reads the template file from a predefined folder, but you could make the logic more complex if you wanted.

Usage:

```bash
node migrate create --name new-migration.ts
```
