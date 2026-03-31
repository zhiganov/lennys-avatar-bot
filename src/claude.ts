import Anthropic from '@anthropic-ai/sdk';

export async function generateResponse(
  apiKey: string,
  system: string,
  userMessage: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text ?? 'I was unable to generate a response.';
}
