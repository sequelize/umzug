import {z, createTrpc} from 'trpc-cli'
import {MigrateUpOptions, MigrateDownOptions} from './types'
import {Umzug as Migrator} from './umzug'

export interface MigratorRouterContext {
  migrator: Migrator
}

/** Helper type that IMO should exist in trpc. Basically a type which a trpc-procedure with context of type `Ctx` will satisfy */
export type TRPCProcedureLike<Ctx> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: (resolver: (opts: {ctx: Ctx; input: any}) => any) => any
}

/** Parameters needed for a helper function returning a router, which can be used as a sub-router for another. */
export interface TRPCHelperParams<Ctx> {
  /** The `trpc.procedure` function. A middleware can be used to align context types. */
  procedure: TRPCProcedureLike<Ctx>
}

export const migratorTrpc = createTrpc<MigratorRouterContext>() satisfies TRPCHelperParams<MigratorRouterContext> // use `satisfies` to make sure the `TRPCProcedureLike` type helper is correct

/**
 * Get a router with procedures needed to manage migrations.
 *
 * @param procedure - TRPC procedure builder for the router this will be attached to. Must have the correct context type
 *
 * @example
 * import {createMigratorRouter, Migrator} from 'umzug'
 * import {initTRPC} from '@trpc/server'
 *
 * const t = initTRPC.context<YourAppContext>().create()
 *
 * export const yourAppRouter = t.router({
 *   yourProcedeure: t.procedure.query(async () => 'Hello, world!'),
 *   migrations: getMigrationsRouter(),
 * })
 *
 * function getMigrationsRouter() {
 *   return createMigratorRouter(
 *     t.procedure.use(async ({ctx, next}) => {
 *       return next({
 *         ctx: {
 *           migrator: new Migrator(___),
 *           confirm: async (sql: string) => {
 *             return ctx.whitelistedSql.includes(sql)
 *           },
 *         }
 *       })
 *     })
 *   )
 * }
 */
export const createMigratorRouter = (procedure: TRPCProcedureLike<MigratorRouterContext> = migratorTrpc.procedure) => {
  // Take advantage of trpc being overly lax about merging routers with different contexts: https://github.com/trpc/trpc/issues/4306
  // We have used the `TRPCProcedureLike` type to ensure that the context is correct for the procedure builder, and trpc will merge the routers without checking the context
  // This means any router with a different context type can use this helper to creater a migrations sub-router, by just defining a middleware that sets the correct context
  const trpc = {router: migratorTrpc.router, procedure: procedure} as typeof migratorTrpc

  const router = migratorTrpc.router({
    up: trpc.procedure
      .meta({description: 'Apply pending migrations'})
      .input(MigrateUpOptions)
      .mutation(async ({input, ctx}) => {
        return ctx.migrator.up(input)
      }),
    down: trpc.procedure
      .meta({description: 'Revert one or more migrations'})
      .input(
        MigrateDownOptions.transform(options =>
          options && 'to' in options && options.to === '0' ? {...options, to: 0} : options,
        ),
      )
      .mutation(async ({input, ctx}) => ctx.migrator.down(input)),
    create: trpc.procedure
      .meta({description: 'Create a new migration file'})
      .input(
        z.object({
          content: z.string().optional().describe('Content of the migration.'),
          name: z.string().describe('Name of the migration file.'),
        }),
      )
      .mutation(async ({input, ctx}) => {
        return ctx.migrator.create(input)
      }),
    pending: trpc.procedure
      .meta({description: 'List migrations due to be applied'})
      .query(async ({ctx}) => ctx.migrator.pending()),
    executed: trpc.procedure
      .meta({description: 'List migrations that have been applie'})
      .query(async ({ctx}) => ctx.migrator.pending()),
  })

  return router
}
