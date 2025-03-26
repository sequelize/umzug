import {createCli, type TrpcCliRunParams} from 'trpc-cli'
import {createMigratorRouter, migratorTrpc} from './router'
import type {Umzug} from './umzug'

export class UmzugCLI {
  cli: ReturnType<typeof createCli>

  constructor(readonly umzug: Umzug) {
    this.cli = createCli({
      router: createMigratorRouter(
        migratorTrpc.procedure.use(async ({ctx, next}) => {
          return next({ctx: {...ctx, migrator: umzug}})
        }),
      ),
    })
  }

  async run(params: TrpcCliRunParams) {
    return this.cli.run(params)
  }
}
