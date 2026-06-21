import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { resolveWebDistPath, resolveWebIndexPath } from './spa/web-dist';

function getAllowedOrigins():
  | boolean
  | string[]
  | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const webUrl = process.env.WEB_URL;
  const extraOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const staticOrigins = [webUrl, ...(extraOrigins || [])].filter(Boolean) as string[];

  if (process.env.NODE_ENV === 'production' && staticOrigins.length > 0) {
    return staticOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isLocalDev =
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin) ||
      /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin);
    const isNgrok = /\.ngrok-free\.(app|dev)$/.test(origin) || /\.ngrok\.io$/.test(origin);
    const isListed = staticOrigins.includes(origin);

    callback(null, isLocalDev || isNgrok || isListed);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const webIndexPath = resolveWebIndexPath();
  const spaPaths = new Set(['/', '/dashboard', '/profiles', '/applications']);

  if (webIndexPath) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || !spaPaths.has(req.path)) {
        next();
        return;
      }

      const accept = req.headers.accept || '';
      const wantsHtml =
        accept.includes('text/html') && !accept.includes('application/json');

      if (!wantsHtml && req.path !== '/') {
        next();
        return;
      }

      res.sendFile(webIndexPath);
    });
  }

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'auth', method: RequestMethod.ALL },
      { path: 'auth/(.*)', method: RequestMethod.ALL },
      { path: 'files', method: RequestMethod.ALL },
      { path: 'files/(.*)', method: RequestMethod.ALL },
      { path: '', method: RequestMethod.GET },
      { path: 'dashboard', method: RequestMethod.GET },
      { path: 'vite.svg', method: RequestMethod.GET },
    ],
  });

  const webDist = resolveWebDistPath();
  const assetsDir = join(webDist, 'assets');
  if (existsSync(assetsDir)) {
    app.useStaticAssets(assetsDir, { prefix: '/assets' });
  }

  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
