export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  databasePath: process.env.DATABASE_PATH || 'data/bot.db',
  port: parseInt(process.env.PORT || '3000', 10),
  webhookUrl: process.env.WEBHOOK_URL || '',
  posthogKey: process.env.POSTHOG_API_KEY || '',
  posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}
