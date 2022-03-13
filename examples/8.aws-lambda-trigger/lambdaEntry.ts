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
import { AppController } from './app.controller';
import { PurchaseListController } from './purchaselist/purchaselist.controller';
/* eslint-disable @typescript-eslint/no-var-requires */
const { sprintf } = require('sprintf-js');
const excluded = [null, undefined, ''];

let lambdaProxy: Server;
const LOG_MESSAGE_RECEIVED = 'Received message: %s';
const LOG_WRONG_EVENT_TYPE =
  'Message for Notification not processed, wrong eventtype found: %s in %s';

function emptyCheck(dataValue) {
  return !excluded.includes(dataValue) ? dataValue : '';
}

async function bootstrap(uuid = null) {
  console.log('Calling bootstrap');
  const expressServer = express();
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressServer),
  );
  nestApp.use(eventContext());
  sharedBootstrap(nestApp);
  await nestApp.init();
  const appController = nestApp.get(AppController);
  if (uuid) {
    const orders = await appController.orderCheck(uuid);
    const requestBody = {
      orderUUID: emptyCheck(orders['data'].UUID),
      vso: emptyCheck(orders['data'].VSO),
      vendorName: '',
      vendorSKU: '',
      quantity: emptyCheck(orders['data'].quantity),
      status: emptyCheck(orders['data'].status),
    };
    orders['data'].attributes.filter(function (attrubuteData) {
      switch (attrubuteData['option']) {
        case 'ProductVendorName':
          requestBody['vendorName'] = emptyCheck(attrubuteData['option']);
          break;
        case 'ProductVendorSKU':
          requestBody['vendorSKU'] = emptyCheck(attrubuteData['option']);
          break;
        default:
          break;
      }
    });
    console.log('Request Body ::');
    console.dir(requestBody);
    const purchaseListController = nestApp.get(PurchaseListController);
    const postResult = await purchaseListController.create(requestBody);
    console.log('Returned Value ::');
    console.dir(postResult, { depth: null });
  }
  return serverlessExpress.createServer(expressServer);
}

export const handler = (event: any, context: Context) => {
  let uuid = null;
  console.dir(event, { depth: null });
  if (event['Records']) {
    console.log(event['Records'][0].Sns.Message);
    const message = JSON.parse(event['Records'][0].Sns.Message);
    console.log(sprintf(LOG_MESSAGE_RECEIVED, JSON.stringify(message)));

    if (message.eventType !== 'OrderAccepted') {
      console.log(
        sprintf(
          LOG_WRONG_EVENT_TYPE,
          message.eventType,
          JSON.stringify(message),
        ),
      );
      // Required for future.
      // return callback(null, sprintf(OTHER_EVENT_TYPE, EventHelper.getEventType(message)));
    } else {
      uuid = message.uuid;
    }
  } //end excluded.

  if (!lambdaProxy) {
    bootstrap(uuid).then((server) => {
      lambdaProxy = server;
      serverlessExpress.proxy(lambdaProxy, event, context);
    });
  } else {
    serverlessExpress.proxy(lambdaProxy, event, context);
  }
};
