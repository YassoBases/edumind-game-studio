import { PrismaClient } from '@prisma/client';
import { logger } from './logger.ts';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => logger.error({ target: e.target }, e.message));
prisma.$on('warn', (e) => logger.warn({ target: e.target }, e.message));
