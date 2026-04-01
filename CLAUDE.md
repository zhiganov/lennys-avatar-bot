# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Telegram bot ("Student of Lenny's Corpus") that answers product/growth/startup questions grounded in Lenny Rachitsky's newsletter archive. Users bring their own Lenny's Data MCP token + AI API key (Anthropic, OpenAI, or Gemini — auto-detected).

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
handlers.ts — /setup, /help, /status, /reset + DM setup flow
mention.ts  — @mention and reply detection → search → prompt → respond
  ↕
lenny.ts    — HTTP client for Lenny's MCP (SSE transport, session management)
  ↕
avatar.ts   — System prompt, search query building, grounded prompt assembly
llm.ts      — Multi-provider LLM (Anthropic/OpenAI/Gemini, auto-detected from key)
db.ts       — JSON file storage for group configs and message thread context
```

### Handler Registration Order

Middleware in `index.ts`: `handlers` → `mention`. The `handlers` composer processes commands and DM setup flow, calling `next()` to pass non-matching messages through to `mention`.

### Lenny MCP Client (`lenny.ts`)

Lenny's MCP server uses **SSE (Streamable HTTP) transport**, not plain JSON-RPC. Key details:
- Requires `Accept: application/json, text/event-stream` header
- Returns `text/event-stream` responses that must be parsed for `data:` lines
- Needs `initialize` handshake + `notifications/initialized` before tool calls
- Session tracked via `mcp-session-id` header
- On 401: throws `TokenExpiredError` (token expires every 30 days)

### Retrieval Strategy

1. Two parallel searches: full question + pipe-delimited keywords
2. Try `read_excerpt` with short keywords on top results
3. If all excerpts fail, fall back to `read_content` (full post, truncated to 4000 chars)
4. If everything fails, use search result snippets as passage context

### Setup Flow State

Two-step DM flow (Lenny token → AI key). Step 1 uses in-memory `pendingSetups` Map. After step 1 completes, the Map entry is deleted and step 2 is detected via `getGroupPendingLlmKey()` from the DB (group has lenny_token but no llm_key).

### LLM Provider Detection (`llm.ts`)

Auto-detected from API key prefix: `sk-ant-` → Anthropic (Claude Sonnet 4), `sk-` → OpenAI (GPT-4.1), `AI` → Google (Gemini 2.0 Flash).

## Deployment

Railway via Dockerfile. Auto-deploys from GitHub (`zhiganov/lennys-avatar-bot`). Webhook mode in production (`WEBHOOK_URL` set), long polling for local dev.

## Environment Variables

- `BOT_TOKEN` (required) — from @BotFather
- `DATABASE_PATH` (optional) — defaults to `data/bot.db`
- `PORT` (optional) — defaults to 3000
- `WEBHOOK_URL` (optional) — if set, uses webhook mode; otherwise long polling

## BotFather Settings

Group Privacy must be **Off** and Chat Access Mode must be **On** for the bot to see mentions in groups.
