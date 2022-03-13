import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { sequelize } from '@nestjs/sequelize';
require('ts-node/register');
/* eslint-disable @typescript-eslint/no-var-requires */
const { Umzug, SequelizeStorage } = require('umzug');

@Injectable()
export class AppService {
  constructor(private httpService: HttpService) {}

  async migrate(id: string): Promise<any> {
    console.log('migrate script triggered', id);
    const umzug = new Umzug({
      migrations: { glob: 'src/migrations/*.{ts,js}' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });
    let consoleDisplay = 'Umzug LOGS:::<br/>';
    switch (id) {
      default:
      case 'up':
        await umzug.up().then(function (migrations) {
          console.log('Umzug Migrations UP::<br/>', migrations);
          consoleDisplay +=
            'Umzug Migrations UP::<br/>' + JSON.stringify(migrations);
        });
        break;
      case 'down':
        await umzug.down().then(function (migrations) {
          console.log('Umzug Migrations DOWN::<br/>', migrations);
          consoleDisplay +=
            'Umzug Migrations DOWN::<br/>' + JSON.stringify(migrations);
        });
        break;  
    }
    return consoleDisplay;
  }

  
}
