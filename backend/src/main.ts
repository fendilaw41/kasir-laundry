import 'dotenv/config';
process.env.TZ = 'Asia/Jakarta';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*';
  app.enableCors({
    origin: corsOrigin.includes('*') ? '*' : corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // HTTP Operations Logger (GET, STORE, UPDATE, DELETE)
  const httpLogger = new Logger('HTTP');
  app.use((req: any, res: any, next: any) => {
    const { method, originalUrl, query } = req;
    const startTime = Date.now();

    let operation = 'REQUEST';
    if (method === 'GET') operation = 'GET';
    else if (method === 'POST') operation = 'STORE';
    else if (method === 'PUT' || method === 'PATCH') operation = 'UPDATE';
    else if (method === 'DELETE') operation = 'DELETE';

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const queryStr = Object.keys(query || {}).length > 0 ? ` ?${JSON.stringify(query)}` : '';

      let bodySummary = '';
      if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
        try {
          const maskSensitive = (data: any): any => {
            if (Array.isArray(data)) {
              return data.map(maskSensitive);
            }
            if (data && typeof data === 'object') {
              const clone = { ...data };
              if (clone.password) {
                clone.password = '***';
              }
              for (const key of Object.keys(clone)) {
                if (clone[key] && typeof clone[key] === 'object') {
                  clone[key] = maskSensitive(clone[key]);
                }
              }
              return clone;
            }
            return data;
          };

          const sanitized = maskSensitive(req.body);
          bodySummary = ` | Body: ${JSON.stringify(sanitized)}`;
        } catch {
          // ignore
        }
      }

      const logMsg = `[${operation}] ${method} ${originalUrl}${queryStr} -> ${statusCode} (${duration}ms)${bodySummary}`;

      if (statusCode >= 500) {
        httpLogger.error(logMsg);
      } else if (statusCode >= 400) {
        httpLogger.warn(logMsg);
      } else {
        httpLogger.log(logMsg);
      }
    });

    next();
  });

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Kasir Laundry API')
    .setDescription('Dokumentasi REST API & Sinkronisasi Data Kasir Laundry (Offline-First)')
    .setVersion('1.0.0')
    .addTag('Orders', 'Manajemen & Sinkronisasi Pesanan')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend server running on http://localhost:${port}/api`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();


