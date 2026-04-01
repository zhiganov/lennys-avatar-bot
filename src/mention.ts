import { Composer } from 'grammy';
import type { Context } from 'grammy';
import { getGroup, saveMessage, getThreadContext } from './db.js';
import { LennyMcpClient, TokenExpiredError } from './lenny.js';
import { buildSearchQueries, buildGroundedPrompt } from './avatar.js';
import { generateResponse, type Provider } from './llm.js';

const mention = new Composer();

mention.on('message:text', async (ctx, next) => {
  if (ctx.chat?.type === 'private') return next();

  const botUsername = ctx.me.username;
  const text = ctx.message.text;
  const isReplyToBot =
    ctx.message.reply_to_message?.from?.id === ctx.me.id;
  const isMention =
    text.includes(`@${botUsername}`);

  if (!isMention && !isReplyToBot) return next();

  const chatId = String(ctx.chat.id);
  const group = getGroup(chatId);

  if (!group?.lenny_token || !group?.llm_key || !group?.llm_provider) {
    await ctx.reply(
      'I\'m not set up yet. An admin needs to run /setup.',
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
    return;
  }

  const question = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
  if (!question) {
    await ctx.reply(
      'Ask me a product, growth, or startup question!',
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
    return;
  }

  saveMessage(
    chatId,
    ctx.message.message_id,
    'user',
    question,
    ctx.message.reply_to_message?.message_id ?? null,
  );

  await ctx.replyWithChatAction('typing');

  try {
    const lennyClient = new LennyMcpClient(group.lenny_token);
    const queries = buildSearchQueries(question);

    const allResults = await Promise.all(
      queries.map((q) => lennyClient.searchContent(q, 'newsletter', 5)),
    );

    const seen = new Set<string>();
    const searchResults = allResults
      .flat()
      .filter((r) => {
        if (seen.has(r.filename)) return false;
        seen.add(r.filename);
        return true;
      })
      .slice(0, 8);

    const excerpts = await Promise.all(
      searchResults.slice(0, 5).map((r) =>
        lennyClient.readExcerpt(r.filename, question, 0, 500).catch(() => null),
      ),
    );
    const validExcerpts = excerpts.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );

    const thread = ctx.message.reply_to_message
      ? getThreadContext(chatId, ctx.message.reply_to_message.message_id)
      : [];

    const { system, userMessage } = buildGroundedPrompt(
      question,
      searchResults,
      validExcerpts,
      thread,
    );

    const response = await generateResponse(
      group.llm_key,
      group.llm_provider as Provider,
      system,
      userMessage,
    );

    const sent = await ctx.reply(response, {
      reply_parameters: { message_id: ctx.message.message_id },
      parse_mode: 'Markdown',
    });

    saveMessage(
      chatId,
      sent.message_id,
      'assistant',
      response,
      ctx.message.message_id,
    );
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      await ctx.reply(
        'I can\'t search right now — the admin has been notified.',
        { reply_parameters: { message_id: ctx.message.message_id } },
      );

      try {
        await ctx.api.sendMessage(
          Number(group.admin_user_id),
          `Your Lenny's Data token for *${escapeForTelegram(group.chat_name ?? 'your group')}* has expired\\.\n` +
            `Please DM me a new token from lennysdata\\.com/access/mcp \\(Cursor tab → Reveal token\\)\\.`,
          { parse_mode: 'MarkdownV2' },
        );
      } catch { /* DM may fail */ }

      return;
    }

    console.error('Error handling mention:', err);
    await ctx.reply(
      'Something went wrong generating a response. Please try again.',
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
  }
});

function escapeForTelegram(text: string): string {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

export default mention;
