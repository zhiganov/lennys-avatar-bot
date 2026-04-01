import { Composer } from 'grammy';
import { getGroup, saveMessage, getThreadContext } from './db.js';
import { LennyMcpClient, TokenExpiredError } from './lenny.js';
import { vectorSearch, type VectorResult } from './vector-search.js';
import { buildGroundedPrompt } from './avatar.js';
import { generateResponse, type Provider } from './llm.js';
import { track } from './analytics.js';

const mention = new Composer();

mention.on('message:text', async (ctx, next) => {
  if (ctx.chat?.type === 'private') return next();

  const botUsername = ctx.me.username;
  const text = ctx.message.text;
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;
  const isMention = text.includes(`@${botUsername}`);

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

  saveMessage(chatId, ctx.message.message_id, 'user', question, ctx.message.reply_to_message?.message_id ?? null);
  await ctx.replyWithChatAction('typing');

  try {
    // Primary: vector search (semantic)
    const vectorResults = await vectorSearch(question, 5, 0.3);

    // Secondary: if vector search found good results, use Lenny's MCP to read full posts
    // for the top hits. If vector search failed, fall back to MCP text search.
    const lennyClient = new LennyMcpClient(group.lenny_token);
    let passages: Array<{ content: string; title: string; year: number; filename?: string }> = [];

    if (vectorResults.length > 0) {
      // Deduplicate by title (multiple chunks from same post)
      const seenTitles = new Set<string>();
      const uniqueResults: VectorResult[] = [];
      for (const r of vectorResults) {
        if (!seenTitles.has(r.title)) {
          seenTitles.add(r.title);
          uniqueResults.push(r);
        }
      }

      // Use vector chunks as passages directly — they're already the relevant excerpts
      passages = uniqueResults.slice(0, 5).map((r) => ({
        content: r.content,
        title: r.title,
        year: r.year,
      }));
    } else {
      // Fallback: Lenny's MCP text search
      const results = await lennyClient.searchContent(question, '', 5).catch(() => []);
      if (results.length > 0) {
        const top = results.slice(0, 3);
        const fullContents = await Promise.all(
          top.map((r) => lennyClient.readContent(r.filename).catch(() => null)),
        );
        for (let i = 0; i < top.length; i++) {
          if (fullContents[i]) {
            passages.push({
              content: fullContents[i]!.slice(0, 4000),
              title: top[i].title,
              year: parseInt(top[i].date?.slice(0, 4) ?? '2023'),
              filename: top[i].filename,
            });
          }
        }
      }
    }

    const thread = ctx.message.reply_to_message
      ? getThreadContext(chatId, ctx.message.reply_to_message.message_id)
      : [];

    const { system, userMessage } = buildGroundedPrompt(question, passages, thread);

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

    saveMessage(chatId, sent.message_id, 'assistant', response, ctx.message.message_id);

    track('query', chatId, {
      question: question.slice(0, 200),
      provider: group.llm_provider,
      vector_results: vectorResults.length,
      passages: passages.length,
      response_length: response.length,
      retrieval: vectorResults.length > 0 ? 'vector' : 'mcp_fallback',
      is_reply: !!ctx.message.reply_to_message,
    });
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      await ctx.reply(
        'I can\'t search right now — the admin has been notified.',
        { reply_parameters: { message_id: ctx.message.message_id } },
      );
      track('error', chatId, { error: 'token_expired' });
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

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error handling mention:', err);
    track('error', chatId, { error: errorMsg, question: question.slice(0, 200) });
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
