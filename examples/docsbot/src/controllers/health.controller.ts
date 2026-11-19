import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
};

export function createReadyController(checks: {
  db: () => Promise<boolean>;
  collection: () => Promise<boolean>;
}): RequestHandler {
  return async (_req, res) => {
    const [db, collection] = await Promise.all([checks.db(), checks.collection()]);
    const ready = db && collection;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', db, collection });
  };
}
