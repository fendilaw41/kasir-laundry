"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
process.env.TZ = 'Asia/Jakarta';
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*';
    app.enableCors({
        origin: corsOrigin.includes('*') ? '*' : corsOrigin,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.setGlobalPrefix('api');
    const httpLogger = new common_1.Logger('HTTP');
    app.use((req, res, next) => {
        const { method, originalUrl, query } = req;
        const startTime = Date.now();
        let operation = 'REQUEST';
        if (method === 'GET')
            operation = 'GET';
        else if (method === 'POST')
            operation = 'STORE';
        else if (method === 'PUT' || method === 'PATCH')
            operation = 'UPDATE';
        else if (method === 'DELETE')
            operation = 'DELETE';
        res.on('finish', () => {
            const { statusCode } = res;
            const duration = Date.now() - startTime;
            const queryStr = Object.keys(query || {}).length > 0 ? ` ?${JSON.stringify(query)}` : '';
            let bodySummary = '';
            if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
                try {
                    const maskSensitive = (data) => {
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
                }
                catch {
                }
            }
            const logMsg = `[${operation}] ${method} ${originalUrl}${queryStr} -> ${statusCode} (${duration}ms)${bodySummary}`;
            if (statusCode >= 500) {
                httpLogger.error(logMsg);
            }
            else if (statusCode >= 400) {
                httpLogger.warn(logMsg);
            }
            else {
                httpLogger.log(logMsg);
            }
        });
        next();
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Kasir Laundry API')
        .setDescription('Dokumentasi REST API & Sinkronisasi Data Kasir Laundry (Offline-First)')
        .setVersion('1.0.0')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Masukkan JWT Bearer token Anda untuk mengakses endpoint yang dilindungi.',
        in: 'header',
    }, 'bearer')
        .addTag('Authentication', 'Autentikasi & Registrasi (Public)')
        .addTag('Orders', 'Manajemen & Sinkronisasi Pesanan (Memerlukan Bearer Token)')
        .addTag('Master Sync & Audit Logs', 'Sinkronisasi Master Data & Audit Logs (Memerlukan Bearer Token)')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`Backend server running on http://localhost:${port}/api`);
    console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map