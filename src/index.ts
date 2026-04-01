import { createServer } from 'node:http';
import { Bot, webhookCallback } from 'grammy';
import { config } from './config.js';
import { initDb } from './db.js';
import { initAnalytics, shutdownAnalytics } from './analytics.js';
import handlers from './handlers.js';
import mention from './mention.js';

initDb();
initAnalytics();

const bot = new Bot(config.botToken);

bot.use(handlers);
bot.use(mention);

bot.catch((err) => {
  console.error('Bot error:', err);
});

async function start() {
  await bot.init();
  console.log(`Bot @${bot.botInfo.username} initialized.`);

  await bot.api.setMyCommands(
    [
      { command: 'setup', description: 'Connect your Lenny\'s Data account' },
      { command: 'status', description: 'Check connection status' },
      { command: 'help', description: 'How to use this bot' },
      { command: 'reset', description: 'Disconnect and clear keys' },
    ],
    { scope: { type: 'all_group_chats' } },
  );

  await bot.api.setMyCommands([], { scope: { type: 'all_private_chats' } });

  if (config.webhookUrl) {
    const webhookPath = `/webhook/${config.botToken}`;
    const fullUrl = `${config.webhookUrl}${webhookPath}`;

    const handleUpdate = webhookCallback(bot, 'http');

    const server = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === webhookPath) {
        try {
          await Promise.race([
            handleUpdate(req, res),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Webhook timeout')), 25_000),
            ),
          ]);
        } catch (err) {
          console.error('Webhook error:', err);
          if (!res.headersSent) {
            res.writeHead(200);
            res.end();
          }
        }
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(config.port, () => {
        console.log(`HTTP server listening on port ${config.port}`);
        resolve();
      });
    });

    await bot.api.setWebhook(fullUrl);
    console.log(`Webhook set to ${config.webhookUrl}/webhook/***`);
  } else {
    console.log('No WEBHOOK_URL set, using long polling...');
    await bot.start({ drop_pending_updates: true });
  }
}

start().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
