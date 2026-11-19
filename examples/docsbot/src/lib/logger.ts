import { pino } from 'pino';
import { baseEnvSchema } from '../config/env.js';

const { NODE_ENV, LOG_LEVEL } = baseEnvSchema.parse(process.env);

export const logger = pino({
  level: LOG_LEVEL,
  redact: ['req.headers.authorization'],
  ...(NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
