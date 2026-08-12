import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Origami Design + Build')
    .setDescription('CRM & Project Delivery API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  // Serve the built frontend SPA (copied to backend/client during the production build).
  // The API keeps its own /api prefix; everything else falls back to index.html so
  // client-side routes (/dashboard, /login, …) work on hard refresh.
  const clientDir = join(__dirname, '..', 'client');
  if (existsSync(clientDir)) {
    app.useStaticAssets(clientDir);
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
