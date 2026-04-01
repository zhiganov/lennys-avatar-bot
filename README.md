# Lenny Avatar Bot

A Telegram bot that answers product, growth, and startup questions using Lenny Rachitsky's newsletter archive. Built on the [Avatar SDK](https://github.com/harmonicabot/avatar-sdk) — the bot is a "student" of Lenny's writing, not Lenny himself.

## Add to Your Group

1. Add the bot to your Telegram group
2. Run `/setup` in the group (admin only)
3. Follow the DM instructions to connect your Lenny's Data account and Anthropic API key

## What You Need

- A [Lenny's Newsletter](https://www.lennysnewsletter.com/) subscription (paid subscribers get full archive access)
- Your Lenny's Data MCP token from [lennysdata.com/access/mcp](https://www.lennysdata.com/access/mcp)
- An [Anthropic API key](https://console.anthropic.com/settings/keys) for response generation

## Usage

Mention the bot with any product question:

> @LennyAvatarBot what are good retention benchmarks for B2B SaaS?

Reply to the bot's messages for follow-up questions — it remembers the conversation thread.

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
3. Claude generates a grounded response using the avatar's system prompt
4. The response includes inline citations and a sources list

The bot never stores or redistributes Lenny's content — each group connects through the admin's own paid subscription.

## Self-Hosting

```bash
git clone https://github.com/harmonicabot/lennys-avatar-bot.git
cd lennys-avatar-bot
npm install
cp .env.example .env
# Fill in BOT_TOKEN from @BotFather
npm run dev
```

## Built With

- [Avatar SDK](https://github.com/harmonicabot/avatar-sdk) — Conversational Avatar Protocol
- [Lenny's Data MCP](https://www.lennysdata.com) — Newsletter archive access
- [Grammy](https://grammy.dev/) — Telegram Bot framework
- [Anthropic Claude](https://docs.anthropic.com/) — Response generation

## License

MIT
