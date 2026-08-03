import 'dotenv/config';
import { startOrderRetentionSweep } from './modules/order/order.retention.js';
import { app } from './app.js';
import { env } from './config/env.js';
import { registerWebhook } from './modules/telegram/telegram.service.js';

// Housekeeping: closed orders are purged a year after closing (see
// order.retention.ts for why this is a daily sweep and not an annual timer).
startOrderRetentionSweep();

app.listen(env.PORT, () => {
  console.log(`API running on port ${env.PORT}`);
  // Point Telegram at our webhook (no-op unless the bot env vars are set).
  void registerWebhook();
});
