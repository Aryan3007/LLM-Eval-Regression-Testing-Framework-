import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
};

// TODO(phase 3): check the Postgres connection once the DB is added.
export const getReady: RequestHandler = (_req, res) => {
  res.json({ status: 'ready' });
};
