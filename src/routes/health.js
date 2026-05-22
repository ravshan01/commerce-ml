import { appConfig } from '../config.js';

export function registerHealthRoute(app) {
  app.get('/health', (context) =>
    context.json({
      status: 'ok',
      service: '1c-commerce-ml',
      uploadDir: appConfig.uploadDir,
      logDir: appConfig.logDir,
    }),
  );
}
