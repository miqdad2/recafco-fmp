import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env['API_PORT'] ?? '4000', 10);
  await app.listen(port);
  console.log(`RECAFCO FMP API listening on port ${port}`);
}

void bootstrap();
