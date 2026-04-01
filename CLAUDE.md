# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Student of Lenny's Corpus" — a Telegram avatar that answers product/growth/startup questions grounded in Lenny Rachitsky's newsletter archive. Built on [Avatar SDK](https://github.com/harmonicabot/avatar-sdk). Users bring their own Lenny's Data MCP token + AI API key (Anthropic, OpenAI, or Gemini — auto-detected).

## Commands

```bash
npm run dev       # Dev mode with tsx watch (long polling, requires .env with BOT_TOKEN)
npm run build     # TypeScript → dist/
npm start         # Production (requires BOT_TOKEN; uses webhook if WEBHOOK_URL set)
npx tsc --noEmit  # Type-check without emitting
```

No test runner. Type-check with `npx tsc --noEmit` before pushing.

## Architecture

```
Telegram Group
  ↕ grammy (Bot API)
handlers.ts    — /start, /setup, /help, /status, /reset + DM setup flow
mention.ts     — @mention and reply detection → search → prompt → respond
  ↕
vector-search.ts — Primary: Supabase pgvector semantic search (5,003 chunks)
lenny.ts         — Fallback: Lenny's MCP (SSE transport) for text search + full content reads
  ↕
avatar.ts      — System prompt + grounded prompt assembly
llm.ts         — Multi-provider LLM (Anthropic/OpenAI/Gemini, auto-detected from key)
db.ts          — JSON file storage for group configs, setup state, message thread context
analytics.ts   — PostHog event tracking
```

### Retrieval Strategy

1. **Vector search (primary):** Embed query via OpenAI → search Supabase `search_avatar_chunks` for `lenny-rachitsky` avatar (5,003 chunks from 349 newsletters). Threshold: 0.2.
2. **MCP fallback:** If vector returns nothing, fall back to Lenny's MCP `search_content` (text search) + `read_content` (full post, truncated to 4000 chars).
3. **Analytics tracks which path:** `retrieval: 'vector'` or `retrieval: 'mcp_fallback'`.

### Lenny MCP Client (`lenny.ts`)

Lenny's MCP server uses **SSE (Streamable HTTP) transport**, not plain JSON-RPC:
- Requires `Accept: application/json, text/event-stream` header
- Returns `text/event-stream` responses parsed for `data:` lines
- Needs `initialize` handshake + `notifications/initialized` before tool calls
- Session tracked via `mcp-session-id` header
- On 401: throws `TokenExpiredError` (token expires every 30 days)

### Setup Flow State

Two-step DM flow (Lenny token → AI key). Setup state is persisted to the JSON DB (`pendingSetups`) — survives Railway redeploys. Step 2 is also detected via `getGroupPendingLlmKey()` (group has lenny_token but no llm_key).

### LLM Provider Detection (`llm.ts`)

Auto-detected from API key prefix: `sk-ant-` → Anthropic (Claude Sonnet 4), `sk-` → OpenAI (GPT-4.1), `AI` → Google (Gemini 2.0 Flash).

## Deployment

Railway via Dockerfile, under the "Avatar SDK" project. Auto-deploys from GitHub (`zhiganov/lennys-avatar-bot`). Webhook mode in production (`WEBHOOK_URL` set), long polling for local dev.

## Environment Variables

- `BOT_TOKEN` (required) — from @BotFather
- `SUPABASE_URL` — Supabase project URL (for vector search)
- `SUPABASE_ANON_KEY` — Supabase anon key (for vector search)
- `OPENAI_API_KEY` — OpenAI key for embedding queries (vector search)
- `DATABASE_PATH` (optional) — defaults to `data/bot.db`
- `PORT` (optional) — defaults to 3000
- `WEBHOOK_URL` (optional) — webhook mode; otherwise long polling
- `POSTHOG_API_KEY` (optional) — PostHog analytics

## BotFather Settings

Group Privacy must be **Off** and Chat Access Mode must be **On** for the bot to see mentions in groups.
