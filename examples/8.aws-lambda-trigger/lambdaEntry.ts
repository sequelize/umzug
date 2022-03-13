require('ts-node/register');
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { Context } from 'aws-lambda';
import * as serverlessExpress from 'aws-serverless-express';
import * as express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { eventContext } from 'aws-serverless-express/middleware';
import { AppModule } from './app.module';
import sharedBootstrap from './sharedBootstrap';
import { AppService } from './app.service';
/* eslint-disable @typescript-eslint/no-var-requires */
const { sprintf } = require('sprintf-js');
const excluded = [null, undefined, ''];

let lambdaProxy: Server;
const LOG_MESSAGE_RECEIVED = 'Received message: %s';
const LOG_WRONG_EVENT_TYPE =
  'Message for Notification not processed, wrong eventtype found: %s in %s';

async function bootstrap() {
  console.log('Calling bootstrap');
  const expressServer = express();
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressServer),
  );
  nestApp.use(eventContext());
  sharedBootstrap(nestApp);
  await nestApp.init();

  try {
    // Write a function in Service (ex: purhaslistservice) and trigger the service with umzug up from here.
    const migrateResult1 =  await nestApp.get(AppService).migrate('down');
    console.log(migrateResult1);
    const migrateResult2 =  await nestApp.get(AppService).migrate('up');
    console.log(migrateResult2);
  } catch (err) {
    throw err;
  }
  return serverlessExpress.createServer(expressServer);
}

export const handler = (event: any, context: Context) => {
   if (!lambdaProxy) {
    bootstrap().then((server) => {
      lambdaProxy = server;
      serverlessExpress.proxy(lambdaProxy, event, context);
    });
  } else {
    serverlessExpress.proxy(lambdaProxy, event, context);
  }
};
