import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const stackEnv = process.env.STACK_ENV || 'staging';

/**
 * this function will modify the nest application instance to suit or needs.
 * This can be used in both the default index and the lambda-entry-point to prevent duplicate code.
 * @param app
 */
export default function sharedBootstrap(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.use((req, res, next) => {
    const allowedOrigins = process.env.AllowOrigin?.split(',') || ['*'];
    let allowOrigin = allowedOrigins[0];
    if (stackEnv === 'prod') {
      const { origin } = req.headers;
      if (allowedOrigins.indexOf(origin) > -1) {
        allowOrigin = origin;
      }
    } else {
      allowOrigin = '*';
    }

    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, Content-Type, Authorization, X-Requested-With, Accept',
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS, DELETE, PATCH',
    );
    next();
  });
}
