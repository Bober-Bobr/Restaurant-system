import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { registerWebhook } from './modules/telegram/telegram.service.js';

app.listen(env.PORT, () => {
  console.log(`API running on port ${env.PORT}`);
  // Point Telegram at our webhook (no-op unless the bot env vars are set).
  void registerWebhook();
});
