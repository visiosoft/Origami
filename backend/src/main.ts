import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Request, Response } from 'express';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // Gzip responses: the app's JavaScript and the task lists are several MB as plain text.
  app.use(compression());

  // Azure App Service terminates TLS and proxies every request, so without
  // this every req.ip would be the proxy's own address -- which is exactly
  // what the e-signature features (Project Program, proposals) record as
  // part of the certification. Trusting one hop reads it off X-Forwarded-For.
  app.set('trust proxy', 1);

  // The SPA is served by this same process, so the app itself never makes a
  // cross-origin call. Allow only what CORS_ORIGINS names -- a wide-open policy
  // would let any page on the internet read authenticated responses.
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(origins.length ? { origin: origins, credentials: true } : { origin: false });
  // Room for bulk saves (a People import of a few thousand rows, a long document) -- Express's default is 100kb.
  app.useBodyParser('json', { limit: '5mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Origami Design + Build')
    .setDescription('CRM & Project Delivery API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  // Serve the built frontend SPA (copied to backend/client during the production build).
  // The API keeps its own /api prefix; everything else falls back to index.html so
  // client-side routes (/dashboard, /login, …) work on hard refresh.
  const clientDir = join(__dirname, '..', 'client');
  if (existsSync(clientDir)) {
    // index: false -- "/" is the public home page below, not the app shell.
    // Built files under /assets have a content hash in their names, so a browser may keep them for good;
    // everything else (index.html and the public pages) is checked on each visit so a deploy shows at once.
    app.useStaticAssets(clientDir, {
      index: false,
      setHeaders: (res, path) => {
        res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    const expressApp = app.getHttpAdapter().getInstance();
    // The public pages are complete HTML documents, readable without JavaScript --
    // Google's app verification (and anyone not signed in) reads them as served.
    const page = (file: string) => (_req: Request, res: Response) => res.sendFile(join(clientDir, file), { headers: { 'Cache-Control': 'no-cache' } });
    expressApp.get(['/', '/home'], page('home.html'));
    expressApp.get('/privacy', page('privacy.html'));
    expressApp.get('/terms', page('terms.html'));
    expressApp.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
      res.sendFile(join(clientDir, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
