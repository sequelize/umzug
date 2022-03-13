import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import localVariables from '../config/localVariables';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(private httpService: HttpService) {}

  healthCheck(): string {
    console.log('Health check triggered');
    return 'ok';
  }

  async getOrder(uuid: string): Promise<any> {
    const orderingServiceEndpoint =
      localVariables.ORDERING_SERVICE_ENDPOINT + uuid; // console.log(orderingServiceEndpoint);
    const data = {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${await this.getToken()}`,
      },
    };
    try {
      const orderArray = await firstValueFrom(
        this.httpService.get(orderingServiceEndpoint, data),
      );
      return orderArray;
    } catch (e) {
      console.log('ERROR NOTES:::');
      console.dir(e, { depth: null });
    }
  }

  async getToken(): Promise<any> {
    const data = {
      client_id: localVariables.OAUTH_API_CLIENT,
      client_secret: localVariables.OAUTH_API_SECRET,
      grant_type: 'client_credentials',
      audience: localVariables.OAUTH_API_AUDIENCE,
    };
    const token = await firstValueFrom(
      this.httpService.post(localVariables.OAUTH_API_ENDPOINT, data),
    );
    return token.data.access_token;
  }
}
