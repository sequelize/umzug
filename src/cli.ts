import {createCli} from 'trpc-cli'
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

  async run(params: {argv?: string[]; logger?: typeof console; process?: Pick<typeof process, 'exit'>}) {
    return this.cli.run(params)
  }
}
