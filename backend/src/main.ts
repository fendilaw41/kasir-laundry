import 'dotenv/config';
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


