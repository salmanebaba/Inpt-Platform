import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureHttp } from './common/http';
import { validateConfig } from './config';
async function bootstrap() {
  validateConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  configureHttp(app);
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('SmartResto — Demo API')
      .setDescription('Simulation uniquement. Aucun solde réel modifié.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: false },
    });
  }
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
void bootstrap();
