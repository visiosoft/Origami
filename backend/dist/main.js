"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({ origin: 'http://localhost:5173' });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Origami Design + Build')
        .setDescription('CRM & Project Delivery API')
        .setVersion('1.0')
        .build();
    swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, config));
    await app.listen(3000);
}
bootstrap();
//# sourceMappingURL=main.js.map