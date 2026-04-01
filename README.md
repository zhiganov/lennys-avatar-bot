# Student of Lenny's Corpus

A Telegram bot that answers product, growth, and startup questions grounded in Lenny Rachitsky's newsletter archive. Add it to your team's group chat and get cited, practical advice from 349 newsletter posts — without leaving Telegram.

Built for [Lenny's Data Challenge](https://www.lennysnewsletter.com/p/build-something-with-my-data) using the [Avatar SDK](https://github.com/harmonicabot/avatar-sdk).

## Background

Lenny Rachitsky released his entire [newsletter and podcast archive](https://www.lennysdata.com) as AI-friendly data — 349 newsletter posts and 289 podcast transcripts — and challenged his community to build something with it.

This bot is our entry: a **knowledge avatar** that acts as a "student" of Lenny's writing. It doesn't pretend to be Lenny. Instead, it searches his published work, retrieves relevant passages, and generates grounded responses with citations. When it doesn't have coverage on a topic, it says so honestly.

The avatar concept comes from [Avatar SDK](https://github.com/harmonicabot/avatar-sdk) — an open-source framework for building conversational avatars grounded in verified source documents. The same approach works for any author, researcher, or body of knowledge.

## Try It

1. Add [@lennys_avatar_bot](https://t.me/lennys_avatar_bot) to your Telegram group
2. Run `/setup` in the group (admin only)
3. Follow the DM instructions to connect your Lenny's Data account and AI API key
4. Mention the bot with a question

> @lennys_avatar_bot what are good retention benchmarks for B2B SaaS?

Reply to the bot's messages for follow-up questions — it remembers the conversation thread.

## What You Need

- A [Lenny's Newsletter](https://www.lennysnewsletter.com/) subscription (paid subscribers get the full archive)
- Your Lenny's Data MCP token from [lennysdata.com/access/mcp](https://www.lennysdata.com/access/mcp)
- An AI API key for response generation (auto-detected from key prefix):
  - [Anthropic](https://console.anthropic.com/settings/keys) (Claude)
  - [OpenAI](https://platform.openai.com/api-keys) (GPT-4.1)
  - [Google](https://aistudio.google.com/apikey) (Gemini)

## Commands

| Command | Description |
|---------|-------------|
| `/setup` | Connect your accounts (admin only) |
| `/status` | Check connection status |
| `/help` | How to use the bot |
| `/reset` | Disconnect and clear keys (admin only) |

## How It Works

1. Your question is searched against Lenny's newsletter archive via the [official MCP server](https://www.lennysdata.com)
2. Relevant passages are retrieved with source attribution
3. Your chosen AI model generates a grounded response using the avatar's system prompt — a set of constraints that keep the bot honest (cite sources, attribute guest contributors, don't invent benchmarks, acknowledge gaps)
4. The response includes inline citations and a sources list

The bot never stores or redistributes Lenny's content — each group connects through the admin's own paid subscription.

## Self-Hosting

```bash
git clone https://github.com/zhiganov/lennys-avatar-bot.git
cd lennys-avatar-bot
npm install
cp .env.example .env
# Fill in BOT_TOKEN from @BotFather
npm run dev
```

Create your own bot via [@BotFather](https://t.me/BotFather) and set Group Privacy to Off so the bot can see mentions.

## Built With

- [Avatar SDK](https://github.com/harmonicabot/avatar-sdk) — Infrastructure for building knowledge avatars grounded in verified source documents
- [Lenny's Data MCP](https://www.lennysdata.com) — Official newsletter archive access
- [Grammy](https://grammy.dev/) — Telegram Bot framework
- [Anthropic Claude](https://docs.anthropic.com/) / [OpenAI](https://platform.openai.com/) / [Google Gemini](https://ai.google.dev/) — Response generation (user's choice)

## License

MIT
