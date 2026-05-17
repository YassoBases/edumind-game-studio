import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.ts';
import { logger } from './logger.ts';
import { gamesRoutes } from './routes/games.ts';
import { healthRoutes } from './routes/health.ts';

async function bootstrap() {
  const app = Fastify({ loggerInstance: logger, bodyLimit: 4 * 1024 * 1024 });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: env().RATE_LIMIT_PER_STUDENT_PER_DAY,
    timeWindow: '1 day',
    keyGenerator: (req) => {
      const id = req.headers['x-student-id'];
      return typeof id === 'string' && id ? id : req.ip;
    },
  });

  await app.register(healthRoutes);
  await app.register(gamesRoutes, { prefix: '/api/games' });

  app.setErrorHandler((err, _req, reply) => {
    logger.error({ err }, 'request.error');
    const e = err as { statusCode?: number; name?: string; message?: string };
    const status = e.statusCode ?? 500;
    reply.status(status).send({
      error: e.name ?? 'InternalError',
      message: status >= 500 ? 'Internal error' : (e.message ?? 'error'),
    });
  });

  const port = env().PORT;
  await app.listen({ host: '0.0.0.0', port });
  logger.info({ port }, 'edumind.listening');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap.failed');
  process.exit(1);
});
