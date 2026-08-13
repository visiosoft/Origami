"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const path_1 = require("path");
const fs_1 = require("fs");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Origami Design + Build')
        .setDescription('CRM & Project Delivery API')
        .setVersion('1.0')
        .build();
    swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, config));
    const clientDir = (0, path_1.join)(__dirname, '..', 'client');
    if ((0, fs_1.existsSync)(clientDir)) {
        app.useStaticAssets(clientDir);
        const expressApp = app.getHttpAdapter().getInstance();
        expressApp.get(/^\/(?!api).*/, (_req, res) => {
            res.sendFile((0, path_1.join)(clientDir, 'index.html'));
        });
    }
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map