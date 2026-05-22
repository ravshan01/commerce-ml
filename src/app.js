import { Hono } from 'hono';
import { requestLoggingMiddleware } from './middleware/request-logging.js';
import { failure } from './http/responses.js';
import { registerCommerceMlRoutes } from './routes/commerce-ml.js';
import { registerHealthRoute } from './routes/health.js';

export function createApp() {
  const app = new Hono();

  app.use('*', requestLoggingMiddleware);
  registerHealthRoute(app);
  registerCommerceMlRoutes(app);

  app.notFound(() => failure('Not found', 404));

  return app;
}
