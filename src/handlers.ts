import { Composer } from 'grammy';
import {
  getGroup,
  upsertGroup,
  setGroupLennyToken,
  setGroupLlmKey,
  clearGroupKeys,
  getGroupPendingLlmKey,
} from './db.js';
import { detectProvider, providerName } from './llm.js';
import { track } from './analytics.js';

const pendingSetups = new Map<string, { chatId: string; chatName: string; step: 'lenny_token' | 'llm_key' }>();

const handlers = new Composer();

handlers.command('start', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  await ctx.reply(
    'Hi! I\'m a student of Lenny Rachitsky\'s corpus.\n\n' +
      'Add me to a group and run /setup to get started.',
  );
});

handlers.command('setup', async (ctx, next) => {
  if (ctx.chat?.type === 'private') return next();

  const userId = String(ctx.from?.id);
  const chatId = String(ctx.chat.id);
  const chatName = ctx.chat.title ?? 'this group';

  const member = await ctx.getChatMember(ctx.from!.id);
  if (!['creator', 'administrator'].includes(member.status)) {
    await ctx.reply('Only group admins can run /setup.');
    return;
  }

  upsertGroup(chatId, chatName, userId);
  pendingSetups.set(userId, { chatId, chatName, step: 'lenny_token' });

  try {
    await ctx.api.sendMessage(
      ctx.from!.id,
      `Hi\\! I'm setting up *Student of Lenny's Corpus* for *${escapeForTelegram(chatName)}*\\.\n\n` +
        `I need two things to get started:\n` +
        `1\\. Your Lenny's Data token \\(to search the newsletter archive\\)\n` +
        `2\\. An AI API key \\(Anthropic, OpenAI, or Gemini — to generate responses\\)\n\n` +
        `*Step 1:* Paste your Lenny's Data MCP token\\.\n` +
        `Go to lennysdata\\.com/access/mcp → Cursor tab → Reveal token → Copy`,
      { parse_mode: 'MarkdownV2' },
    );
    await ctx.reply('Check your DMs — I sent you setup instructions.');
  } catch {
    await ctx.reply(
      'I couldn\'t DM you. Please start a chat with me first, then run /setup again.',
    );
  }
});

handlers.command('help', async (ctx) => {
  await ctx.reply(
    'I\'m a student of Lenny Rachitsky\'s corpus. ' +
      'Mention me with a product, growth, or startup question and I\'ll share what Lenny has written about it.\n\n' +
      'Commands:\n' +
      '/setup — Connect your accounts (admin only)\n' +
      '/status — Check connection status\n' +
      '/reset — Disconnect and clear keys (admin only)',
  );
});

handlers.command('status', async (ctx, next) => {
  if (ctx.chat?.type === 'private') return next();

  const chatId = String(ctx.chat.id);
  const group = getGroup(chatId);

  if (!group) {
    await ctx.reply('Not set up yet. An admin needs to run /setup.');
    return;
  }

  const lennyOk = !!group.lenny_token;
  const llmOk = !!group.llm_key;
  const provider = group.llm_provider ? providerName(group.llm_provider as 'anthropic' | 'openai' | 'gemini') : 'Not connected';

  await ctx.reply(
    `Status for this group:\n` +
      `Lenny's Data: ${lennyOk ? '✅ Connected' : '❌ Not connected'}\n` +
      `LLM: ${llmOk ? `✅ ${provider}` : '❌ Not connected'}\n\n` +
      (lennyOk && llmOk ? 'Ready! Mention me with a question.' : 'Run /setup to complete configuration.'),
  );
});

handlers.command('reset', async (ctx, next) => {
  if (ctx.chat?.type === 'private') return next();

  const member = await ctx.getChatMember(ctx.from!.id);
  if (!['creator', 'administrator'].includes(member.status)) {
    await ctx.reply('Only group admins can run /reset.');
    return;
  }

  const chatId = String(ctx.chat.id);
  clearGroupKeys(chatId);
  await ctx.reply('Keys cleared. Run /setup to reconnect.');
});

handlers.on('message:text', async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return next();

  const userId = String(ctx.from?.id);
  const setup = pendingSetups.get(userId);

  if (!setup) {
    const pendingGroup = getGroupPendingLlmKey(userId);
    if (pendingGroup) {
      const key = ctx.message.text.trim();
      const provider = detectProvider(key);

      if (!provider) {
        await ctx.reply(
          'I couldn\'t detect your AI provider from that key.\n\n' +
            'Supported providers:\n' +
            '• Anthropic — key starts with sk-ant-\n' +
            '• OpenAI — key starts with sk-\n' +
            '• Google Gemini — key starts with AI\n\n' +
            'Please paste a valid API key.',
        );
        return;
      }

      setGroupLlmKey(pendingGroup.chat_id, key, provider);
      track('setup_complete', pendingGroup.chat_id, { provider });

      try {
        await ctx.deleteMessage();
      } catch { /* may not have permission */ }

      await ctx.reply(
        `All set\\! Using *${escapeForTelegram(providerName(provider))}*\\. The Lenny avatar is now active in *${escapeForTelegram(pendingGroup.chat_name ?? 'your group')}*\\.`,
        { parse_mode: 'MarkdownV2' },
      );

      try {
        await ctx.api.sendMessage(
          pendingGroup.chat_id,
          'I\'m connected and ready! Mention me with any product, growth, or startup question.',
        );
      } catch { /* group message may fail */ }

      return;
    }

    return next();
  }

  if (setup.step === 'lenny_token') {
    const token = ctx.message.text.trim();

    if (!token.startsWith('eyJ')) {
      await ctx.reply('That doesn\'t look like a Lenny\'s Data token. It should start with "eyJ". Try again.');
      return;
    }

    setGroupLennyToken(setup.chatId, token);

    try {
      await ctx.deleteMessage();
    } catch { /* may not have permission */ }

    pendingSetups.delete(userId);

    await ctx.reply(
      'Got it\\! Token saved\\.\n\n' +
        '*Step 2:* Paste your AI API key\\.\n\n' +
        'Supported providers \\(auto\\-detected from key\\):\n' +
        '• Anthropic \\— console\\.anthropic\\.com/settings/keys\n' +
        '• OpenAI \\— platform\\.openai\\.com/api\\-keys\n' +
        '• Google Gemini \\— aistudio\\.google\\.com/apikey',
      { parse_mode: 'MarkdownV2' },
    );
    return;
  }

  return next();
});

handlers.on('message:new_chat_members:me', async (ctx) => {
  await ctx.reply(
    'Hi! I\'m a student of Lenny Rachitsky\'s corpus. ' +
      'Mention me with product questions and I\'ll share what Lenny has written about it.\n\n' +
      'An admin needs to run /setup to connect me.',
  );
});

function escapeForTelegram(text: string): string {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

export default handlers;
