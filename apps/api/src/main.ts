import './load-env'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import helmet from 'helmet'
import session = require('express-session')

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production'
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProd ? ['error', 'warn', 'log'] : undefined,
  })

  if (isProd) {
    app.set('trust proxy', 1)
  }

  app.useGlobalFilters(new AllExceptionsFilter())
  app.use(helmet())
  app.use(session({
    name: 'ama.oauth',
    secret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    },
  }))

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )

  const port = process.env.PORT ?? 3001
  await app.listen(port)

  console.log(`API running on http://localhost:${port}`)
}
bootstrap()
