import { buildApp } from './app';
import { env } from './config/env';
import { startSelfPing } from './utils/self-ping';

const app = buildApp();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`LinkedIn Profile API listening at ${address}`);
    startSelfPing({ url: env.SELF_URL ?? env.RENDER_EXTERNAL_URL, logger: app.log });
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
